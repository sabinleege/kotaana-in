import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";

const body = z.object({ number: z.string().trim().min(7).max(30), name: z.string().trim().min(2).max(80), priceRwf: z.number().int().min(100).max(10_000_000) });

/** A coach or gym sets where members pay and the fixed price for 30 days. Athletes cannot change the amount. */
export async function PATCH(req: Request) {
  const a = await apiAuth("coach"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a MoMo number, the account name and a price of at least 100 RWF." }, { status: 400 });
  const profile = await prisma.profile.update({ where: { userId: a.session.user.id }, data: { momoNumber: p.data.number, momoName: p.data.name, membershipPriceRwf: p.data.priceRwf } });
  return NextResponse.json({ ok: true, profile });
}
