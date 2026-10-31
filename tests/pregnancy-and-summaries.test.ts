import { describe, expect, it } from "vitest";
import { dueDateFrom, pregnancyExtras, pregnancyStatus, pregnancyWorkout, weightGainRange } from "@/lib/health/pregnancy";
import { nutritionTargets } from "@/lib/health/targets";
import { rollUp, weekStartOf, type WeekMetrics } from "@/lib/summaries";

const now = new Date("2026-10-31T12:00:00Z");
describe("pregnancy dating", () => {
  it("due date from the last period is 280 days later, shifted for long cycles", () => {
    expect(dueDateFrom({ method: "lmp", lmp: "2026-01-01" })?.toISOString().slice(0, 10)).toBe("2026-10-08");
    expect(dueDateFrom({ method: "lmp", lmp: "2026-01-01", cycleDays: 32 })?.toISOString().slice(0, 10)).toBe("2026-10-12");
  });
  it("due date from a scan adds the remaining days to 40 weeks", () => {
    expect(dueDateFrom({ method: "scan", scanDate: "2026-06-01", scanWeeks: 12, scanDays: 3 })?.toISOString().slice(0, 10)).toBe("2026-12-11");
  });
  it("gives week + day and trimester", () => {
    const s = pregnancyStatus(true, null, { method: "lmp", lmp: "2026-08-01" }, now)!;
    expect(s.week).toBe(13); expect(s.day).toBe(0); expect(s.trimester).toBe(1);
    expect(pregnancyStatus(true, null, { method: "lmp", lmp: "2026-04-01" }, now)!.trimester).toBe(3);
  });
  it("uses IOM gain ranges and twin ranges", () => {
    expect(weightGainRange(60, 165)).toEqual({ min: 11.5, max: 16 });
    expect(weightGainRange(90, 165)).toEqual({ min: 5, max: 9 });
    expect(weightGainRange(60, 165, true)).toEqual({ min: 17, max: 25 });
  });
  it("adds trimester energy, never cuts calories for fat loss, and restricts exercise with complications", () => {
    const t2 = pregnancyStatus(true, null, { method: "lmp", lmp: "2026-06-01" }, now);
    expect(pregnancyExtras(t2).kcal).toBe(340);
    const base = { weight: 70, height: 165, age: 30, gender: "female", primaryGoal: "fat_loss", trainingDaysPerWeek: 3 };
    const preg = nutritionTargets({ ...base, isPregnant: true, pregnancyDetails: { method: "lmp", lmp: "2026-06-01" } })!;
    expect(preg.calories).toBeGreaterThan(nutritionTargets(base)!.calories + 340);
    const risky = pregnancyWorkout(pregnancyStatus(true, null, { method: "due", complications: ["placenta_previa"] }, now));
    expect(risky.cap).toBe("easy"); expect(risky.readinessCap).toBe(30);
  });
});

const week = (sessions: number, readiness: number | null, checkins: number): WeekMetrics => ({ final: true, days: 7, workouts: { sessions, avgCompletionPct: 80, avgRpe: 6, painReports: 0, blocks: sessions * 4, blocksEasy: 0, blocksHard: 0, blocksSkipped: 0, sets: sessions * 12, reps: sessions * 120, workMin: sessions * 30, volumeKg: 0, topExercises: [] }, checkins: { count: checkins, energy: 3, soreness: 2, mood: 3, sleepHours: 7, readiness, unwellDays: 0 }, nutrition: { daysLogged: 0, avgKcal: null, avgProteinG: null }, water: { daysLogged: 0, avgPctOfTarget: null }, activity: { kcalBurned: 0, runs: 0, runKm: 0 }, weight: { first: 80, last: 79 }, health: { updates: 0, avgPain: null } });
describe("monthly roll-up", () => {
  it("adds totals and weights averages by days with data", () => {
    const m = rollUp([week(3, 60, 1), week(4, 80, 3)]);
    expect(m.workouts.sessions).toBe(7); expect(m.workouts.sets).toBe(84);
    expect(m.checkins.readiness).toBe(75);
    expect(m.weight).toEqual({ first: 80, last: 79 });
  });
  it("weeks start on Monday (UTC)", () => {
    expect(weekStartOf(new Date("2026-11-01T10:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-26");
  });
});
