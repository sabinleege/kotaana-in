import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { athleteSignals, buildRecommendations, fmtDate, goalLabel } from "@/lib/coach/data";
import { Empty, PageHead, Stat } from "@/components/coach/CoachUI";

export const dynamic = "force-dynamic";
const FILTERS = [["all", "All"], ["risk", "Needs attention"], ["injured", "Injured"], ["paused", "Paused"]] as const;

export default async function CoachStatistics({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const s = await requireRole("coach"); const { f = "all" } = await searchParams;
  const signals = await athleteSignals(s.user.id);
  const flagged = new Map(buildRecommendations(signals).map((r) => [r.athleteId, r.priority]));
  const view = signals.filter((a) => f === "all" || (f === "risk" ? flagged.has(a.athleteId) : f === "injured" ? a.activeInjuries > 0 : a.status === "paused"));
  const adh = signals.map((a) => a.adherence7).filter((v): v is number => v != null);
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="STATISTICS" title="Athlete statistics" sub="Numbers for every athlete you manage, from the last 7 days of recorded data." />
    <div className="statGrid">
      <Stat label="Athletes" value={signals.length} />
      <Stat label="Injured" value={signals.filter((a) => a.activeInjuries).length} warn={signals.some((a) => a.activeInjuries)} />
      <Stat label="Need attention" value={flagged.size} />
      <Stat label="Avg completion (7d)" value={adh.length ? `${Math.round(adh.reduce((a, b) => a + b, 0) / adh.length)}%` : "—"} />
    </div>
    <div className="rangeRow">{FILTERS.map(([k, l]) => <Link key={k} className={`rangeBtn${f === k ? " on" : ""}`} href={`/coach/statistics?f=${k}`}>{f === k ? "✓ " : ""}{l}</Link>)}</div>
    <div className="solid tableWrap">{view.length ? <table className="dataTable"><thead><tr><th>Athlete</th><th>Goal</th><th>Status</th><th>Readiness</th><th>Completion</th><th>Blocks</th><th>Injuries</th><th>Last check-in</th><th>Last workout</th><th>Flag</th></tr></thead>
      <tbody>{view.map((a) => <tr key={a.athleteId}><td><Link href={`/coach/athletes/${a.athleteId}`} style={{ fontWeight: 700 }}>{a.name}</Link></td><td>{goalLabel(a.goal)}</td><td>{a.status}</td><td>{a.readinessAvg7 ?? "—"}</td><td>{a.adherence7 != null ? `${a.adherence7}%` : "—"}</td><td>{a.completed7}</td><td>{a.activeInjuries}</td><td>{fmtDate(a.lastCheckin)}</td><td>{fmtDate(a.lastWorkout)}</td><td>{flagged.has(a.athleteId) ? <span className={`prio ${flagged.get(a.athleteId)}`}>{flagged.get(a.athleteId)}</span> : "—"}</td></tr>)}</tbody></table>
      : <Empty>{signals.length ? "No athletes match this filter." : "No athletes on your roster yet."}</Empty>}</div>
  </div>;
}
