import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

const day = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
const body = z.object({ athleteId: z.string().uuid(), present: z.boolean() });
/** Gym marks a member present (or undoes it) for today. */
export async function POST(req: Request) {
  const p = body.safeParse(await readJson(req)); if (!p.success) return bad("Invalid attendance update.");
  const c = await coachApi(p.data.athleteId); if ("error" in c) return c.error;
  const key = { gymId_athleteId_date: { gymId: c.coachId, athleteId: p.data.athleteId, date: day() } };
  if (p.data.present) await prisma.attendance.upsert({ where: key, create: { gymId: c.coachId, athleteId: p.data.athleteId, date: day() }, update: {} });
  else await prisma.attendance.deleteMany({ where: { gymId: c.coachId, athleteId: p.data.athleteId, date: day() } });
  return NextResponse.json({ ok: true });
}
