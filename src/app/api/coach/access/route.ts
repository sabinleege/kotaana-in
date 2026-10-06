import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";
import { grantAccess, revokeAccess } from "@/lib/subscription";

const body = z.object({ athleteId: z.string().uuid(), action: z.enum(["grant", "revoke"]) });
/** A gym gives one of its members 30 days of access without waiting for a payment request. */
export async function POST(req: Request) {
  const p = body.safeParse(await readJson(req)); if (!p.success) return bad("Invalid request.");
  const c = await coachApi(p.data.athleteId); if ("error" in c) return c.error;
  if (p.data.action === "grant") {
    await grantAccess({ userId: p.data.athleteId, source: "gym", grantedById: c.coachId, planType: "gym_member" });
    // A pending payment from this member is settled by the grant, so it leaves the approval list.
    await prisma.paymentRequest.updateMany({ where: { userId: p.data.athleteId, coachId: c.coachId, status: "pending" }, data: { status: "approved", approvedById: c.coachId, note: "Settled by direct access grant" } });
    await prisma.notification.create({ data: { userId: p.data.athleteId, title: "Access granted", message: "Your gym gave you 30 days of Kotaana access.", type: "payment" } });
  } else {
    const sub = await prisma.subscription.findUnique({ where: { userId: p.data.athleteId } });
    if (sub?.grantedById !== c.coachId) return bad("You can only revoke access you granted.", 403);
    await revokeAccess(p.data.athleteId);
  }
  return NextResponse.json({ ok: true });
}
