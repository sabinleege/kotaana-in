import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Data lifecycle, like a trading chart that keeps candles instead of every tick:
 *  1. Every closed week (Monday–Sunday, UTC) is reduced to one PeriodSummary row of numbers. While the week's raw rows still exist the
 *     summary is recomputed on every run, so late logs and edits correct it. Two weeks after the week ends it is marked final.
 *  2. Each month is rolled up from its weeks (a week belongs to the month its Monday falls in) and corrected whenever a week changes.
 *  3. Raw rows are then deleted in two tiers. Heavy data (generated plans, set-by-set logs, photos, GPS paths, AI and usage logs) goes once
 *     its week is final. Light daily rows (check-ins, water, meals, workout logs) are kept for 92 days so the 90-day charts still work.
 *  Reviews and the AI read the summaries (summaryContext), so long-term history costs a few hundred tokens instead of thousands of rows. */

const DAY = 86400000;
export const HEAVY_AFTER_DAYS = 14;
export const LIGHT_KEEP_DAYS = 92;
const MAX_WEEKS_PER_RUN = 60;

const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const weekStartOf = (d: Date) => { const x = utcDay(d); return new Date(x.getTime() - ((x.getUTCDay() + 6) % 7) * DAY); };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type WeekMetrics = {
  final: boolean; days: number;
  workouts: { sessions: number; avgCompletionPct: number | null; avgRpe: number | null; painReports: number; blocks: number; blocksEasy: number; blocksHard: number; blocksSkipped: number; sets: number; reps: number; workMin: number; volumeKg: number; topExercises: { id: string; name: string | null; times: number; lastEffort: string; maxKg: number | null }[] };
  checkins: { count: number; energy: number | null; soreness: number | null; mood: number | null; sleepHours: number | null; readiness: number | null; unwellDays: number };
  nutrition: { daysLogged: number; avgKcal: number | null; avgProteinG: number | null };
  water: { daysLogged: number; avgPctOfTarget: number | null };
  activity: { kcalBurned: number; runs: number; runKm: number };
  weight: { first: number | null; last: number | null };
  health: { updates: number; avgPain: number | null };
};

/** Reduces one week of raw rows to numbers. Nothing is estimated; a source with no rows is null or zero. */
export async function computeWeek(userId: string, start: Date): Promise<{ metrics: WeekMetrics; rows: number }> {
  const end = new Date(start.getTime() + 7 * DAY);
  const w = { userId, date: { gte: start, lt: end } };
  const [logs, perfs, checkins, meals, water, activity, runs, weights, updates] = await Promise.all([
    prisma.workoutLog.findMany({ where: w }), prisma.exercisePerformance.findMany({ where: w }), prisma.dailyCheckin.findMany({ where: w }),
    prisma.mealLog.findMany({ where: w }), prisma.hydrationLog.findMany({ where: w }), prisma.activityData.findMany({ where: w }),
    prisma.runActivity.findMany({ where: w, select: { distanceKm: true, calories: true } }),
    prisma.weightHistory.findMany({ where: { userId, recordedAt: { gte: start, lt: end } }, orderBy: { recordedAt: "asc" } }),
    prisma.healthUpdate.findMany({ where: { userId, createdAt: { gte: start, lt: end } }, select: { pain: true } }),
  ]);
  const done = logs.filter((l) => l.completionRate > 0);
  const byEx = new Map<string, { id: string; name: string | null; times: number; lastEffort: string; last: Date; maxKg: number | null }>();
  for (const p of perfs) {
    const cur = byEx.get(p.exerciseId) ?? { id: p.exerciseId, name: p.exerciseName, times: 0, lastEffort: p.effort, last: p.date, maxKg: null };
    cur.times++; if (p.date >= cur.last) { cur.last = p.date; cur.lastEffort = p.effort; }
    if (p.weightKg != null) cur.maxKg = Math.max(cur.maxKg ?? 0, p.weightKg);
    byEx.set(p.exerciseId, cur);
  }
  const mealDays = meals.filter((m) => m.totalCalories > 0);
  const metrics: WeekMetrics = {
    final: Date.now() - end.getTime() >= HEAVY_AFTER_DAYS * DAY, days: 7,
    workouts: {
      sessions: done.length, avgCompletionPct: done.length ? Math.round(avg(done.map((l) => l.completionRate))! * 100) : null, avgRpe: avg(logs.map((l) => l.rpe).filter((v): v is number => v != null)), painReports: logs.filter((l) => l.painReported).length,
      blocks: perfs.length, blocksEasy: perfs.filter((p) => p.effort === "easy").length, blocksHard: perfs.filter((p) => p.effort === "hard").length, blocksSkipped: perfs.filter((p) => !p.completed).length,
      sets: sum(perfs.map((p) => p.setsDone ?? 0)), reps: sum(perfs.map((p) => p.repsTotal ?? 0)), workMin: Math.round(sum(perfs.map((p) => p.workSec ?? 0)) / 60), volumeKg: Math.round(sum(perfs.map((p) => (p.weightKg ?? 0) * (p.repsTotal ?? 0)))),
      topExercises: [...byEx.values()].sort((a, b) => b.times - a.times).slice(0, 8).map(({ last: _last, ...x }) => x),
    },
    checkins: { count: checkins.length, energy: avg(checkins.map((c) => c.energy)), soreness: avg(checkins.map((c) => c.soreness)), mood: avg(checkins.map((c) => c.mood)), sleepHours: avg(checkins.map((c) => c.sleepHours).filter((v): v is number => v != null)), readiness: avg(checkins.map((c) => c.readiness)), unwellDays: checkins.filter((c) => c.feeling === "sick" || c.feeling === "off").length },
    nutrition: { daysLogged: mealDays.length, avgKcal: mealDays.length ? Math.round(avg(mealDays.map((m) => m.totalCalories))!) : null, avgProteinG: avg(mealDays.map((m) => m.totalProtein)) },
    water: { daysLogged: water.length, avgPctOfTarget: water.length ? Math.round(avg(water.map((x) => (x.glasses * x.glassMl) / Math.max(1, x.targetMl)))! * 100) : null },
    activity: { kcalBurned: sum(activity.map((a) => a.calories)) + sum(runs.map((r) => r.calories)), runs: runs.length, runKm: Math.round(sum(runs.map((r) => r.distanceKm)) * 10) / 10 },
    weight: { first: weights[0]?.weight ?? null, last: weights.at(-1)?.weight ?? null },
    health: { updates: updates.length, avgPain: avg(updates.map((u) => u.pain).filter((v): v is number => v != null)) },
  };
  return { metrics, rows: logs.length + perfs.length + checkins.length + meals.length + water.length + activity.length + runs.length + updates.length };
}

export function describe(kind: "week" | "month", start: Date, m: WeekMetrics) {
  const parts = [`${kind === "week" ? "Week of" : "Month of"} ${iso(start)}: ${m.workouts.sessions} workout day(s)`];
  if (m.workouts.avgCompletionPct != null) parts.push(`${m.workouts.avgCompletionPct}% completion`);
  if (m.workouts.sets) parts.push(`${m.workouts.sets} sets / ${m.workouts.reps} reps`);
  if (m.checkins.readiness != null) parts.push(`readiness ${m.checkins.readiness}`);
  if (m.checkins.sleepHours != null) parts.push(`sleep ${m.checkins.sleepHours} h`);
  if (m.nutrition.avgKcal != null) parts.push(`${m.nutrition.avgKcal} kcal on ${m.nutrition.daysLogged} logged day(s)`);
  if (m.weight.first != null && m.weight.last != null) parts.push(`weight ${m.weight.first} → ${m.weight.last} kg`);
  if (m.workouts.painReports) parts.push(`${m.workouts.painReports} pain report(s)`);
  return parts.join(", ") + ".";
}

/** Rolls weeks up into a month: totals add, averages are weighted by how many days each week actually has data. */
export function rollUp(weeks: WeekMetrics[]): WeekMetrics {
  const wavg = (pick: (w: WeekMetrics) => number | null, weight: (w: WeekMetrics) => number) => { const xs = weeks.filter((w) => pick(w) != null && weight(w) > 0); const tw = sum(xs.map(weight)); return tw ? Math.round((sum(xs.map((w) => pick(w)! * weight(w))) / tw) * 10) / 10 : null; };
  const top = new Map<string, WeekMetrics["workouts"]["topExercises"][number]>();
  for (const w of weeks) for (const e of w.workouts.topExercises) { const c = top.get(e.id); top.set(e.id, c ? { ...c, times: c.times + e.times, lastEffort: e.lastEffort, maxKg: e.maxKg != null ? Math.max(c.maxKg ?? 0, e.maxKg) : c.maxKg } : { ...e }); }
  const withWeight = weeks.filter((w) => w.weight.first != null);
  return {
    final: weeks.every((w) => w.final), days: weeks.length * 7,
    workouts: { sessions: sum(weeks.map((w) => w.workouts.sessions)), avgCompletionPct: wavg((w) => w.workouts.avgCompletionPct, (w) => w.workouts.sessions), avgRpe: wavg((w) => w.workouts.avgRpe, (w) => w.workouts.sessions), painReports: sum(weeks.map((w) => w.workouts.painReports)), blocks: sum(weeks.map((w) => w.workouts.blocks)), blocksEasy: sum(weeks.map((w) => w.workouts.blocksEasy)), blocksHard: sum(weeks.map((w) => w.workouts.blocksHard)), blocksSkipped: sum(weeks.map((w) => w.workouts.blocksSkipped)), sets: sum(weeks.map((w) => w.workouts.sets)), reps: sum(weeks.map((w) => w.workouts.reps)), workMin: sum(weeks.map((w) => w.workouts.workMin)), volumeKg: sum(weeks.map((w) => w.workouts.volumeKg)), topExercises: [...top.values()].sort((a, b) => b.times - a.times).slice(0, 10) },
    checkins: { count: sum(weeks.map((w) => w.checkins.count)), energy: wavg((w) => w.checkins.energy, (w) => w.checkins.count), soreness: wavg((w) => w.checkins.soreness, (w) => w.checkins.count), mood: wavg((w) => w.checkins.mood, (w) => w.checkins.count), sleepHours: wavg((w) => w.checkins.sleepHours, (w) => w.checkins.count), readiness: wavg((w) => w.checkins.readiness, (w) => w.checkins.count), unwellDays: sum(weeks.map((w) => w.checkins.unwellDays)) },
    nutrition: { daysLogged: sum(weeks.map((w) => w.nutrition.daysLogged)), avgKcal: wavg((w) => w.nutrition.avgKcal, (w) => w.nutrition.daysLogged), avgProteinG: wavg((w) => w.nutrition.avgProteinG, (w) => w.nutrition.daysLogged) },
    water: { daysLogged: sum(weeks.map((w) => w.water.daysLogged)), avgPctOfTarget: wavg((w) => w.water.avgPctOfTarget, (w) => w.water.daysLogged) },
    activity: { kcalBurned: sum(weeks.map((w) => w.activity.kcalBurned)), runs: sum(weeks.map((w) => w.activity.runs)), runKm: Math.round(sum(weeks.map((w) => w.activity.runKm)) * 10) / 10 },
    weight: { first: withWeight[0]?.weight.first ?? null, last: withWeight.at(-1)?.weight.last ?? null },
    health: { updates: sum(weeks.map((w) => w.health.updates)), avgPain: wavg((w) => w.health.avgPain, (w) => w.health.updates) },
  };
}

async function earliestRaw(userId: string) {
  const firsts = await Promise.all([
    prisma.dailyCheckin.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.workoutLog.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.exercisePerformance.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.mealLog.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const ds = firsts.map((f) => f?.date).filter((d): d is Date => Boolean(d));
  return ds.length ? new Date(Math.min(...ds.map((d) => d.getTime()))) : null;
}

/** Summarises every closed week that is not final yet (correcting earlier versions), rolls up the months they touch, then deletes raw data
 * that is safely summarised. Safe to run as often as you like. Returns what it did, for the admin report. */
export async function compactUser(userId: string, now = new Date()) {
  const thisWeek = weekStartOf(now);
  const first = await earliestRaw(userId);
  let weeks = 0, rowsCompacted = 0; const months = new Set<string>();
  if (first) {
    const finals = new Set((await prisma.periodSummary.findMany({ where: { userId, kind: "week" }, select: { periodStart: true, metrics: true } })).filter((s) => (s.metrics as { final?: boolean } | null)?.final).map((s) => iso(s.periodStart)));
    for (let s = weekStartOf(first); s < thisWeek && weeks < MAX_WEEKS_PER_RUN; s = new Date(s.getTime() + 7 * DAY)) {
      if (finals.has(iso(s))) continue;
      const { metrics, rows } = await computeWeek(userId, s);
      if (!rows) continue;
      const periodEnd = new Date(s.getTime() + 6 * DAY);
      await prisma.periodSummary.upsert({ where: { userId_kind_periodStart: { userId, kind: "week", periodStart: s } }, create: { userId, kind: "week", periodStart: s, periodEnd, metrics: metrics as object, summary: describe("week", s, metrics), rowsCompacted: rows }, update: { metrics: metrics as object, summary: describe("week", s, metrics), rowsCompacted: rows } });
      weeks++; rowsCompacted += rows; months.add(iso(s).slice(0, 7));
    }
  }
  for (const mk of months) {
    const ms = new Date(`${mk}-01T00:00:00Z`); const me = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 1));
    const ws = await prisma.periodSummary.findMany({ where: { userId, kind: "week", periodStart: { gte: ms, lt: me } }, orderBy: { periodStart: "asc" } });
    if (!ws.length) continue;
    const m = rollUp(ws.map((w) => w.metrics as unknown as WeekMetrics));
    await prisma.periodSummary.upsert({ where: { userId_kind_periodStart: { userId, kind: "month", periodStart: ms } }, create: { userId, kind: "month", periodStart: ms, periodEnd: new Date(me.getTime() - DAY), metrics: m as object, summary: describe("month", ms, m), rowsCompacted: sum(ws.map((w) => w.rowsCompacted)) }, update: { metrics: m as object, summary: describe("month", ms, m), rowsCompacted: sum(ws.map((w) => w.rowsCompacted)) } });
  }
  const deleted = await pruneRaw(userId, now);
  return { weeks, months: months.size, rowsCompacted, deleted };
}

/** Deletes only what a final weekly summary already covers. Weight history, injuries, reports and summaries are never deleted. */
async function pruneRaw(userId: string, now: Date) {
  const lastFinal = await prisma.periodSummary.findFirst({ where: { userId, kind: "week", metrics: { path: ["final"], equals: true } }, orderBy: { periodStart: "desc" }, select: { periodEnd: true } });
  const heavyBefore = lastFinal ? new Date(Math.min(lastFinal.periodEnd.getTime() + DAY, now.getTime() - HEAVY_AFTER_DAYS * DAY)) : null;
  const lightBefore = heavyBefore ? new Date(Math.min(heavyBefore.getTime(), now.getTime() - LIGHT_KEEP_DAYS * DAY)) : null;
  const n: Record<string, number> = {};
  const count = (k: string) => (r: { count: number }) => { n[k] = r.count; };
  if (heavyBefore) {
    await Promise.all([
      prisma.workoutPlan.deleteMany({ where: { userId, date: { lt: heavyBefore } } }).then(count("workoutPlans")),
      prisma.nutritionPlan.deleteMany({ where: { userId, date: { lt: heavyBefore } } }).then(count("nutritionPlans")),
      prisma.recommendationEvent.deleteMany({ where: { userId, createdAt: { lt: heavyBefore } } }).then(count("recommendationEvents")),
      prisma.usageCounter.deleteMany({ where: { userId, date: { lt: heavyBefore } } }).then(count("usageCounters")),
      prisma.healthUpdate.updateMany({ where: { userId, createdAt: { lt: heavyBefore }, imageUrl: { not: null } }, data: { imageUrl: null } }).then(count("healthPhotos")),
      // GPS tracks and set-by-set detail are the bulky parts of these rows; the distance, time and totals stay until the light tier.
      prisma.runActivity.updateMany({ where: { userId, date: { lt: heavyBefore }, path: { not: Prisma.DbNull } }, data: { path: Prisma.DbNull } }).then(count("gpsPaths")),
      prisma.exercisePerformance.updateMany({ where: { userId, date: { lt: heavyBefore }, OR: [{ setReps: { not: Prisma.DbNull } }, { notes: { not: null } }] }, data: { setReps: Prisma.DbNull, notes: null } }).then(count("setDetails")),
      prisma.notification.deleteMany({ where: { userId, read: true, createdAt: { lt: new Date(now.getTime() - 60 * DAY) } } }).then(count("notifications")),
    ]);
    // Progress photos: one per pose per month is kept for before/after comparison; the rest of the older photos are deleted.
    const photos = await prisma.progressPhoto.findMany({ where: { userId, date: { lt: heavyBefore } }, orderBy: { date: "desc" }, select: { id: true, date: true, pose: true } });
    const keep = new Set<string>(); const seen = new Set<string>();
    for (const p of photos) { const k = `${iso(p.date).slice(0, 7)}:${p.pose}`; if (!seen.has(k)) { seen.add(k); keep.add(p.id); } }
    n.progressPhotos = (await prisma.progressPhoto.deleteMany({ where: { userId, id: { in: photos.filter((p) => !keep.has(p.id)).map((p) => p.id) } } })).count;
  }
  if (lightBefore) {
    await Promise.all([
      prisma.dailyCheckin.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("checkins")),
      prisma.hydrationLog.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("hydration")),
      prisma.mealLog.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("meals")),
      prisma.workoutLog.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("workoutLogs")),
      prisma.exercisePerformance.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("performances")),
      prisma.activityData.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("activity")),
      prisma.runActivity.deleteMany({ where: { userId, date: { lt: lightBefore } } }).then(count("runs")),
      prisma.healthUpdate.deleteMany({ where: { userId, createdAt: { lt: lightBefore } } }).then(count("healthUpdates")),
      prisma.questionnaire.deleteMany({ where: { userId, createdAt: { lt: lightBefore } } }).then(count("questionnaires")),
    ]);
  }
  return n;
}

/** The compact history given to the AI: the last 8 weeks and the last 6 months as short lines plus the key numbers. */
export async function summaryContext(userId: string) {
  const [weeks, months] = await Promise.all([
    prisma.periodSummary.findMany({ where: { userId, kind: "week" }, orderBy: { periodStart: "desc" }, take: 8 }),
    prisma.periodSummary.findMany({ where: { userId, kind: "month" }, orderBy: { periodStart: "desc" }, take: 6 }),
  ]);
  const pack = (s: (typeof weeks)[number]) => { const m = s.metrics as unknown as WeekMetrics; return { from: iso(s.periodStart), line: s.summary, sessions: m.workouts.sessions, completionPct: m.workouts.avgCompletionPct, sets: m.workouts.sets, readiness: m.checkins.readiness, sleepH: m.checkins.sleepHours, kcal: m.nutrition.avgKcal, weight: m.weight.last, pain: m.workouts.painReports }; };
  return { weeks: weeks.reverse().map(pack), months: months.reverse().map(pack) };
}

/** Runs compaction for the next slice of athletes (the daily cron). A cursor in app_config walks through everyone and wraps around,
 * so any number of users is covered over successive runs without one run timing out. */
export async function compactAll(limit = 200, timeBudgetMs = 50_000) {
  const started = Date.now();
  const cursor = (await prisma.appConfig.findUnique({ where: { key: "compact_cursor" } }))?.value || "";
  const users = await prisma.user.findMany({ where: { role: "athlete", id: { gt: cursor } }, select: { id: true }, orderBy: { id: "asc" }, take: limit });
  const out = { users: 0, weeks: 0, rows: 0, errors: 0, wrapped: users.length < limit };
  let last = cursor;
  for (const u of users) {
    if (Date.now() - started > timeBudgetMs) break;
    try { const r = await compactUser(u.id); out.users++; out.weeks += r.weeks; out.rows += r.rowsCompacted; } catch { out.errors++; }
    last = u.id;
  }
  const next = out.wrapped && last === (users.at(-1)?.id ?? cursor) ? "" : last;
  await prisma.appConfig.upsert({ where: { key: "compact_cursor" }, create: { key: "compact_cursor", value: next }, update: { value: next } });
  // AI usage rows are only needed for budgets (≤ 30 days) and the admin report (≤ 90 days).
  await prisma.aiUsage.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 120 * DAY) } } });
  return out;
}
