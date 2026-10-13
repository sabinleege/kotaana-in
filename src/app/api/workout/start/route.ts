import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { paywallResponse } from "@/lib/access";

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** The athlete pressed Start: record the time so the session has a beginning and an end. */
export async function POST() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const userId = a.session.user.id;
  const blocked = await paywallResponse(userId, a.session.user.role); if (blocked) return blocked;
  const today = dateOnly(new Date());
  const plan = await prisma.workoutPlan.findFirst({ where: { userId, date: today, isActive: true }, orderBy: { createdAt: "desc" } });
  if (!plan) return NextResponse.json({ error: "No workout to start yet." }, { status: 404 });
  const log = await prisma.workoutLog.upsert({ where: { userId_date: { userId, date: today } }, create: { userId, date: today, planId: plan.id, startedAt: new Date() }, update: { planId: plan.id, startedAt: new Date(), finishedAt: null } });
  return NextResponse.json({ ok: true, startedAt: log.startedAt });
}
