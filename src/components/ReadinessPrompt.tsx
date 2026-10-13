"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PhotoPicker from "./PhotoPicker";

type Feeling = "great" | "ok" | "off" | "sick";
type Answers = { feeling: Feeling; energy: number; soreness: number; mood: number; sleepHours: number };
const FEELINGS: { key: Feeling; emoji: string; label: string; preset: Pick<Answers, "energy" | "soreness" | "mood"> }[] = [
  { key: "great", emoji: "💪", label: "Great", preset: { energy: 5, soreness: 1, mood: 5 } },
  { key: "ok", emoji: "🙂", label: "Okay", preset: { energy: 3, soreness: 2, mood: 3 } },
  { key: "off", emoji: "😕", label: "A bit off", preset: { energy: 2, soreness: 3, mood: 2 } },
  { key: "sick", emoji: "🤒", label: "Unwell", preset: { energy: 1, soreness: 4, mood: 1 } },
];
const SLIDERS: { key: "energy" | "soreness" | "mood"; label: string }[] = [{ key: "energy", label: "Energy" }, { key: "soreness", label: "Soreness" }, { key: "mood", label: "Mood" }];
const SYMPTOMS = ["Fever", "Cough / cold", "Sore throat", "Headache", "Stomach upset", "Body aches", "Tired / weak", "Other"];
const PARTS = ["Knee", "Ankle", "Foot", "Hip", "Lower back", "Upper back", "Neck", "Shoulder", "Elbow", "Wrist / hand", "Thigh", "Calf", "Chest", "Head", "Other"];
const TYPES = ["Pain / soreness", "Sprain", "Muscle strain", "Wound / cut", "Bruise", "Swelling", "Suspected fracture", "Other"];
const dismissKey = () => `kotaana-readiness-later-${new Date().toLocaleDateString("en-CA")}`;

type Common = { severity: number; sinceDays: number; onMedication: boolean; doctorPrescribed: boolean; doctorDays: string; image: string | null };
const blank = (): Common => ({ severity: 2, sinceDays: 0, onMedication: false, doctorPrescribed: false, doctorDays: "", image: null });

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <div className="segRow"><button type="button" className={`seg${!value ? " sel" : ""}`} onClick={() => onChange(false)}>No</button><button type="button" className={`seg${value ? " sel" : ""}`} onClick={() => onChange(true)}>Yes</button></div>;
}

/** Once-a-day check-in. Everyone answers the first card; saying "sick" or "injured" opens a second card with the details we need (what, how bad, medicine or doctor, a photo) to estimate how long recovery takes. */
export default function ReadinessPrompt() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"how" | "sick" | "injury" | "done">("how");
  const [a, setA] = useState<Answers>({ feeling: "ok", ...FEELINGS[1].preset, sleepHours: 7 });
  const [isSick, setIsSick] = useState(false);
  const [isHurt, setIsHurt] = useState(false);
  const [sick, setSick] = useState({ ...blank(), symptoms: [] as string[], fever: false });
  const [hurt, setHurt] = useState({ ...blank(), bodyPart: "Knee", type: "Pain / soreness" });
  const [result, setResult] = useState<{ readiness: number | null; messages: string[] }>({ readiness: null, messages: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path.startsWith("/app/onboarding")) return;
    const force = () => setOpen(true);
    window.addEventListener("kotaana:open-checkin", force);
    try { if (sessionStorage.getItem(dismissKey())) return () => window.removeEventListener("kotaana:open-checkin", force); } catch {}
    fetch("/api/health/checkin").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && !d.checkin) setOpen(true); }).catch(() => {});
    return () => window.removeEventListener("kotaana:open-checkin", force);
  }, [path]);

  const later = () => { try { sessionStorage.setItem(dismissKey(), "1"); } catch {} setOpen(false); };
  const pick = (f: (typeof FEELINGS)[number]) => { setA({ ...a, feeling: f.key, ...f.preset }); if (f.key === "sick") setIsSick(true); };

  const saveCheckin = async () => {
    setError(null); setBusy(true);
    const r = await fetch("/api/health/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, feeling: isSick && a.feeling !== "sick" ? "off" : a.feeling }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setError("Could not save — try again."); return null; }
    const d = await r.json(); setResult({ readiness: d.checkin?.readiness ?? null, messages: [] });
    window.dispatchEvent(new Event("kotaana:checkin-saved"));
    return d.checkin?.readiness ?? null;
  };
  const next = async () => {
    const readiness = await saveCheckin(); if (readiness === null) return;
    if (isSick) setStep("sick"); else if (isHurt) setStep("injury"); else { setStep("done"); setTimeout(() => setOpen(false), 2200); }
  };
  const saveSituation = async (which: "sick" | "injury") => {
    setError(null); setBusy(true);
    const num = (s: string) => (s.trim() && Number(s) > 0 ? Math.round(Number(s)) : null);
    const body: any = {};
    if (which === "sick") body.illness = { severity: sick.severity, sinceDays: sick.sinceDays, onMedication: sick.onMedication, doctorPrescribed: sick.doctorPrescribed, doctorDays: num(sick.doctorDays), image: sick.image, symptoms: sick.symptoms.length ? sick.symptoms : ["Unwell"], fever: sick.fever || sick.symptoms.includes("Fever") };
    else body.injury = { severity: hurt.severity, sinceDays: hurt.sinceDays, onMedication: hurt.onMedication, doctorPrescribed: hurt.doctorPrescribed, doctorDays: num(hurt.doctorDays), image: hurt.image, bodyPart: hurt.bodyPart, type: hurt.type };
    const r = await fetch("/api/health/situation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(d.error || "Could not save — try again."); return; }
    setResult((x) => ({ ...x, messages: [...x.messages, ...(d.messages || [])] }));
    if (which === "sick" && isHurt) setStep("injury"); else { setStep("done"); }
  };

  if (!open) return null;
  const detail = (s: Common, set: (c: any) => void, label: string) => <>
    <div className="sliderRow"><div className="row spread"><label>How bad is it?</label><strong>{s.severity}/5</strong></div><input type="range" min={1} max={5} step={1} value={s.severity} onChange={(e) => set({ ...s, severity: Number(e.target.value) })} /><div className="row spread small muted"><span>Mild</span><span>Severe</span></div></div>
    <div className="row spread" style={{ marginBottom: 12 }}><label className="muted">Since how many days?</label><input className="input sleepInput" type="number" min={0} max={365} value={s.sinceDays} onChange={(e) => set({ ...s, sinceDays: Math.max(0, Number(e.target.value)) })} /></div>
    <div style={{ marginBottom: 12 }}><label className="label">Are you taking medicine for it?</label><YesNo value={s.onMedication} onChange={(v) => set({ ...s, onMedication: v })} /></div>
    <div style={{ marginBottom: 12 }}><label className="label">Has a doctor seen it or prescribed treatment?</label><YesNo value={s.doctorPrescribed} onChange={(v) => set({ ...s, doctorPrescribed: v })} /></div>
    {s.doctorPrescribed && <div className="row spread" style={{ marginBottom: 12 }}><label className="muted">Doctor says recovery in (days)</label><input className="input sleepInput" type="number" min={1} inputMode="numeric" placeholder="optional" value={s.doctorDays} onChange={(e) => set({ ...s, doctorDays: e.target.value })} /></div>}
    <div style={{ marginBottom: 14 }}><label className="label">Photo {label} (optional — helps estimate recovery)</label><PhotoPicker value={s.image} onChange={(v) => set({ ...s, image: v })} /></div>
  </>;

  return <div className="modalScrim" role="dialog" aria-modal="true" aria-labelledby="readinessTitle">
    <div className="modalCard checkinCard">
      {step === "done" ? <div className="readyDone"><div className="readyScore">{result.readiness ?? "✓"}</div><h2 id="readinessTitle">Check-in saved</h2><p className="subtitle">Your workout questions are next — today's plan will fit how you feel.</p>{result.messages.map((m) => <p key={m} className="small" style={{ margin: "6px 0" }}>{m}</p>)}{result.messages.length > 0 && <><p className="small muted">These are estimates, not a diagnosis.</p><button className="btn primary" style={{ width: "100%", marginTop: 10 }} onClick={() => setOpen(false)}>OK</button></>}</div>
      : step === "how" ? <>
        <div className="row spread"><h2 id="readinessTitle" style={{ margin: 0 }}>How are you today?</h2><button className="sideClose" aria-label="Close" onClick={later}>×</button></div>
        <p className="subtitle" style={{ margin: "6px 0 14px" }}>Your answers tune today's plan to your body.</p>
        <div className="feelRow">{FEELINGS.map((f) => <button key={f.key} type="button" className={`feel${a.feeling === f.key ? " sel" : ""}`} aria-pressed={a.feeling === f.key} onClick={() => pick(f)}><span>{f.emoji}</span><small>{f.label}</small></button>)}</div>
        {SLIDERS.map((s) => <div className="sliderRow" key={s.key}><div className="row spread"><label htmlFor={`rd-${s.key}`}>{s.label}</label><strong>{a[s.key]}/5</strong></div><input id={`rd-${s.key}`} type="range" min={1} max={5} step={1} value={a[s.key]} onChange={(e) => setA({ ...a, [s.key]: Number(e.target.value) })} /></div>)}
        <div className="row spread" style={{ margin: "6px 0 12px" }}><label htmlFor="rd-sleep" className="muted">Sleep (hours)</label><input id="rd-sleep" className="input sleepInput" type="number" inputMode="decimal" min={0} max={24} step={0.5} value={a.sleepHours} onChange={(e) => setA({ ...a, sleepHours: Math.max(0, Math.min(24, Number(e.target.value))) })} /></div>
        <div className="questionPair"><div><label className="label">Are you sick today?</label><YesNo value={isSick} onChange={setIsSick} /></div><div><label className="label">Any injury or pain?</label><YesNo value={isHurt} onChange={setIsHurt} /></div></div>
        <div className="row" style={{ marginTop: 14 }}><button className="btn secondary" style={{ flex: 1 }} onClick={later}>Later</button><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={next}>{busy ? "Saving…" : isSick || isHurt ? "Next" : "Save"}</button></div>
        {error && <p className="small danger" style={{ marginBottom: 0 }}>{error}</p>}
      </>
      : step === "sick" ? <>
        <h2 id="readinessTitle" style={{ margin: 0 }}>Tell us about feeling unwell</h2><p className="subtitle" style={{ margin: "6px 0 12px" }}>So we can rest you properly and estimate the days to full fitness.</p>
        <label className="label">What are you feeling?</label><div className="checkboxRow" style={{ marginBottom: 12 }}>{SYMPTOMS.map((x) => <label className="check" key={x}><input type="checkbox" checked={sick.symptoms.includes(x)} onChange={(e) => setSick({ ...sick, symptoms: e.target.checked ? [...sick.symptoms, x] : sick.symptoms.filter((v) => v !== x) })} /> {x}</label>)}</div>
        {detail(sick, setSick as any, "of how you look")}
        <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={() => saveSituation("sick")}>{busy ? "Saving…" : isHurt ? "Next: injury" : "Save"}</button>{error && <p className="small danger">{error}</p>}
      </>
      : <>
        <h2 id="readinessTitle" style={{ margin: 0 }}>Tell us about the injury or pain</h2><p className="subtitle" style={{ margin: "6px 0 12px" }}>Your workout will avoid this area while it heals.</p>
        <div className="formGrid" style={{ marginBottom: 12 }}><div><label className="label">Where?</label><select className="select" value={hurt.bodyPart} onChange={(e) => setHurt({ ...hurt, bodyPart: e.target.value })}>{PARTS.map((x) => <option key={x}>{x}</option>)}</select></div><div><label className="label">What kind?</label><select className="select" value={hurt.type} onChange={(e) => setHurt({ ...hurt, type: e.target.value })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></div></div>
        {detail(hurt, setHurt as any, "of the injury")}
        <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={() => saveSituation("injury")}>{busy ? "Saving…" : "Save"}</button>{error && <p className="small danger">{error}</p>}
      </>}
    </div>
  </div>;
}
