import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { fmtDate } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { SubscribePanel } from "@/components/billing/BillingForms";
import { SOURCE_LABEL, accessState, getPlatformCode, getPricing } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export default async function CoachSubscription() {
  const s = await requireRole("coach");
  const [sub, price, code, pending, payments] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: s.user.id } }), getPricing(), getPlatformCode(),
    prisma.paymentRequest.findFirst({ where: { userId: s.user.id, status: "pending", planType: "coach_plan" } }),
    prisma.paymentRequest.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const st = accessState(sub);
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SUBSCRIPTION" title="Coach plan — MoMo" sub="$10 per 30 days. An admin confirms your payment once it arrives." />
    <div className="solid">{st.active ? <><span className="prio low">active</span> <strong>{st.daysLeft} day(s) left</strong><div className="small muted">Until {st.expiresAt!.toLocaleDateString("en-GB", { dateStyle: "long" })} · {SOURCE_LABEL[st.source || ""] || "Active"}</div></> : <><span className="prio high">inactive</span> <span className="small muted">Subscribe to keep your gym portal active.</span></>}</div>
    <SubscribePanel planType="coach_plan" rwf={price.rwf} usd={price.usd} code={code} pending={Boolean(pending)} />
    <div className="solid"><h2 className="sectionTitle">Your payments</h2><div className="rowList" style={{ marginTop: 10 }}>{payments.map((p) => <div className="rowItem" key={p.id}><div><strong>{p.currency} {p.amount.toLocaleString()}</strong><div className="small muted">{p.planType.replace("_", " ")} · {fmtDate(p.createdAt)} · from {p.payerNumber}</div></div><span className={`prio ${p.status === "approved" ? "low" : p.status === "pending" ? "normal" : "high"}`}>{p.status}</span></div>)}{!payments.length && <Empty>No payments yet.</Empty>}</div></div>
  </div>;
}
