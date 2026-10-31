import { prisma } from "@/lib/db/prisma";
import { progressOf } from "./recovery";
import { pregnancyStatus, type PregnancyInfo } from "./pregnancy";

const DAY = 86400000;
export type FitnessItem = { id: string; kind: string; title: string; severity: number; percent: number; daysLeft: number; followUpDue: boolean; doctorPrescribed: boolean; onMedication: boolean; source: string | null };
export type FitnessStatus = {
  state: "fit" | "light" | "rest";
  label: string;
  detail: string;
  daysToFit: number | null;
  items: FitnessItem[];
  pregnancy: PregnancyInfo | null;
};

/** Kept for callers that only know the due date; the full dating (last period, scan, details) is in pregnancyStatus. */
export function pregnancyInfo(isPregnant: boolean, due: Date | null | undefined, now = new Date(), details?: unknown) {
  return pregnancyStatus(isPregnant, due, details, now);
}

/** One answer to "am I fit to work out?": from open injuries and illness, how serious they are, how long is left, and pregnancy. */
export async function fitnessStatus(userId: string): Promise<FitnessStatus> {
  const now = new Date();
  const [injuries, profile] = await Promise.all([
    prisma.injury.findMany({ where: { athleteId: userId, status: { in: ["active", "recovering"] } }, orderBy: { dateReported: "desc" } }),
    prisma.profile.findUnique({ where: { userId }, select: { isPregnant: true, pregnancyDueDate: true, pregnancyDetails: true } }),
  ]);
  const items: FitnessItem[] = injuries.map((i) => {
    const p = progressOf(i, now);
    return { id: i.id, kind: i.kind, title: i.kind === "illness" ? i.injuryType : `${i.bodyPart} — ${i.injuryType}`, severity: i.severity, percent: p.percent, daysLeft: p.daysLeft, followUpDue: !i.nextFollowUpAt || i.nextFollowUpAt <= now, doctorPrescribed: i.doctorPrescribed, onMedication: i.onMedication, source: i.estimateSource };
  });
  const preg = pregnancyStatus(Boolean(profile?.isPregnant), profile?.pregnancyDueDate, profile?.pregnancyDetails, now);
  const daysToFit = items.length ? Math.max(...items.map((i) => i.daysLeft)) : null;
  const illnessHeavy = items.some((i) => i.kind === "illness" && i.severity >= 3);
  const injuryHeavy = items.some((i) => i.kind === "injury" && i.severity >= 4);

  if (illnessHeavy || injuryHeavy) return { state: "rest", label: "Rest for now", detail: daysToFit ? `About ${daysToFit} day${daysToFit === 1 ? "" : "s"} to full fitness. Gentle walking and stretching only unless your doctor says otherwise.` : "Rest until you feel better.", daysToFit, items, pregnancy: preg };
  if (items.length) return { state: "light", label: "Train lightly", detail: `Workouts avoid the affected area. About ${daysToFit} day${daysToFit === 1 ? "" : "s"} to full fitness.`, daysToFit, items, pregnancy: preg };
  if (preg?.restOnly || preg?.cleared === false) return { state: "rest", label: "Gentle movement only", detail: "Your pregnancy needs your doctor's go-ahead for more than walking and stretching. Kotaana keeps sessions gentle until you record it in Health.", daysToFit: null, items, pregnancy: preg };
  if (preg) return { state: "light", label: "Pregnancy-safe training", detail: preg.week ? `Week ${preg.week}+${preg.day} · trimester ${preg.trimester}${preg.multiple ? " · twins" : ""}. Workouts avoid impact, crunches and lying flat.` : "Workouts are adjusted for pregnancy. Add your due date for week-by-week guidance.", daysToFit: null, items, pregnancy: preg };
  return { state: "fit", label: "Fit for workout", detail: "No injury or illness on record.", daysToFit: null, items, pregnancy: null };
}
