import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { athleteSignals, buildRecommendations } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { ActionButton } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachRecommendations() {
  const s = await requireRole("coach");
  const recs = buildRecommendations(await athleteSignals(s.user.id, ["active"]));
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="RECOMMENDATIONS" title="Who needs you today" sub="Flagged from injuries, check-ins, missed workouts and health conditions. Turn any item into a follow-up — the athlete gets a notification." />
    <div className="rowList">{recs.map((r) => <div className="solid" key={r.athleteId}>
      <div className="row spread" style={{ flexWrap: "wrap" }}><div><Link href={`/coach/athletes/${r.athleteId}`} style={{ fontWeight: 800, fontSize: 16 }}>{r.name}</Link> <span className={`prio ${r.priority}`}>{r.priority}</span><div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>{r.tags.map((t) => <span key={t} className="pill">{t}</span>)}</div></div>
        <ActionButton className="btn primary small" url="/api/coach/follow-ups" body={{ athleteId: r.athleteId, title: `Follow-up: ${r.tags[0] || "check-in"}`, description: `${r.suggestedAction}\n\nIssues:\n- ${r.issues.join("\n- ")}`, priority: r.priority, notifyAthlete: true }} label="Create follow-up" /></div>
      <ul className="findings">{r.issues.map((i) => <li key={i}>{i}</li>)}</ul>
      <p className="small" style={{ margin: "8px 0 0" }}><strong>Suggested:</strong> {r.suggestedAction}</p>
    </div>)}{!recs.length && <Empty>No recommendations — every active athlete looks on track.</Empty>}</div>
  </div>;
}
