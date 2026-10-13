"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type W = { session: { estimatedMinutes: number; moves: { role: string; name: string }[] } | null; error?: string; stale?: boolean; needsCheckin?: boolean; rest?: boolean; fitness?: { detail: string } };
type Meal = { slot: string; name: string; calories: number; protein: number; foods: { name: string }[] };
type N = { ok: boolean; error?: string; plan?: { meals: Meal[]; hydration: { mlTarget: number }; summary: string; targets?: { calories: number } }; log?: { meals: { slot: string }[]; totalCalories: number } };

/** Today's workout and nutrition. Both are built automatically the first time they are needed each day; each card opens its full screen. */
export default function TodayCard() {
  const [w, setW] = useState<W | null | "err">(null);
  const [n, setN] = useState<N | null | "err">(null);
  useEffect(() => {
    fetch("/api/workout/generate").then((r) => r.json()).then(setW).catch(() => setW("err"));
    fetch("/api/nutrition/daily").then((r) => r.json()).then(setN).catch(() => setN("err"));
  }, []);
  const moves = w && w !== "err" && w.session ? w.session.moves.filter((m) => !["hydration", "stretch", "warmup", "cooldown"].includes(m.role)) : [];
  const plan = n && n !== "err" ? n.plan : undefined;
  const kcal = plan ? plan.meals.reduce((s, m) => s + m.calories, 0) : null;
  const eaten = n && n !== "err" && n.log ? new Set(n.log.meals.map((m) => m.slot)) : new Set<string>();
  return <div className="stack">
    <div className="card todayCard">
      <div className="row spread"><div className="small muted">TODAY'S WORKOUT</div>{w && w !== "err" && w.stale && <span className="pill">Rebuild suggested</span>}</div>
      {w === null ? <p className="subtitle">Loading…</p> : w === "err" ? <p className="subtitle">Couldn't load.</p> : !w.session ? <p className="subtitle">{w.rest ? (w.fitness?.detail || "Rest today — your body needs it.") : w.needsCheckin ? "Do today's check-in, then answer a few questions and your workout is built for how you feel." : w.error || "Answer a few quick questions and your workout is built for you."}</p> : <>
        <div className="metric" style={{ fontSize: 28 }}>{w.session.estimatedMinutes} min</div>
        <p className="subtitle" style={{ margin: "4px 0 0" }}>{moves.slice(0, 3).map((m) => m.name).join(" · ")}{moves.length > 3 ? ` +${moves.length - 3} more` : ""}</p>
      </>}
      <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
        {w && w !== "err" && w.rest ? <Link className="btn secondary" href="/app/health" style={{ flex: "1 1 160px", textAlign: "center" }}>Recovery follow-up</Link> : <><Link className="btn primary" href="/app/workout?start=1" style={{ flex: "1 1 160px", textAlign: "center" }}>▶ {w && w !== "err" && w.session ? "Start workout" : "Build & start workout"}</Link><Link className="btn secondary" href="/app/workout">Plan & questions</Link></>}
      </div>
    </div>
    <div className="card todayCard">
      <div className="row spread"><div className="small muted">TODAY'S NUTRITION</div>{plan && <Link className="linkBtn" href="/app/nutrition" style={{ margin: 0 }}>Open →</Link>}</div>
      {n === null ? <p className="subtitle">Building your meals…</p> : n === "err" || !plan ? <p className="subtitle">{n === "err" ? "Couldn't load." : n.error || "Not available yet."}</p> : <>
        <div className="metric" style={{ fontSize: 28 }}>{kcal?.toLocaleString()} kcal</div>
        <div className="mealPeek">{plan.meals.map((m) => <Link key={m.slot} href="/app/nutrition" className={`mealPeekRow${eaten.has(m.slot) ? " done" : ""}`}><span>{eaten.has(m.slot) ? "✓ " : ""}{m.name}</span><span className="muted">{m.calories} kcal</span></Link>)}</div>
        <p className="small muted" style={{ margin: "8px 0 0" }}>Water goal {plan.hydration.mlTarget.toLocaleString()} ml</p>
      </>}
    </div>
  </div>;
}
