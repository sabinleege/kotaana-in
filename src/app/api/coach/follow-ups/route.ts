import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

const create = z.object({ athleteId: z.string().uuid(), title: z.string().trim().min(2).max(160), description: z.string().max(4000).optional().nullable(), dueDate: z.string().date().optional().nullable(), priority: z.enum(["low", "normal", "high"]).default("normal"), notifyAthlete: z.boolean().default(true) });
export async function POST(req: Request) {
  const p = create.safeParse(await readJson(req)); if (!p.success) return bad("Choose an athlete and give the follow-up a title.");
  const c = await coachApi(p.data.athleteId); if ("error" in c) return c.error;
  const { notifyAthlete, dueDate, ...rest } = p.data;
  const f = await prisma.followUp.create({ data: { coachId: c.coachId, ...rest, dueDate: dueDate ? new Date(`${dueDate}T00:00:00Z`) : null } });
  if (notifyAthlete) await prisma.notification.create({ data: { userId: p.data.athleteId, title: `Coach follow-up: ${p.data.title}`, message: p.data.description || "Your coach added a follow-up for you.", type: "follow_up", data: { followUpId: f.id } } });
  return NextResponse.json({ ok: true, followUp: f });
}
const patch = z.object({ id: z.string().uuid(), status: z.enum(["pending", "done", "cancelled"]) });
export async function PATCH(req: Request) {
  const p = patch.safeParse(await readJson(req)); if (!p.success) return bad("Invalid update.");
  const c = await coachApi(); if ("error" in c) return c.error;
  const n = await prisma.followUp.updateMany({ where: { id: p.data.id, coachId: c.coachId }, data: { status: p.data.status } });
  return n.count ? NextResponse.json({ ok: true }) : bad("Follow-up not found.", 404);
}
