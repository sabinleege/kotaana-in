import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { bmiCategory, bmiOf, bodyFatCategory, nutritionTargets, weeksToGoal } from "@/lib/health/targets";

const DAY = 86400000;
const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
type Rating = { label: string; score: number } | null;
const rate = (v: number | null, bands: [number, string, number][], fallback: [string, number]): Rating => { if (v == null) return null; for (const [min, label, score] of bands) if (v >= min) return { label, score }; return { label: fallback[0], score: fallback[1] }; };

/** One round trip for everything the athlete dashboard shows. Every figure comes from recorded data; when nothing is recorded the value is null and the screen says so. */
export async function GET() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const userId = a.session.user.id;
  const now = new Date(); const today = dateOnly(now);
  const since30 = new Date(today.getTime() - 30 * DAY); const since14 = new Date(today.getTime() - 13 * DAY); const since7 = new Date(today.getTime() - 6 * DAY);

  const [profile, weights, checkins, meals, hydration, logs, activity, runs, injuries] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.weightHistory.findMany({ where: { userId }, orderBy: { recordedAt: "asc" }, take: 120 }),
    prisma.dailyCheckin.findMany({ where: { userId, date: { gte: since30 } }, orderBy: { date: "asc" } }),
    prisma.mealLog.findMany({ where: { userId, date: { gte: since7 } } }),
    prisma.hydrationLog.findMany({ where: { userId, date: { gte: since7 } } }),
    prisma.workoutLog.findMany({ where: { userId, date: { gte: since30 } }, orderBy: { date: "asc" } }),
    prisma.activityData.findMany({ where: { userId, date: { gte: since14 } } }),
    prisma.runActivity.findMany({ where: { userId, date: { gte: since14 } }, select: { date: true, calories: true } }),
    prisma.injury.count({ where: { athleteId: userId, status: { in: ["active", "recovering"] } } }),
  ]);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const weight = profile.weight ?? weights.at(-1)?.weight ?? null;
  const bmi = bmiOf(weight, profile.height);
  const targets = nutritionTargets({ ...profile, weight });
  const expectedPerWeek = Math.max(1, Math.min(7, profile.trainingDaysPerWeek || 3));

  // Goal progress: how far the weight has moved from the first recorded value toward the target.
  const startWeight = weights[0]?.weight ?? weight;
  let goalPct: number | null = null;
  if (weight != null && profile.targetWeight != null && startWeight != null) {
    const span = profile.targetWeight - startWeight;
    goalPct = Math.abs(span) < 0.05 ? (Math.abs(weight - profile.targetWeight) < 0.5 ? 100 : 0) : Math.max(0, Math.min(100, Math.round(((weight - startWeight) / span) * 100)));
  }

  // Training: sessions finished in the last 7 days against the athlete's weekly plan, and the current streak of consecutive training days.
  const doneDays = new Set(logs.filter((l) => l.completionRate > 0).map((l) => iso(l.date)));
  const done7 = [...doneDays].filter((d) => d >= iso(since7)).length;
  const adherence7 = Math.min(100, Math.round((done7 / expectedPerWeek) * 100));
  let streak = 0;
  for (let i = doneDays.has(iso(today)) ? 0 : 1; i < 31; i++) { if (doneDays.has(iso(new Date(today.getTime() - i * DAY)))) streak++; else break; }
  const done30 = doneDays.size;
  const completion30 = avg(logs.filter((l) => l.completionRate > 0).map((l) => l.completionRate));
  const adherence30 = Math.min(1, done30 / Math.max(1, (expectedPerWeek * 30) / 7));
  const fitnessScore = done30 === 0 ? null : Math.round(100 * (0.5 * adherence30 + 0.3 * (completion30 ?? 0) + 0.2 * (bmi == null ? 0.6 : bmi >= 18.5 && bmi < 25 ? 1 : bmi < 30 ? 0.6 : 0.3)));

  // Readiness, sleep and soreness.
  const c7 = checkins.filter((c) => c.date >= since7);
  const todayCheckin = checkins.find((c) => iso(c.date) === iso(today)) ?? null;
  const recovery = todayCheckin?.readiness ?? (c7.length ? Math.round(avg(c7.map((c) => c.readiness))!) : null);
  const sleepAvg = avg(c7.map((c) => c.sleepHours).filter((v): v is number => v != null));

  // Nutrition and hydration over the last 7 days.
  const mealDays = meals.filter((m) => m.totalCalories > 0);
  const todayMeals = meals.find((m) => iso(m.date) === iso(today));
  const logged = (Array.isArray(todayMeals?.meals) ? todayMeals!.meals : []) as unknown as { protein: number; carbs: number; fat: number }[];
  const macros = { protein: logged.reduce((n, m) => n + (m.protein || 0), 0), carbs: logged.reduce((n, m) => n + (m.carbs || 0), 0), fat: logged.reduce((n, m) => n + (m.fat || 0), 0) };
  const nutritionRatio = mealDays.length >= 3 && targets ? avg(mealDays.map((m) => m.totalCalories))! / targets.calories : null;
  const waterRatio = hydration.length >= 3 ? avg(hydration.map((h) => (h.glasses * h.glassMl) / Math.max(1, h.targetMl)))! : null;

  const recoveryR = rate(recovery, [[80, "Excellent", 95], [65, "Good", 80], [45, "Fair", 55]], ["Poor", 30]);
  const sleepR = rate(sleepAvg, [[7.5, "Excellent", 95], [7, "Good", 80], [6, "Fair", 55]], ["Poor", 30]);
  const nutritionR = nutritionRatio == null ? null : nutritionRatio >= 0.85 && nutritionRatio <= 1.15 ? { label: "Good", score: 85 } : nutritionRatio >= 0.7 && nutritionRatio <= 1.3 ? { label: "Fair", score: 55 } : { label: "Poor", score: 30 };
  const hydrationR = rate(waterRatio, [[0.9, "Excellent", 95], [0.7, "Good", 80], [0.5, "Fair", 55]], ["Poor", 30]);
  const sorenessHigh = c7.some((c) => c.soreness >= 4);
  const overtrain = done7 > expectedPerWeek + 1 || (done7 > expectedPerWeek && sorenessHigh) ? { label: "High", score: 30 } : done7 > expectedPerWeek ? { label: "Moderate", score: 60 } : { label: "Low", score: 95 };
  const parts = [recoveryR, sleepR, nutritionR, hydrationR, logs.length ? overtrain : null].filter((x): x is NonNullable<Rating> => x != null);
  const notes: string[] = [];
  if (mealDays.length < 3) notes.push("Sparse meal logging — log meals in Nutrition for a fuller picture");
  if (!c7.length) notes.push("No check-ins this week");
  if (hydration.length < 3) notes.push("Water intake is rarely logged");
  if (injuries) notes.push(`${injuries} active injury restriction(s)`);
  const health = { score: parts.length >= 2 ? Math.round(avg(parts.map((p) => p.score))!) : null, recovery: recoveryR && { ...recoveryR, value: recovery }, sleep: sleepR, nutrition: nutritionR, hydration: hydrationR, overtraining: logs.length ? overtrain : null, notes };

  // Calories burned over the last 14 days: recorded activity plus tracked runs.
  const burned = Array.from({ length: 14 }, (_, i) => {
    const d = iso(new Date(since14.getTime() + i * DAY));
    const total = activity.filter((x) => iso(x.date) === d).reduce((n, x) => n + x.calories, 0) + runs.filter((x) => iso(x.date) === d).reduce((n, x) => n + x.calories, 0);
    return { date: d, value: total };
  });

  // Weight trend: one point per recorded day, last value of the day wins.
  const byDay = new Map<string, number>(); weights.forEach((w) => byDay.set(iso(w.recordedAt), w.weight));
  const weightSeries = [...byDay.entries()].slice(-30).map(([date, value]) => ({ date, value }));

  const weeks = weeksToGoal(weight, profile.targetWeight);
  const goalPlan = targets ? {
    goal: profile.primaryGoal || "general_fitness", calories: targets.calories, protein: targets.protein, sessionsPerWeek: expectedPerWeek, weeks,
    next: weight != null ? `Baseline ${weight} kg — keep ${expectedPerWeek}×/week for ${profile.sessionDurationMin || 35} min` : "Add your weight to see your plan",
  } : null;

  return NextResponse.json({
    name: profile.fullName,
    body: { weight, targetWeight: profile.targetWeight, height: profile.height, bmi, bmiCategory: bmiCategory(bmi), bodyFat: profile.bodyFat, bodyFatCategory: profile.bodyFat != null ? bodyFatCategory(profile.bodyFat, profile.gender) : null },
    goal: { pct: goalPct, from: startWeight, to: profile.targetWeight },
    calories: { today: todayMeals?.totalCalories ?? 0, target: targets?.calories ?? null },
    macros: { ...macros, targets: targets ? { protein: targets.protein, carbs: targets.carbs, fat: targets.fat } : null },
    adherence: { pct: adherence7, done7, expected: expectedPerWeek, streak },
    scores: { fitness: fitnessScore, recovery },
    health, goalPlan, burned, weightSeries,
    checkedInToday: Boolean(todayCheckin),
  });
}
