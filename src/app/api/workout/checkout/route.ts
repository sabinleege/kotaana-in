import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { estimateRecovery } from "@/lib/health/recovery";

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const body = z.object({
  rpe: z.number().int().min(1).max(10),
  felt: z.enum(["great", "good", "tough", "exhausted"]),
  pain: z.boolean(),
  painArea: z.string().trim().min(2).max(50).optional(),
  painSeverity: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
});

/** The check-out after a session: how hard it felt, how the body feels, and any pain. Pain opens an injury record so tomorrow's plan avoids it. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Answer all the check-out questions." }, { status: 400 });
  const userId = a.session.user.id; const today = dateOnly(new Date());
  const plan = await prisma.workoutPlan.findFirst({ where: { userId, date: today, isActive: true }, orderBy: { createdAt: "desc" } });
  if (!plan) return NextResponse.json({ error: "No active workout to check out of." }, { status: 404 });
  const moves = ((plan.planData as any)?.moves ?? []).filter((m: any) => m.role !== "hydration");
  const done = Array.isArray(plan.completedExercises) ? plan.completedExercises.length : 0;
  const completionRate = moves.length ? Math.min(1, done / moves.length) : 0;
  await prisma.workoutLog.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, planId: plan.id, completionRate, rpe: p.data.rpe, feltAfter: p.data.felt, painReported: p.data.pain, notes: p.data.notes, finishedAt: new Date() },
    update: { planId: plan.id, completionRate, rpe: p.data.rpe, feltAfter: p.data.felt, painReported: p.data.pain, notes: p.data.notes, finishedAt: new Date() },
  });
  let message = completionRate >= 0.99 ? "Session complete — every block done. Well done!" : `Session saved — ${Math.round(completionRate * 100)}% of the blocks were completed.`;
  if (p.data.pain && p.data.painArea) {
    const sev = p.data.painSeverity ?? 2;
    const est = estimateRecovery({ kind: "injury", type: "strain", severity: sev });
    await prisma.injury.create({ data: { athleteId: userId, bodyPart: p.data.painArea, injuryType: "Pain after training", severity: sev, status: "active", estimatedDays: est.days, estimateSource: est.source, nextFollowUpAt: new Date(Date.now() + 3 * 86400000), notes: p.data.notes } });
    await prisma.profile.update({ where: { userId }, data: { injuryDataStatus: "known" } });
    message += ` We noted pain in your ${p.data.painArea.toLowerCase()} — tomorrow's plan will avoid it, and we'll ask how it feels in a few days (about ${est.days} day${est.days === 1 ? "" : "s"} to settle).`;
  }
  if (p.data.felt === "exhausted" || p.data.rpe >= 9) message += " That was very hard — take extra rest and water tonight.";
  return NextResponse.json({ ok: true, message, completionRate });
}
