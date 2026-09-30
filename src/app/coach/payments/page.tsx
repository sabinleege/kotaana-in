import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { fmtDate } from "@/lib/coach/data";
import PaymentApprovals from "@/components/PaymentApprovals";
import { Empty } from "@/components/coach/CoachUI";

export const dynamic = "force-dynamic";
export default async function CoachPayments() {
  const s = await requireRole("coach");
  const [pending, history] = await Promise.all([
    prisma.paymentRequest.findMany({ where: { role: "athlete", status: "pending", coachId: s.user.id }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.paymentRequest.findMany({ where: { role: "athlete", coachId: s.user.id, status: { not: "pending" } }, include: { user: { select: { name: true, email: true } } }, orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);
  return <div className="stack" style={{ gap: 14 }}>
    <PaymentApprovals rows={pending} back="/coach" />
    <div className="solid"><h2 className="sectionTitle">History</h2><div className="rowList" style={{ marginTop: 10 }}>{history.map((p) => <div className="rowItem" key={p.id}><div><strong>{p.user.name || p.user.email}</strong><div className="small muted">{p.currency} {p.amount.toLocaleString()} · {fmtDate(p.updatedAt)}</div></div><span className={`prio ${p.status === "approved" ? "low" : "high"}`}>{p.status}</span></div>)}{!history.length && <Empty>No approved or rejected payments yet.</Empty>}</div></div>
  </div>;
}
