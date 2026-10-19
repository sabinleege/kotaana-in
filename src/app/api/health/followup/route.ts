import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { adjustForTrend, followUpInDays, progressOf } from "@/lib/health/recovery";
import { assessPhoto, MAX_IMAGE_CHARS } from "@/lib/health/photo";
import { fitnessStatus } from "@/lib/health/fitness";

const body = z.object({
  injuryId: z.string().uuid(),
  trend: z.enum(["better", "same", "worse"]),
  pain: z.number().int().min(0).max(10),
  onMedication: z.boolean().optional(),
  doctorDays: z.number().int().min(1).max(730).nullable().optional(),
  resolved: z.boolean().optional(),
  image: z.string().max(MAX_IMAGE_CHARS).nullable().optional(),
  note: z.string().max(500).optional(),
});

/** Items whose follow-up is due (every 3–7 days depending on how serious they are). */
export const maxDuration = 60;
export async function GET() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const f = await fitnessStatus(a.session.user.id);
  return NextResponse.json({ due: f.items.filter((i) => i.followUpDue), fitness: f });
}

/** The athlete reports how an injury or illness is going. The estimate and the days left are updated; a photo is optional but helps. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Answer how it is going and your pain level." }, { status: 400 });
  const userId = a.session.user.id; const d = p.data;
  const inj = await prisma.injury.findUnique({ where: { id: d.injuryId } });
  if (!inj || inj.athleteId !== userId) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const now = new Date();
  const elapsed = Math.max(0, Math.floor((now.getTime() - inj.dateReported.getTime()) / 86400000));
  const photo = d.image && !d.doctorDays ? await assessPhoto(d.image, inj.kind === "illness" ? `a person recovering from ${inj.injuryType}` : `a healing injury: ${inj.injuryType} on the ${inj.bodyPart}`, inj.severity) : null;

  let est = inj.estimatedDays ?? progressOf(inj, now).daysLeft + elapsed;
  let source = inj.estimateSource;
  if (d.doctorDays) { est = elapsed + d.doctorDays; source = "doctor"; }
  else { est = adjustForTrend(est, elapsed, d.trend); if (photo) { est = Math.max(elapsed + 1, Math.round(elapsed + (est - elapsed) * photo.factor)); source = "photo_ai"; } }
  const resolved = Boolean(d.resolved) || (d.trend === "better" && d.pain === 0 && elapsed >= Math.ceil((inj.estimatedDays ?? est) * 0.6));
  const percent = resolved ? 100 : Math.max(0, Math.min(99, Math.round((elapsed / Math.max(1, est)) * 100) + (d.trend === "better" ? 5 : d.trend === "worse" ? -10 : 0)));
  const updated = await prisma.injury.update({ where: { id: inj.id }, data: {
    estimatedDays: est, estimateSource: source, healingPercent: percent, status: resolved ? "resolved" : d.trend === "better" || d.pain <= 2 ? "recovering" : "active",
    onMedication: d.onMedication ?? inj.onMedication, doctorDays: d.doctorDays ?? inj.doctorDays, doctorPrescribed: d.doctorDays ? true : inj.doctorPrescribed,
    nextFollowUpAt: resolved ? null : new Date(now.getTime() + followUpInDays(inj.severity, d.trend) * 86400000), expectedReturn: new Date(now.getTime() + Math.max(0, est - elapsed) * 86400000),
  } });
  await prisma.healthUpdate.create({ data: { userId, injuryId: inj.id, kind: inj.kind, trend: d.trend, pain: d.pain, healingPercent: percent, imageUrl: d.image ?? null, aiNote: photo?.note ?? null, answers: { onMedication: d.onMedication ?? null, doctorDays: d.doctorDays ?? null, note: d.note ?? null } as object } });

  const left = progressOf(updated, now).daysLeft;
  const messages = [resolved ? "Great news — marked as recovered. Your workouts will open back up." : `Thanks. About ${left} day${left === 1 ? "" : "s"} to full fitness (${percent}% there).`];
  if (photo?.note) messages.push(photo.note);
  if (d.trend === "worse" && inj.severity >= 3 || photo?.seeDoctor) messages.push("It's getting worse or looks concerning — please get it checked by a doctor.");
  return NextResponse.json({ ok: true, messages, injury: updated, fitness: await fitnessStatus(userId) });
}
