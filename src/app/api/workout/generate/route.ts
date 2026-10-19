import { NextResponse } from "next/server";
import { logError } from "@/lib/observability";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { buildDailySession, safePool } from "@/lib/workout/engine";
import { demandOf, focusGoals, focusLabels, focusWords } from "@/lib/workout/focus";
import type { PerformanceRecord } from "@/lib/workout/types";
import { NoSafeExerciseError } from "@/lib/workout/types";
import { rerankWorkoutCandidates } from "@/lib/ai/workout-rerank";
import { aiProvider } from "@/lib/ai/router";
import { paywallResponse } from "@/lib/access";
import { refundUsage, takeUsage, usageToday } from "@/lib/usage";
import { fitnessStatus, pregnancyInfo } from "@/lib/health/fitness";
import { bmiOf } from "@/lib/health/targets";

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const LEVELS = ["beginner", "intermediate", "advanced"];
/** "How hard today": easy steps the exercise level down one notch, hard steps it up one; moderate keeps the athlete's own level. Children never step up. */
function levelFor(level: string | null, intensity: string | null, youth: boolean) {
  const i = Math.max(0, LEVELS.indexOf(level || "beginner"));
  const shift = intensity === "easy" ? -1 : intensity === "hard" && !youth ? 1 : 0;
  return LEVELS[Math.max(0, Math.min(youth ? 1 : 2, i + shift))];
}

type Built = { status: number; body: Record<string, unknown> };

/** Builds today's workout. Only called after the athlete has answered today's check-in and workout questions. */
async function build(userId: string, reason: string): Promise<Built> {
  const now = new Date(); const today = dateOnly(now); const since = new Date(now.getTime() - 14 * 86400000);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return { status: 409, body: { ok: false, error: "Complete your profile before building a workout." } };
  const checkin = await prisma.dailyCheckin.findUnique({ where: { userId_date: { userId, date: today } } });
  if (!checkin) return { status: 409, body: { ok: false, needsCheckin: true, error: "Answer today's check-in first so the workout fits how you feel." } };

  // Rest comes first: a serious illness or injury means no workout is built.
  const fit = await fitnessStatus(userId);
  if (fit.state === "rest") return { status: 200, body: { ok: true, rest: true, session: null, message: fit.detail, fitness: fit } };

  const cap = await takeUsage(userId, "workout_build");
  if (!cap.ok) return { status: 429, body: { ok: false, code: "DAILY_LIMIT", error: `You've built your workout ${cap.limit} times today — that's the daily limit. Your current plan stays available; you can build a new one tomorrow.`, usage: cap } };

  try {
    const injuries = await prisma.injury.findMany({ where: { athleteId: userId, status: { in: ["active", "recovering"] } } }).catch(() => []);
    const performances = await prisma.exercisePerformance.findMany({ where: { userId, date: { gte: dateOnly(since) } }, orderBy: { date: "desc" }, take: 200 });
    const weekStart = dateOnly(new Date(now.getTime() - 7 * 86400000));
    const weeklyPerformances = await prisma.exercisePerformance.findMany({ where: { userId, date: { gte: weekStart } }, orderBy: { date: "desc" }, take: 500 });
    const weeklyLogs = await prisma.workoutLog.findMany({ where: { userId, date: { gte: weekStart }, completionRate: { gt: 0 } }, select: { date: true } });
    const expected = Math.max(1, Math.min(7, profile.trainingDaysPerWeek || 3));
    const missedSessions = Math.min(expected, Math.max(0, expected - new Set(weeklyLogs.map((p) => p.date.toISOString().slice(0, 10))).size));
    const muscleSelect = { muscleGroup: true, target: true, secondaryMuscles: true, movementPattern: true } as const;
    const recentMuscles = await prisma.exercise.findMany({ where: { id: { in: performances.map((p) => p.exerciseId) } }, select: muscleSelect });
    const weeklyExercises = await prisma.exercise.findMany({ where: { id: { in: weeklyPerformances.map((p) => p.exerciseId) } }, select: muscleSelect });
    // Exercises done in the last 3 days: if one is chosen again it comes back in a different format.
    const repeatSince = dateOnly(new Date(now.getTime() - 3 * 86400000));
    const recentIds = [...new Set(performances.filter((p) => p.date >= repeatSince).map((p) => p.exerciseId))];
    const performanceHistory: PerformanceRecord[] = performances.map((p) => ({ exerciseId: p.exerciseId, effort: p.effort as any, completed: p.completed, setsDone: p.setsDone, repsDone: p.repsDone, durationSec: p.durationSec, date: p.date.toISOString().slice(0, 10) }));
    const gymEquipment = (await prisma.profile.findMany({ where: { user: { role: "coach", coachRelations: { some: { athleteId: userId, status: "active" } } } }, select: { equipment: true } })).flatMap((g) => g.equipment);
    const onlyReviewed = (await prisma.appConfig.findUnique({ where: { key: "require_reviewed_exercises" } }))?.value === "true";
    const exercises = await prisma.exercise.findMany({ where: { verified: true, ...(onlyReviewed ? { safetyReviewed: true } : {}) }, take: 5000 });
    // The coach's specialty and how demanding they want the work.
    const coach = await prisma.profile.findFirst({ where: { user: { role: "coach", coachRelations: { some: { athleteId: userId, status: "active" } } } }, select: { fullName: true, focusAreas: true, focusLevel: true } });
    const coachFocus = coach?.focusAreas ?? [];

    const youth = (profile.ageBand || "").startsWith("youth");
    const notes: string[] = []; const extraAvoid: string[] = [];
    // The goal the athlete set decides the work. A general goal with a weight target is read as the direction of that target. Children always train for general fitness.
    let goal = profile.primaryGoal || "general_fitness";
    if (youth) goal = "general_fitness";
    else if (goal === "general_fitness" && profile.weight && profile.targetWeight) {
      const diff = profile.targetWeight - profile.weight;
      if (diff <= -2) { goal = "fat_loss"; notes.push(`Your weight goal is down ${Math.abs(Math.round(diff))} kg, so today leans towards calorie-burning work.`); }
      else if (diff >= 2) { goal = "muscle_gain"; notes.push(`Your weight goal is up ${Math.round(diff)} kg, so today leans towards strength work.`); }
    }
    // A BMI of 30 or more gets a joint-friendly session, as if the athlete had ticked obesity in their health profile.
    const bmi = bmiOf(profile.weight, profile.height);
    if (bmi != null && bmi >= 30 && !youth) { extraAvoid.push("jump", "sprint", "burpee", "plyo", "skipping"); notes.push("Joint-friendly session: high-impact moves are replaced with low-impact options."); }
    const preg = pregnancyInfo(profile.isPregnant, profile.pregnancyDueDate, now);
    if (preg && (preg.trimester ?? 1) >= 2) { extraAvoid.push("supine", "lying", "flat bench", "bench press", "sit up", "crunch"); notes.push(`Pregnancy week ${preg.week}: no lying flat on your back, no crunches; keep to a pace where you can talk.`); }
    const unwell = fit.items.some((i) => i.kind === "illness") || checkin.feeling === "sick" || checkin.feeling === "off";
    let readiness = checkin.readiness;
    if (unwell) { readiness = Math.min(readiness, 40); notes.push("You reported feeling unwell, so today is lighter and easier."); }
    const minutes = Math.min(profile.sessionDurationMin || 35, youth ? 40 : 180);
    const level = levelFor(profile.level, profile.workoutIntensity, youth);
    const chosenGoals = youth ? ["general_fitness"] : [...new Set([goal, ...(profile.goals ?? []), ...(coachFocus.length ? focusGoals(coachFocus) : [])])].slice(0, 4);
    const demand = youth ? 0 : demandOf(coach?.focusLevel);
    if (coach && coachFocus.length) notes.push(`Coach ${coach.fullName || ""} focus: ${focusLabels(coachFocus).join(", ")}${demand ? ` — ${demand === 2 ? "elite" : "demanding"} training standard` : ""}.`);

    const sessionCtx = {
      userId, ageBand: profile.ageBand, level, track: profile.track, goal, goals: chosenGoals, focusWords: focusWords(coachFocus), demand,
      equipment: [...new Set([...(profile.equipment.length ? profile.equipment : ["bodyweight"]), ...gymEquipment])], equipmentExclude: profile.equipmentExclude,
      injuries: injuries.filter((i) => i.kind !== "illness").map((i) => ({ bodyPart: i.bodyPart, restrictions: i.restrictions ?? undefined, status: i.status })), injuryDataKnown: profile.injuryDataStatus === "known",
      otherLimitations: profile.otherLimitations, conditions: Array.isArray(profile.healthConditions) ? profile.healthConditions.map(String) : [], isPregnant: profile.isPregnant, extraAvoid,
    };
    // The AI sees the person's WHOLE safe pool (in batches), not a sample of the library.
    const aiPreferred = aiProvider() ? await rerankWorkoutCandidates(safePool(exercises as any, sessionCtx as any), { ...sessionCtx, availableMinutes: minutes, readiness, focusLabels: focusLabels(coachFocus) } as any).catch(() => []) : [];
    const session = buildDailySession(exercises as any, {
      goals: chosenGoals, focusWords: focusWords(coachFocus), demand,
      userId, ageBand: profile.ageBand, level, track: profile.track, goal,
      equipment: [...new Set([...(profile.equipment.length ? profile.equipment : ["bodyweight"]), ...gymEquipment])], equipmentExclude: profile.equipmentExclude,
      injuries: injuries.filter((i) => i.kind !== "illness").map((i) => ({ bodyPart: i.bodyPart, restrictions: i.restrictions ?? undefined, status: i.status })), injuryDataKnown: profile.injuryDataStatus === "known",
      otherLimitations: profile.otherLimitations, conditions: Array.isArray(profile.healthConditions) ? profile.healthConditions.map(String) : [], isPregnant: profile.isPregnant, stressLevel: profile.stressLevel, outdoorTrainingOk: profile.outdoorTrainingOk,
      trainingDays: profile.trainingDays, availableMinutes: minutes, aiPreferredExerciseIds: aiPreferred, location: profile.locationLat != null && profile.locationLng != null ? { lat: profile.locationLat, lng: profile.locationLng, city: profile.locationCity || undefined, country: profile.locationCountry || undefined } : null,
      recentExerciseIds: recentIds, recentMuscleTags: recentMuscles.flatMap((x) => [x.muscleGroup, x.target, ...x.secondaryMuscles]).filter(Boolean) as string[], recentMovementPatterns: recentMuscles.map((x) => x.movementPattern).filter(Boolean) as string[],
      weeklyMuscleTags: weeklyExercises.flatMap((x) => [x.muscleGroup, x.target, ...x.secondaryMuscles]).filter(Boolean) as string[], weeklyMovementPatterns: weeklyExercises.map((x) => x.movementPattern).filter(Boolean) as string[],
      performanceHistory, missedSessions, dayOfWeek: now.getDay(), readiness, extraAvoid, extraNotes: notes, effortCap: unwell ? "easy" : undefined,
    }, now);
    const version = (await prisma.workoutPlan.count({ where: { userId, date: today } })) + 1;
    const saved = await prisma.$transaction(async (tx) => {
      await tx.workoutPlan.updateMany({ where: { userId, date: today, isActive: true }, data: { isActive: false } });
      return tx.workoutPlan.create({ data: { userId, date: today, planData: session as any, isActive: true, version, regenReason: reason } });
    });
    return { status: 200, body: { ok: true, session, planId: saved.id, version, usage: { used: cap.used, limit: cap.limit }, fitness: fit } };
  } catch (e) {
    await refundUsage(userId, "workout_build");
    if (e instanceof NoSafeExerciseError) return { status: 422, body: { ok: false, code: e.code, error: e.message, details: e.details } };
    logError("api_error", e, {});
    return { status: 500, body: { ok: false, error: "Workout generation failed. No unsafe fallback was generated." } };
  }
}

/** Build or rebuild today's workout from the answers the athlete just gave. */
export async function POST() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const blocked = await paywallResponse(a.session.user.id, a.session.user.role); if (blocked) return blocked;
  const r = await build(a.session.user.id, "questionnaire");
  return NextResponse.json(r.body, { status: r.status });
}

/** Today's workout if one exists. A workout is never built just because the athlete logged in — it is built after the questions are answered. */
export async function GET() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const userId = a.session.user.id;
  const blocked = await paywallResponse(userId, a.session.user.role); if (blocked) return blocked;
  const today = dateOnly(new Date());
  const [plan, checkin, fit, usage, profile] = await Promise.all([
    prisma.workoutPlan.findFirst({ where: { userId, date: today, isActive: true }, orderBy: { createdAt: "desc" } }),
    prisma.dailyCheckin.findUnique({ where: { userId_date: { userId, date: today } }, select: { updatedAt: true } }),
    fitnessStatus(userId), usageToday(userId, "workout_build"),
    prisma.profile.findUnique({ where: { userId }, select: { onboardingCompleted: true } }),
  ]);
  const injuryNewer = plan ? await prisma.injury.findFirst({ where: { athleteId: userId, updatedAt: { gt: plan.createdAt } }, select: { id: true } }) : null;
  const stale = Boolean(plan && ((checkin && checkin.updatedAt > plan.createdAt) || injuryNewer));
  return NextResponse.json({
    session: plan?.planData ?? null, planId: plan?.id ?? null,
    needsQuestions: !plan && !fit.state.startsWith("rest"), needsCheckin: !checkin, stale, rest: fit.state === "rest" && !plan,
    fitness: fit, usage, onboardingCompleted: Boolean(profile?.onboardingCompleted),
    error: !profile?.onboardingCompleted ? "Finish your setup so we can build today's workout." : undefined,
  });
}
