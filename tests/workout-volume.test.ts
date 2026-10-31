import { describe, expect, it } from "vitest";
import { buildDailySession, volumePlan } from "@/lib/workout/engine";
import type { ExerciseRow, UserWorkoutContext } from "@/lib/workout/types";

const tok = (i: number) => "q" + i.toString(26).replace(/[0-9]/g, (c) => "abcdefghij"[+c]).padStart(3, "z");
const mk = (i: number, extra: Partial<ExerciseRow> = {}): ExerciseRow => ({ id: "e" + i, name: `Move ${tok(i)}`, bodyPart: "legs", target: "quads", category: "strength", equipment: "body only", difficulty: "beginner", verified: true, tracks: ["general"], goals: ["general_fitness"], safetyTags: [], contraindicationTags: [], roleTags: [], secondaryMuscles: [], ...extra });
const ex: ExerciseRow[] = [...Array.from({ length: 60 }, (_, i) => mk(i)), mk(100, { name: "Gentle stretch", roleTags: ["stretch"] }), mk(103, { name: "Hip opener", roleTags: ["stretch"] }), mk(101, { name: "Easy warm up", roleTags: ["warmup"] }), mk(102, { name: "Plank hold", roleTags: ["core"] })];
const ctx = (over: Partial<UserWorkoutContext> = {}): UserWorkoutContext => ({ userId: "user-1", level: "beginner", goal: "general_fitness", track: "general", equipment: ["bodyweight"], availableMinutes: 35, readiness: 70, injuryDataKnown: true, outdoorTrainingOk: false, ...over });
const mains = (s: ReturnType<typeof buildDailySession>) => s.moves.filter((m) => m.role === "main" || m.role === "accessory");
const day = new Date(Date.UTC(2026, 9, 5));

describe("volume follows the time available", () => {
  it("more minutes give more exercises", () => {
    const counts = [20, 35, 60, 90].map((m) => mains(buildDailySession(ex, ctx({ availableMinutes: m }), day)).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    expect(counts[3]).toBeGreaterThanOrEqual(8);
  });
  it("the session fits the time it was given", () => {
    for (const m of [20, 35, 45, 60, 90, 120]) for (const level of ["beginner", "intermediate", "advanced"]) {
      const s = buildDailySession(ex, ctx({ availableMinutes: m, level }), day);
      expect(s.estimatedMinutes).toBeLessThanOrEqual(m + 5);
      if (m >= 35) expect(s.estimatedMinutes).toBeGreaterThanOrEqual(m * 0.7);
    }
  });
  it("advanced athletes get more sets than beginners; low readiness gets fewer sets and longer rests", () => {
    expect(volumePlan(60, "advanced").sets).toBeGreaterThan(volumePlan(60, "beginner").sets);
    const tired = volumePlan(60, "intermediate", 30), fresh = volumePlan(60, "intermediate", 80);
    expect(tired.sets).toBeLessThan(fresh.sets);
    expect(tired.restSec).toBeGreaterThan(fresh.restSec);
  });
  it("long sessions with capped blocks put spare time into extra sets, and the warm-up grows", () => {
    const long = volumePlan(150, "intermediate"), short = volumePlan(30, "intermediate");
    expect(long.count).toBe(10);
    expect(long.sets).toBeGreaterThan(short.sets);
    expect(long.warmupSec).toBeGreaterThan(short.warmupSec);
  });
  it("children stay at three blocks and three sets however long the session", () => {
    const v = volumePlan(90, "advanced", 80, true);
    expect(v.count).toBeLessThanOrEqual(3);
    expect(v.sets).toBeLessThanOrEqual(3);
  });
});
