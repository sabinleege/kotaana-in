import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachPremium } from "@/lib/coach/premium";

/** Athletes find a coach or gym by name. Results carry the coach's fixed 30-day price and MoMo details. */
export async function GET(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const coaches = await prisma.user.findMany({
    where: { role: "coach", OR: [{ name: { contains: q, mode: "insensitive" } }, { profile: { fullName: { contains: q, mode: "insensitive" } } }] },
    select: { id: true, name: true, profile: { select: { fullName: true, avatarUrl: true, locationCity: true, membershipPriceRwf: true, momoNumber: true, momoName: true } } },
    take: 20,
  });
  const payable = await Promise.all(coaches.map((c) => coachPremium(c.id)));
  return NextResponse.json({ results: coaches.map((c, i) => ({ payable: payable[i], id: c.id, name: c.profile?.fullName || c.name || "Coach", avatar: c.profile?.avatarUrl || null, city: c.profile?.locationCity || null, priceRwf: c.profile?.membershipPriceRwf ?? null, momoNumber: c.profile?.momoNumber || null, momoName: c.profile?.momoName || null })) });
}
