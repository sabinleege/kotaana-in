import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachRelations } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { ActionButton, SessionForm } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachSessions() {
  const s = await requireRole("coach");
  const [sessions, rels] = await Promise.all([prisma.trainingSession.findMany({ where: { coachId: s.user.id }, orderBy: { scheduledAt: "desc" }, take: 100 }), coachRelations(s.user.id, ["active"])]);
  const names = new Map(rels.map((r) => [r.athleteId, r.athlete.profile?.fullName || r.athlete.name || r.athlete.email]));
  const now = new Date();
  const upcoming = sessions.filter((x) => x.status === "scheduled" && x.scheduledAt >= now).reverse();
  const past = sessions.filter((x) => !(x.status === "scheduled" && x.scheduledAt >= now));
  const row = (x: (typeof sessions)[number]) => <div className="rowItem" key={x.id} style={{ opacity: x.status === "cancelled" ? .55 : 1 }}>
    <div><strong>{x.title}</strong> <span className="pill">{x.sessionType}</span> <span className={`prio ${x.status === "cancelled" ? "high" : x.status === "completed" ? "low" : "normal"}`}>{x.status}</span>
      <div className="small muted">📅 {x.scheduledAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {x.durationMinutes} min{x.location ? ` · 📍 ${x.location}` : ""}</div>
      <div className="small muted">👥 {x.athleteIds.map((id) => names.get(id) || "former athlete").join(", ") || "No athletes"}</div>
      {x.notes && <div className="small" style={{ marginTop: 4 }}>{x.notes}</div>}</div>
    {x.status === "scheduled" && <div className="row"><ActionButton url="/api/coach/sessions" method="PATCH" body={{ id: x.id, status: "completed" }} label="Mark complete" /><ActionButton url="/api/coach/sessions" method="PATCH" body={{ id: x.id, status: "cancelled" }} label="Cancel" confirm="Cancel this session? Athletes will be notified." /></div>}
  </div>;
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SCHEDULE" title={`Sessions (${sessions.length})`} sub="Plan group or one-to-one sessions. Selected athletes get a notification." />
    <div className="solid"><h2 className="sectionTitle">Schedule a session</h2><div style={{ marginTop: 10 }}><SessionForm athletes={rels.map((r) => ({ id: r.athleteId, name: names.get(r.athleteId)! }))} /></div></div>
    <h2 className="sectionTitle">Upcoming</h2><div className="rowList">{upcoming.map(row)}{!upcoming.length && <Empty>No upcoming sessions.</Empty>}</div>
    {past.length > 0 && <><h2 className="sectionTitle">Past & cancelled</h2><div className="rowList">{past.map(row)}</div></>}
  </div>;
}
