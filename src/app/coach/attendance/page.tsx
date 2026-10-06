import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachRelations } from "@/lib/coach/data";
import { Avatar, Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import AttendanceToggle from "@/components/coach/AttendanceToggle";
import { ProgressChart } from "@/components/charts/ProgressCharts";

export const dynamic = "force-dynamic";
export default async function GymAttendance() {
  const s = await requireRole("coach"); const gymId = s.user.id;
  const rels = await coachRelations(gymId, ["active"]);
  const end = new Date(); const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 29));
  const rows = await prisma.attendance.findMany({ where: { gymId, date: { gte: start } }, select: { athleteId: true, date: true } });
  const key = (d: Date) => d.toISOString().slice(0, 10); const today = key(new Date());
  const presentToday = new Set(rows.filter((r) => key(r.date) === today).map((r) => r.athleteId));
  const daily = Array.from({ length: 30 }, (_, i) => { const date = key(new Date(start.getTime() + i * 86400000)); return { date, value: rows.filter((r) => key(r.date) === date).length }; });
  const week = rows.filter((r) => r.date >= new Date(Date.now() - 7 * 86400000)).length;
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="ATTENDANCE" title="Attendance" sub="Check members in as they arrive. Totals update immediately." />
    <div className="statGrid"><Stat label="Present today" value={presentToday.size} hint={`of ${rels.length} members`} /><Stat label="Check-ins (7 days)" value={week} /><Stat label="Check-ins (30 days)" value={rows.length} /></div>
    <ProgressChart title="Daily attendance" subtitle="Members checked in per day" kind="bar" unit="members" points={daily} empty="No check-ins recorded yet." />
    <div className="solid"><h2 className="sectionTitle">Today</h2><div className="rowList" style={{ marginTop: 10 }}>{rels.map((r) => { const n = r.athlete.profile?.fullName || r.athlete.name || r.athlete.email; return <div className="rowItem" key={r.id}><div className="row"><Avatar name={n} src={r.athlete.profile?.avatarUrl} /><strong>{n}</strong></div><AttendanceToggle athleteId={r.athleteId} present={presentToday.has(r.athleteId)} /></div>; })}{!rels.length && <Empty>No active members yet.</Empty>}</div></div>
  </div>;
}
