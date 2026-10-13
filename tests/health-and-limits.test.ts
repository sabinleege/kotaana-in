import { describe, expect, it } from "vitest";
import { TIERS, effectiveCapacity, parseCapacityPlan, capacityPlanType, tierAfter, tierCovering } from "@/lib/coach/capacity";
import { adjustForTrend, estimateRecovery, followUpInDays, progressOf } from "@/lib/health/recovery";
import { bmiOf, isChild, nutritionTargets } from "@/lib/health/targets";
import { DAILY_LIMITS } from "@/lib/usage";

describe("coach capacity tiers", () => {
  it("is free up to 70, then $20 to 150, $30 to 230, and $10 more per further 80", () => {
    expect(tierCovering(70)).toEqual({ max: 70, usd: 0 });
    expect(tierCovering(71)).toEqual({ max: 150, usd: 20 });
    expect(tierCovering(150)).toEqual({ max: 150, usd: 20 });
    expect(tierCovering(151)).toEqual({ max: 230, usd: 30 });
    expect(tierAfter(310)).toEqual({ max: 390, usd: 50 });
    expect(tierAfter(390)).toEqual({ max: 470, usd: 60 });
    expect(TIERS[0].usd).toBe(0);
  });
  it("falls back to 70 when the paid tier has expired", () => {
    expect(effectiveCapacity({ memberCapacity: 150, capacityUntil: new Date(Date.now() + 86400000) })).toBe(150);
    expect(effectiveCapacity({ memberCapacity: 150, capacityUntil: new Date(Date.now() - 1000) })).toBe(70);
    expect(effectiveCapacity(null)).toBe(70);
  });
  it("round-trips the plan type used in payments", () => {
    expect(parseCapacityPlan(capacityPlanType(150))).toBe(150);
    expect(parseCapacityPlan("direct")).toBeNull();
    expect(parseCapacityPlan("coach_capacity_x")).toBeNull();
  });
});

describe("daily limits", () => {
  it("allows 10 meal photos and 3 workout builds a day", () => {
    expect(DAILY_LIMITS.meal_photo).toBe(10);
    expect(DAILY_LIMITS.workout_build).toBe(3);
  });
});

describe("recovery estimates", () => {
  it("always trusts a doctor's timeline", () => {
    expect(estimateRecovery({ kind: "injury", type: "fracture", severity: 5, doctorDays: 20 })).toEqual({ days: 20, source: "doctor" });
  });
  it("gives longer estimates for worse and more serious injuries", () => {
    const mild = estimateRecovery({ kind: "injury", type: "bruise", severity: 1 }).days; const bad = estimateRecovery({ kind: "injury", type: "fracture", severity: 4 }).days;
    expect(bad).toBeGreaterThan(mild * 5);
    expect(estimateRecovery({ kind: "illness", type: "cold", severity: 2 }).days).toBeLessThan(estimateRecovery({ kind: "illness", type: "influenza", severity: 4 }).days);
  });
  it("lets a photo shorten or lengthen the estimate within safe limits", () => {
    const rule = estimateRecovery({ kind: "injury", type: "sprain", severity: 3 }).days;
    expect(estimateRecovery({ kind: "injury", type: "sprain", severity: 3, photoFactor: 0.7 }).days).toBeLessThan(rule);
    expect(estimateRecovery({ kind: "injury", type: "sprain", severity: 3, photoFactor: 9 }).days).toBe(Math.round(rule * 1.4));
  });
  it("moves the estimate with how it is going, and follows up sooner when it worsens", () => {
    expect(adjustForTrend(20, 10, "better")).toBeLessThan(20); expect(adjustForTrend(20, 10, "worse")).toBeGreaterThan(20); expect(adjustForTrend(20, 10, "same")).toBe(20);
    expect(followUpInDays(2, "worse")).toBe(3); expect(followUpInDays(4)).toBe(3); expect(followUpInDays(2)).toBe(7);
  });
  it("reports progress and days left", () => {
    const rec = { status: "active", dateReported: new Date(Date.now() - 10 * 86400000), estimatedDays: 20, healingPercent: null, severity: 3, kind: "injury", bodyPart: "Knee", injuryType: "Sprain", nextFollowUpAt: null, doctorPrescribed: false, onMedication: false };
    expect(progressOf(rec)).toEqual({ percent: 50, daysLeft: 10 });
    expect(progressOf({ ...rec, status: "resolved" })).toEqual({ percent: 100, daysLeft: 0 });
  });
});

describe("nutrition targets", () => {
  it("matches the worked example for an adult", () => {
    expect(nutritionTargets({ weight: 75, height: 175, age: 30, gender: "male", trainingDaysPerWeek: 3, primaryGoal: "general_fitness" })).toEqual({ calories: 2295, protein: 120, carbs: 299, fat: 69 });
  });
  it("never puts a child or teenager on a deficit or an adult goal adjustment", () => {
    const kid = nutritionTargets({ weight: 40, height: 150, age: 12, gender: "female", primaryGoal: "fat_loss" })!;
    expect(isChild(12)).toBe(true); expect(kid.calories).toBeGreaterThanOrEqual(1400); expect(kid.calories).toBe(1950);
    const teen = nutritionTargets({ weight: 60, height: 170, age: 16, gender: "male", primaryGoal: "fat_loss", targetCalories: 1200 })!;
    expect(teen.calories).toBeGreaterThanOrEqual(1400);
  });
  it("computes BMI", () => { expect(bmiOf(70, 175)).toBe(22.9); expect(bmiOf(null, 175)).toBeNull(); });
});
