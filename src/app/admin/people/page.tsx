import { prisma } from "@/lib/db/prisma";
import { accessState } from "@/lib/subscription";
import { AdminHeader, Kpi, Panel } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
/** Admin overview: every coach with their members, and every athlete with the coach their data goes to. */
export default async function AdminPeople() {
  const [coaches, athletes] = await Promise.all([
    prisma.user.findMany({ where: { role: "coach" }, select: { id: true, email: true, name: true, profile: { select: { fullName: true, membershipPriceRwf: true } }, _count: { select: { coachRelations: { where: { status: "active" } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ where: { role: "athlete" }, select: { id: true, email: true, name: true, profile: { select: { fullName: true, primaryGoal: true } }, subscriptions: true, athleteRelations: { where: { status: { in: ["active", "paused"] } }, select: { status: true, coach: { select: { name: true, profile: { select: { fullName: true } } } } }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const withCoach = athletes.filter((a) => a.athleteRelations.length).length;
  return <>
    <AdminHeader eyebrow="People" title="Coaches & athletes" sub="Who trains with whom, and who currently has access." />
    <div className="admKpis">
      <Kpi label="Coaches & gyms" value={coaches.length} />
      <Kpi label="Athletes" value={athletes.length} hint={athletes.length === 500 ? "showing the newest 500" : undefined} />
      <Kpi label="With a coach" value={withCoach} hint={`${athletes.length - withCoach} on their own`} />
    </div>
    <Panel title={`Coaches & gyms (${coaches.length})`} flush>
      <div className="admTableWrap"><table className="admTable"><thead><tr><th>Coach / gym</th><th>Membership price</th><th>Members</th></tr></thead><tbody>{coaches.map((c) => <tr key={c.id}><td><strong>{c.profile?.fullName || c.name || c.email}</strong><small>{c.email}</small></td><td>{c.profile?.membershipPriceRwf ? `${c.profile.membershipPriceRwf.toLocaleString()} RWF / 30 days` : <span className="admMuted">not set</span>}</td><td><span className="admTag">{c._count.coachRelations}</span></td></tr>)}{!coaches.length && <tr><td colSpan={3} className="admEmpty">No coaches yet.</td></tr>}</tbody></table></div>
    </Panel>
    <Panel title={`Athletes (${athletes.length})`} flush>
      <div className="admTableWrap"><table className="admTable"><thead><tr><th>Athlete</th><th>Coach</th><th>Access</th></tr></thead><tbody>{athletes.map((a) => { const rel = a.athleteRelations[0]; const acc = accessState(a.subscriptions); return <tr key={a.id}><td><strong>{a.profile?.fullName || a.name || a.email}</strong><small>{a.email}</small></td><td>{rel ? `${rel.coach.profile?.fullName || rel.coach.name || "Coach"}${rel.status === "paused" ? " (paused)" : ""}` : <span className="admMuted">On their own</span>}</td><td><span className={`admPill ${acc.active ? "ok" : "off"}`}>{acc.active ? `${acc.daysLeft}d left` : "inactive"}</span></td></tr>; })}{!athletes.length && <tr><td colSpan={3} className="admEmpty">No athletes yet.</td></tr>}</tbody></table></div>
    </Panel>
  </>;
}
