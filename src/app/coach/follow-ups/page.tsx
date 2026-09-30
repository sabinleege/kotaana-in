import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachRelations, fmtDate } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { ActionButton, FollowUpForm } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachFollowUps({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const s = await requireRole("coach"); const { show = "pending" } = await searchParams;
  const [items, rels] = await Promise.all([
    prisma.followUp.findMany({ where: { coachId: s.user.id, ...(show === "all" ? {} : { status: "pending" }) }, include: { athlete: { select: { id: true, name: true, email: true, profile: { select: { fullName: true } } } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    coachRelations(s.user.id, ["active"]),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="FOLLOW-UPS" title="Follow-up queue" sub="Tasks you owe your athletes. Mark them done when handled." />
    <div className="rangeRow">{[["pending", "Pending"], ["all", "All"]].map(([k, l]) => <Link key={k} className={`rangeBtn${show === k ? " on" : ""}`} href={`/coach/follow-ups?show=${k}`}>{show === k ? "✓ " : ""}{l}</Link>)}</div>
    <div className="rowList">{items.map((f) => { const overdue = f.status === "pending" && f.dueDate && f.dueDate < today; return <div className="rowItem" key={f.id} style={{ opacity: f.status === "pending" ? 1 : .6 }}>
      <div><strong>{f.title}</strong> <span className={`prio ${f.priority}`}>{f.priority}</span>{overdue && <span className="prio high" style={{ marginLeft: 4 }}>overdue</span>}
        <div className="small muted"><Link href={`/coach/athletes/${f.athlete.id}?tab=follow-ups`}>{f.athlete.profile?.fullName || f.athlete.name || f.athlete.email}</Link>{f.dueDate ? ` · due ${fmtDate(f.dueDate)}` : ""} · {f.status}</div>
        {f.description && <div className="small" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{f.description}</div>}</div>
      {f.status === "pending" && <div className="row"><ActionButton url="/api/coach/follow-ups" method="PATCH" body={{ id: f.id, status: "done" }} label="✓ Done" /><ActionButton url="/api/coach/follow-ups" method="PATCH" body={{ id: f.id, status: "cancelled" }} label="Cancel" /></div>}
    </div>; })}{!items.length && <Empty>All caught up — no {show === "all" ? "" : "pending "}follow-ups.</Empty>}</div>
    <div className="solid"><h2 className="sectionTitle">New follow-up</h2><div style={{ marginTop: 10 }}><FollowUpForm athletes={rels.map((r) => ({ id: r.athleteId, name: r.athlete.profile?.fullName || r.athlete.name || r.athlete.email }))} /></div></div>
  </div>;
}
