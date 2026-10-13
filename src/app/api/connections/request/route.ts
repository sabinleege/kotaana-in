import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { capacityState } from "@/lib/coach/capacity";
import { paywallResponse } from "@/lib/access";

const body = z.object({ coachId: z.string().uuid() });

/** The athlete picks a coach from search and is connected straight away. An athlete has one coach at a time, so choosing a new one ends the previous connection and all data follows the new coach. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid coach." }, { status: 400 });
  const athleteId = a.session.user.id;
  const coach = await prisma.user.findUnique({ where: { id: p.data.coachId }, select: { role: true, name: true, profile: { select: { fullName: true, organizationType: true } } } });
  if (!coach || coach.role !== "coach") return NextResponse.json({ error: "Coach not found." }, { status: 404 });
  const current = await prisma.coachAthleteRelation.findUnique({ where: { coachId_athleteId: { coachId: p.data.coachId, athleteId } } });
  if (current?.status === "active") return NextResponse.json({ ok: true, message: "You are already connected to this coach." });
  // A coach, gym or club looks after 70 members for free; beyond that they must upgrade before taking more.
  const cap = await capacityState(p.data.coachId);
  if (cap.full && current?.status !== "paused") {
    const recent = await prisma.notification.findFirst({ where: { userId: p.data.coachId, type: "capacity", createdAt: { gt: new Date(Date.now() - 86400000) } }, select: { id: true } });
    if (!recent) await prisma.notification.create({ data: { userId: p.data.coachId, title: "Member limit reached", message: `Someone wants to join but you have ${cap.count} of ${cap.capacity} members. Upgrade to ${cap.nextTier.max} members ($${cap.nextTier.usd}) in Settings to take more.`, type: "capacity" } });
    return NextResponse.json({ error: "This coach has reached their member limit and can't take more members right now. Ask them to upgrade, or choose another coach.", code: "COACH_FULL" }, { status: 409 });
  }
  const previous = await prisma.coachAthleteRelation.findMany({ where: { athleteId, status: { in: ["active", "paused", "pending"] }, coachId: { not: p.data.coachId } }, select: { coachId: true } });
  const me = await prisma.profile.findUnique({ where: { userId: athleteId }, select: { fullName: true } });
  const who = me?.fullName || a.session.user.name || a.session.user.email || "An athlete";
  await prisma.$transaction([
    prisma.coachAthleteRelation.updateMany({ where: { athleteId, status: { in: ["active", "paused", "pending"] }, coachId: { not: p.data.coachId } }, data: { status: "ended" } }),
    prisma.coachAthleteRelation.upsert({ where: { coachId_athleteId: { coachId: p.data.coachId, athleteId } }, create: { coachId: p.data.coachId, athleteId, status: "active", requestedByRole: "athlete" }, update: { status: "active", requestedByRole: "athlete" } }),
    prisma.notification.create({ data: { userId: p.data.coachId, title: "New member", message: `${who} chose you as their coach. Their data now shows in your portal.`, type: "connection" } }),
    ...previous.map((r) => prisma.notification.create({ data: { userId: r.coachId, title: "Member moved on", message: `${who} switched to another coach and is no longer on your roster.`, type: "connection" } })),
  ]);
  const label = ({ gym: "gym", club: "club", coach: "coach" } as Record<string, string>)[coach.profile?.organizationType || "coach"] || "coach";
  return NextResponse.json({ ok: true, message: `Welcome to ${coach.profile?.fullName || coach.name || "your coach"} — you're now part of this ${label} community.` });
}

/** The athlete leaves their coach and goes back to training on their own; the coach stops seeing their data. */
export async function DELETE() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const athleteId = a.session.user.id;
  const rels = await prisma.coachAthleteRelation.findMany({ where: { athleteId, status: { in: ["active", "paused", "pending"] } }, select: { coachId: true } });
  if (!rels.length) return NextResponse.json({ ok: true });
  const me = await prisma.profile.findUnique({ where: { userId: athleteId }, select: { fullName: true } });
  await prisma.$transaction([
    prisma.coachAthleteRelation.updateMany({ where: { athleteId, status: { in: ["active", "paused", "pending"] } }, data: { status: "ended" } }),
    ...rels.map((r) => prisma.notification.create({ data: { userId: r.coachId, title: "Member left", message: `${me?.fullName || "A member"} is now training on their own and is no longer on your roster.`, type: "connection" } })),
  ]);
  return NextResponse.json({ ok: true });
}
