import { describe, expect, it } from "vitest";
import { buildDailySession, similarExercises } from "@/lib/workout/engine";
import { receiptHtml } from "@/lib/email";
import type { ExerciseRow } from "@/lib/workout/types";

const ex = (id: string, name: string, extra: Partial<ExerciseRow> = {}): ExerciseRow => ({ id, name, bodyPart: "chest", target: "pectorals", equipment: "body only", difficulty: "beginner", verified: true, tracks: [], goals: [], safetyTags: [], contraindicationTags: [], roleTags: [], secondaryMuscles: [], ...extra });

describe("similar exercises", () => {
  it("treats the same move in another form as similar", () => {
    expect(similarExercises(ex("a", "Barbell Bench Press"), ex("b", "Dumbbell Bench Press"))).toBe(true);
    expect(similarExercises(ex("a", "Push-up"), ex("b", "Wide push-up"))).toBe(true);
    expect(similarExercises(ex("a", "Squat"), ex("b", "Jump squat"))).toBe(false);
    expect(similarExercises(ex("a", "Plank hold"), ex("b", "Bicep curl"))).toBe(false);
  });
  it("treats the same muscle with the same movement pattern as similar", () => {
    expect(similarExercises(ex("a", "Cable fly", { movementPattern: "push", target: "pectorals" }), ex("b", "Pec deck", { movementPattern: "push", target: "pectorals" }))).toBe(true);
  });
});

describe("a session never holds two similar exercises", () => {
  it("even when the library is full of near-duplicates", () => {
    const lib: ExerciseRow[] = [
      ...["Barbell", "Dumbbell", "Cable", "Smith machine", "Incline", "Decline", "Wide", "Close grip"].map((p, i) => ex("bp" + i, `${p} Bench Press`, { movementPattern: "push" })),
      ...["Squat", "Lunge", "Deadlift", "Row", "Curl", "Calf raise", "Hip thrust", "Step up"].map((n, i) => ex("m" + i, n, { target: "t" + i, movementPattern: "p" + i })),
      ex("s1", "Gentle stretch", { roleTags: ["stretch"] }), ex("s2", "Hamstring stretch", { roleTags: ["stretch"] }), ex("w1", "Easy warm up", { roleTags: ["warmup"] }), ex("c1", "Plank hold", { roleTags: ["core"] }),
    ];
    for (let d = 0; d < 20; d++) {
      const s = buildDailySession(lib, { userId: "u" + d, level: "beginner", goal: "general_fitness", equipment: ["bodyweight"], availableMinutes: 45, readiness: 70, injuryDataKnown: true }, new Date(Date.UTC(2026, 9, 1 + d)));
      const picked = s.moves.map((m) => lib.find((e) => e.id === m.exerciseId)!).filter(Boolean);
      for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) expect(similarExercises(picked[i], picked[j]), `${picked[i].name} vs ${picked[j].name}`).toBe(false);
      expect(picked.filter((e) => /Bench Press/.test(e.name)).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("receipt e-mail", () => {
  it("shows what was paid and escapes anything typed by the payer", () => {
    const html = receiptHtml({ number: "KT-AB12CD34", payerName: "Eve <script>", item: "Gym membership (30 days)", amount: 20000, currency: "RWF", paidFrom: "Eve · 0788123456", paidTo: "Demo Gym", confirmedBy: "Demo Coach", date: new Date("2026-10-19"), benefit: "Full access until 18 November 2026" });
    expect(html).toContain("KT-AB12CD34"); expect(html).toContain("20,000 RWF"); expect(html).toContain("Gym membership"); expect(html).toContain("Demo Gym");
    expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
  });
});
