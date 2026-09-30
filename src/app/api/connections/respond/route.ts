import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const body = z.object({ relationId: z.string().uuid(), accept: z.boolean() });
/** Athlete accepts or declines a connection request that a coach sent. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const rel = await prisma.coachAthleteRelation.findUnique({ where: { id: p.data.relationId } });
  if (!rel || rel.athleteId !== a.session.user.id || rel.status !== "pending" || rel.requestedByRole !== "coach") return NextResponse.json({ error: "Request not found or already answered." }, { status: 404 });
  await prisma.coachAthleteRelation.update({ where: { id: rel.id }, data: { status: p.data.accept ? "active" : "ended" } });
  await prisma.notification.create({ data: { userId: rel.coachId, title: p.data.accept ? "Athlete accepted your request" : "Athlete declined your request", message: `${a.session.user.name || a.session.user.email} ${p.data.accept ? "joined" : "declined to join"} your roster.`, type: "connection" } });
  return NextResponse.json({ ok: true });
}
