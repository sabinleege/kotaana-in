import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachRelations, fmtDate } from "@/lib/coach/data";
import { Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import { InjuryStatus } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachInjuries({ searchParams }: { searchParams: Promise<{ q?: string; sev?: string; all?: string }> }) {
  const s = await requireRole("coach"); const { q = "", sev = "all", all } = await searchParams;
  const rels = await coachRelations(s.user.id, ["active", "paused"]);
  const names = new Map(rels.map((r) => [r.athleteId, r.athlete.profile?.fullName || r.athlete.name || r.athlete.email]));
  const injuries = await prisma.injury.findMany({ where: { athleteId: { in: [...names.keys()] }, ...(all ? {} : { status: { in: ["active", "recovering"] } }) }, orderBy: [{ severity: "desc" }, { dateReported: "desc" }] });
  const needle = q.trim().toLowerCase();
  const rows = injuries.filter((i) => (!needle || `${names.get(i.athleteId)} ${i.bodyPart} ${i.injuryType}`.toLowerCase().includes(needle)) && (sev === "all" || i.severity === Number(sev)));
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="INJURIES" title="Injury board" sub="Every injury across your roster. Changing the status updates the athlete's workout safety filters." />
    <div className="statGrid"><Stat label="Active" value={injuries.filter((i) => i.status === "active").length} warn={injuries.some((i) => i.status === "active")} /><Stat label="Recovering" value={injuries.filter((i) => i.status === "recovering").length} /><Stat label="Severity 4–5" value={injuries.filter((i) => i.severity >= 4 && i.status !== "resolved").length} warn={injuries.some((i) => i.severity >= 4 && i.status !== "resolved")} /></div>
    <form className="row" style={{ flexWrap: "wrap" }}>
      <input className="input" style={{ flex: "1 1 220px" }} name="q" defaultValue={q} placeholder="Search athlete or injury…" />
      <select className="select" style={{ width: "auto" }} name="sev" defaultValue={sev}><option value="all">All severities</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Severity {n}</option>)}</select>
      <label className="check"><input type="checkbox" name="all" value="1" defaultChecked={Boolean(all)} /> Include resolved</label>
      <button className="btn secondary">Filter</button>
    </form>
    <div className="solid tableWrap">{rows.length ? <table className="dataTable"><thead><tr><th>Athlete</th><th>Injury</th><th>Severity</th><th>Reported</th><th>Expected return</th><th>Restrictions</th><th>Status</th></tr></thead>
      <tbody>{rows.map((i) => <tr key={i.id}><td><Link href={`/coach/athletes/${i.athleteId}?tab=health`} style={{ fontWeight: 700 }}>{names.get(i.athleteId)}</Link></td><td>{i.bodyPart} — {i.injuryType}</td><td><span className={`prio ${i.severity >= 4 ? "high" : i.severity >= 2 ? "normal" : "low"}`}>{i.severity}/5</span></td><td>{fmtDate(i.dateReported)}</td><td>{fmtDate(i.expectedReturn)}</td><td>{i.restrictions || "—"}</td><td><InjuryStatus id={i.id} status={i.status} /></td></tr>)}</tbody></table>
      : <Empty>{injuries.length ? "No injuries match these filters." : "No injuries on your roster. 🎉"}</Empty>}</div>
  </div>;
}
