import Link from "next/link";
import { coachLock } from "@/components/coach/CoachLock";
import { requireRole } from "@/lib/auth/guard";
import { athleteSignals } from "@/lib/coach/data";
import { AthleteCard, Empty, PageHead } from "@/components/coach/CoachUI";
import { ActionButton } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
const FILTERS = [["all", "All"], ["active", "Active"], ["paused", "Paused"], ["injured", "Injured"]] as const;

export default async function CoachAthletes({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const s = await requireRole("coach");
  { const lock = await coachLock(s.user.id); if (lock) return lock; } const { q = "", f = "all" } = await searchParams;
  const signals = await athleteSignals(s.user.id);
  const needle = q.trim().toLowerCase();
  const view = signals.filter((a) => (!needle || a.name.toLowerCase().includes(needle) || a.email.toLowerCase().includes(needle)) && (f === "all" || (f === "injured" ? a.activeInjuries > 0 : a.status === f)));
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="MEMBERS" title={`Members (${signals.length})`} sub="Athletes who chose you appear here automatically. Tap one for their progress, health, workouts, follow-ups and notes." />
    <form className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ flex: "1 1 240px" }} name="q" defaultValue={q} placeholder="Search by name or email" /><input type="hidden" name="f" value={f} /><button className="btn secondary">Search</button></form>
    <div className="rangeRow">{FILTERS.map(([k, label]) => <Link key={k} className={`rangeBtn${f === k ? " on" : ""}`} href={`/coach/athletes?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>{f === k ? "✓ " : ""}{label}</Link>)}</div>
    {view.length ? <div className="athGrid">{view.map((a) => <div key={a.athleteId} className="stack" style={{ gap: 6 }}>
      <AthleteCard a={a} />
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {a.status === "active" ? <ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId: a.athleteId, status: "paused" }} label="Pause" /> : <ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId: a.athleteId, status: "active" }} label="Resume" className="btn primary small" />}
        <ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId: a.athleteId, status: "ended" }} label="Remove" confirm={`Remove ${a.name} from your roster? They will be notified.`} />
      </div>
    </div>)}</div> : <Empty>{signals.length ? "No athletes match this filter." : "No members yet. Athletes find you by searching your name in their app and choosing you."}</Empty>}
  </div>;
}
