import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { fmtDate } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { PlatformPayForm } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachSubscription() {
  const s = await requireRole("coach");
  const [config, payments] = await Promise.all([
    prisma.appConfig.findUnique({ where: { key: "platform_momo_code" } }),
    prisma.paymentRequest.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const code = config?.value || process.env.KOTAANA_PLATFORM_MOMO_CODE || null;
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SUBSCRIPTION" title="Coach plan — MoMo" sub="Pay Kotaana for your coach plan. An admin confirms the payment once it arrives." />
    <div className="solid">{code ? <>
      <p style={{ marginTop: 0 }}>Send the payment to Kotaana MoMo code <code className="inviteCode">{code}</code>, then record it below.</p>
      <PlatformPayForm />
    </> : <Empty>Kotaana has not set its MoMo payment code yet. An admin can set it in the admin area — until then, coach plan payments can't be recorded.</Empty>}</div>
    <div className="solid"><h2 className="sectionTitle">Your payments</h2><div className="rowList" style={{ marginTop: 10 }}>{payments.map((p) => <div className="rowItem" key={p.id}><div><strong>{p.currency} {p.amount.toLocaleString()}</strong><div className="small muted">{p.planType.replace("_", " ")} · {fmtDate(p.createdAt)} · from {p.payerNumber}</div></div><span className={`prio ${p.status === "approved" ? "low" : p.status === "pending" ? "normal" : "high"}`}>{p.status}</span></div>)}{!payments.length && <Empty>No payments yet.</Empty>}</div></div>
  </div>;
}
