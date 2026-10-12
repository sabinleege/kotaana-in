"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Feeling = "great" | "ok" | "off" | "sick";
type Answers = { feeling: Feeling; energy: number; soreness: number; mood: number; sleepHours: number };
const FEELINGS: { key: Feeling; emoji: string; label: string; preset: Pick<Answers, "energy" | "soreness" | "mood"> }[] = [
  { key: "great", emoji: "💪", label: "Great", preset: { energy: 5, soreness: 1, mood: 5 } },
  { key: "ok", emoji: "🙂", label: "Okay", preset: { energy: 3, soreness: 2, mood: 3 } },
  { key: "off", emoji: "😕", label: "A bit off", preset: { energy: 2, soreness: 3, mood: 2 } },
  { key: "sick", emoji: "🤒", label: "Unwell", preset: { energy: 1, soreness: 4, mood: 1 } },
];
const SLIDERS: { key: "energy" | "soreness" | "mood"; label: string }[] = [
  { key: "energy", label: "Energy" }, { key: "soreness", label: "Soreness" }, { key: "mood", label: "Mood" },
];
const dismissKey = () => `kotaana-readiness-later-${new Date().toLocaleDateString("en-CA")}`;

/** Once-a-day check-in, shown as a single card until today's answers are saved. */
export default function ReadinessPrompt() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<Answers>({ feeling: "ok", ...FEELINGS[1].preset, sleepHours: 7 });
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path.startsWith("/app/onboarding")) return;
    try { if (sessionStorage.getItem(dismissKey())) return; } catch {}
    fetch("/api/health/checkin").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && !d.checkin) setOpen(true); }).catch(() => {});
  }, [path]);

  const later = () => { try { sessionStorage.setItem(dismissKey(), "1"); } catch {} setOpen(false); };
  const submit = async () => {
    setError(null); setBusy(true);
    const r = await fetch("/api/health/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setError("Could not save — try again."); return; }
    const d = await r.json(); setResult(d.checkin?.readiness ?? null);
    setTimeout(() => setOpen(false), 2200);
  };
  const pick = (f: (typeof FEELINGS)[number]) => setA({ ...a, feeling: f.key, ...f.preset });

  if (!open) return null;
  return <div className="modalScrim" role="dialog" aria-modal="true" aria-labelledby="readinessTitle">
    <div className="modalCard checkinCard">
      {result != null ? <div className="readyDone"><div className="readyScore">{result}</div><h2 id="readinessTitle">Readiness saved</h2><p className="subtitle">Today's workout will be adjusted to how you feel.</p></div> : <>
        <div className="row spread"><h2 id="readinessTitle" style={{ margin: 0 }}>How are you today?</h2><button className="sideClose" aria-label="Close" onClick={later}>×</button></div>
        <p className="subtitle" style={{ margin: "6px 0 14px" }}>Your answers tune today's plan to your body.</p>
        <div className="feelRow">{FEELINGS.map((f) => <button key={f.key} type="button" className={`feel${a.feeling === f.key ? " sel" : ""}`} aria-pressed={a.feeling === f.key} onClick={() => pick(f)}><span>{f.emoji}</span><small>{f.label}</small></button>)}</div>
        {SLIDERS.map((s) => <div className="sliderRow" key={s.key}><div className="row spread"><label htmlFor={`rd-${s.key}`}>{s.label}</label><strong>{a[s.key]}/5</strong></div><input id={`rd-${s.key}`} type="range" min={1} max={5} step={1} value={a[s.key]} onChange={(e) => setA({ ...a, [s.key]: Number(e.target.value) })} /></div>)}
        <div className="row spread" style={{ margin: "6px 0 16px" }}><label htmlFor="rd-sleep" className="muted">Sleep (hours)</label><input id="rd-sleep" className="input sleepInput" type="number" inputMode="decimal" min={0} max={24} step={0.5} value={a.sleepHours} onChange={(e) => setA({ ...a, sleepHours: Math.max(0, Math.min(24, Number(e.target.value))) })} /></div>
        <div className="row"><button className="btn secondary" style={{ flex: 1 }} onClick={later}>Later</button><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save"}</button></div>
        {error && <p className="small danger" style={{ marginBottom: 0 }}>{error}</p>}
      </>}
    </div>
  </div>;
}
