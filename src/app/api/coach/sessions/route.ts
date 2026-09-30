import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";
import { coachRelations } from "@/lib/coach/data";

const create = z.object({ title: z.string().trim().min(2).max(120), scheduledAt: z.string().min(10), durationMinutes: z.number().int().min(10).max(600).default(60), location: z.string().max(160).optional().nullable(), sessionType: z.enum(["training", "assessment", "recovery", "match", "other"]).default("training"), athleteIds: z.array(z.string().uuid()).max(200).default([]), notes: z.string().max(2000).optional().nullable() });
export async function POST(req: Request) {
  const p = create.safeParse(await readJson(req)); if (!p.success) return bad("Give the session a title and a date/time.");
  const when = new Date(p.data.scheduledAt); if (Number.isNaN(when.getTime())) return bad("Invalid date/time.");
  const c = await coachApi(); if ("error" in c) return c.error;
  const allowed = new Set((await coachRelations(c.coachId, ["active"])).map((r) => r.athleteId));
  const athleteIds = p.data.athleteIds.filter((id) => allowed.has(id));
  const s = await prisma.trainingSession.create({ data: { coachId: c.coachId, ...p.data, athleteIds, scheduledAt: when } });
  if (athleteIds.length) await prisma.notification.createMany({ data: athleteIds.map((userId) => ({ userId, title: `Session scheduled: ${s.title}`, message: `${s.durationMinutes} min${s.location ? ` · ${s.location}` : ""}`, type: "session", data: { sessionId: s.id, scheduledAt: when.toISOString() } })) });
  return NextResponse.json({ ok: true, session: s });
}
const patch = z.object({ id: z.string().uuid(), status: z.enum(["scheduled", "completed", "cancelled"]) });
export async function PATCH(req: Request) {
  const p = patch.safeParse(await readJson(req)); if (!p.success) return bad("Invalid update.");
  const c = await coachApi(); if ("error" in c) return c.error;
  const s = await prisma.trainingSession.findFirst({ where: { id: p.data.id, coachId: c.coachId } }); if (!s) return bad("Session not found.", 404);
  await prisma.trainingSession.update({ where: { id: s.id }, data: { status: p.data.status } });
  if (p.data.status === "cancelled" && s.athleteIds.length) await prisma.notification.createMany({ data: s.athleteIds.map((userId) => ({ userId, title: `Session cancelled: ${s.title}`, message: "Your coach cancelled this session.", type: "session", data: { sessionId: s.id } })) });
  return NextResponse.json({ ok: true });
}
