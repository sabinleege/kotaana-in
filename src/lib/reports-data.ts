import { prisma } from "@/lib/db/prisma";

function round(value: number, digits = 1) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000);
}

export async function getReportData(userId: string) {
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const [profile, performances30, runs30, weights30, checkins30, meals30, plans30, photos30] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { weight: true, targetWeight: true, primaryGoal: true } }),
    prisma.exercisePerformance.findMany({ where: { userId, createdAt: { gte: since30 } }, orderBy: { createdAt: "asc" } }),
    prisma.runActivity.findMany({ where: { userId, createdAt: { gte: since30 } }, orderBy: { createdAt: "asc" } }),
    prisma.weightHistory.findMany({ where: { userId, recordedAt: { gte: since30 } }, orderBy: { recordedAt: "asc" }, take: 100 }),
    prisma.dailyCheckin.findMany({ where: { userId, date: { gte: since30 } }, orderBy: { date: "asc" } }),
    prisma.mealLog.findMany({ where: { userId, date: { gte: since30 } }, orderBy: { date: "asc" } }),
    prisma.workoutPlan.findMany({ where: { userId, createdAt: { gte: since30 } }, orderBy: { createdAt: "asc" } }),
    prisma.progressPhoto.findMany({ where: { userId, date: { gte: since30 } }, orderBy: { date: "asc" } }),
  ]);

  const performances7 = performances30.filter((x) => x.createdAt >= since7);
  const runs7 = runs30.filter((x) => x.createdAt >= since7);
  const checkins7 = checkins30.filter((x) => x.date >= since7);
  const meals7 = meals30.filter((x: any) => x.date >= since7);
  const plans7 = plans30.filter((x) => x.createdAt >= since7);

  const completed7 = performances7.filter((x) => x.completed).length;
  const totalPerformance7 = performances7.length;
  const distance7 = round(runs7.reduce((sum, x) => sum + x.distanceKm, 0), 2);
  const distance30 = round(runs30.reduce((sum, x) => sum + x.distanceKm, 0), 2);
  const latestWeight = weights30.at(-1)?.weight ?? profile?.weight ?? null;
  const firstWeight = weights30[0]?.weight ?? null;
  const weightChange30 = latestWeight != null && firstWeight != null && weights30.length >= 2 ? round(latestWeight - firstWeight, 1) : null;
  const avgReadiness = checkins30.length ? round(checkins30.reduce((s, x) => s + x.readiness, 0) / checkins30.length, 1) : null;
  const avgSleep = checkins30.length ? round(checkins30.filter((x) => x.sleepHours != null).reduce((s, x) => s + (x.sleepHours ?? 0), 0) / Math.max(1, checkins30.filter((x) => x.sleepHours != null).length), 1) : null;

  const sources = [
    { key: "workoutPerformance", label: "Workout performance", count: performances30.length, available: performances30.length > 0 },
    { key: "trackedActivity", label: "GPS activity", count: runs30.length, available: runs30.length > 0 },
    { key: "weight", label: "Weight history", count: weights30.length, available: weights30.length > 0 || profile?.weight != null },
    { key: "checkins", label: "Health check-ins", count: checkins30.length, available: checkins30.length > 0 },
    { key: "nutrition", label: "Nutrition logs", count: meals30.length, available: meals30.length > 0 },
    { key: "workoutPlans", label: "Generated workout plans", count: plans30.length, available: plans30.length > 0 },
    { key: "progressPhotos", label: "Progress photos", count: photos30.length, available: photos30.length > 0 },
  ];
  const availableSources = sources.filter((x) => x.available).length;
  const status = availableSources === sources.length ? "complete" : availableSources > 0 ? "partial" : "insufficient";
  const missing = sources.filter((x) => !x.available).map((x) => x.label);

  return {
    status,
    statusLabel: status === "complete" ? "Complete data" : status === "partial" ? "Partial data" : "Not enough data",
    missing,
    sources,
    generatedAt: new Date().toISOString(),
    period: { days: 30 },
    sevenDay: {
      performanceEntries: totalPerformance7,
      completedEntries: completed7,
      completionRate: totalPerformance7 ? round((completed7 / totalPerformance7) * 100, 0) : null,
      trackedSessions: runs7.length,
      distanceKm: distance7,
      checkins: checkins7.length,
      mealsLogged: meals7.length,
      workoutPlans: plans7.length,
    },
    thirtyDay: {
      performanceEntries: performances30.length,
      completedEntries: performances30.filter((x) => x.completed).length,
      trackedSessions: runs30.length,
      distanceKm: distance30,
      weightEntries: weights30.length,
      weightChangeKg: weightChange30,
      currentWeightKg: latestWeight,
      avgReadiness,
      avgSleepHours: avgSleep,
      checkins: checkins30.length,
      mealsLogged: meals30.length,
      workoutPlans: plans30.length,
      progressPhotos: photos30.length,
    },
    weightSeries: weights30.map((x) => ({ date: x.recordedAt.toISOString(), weight: x.weight })),
    goal: profile?.primaryGoal ?? null,
    targetWeightKg: profile?.targetWeight ?? null,
  };
}

export type DailyPoint = { date: string; readiness: number | null; exercises: number; waterMl: number | null; waterTargetMl: number | null; distanceKm: number };

/** Day-by-day series for Progress charts plus plain-language findings drawn only from recorded data. */
export async function getProgressSeries(userId: string, days: number) {
  const end = new Date(); const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (days - 1)));
  const [checkins, performances, water, runs, weights, profile] = await Promise.all([
    prisma.dailyCheckin.findMany({ where: { userId, date: { gte: start } }, select: { date: true, readiness: true, sleepHours: true } }),
    prisma.exercisePerformance.findMany({ where: { userId, date: { gte: start }, completed: true }, select: { date: true } }),
    prisma.hydrationLog.findMany({ where: { userId, date: { gte: start } }, select: { date: true, glasses: true, glassMl: true, targetMl: true } }),
    prisma.runActivity.findMany({ where: { userId, date: { gte: start } }, select: { date: true, distanceKm: true } }),
    prisma.weightHistory.findMany({ where: { userId, recordedAt: { gte: start } }, orderBy: { recordedAt: "asc" }, select: { recordedAt: true, weight: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { targetWeight: true } }),
  ]);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) { const d = new Date(start.getTime() + i * 86400000); byDay.set(key(d), { date: key(d), readiness: null, exercises: 0, waterMl: null, waterTargetMl: null, distanceKm: 0 }); }
  for (const c of checkins) { const p = byDay.get(key(c.date)); if (p) p.readiness = c.readiness; }
  for (const x of performances) { const p = byDay.get(key(x.date)); if (p) p.exercises += 1; }
  for (const w of water) { const p = byDay.get(key(w.date)); if (p) { p.waterMl = w.glasses * w.glassMl; p.waterTargetMl = w.targetMl; } }
  for (const r of runs) { const p = byDay.get(key(r.date)); if (p) p.distanceKm = round(p.distanceKm + r.distanceKm, 2); }
  const daily = [...byDay.values()];

  const findings: string[] = [];
  const trainDays = daily.filter((d) => d.exercises > 0).length;
  const totalEx = daily.reduce((s, d) => s + d.exercises, 0);
  if (totalEx) findings.push(`You completed ${totalEx} exercise block${totalEx === 1 ? "" : "s"} across ${trainDays} training day${trainDays === 1 ? "" : "s"} in the last ${days} days.`);
  const ready = daily.filter((d) => d.readiness != null) as (DailyPoint & { readiness: number })[];
  if (ready.length) {
    const avg = Math.round(ready.reduce((s, d) => s + d.readiness, 0) / ready.length);
    const half = Math.floor(ready.length / 2);
    let trend = "";
    if (ready.length >= 4) { const a = ready.slice(0, half), b = ready.slice(half); const da = a.reduce((s, d) => s + d.readiness, 0) / a.length, db = b.reduce((s, d) => s + d.readiness, 0) / b.length; trend = db - da >= 5 ? ", and it is trending up" : da - db >= 5 ? ", and it is trending down — consider more recovery" : ", and it is steady"; }
    findings.push(`Your readiness averaged ${avg}/100 over ${ready.length} check-in${ready.length === 1 ? "" : "s"}${trend}.`);
    const sleeps = checkins.filter((c) => c.sleepHours != null);
    if (sleeps.length) { const s = round(sleeps.reduce((t, c) => t + (c.sleepHours ?? 0), 0) / sleeps.length, 1); findings.push(`You slept ${s} hours on average${s < 7 ? " — under the 7 hours most adults need" : ""}.`); }
  }
  const waterDays = daily.filter((d) => d.waterMl != null && d.waterMl > 0);
  if (waterDays.length) { const hit = waterDays.filter((d) => d.waterMl! >= (d.waterTargetMl ?? 2500)).length; findings.push(`You logged water on ${waterDays.length} day${waterDays.length === 1 ? "" : "s"} and reached your target on ${hit}.`); }
  const km = round(daily.reduce((s, d) => s + d.distanceKm, 0), 1);
  if (km) findings.push(`You covered ${km} km with GPS tracking.`);
  if (weights.length >= 2) { const ch = round(weights.at(-1)!.weight - weights[0].weight, 1); const target = profile?.targetWeight; findings.push(`Your weight changed by ${ch > 0 ? "+" : ""}${ch} kg (${round(weights[0].weight, 1)} → ${round(weights.at(-1)!.weight, 1)} kg)${target != null ? `; target is ${target} kg` : ""}.`); }
  if (!findings.length) findings.push("No activity has been recorded in this period yet. Complete a workout, answer the daily check-in or log water to start your report.");

  return { days, daily, weight: weights.map((w) => ({ date: key(w.recordedAt), weight: w.weight })), targetWeightKg: profile?.targetWeight ?? null, findings };
}
