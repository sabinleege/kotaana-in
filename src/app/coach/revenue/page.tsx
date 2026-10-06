import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { fmtDate } from "@/lib/coach/data";
import { Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import { ProgressChart } from "@/components/charts/ProgressCharts";

export const dynamic = "force-dynamic";
export default async function GymRevenue() {
  const s = await requireRole("coach");
  const paid = await prisma.paymentRequest.findMany({ where: { coachId: s.user.id, role: "athlete", status: "approved" }, include: { user: { select: { name: true, email: true } } }, orderBy: { updatedAt: "desc" } });
  const cur = paid[0]?.currency || "RWF"; const sum = (xs: typeof paid) => xs.reduce((t, p) => t + p.amount, 0);
  const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (5 - i), 1)); const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); return { date: d.toISOString().slice(0, 10), value: sum(paid.filter((p) => p.updatedAt >= d && p.updatedAt < n)) }; });
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="REVENUE" title="Revenue" sub="Approved member payments only." />
    <div className="statGrid"><Stat label="This month" value={`${sum(paid.filter((p) => p.updatedAt >= start)).toLocaleString()} ${cur}`} /><Stat label="All time" value={`${sum(paid).toLocaleString()} ${cur}`} /><Stat label="Payments" value={paid.length} /></div>
    <ProgressChart title="Monthly revenue" subtitle={`Approved payments per month (${cur})`} kind="bar" unit={cur} points={months} empty="No approved payments yet." />
    <div className="solid"><h2 className="sectionTitle">Recent payments</h2><div className="rowList" style={{ marginTop: 10 }}>{paid.slice(0, 20).map((p) => <div className="rowItem" key={p.id}><div><strong>{p.user.name || p.user.email}</strong><div className="small muted">{fmtDate(p.updatedAt)} · {p.payerNumber}</div></div><strong>{p.amount.toLocaleString()} {p.currency}</strong></div>)}{!paid.length && <Empty>No approved payments yet.</Empty>}</div></div>
  </div>;
}
