import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const GLASS_ML = 300;
const MAX_GLASSES = 30;
// The client sends its local calendar day so the counter resets at the athlete's midnight, not UTC's.
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const utcToday = () => new Date().toISOString().slice(0, 10);

async function state(userId: string, day: string) {
  const [log, profile] = await Promise.all([
    prisma.hydrationLog.findUnique({ where: { userId_date: { userId, date: toDate(day) } } }),
    prisma.profile.findUnique({ where: { userId }, select: { waterTargetMl: true } }),
  ]);
  const targetMl = log?.targetMl ?? profile?.waterTargetMl ?? 2500;
  const glasses = log?.glasses ?? 0;
  return { day, glasses, glassMl: log?.glassMl ?? GLASS_ML, consumedMl: glasses * (log?.glassMl ?? GLASS_ML), targetMl, targetGlasses: Math.ceil(targetMl / GLASS_ML) };
}

export async function GET(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const parsed = dayKey.safeParse(new URL(req.url).searchParams.get("day") ?? utcToday());
  if (!parsed.success) return NextResponse.json({ error: "Invalid day." }, { status: 400 });
  return NextResponse.json(await state(a.session.user.id, parsed.data));
}

const body = z.object({ day: dayKey, delta: z.number().int().min(-1).max(1) });
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid hydration update." }, { status: 400 });
  const userId = a.session.user.id; const { day, delta } = p.data;
  const current = await state(userId, day);
  const glasses = Math.max(0, Math.min(MAX_GLASSES, current.glasses + delta));
  await prisma.hydrationLog.upsert({
    where: { userId_date: { userId, date: toDate(day) } },
    create: { userId, date: toDate(day), glasses, glassMl: GLASS_ML, targetMl: current.targetMl },
    update: { glasses },
  });
  return NextResponse.json(await state(userId, day));
}
