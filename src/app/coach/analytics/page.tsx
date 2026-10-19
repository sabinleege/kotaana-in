import Link from "next/link";
import { coachLock } from "@/components/coach/CoachLock";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { athleteSignals, buildRecommendations, fmtDate, goalLabel, teamDaily } from "@/lib/coach/data";
import { Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import { CsvButton } from "@/components/coach/CoachForms";
import { ProgressChart } from "@/components/charts/ProgressCharts";

export const dynamic = "force-dynamic";
const FILTERS = [["all", "All"], ["risk", "Needs attention"], ["injured", "Injured"], ["paused", "Paused"]] as const;

function Bars({ title, sub, data }: { title: string; sub: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, n]) => n));
  return <div className="solid"><h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3><p className="small muted" style={{ margin: "2px 0 12px" }}>{sub}</p>
    {data.some(([, n]) => n) ? data.map(([label, n]) => <div className="hbar" key={label}><span>{label}</span><div className="hbarTrack"><div className="hbarFill" style={{ width: `${(n / max) * 100}%` }} /></div><span className="n">{n}</span></div>) : <Empty>No data yet.</Empty>}</div>;
}
const count = <T,>(xs: T[], keys: string[], f: (x: T) => string): [string, number][] => keys.map((k) => [k, xs.filter((x) => f(x) === k).length]);

/** Everything a coach needs to read their members' performance and income, on one page. */
export default async function CoachAnalytics({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const s = await requireRole("coach");
  { const lock = await coachLock(s.user.id); if (lock) return lock; } const { f = "all" } = await searchParams;
  const [a, daily, paid] = await Promise.all([
    athleteSignals(s.user.id), teamDaily(s.user.id, 30),
    prisma.paymentRequest.findMany({ where: { coachId: s.user.id, role: "athlete", status: "approved" }, select: { amount: true, currency: true, updatedAt: true } }),
  ]);
  const flagged = new Map(buildRecommendations(a).map((r) => [r.athleteId, r.priority]));
  const view = a.filter((x) => f === "all" || (f === "risk" ? flagged.has(x.athleteId) : f === "injured" ? x.activeInjuries > 0 : x.status === "paused"));
  const adh = a.map((x) => x.adherence7).filter((v): v is number => v != null);
  const cur = paid[0]?.currency || "RWF"; const sum = (xs: typeof paid) => xs.reduce((t, p) => t + p.amount, 0);
  const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (5 - i), 1)); const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); return { date: d.toISOString().slice(0, 10), value: sum(paid.filter((p) => p.updatedAt >= d && p.updatedAt < n)) }; });
  const readinessBand = (v: number | null) => v == null ? "No check-in" : v < 40 ? "Low (<40)" : v < 60 ? "Fair (40–59)" : v < 80 ? "Good (60–79)" : "High (80+)";
  const completionBand = (v: number | null) => v == null ? "No workouts" : v < 50 ? "<50%" : v < 80 ? "50–79%" : "80–100%";
  const rows: (string | number | null)[][] = [["Name", "Email", "Status", "Goal", "Level", "Readiness (7d)", "Completion % (7d)", "Blocks completed (7d)", "Active injuries", "Weight kg", "Target kg", "Last check-in", "Last workout"],
    ...a.map((x) => [x.name, x.email, x.status, goalLabel(x.goal), x.level, x.readinessAvg7, x.adherence7, x.completed7, x.activeInjuries, x.weight, x.targetWeight, fmtDate(x.lastCheckin), fmtDate(x.lastWorkout)])];
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="ANALYTICS" title="Analytics" sub="Every number comes from data your members recorded, plus the payments you confirmed."><CsvButton rows={rows} filename={`kotaana-members-${new Date().toISOString().slice(0, 10)}.csv`} /></PageHead>
    <div className="statGrid">
      <Stat label="Members" value={a.length} />
      <Stat label="Avg completion (7d)" value={adh.length ? `${Math.round(adh.reduce((x, y) => x + y, 0) / adh.length)}%` : "—"} />
      <Stat label="Need attention" value={flagged.size} warn={flagged.size > 0} />
      <Stat label="Injured" value={a.filter((x) => x.activeInjuries).length} warn={a.some((x) => x.activeInjuries)} />
      <Stat label="Revenue this month" value={`${sum(paid.filter((p) => p.updatedAt >= start)).toLocaleString()} ${cur}`} />
      <Stat label="Revenue all time" value={`${sum(paid).toLocaleString()} ${cur}`} hint={`${paid.length} confirmed payment(s)`} />
    </div>
    <div className="chartGrid">
      <ProgressChart title="Team readiness" subtitle="Average daily check-in, last 30 days" kind="line" unit="/100" yMin={0} yMax={100} points={daily.map((d) => ({ date: d.date, value: d.readiness }))} empty="No check-ins from your members yet." />
      <ProgressChart title="Team training" subtitle="Exercise blocks completed per day" kind="bar" unit="blocks" points={daily.map((d) => ({ date: d.date, value: d.completed }))} empty="No completed workouts yet." />
      <ProgressChart title="Monthly revenue" subtitle={`Confirmed payments per month (${cur})`} kind="bar" unit={cur} points={months} empty="No confirmed payments yet." />
    </div>
    <div className="grid grid2">
      <Bars title="Goals" sub="Primary goal set by each member" data={count(a, ["General fitness", "Fat loss", "Muscle gain", "Endurance", "Not set"], (x) => goalLabel(x.goal))} />
      <Bars title="Readiness this week" sub="7-day average check-in score" data={count(a, ["High (80+)", "Good (60–79)", "Fair (40–59)", "Low (<40)", "No check-in"], (x) => readinessBand(x.readinessAvg7))} />
      <Bars title="Workout completion this week" sub="Completed ÷ recorded exercise blocks" data={count(a, ["80–100%", "50–79%", "<50%", "No workouts"], (x) => completionBand(x.adherence7))} />
      <Bars title="Levels" sub="Training level" data={count(a, ["beginner", "intermediate", "advanced"], (x) => x.level || "beginner")} />
    </div>
    <div className="rangeRow">{FILTERS.map(([k, l]) => <Link key={k} className={`rangeBtn${f === k ? " on" : ""}`} href={`/coach/analytics?f=${k}`}>{f === k ? "✓ " : ""}{l}</Link>)}</div>
    <div className="solid tableWrap">{view.length ? <table className="dataTable"><thead><tr><th>Member</th><th>Goal</th><th>Status</th><th>Readiness</th><th>Completion</th><th>Blocks</th><th>Injuries</th><th>Last check-in</th><th>Last workout</th><th>Flag</th></tr></thead>
      <tbody>{view.map((x) => <tr key={x.athleteId}><td><Link href={`/coach/athletes/${x.athleteId}`} style={{ fontWeight: 700 }}>{x.name}</Link></td><td>{goalLabel(x.goal)}</td><td>{x.status}</td><td>{x.readinessAvg7 ?? "—"}</td><td>{x.adherence7 != null ? `${x.adherence7}%` : "—"}</td><td>{x.completed7}</td><td>{x.activeInjuries}</td><td>{fmtDate(x.lastCheckin)}</td><td>{fmtDate(x.lastWorkout)}</td><td>{flagged.has(x.athleteId) ? <span className={`prio ${flagged.get(x.athleteId)}`}>{flagged.get(x.athleteId)}</span> : "—"}</td></tr>)}</tbody></table>
      : <Empty>{a.length ? "No members match this filter." : "No members on your roster yet."}</Empty>}</div>
  </div>;
}
