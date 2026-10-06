import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { MAX_ACCESS_DAYS, grantAccess, revokeAccess } from "@/lib/subscription";

const grant = z.object({ action: z.literal("grant"), userId: z.string().uuid(), days: z.number().int().min(1).max(MAX_ACCESS_DAYS).default(MAX_ACCESS_DAYS) });
const revoke = z.object({ action: z.literal("revoke"), userId: z.string().uuid() });
const price = z.object({ action: z.literal("price"), usd: z.number().positive().max(1000), rate: z.number().positive().max(100000) });
const body = z.discriminatedUnion("action", [grant, revoke, price]);

/** Admin has total control: grant (max 30 days), revoke, and set the price. */
export async function POST(req: Request) {
  const a = await apiAuth("admin"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: `Access can be granted for 1 to ${MAX_ACCESS_DAYS} days only.` }, { status: 400 });
  if (p.data.action === "price") {
    await prisma.$transaction([
      prisma.appConfig.upsert({ where: { key: "price_usd" }, create: { key: "price_usd", value: String(p.data.usd) }, update: { value: String(p.data.usd) } }),
      prisma.appConfig.upsert({ where: { key: "usd_to_rwf" }, create: { key: "usd_to_rwf", value: String(p.data.rate) }, update: { value: String(p.data.rate) } }),
    ]);
  } else if (p.data.action === "grant") {
    await grantAccess({ userId: p.data.userId, source: "admin", grantedById: a.session.user.id, days: p.data.days, planType: "admin_grant" });
    await prisma.notification.create({ data: { userId: p.data.userId, title: "Access granted", message: `Kotaana access is active for ${p.data.days} day(s).`, type: "payment" } });
  } else await revokeAccess(p.data.userId);
  return NextResponse.json({ ok: true });
}
