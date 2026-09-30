import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { athleteSignals, coachRelations } from "@/lib/coach/data";
import { AthleteCard, Empty, PageHead } from "@/components/coach/CoachUI";
import RosterActions from "@/components/coach/RosterActions";

export const dynamic = "force-dynamic";
const FILTERS = [["all", "All"], ["active", "Active"], ["paused", "Paused"], ["injured", "Injured"], ["pending", "Requests"]] as const;

export default async function CoachAthletes({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const s = await requireRole("coach"); const { q = "", f = "all" } = await searchParams;
  const [signals, pending] = await Promise.all([athleteSignals(s.user.id), coachRelations(s.user.id, ["pending"])]);
  const needle = q.trim().toLowerCase();
  const view = signals.filter((a) => (!needle || a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle)) && (f === "all" || (f === "injured" ? a.activeInjuries > 0 : a.status === f)));
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="ROSTER" title={`Athletes (${signals.length})`} sub="Tap an athlete for their progress, health, workouts, follow-ups and notes."><Link className="btn primary" href="/coach/invites">+ Invite athlete</Link></PageHead>
    <form className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ flex: "1 1 240px" }} name="q" defaultValue={q} placeholder="Search by name or email" /><input type="hidden" name="f" value={f} /><button className="btn secondary">Search</button></form>
    <div className="rangeRow">{FILTERS.map(([k, label]) => <Link key={k} className={`rangeBtn${f === k ? " on" : ""}`} href={`/coach/athletes?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>{f === k ? "✓ " : ""}{label}{k === "pending" && pending.length ? ` (${pending.length})` : ""}</Link>)}</div>
    {f === "pending" ? <div className="rowList">{pending.map((r) => <div className="rowItem" key={r.id}><div><strong>{r.athlete.profile?.fullName || r.athlete.name || r.athlete.email}</strong><div className="small muted">{r.athlete.email} · {r.requestedByRole === "athlete" ? "wants to join" : "invited by you — waiting"}</div></div>{r.requestedByRole === "athlete" && <RosterActions relationId={r.id} />}</div>)}{!pending.length && <Empty>No pending requests.</Empty>}</div>
      : view.length ? <div className="athGrid">{view.map((a) => <AthleteCard key={a.athleteId} a={a} />)}</div> : <Empty>{signals.length ? "No athletes match this filter." : "No athletes yet — send an invite to get started."}</Empty>}
  </div>;
}
