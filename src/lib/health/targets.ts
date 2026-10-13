/** Body and nutrition numbers derived from the profile. Returned values are null when the inputs needed to compute them are missing. */

export function bmiOf(weightKg?: number | null, heightCm?: number | null) {
  if (!weightKg || !heightCm || heightCm < 80) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(b: number | null) {
  if (b == null) return null;
  if (b < 18.5) return { label: "Underweight", tone: "blue" as const };
  if (b < 25) return { label: "Healthy", tone: "ok" as const };
  if (b < 30) return { label: "Overweight", tone: "orange" as const };
  return { label: "Obese", tone: "danger" as const };
}

export type NutritionTargets = { calories: number; protein: number; carbs: number; fat: number };

type P = { weight?: number | null; height?: number | null; age?: number | null; gender?: string | null; targetCalories?: number | null; primaryGoal?: string | null; trainingDaysPerWeek?: number | null };

/** Daily calories and macros: the athlete's own calorie target when set, otherwise Mifflin-St Jeor with a training-days activity factor and a goal adjustment. */
export const isChild = (age?: number | null) => age != null && age < 18;

/** Children and teenagers are growing: no weight-loss deficit, no adult goal adjustment, and a floor on calories. */
function childTargets(p: P): NutritionTargets {
  const age = p.age ?? 12;
  const base = age <= 8 ? 1600 : age <= 13 ? (p.gender === "male" ? 2200 : 1950) : p.gender === "male" ? 2600 : p.gender === "female" ? 2200 : 2400;
  const calories = Math.max(1400, Math.min(3200, p.targetCalories ?? base));
  const protein = Math.round((p.weight ?? age * 3.2 + 7) * 1.0);
  const fat = Math.round((calories * 0.3) / 9);
  return { calories, protein, carbs: Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)), fat };
}

export function nutritionTargets(p: P): NutritionTargets | null {
  if (isChild(p.age)) return childTargets(p);
  let calories = p.targetCalories ?? null;
  if (!calories) {
    if (!p.weight || !p.height || !p.age) return null;
    const base = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78);
    const factor = Math.min(1.55, 1.2 + 0.05 * (p.trainingDaysPerWeek ?? 3));
    const adj = p.primaryGoal === "fat_loss" ? -400 : p.primaryGoal === "muscle_gain" ? 300 : 0;
    calories = Math.max(1200, Math.round((base * factor + adj) / 5) * 5);
  }
  const perKg = p.primaryGoal === "fat_loss" || p.primaryGoal === "muscle_gain" ? 2 : 1.6;
  const protein = p.weight ? Math.round(p.weight * perKg) : Math.round((calories * 0.2) / 4);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

/** Sensible weekly weight change (kg) used to estimate how long a weight goal takes. */
export function weeksToGoal(weight?: number | null, target?: number | null) {
  if (!weight || !target) return null;
  const diff = Math.abs(target - weight);
  if (diff < 0.5) return 0;
  return Math.max(4, Math.min(52, Math.round(diff / 0.4)));
}

/** American Council on Exercise body-fat bands. Unknown gender uses the male bands. */
export function bodyFatCategory(pct: number, gender?: string | null) {
  const f = gender === "female";
  const bands: [number, string][] = f ? [[14, "Essential"], [21, "Athlete"], [25, "Fitness"], [32, "Average"]] : [[6, "Essential"], [14, "Athlete"], [18, "Fitness"], [25, "Average"]];
  for (const [max, label] of bands) if (pct < max) return label;
  return "Above average";
}
