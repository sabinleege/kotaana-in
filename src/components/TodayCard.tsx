"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type W = { session: { estimatedMinutes: number; moves: { role: string; name: string }[] } | null; error?: string; auto?: string };
type N = { ok: boolean; error?: string; plan?: { meals: { calories: number }[]; hydration: { mlTarget: number }; summary: string } };

/** Today's workout and nutrition, created automatically on first load each day. */
export default function TodayCard() {
  const [w, setW] = useState<W | null | "err">(null);
  const [n, setN] = useState<N | null | "err">(null);
  useEffect(() => {
    fetch("/api/workout/generate").then((r) => r.json()).then(setW).catch(() => setW("err"));
    fetch("/api/nutrition/daily").then((r) => r.json()).then(setN).catch(() => setN("err"));
  }, []);
  const moves = w && w !== "err" && w.session ? w.session.moves.filter((m) => !["hydration", "stretch", "warmup", "cooldown"].includes(m.role)) : [];
  const kcal = n && n !== "err" && n.plan ? n.plan.meals.reduce((s, m) => s + m.calories, 0) : null;
  return <div className="grid grid2">
    <Link className="card" href="/app/workout"><div className="small muted">TODAY'S WORKOUT</div>
      {w === null ? <p className="subtitle">Building your workout…</p> : w === "err" || !w.session ? <p className="subtitle">{w === "err" ? "Couldn't load." : w.error || "Finish your setup so we can build today's workout."}</p> : <><div className="metric" style={{ fontSize: 24 }}>{w.session.estimatedMinutes} min</div><p className="subtitle" style={{ margin: "4px 0 0" }}>{moves.slice(0, 3).map((m) => m.name).join(" · ")}{moves.length > 3 ? ` +${moves.length - 3} more` : ""}</p>{w.auto && <div className="small muted" style={{ marginTop: 6 }}>{w.auto === "health_change" ? "Updated for your latest health check-in" : "Created for today"}</div>}</>}
    </Link>
    <Link className="card" href="/app/nutrition"><div className="small muted">TODAY'S NUTRITION</div>
      {n === null ? <p className="subtitle">Building your meals…</p> : n === "err" || !n.plan ? <p className="subtitle">{n === "err" ? "Couldn't load." : n.error || "Not available yet."}</p> : <><div className="metric" style={{ fontSize: 24 }}>{kcal?.toLocaleString()} kcal</div><p className="subtitle" style={{ margin: "4px 0 0" }}>{n.plan.meals.length} meals · water {n.plan.hydration.mlTarget.toLocaleString()} ml</p></>}
    </Link>
  </div>;
}
