"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProgressChart } from "./charts/ProgressCharts";
import HydrationTracker from "./HydrationTracker";
import TodayCard from "./TodayCard";

type Rating = { label: string; score: number; value?: number | null } | null;
type D = {
  name: string;
  body: { weight: number | null; targetWeight: number | null; height: number | null; bmi: number | null; bmiCategory: { label: string; tone: string } | null; bodyFat: number | null; bodyFatCategory: string | null };
  goal: { pct: number | null; from: number | null; to: number | null };
  calories: { today: number; target: number | null };
  macros: { protein: number; carbs: number; fat: number; targets: { protein: number; carbs: number; fat: number } | null };
  adherence: { pct: number; done7: number; expected: number; streak: number };
  scores: { fitness: number | null; recovery: number | null };
  health: { score: number | null; recovery: Rating; sleep: Rating; nutrition: Rating; hydration: Rating; overtraining: Rating; notes: string[] };
  goalPlan: { goal: string; calories: number; protein: number; sessionsPerWeek: number; weeks: number | null; next: string } | null;
  burned: { date: string; value: number }[];
  weightSeries: { date: string; value: number }[];
};

const TONE: Record<string, string> = { ok: "var(--ok)", orange: "var(--orange2)", danger: "var(--danger)", blue: "var(--blue)" };
const GOALS: Record<string, string> = { general_fitness: "General fitness", fat_loss: "Fat loss", muscle_gain: "Muscle gain", endurance: "Endurance" };
const ratingTone = (l?: string) => (l === "Excellent" || l === "Good" || l === "Low" ? "ok" : l === "Fair" || l === "Moderate" ? "orange" : "danger");

/** Progress ring. The track and arc use theme variables so it follows light and dark mode. */
function Ring({ pct, color = "var(--orange)", children }: { pct: number | null; color?: string; children: React.ReactNode }) {
  const r = 38, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct ?? 0));
  return <div className="dashRing"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r={r} className="ringTrack" /><circle cx="45" cy="45" r={r} className="ringArc" style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c * (1 - p / 100) }} transform="rotate(-90 45 45)" /></svg><div className="ringLabel">{children}</div></div>;
}
function RingCard({ pct, color, big, small, title, value, sub, href }: { pct: number | null; color?: string; big: React.ReactNode; small: string; title: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = <div className="card dashRingCard"><Ring pct={pct} color={color}><strong>{big}</strong><span>{small}</span></Ring><div><div className="small muted">{title}</div><div className="dashBig">{value}</div>{sub && <div className="small muted">{sub}</div>}</div></div>;
  return href ? <Link href={href}>{body}</Link> : body;
}
function Tile({ icon, value, label, sub, href }: { icon: string; value: React.ReactNode; label: string; sub?: string; href?: string }) {
  const body = <div className="card dashTile"><span className="tileIcon">{icon}</span><div className="dashBig">{value}</div><div className="muted">{label}</div>{sub && <div className="small dim">{sub}</div>}</div>;
  return href ? <Link href={href}>{body}</Link> : body;
}
function Bar({ label, value, target, unit = "g" }: { label: string; value: number; target?: number; unit?: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return <div><div className="row spread small"><span className="muted">{label}</span><strong>{Math.round(value)}{target ? ` / ${target}` : ""} {unit}</strong></div><div className="barTrack"><div className="barFill" style={{ width: `${pct}%` }} /></div></div>;
}

/** The athlete's home screen: today's workout and nutrition first, then the numbers that show how the goal is going. */
export default function DashboardScreen() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { fetch("/api/dashboard").then((r) => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setErr(true)); }, []);

  return <div className="stack">
    <div><span className="pill orange">TODAY</span><h1 style={{ fontSize: 30, margin: "10px 0 4px" }}>{d?.name ? `Hi, ${d.name.split(" ")[0]}` : "Your day, organized."}</h1><p className="subtitle">Your workout and meals are ready. Everything below comes from what you record.</p></div>
    <TodayCard />
    {err && <div className="card small">Couldn't load your numbers. Pull to refresh.</div>}
    {!d && !err && <div className="card"><p className="subtitle" style={{ margin: 0 }}>Loading your summary…</p></div>}
    {d && <>
      <RingCard pct={d.goal.pct} big={d.goal.pct != null ? `${d.goal.pct}%` : "—"} small="GOAL" title="To goal weight" value={d.goal.to != null && d.goal.from != null ? <>{d.goal.from} → {d.goal.to} kg</> : "Set a target weight"} sub={d.goal.to == null ? "Add it in your profile" : undefined} href="/app/progress" />
      <RingCard pct={d.calories.target ? (d.calories.today / d.calories.target) * 100 : 0} color="var(--blue)" big={d.calories.today.toLocaleString()} small="KCAL" title="Calories today" value={d.calories.target ? <>of {d.calories.target.toLocaleString()}</> : "No target yet"} sub={d.calories.today === 0 ? "Log a meal in Nutrition" : undefined} href="/app/nutrition" />
      <RingCard pct={d.adherence.pct} color="var(--ok)" big={`${d.adherence.pct}%`} small="7-DAY" title="Workout adherence" value={<>🔥 {d.adherence.streak}-day streak</>} sub={`${d.adherence.done7} of ${d.adherence.expected} sessions this week`} href="/app/workout" />

      <div className="dashGrid">
        <Tile icon="⚖" value={d.body.weight != null ? `${d.body.weight} kg` : "—"} label="Weight" sub={d.body.targetWeight ? `Target ${d.body.targetWeight} kg` : "No target set"} href="/app/progress" />
        <Tile icon="%" value={d.body.bodyFat != null ? `${d.body.bodyFat}%` : "—"} label="Body fat" sub={d.body.bodyFatCategory || "Add in profile"} href="/app/settings/profile" />
        <Tile icon="🔥" value={d.scores.fitness ?? "—"} label="Fitness score" sub={d.scores.fitness == null ? "Complete a workout" : "From your last 30 days"} />
        <Tile icon="♥" value={d.scores.recovery ?? "—"} label="Recovery" sub={d.scores.recovery == null ? "Do a daily check-in" : "From your check-ins"} href="/app/health" />
      </div>

      <div className="card">
        <div className="row spread"><h2 className="sectionTitle">Health overview</h2><Link className="linkBtn" href="/app/health">Details →</Link></div>
        {d.health.score == null ? <p className="subtitle" style={{ margin: "8px 0 0" }}>Not enough recorded data yet. Do your daily check-in and log meals and water.</p> : <>
          <div className="dashHealthScore" style={{ color: TONE[d.health.score >= 75 ? "ok" : d.health.score >= 50 ? "orange" : "danger"] }}>{d.health.score}<span className="muted"> / 100 overall</span></div>
          <div className="chipGrid">
            {([["Recovery", d.health.recovery?.value != null ? String(d.health.recovery.value) : null, d.health.recovery], ["Overtraining", d.health.overtraining?.label ?? null, d.health.overtraining], ["Nutrition", d.health.nutrition?.label ?? null, d.health.nutrition], ["Sleep", d.health.sleep?.label ?? null, d.health.sleep], ["Hydration", d.health.hydration?.label ?? null, d.health.hydration]] as [string, string | null, Rating][]).map(([k, v, r]) => <div className="chip" key={k}><span className="muted">{k}</span><strong style={{ color: v ? TONE[ratingTone(r?.label)] : undefined }}>{v ?? "No data"}</strong></div>)}
          </div></>}
        {d.health.notes.slice(0, 3).map((n) => <div className="small muted" key={n} style={{ marginTop: 6 }}>• {n}</div>)}
      </div>

      {d.goalPlan && <div className="card">
        <div className="row spread"><h2 className="sectionTitle">🎯 Goal plan</h2><Link className="linkBtn" href="/app/settings/workout">Adjust →</Link></div>
        <div style={{ fontWeight: 700, margin: "8px 0" }}>{GOALS[d.goalPlan.goal] || "General fitness"}</div>
        <div className="chipGrid"><div className="chip"><strong>{d.goalPlan.calories.toLocaleString()} kcal/day</strong></div><div className="chip"><strong>{d.goalPlan.protein} g protein</strong></div><div className="chip"><strong>{d.goalPlan.sessionsPerWeek}× / week</strong></div><div className="chip"><strong>{d.goalPlan.weeks ? `${d.goalPlan.weeks} weeks` : "Goal reached"}</strong></div></div>
        <p className="small muted" style={{ margin: "10px 0 0" }}>Next: {d.goalPlan.next}</p>
      </div>}

      {d.body.bmi != null && <div className="card dashRingCard">
        <Ring pct={Math.min(100, (d.body.bmi / 40) * 100)} color={TONE[d.body.bmiCategory?.tone || "orange"]}><strong>{d.body.bmi}</strong><span>BMI</span></Ring>
        <div><div className="small muted">Body Mass Index</div><div className="dashBig" style={{ color: TONE[d.body.bmiCategory?.tone || "orange"] }}>{d.body.bmiCategory?.label}</div><div className="small muted">{d.body.height} cm · {d.body.weight} kg</div></div>
      </div>}

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row spread"><h2 className="sectionTitle">Today's macros</h2><Link className="linkBtn" href="/app/nutrition">Log a meal →</Link></div>
        <Bar label="Protein" value={d.macros.protein} target={d.macros.targets?.protein} />
        <Bar label="Carbs" value={d.macros.carbs} target={d.macros.targets?.carbs} />
        <Bar label="Fat" value={d.macros.fat} target={d.macros.targets?.fat} />
      </div>

      <ProgressChart title="Calories burned — 14 days" subtitle="From finished workout blocks and tracked runs" kind="bar" unit="kcal" points={d.burned} empty="No activity logged yet." />
      <ProgressChart title="Weight trend" subtitle={d.body.targetWeight ? `Target ${d.body.targetWeight} kg` : undefined} kind="line" unit="kg" digits={1} target={d.body.targetWeight} points={d.weightSeries} connectGaps empty="Log your weight in Progress to see your trend." />
    </>}
    <HydrationTracker />
  </div>;
}
