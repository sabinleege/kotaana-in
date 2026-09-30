import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { coachCanAccess, fmtDate, goalLabel } from "@/lib/coach/data";
import { getProgressSeries } from "@/lib/reports-data";
import { CHRONIC_CONDITIONS } from "@/lib/health/conditions";
import { Avatar, Empty, Stat } from "@/components/coach/CoachUI";
import { ActionButton, FollowUpForm, InjuryForm, InjuryStatus, NoteForm } from "@/components/coach/CoachForms";
import { ProgressChart } from "@/components/charts/ProgressCharts";

export const dynamic = "force-dynamic";
const TABS = [["overview", "Overview"], ["workouts", "Workouts"], ["health", "Health & injuries"], ["follow-ups", "Follow-ups"], ["notes", "Notes"]] as const;

export default async function AthleteDetail({ params, searchParams }: { params: Promise<{ athleteId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const s = await requireRole("coach"); const coachId = s.user.id;
  const { athleteId } = await params; const { tab = "overview" } = await searchParams;
  const rel = await coachCanAccess(coachId, athleteId);
  if (!rel) return <div className="stack"><Link href="/coach/athletes" className="small muted">← Athletes</Link><Empty>This athlete is not on your roster, or the connection is not active.</Empty></div>;

  const [user, series, injuries, followUps, notes, perfs, checkins] = await Promise.all([
    prisma.user.findUnique({ where: { id: athleteId }, select: { email: true, name: true, image: true, profile: true } }),
    getProgressSeries(athleteId, 30),
    prisma.injury.findMany({ where: { athleteId }, orderBy: [{ status: "asc" }, { dateReported: "desc" }] }),
    prisma.followUp.findMany({ where: { coachId, athleteId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.coachNote.findMany({ where: { coachId, athleteId }, orderBy: { createdAt: "desc" } }),
    prisma.exercisePerformance.findMany({ where: { userId: athleteId }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.dailyCheckin.findMany({ where: { userId: athleteId }, orderBy: { date: "desc" }, take: 7 }),
  ]);
  const p = user?.profile; const name = p?.fullName || user?.name || user?.email || "Athlete";
  const readiness = series.daily.map((d) => d.readiness).filter((v): v is number => v != null);
  const labels = new Map(CHRONIC_CONDITIONS.map((c) => [c.id, c.label]));
  const conditions = (Array.isArray(p?.healthConditions) ? p!.healthConditions : []).map((x) => labels.get(String(x)) || String(x));
  const activeInj = injuries.filter((i) => i.status !== "resolved");
  const byDay = new Map<string, typeof perfs>(); for (const x of perfs) { const k = x.date.toISOString().slice(0, 10); byDay.set(k, [...(byDay.get(k) || []), x]); }

  return <div className="stack" style={{ gap: 14 }}>
    <Link href="/coach/athletes" className="small muted">← Athletes</Link>
    <div className="solid"><div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
      <Avatar name={name} src={p?.avatarUrl || user?.image} size={64} />
      <div style={{ flex: 1, minWidth: 200 }}><h1 style={{ margin: 0, fontSize: 26 }}>{name}</h1><div className="small muted">{user?.email}</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>{[goalLabel(p?.primaryGoal), p?.level, p?.age ? `${p.age} yrs` : null, p?.gender, rel.status === "paused" ? "paused" : null].filter(Boolean).map((t) => <span key={String(t)} className="pill">{t}</span>)}{p?.isPregnant && <span className="pill orange">Pregnant</span>}</div></div>
      <div className="row" style={{ flexWrap: "wrap" }}><ActionButton url="/api/coach/members" method="PATCH" body={{ athleteId, status: rel.status === "paused" ? "active" : "paused" }} label={rel.status === "paused" ? "Resume" : "Pause"} /></div>
    </div></div>

    <div className="statGrid">
      <Stat label="Readiness (30d avg)" value={readiness.length ? Math.round(readiness.reduce((a, b) => a + b, 0) / readiness.length) : "—"} hint={`${readiness.length} check-ins`} />
      <Stat label="Blocks completed (30d)" value={series.daily.reduce((s, d) => s + d.exercises, 0)} />
      <Stat label="Weight" value={p?.weight ? `${p.weight} kg` : "—"} hint={p?.targetWeight ? `Target ${p.targetWeight} kg` : "No target"} />
      <Stat label="Active injuries" value={activeInj.length} warn={activeInj.length > 0} />
      <Stat label="Open follow-ups" value={followUps.filter((f) => f.status === "pending").length} />
    </div>

    <div className="tabBar" role="tablist">{TABS.map(([k, l]) => <Link key={k} role="tab" aria-selected={tab === k} className={`tabBtn${tab === k ? " on" : ""}`} href={`/coach/athletes/${athleteId}?tab=${k}`}>{l}</Link>)}</div>

    {tab === "overview" && <>
      <div className="solid"><div className="eyebrow">30-DAY REPORT</div><ul className="findings">{series.findings.map((f) => <li key={f}>{f}</li>)}</ul></div>
      <div className="chartGrid">
        <ProgressChart title="Readiness" subtitle="Daily check-in score" kind="line" unit="/100" yMin={0} yMax={100} points={series.daily.map((d) => ({ date: d.date, value: d.readiness }))} empty="No check-ins yet." />
        <ProgressChart title="Workouts completed" subtitle="Exercise blocks per day" kind="bar" unit="blocks" points={series.daily.map((d) => ({ date: d.date, value: d.exercises }))} empty="No completed exercises yet." />
        <ProgressChart title="Water" subtitle="ml logged per day" kind="bar" unit="ml" points={series.daily.map((d) => ({ date: d.date, value: d.waterMl }))} empty="No water logged yet." />
        <ProgressChart title="Weight" subtitle="Recorded weight" kind="line" unit="kg" digits={1} connectGaps target={series.targetWeightKg} points={(() => { const m = new Map(series.weight.map((w) => [w.date, w.weight])); return series.daily.map((d) => ({ date: d.date, value: m.get(d.date) ?? null })); })()} empty="No weight recorded in the last 30 days." />
      </div>
    </>}

    {tab === "workouts" && <div className="solid"><h2 className="sectionTitle">Recent training</h2>
      <div className="rowList" style={{ marginTop: 10 }}>{[...byDay.entries()].map(([day, rows]) => <div className="rowItem" key={day}><div><strong>{fmtDate(day)}</strong><div className="small muted">{rows.map((r) => `${r.exerciseName || "Exercise"} (${r.completed ? r.effort : "skipped"})`).join(" · ")}</div></div><span className="pill">{rows.filter((r) => r.completed).length}/{rows.length} done</span></div>)}
        {!byDay.size && <Empty>No workout performance recorded yet.</Empty>}</div></div>}

    {tab === "health" && <>
      <div className="grid grid2">
        <div className="solid"><h2 className="sectionTitle">Health profile</h2><p className="small muted">Shared with you because you coach this athlete. Use it to keep training safe.</p>
          <div className="rowList" style={{ marginTop: 8 }}>
            <div className="rowItem"><span className="small muted">Conditions</span><strong>{conditions.join(", ") || p?.chronicDiseases || "None recorded"}</strong></div>
            <div className="rowItem"><span className="small muted">Limitations</span><strong>{p?.otherLimitations || "None recorded"}</strong></div>
            <div className="rowItem"><span className="small muted">Pain areas</span><strong>{p?.painAreas || "None recorded"}</strong></div>
          </div></div>
        <div className="solid"><h2 className="sectionTitle">Last 7 check-ins</h2><div className="rowList" style={{ marginTop: 8 }}>{checkins.map((c) => <div className="rowItem" key={c.id}><span>{fmtDate(c.date)}</span><span className="small muted">energy {c.energy} · soreness {c.soreness} · mood {c.mood}{c.sleepHours != null ? ` · ${c.sleepHours}h sleep` : ""}</span><strong>{c.readiness}</strong></div>)}{!checkins.length && <Empty>No check-ins yet.</Empty>}</div></div>
      </div>
      <div className="solid"><h2 className="sectionTitle">Injuries ({activeInj.length} active)</h2>
        <div className="rowList" style={{ margin: "10px 0 16px" }}>{injuries.map((i) => <div className="rowItem" key={i.id}><div><strong>{i.bodyPart} — {i.injuryType}</strong><div className="small muted">Severity {i.severity} · reported {fmtDate(i.dateReported)}{i.expectedReturn ? ` · return ${fmtDate(i.expectedReturn)}` : ""}{i.restrictions ? ` · ${i.restrictions}` : ""}</div></div><InjuryStatus id={i.id} status={i.status} /></div>)}{!injuries.length && <Empty>No injuries recorded.</Empty>}</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Log an injury</h3><InjuryForm athleteId={athleteId} /></div>
    </>}

    {tab === "follow-ups" && <div className="solid"><h2 className="sectionTitle">Follow-ups</h2>
      <div className="rowList" style={{ margin: "10px 0 16px" }}>{followUps.map((f) => <div className="rowItem" key={f.id} style={{ opacity: f.status === "pending" ? 1 : .6 }}><div><strong>{f.title}</strong> <span className={`prio ${f.priority}`}>{f.priority}</span><div className="small muted">{f.status}{f.dueDate ? ` · due ${fmtDate(f.dueDate)}` : ""}{f.description ? ` · ${f.description}` : ""}</div></div>{f.status === "pending" && <ActionButton url="/api/coach/follow-ups" method="PATCH" body={{ id: f.id, status: "done" }} label="✓ Done" />}</div>)}{!followUps.length && <Empty>No follow-ups yet.</Empty>}</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>New follow-up</h3><FollowUpForm athleteId={athleteId} /></div>}

    {tab === "notes" && <div className="solid"><h2 className="sectionTitle">Coach notes</h2><div style={{ margin: "10px 0 16px" }}><NoteForm athleteId={athleteId} /></div>
      <div className="rowList">{notes.map((n) => <div className="rowItem" key={n.id} style={{ alignItems: "flex-start" }}><div style={{ flex: 1 }}><div className="small muted">{n.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}{n.visibleToAthlete ? " · 👁 shared with athlete" : " · private"}</div><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{n.content}</p></div><ActionButton url={`/api/coach/notes?id=${n.id}`} method="DELETE" label="Delete" confirm="Delete this note?" /></div>)}{!notes.length && <Empty>No notes yet.</Empty>}</div></div>}
  </div>;
}
