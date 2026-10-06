import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachRelations, fmtDate } from "@/lib/coach/data";
import { Avatar, Empty, PageHead, Stat } from "@/components/coach/CoachUI";

export const dynamic = "force-dynamic";
const PERIOD_DAYS = 30; // every approved payment buys exactly 30 days of access
export default async function GymMemberships() {
  const s = await requireRole("coach"); const gymId = s.user.id;
  const [rels, payments] = await Promise.all([coachRelations(gymId, ["active", "paused"]), prisma.paymentRequest.findMany({ where: { coachId: gymId, role: "athlete" }, orderBy: { createdAt: "desc" } })]);
  const now = Date.now();
  const rows = rels.map((r) => {
    const mine = payments.filter((p) => p.userId === r.athleteId);
    const last = mine.find((p) => p.status === "approved");
    const until = last ? new Date(last.updatedAt.getTime() + PERIOD_DAYS * 86400000) : null;
    const status = r.status === "paused" ? "paused" : until && until.getTime() > now ? "active" : until ? "expired" : "unpaid";
    return { r, until, status, pending: mine.filter((p) => p.status === "pending").length };
  });
  const count = (st: string) => rows.filter((x) => x.status === st).length;
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="MEMBERSHIPS" title="Memberships" sub={`Each approved payment covers ${PERIOD_DAYS} days. Approve incoming MoMo payments to extend a member.`}><Link className="btn primary" href="/coach/payments">Payment approvals</Link><Link className="btn secondary" href="/coach/members">Manage members</Link></PageHead>
    <div className="statGrid"><Stat label="Active" value={count("active")} /><Stat label="Expired" value={count("expired")} warn={count("expired") > 0} /><Stat label="Unpaid" value={count("unpaid")} /><Stat label="Pending payments" value={payments.filter((p) => p.status === "pending").length} warn={payments.some((p) => p.status === "pending")} /></div>
    <div className="solid tableWrap">{rows.length ? <table className="dataTable"><thead><tr><th>Member</th><th>Status</th><th>Paid through</th><th>Pending</th></tr></thead><tbody>{rows.map(({ r, until, status, pending }) => { const n = r.athlete.profile?.fullName || r.athlete.name || r.athlete.email; return <tr key={r.id}><td><div className="row"><Avatar name={n} src={r.athlete.profile?.avatarUrl} size={32} /><Link href={`/coach/athletes/${r.athleteId}`} style={{ fontWeight: 700 }}>{n}</Link></div></td><td><span className={`prio ${status === "active" ? "low" : status === "paused" ? "normal" : "high"}`}>{status}</span></td><td>{fmtDate(until)}</td><td>{pending || "—"}</td></tr>; })}</tbody></table> : <Empty>No members yet.</Empty>}</div>
  </div>;
}
