import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { estimateRecovery, followUpInDays } from "@/lib/health/recovery";
import { assessPhoto, MAX_IMAGE_CHARS } from "@/lib/health/photo";
import { fitnessStatus } from "@/lib/health/fitness";

const common = { severity: z.number().int().min(1).max(5), sinceDays: z.number().int().min(0).max(365).default(0), onMedication: z.boolean().default(false), doctorPrescribed: z.boolean().default(false), doctorDays: z.number().int().min(1).max(730).nullable().optional(), image: z.string().max(MAX_IMAGE_CHARS).nullable().optional(), notes: z.string().max(500).optional() };
const body = z.object({
  illness: z.object({ ...common, symptoms: z.array(z.string().max(40)).min(1).max(8), fever: z.boolean().default(false) }).optional(),
  injury: z.object({ ...common, bodyPart: z.string().trim().min(2).max(50), type: z.string().trim().min(2).max(60) }).optional(),
});

/** The "I'm sick" / "I'm injured" cards from the daily check-in: records the problem, estimates how long to full fitness (a doctor's number wins), and schedules the first follow-up. */
export const maxDuration = 60;
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success || (!p.data.illness && !p.data.injury)) return NextResponse.json({ error: "Tell us a little more about what is wrong." }, { status: 400 });
  const userId = a.session.user.id; const out: string[] = []; let seeDoctor = false;

  for (const [kind, d] of [["illness", p.data.illness], ["injury", p.data.injury]] as const) {
    if (!d) continue;
    const type = kind === "illness" ? (p.data.illness!.symptoms.join(", ") + (p.data.illness!.fever ? ", fever" : "")) : p.data.injury!.type;
    const bodyPart = kind === "illness" ? "Whole body" : p.data.injury!.bodyPart;
    const severity = kind === "illness" && p.data.illness!.fever ? Math.max(3, d.severity) : d.severity;
    const photo = d.image && !d.doctorDays ? await assessPhoto(d.image, kind === "illness" ? `a person who feels unwell (${type})` : `an injury: ${type} on the ${bodyPart}`, severity) : null;
    const est = estimateRecovery({ kind, type, severity, doctorDays: d.doctorDays, photoFactor: photo?.factor });
    if (photo?.seeDoctor) seeDoctor = true;
    const days = Math.max(1, est.days - d.sinceDays);
    const row = await prisma.injury.create({ data: {
      athleteId: userId, bodyPart, injuryType: type, severity, status: "active", kind, onMedication: d.onMedication, doctorPrescribed: d.doctorPrescribed, doctorDays: d.doctorDays ?? null,
      estimatedDays: est.days, estimateSource: est.source, dateReported: new Date(Date.now() - d.sinceDays * 86400000), nextFollowUpAt: new Date(Date.now() + followUpInDays(severity) * 86400000), notes: d.notes,
      expectedReturn: new Date(Date.now() + days * 86400000),
    } });
    await prisma.healthUpdate.create({ data: { userId, injuryId: row.id, kind, imageUrl: d.image ?? null, aiNote: photo?.note ?? null, answers: { severity, sinceDays: d.sinceDays, onMedication: d.onMedication, doctorPrescribed: d.doctorPrescribed, doctorDays: d.doctorDays ?? null } as object } });
    const how = est.source === "doctor" ? "your doctor's timeline" : est.source === "photo_ai" ? "an estimate adjusted from your photo" : "an estimate from what you told us";
    out.push(`${kind === "illness" ? "Illness" : "Injury"} noted — about ${days} day${days === 1 ? "" : "s"} to full fitness (${how}).`);
    await prisma.notification.create({ data: { userId, title: kind === "illness" ? "Get well soon" : "Injury recorded", message: `About ${days} day${days === 1 ? "" : "s"} to full fitness. We'll ask how it is going in ${followUpInDays(severity)} days${d.image ? "" : " — a photo helps"}.`, type: "health", data: { injuryId: row.id } } });
  }
  await prisma.profile.update({ where: { userId }, data: { injuryDataStatus: "known" } });
  if (seeDoctor) out.push("The photo shows something worth a professional look — please see a doctor if it is spreading, very swollen or getting worse.");
  return NextResponse.json({ ok: true, messages: out, seeDoctor, fitness: await fitnessStatus(userId), disclaimer: "These are planning estimates, not a diagnosis." });
}
