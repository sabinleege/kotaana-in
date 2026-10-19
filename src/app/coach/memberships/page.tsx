import Link from "next/link";
import { coachLock } from "@/components/coach/CoachLock";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { fmtDate } from "@/lib/coach/data";
import { Avatar, Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import { AccessButtons } from "@/components/billing/BillingForms";
import PaymentApprovals from "@/components/PaymentApprovals";
import { accessState } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export default async function GymSubscriptions() {
  const s = await requireRole("coach");
  { const lock = await coachLock(s.user.id); if (lock) return lock; } const gymId = s.user.id;
  const [profile, rels, payments] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: gymId }, select: { membershipPriceRwf: true, momoNumber: true } }),
    prisma.coachAthleteRelation.findMany({ where: { coachId: gymId, status: { in: ["active", "paused"] } }, include: { athlete: { select: { name: true, email: true, subscriptions: true, profile: { select: { fullName: true, avatarUrl: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.paymentRequest.findMany({ where: { coachId: gymId, role: "athlete" }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const pending = payments.filter((p) => p.status === "pending");
  const history = payments.filter((p) => p.status !== "pending").slice(0, 30);
  const rows = rels.map((r) => {
    const acc = accessState(r.athlete.subscriptions);
    const status = r.status === "paused" ? "paused" : acc.active ? "active" : acc.expiresAt ? "expired" : "unpaid";
    return { r, until: acc.expiresAt, status, active: acc.active, source: acc.source, pending: pending.filter((p) => p.userId === r.athleteId).length };
  });
  const count = (st: string) => rows.filter((x) => x.status === st).length;
  const cur = "RWF";
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SUBSCRIPTIONS" title="Subscriptions" sub="Orders from members land here as pending. Confirm one and the member gets 30 days; reject it, or block to switch their access off.">
      <Link className="btn secondary" href="/coach/settings">{profile?.membershipPriceRwf ? `Price: ${profile.membershipPriceRwf.toLocaleString()} ${cur} / 30 days` : "Set your price"}</Link>
    </PageHead>
    {!profile?.membershipPriceRwf && <div className="solid"><strong>Set your membership price</strong><p className="small muted" style={{ margin: "4px 0 8px" }}>Members cannot pay you until you set a price and a MoMo number.</p><Link className="btn primary small" href="/coach/settings">Open settings</Link></div>}
    <div className="statGrid"><Stat label="Pending orders" value={pending.length} warn={pending.length > 0} /><Stat label="Active members" value={count("active")} /><Stat label="Expired" value={count("expired")} warn={count("expired") > 0} /><Stat label="Unpaid" value={count("unpaid")} /></div>
    <PaymentApprovals rows={pending} back="/coach" embedded />
    <div className="solid"><h2 className="sectionTitle">Members</h2><div className="tableWrap" style={{ marginTop: 10 }}>{rows.length ? <table className="dataTable"><thead><tr><th>Member</th><th>Status</th><th>Paid through</th><th>Pending</th><th></th></tr></thead><tbody>{rows.map(({ r, until, status, active, source, pending: n }) => { const name = r.athlete.profile?.fullName || r.athlete.name || r.athlete.email; return <tr key={r.id}><td><div className="row"><Avatar name={name} src={r.athlete.profile?.avatarUrl} size={32} /><Link href={`/coach/athletes/${r.athleteId}`} style={{ fontWeight: 700 }}>{name}</Link></div></td><td><span className={`prio ${status === "active" ? "low" : status === "paused" ? "normal" : "high"}`}>{status}</span></td><td>{fmtDate(until)}</td><td>{n || "—"}</td><td><AccessButtons url="/api/coach/access" userKey="athleteId" userId={r.athleteId} active={active} canRevoke={source === "gym"} /></td></tr>; })}</tbody></table> : <Empty>No members yet.</Empty>}</div></div>
    <div className="solid"><h2 className="sectionTitle">History</h2><div className="rowList" style={{ marginTop: 10 }}>{history.map((p) => <div className="rowItem" key={p.id}><div><strong>{p.user.name || p.user.email}</strong><div className="small muted">{p.amount.toLocaleString()} {p.currency} · {fmtDate(p.updatedAt)} · from {p.payerNumber}</div></div><span className={`prio ${p.status === "approved" ? "low" : "high"}`}>{p.status}</span></div>)}{!history.length && <Empty>No confirmed or rejected payments yet.</Empty>}</div></div>
  </div>;
}
