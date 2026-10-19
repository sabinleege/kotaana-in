import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { cookies } from "next/headers";
import { ADMIN_EMAIL, roleForEmail } from "@/lib/auth/role";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // Errors (for example a missing server setting) land on our own page instead of the bare "Server error" screen.
  pages: { signIn: "/auth", error: "/auth" },
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
  events: {
    // Accounts created through Google start as athletes; a coach who chose "Coach / Gym" before continuing is upgraded here.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const email = user.email.toLowerCase();
      try {
        let wanted: string | undefined;
        try { wanted = (await cookies()).get("kotaana_signup_role")?.value; } catch {}
        const role = email === ADMIN_EMAIL ? "admin" : wanted === "coach" ? "coach" : undefined;
        if (role) await prisma.user.update({ where: { id: user.id }, data: { role } });
        await prisma.profile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, fullName: user.name || "", email, avatarUrl: user.image || null, organizationType: role === "coach" ? "coach" : null } });
      } catch (e) { console.error("[auth] could not finish creating the Google account", e); }
    },
  },
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
          create: { userId: existing.id, fullName: existing.name || user.name || "", email: normalized, avatarUrl: existing.image || user.image || null },
        });
        return true;
      }
      // A new account has no database row yet: its profile and role are created in events.createUser, right after the adapter saves the user.
      return Boolean(account);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Re-read the role: a new Google account may have just been made a coach in events.createUser.
        const fresh = user.id ? await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }) : null;
        token.role = fresh?.role ?? user.role;
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
