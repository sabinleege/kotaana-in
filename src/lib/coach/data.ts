import { prisma } from "@/lib/db/prisma";
import { CHRONIC_CONDITIONS } from "@/lib/health/conditions";

const DAY = 86400000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysSince = (d?: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / DAY) : null);

/** Athletes connected to a coach. "paused" athletes stay visible but are not actively monitored. */
export async function coachRelations(coachId: string, statuses: string[] = ["active", "paused", "pending"]) {
  return prisma.coachAthleteRelation.findMany({
    where: { coachId, status: { in: statuses } },
    include: { athlete: { select: { id: true, email: true, name: true, image: true, profile: { select: { fullName: true, avatarUrl: true, primaryGoal: true, level: true, weight: true, targetWeight: true, age: true, gender: true, isPregnant: true, healthConditions: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

/** True when the coach may view/act on this athlete (active or paused connection). */
export async function coachCanAccess(coachId: string, athleteId: string) {
  const rel = await prisma.coachAthleteRelation.findUnique({ where: { coachId_athleteId: { coachId, athleteId } } });
  return rel && (rel.status === "active" || rel.status === "paused") ? rel : null;
}

export type AthleteSignal = {
  athleteId: string; name: string; email: string; status: string; avatar: string | null; goal: string | null; level: string | null;
  readinessAvg7: number | null; lastCheckin: Date | null; lastFeeling: string | null; symptoms: string | null;
  exercises7: number; completed7: number; adherence7: number | null; lastWorkout: Date | null;
  activeInjuries: number; pendingFollowUps: number; isPregnant: boolean; conditions: string[]; weight: number | null; targetWeight: number | null;
};

/** Per-athlete signals built only from recorded data (no estimates). */
export async function athleteSignals(coachId: string, statuses: string[] = ["active", "paused"]): Promise<AthleteSignal[]> {
  const rels = await coachRelations(coachId, statuses);
  const ids = rels.map((r) => r.athleteId);
  if (!ids.length) return [];
  const since = daysAgo(7);
  const [checkins, perfs, lastPerf, injuries, followUps] = await Promise.all([
    prisma.dailyCheckin.findMany({ where: { userId: { in: ids }, date: { gte: daysAgo(30) } }, orderBy: { date: "desc" }, select: { userId: true, date: true, readiness: true, feeling: true, symptoms: true } }),
    prisma.exercisePerformance.findMany({ where: { userId: { in: ids }, date: { gte: since } }, select: { userId: true, completed: true } }),
    prisma.exercisePerformance.groupBy({ by: ["userId"], where: { userId: { in: ids }, completed: true }, _max: { date: true } }),
    prisma.injury.groupBy({ by: ["athleteId"], where: { athleteId: { in: ids }, status: { in: ["active", "recovering"] } }, _count: true }),
    prisma.followUp.groupBy({ by: ["athleteId"], where: { coachId, athleteId: { in: ids }, status: "pending" }, _count: true }),
  ]);
  const labels = new Map(CHRONIC_CONDITIONS.map((c) => [c.id, c.label]));
  return rels.map((r) => {
    const p = r.athlete.profile;
    const c = checkins.filter((x) => x.userId === r.athleteId);
    const c7 = c.filter((x) => x.date >= since);
    const pf = perfs.filter((x) => x.userId === r.athleteId);
    const done = pf.filter((x) => x.completed).length;
    return {
      athleteId: r.athleteId, name: p?.fullName || r.athlete.name || r.athlete.email, email: r.athlete.email, status: r.status,
      avatar: p?.avatarUrl || r.athlete.image || null, goal: p?.primaryGoal ?? null, level: p?.level ?? null,
      readinessAvg7: c7.length ? Math.round(c7.reduce((s, x) => s + x.readiness, 0) / c7.length) : null,
      lastCheckin: c[0]?.date ?? null, lastFeeling: c[0]?.feeling ?? null, symptoms: c[0]?.symptoms ?? null,
      exercises7: pf.length, completed7: done, adherence7: pf.length ? Math.round((done / pf.length) * 100) : null,
      lastWorkout: lastPerf.find((x) => x.userId === r.athleteId)?._max.date ?? null,
      activeInjuries: injuries.find((x) => x.athleteId === r.athleteId)?._count ?? 0,
      pendingFollowUps: followUps.find((x) => x.athleteId === r.athleteId)?._count ?? 0,
      isPregnant: Boolean(p?.isPregnant),
      conditions: (Array.isArray(p?.healthConditions) ? p!.healthConditions : []).map((x) => labels.get(String(x)) || String(x)),
      weight: p?.weight ?? null, targetWeight: p?.targetWeight ?? null,
    };
  });
}

export type Recommendation = { athleteId: string; name: string; priority: "low" | "normal" | "high"; issues: string[]; suggestedAction: string; tags: string[] };

/** Rule-based follow-up suggestions (ported from the earlier Kotaana coach app). */
export function buildRecommendations(signals: AthleteSignal[]): Recommendation[] {
  const items: Recommendation[] = [];
  for (const a of signals.filter((s) => s.status === "active")) {
    const issues: string[] = []; const tags: string[] = [];
    if (a.activeInjuries > 0) { issues.push(`Active injuries: ${a.activeInjuries}`); tags.push("injury"); }
    if (a.lastFeeling === "sick" || a.lastFeeling === "off") { issues.push(`Recent feeling: ${a.lastFeeling}${a.symptoms ? ` (${a.symptoms})` : ""}`); tags.push("illness"); }
    if (a.readinessAvg7 != null && a.readinessAvg7 < 55) { issues.push(`Low readiness (7-day avg ${a.readinessAvg7})`); tags.push("performance"); }
    if (a.adherence7 != null && a.adherence7 < 50) { issues.push(`Low workout completion: ${a.adherence7}%`); tags.push("performance"); }
    const sinceCheckin = daysSince(a.lastCheckin);
    if (sinceCheckin == null) { issues.push("Has never answered the daily check-in"); tags.push("inactive"); }
    else if (sinceCheckin >= 5) { issues.push(`No check-in for ${sinceCheckin} days`); tags.push("inactive"); }
    const sinceWorkout = daysSince(a.lastWorkout);
    if (sinceWorkout == null) { issues.push("No completed workout recorded yet"); tags.push("inactive"); }
    else if (sinceWorkout >= 7) { issues.push(`No workout for ${sinceWorkout} days`); tags.push("inactive"); }
    if (a.isPregnant) { issues.push("Pregnancy — use prenatal-safe guidance only"); tags.push("safety"); }
    if (a.conditions.length) { issues.push(`Health conditions: ${a.conditions.join(", ")}`); tags.push("safety"); }
    if (!issues.length) continue;
    let suggestedAction = "Review the athlete profile and send a short check-in.";
    if (tags.includes("injury")) suggestedAction = "Confirm pain status and adjust training load.";
    else if (tags.includes("illness")) suggestedAction = "Ask about symptoms and pause hard training if needed.";
    else if (tags.includes("inactive")) suggestedAction = "Re-engage with a simple next-session plan.";
    else if (tags.includes("performance")) suggestedAction = "Discuss recovery, sleep and session difficulty.";
    else if (tags.includes("safety")) suggestedAction = "Check that training stays within their medical guidance.";
    const high = tags.includes("injury") || tags.includes("illness") || tags.includes("safety") || issues.length >= 2;
    items.push({ athleteId: a.athleteId, name: a.name, priority: high ? "high" : "normal", issues, suggestedAction, tags: [...new Set(tags)] });
  }
  const rank = { high: 0, normal: 1, low: 2 };
  return items.sort((x, y) => rank[x.priority] - rank[y.priority] || x.name.localeCompare(y.name));
}

export const goalLabel = (g?: string | null) => ({ general_fitness: "General fitness", fat_loss: "Fat loss", muscle_gain: "Muscle gain", endurance: "Endurance" } as Record<string, string>)[g || ""] || "Not set";
export const fmtDate = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

/** Team-wide daily series (active athletes): average readiness and completed exercise blocks. */
export async function teamDaily(coachId: string, days = 30) {
  const ids = (await coachRelations(coachId, ["active"])).map((r) => r.athleteId);
  const end = new Date(); const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (days - 1)));
  const [checkins, perfs] = ids.length ? await Promise.all([
    prisma.dailyCheckin.findMany({ where: { userId: { in: ids }, date: { gte: start } }, select: { date: true, readiness: true } }),
    prisma.exercisePerformance.findMany({ where: { userId: { in: ids }, date: { gte: start }, completed: true }, select: { date: true } }),
  ]) : [[], []];
  const key = (d: Date) => d.toISOString().slice(0, 10);
  return Array.from({ length: days }, (_, i) => {
    const date = key(new Date(start.getTime() + i * DAY));
    const r = checkins.filter((c) => key(c.date) === date);
    return { date, readiness: r.length ? Math.round(r.reduce((s, c) => s + c.readiness, 0) / r.length) : null, completed: perfs.filter((p) => key(p.date) === date).length };
  });
}
