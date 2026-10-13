/** Recovery estimates for injuries and illness. These are planning estimates — never a diagnosis. A doctor's own timeline always wins. */

const DAY = 86400000;
export type Kind = "injury" | "illness";
export type Estimate = { days: number; source: "doctor" | "photo_ai" | "rule" };

const INJURY_BASE = [0, 5, 12, 28, 56, 90]; // by severity 1-5
const ILLNESS_BASE = [0, 2, 4, 7, 10, 14];

function typeFactor(kind: Kind, text: string) {
  const t = text.toLowerCase();
  if (kind === "illness") {
    if (/flu|influenza|covid|malaria|typhoid|pneumonia/.test(t)) return 1.6;
    if (/stomach|vomit|diarr|food/.test(t)) return 0.8;
    if (/cold|cough|throat|headache/.test(t)) return 1;
    return 1;
  }
  if (/fracture|broken|break/.test(t)) return 2.2;
  if (/dislocat/.test(t)) return 1.8;
  if (/tendon|ligament|tear|rupture|acl/.test(t)) return 1.7;
  if (/sprain|strain|pull|muscle/.test(t)) return 1;
  if (/wound|cut|burn|scrape|stitch/.test(t)) return 0.9;
  if (/bruise|contusion|knock/.test(t)) return 0.6;
  return 1;
}

/** photoFactor (0.7–1.4) comes from the photo check: below 1 means it looks better than the severity suggests. */
export function estimateRecovery(o: { kind: Kind; type: string; severity: number; doctorDays?: number | null; photoFactor?: number | null }): Estimate {
  if (o.doctorDays && o.doctorDays > 0) return { days: Math.round(o.doctorDays), source: "doctor" };
  const sev = Math.max(1, Math.min(5, Math.round(o.severity)));
  const base = (o.kind === "illness" ? ILLNESS_BASE : INJURY_BASE)[sev] * typeFactor(o.kind, o.type);
  const pf = o.photoFactor ? Math.max(0.7, Math.min(1.4, o.photoFactor)) : 1;
  return { days: Math.max(1, Math.round(base * pf)), source: o.photoFactor ? "photo_ai" : "rule" };
}

type Rec = { status: string; dateReported: Date; estimatedDays: number | null; healingPercent: number | null; severity: number; kind: string; bodyPart: string; injuryType: string; nextFollowUpAt: Date | null; doctorPrescribed: boolean; onMedication: boolean };

/** Estimated progress (0–100) and days left. Uses the latest healing percentage when the athlete has reported one, otherwise time elapsed. */
export function progressOf(i: Rec, now = new Date()) {
  if (i.status === "resolved") return { percent: 100, daysLeft: 0 };
  const total = i.estimatedDays ?? (i.kind === "illness" ? ILLNESS_BASE[Math.max(1, Math.min(5, i.severity))] : INJURY_BASE[Math.max(1, Math.min(5, i.severity))]);
  const elapsed = Math.max(0, Math.floor((now.getTime() - i.dateReported.getTime()) / DAY));
  const byTime = Math.min(95, Math.round((elapsed / Math.max(1, total)) * 100));
  const percent = i.healingPercent != null && i.healingPercent > 0 ? Math.max(i.healingPercent, 0) : byTime;
  const daysLeft = i.healingPercent != null && i.healingPercent > 0 ? Math.max(0, Math.ceil(total * (1 - percent / 100))) : Math.max(0, total - elapsed);
  return { percent: Math.min(100, percent), daysLeft };
}

/** How the athlete says it is going moves the estimate: better shortens it, worse lengthens it. */
export function adjustForTrend(estimatedDays: number, elapsedDays: number, trend: "better" | "same" | "worse") {
  const remaining = Math.max(1, estimatedDays - elapsedDays);
  const next = trend === "better" ? remaining * 0.8 : trend === "worse" ? remaining * 1.3 + 2 : remaining;
  return Math.max(1, Math.round(elapsedDays + next));
}

/** Days until the next follow-up question and photo: sooner when it is getting worse or is serious. */
export function followUpInDays(severity: number, trend?: "better" | "same" | "worse" | null) {
  if (trend === "worse" || severity >= 4) return 3;
  if (severity === 3) return 5;
  return 7;
}
