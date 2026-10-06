import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachRelations, fmtDate } from "@/lib/coach/data";
import { Avatar, Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import { AccessButtons } from "@/components/billing/BillingForms";
import { accessState } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export default async function GymMemberships() {
  const s = await requireRole("coach"); const gymId = s.user.id;
  const [rels, payments] = await Promise.all([prisma.coachAthleteRelation.findMany({ where: { coachId: gymId, status: { in: ["active", "paused"] } }, include: { athlete: { select: { name: true, email: true, subscriptions: true, profile: { select: { fullName: true, avatarUrl: true } } } } }, orderBy: { createdAt: "desc" } }), prisma.paymentRequest.findMany({ where: { coachId: gymId, role: "athlete" }, orderBy: { createdAt: "desc" } })]);
  const rows = rels.map((r) => {
    const mine = payments.filter((p) => p.userId === r.athleteId);
    const acc = accessState(r.athlete.subscriptions);
    const until = acc.expiresAt;
    const status = r.status === "paused" ? "paused" : acc.active ? "active" : until ? "expired" : "unpaid";
    return { r, until, status, active: acc.active, source: acc.source, pending: mine.filter((p) => p.status === "pending").length };
  });
  const count = (st: string) => rows.filter((x) => x.status === st).length;
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="MEMBERSHIPS" title="Memberships" sub="Each approved payment or direct grant gives exactly 30 days. Grant access any time — no request needed."><Link className="btn primary" href="/coach/payments">Payment approvals</Link><Link className="btn secondary" href="/coach/members">Manage members</Link></PageHead>
    <div className="statGrid"><Stat label="Active" value={count("active")} /><Stat label="Expired" value={count("expired")} warn={count("expired") > 0} /><Stat label="Unpaid" value={count("unpaid")} /><Stat label="Pending payments" value={payments.filter((p) => p.status === "pending").length} warn={payments.some((p) => p.status === "pending")} /></div>
    <div className="solid tableWrap">{rows.length ? <table className="dataTable"><thead><tr><th>Member</th><th>Status</th><th>Paid through</th><th>Pending</th><th></th></tr></thead><tbody>{rows.map(({ r, until, status, active, source, pending }) => { const n = r.athlete.profile?.fullName || r.athlete.name || r.athlete.email; return <tr key={r.id}><td><div className="row"><Avatar name={n} src={r.athlete.profile?.avatarUrl} size={32} /><Link href={`/coach/athletes/${r.athleteId}`} style={{ fontWeight: 700 }}>{n}</Link></div></td><td><span className={`prio ${status === "active" ? "low" : status === "paused" ? "normal" : "high"}`}>{status}</span></td><td>{fmtDate(until)}</td><td>{pending || "—"}</td><td><AccessButtons url="/api/coach/access" userKey="athleteId" userId={r.athleteId} active={active} canRevoke={source === "gym"} /></td></tr>; })}</tbody></table> : <Empty>No members yet.</Empty>}</div>
  </div>;
}
