import { prisma } from "@/lib/db/prisma";
import { aiText } from "./router";
import { logError } from "@/lib/observability";
import { fitnessStatus } from "@/lib/health/fitness";
import { nutritionTargets } from "@/lib/health/targets";
import { favoriteFoods } from "@/lib/nutrition/preferences";

const DAY = 86400000;
const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
export type ReviewKind = "review" | "monthly";
export type ReviewBody = { summary: string; wins: string[]; concerns: string[]; suggestions: string[] };

/** Everything recorded in the period, reduced to numbers. Nothing here is estimated: a missing source shows as null. */
export async function gatherMetrics(userId: string, days: number) {
  const end = dateOnly(new Date()); const start = new Date(end.getTime() - (days - 1) * DAY);
  const [profile, checkins, logs, perfs, meals, water, weights, quest, fit, favs] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.dailyCheckin.findMany({ where: { userId, date: { gte: start } } }),
    prisma.workoutLog.findMany({ where: { userId, date: { gte: start } } }),
    prisma.exercisePerformance.findMany({ where: { userId, date: { gte: start } }, select: { effort: true, completed: true } }),
    prisma.mealLog.findMany({ where: { userId, date: { gte: start } } }),
    prisma.hydrationLog.findMany({ where: { userId, date: { gte: start } } }),
    prisma.weightHistory.findMany({ where: { userId, recordedAt: { gte: start } }, orderBy: { recordedAt: "asc" } }),
    prisma.questionnaire.findMany({ where: { userId, createdAt: { gte: start } }, orderBy: { createdAt: "desc" }, take: 4 }),
    fitnessStatus(userId), favoriteFoods(userId, 8),
  ]);
  const targets = profile ? nutritionTargets(profile) : null;
  const done = logs.filter((l) => l.completionRate > 0);
  const mealDays = meals.filter((m) => m.totalCalories > 0);
  return {
    periodDays: days, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10),
    person: { age: profile?.age ?? null, gender: profile?.gender ?? null, goal: profile?.primaryGoal ?? null, level: profile?.level ?? null, weightKg: profile?.weight ?? null, targetWeightKg: profile?.targetWeight ?? null, pregnant: Boolean(profile?.isPregnant), conditions: profile?.healthConditions ?? [], trainingDaysPerWeek: profile?.trainingDaysPerWeek ?? null, youth: (profile?.ageBand || "").startsWith("youth") },
    checkins: { count: checkins.length, energy: avg(checkins.map((c) => c.energy)), soreness: avg(checkins.map((c) => c.soreness)), mood: avg(checkins.map((c) => c.mood)), sleepHours: avg(checkins.map((c) => c.sleepHours).filter((v): v is number => v != null)), readiness: avg(checkins.map((c) => c.readiness)), unwell: checkins.filter((c) => c.feeling === "sick" || c.feeling === "off").length },
    workouts: { sessions: done.length, plannedPerWeek: profile?.trainingDaysPerWeek ?? null, avgCompletionPct: done.length ? Math.round(avg(done.map((l) => l.completionRate))! * 100) : null, avgEffort10: avg(logs.map((l) => l.rpe).filter((v): v is number => v != null)), painReports: logs.filter((l) => l.painReported).length, blocksHard: perfs.filter((p) => p.effort === "hard").length, blocksEasy: perfs.filter((p) => p.effort === "easy").length, blocksSkipped: perfs.filter((p) => !p.completed).length },
    nutrition: { daysLogged: mealDays.length, avgKcal: mealDays.length ? Math.round(avg(mealDays.map((m) => m.totalCalories))!) : null, targetKcal: targets?.calories ?? null, avgProteinG: avg(mealDays.map((m) => m.totalProtein)), targetProteinG: targets?.protein ?? null, favoriteFoods: favs },
    water: { daysLogged: water.length, avgPctOfTarget: water.length ? Math.round(avg(water.map((w) => (w.glasses * w.glassMl) / Math.max(1, w.targetMl)))! * 100) : null },
    weight: { first: weights[0]?.weight ?? null, last: weights.at(-1)?.weight ?? null, entries: weights.length },
    health: { state: fit.state, daysToFit: fit.daysToFit, open: fit.items.map((i) => ({ what: i.title, kind: i.kind, severity: i.severity, percentHealed: i.percent, daysLeft: i.daysLeft })), pregnancy: fit.pregnancy },
    recentAnswers: quest.map((q) => ({ kind: q.kind, answers: q.answers })),
  };
}
type Metrics = Awaited<ReturnType<typeof gatherMetrics>>;

/** The plain, no-AI review: honest sentences built straight from the numbers. Used when no model is configured or its answer is unusable. */
function ruleReview(m: Metrics): ReviewBody {
  const wins: string[] = [], concerns: string[] = [], suggestions: string[] = [];
  const w = m.workouts, c = m.checkins, n = m.nutrition;
  if (w.sessions > 0) wins.push(`${w.sessions} workout day${w.sessions === 1 ? "" : "s"} completed${w.avgCompletionPct != null ? ` at ${w.avgCompletionPct}% average completion` : ""}.`);
  else concerns.push("No finished workouts in this period.");
  if (m.person.trainingDaysPerWeek && w.sessions < Math.floor((m.person.trainingDaysPerWeek * m.periodDays) / 7) - 1) suggestions.push("You trained less than your plan. If the weekly target is too high, lower it in the workout questions so the plan stays realistic.");
  if (c.count >= Math.ceil(m.periodDays * 0.6)) wins.push(`You checked in ${c.count} times — that makes your plans fit you.`); else concerns.push(`Only ${c.count} check-in${c.count === 1 ? "" : "s"}; daily check-ins make workouts safer and better fitted.`);
  if (c.sleepHours != null && c.sleepHours < 7) { concerns.push(`Sleep averages ${c.sleepHours} h.`); suggestions.push("Aim for 7–9 hours; poor sleep slows recovery and progress."); }
  if (c.unwell > 1) concerns.push(`You felt unwell on ${c.unwell} days.`);
  if (w.painReports > 0) { concerns.push(`Pain was reported after ${w.painReports} session${w.painReports === 1 ? "" : "s"}.`); suggestions.push("Keep the follow-up answers up to date so the plan keeps avoiding the sore area; see a doctor if it persists."); }
  if (n.daysLogged >= 3 && n.avgKcal && n.targetKcal) { const r = n.avgKcal / n.targetKcal; if (r < 0.85) suggestions.push(`You eat about ${Math.round((1 - r) * 100)}% below your calorie target on logged days — make sure that is intentional.`); else if (r > 1.15) suggestions.push(`You eat about ${Math.round((r - 1) * 100)}% above your calorie target on logged days.`); else wins.push("Calories on logged days match your target."); }
  else concerns.push("Few meals logged, so nutrition advice is limited.");
  if (m.water.avgPctOfTarget != null && m.water.avgPctOfTarget < 70) suggestions.push("Water is below target most days — add a glass with each meal.");
  if (m.weight.first != null && m.weight.last != null && m.weight.entries > 1) wins.push(`Weight went ${m.weight.first} → ${m.weight.last} kg.`);
  for (const i of m.health.open) concerns.push(`${i.what}: ${i.percentHealed}% healed, about ${i.daysLeft} day(s) left.`);
  const summary = `${m.start} to ${m.end}: ${w.sessions} workout days, ${c.count} check-ins, ${n.daysLogged} days of meals logged${m.health.open.length ? `, ${m.health.open.length} open health item(s)` : ""}.`;
  return { summary, wins: wins.slice(0, 5), concerns: concerns.slice(0, 5), suggestions: suggestions.slice(0, 5) };
}

const SYSTEM = "You are a careful, kind fitness and health coach reviewing one person's recorded data. Use ONLY the numbers given; never invent data and never diagnose. For children and teenagers recommend growth-friendly habits, never weight loss or heavy lifting. For pregnancy, injuries and illness be conservative and tell the person to see a doctor when anything is worrying or not improving. Reply with JSON only.";

function clean(v: unknown, max = 6): string[] { return Array.isArray(v) ? v.map((x) => String(x).slice(0, 220)).filter(Boolean).slice(0, max) : []; }

/** Writes (and saves) a review. The larger model is tried first, then the standard model, then the plain rules. */
export async function generateReview(userId: string, kind: ReviewKind) {
  const days = kind === "monthly" ? 30 : 7;
  const m = await gatherMetrics(userId, days);
  let body: ReviewBody | null = null; let source = "rules";
  const prompt = JSON.stringify({ task: kind === "monthly" ? "Write the monthly review: what changed this month, what to change in the plan, and which of the person's saved details (weight, target, training days, level, goal) look out of date." : "Write the 3–7 day review of how this person is doing and what to adjust next.", reply: { summary: "3-4 sentences", wins: ["up to 4"], concerns: ["up to 4"], suggestions: ["up to 5 concrete changes to training, food, rest or goal"] }, data: m });
  // Larger review models, best first: your own choice, NVIDIA Nemotron Ultra, DeepSeek R1, then the everyday model.
  for (const model of [...new Set([process.env.OPENROUTER_REVIEW_MODEL, "nvidia/llama-3.1-nemotron-ultra-253b-v1", "deepseek/deepseek-r1"].filter(Boolean) as string[]), undefined]) {
    try {
      const raw = await aiText(prompt, { system: SYSTEM, temperature: 0.3, model });
      const json = raw?.match(/\{[\s\S]*\}/)?.[0];
      if (!json) continue;
      const v = JSON.parse(json);
      if (typeof v.summary === "string" && v.summary.length > 20) { body = { summary: v.summary.slice(0, 900), wins: clean(v.wins), concerns: clean(v.concerns), suggestions: clean(v.suggestions) }; source = model ? "review-model" : "standard-model"; break; }
    } catch (e) { logError("api_error", e, { where: "review", model: model ?? "default" }); }
  }
  if (!body) body = ruleReview(m);
  const row = await prisma.athleteReport.create({ data: { userId, kind, periodStart: new Date(m.start), periodEnd: new Date(m.end), summary: body.summary, wins: body.wins, concerns: body.concerns, suggestions: body.suggestions, metrics: m as object, source } });
  await prisma.notification.create({ data: { userId, title: kind === "monthly" ? "Your monthly review is ready" : "Your progress review is ready", message: body.summary.slice(0, 160), type: "report" } });
  return row;
}

/** A review is due every 3 days at the earliest and 7 at the latest; a monthly one every 30. */
const REVIEW_MIN_DAYS = 3;

export async function latest(userId: string, kind: ReviewKind) {
  return prisma.athleteReport.findFirst({ where: { userId, kind }, orderBy: { createdAt: "desc" } });
}
export async function reviewDue(userId: string) {
  const [user, week, month, checkins] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }), latest(userId, "review"), latest(userId, "monthly"),
    prisma.dailyCheckin.count({ where: { userId } }),
  ]);
  const age = user ? (Date.now() - user.createdAt.getTime()) / DAY : 0;
  return {
    review: checkins >= 2 && (!week ? age >= REVIEW_MIN_DAYS : (Date.now() - week.createdAt.getTime()) / DAY >= REVIEW_MIN_DAYS),
    monthly: age >= 28 && (!month || (Date.now() - month.createdAt.getTime()) / DAY >= 30),
    latestReview: week, latestMonthly: month,
  };
}

