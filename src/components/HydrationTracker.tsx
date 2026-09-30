"use client";
import { useEffect, useState } from "react";

type State = { day: string; glasses: number; glassMl: number; consumedMl: number; targetMl: number; targetGlasses: number };
const localDay = () => new Date().toLocaleDateString("en-CA");

/** Animated daily water check-off: tap once per glass drunk and watch the glass fill. */
export default function HydrationTracker({ note }: { note?: string }) {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/hydration?day=${localDay()}`).then((r) => r.ok ? r.json() : Promise.reject()).then(setS).catch(() => setError("Could not load today's water log."));
  }, []);

  const change = async (delta: 1 | -1) => {
    if (!s || busy) return;
    setBusy(true); setError(null);
    const optimistic = { ...s, glasses: Math.max(0, s.glasses + delta), consumedMl: Math.max(0, s.glasses + delta) * s.glassMl };
    setS(optimistic); if (delta > 0) setPulse((p) => p + 1);
    const r = await fetch("/api/hydration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: s.day, delta }) }).catch(() => null);
    if (r?.ok) setS(await r.json()); else { setS(s); setError("Not saved — check your connection and try again."); }
    setBusy(false);
  };

  if (!s) return <div className="card"><h2 className="sectionTitle">Hydration</h2><p className="subtitle">{error || "Loading today's water…"}</p></div>;

  const pct = Math.min(100, Math.round((s.consumedMl / s.targetMl) * 100));
  const done = s.consumedMl >= s.targetMl;
  const slots = Math.max(s.targetGlasses, s.glasses);
  return <div className={`card hydration${done ? " done" : ""}`}>
    <div className="row spread" style={{ alignItems: "flex-start" }}>
      <div><h2 className="sectionTitle">Hydration</h2><p className="subtitle">{note || "Tap each time you finish a glass of water."}</p></div>
      {done && <span className="pill hydroBadge">✓ Goal reached</span>}
    </div>
    <div className="hydroBody">
      <div className="glass" aria-hidden="true">
        <div className="water" style={{ transform: `translateY(${100 - pct}%)` }}><div className="wave" /></div>
        {pulse > 0 && <span key={pulse} className="drop" />}
        <div className="glassPct">{pct}%</div>
      </div>
      <div className="hydroInfo">
        <div className="hydroAmount"><strong>{s.consumedMl.toLocaleString()}</strong> / {s.targetMl.toLocaleString()} ml</div>
        <div className="small muted">{s.glasses} of {s.targetGlasses} glasses · {s.glassMl} ml each · plus 500 ml between workout blocks</div>
        <div className="glassRow" role="list" aria-label={`${s.glasses} of ${s.targetGlasses} glasses drunk`}>
          {Array.from({ length: slots }, (_, i) => <span role="listitem" key={i} className={`cup${i < s.glasses ? " full" : ""}`} title={`Glass ${i + 1}`}>{i < s.glasses ? "✓" : ""}</span>)}
        </div>
        <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => change(1)} disabled={busy}>💧 I drank a glass</button>
          <button className="btn secondary" onClick={() => change(-1)} disabled={busy || s.glasses === 0}>Undo</button>
        </div>
        {error && <p className="small danger" style={{ marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  </div>;
}
