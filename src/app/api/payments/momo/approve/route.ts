import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { revokeAccess } from "@/lib/subscription";
import { settleApproved } from "@/lib/payments";

const schema = z.object({ paymentId: z.string().uuid(), approved: z.boolean(), block: z.boolean().optional(), note: z.string().max(500).optional() });

/** The coach who owns the order (or an admin) confirms a payment: approving unlocks 30 days, rejecting leaves access as it was, and blocking rejects the order and switches the member's access off. */
export async function POST(req: Request) {
  const a = await apiAuth("admin", "coach"); if ("error" in a) return a.error;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid payment decision." }, { status: 400 });
  const row = await prisma.paymentRequest.findUnique({ where: { id: p.data.paymentId } });
  if (!row) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ error: "This payment was already answered." }, { status: 409 });
  const isCoach = a.session.user.role === "coach";
  if (isCoach) {
    if (row.role !== "athlete" || row.coachId !== a.session.user.id) return NextResponse.json({ error: "Payment is not addressed to this coach." }, { status: 403 });
    const rel = await prisma.coachAthleteRelation.findFirst({ where: { coachId: a.session.user.id, athleteId: row.userId, status: { in: ["active", "paused"] } } });
    if (!rel) return NextResponse.json({ error: "This member is no longer connected to you." }, { status: 403 });
  }
  const block = Boolean(p.data.block) && !p.data.approved;
  const updated = await prisma.paymentRequest.update({ where: { id: row.id }, data: { status: p.data.approved ? "approved" : "rejected", approvedById: a.session.user.id, note: p.data.note || (block ? "Rejected — access blocked" : null) } });
  let receipt: string = "not_sent";
  if (p.data.approved) receipt = await settleApproved(updated, a.session.user.id);
  else {
    if (block) await revokeAccess(row.userId);
    await prisma.notification.create({ data: { userId: row.userId, title: block ? "Access blocked" : "Payment rejected", message: block ? "Your payment could not be confirmed and your access was turned off. Contact your coach." : "Your payment could not be confirmed. Check the details and try again.", type: "payment" } });
  }
  return NextResponse.json({ ok: true, payment: updated, receipt });
}
