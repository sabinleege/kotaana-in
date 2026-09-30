"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Answers = { energy: number; soreness: number; mood: number; sleepHours: number };
const QUESTIONS: { key: keyof Answers; title: string; low: string; high: string; faces: string[] }[] = [
  { key: "energy", title: "How is your energy today?", low: "Drained", high: "Full of energy", faces: ["😩", "😕", "😐", "🙂", "⚡"] },
  { key: "soreness", title: "How sore are your muscles?", low: "Not sore", high: "Very sore", faces: ["💪", "🙂", "😐", "😣", "🥵"] },
  { key: "mood", title: "How is your mood?", low: "Low", high: "Great", faces: ["😞", "😕", "😐", "🙂", "😄"] },
];
const SLEEP = [4, 5, 6, 7, 8, 9, 10];
const dismissKey = () => `kotaana-readiness-later-${new Date().toLocaleDateString("en-CA")}`;

/** Once-a-day readiness questions shown as a popup until today's check-in exists. */
export default function ReadinessPrompt() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ energy: 3, soreness: 1, mood: 3, sleepHours: 8 });
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path.startsWith("/app/onboarding")) return;
    try { if (sessionStorage.getItem(dismissKey())) return; } catch {}
    fetch("/api/health/checkin").then((r) => r.ok ? r.json() : null).then((d) => { if (d && !d.checkin) setOpen(true); }).catch(() => {});
  }, [path]);

  const later = () => { try { sessionStorage.setItem(dismissKey(), "1"); } catch {} setOpen(false); };
  const submit = async () => {
    setError(null);
    const r = await fetch("/api/health/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }).catch(() => null);
    if (!r?.ok) { setError("Could not save — try again."); return; }
    const d = await r.json(); setResult(d.checkin?.readiness ?? null);
    setTimeout(() => setOpen(false), 2200);
  };

  if (!open) return null;
  const total = QUESTIONS.length + 1;
  const q = QUESTIONS[step];
  return <div className="modalScrim" role="dialog" aria-modal="true" aria-labelledby="readinessTitle">
    <div className="modalCard">
      {result != null ? <div className="readyDone"><div className="readyScore">{result}</div><h2 id="readinessTitle">Readiness saved</h2><p className="subtitle">Today's workout will be adjusted to how you feel.</p></div> : <>
        <div className="row spread"><span className="pill orange">DAILY CHECK-IN · {step + 1}/{total}</span><button className="linkBtn" onClick={later}>Later</button></div>
        <div className="stepDots">{Array.from({ length: total }, (_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
        <div key={step} className="qSlide">
          {q ? <>
            <h2 id="readinessTitle">{q.title}</h2>
            <div className="faceRow">{q.faces.map((f, i) => <button key={i} className={`face${a[q.key] === i + 1 ? " sel" : ""}`} aria-label={`${i + 1} of 5`} onClick={() => { setA({ ...a, [q.key]: i + 1 }); setStep(step + 1); }}><span>{f}</span><small>{i + 1}</small></button>)}</div>
            <div className="row spread small muted"><span>{q.low}</span><span>{q.high}</span></div>
          </> : <>
            <h2 id="readinessTitle">How many hours did you sleep?</h2>
            <div className="faceRow">{SLEEP.map((h) => <button key={h} className={`face${a.sleepHours === h ? " sel" : ""}`} onClick={() => setA({ ...a, sleepHours: h })}><span style={{ fontSize: 18, fontWeight: 900 }}>{h}{h === 10 ? "+" : ""}</span><small>h</small></button>)}</div>
            <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={submit}>Save check-in</button>
            {error && <p className="small danger">{error}</p>}
          </>}
        </div>
        {step > 0 && <button className="linkBtn" style={{ marginTop: 12 }} onClick={() => setStep(step - 1)}>← Back</button>}
      </>}
    </div>
  </div>;
}
