import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { accessState } from "@/lib/subscription";

export const dynamic = "force-dynamic";
/** Admin overview: every coach with their members, and every athlete with the coach their data goes to. */
export default async function AdminPeople() {
  await requireRole("admin");
  const [coaches, athletes] = await Promise.all([
    prisma.user.findMany({ where: { role: "coach" }, select: { id: true, email: true, name: true, profile: { select: { fullName: true, membershipPriceRwf: true } }, _count: { select: { coachRelations: { where: { status: "active" } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { role: "athlete" }, select: { id: true, email: true, name: true, profile: { select: { fullName: true, primaryGoal: true } }, subscriptions: true, athleteRelations: { where: { status: { in: ["active", "paused"] } }, select: { status: true, coach: { select: { name: true, profile: { select: { fullName: true } } } } }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  return <div className="page"><div className="container" style={{ padding: "22px 0" }}>
    <div className="row spread" style={{ flexWrap: "wrap" }}><h1 style={{ margin: 0 }}>Coaches & athletes</h1><Link className="btn secondary" href="/admin">Back</Link></div>
    <div className="stack" style={{ marginTop: 16, gap: 14 }}>
      <div className="solid"><h2 className="sectionTitle">Coaches & gyms ({coaches.length})</h2><div className="rowList" style={{ marginTop: 10 }}>{coaches.map((c) => <div className="rowItem" key={c.id}><div><strong>{c.profile?.fullName || c.name || c.email}</strong><div className="small muted">{c.email} · {c.profile?.membershipPriceRwf ? `${c.profile.membershipPriceRwf.toLocaleString()} RWF / 30 days` : "no price set"}</div></div><span className="pill">{c._count.coachRelations} member(s)</span></div>)}{!coaches.length && <div className="empty">No coaches yet.</div>}</div></div>
      <div className="solid"><h2 className="sectionTitle">Athletes ({athletes.length})</h2><div className="tableWrap" style={{ marginTop: 10 }}><table className="dataTable"><thead><tr><th>Athlete</th><th>Coach</th><th>Access</th></tr></thead><tbody>{athletes.map((a) => { const rel = a.athleteRelations[0]; const acc = accessState(a.subscriptions); return <tr key={a.id}><td><strong>{a.profile?.fullName || a.name || a.email}</strong><div className="small muted">{a.email}</div></td><td>{rel ? `${rel.coach.profile?.fullName || rel.coach.name || "Coach"}${rel.status === "paused" ? " (paused)" : ""}` : <span className="muted">On their own</span>}</td><td><span className={`prio ${acc.active ? "low" : "high"}`}>{acc.active ? `${acc.daysLeft}d left` : "inactive"}</span></td></tr>; })}</tbody></table></div></div>
    </div></div></div>;
}
