import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const DAY = 86400000;
const weekly = z.object({
  weightKg: z.number().positive().max(500).optional(),
  sleep: z.enum(["good", "ok", "poor"]), stress: z.number().int().min(1).max(5), pain: z.boolean(), painNote: z.string().max(200).optional(),
  goalFeel: z.enum(["ahead", "on_track", "behind"]), mealsRegular: z.boolean(), pregnancyFeeling: z.enum(["good", "tired", "unwell"]).optional(), note: z.string().max(400).optional(),
});
const monthly = z.object({
  weightKg: z.number().positive().max(500), targetWeight: z.number().positive().max(500).nullable().optional(), trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(), primaryGoal: z.enum(["general_fitness", "fat_loss", "muscle_gain", "endurance"]).optional(),
  sessionDurationMin: z.number().int().min(10).max(180).optional(), newHealthIssue: z.boolean().optional(), dietChange: z.string().max(300).optional(), note: z.string().max(400).optional(),
});

async function lastAt(userId: string, kind: string) { return (await prisma.questionnaire.findFirst({ where: { userId, kind }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null; }

export async function GET() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const userId = a.session.user.id;
  const [user, w, m, p] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }), lastAt(userId, "weekly"), lastAt(userId, "monthly"), prisma.profile.findUnique({ where: { userId } })]);
  const age = user ? (Date.now() - user.createdAt.getTime()) / DAY : 0;
  return NextResponse.json({
    weeklyDue: age >= 6 && (!w || (Date.now() - w.getTime()) / DAY >= 7), monthlyDue: age >= 28 && (!m || (Date.now() - m.getTime()) / DAY >= 30),
    isPregnant: Boolean(p?.isPregnant), profile: p ? { weight: p.weight, targetWeight: p.targetWeight, trainingDaysPerWeek: p.trainingDaysPerWeek, level: p.level, primaryGoal: p.primaryGoal, sessionDurationMin: p.sessionDurationMin } : null,
  });
}

/** Saves the weekly situation or monthly "improve my data" answers. Monthly answers update the saved profile so every plan is built from current facts. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const userId = a.session.user.id; const raw = await req.json().catch(() => null);
  const kind = raw?.kind === "monthly" ? "monthly" : "weekly";
  const p = (kind === "monthly" ? monthly : weekly).safeParse(raw?.answers);
  if (!p.success) return NextResponse.json({ error: "Please answer every question." }, { status: 400 });
  const d: any = p.data; const profileData: Record<string, unknown> = {};
  if (d.weightKg) profileData.weight = d.weightKg;
  if (kind === "weekly") profileData.stressLevel = d.stress;
  else {
    if (d.targetWeight !== undefined) profileData.targetWeight = d.targetWeight;
    for (const k of ["trainingDaysPerWeek", "level", "primaryGoal", "sessionDurationMin"]) if (d[k] !== undefined) profileData[k] = d[k];
  }
  await prisma.$transaction([
    prisma.questionnaire.create({ data: { userId, kind, answers: d as object } }),
    ...(Object.keys(profileData).length ? [prisma.profile.update({ where: { userId }, data: profileData as any })] : []),
    ...(d.weightKg ? [prisma.weightHistory.create({ data: { userId, weight: d.weightKg, weekLabel: new Date().toISOString().slice(0, 10) } })] : []),
  ]);
  return NextResponse.json({ ok: true, message: kind === "monthly" ? "Thanks — your details were updated, so your next plans use today's facts." : "Thanks — your weekly summary will use these answers.", reviewNow: kind === "monthly" });
}
