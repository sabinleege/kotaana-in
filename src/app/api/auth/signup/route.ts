import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { roleForEmail } from "@/lib/auth/role";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(100),
  role: z.enum(["athlete", "coach"]),
  dateOfBirth: z.string().date(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid signup details." }, { status: 400 });
  const { name, email: rawEmail, password, role, dateOfBirth } = parsed.data;
  const email = rawEmail.toLowerCase();
  const effectiveRole = roleForEmail(email, role);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const age = Number.isNaN(dob.getTime()) ? -1 : Math.floor((Date.now() - dob.getTime()) / (365.2425*86400000));
  if(Number.isNaN(dob.getTime()) || dob > new Date() || age < 5 || age > 110) return NextResponse.json({error:"Enter a valid date of birth for an age between 5 and 110."},{status:400});
  const ageBand = age < 12 ? "youth_u12" : age < 14 ? "youth_u14" : age < 17 ? "youth_u17" : age >= 65 ? "masters" : "adult";
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: effectiveRole,
      profile: { create: { fullName: name, email, dateOfBirth: dob, age, ageBand, onboardingCompleted: false, connectCode: `K${crypto.randomUUID().slice(0, 8).toUpperCase()}` } },
    },
    select: { id: true, email: true, role: true },
  });
  return NextResponse.json({ ok: true, user });
}
