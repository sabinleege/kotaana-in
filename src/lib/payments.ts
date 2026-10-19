import type { PaymentRequest } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { grantAccess } from "@/lib/subscription";
import { parseCapacityPlan } from "@/lib/coach/capacity";
import { receiptHtml, sendEmail } from "@/lib/email";

/** Everything that follows a confirmed payment, whether a coach/admin confirmed it by hand or MoMo confirmed it automatically:
 * unlock 30 days (or raise the member capacity), tell the payer in the app, and e-mail them a receipt. */
export async function settleApproved(row: PaymentRequest, confirmedById: string | null) {
  const gym = row.planType === "coach_service";
  const capacityTier = parseCapacityPlan(row.planType);
  if (capacityTier) await prisma.profile.update({ where: { userId: row.userId }, data: { memberCapacity: capacityTier, capacityUntil: new Date(Date.now() + 30 * 86400000) } });
  else await grantAccess({ userId: row.userId, source: gym ? "gym" : "direct", grantedById: confirmedById, planType: gym ? "gym_member" : row.planType });
  await prisma.notification.create({ data: { userId: row.userId, title: "Payment confirmed", message: capacityTier ? `Your upgrade was confirmed — you can now look after up to ${capacityTier} members for 30 days. A receipt was sent to your e-mail.` : "Your payment was confirmed — access is active for 30 days. A receipt was sent to your e-mail.", type: "payment", data: { paymentId: row.id } } });

  const [payer, confirmer, payee] = await Promise.all([
    prisma.user.findUnique({ where: { id: row.userId }, select: { email: true, name: true, profile: { select: { fullName: true, receiptEmails: true } } } }),
    confirmedById ? prisma.user.findUnique({ where: { id: confirmedById }, select: { name: true, profile: { select: { fullName: true } } } }) : Promise.resolve(null),
    row.coachId ? prisma.user.findUnique({ where: { id: row.coachId }, select: { name: true, profile: { select: { fullName: true } } } }) : Promise.resolve(null),
  ]);
  if (!payer?.email || payer.profile?.receiptEmails === false) return "not_sent" as const;
  const item = capacityTier ? `Member capacity up to ${capacityTier} members (30 days)` : gym ? "Gym membership (30 days)" : row.planType === "coach_plan" ? "Kotaana coach plan (30 days)" : "Kotaana subscription (30 days)";
  const until = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-GB", { dateStyle: "long" });
  const ok = await sendEmail(payer.email, "Your Kotaana payment receipt", receiptHtml({
    number: "KT-" + row.id.slice(0, 8).toUpperCase(), payerName: payer.profile?.fullName || payer.name || "there", item, amount: row.amount, currency: row.currency,
    paidFrom: `${row.payerName} · ${row.payerNumber}`, paidTo: gym ? payee?.profile?.fullName || payee?.name || "Your coach" : "Kotaana",
    confirmedBy: confirmer ? confirmer.profile?.fullName || confirmer.name || "Kotaana" : "MoMo (automatic)", date: new Date(),
    benefit: capacityTier ? `Room for ${capacityTier} members until ${until}` : `Full access until ${until}`,
  }));
  return ok ? ("sent" as const) : ("email_unavailable" as const);
}
