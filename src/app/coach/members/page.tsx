import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { coachRelations, fmtDate } from "@/lib/coach/data";
import { Avatar, Empty, PageHead } from "@/components/coach/CoachUI";
import { ActionButton } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachMembers() {
  const s = await requireRole("coach");
  const rels = await coachRelations(s.user.id, ["active", "paused"]);
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="MEMBERS" title="Members management" sub="Pause stops monitoring (no recommendations or sessions) without deleting history. Remove ends the connection."><Link className="btn primary" href="/coach/invites">+ Add member</Link></PageHead>
    <div className="rowList">{rels.map((r) => { const n = r.athlete.profile?.fullName || r.athlete.name || r.athlete.email; return <div className="rowItem" key={r.id}>
      <div className="row"><Avatar name={n} src={r.athlete.profile?.avatarUrl} /><div><Link href={`/coach/athletes/${r.athleteId}`} style={{ fontWeight: 700 }}>{n}</Link><div className="small muted">{r.athlete.email} · member since {fmtDate(r.createdAt)} · <strong>{r.status}</strong></div></div></div>
      <div className="row">{r.status === "active" ? <ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId: r.athleteId, status: "paused" }} label="Pause" /> : <ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId: r.athleteId, status: "active" }} label="Resume" className="btn primary small" />}
        <ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId: r.athleteId, status: "ended" }} label="Remove" confirm={`Remove ${n} from your roster? They will be notified.`} /></div>
    </div>; })}{!rels.length && <Empty>No members yet.</Empty>}</div>
  </div>;
}
