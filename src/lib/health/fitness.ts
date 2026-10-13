import { prisma } from "@/lib/db/prisma";
import { progressOf } from "./recovery";

const DAY = 86400000;
export type FitnessItem = { id: string; kind: string; title: string; severity: number; percent: number; daysLeft: number; followUpDue: boolean; doctorPrescribed: boolean; onMedication: boolean; source: string | null };
export type FitnessStatus = {
  state: "fit" | "light" | "rest";
  label: string;
  detail: string;
  daysToFit: number | null;
  items: FitnessItem[];
  pregnancy: { week: number | null; trimester: number | null; daysToDue: number | null } | null;
};

export function pregnancyInfo(isPregnant: boolean, due: Date | null | undefined, now = new Date()) {
  if (!isPregnant) return null;
  if (!due) return { week: null, trimester: null, daysToDue: null };
  const daysToDue = Math.ceil((due.getTime() - now.getTime()) / DAY);
  const week = Math.max(1, Math.min(42, 40 - Math.ceil(daysToDue / 7)));
  return { week, trimester: week <= 13 ? 1 : week <= 27 ? 2 : 3, daysToDue };
}

/** One answer to "am I fit to work out?": from open injuries and illness, how serious they are, how long is left, and pregnancy. */
export async function fitnessStatus(userId: string): Promise<FitnessStatus> {
  const now = new Date();
  const [injuries, profile] = await Promise.all([
    prisma.injury.findMany({ where: { athleteId: userId, status: { in: ["active", "recovering"] } }, orderBy: { dateReported: "desc" } }),
    prisma.profile.findUnique({ where: { userId }, select: { isPregnant: true, pregnancyDueDate: true } }),
  ]);
  const items: FitnessItem[] = injuries.map((i) => {
    const p = progressOf(i, now);
    return { id: i.id, kind: i.kind, title: i.kind === "illness" ? i.injuryType : `${i.bodyPart} — ${i.injuryType}`, severity: i.severity, percent: p.percent, daysLeft: p.daysLeft, followUpDue: !i.nextFollowUpAt || i.nextFollowUpAt <= now, doctorPrescribed: i.doctorPrescribed, onMedication: i.onMedication, source: i.estimateSource };
  });
  const preg = pregnancyInfo(Boolean(profile?.isPregnant), profile?.pregnancyDueDate, now);
  const daysToFit = items.length ? Math.max(...items.map((i) => i.daysLeft)) : null;
  const illnessHeavy = items.some((i) => i.kind === "illness" && i.severity >= 3);
  const injuryHeavy = items.some((i) => i.kind === "injury" && i.severity >= 4);

  if (illnessHeavy || injuryHeavy) return { state: "rest", label: "Rest for now", detail: daysToFit ? `About ${daysToFit} day${daysToFit === 1 ? "" : "s"} to full fitness. Gentle walking and stretching only unless your doctor says otherwise.` : "Rest until you feel better.", daysToFit, items, pregnancy: preg };
  if (items.length) return { state: "light", label: "Train lightly", detail: `Workouts avoid the affected area. About ${daysToFit} day${daysToFit === 1 ? "" : "s"} to full fitness.`, daysToFit, items, pregnancy: preg };
  if (preg) return { state: "light", label: "Pregnancy-safe training", detail: preg.week ? `Week ${preg.week} · trimester ${preg.trimester}. Workouts avoid impact, crunches and lying flat.` : "Workouts are adjusted for pregnancy. Add your due date for week-by-week guidance.", daysToFit: null, items, pregnancy: preg };
  return { state: "fit", label: "Fit for workout", detail: "No injury or illness on record.", daysToFit: null, items, pregnancy: null };
}
