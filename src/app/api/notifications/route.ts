import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

export async function GET() {
  const a = await apiAuth(); if ("error" in a) return a.error;
  const items = await prisma.notification.findMany({ where: { userId: a.session.user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ notifications: items });
}
const body = z.object({ markAllRead: z.literal(true) }).or(z.object({ id: z.string().uuid(), read: z.boolean() }));
export async function PATCH(req: Request) {
  const a = await apiAuth(); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  if ("markAllRead" in p.data) await prisma.notification.updateMany({ where: { userId: a.session.user.id, read: false }, data: { read: true } });
  else await prisma.notification.updateMany({ where: { id: p.data.id, userId: a.session.user.id }, data: { read: p.data.read } });
  return NextResponse.json({ ok: true });
}
