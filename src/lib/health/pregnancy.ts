/** Pregnancy dating and the adjustments that follow from it. Dating follows standard obstetric practice:
 * a due date is 280 days after the first day of the last period (Naegele's rule, shifted for cycles longer or shorter than 28 days),
 * and a scan date + gestational age gives the due date directly. Weight-gain ranges are the IOM 2009 guidelines by pre-pregnancy BMI;
 * extra energy is +340 kcal in the second and +452 kcal in the third trimester (IOM/EFSA), with more for twins. */
import { z } from "zod";

const DAY = 86400000;

export const COMPLICATIONS = [
  ["none", "Nothing — my pregnancy is uncomplicated"],
  ["gestational_diabetes", "Gestational diabetes"],
  ["high_blood_pressure", "High blood pressure"],
  ["preeclampsia", "Pre-eclampsia"],
  ["placenta_previa", "Low-lying placenta (placenta praevia)"],
  ["bleeding", "Bleeding in this pregnancy"],
  ["cervical_insufficiency", "Short cervix or cervical stitch"],
  ["preterm_risk", "Risk of early labour"],
  ["anemia", "Anaemia (low iron)"],
  ["other", "Something else my doctor is watching"],
] as const;
export const SYMPTOMS = [
  ["nausea", "Nausea or vomiting"], ["fatigue", "Very tired"], ["back_pain", "Back or pelvic pain"], ["swelling", "Swelling"],
  ["breathless", "Short of breath"], ["dizziness", "Dizziness"], ["heartburn", "Heartburn"], ["none", "Feeling well"],
] as const;
/** Complications for which exercise beyond gentle walking needs a doctor's explicit plan (ACOG contraindications). */
const REST_ONLY = new Set(["preeclampsia", "placenta_previa", "bleeding", "cervical_insufficiency", "preterm_risk"]);
const GENTLE_ONLY = new Set(["high_blood_pressure", "anemia"]);

export const pregnancyDetailsSchema = z.object({
  method: z.enum(["due", "lmp", "scan"]).default("due"),
  lmp: z.string().date().nullable().optional(),
  cycleDays: z.number().int().min(20).max(45).nullable().optional(),
  scanDate: z.string().date().nullable().optional(),
  scanWeeks: z.number().int().min(4).max(42).nullable().optional(),
  scanDays: z.number().int().min(0).max(6).nullable().optional(),
  prePregWeightKg: z.number().positive().max(300).nullable().optional(),
  multiple: z.boolean().optional(),
  doctorCleared: z.boolean().nullable().optional(),
  complications: z.array(z.enum(COMPLICATIONS.map((c) => c[0]) as [string, ...string[]])).max(COMPLICATIONS.length).optional(),
  symptoms: z.array(z.enum(SYMPTOMS.map((c) => c[0]) as [string, ...string[]])).max(SYMPTOMS.length).optional(),
});
export type PregnancyDetails = z.infer<typeof pregnancyDetailsSchema>;

const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);
export function readDetails(v: unknown): PregnancyDetails | null {
  const r = pregnancyDetailsSchema.safeParse(v);
  return r.success ? r.data : null;
}

/** The due date from whichever dating the person gave. Returns null when the needed date is missing. */
export function dueDateFrom(d: PregnancyDetails | null, givenDue?: Date | null): Date | null {
  if (!d || d.method === "due") return givenDue ?? null;
  if (d.method === "lmp" && d.lmp) return new Date(utc(d.lmp).getTime() + (280 + ((d.cycleDays ?? 28) - 28)) * DAY);
  if (d.method === "scan" && d.scanDate && d.scanWeeks != null) return new Date(utc(d.scanDate).getTime() + (280 - (d.scanWeeks * 7 + (d.scanDays ?? 0))) * DAY);
  return givenDue ?? null;
}

export type PregnancyInfo = { week: number | null; day: number | null; trimester: 1 | 2 | 3 | null; daysToDue: number | null; dueDate: string | null; multiple: boolean; cleared: boolean | null; restOnly: boolean; gentleOnly: boolean; complications: string[]; symptoms: string[] };

/** Week and day of pregnancy (gestational age), trimester and days to the due date. */
export function pregnancyStatus(isPregnant: boolean, due: Date | null | undefined, details?: unknown, now = new Date()): PregnancyInfo | null {
  if (!isPregnant) return null;
  const d = readDetails(details);
  const dueDate = dueDateFrom(d, due ?? null);
  const complications = (d?.complications ?? []).filter((c) => c !== "none");
  const base = { multiple: Boolean(d?.multiple), cleared: d?.doctorCleared ?? null, restOnly: complications.some((c) => REST_ONLY.has(c)), gentleOnly: complications.some((c) => GENTLE_ONLY.has(c)), complications, symptoms: (d?.symptoms ?? []).filter((c) => c !== "none") };
  if (!dueDate) return { week: null, day: null, trimester: null, daysToDue: null, dueDate: null, ...base };
  const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / DAY);
  const ga = Math.max(0, Math.min(300, 280 - daysToDue));
  const week = Math.max(1, Math.min(42, Math.floor(ga / 7)));
  return { week, day: ga % 7, trimester: week < 14 ? 1 : week < 28 ? 2 : 3, daysToDue, dueDate: dueDate.toISOString().slice(0, 10), ...base };
}

/** IOM 2009 recommended total gain (kg) by pre-pregnancy BMI; twins have their own ranges (no range is set for underweight twins, so the singleton one is used). */
export function weightGainRange(prePregKg?: number | null, heightCm?: number | null, multiple = false): { min: number; max: number } | null {
  if (!prePregKg || !heightCm) return null;
  const bmi = prePregKg / (heightCm / 100) ** 2;
  if (multiple) return bmi < 25 ? { min: 17, max: 25 } : bmi < 30 ? { min: 14, max: 23 } : { min: 11, max: 19 };
  return bmi < 18.5 ? { min: 12.5, max: 18 } : bmi < 25 ? { min: 11.5, max: 16 } : bmi < 30 ? { min: 7, max: 11.5 } : { min: 5, max: 9 };
}

/** Extra daily energy and protein on top of the person's normal needs. */
export function pregnancyExtras(info: PregnancyInfo | null) {
  if (!info) return { kcal: 0, proteinG: 0 };
  const t = info.trimester ?? 1;
  const kcal = t === 1 ? 0 : t === 2 ? 340 : 452;
  return { kcal: kcal + (info.multiple && t > 1 ? 300 : 0), proteinG: t === 1 ? 0 : info.multiple ? 50 : 25 };
}

/** Workout adjustments for today: words to keep out, the effort ceiling and the notes shown under the session. */
export function pregnancyWorkout(info: PregnancyInfo | null): { avoid: string[]; cap?: "easy" | "moderate"; notes: string[]; readinessCap?: number } {
  if (!info) return { avoid: [], notes: [] };
  const avoid: string[] = [], notes: string[] = [];
  let cap: "easy" | "moderate" | undefined = "moderate"; let readinessCap: number | undefined;
  const label = info.week ? `Pregnancy week ${info.week}` : "Pregnancy";
  if ((info.trimester ?? 1) >= 2) { avoid.push("supine", "lying", "flat bench", "bench press", "sit up", "crunch", "prone", "face down"); notes.push(`${label}: nothing lying flat on your back or front, no crunches; keep to a pace where you can talk.`); }
  if ((info.trimester ?? 1) >= 3) { avoid.push("plank", "jump", "lunge jump", "deep squat", "overhead"); notes.push("Third trimester: balance and core load are reduced; hold on to support for standing moves."); }
  if (info.multiple) { cap = "easy"; notes.push("Twins or more: intensity is kept easy — check each step with your doctor."); }
  if (info.restOnly || info.cleared === false) { cap = "easy"; readinessCap = 30; avoid.push("squat", "lunge", "press", "row", "deadlift", "carry"); notes.push("Your doctor is watching something in this pregnancy (or has not cleared exercise): only gentle walking, breathing and stretching until they say more is fine."); }
  else if (info.gentleOnly) { cap = "easy"; notes.push("High blood pressure or anaemia in pregnancy: effort is kept easy. Stop if you feel dizzy, breathless or get a headache."); }
  else if (info.cleared == null) notes.push("Ask your doctor or midwife whether exercise is OK and record the answer in Health — until then intensity stays moderate.");
  if (info.symptoms.includes("dizziness") || info.symptoms.includes("breathless")) { cap = "easy"; notes.push("You reported dizziness or breathlessness: today is easy. Tell your doctor if it continues."); }
  return { avoid, cap, notes, readinessCap };
}
