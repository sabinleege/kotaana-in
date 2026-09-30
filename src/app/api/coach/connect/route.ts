import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

const body = z.object({ email: z.string().trim().email() });
/** Coach asks an existing athlete (by exact email) to join the roster; the athlete accepts from Notifications. */
export async function POST(req: Request) {
  const p = body.safeParse(await readJson(req)); if (!p.success) return bad("Enter the athlete's email address.");
  const c = await coachApi(); if ("error" in c) return c.error;
  const athlete = await prisma.user.findUnique({ where: { email: p.data.email.toLowerCase() }, select: { id: true, role: true } });
  // Same message whether or not the account exists, so the form can't be used to discover who is registered.
  const generic = NextResponse.json({ ok: true, message: "If an athlete account uses that email, they will get your request in their notifications. You can also send them an invite code." });
  if (!athlete || athlete.role !== "athlete") return generic;
  const existing = await prisma.coachAthleteRelation.findUnique({ where: { coachId_athleteId: { coachId: c.coachId, athleteId: athlete.id } } });
  if (existing?.status === "active" || existing?.status === "paused") return NextResponse.json({ ok: true, message: "This athlete is already on your roster." });
  const rel = await prisma.coachAthleteRelation.upsert({ where: { coachId_athleteId: { coachId: c.coachId, athleteId: athlete.id } }, create: { coachId: c.coachId, athleteId: athlete.id, status: "pending", requestedByRole: "coach" }, update: { status: "pending", requestedByRole: "coach" } });
  const coach = await prisma.profile.findUnique({ where: { userId: c.coachId }, select: { fullName: true } });
  await prisma.notification.create({ data: { userId: athlete.id, title: "Coach connection request", message: `${coach?.fullName || "A coach"} wants to add you to their roster.`, type: "connection_request", data: { relationId: rel.id } } });
  return generic;
}
