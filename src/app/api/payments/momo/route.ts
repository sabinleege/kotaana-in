import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { getPricing } from "@/lib/subscription";
import { initiateMomo, getMomoStatus } from "@/lib/momo/provider";
import { capacityState, parseCapacityPlan } from "@/lib/coach/capacity";

const schema = z.object({
  amount: z.number().int().min(100).max(10_000_000).optional(),
  payerNumber: z.string().min(7).max(30),
  payerName: z.string().min(2).max(80),
  planType: z.string().min(2).max(80),
  coachId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(16).max(120),
});

/** Records a MoMo payment order. The amount is never taken from the client: platform plans use the platform price and coach memberships use the price the coach set. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete", "coach"); if ("error" in a) return a.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  const userId = a.session.user.id;
  const d = p.data;

  const pending = await prisma.paymentRequest.findFirst({ where: { userId, status: "pending", planType: d.planType, coachId: d.coachId ?? null } });
  if (pending) return NextResponse.json({ ok: true, payment: pending, message: "You already have a pending payment — wait for it to be confirmed." });
  const existing = await prisma.paymentRequest.findUnique({ where: { idempotencyKey: d.idempotencyKey } });
  if (existing && existing.userId === userId) return NextResponse.json({ ok: true, payment: existing, replayed: true });

  if (d.planType === "coach_service" && a.session.user.role === "athlete" && !d.coachId) return NextResponse.json({ error: "Choose a coach before paying for a membership." }, { status: 400 });
  const coach = d.coachId ? await prisma.user.findUnique({ where: { id: d.coachId }, select: { role: true, profile: { select: { momoNumber: true, membershipPriceRwf: true } } } }) : null;
  if (d.coachId && (!coach || coach.role !== "coach")) return NextResponse.json({ error: "Selected coach was not found." }, { status: 404 });

  let amount: number;
  if (d.planType === "coach_service") {
    amount = coach?.profile?.membershipPriceRwf ?? 0;
    if (!amount) return NextResponse.json({ error: "This coach has not set a membership price yet." }, { status: 409 });
    const rel = await prisma.coachAthleteRelation.findFirst({ where: { coachId: d.coachId!, athleteId: userId, status: { in: ["active", "paused"] } }, select: { id: true } });
    if (!rel) return NextResponse.json({ error: "Choose this coach first, then pay for your membership." }, { status: 403 });
  } else if (parseCapacityPlan(d.planType) != null) {
    // A coach, gym or club paying to hold more than 70 members. Only the next tier above their current capacity can be bought.
    if (a.session.user.role !== "coach") return NextResponse.json({ error: "Only coaches can buy member capacity." }, { status: 403 });
    const st = await capacityState(userId);
    if (parseCapacityPlan(d.planType) !== st.nextTier.max) return NextResponse.json({ error: `The next upgrade is ${st.nextTier.max} members.` }, { status: 409 });
    amount = Math.round(st.nextTier.usd * (await getPricing()).rate);
  } else if (d.planType === "direct" || d.planType === "coach_plan") {
    amount = (await getPricing()).rwf;
  } else if (d.amount) amount = d.amount;
  else return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });

  const platformCode = coach ? null : (await prisma.appConfig.findUnique({ where: { key: "platform_momo_code" } }))?.value;
  const code = coach?.profile?.momoNumber || (typeof platformCode === "string" ? platformCode : null) || process.env.KOTAANA_PLATFORM_MOMO_CODE;
  if (!code) return NextResponse.json({ error: "Payment destination is not configured." }, { status: 503 });

  const row = await prisma.paymentRequest.create({ data: { userId, role: a.session.user.role, coachId: d.coachId || null, planType: d.planType, amount, currency: process.env.MOMO_CURRENCY || "RWF", payerNumber: d.payerNumber, payerName: d.payerName, payToCode: code, status: "pending", idempotencyKey: d.idempotencyKey } });
  if (d.coachId) {
    const me = await prisma.profile.findUnique({ where: { userId }, select: { fullName: true } });
    await prisma.notification.create({ data: { userId: d.coachId, title: "Payment order waiting", message: `${me?.fullName || "A member"} says they paid ${amount.toLocaleString()} ${process.env.MOMO_CURRENCY || "RWF"}. Confirm it once the money arrives.`, type: "payment" } });
  }

  const live = ["MOMO_SUBSCRIPTION_KEY", "MOMO_API_USER", "MOMO_API_KEY"].every((k) => process.env[k]);
  if (!live) return NextResponse.json({ ok: true, payment: row, message: d.coachId ? "Order sent. Your coach sees it as pending and unlocks 30 days once they confirm your payment." : "Payment order recorded for confirmation." });
  try {
    const momo = await initiateMomo({ amount, payerNumber: d.payerNumber, payerName: d.payerName, externalId: row.id });
    const saved = await prisma.paymentRequest.update({ where: { id: row.id }, data: { providerReference: momo.reference } });
    return NextResponse.json({ ok: true, payment: saved });
  } catch (e) {
    await prisma.paymentRequest.update({ where: { id: row.id }, data: { note: e instanceof Error ? e.message : "MoMo unavailable" } });
    return NextResponse.json({ ok: false, error: "Live payment initiation failed. No successful payment was recorded.", paymentId: row.id }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const a = await apiAuth("athlete", "coach", "admin"); if ("error" in a) return a.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const row = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (a.session.user.role === "athlete" && row.userId !== a.session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (a.session.user.role === "coach" && row.coachId !== a.session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (row.providerReference) { try { return NextResponse.json({ payment: row, momo: await getMomoStatus(row.providerReference) }); } catch {} }
  return NextResponse.json({ payment: row });
}
