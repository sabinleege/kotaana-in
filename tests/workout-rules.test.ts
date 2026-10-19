import { describe, expect, it } from "vitest";
import { buildDailySession, goalFit, safePool } from "@/lib/workout/engine";
import type { ExerciseRow, UserWorkoutContext } from "@/lib/workout/types";

const tok = (i: number) => "q" + i.toString(26).replace(/[0-9]/g, (c) => "abcdefghij"[+c]).padStart(3, "z");
const mk = (i: number, extra: Partial<ExerciseRow> = {}): ExerciseRow => ({ id: "e" + i, name: `Move ${tok(i)}`, bodyPart: "legs", target: "quads", category: "strength", equipment: "body only", difficulty: "beginner", verified: true, tracks: ["general"], goals: ["general_fitness"], safetyTags: [], contraindicationTags: [], roleTags: [], secondaryMuscles: [], ...extra });
const base = (): ExerciseRow[] => [
  ...Array.from({ length: 40 }, (_, i) => mk(i)),
  mk(100, { name: "Gentle stretch", roleTags: ["stretch"] }), mk(101, { name: "Easy warm up", roleTags: ["warmup"] }), mk(102, { name: "Plank hold", roleTags: ["core"] }),
];
const ctx = (over: Partial<UserWorkoutContext> = {}): UserWorkoutContext => ({ userId: "user-1", level: "beginner", goal: "general_fitness", track: "general", equipment: ["bodyweight"], availableMinutes: 35, readiness: 70, injuryDataKnown: true, ...over });
const mains = (s: ReturnType<typeof buildDailySession>) => s.moves.filter((m) => m.role === "main" || m.role === "accessory");
const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n));

describe("goal-focused selection", () => {
  it("only gives goal-serving work when enough of it exists", () => {
    const ex = [...Array.from({ length: 20 }, (_, i) => mk(i, { name: `Heavy press ${tok(i)}`, goals: ["muscle_gain"] })), ...Array.from({ length: 20 }, (_, i) => mk(50 + i, { name: `Easy circle ${tok(i)}`, goals: ["general_fitness"] })), mk(100, { name: "Gentle stretch", roleTags: ["stretch"] }), mk(101, { name: "Easy warm up", roleTags: ["warmup"] })];
    for (let d = 0; d < 6; d++) for (const m of mains(buildDailySession(ex, ctx({ goal: "muscle_gain" }), day(d)))) expect(Number(m.exerciseId.slice(1))).toBeLessThan(20);
  });
  it("goalFit recognises cardio for fat loss and strength for muscle gain", () => {
    expect(goalFit(mk(1, { name: "Mountain climber" }), "fat_loss")).toBe(true);
    expect(goalFit(mk(2, { name: "Barbell squat press" }), "muscle_gain")).toBe(true);
    expect(goalFit(mk(3, { name: "Gentle stretch" }), "general_fitness")).toBe(false);
  });
});

describe("AI preference and recency now steer the pick", () => {
  it("picks AI-preferred exercises more often than chance", () => {
    const preferred = ["e1", "e2", "e3", "e4", "e5"]; let withAi = 0, without = 0;
    for (let d = 0; d < 30; d++) {
      withAi += mains(buildDailySession(base(), ctx({ aiPreferredExerciseIds: preferred }), day(d))).filter((m) => preferred.includes(m.exerciseId)).length;
      without += mains(buildDailySession(base(), ctx(), day(d))).filter((m) => preferred.includes(m.exerciseId)).length;
    }
    expect(withAi).toBeGreaterThan(without);
  });
  it("the same day always gives the same session", () => {
    const a = buildDailySession(base(), ctx(), day(3)).moves.map((m) => m.exerciseId); const b = buildDailySession(base(), ctx(), day(3)).moves.map((m) => m.exerciseId);
    expect(a).toEqual(b);
  });
});

describe("repeating an exercise on purpose", () => {
  it("may repeat a recent exercise but gives it a new format", () => {
    const all = base().map((e) => e.id).filter((id) => id.startsWith("e") && Number(id.slice(1)) < 40);
    const s = buildDailySession(base(), ctx({ recentExerciseIds: all }), day(2));
    const repeated = mains(s);
    expect(repeated.length).toBeGreaterThan(0);
    for (const m of repeated) { expect(m.format).toBeTruthy(); expect(m.notes).toContain("new format"); }
  });
  it("leaves fresh exercises in the normal format", () => {
    expect(mains(buildDailySession(base(), ctx(), day(2))).every((m) => !m.format)).toBe(true);
  });
});

describe("children and teenagers", () => {
  it("never get barbell or machine work and are capped at moderate effort", () => {
    const ex = [...base(), ...Array.from({ length: 15 }, (_, i) => mk(200 + i, { name: `Barbell lift ${tok(i)}`, equipment: "barbell" }))];
    for (let d = 0; d < 6; d++) {
      const s = buildDailySession(ex, ctx({ ageBand: "youth_u14", equipment: ["bodyweight", "barbell"], level: "advanced", goal: "general_fitness", availableMinutes: 60 }), day(d));
      expect(s.moves.some((m) => /barbell/i.test(m.name))).toBe(false);
      expect(s.moves.every((m) => m.effort !== "hard")).toBe(true);
      expect(mains(s).length).toBeLessThanOrEqual(3);
      expect((s.meta.healthNotes ?? []).join(" ")).toContain("Youth programme");
    }
  });
});

describe("health adjustments", () => {
  it("drops the words the day must avoid (late pregnancy) and shows the notes", () => {
    const ex = [...base(), ...Array.from({ length: 10 }, (_, i) => mk(300 + i, { name: `Crunch variation ${tok(i)}` }))];
    for (let d = 0; d < 6; d++) {
      const s = buildDailySession(ex, ctx({ isPregnant: true, extraAvoid: ["crunch"], extraNotes: ["Pregnancy week 30: no crunches."] }), day(d));
      expect(s.moves.some((m) => m.name.toLowerCase().includes("crunch"))).toBe(false);
      expect(s.meta.healthNotes ?? []).toContain("Pregnancy week 30: no crunches.");
    }
  });
  it("caps effort at easy when the athlete is unwell", () => {
    const s = buildDailySession(base(), ctx({ effortCap: "easy", readiness: 35 }), day(1));
    expect(s.moves.every((m) => !m.effort || m.effort === "easy")).toBe(true);
  });
  it("keeps jumping exercises out when a knee injury is recorded", () => {
    const ex = [...base(), ...Array.from({ length: 12 }, (_, i) => mk(400 + i, { name: `Jump squat ${tok(i)}` }))];
    for (let d = 0; d < 6; d++) expect(buildDailySession(ex, ctx({ injuries: [{ bodyPart: "Knee", status: "active" }] }), day(d)).moves.some((m) => /jump/i.test(m.name))).toBe(false);
  });
});

describe("several goals, coach focus and demanding coaches", () => {
  it("gives every chosen goal at least one main block", () => {
    const ex = [...Array.from({ length: 12 }, (_, i) => mk(i, { name: `Heavy press ${tok(i)}`, goals: ["muscle_gain"] })), ...Array.from({ length: 12 }, (_, i) => mk(50 + i, { name: `Mountain climber ${tok(i)}`, goals: ["fat_loss"] })), mk(100, { name: "Gentle stretch", roleTags: ["stretch"] }), mk(101, { name: "Easy warm up", roleTags: ["warmup"] })];
    for (let d = 0; d < 6; d++) {
      const m = mains(buildDailySession(ex, ctx({ goal: "muscle_gain", goals: ["muscle_gain", "fat_loss"] }), day(d)));
      expect(m.some((x) => /Heavy press/.test(x.name))).toBe(true);
      expect(m.some((x) => /Mountain climber/.test(x.name))).toBe(true);
    }
  });
  it("a demanding coach adds a block, a set and shorter rests; children are not affected", () => {
    const plain = mains(buildDailySession(base(), ctx(), day(1)));
    const hard = mains(buildDailySession(base(), ctx({ demand: 2 }), day(1)));
    expect(hard.length).toBe(plain.length + 1);
    expect(hard[0].sets).toBe((plain[0].sets ?? 3) + 2);
    expect(hard[0].restSec).toBeLessThan(plain[0].restSec ?? 60);
    const kid = mains(buildDailySession(base(), ctx({ demand: 2, ageBand: "youth_u14" }), day(1)));
    expect(kid.length).toBeLessThanOrEqual(3);
  });
  it("coach specialty words pull matching exercises onto the short list", () => {
    const ex = [...Array.from({ length: 30 }, (_, i) => mk(i)), ...Array.from({ length: 6 }, (_, i) => mk(60 + i, { name: `Agility ladder ${tok(i)}` })), mk(100, { name: "Gentle stretch", roleTags: ["stretch"] }), mk(101, { name: "Easy warm up", roleTags: ["warmup"] })];
    let withFocus = 0, without = 0;
    for (let d = 0; d < 20; d++) { withFocus += mains(buildDailySession(ex, ctx({ focusWords: ["agility"] }), day(d))).filter((m) => /Agility/.test(m.name)).length; without += mains(buildDailySession(ex, ctx(), day(d))).filter((m) => /Agility/.test(m.name)).length; }
    expect(withFocus).toBeGreaterThan(without);
  });
  it("safePool keeps only exercises that pass the safety filters, so the AI is shown the whole safe pool", () => {
    const ex = [...base(), ...Array.from({ length: 5 }, (_, i) => mk(500 + i, { name: `Jump squat ${tok(i)}`, equipment: "barbell" }))];
    const pool = safePool(ex, ctx({ injuries: [{ bodyPart: "Knee", status: "active" }] }));
    expect(pool.length).toBe(base().length);
    expect(pool.some((e) => /Jump/.test(e.name))).toBe(false);
  });
});
