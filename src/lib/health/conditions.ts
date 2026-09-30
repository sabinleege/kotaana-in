// Chronic-condition rules shared by the Health form, the workout engine and the nutrition engine.
// Rules are conservative filters and notes only; they never replace medical clearance.

export type Effort = "easy" | "moderate" | "hard";

export type ConditionRule = {
  id: string;
  label: string;
  /** Exercise name/tag/instruction terms removed from the eligible pool. */
  avoidExercises?: string[];
  /** Highest effort any prescribed move may carry. */
  maxEffort?: Effort;
  workoutNote?: string;
  /** Food name/category patterns removed from meal suggestions. */
  avoidFoods?: RegExp;
  nutritionNote?: string;
};

const HIGH_INTENSITY = ["sprint", "burpee", "box jump", "plyo", "jump squat", "tuck jump"];
const HIGH_IMPACT = ["jump", "sprint", "burpee", "plyo", "skipping"];
const SPINAL_FLEXION = ["sit up", "crunch", "toe touch", "v up", "good morning"];
const SUGARY = /\b(sugar|sugars|sweetened|candy|candies|syrup|soda|soft drink|frosted|cake|cookie|cookies|donut|doughnut|caramel|chocolate|honey|jam|jelly|pastry|pie|ice cream|dessert)\b/;
const SALTY = /\b(salted|salt|bacon|sausage|ham|salami|pepperoni|pickle|pickled|instant|chips|crisps|cured|smoked|processed|bouillon|soy sauce|frankfurter|hot dog)\b/;

export const CHRONIC_CONDITIONS: ConditionRule[] = [
  { id: "hypertension", label: "High blood pressure", avoidExercises: [...HIGH_INTENSITY, "handstand", "headstand"], maxEffort: "moderate",
    workoutNote: "High blood pressure: keep breathing steadily (never hold your breath while lifting) and stop if you feel dizzy or get a headache.",
    avoidFoods: SALTY, nutritionNote: "High blood pressure: salty and processed foods are left out of suggestions." },
  { id: "heart_disease", label: "Heart disease", avoidExercises: [...HIGH_INTENSITY, "handstand", "headstand"], maxEffort: "moderate",
    workoutNote: "Heart condition: train only with your doctor's clearance and stop immediately for chest pain, unusual breathlessness or palpitations.",
    avoidFoods: SALTY, nutritionNote: "Heart condition: salty and processed foods are left out of suggestions." },
  { id: "diabetes_type1", label: "Type 1 diabetes",
    workoutNote: "Type 1 diabetes: check blood glucose before and after training and keep a fast-acting carbohydrate within reach.",
    avoidFoods: SUGARY, nutritionNote: "Diabetes: sugary foods are left out; spread carbohydrates evenly across meals." },
  { id: "diabetes_type2", label: "Type 2 diabetes",
    workoutNote: "Type 2 diabetes: regular training helps glucose control — check your levels if you use insulin or sulfonylureas.",
    avoidFoods: SUGARY, nutritionNote: "Diabetes: sugary foods are left out; spread carbohydrates evenly across meals." },
  { id: "asthma", label: "Asthma", avoidExercises: ["sprint"],
    workoutNote: "Asthma: keep your inhaler nearby and take the warm-up slowly; stop if wheezing starts." },
  { id: "arthritis", label: "Arthritis / joint disease", avoidExercises: HIGH_IMPACT,
    workoutNote: "Arthritis: high-impact moves are removed; move through a comfortable range and stop for sharp joint pain." },
  { id: "osteoporosis", label: "Osteoporosis", avoidExercises: [...HIGH_IMPACT, ...SPINAL_FLEXION, "twist", "russian twist"],
    workoutNote: "Osteoporosis: jumping, forward spine bending and loaded twisting are removed to protect your bones." },
  { id: "chronic_back_pain", label: "Chronic back pain", avoidExercises: [...SPINAL_FLEXION, "deadlift", "hanging leg raise", "superman"],
    workoutNote: "Chronic back pain: spine-loading and bending moves are removed; keep a neutral back." },
  { id: "obesity", label: "Obesity", avoidExercises: HIGH_IMPACT,
    workoutNote: "Joint-friendly plan: high-impact moves are replaced with low-impact options." },
  { id: "sickle_cell", label: "Sickle cell disease", avoidExercises: HIGH_INTENSITY, maxEffort: "moderate",
    workoutNote: "Sickle cell: drink extra water, avoid overheating and keep intensity moderate; rest at the first sign of pain." },
  { id: "epilepsy", label: "Epilepsy", avoidExercises: ["handstand", "headstand", "rope climb"],
    workoutNote: "Epilepsy: train with someone nearby and avoid exercising alone in water or at height." },
  { id: "kidney_disease", label: "Kidney disease", maxEffort: "moderate",
    workoutNote: "Kidney disease: keep intensity moderate and follow your doctor's fluid guidance.",
    avoidFoods: SALTY, nutritionNote: "Kidney disease: salty foods are left out; confirm your protein and fluid limits with your doctor." },
];

export const PREGNANCY_RULE: ConditionRule = {
  id: "pregnancy", label: "Pregnancy", avoidExercises: [...HIGH_IMPACT, ...SPINAL_FLEXION, "twist", "hanging", "handstand", "headstand"], maxEffort: "moderate",
  workoutNote: "Pregnancy: impact, crunches and inverted moves are removed; you should be able to talk while training.",
  avoidFoods: /\b(raw|sushi|liver|swordfish|shark|king mackerel|unpasteurized|alcohol|beer|wine)\b/, nutritionNote: "Pregnancy: raw fish, liver and high-mercury fish are left out of suggestions.",
};

export const SMOKING_OPTIONS = [["never", "Never smoked"], ["former", "Former smoker"], ["current", "Current smoker"]] as const;
export const ALCOHOL_OPTIONS = [["none", "None"], ["occasional", "Occasionally"], ["weekly", "Weekly"], ["daily", "Daily"]] as const;
export const ACTIVITY_OPTIONS = [["office", "Mostly sitting (office / desk)"], ["standing", "Mostly standing / walking"], ["manual", "Physical / manual work"]] as const;

export function activeRules(conditions: unknown, isPregnant?: boolean | null): ConditionRule[] {
  const ids = new Set(Array.isArray(conditions) ? conditions.map(String) : []);
  const rules = CHRONIC_CONDITIONS.filter(c => ids.has(c.id));
  if (isPregnant) rules.push(PREGNANCY_RULE);
  return rules;
}

const EFFORT_RANK: Record<Effort, number> = { easy: 1, moderate: 2, hard: 3 };
export function effortCap(rules: ConditionRule[]): Effort | undefined {
  return rules.reduce<Effort | undefined>((cap, r) => r.maxEffort && (!cap || EFFORT_RANK[r.maxEffort] < EFFORT_RANK[cap]) ? r.maxEffort : cap, undefined);
}
export function capEffort(effort: Effort | undefined, cap: Effort | undefined): Effort | undefined {
  return effort && cap && EFFORT_RANK[effort] > EFFORT_RANK[cap] ? cap : effort;
}
