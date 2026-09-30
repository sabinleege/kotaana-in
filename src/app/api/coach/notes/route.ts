import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

const body = z.object({ athleteId: z.string().uuid(), content: z.string().trim().min(1).max(4000), visibleToAthlete: z.boolean().default(false) });
export async function POST(req: Request) {
  const p = body.safeParse(await readJson(req)); if (!p.success) return bad("Write a note first.");
  const c = await coachApi(p.data.athleteId); if ("error" in c) return c.error;
  const note = await prisma.coachNote.create({ data: { coachId: c.coachId, ...p.data } });
  if (p.data.visibleToAthlete) await prisma.notification.create({ data: { userId: p.data.athleteId, title: "New note from your coach", message: p.data.content.slice(0, 280), type: "coach_note" } });
  return NextResponse.json({ ok: true, note });
}
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const c = await coachApi(); if ("error" in c) return c.error;
  const n = await prisma.coachNote.deleteMany({ where: { id, coachId: c.coachId } });
  return n.count ? NextResponse.json({ ok: true }) : bad("Note not found.", 404);
}
