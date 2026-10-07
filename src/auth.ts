import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_EMAIL, roleForEmail } from "@/lib/auth/role";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/auth" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, allowDangerousEmailAccountLinking: true })]
      : []),
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || password.length < 8) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (!(await compare(password, user.passwordHash))) return null;
        if (email === ADMIN_EMAIL && user.role !== "admin") {
          await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
          user.role = "admin";
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const normalized = user.email.toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: normalized } });
      if (existing) {
        if (normalized === ADMIN_EMAIL && existing.role !== "admin") {
          await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
        }
        await prisma.profile.upsert({
          where: { userId: existing.id },
          update: { fullName: existing.name || user.name || "", email: normalized, avatarUrl: existing.image || user.image || null },
          create: { userId: existing.id, fullName: existing.name || user.name || "", email: normalized, avatarUrl: existing.image || user.image || null, connectCode: `K${crypto.randomUUID().slice(0, 8).toUpperCase()}` },
        });
        return true;
      }
      if (user.id && normalized === ADMIN_EMAIL) await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
      if (user.id) {
        await prisma.profile.upsert({
          where: { userId: user.id },
          update: { fullName: user.name || "", email: normalized, avatarUrl: user.image || null },
          create: { userId: user.id, fullName: user.name || "", email: normalized, avatarUrl: user.image || null, connectCode: `K${crypto.randomUUID().slice(0, 8).toUpperCase()}` },
        });
      }
      return Boolean(account);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      if (token.id && !token.role) {
        const dbUser = await prisma.user.findUnique({ where: { id: String(token.id) }, select: { role: true, email: true } });
        if (dbUser) token.role = roleForEmail(dbUser.email, dbUser.role === "coach" ? "coach" : "athlete");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = String(token.id);
        session.user.role = (token.role || "athlete") as "athlete" | "coach" | "admin";
      }
      return session;
    },
  },
});
