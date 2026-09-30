import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const body = z.object({ code: z.string().trim().min(4).max(32) });
/** Athlete redeems a coach invite code; the connection becomes active immediately. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Enter the invite code from your coach." }, { status: 400 });
  const invite = await prisma.coachInvite.findUnique({ where: { inviteCode: p.data.code.toUpperCase() }, include: { coach: { select: { name: true, profile: { select: { fullName: true } } } } } });
  if (!invite || invite.status !== "pending") return NextResponse.json({ error: "This invite code is not valid or was already used." }, { status: 404 });
  if (invite.expiresAt < new Date()) { await prisma.coachInvite.update({ where: { id: invite.id }, data: { status: "expired" } }); return NextResponse.json({ error: "This invite has expired. Ask your coach for a new one." }, { status: 410 }); }
  if (invite.email && invite.email !== a.session.user.email?.toLowerCase()) return NextResponse.json({ error: "This invite was created for a different email address." }, { status: 403 });
  const athleteId = a.session.user.id;
  await prisma.$transaction([
    prisma.coachAthleteRelation.upsert({ where: { coachId_athleteId: { coachId: invite.coachId, athleteId } }, create: { coachId: invite.coachId, athleteId, status: "active", requestedByRole: "coach" }, update: { status: "active" } }),
    prisma.coachInvite.update({ where: { id: invite.id }, data: { status: "accepted", acceptedById: athleteId, acceptedAt: new Date() } }),
    prisma.notification.create({ data: { userId: invite.coachId, title: "Invite accepted", message: `${a.session.user.name || a.session.user.email} joined your roster with code ${invite.inviteCode}.`, type: "connection" } }),
  ]);
  return NextResponse.json({ ok: true, coachName: invite.coach.profile?.fullName || invite.coach.name || "your coach" });
}
