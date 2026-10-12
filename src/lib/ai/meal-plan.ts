import { aiText } from "./router";
import { allergySafe, dietarySafe, norm, type DailyFoodPlan, type PlanMeal } from "@/lib/nutrition/engine";
import type { Food } from "@prisma/client";

export type MealPlanContext = {
  country?: string | null; city?: string | null; climate: string;
  dietaryStyle: string[]; allergies: string[]; culturalRestrictions?: string | null;
  healthNotes: string[]; avoidFoods: RegExp[];
  goal?: string | null; targets: { calories: number; protein: number; carbs: number; fat: number };
  mealsPerDay: number; trainsToday: boolean; dayKey: string;
};

const SYSTEM = "You are a registered-dietitian style meal planner inside the Kotaana fitness app. Plan one day of real, affordable food that people in the stated region can actually buy and cook, using local staples and dishes where the region is known. Respect every allergy, dietary style and health note. Give honest calorie and macro estimates. Reply with JSON only. Never give medical diagnoses.";

const SLOTS = ["breakfast", "lunch", "snack", "dinner", "post_workout"] as const;
const LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner", post_workout: "Post-workout" };
const num = (v: unknown, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; };

/** Asks the configured model (DeepSeek by default) for a regional daily plan. Returns null when no model is configured, the answer is unusable, or it misses the calorie target — the caller then falls back to the food library. */
export async function aiDailyFoodPlan(ctx: MealPlanContext): Promise<{ meals: PlanMeal[]; summary: string } | null> {
  const place = [ctx.city, ctx.country].filter(Boolean).join(", ");
  const wanted = ctx.mealsPerDay >= 4 ? ["breakfast", "lunch", "snack", "dinner"] : ["breakfast", "lunch", "dinner"];
  if (ctx.trainsToday) wanted.push("post_workout");
  const prompt = JSON.stringify({
    task: "Plan today's meals. Return JSON {\"meals\":[{\"slot\":string,\"foods\":[{\"name\":string,\"portion\":string,\"calories\":number,\"protein\":number,\"carbs\":number,\"fat\":number}],\"note\":string}],\"summary\":string}. Use exactly these slots in this order: " + wanted.join(", ") + ". 2-5 foods per meal, portions in grams or household measures. Calories/macros are per portion listed. The day's total must land within 5% of the calorie target. Vary the plan day to day (seed: " + ctx.dayKey + ").",
    location: place || "unknown — use widely available, affordable foods",
    climate: ctx.climate,
    goal: ctx.goal || "general_fitness",
    dailyTargets: ctx.targets,
    dietaryStyle: ctx.dietaryStyle,
    allergies: ctx.allergies,
    culturalOrReligiousRestrictions: ctx.culturalRestrictions || null,
    healthNotes: ctx.healthNotes,
  });
  const raw = await aiText(prompt, { system: SYSTEM, temperature: 0.6 }).catch(() => null);
  if (!raw) return null;
  let parsed: any;
  try { parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim()); } catch { return null; }
  if (!Array.isArray(parsed?.meals)) return null;

  const meals: PlanMeal[] = [];
  for (const m of parsed.meals) {
    const slot = SLOTS.find((s) => s === m?.slot);
    if (!slot || !Array.isArray(m.foods)) continue;
    const foods = m.foods.slice(0, 6).map((f: any, i: number) => ({ id: `ai-${slot}-${i}`, name: String(f?.name || "").trim().slice(0, 80), servingSize: f?.portion ? String(f.portion).slice(0, 40) : null, calories: num(f?.calories, 2500), protein: num(f?.protein, 250), carbs: num(f?.carbs, 500), fat: num(f?.fat, 250) })).filter((f: { name: string }) => f.name);
    if (!foods.length) continue;
    // Anything that breaks an allergy, dietary style or health rule invalidates the whole AI answer rather than being silently kept.
    const unsafe = foods.some((f: { name: string }) => { const asFood = { name: f.name, category: "", allergyTags: [], dietaryTags: [] } as unknown as Food; return !allergySafe(asFood, ctx.allergies) || !dietarySafe(asFood, ctx.dietaryStyle) || ctx.avoidFoods.some((rx) => rx.test(norm(f.name))); });
    if (unsafe) return null;
    const sum = (k: "calories" | "protein" | "carbs" | "fat") => foods.reduce((n: number, f: any) => n + f[k], 0);
    meals.push({ slot, name: LABEL[slot], foods, calories: sum("calories"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat"), note: m.note ? String(m.note).slice(0, 160) : undefined });
  }
  if (meals.length < 3) return null;
  const total = meals.reduce((n, m) => n + m.calories, 0);
  if (total < ctx.targets.calories * 0.85 || total > ctx.targets.calories * 1.15) return null;
  return { meals, summary: parsed.summary ? String(parsed.summary).slice(0, 300) : "" };
}
