import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

const create = z.object({ athleteId: z.string().uuid(), bodyPart: z.string().trim().min(2).max(80), injuryType: z.string().trim().min(2).max(120), severity: z.number().int().min(1).max(5), restrictions: z.string().max(500).optional().nullable(), expectedReturn: z.string().date().optional().nullable(), notes: z.string().max(2000).optional().nullable() });
export async function POST(req: Request) {
  const p = create.safeParse(await readJson(req)); if (!p.success) return bad("Enter the body part, injury type and severity.");
  const c = await coachApi(p.data.athleteId); if ("error" in c) return c.error;
  const { expectedReturn, ...rest } = p.data;
  const injury = await prisma.injury.create({ data: { ...rest, status: "active", expectedReturn: expectedReturn ? new Date(`${expectedReturn}T00:00:00Z`) : null } });
  // A coach-recorded injury means the workout engine should treat injury data as known and filter by it.
  await prisma.profile.updateMany({ where: { userId: p.data.athleteId }, data: { injuryDataStatus: "known" } });
  await prisma.notification.create({ data: { userId: p.data.athleteId, title: "Your coach recorded an injury", message: `${p.data.bodyPart} — ${p.data.injuryType} (severity ${p.data.severity}). Your workouts will avoid unsafe movements.`, type: "injury" } });
  return NextResponse.json({ ok: true, injury });
}
const patch = z.object({ id: z.string().uuid(), status: z.enum(["active", "recovering", "resolved"]) });
export async function PATCH(req: Request) {
  const p = patch.safeParse(await readJson(req)); if (!p.success) return bad("Invalid update.");
  const injury = await prisma.injury.findUnique({ where: { id: p.data.id } }); if (!injury) return bad("Injury not found.", 404);
  const c = await coachApi(injury.athleteId); if ("error" in c) return c.error;
  await prisma.injury.update({ where: { id: injury.id }, data: { status: p.data.status, healingPercent: p.data.status === "resolved" ? 100 : injury.healingPercent } });
  return NextResponse.json({ ok: true });
}
