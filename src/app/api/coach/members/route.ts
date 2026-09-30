import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

// Pausing stops active monitoring (recommendations, sessions) without deleting any history; "ended" removes the athlete from the roster.
const body = z.object({ athleteId: z.string().uuid(), status: z.enum(["active", "paused", "ended"]) });
export async function PATCH(req: Request) {
  const p = body.safeParse(await readJson(req)); if (!p.success) return bad("Invalid update.");
  const c = await coachApi(p.data.athleteId); if ("error" in c) return c.error;
  await prisma.coachAthleteRelation.update({ where: { coachId_athleteId: { coachId: c.coachId, athleteId: p.data.athleteId } }, data: { status: p.data.status } });
  if (p.data.status === "ended") await prisma.notification.create({ data: { userId: p.data.athleteId, title: "Coach connection ended", message: "Your coach removed you from their roster.", type: "connection" } });
  return NextResponse.json({ ok: true });
}
