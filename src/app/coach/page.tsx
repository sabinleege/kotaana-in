import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { athleteSignals, buildRecommendations, coachRelations, teamDaily, fmtDate } from "@/lib/coach/data";
import { AthleteCard, Avatar, Empty, PageHead, Stat } from "@/components/coach/CoachUI";
import RosterActions from "@/components/coach/RosterActions";
import { ProgressChart } from "@/components/charts/ProgressCharts";

export const dynamic = "force-dynamic";
export default async function CoachOverview() {
  const s = await requireRole("coach"); const coachId = s.user.id;
  const [profile, signals, pending, daily, followUps, sessions, recentInjuries] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: coachId }, select: { fullName: true } }),
    athleteSignals(coachId), coachRelations(coachId, ["pending"]), teamDaily(coachId, 30),
    prisma.followUp.findMany({ where: { coachId, status: "pending" }, include: { athlete: { select: { name: true, email: true, profile: { select: { fullName: true } } } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 5 }),
    prisma.trainingSession.findMany({ where: { coachId, status: "scheduled", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 3 }),
    prisma.injury.findMany({ where: { athlete: { athleteRelations: { some: { coachId, status: "active" } } }, status: { in: ["active", "recovering"] } }, include: { athlete: { select: { name: true, email: true, profile: { select: { fullName: true } } } } }, orderBy: { dateReported: "desc" }, take: 5 }),
  ]);
  const active = signals.filter((a) => a.status === "active");
  const readiness = active.map((a) => a.readinessAvg7).filter((v): v is number => v != null);
  const recs = buildRecommendations(signals);
  const nameOf = (u: { name: string | null; email: string; profile: { fullName: string } | null }) => u.profile?.fullName || u.name || u.email;

  return <div className="stack" style={{ gap: 16 }}>
    <PageHead eyebrow="COACH" title={`Welcome back, ${(profile?.fullName || s.user.name || "Coach").split(" ")[0]}`} sub="Your team at a glance — every number comes from recorded athlete data.">
      <Link className="btn secondary" href="/coach/follow-ups">+ Follow-up</Link><Link className="btn primary" href="/coach/invites">+ Invite athlete</Link>
    </PageHead>
    <div className="statGrid">
      <Stat label="Active athletes" value={active.length} hint={`${signals.length} on roster`} />
      <Stat label="Pending requests" value={pending.length} warn={pending.length > 0} />
      <Stat label="Avg readiness (7d)" value={readiness.length ? Math.round(readiness.reduce((a, b) => a + b, 0) / readiness.length) : "—"} hint={readiness.length ? `${readiness.length} athlete(s) checked in` : "No check-ins this week"} />
      <Stat label="Blocks completed (7d)" value={active.reduce((s, a) => s + a.completed7, 0)} />
      <Stat label="Active injuries" value={active.reduce((s, a) => s + a.activeInjuries, 0)} warn={active.some((a) => a.activeInjuries)} />
      <Stat label="Need attention" value={recs.filter((r) => r.priority === "high").length} hint={`${recs.length} with open issues`} warn={recs.some((r) => r.priority === "high")} />
    </div>

    {pending.length > 0 && <div className="solid"><h2 className="sectionTitle">Connection requests</h2><div className="rowList" style={{ marginTop: 10 }}>{pending.map((r) => { const n = r.athlete.profile?.fullName || r.athlete.name || r.athlete.email; return <div className="rowItem" key={r.id}><div className="row"><Avatar name={n} src={r.athlete.profile?.avatarUrl} /><div><strong>{n}</strong><div className="small muted">{r.requestedByRole === "athlete" ? "Wants to join your roster" : "You invited them — waiting for their answer"} · {fmtDate(r.createdAt)}</div></div></div>{r.requestedByRole === "athlete" && <RosterActions relationId={r.id} />}</div>; })}</div></div>}

    <div className="chartGrid">
      <ProgressChart title="Team readiness" subtitle="Average daily check-in score, active athletes" kind="line" unit="/100" yMin={0} yMax={100} points={daily.map((d) => ({ date: d.date, value: d.readiness }))} empty="No check-ins from your athletes in the last 30 days." />
      <ProgressChart title="Team training" subtitle="Exercise blocks completed per day" kind="bar" unit="blocks" points={daily.map((d) => ({ date: d.date, value: d.completed }))} empty="No completed workouts from your athletes in the last 30 days." />
    </div>

    <div className="grid grid2">
      <div className="solid"><div className="row spread"><h2 className="sectionTitle">Needs attention</h2><Link className="linkBtn" href="/coach/recommendations">All →</Link></div>
        <div className="rowList" style={{ marginTop: 10 }}>{recs.slice(0, 5).map((r) => <Link className="rowItem" key={r.athleteId} href={`/coach/athletes/${r.athleteId}`}><div><strong>{r.name}</strong> <span className={`prio ${r.priority}`}>{r.priority}</span><div className="small muted">{r.issues.slice(0, 2).join(" · ")}</div></div></Link>)}{!recs.length && <Empty>Nothing flagged — your athletes look on track.</Empty>}</div></div>
      <div className="solid"><div className="row spread"><h2 className="sectionTitle">Coming up</h2><Link className="linkBtn" href="/coach/sessions">Sessions →</Link></div>
        <div className="rowList" style={{ marginTop: 10 }}>
          {sessions.map((x) => <div className="rowItem" key={x.id}><div><strong>{x.title}</strong><div className="small muted">{x.scheduledAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {x.athleteIds.length} athlete(s){x.location ? ` · ${x.location}` : ""}</div></div></div>)}
          {followUps.map((f) => <div className="rowItem" key={f.id}><div><strong>{f.title}</strong> <span className={`prio ${f.priority}`}>{f.priority}</span><div className="small muted">{nameOf(f.athlete)}{f.dueDate ? ` · due ${fmtDate(f.dueDate)}` : ""}</div></div></div>)}
          {recentInjuries.map((i) => <div className="rowItem" key={i.id}><div><strong>{nameOf(i.athlete)} — {i.bodyPart}</strong><div className="small muted">{i.injuryType} · severity {i.severity} · {i.status}</div></div></div>)}
          {!sessions.length && !followUps.length && !recentInjuries.length && <Empty>No sessions, follow-ups or injuries to show.</Empty>}
        </div></div>
    </div>

    <div><div className="row spread" style={{ marginBottom: 10 }}><h2 className="sectionTitle">Your athletes</h2><Link className="linkBtn" href="/coach/athletes">View all →</Link></div>
      {signals.length ? <div className="athGrid">{signals.slice(0, 6).map((a) => <AthleteCard key={a.athleteId} a={a} />)}</div> : <Empty>No athletes yet. <Link href="/coach/invites" style={{ color: "var(--orange2)" }}>Invite an athlete</Link> or share your name so they can find you.</Empty>}
    </div>
  </div>;
}
