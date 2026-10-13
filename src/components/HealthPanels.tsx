"use client";
import Link from "next/link";
import { useState } from "react";
import PhotoPicker from "./PhotoPicker";

export type FitItem = { id: string; kind: string; title: string; severity: number; percent: number; daysLeft: number; followUpDue: boolean; doctorPrescribed: boolean; onMedication: boolean; source: string | null };
export type Fitness = { state: "fit" | "light" | "rest"; label: string; detail: string; daysToFit: number | null; items: FitItem[]; pregnancy: { week: number | null; trimester: number | null; daysToDue: number | null } | null };
const SRC: Record<string, string> = { doctor: "doctor's timeline", photo_ai: "estimate adjusted from your photo", rule: "estimate" };

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  return { ok: Boolean(r?.ok), d };
}

/** "Fit for workout" — or how many days remain to full fitness — with each open injury, illness and pregnancy shown with estimated progress. */
export function FitnessCard({ f, onChanged }: { f: Fitness; onChanged: () => void }) {
  return <div className="card stack" style={{ gap: 12 }}>
    <div className="statusCard"><span className={`statusDot ${f.state}`} /><div style={{ flex: 1 }}><div className="small muted">FITNESS FOR TRAINING</div><div style={{ fontSize: 20, fontWeight: 850 }}>{f.label}</div><div className="small muted">{f.detail}</div></div>{f.daysToFit != null && <div style={{ textAlign: "right" }}><div className="dashBig">{f.daysToFit}</div><div className="small muted">day{f.daysToFit === 1 ? "" : "s"} to full fitness</div></div>}</div>
    {f.pregnancy && <div className="chipGrid"><div className="chip"><span className="muted">Pregnancy</span><strong>{f.pregnancy.week ? `Week ${f.pregnancy.week}` : "Add due date"}</strong></div><div className="chip"><span className="muted">{f.pregnancy.daysToDue != null ? "Days to due date" : "Trimester"}</span><strong>{f.pregnancy.daysToDue != null ? Math.max(0, f.pregnancy.daysToDue) : f.pregnancy.trimester ?? "—"}</strong></div></div>}
    {f.items.map((i) => <FollowItem key={i.id} i={i} onChanged={onChanged} />)}
    <p className="small dim" style={{ margin: 0 }}>Estimates only — not a diagnosis. See a doctor if something is getting worse.</p>
  </div>;
}

function FollowItem({ i, onChanged }: { i: FitItem; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [trend, setTrend] = useState<"better" | "same" | "worse">("same"); const [pain, setPain] = useState(3); const [med, setMed] = useState(i.onMedication);
  const [doctor, setDoctor] = useState(""); const [image, setImage] = useState<string | null>(null); const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false); const [out, setOut] = useState<string[]>([]);
  const send = async () => {
    setBusy(true);
    const { ok, d } = await post("/api/health/followup", { injuryId: i.id, trend, pain, onMedication: med, doctorDays: doctor.trim() ? Number(doctor) : null, image, resolved });
    setBusy(false); setOut(ok ? d.messages : [d.error || "Could not save."]); if (ok) { setOpen(false); onChanged(); }
  };
  return <div className="healCard noteRow">
    <div className="row spread"><strong>{i.kind === "illness" ? "🤒" : "🩹"} {i.title}</strong><span className={`prio ${i.followUpDue ? "high" : "low"}`}>{i.followUpDue ? "follow-up due" : `${i.percent}% healed`}</span></div>
    <div className="barTrack"><div className="barFill" style={{ width: `${i.percent}%` }} /></div>
    <div className="small muted">About {i.daysLeft} day{i.daysLeft === 1 ? "" : "s"} left · {SRC[i.source || "rule"]}{i.doctorPrescribed ? " · doctor involved" : ""}{i.onMedication ? " · on medicine" : ""}</div>
    {out.map((m) => <div key={m} className="small">{m}</div>)}
    {!open ? <button className="linkBtn" style={{ textAlign: "left" }} onClick={() => setOpen(true)}>{i.followUpDue ? "How is it going? Update now →" : "Update how it's going →"}</button> : <div className="stack" style={{ gap: 10, marginTop: 6 }}>
      <div><label className="label">Compared with last time</label><div className="segRow">{(["better", "same", "worse"] as const).map((t) => <button type="button" key={t} className={`seg${trend === t ? " sel" : ""}`} onClick={() => setTrend(t)}>{t === "better" ? "😊 Better" : t === "same" ? "😐 Same" : "😣 Worse"}</button>)}</div></div>
      <div className="sliderRow" style={{ margin: 0 }}><div className="row spread"><label>Pain or discomfort now</label><strong>{pain}/10</strong></div><input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} /></div>
      <div><label className="label">Still taking medicine?</label><div className="segRow"><button type="button" className={`seg${!med ? " sel" : ""}`} onClick={() => setMed(false)}>No</button><button type="button" className={`seg${med ? " sel" : ""}`} onClick={() => setMed(true)}>Yes</button></div></div>
      <div className="row spread"><label className="muted">Doctor says days left (optional)</label><input className="input sleepInput" type="number" min={1} inputMode="numeric" value={doctor} onChange={(e) => setDoctor(e.target.value)} /></div>
      <div><label className="label">Progress photo (optional)</label><PhotoPicker value={image} onChange={setImage} /></div>
      <label className="check"><input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} /> It's fully healed</label>
      <div className="row"><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={send}>{busy ? "Saving…" : "Save update"}</button><button className="btn secondary" onClick={() => setOpen(false)}>Cancel</button></div>
    </div>}
  </div>;
}

/** Weekly situation questions, or the monthly "keep my details current" questions. */
export function QuestionnaireCard({ kind, onDone, pregnant }: { kind: "weekly" | "monthly"; onDone: () => void; pregnant: boolean }) {
  const [a, setA] = useState<any>(kind === "weekly" ? { sleep: "ok", stress: 3, pain: false, goalFeel: "on_track", mealsRegular: true } : { weightKg: "", targetWeight: "", trainingDaysPerWeek: 3, level: "beginner", primaryGoal: "general_fitness", sessionDurationMin: 35, newHealthIssue: false });
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const num = (s: string) => (s.trim() && Number(s) > 0 ? Number(s) : undefined);
  const send = async () => {
    setBusy(true); setErr(null);
    const answers = kind === "weekly" ? { ...a, weightKg: num(weight) } : { ...a, weightKg: num(String(a.weightKg)), targetWeight: a.targetWeight === "" ? undefined : num(String(a.targetWeight)) };
    const { ok, d } = await post("/api/questionnaire", { kind, answers });
    setBusy(false); if (!ok) { setErr(d.error || "Please answer every question."); return; }
    if (d.reviewNow) await post("/api/ai/review", { kind: "monthly", force: true });
    onDone();
  };
  const seg = (key: string, opts: [any, string][]) => <div className="segRow">{opts.map(([v, l]) => <button type="button" key={String(v)} className={`seg${a[key] === v ? " sel" : ""}`} onClick={() => setA({ ...a, [key]: v })}>{l}</button>)}</div>;
  return <div className="card stack">
    <div><span className="pill orange">{kind === "weekly" ? "WEEKLY QUESTIONS" : "MONTHLY UPDATE"}</span><h2 className="sectionTitle" style={{ marginTop: 8 }}>{kind === "weekly" ? "How was your week?" : "Keep your details current"}</h2><p className="small muted" style={{ margin: "4px 0 0" }}>{kind === "weekly" ? "A minute of answers lets us follow up properly and write your summary." : "Your answers update your profile so every plan is built from today's facts."}</p></div>
    {kind === "weekly" ? <>
      <div className="row spread"><label className="muted">Weight today (kg, optional)</label><input className="input sleepInput" type="number" step="0.1" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
      <div><label className="label">Sleep this week</label>{seg("sleep", [["good", "Good"], ["ok", "OK"], ["poor", "Poor"]])}</div>
      <div className="sliderRow" style={{ margin: 0 }}><div className="row spread"><label>Stress</label><strong>{a.stress}/5</strong></div><input type="range" min={1} max={5} value={a.stress} onChange={(e) => setA({ ...a, stress: Number(e.target.value) })} /></div>
      <div><label className="label">Any pain or health worry right now?</label>{seg("pain", [[false, "No"], [true, "Yes"]])}</div>
      <div><label className="label">Your goal is…</label>{seg("goalFeel", [["ahead", "Ahead"], ["on_track", "On track"], ["behind", "Behind"]])}</div>
      <div><label className="label">Did you eat regular meals?</label>{seg("mealsRegular", [[true, "Yes"], [false, "Not really"]])}</div>
      {pregnant && <div><label className="label">How are you feeling in your pregnancy?</label>{seg("pregnancyFeeling", [["good", "Good"], ["tired", "Tired"], ["unwell", "Unwell"]])}</div>}
    </> : <>
      <div className="formGrid"><div><label className="label">Weight now (kg)</label><input className="input" type="number" step="0.1" value={a.weightKg} onChange={(e) => setA({ ...a, weightKg: e.target.value })} /></div><div><label className="label">Target weight (kg)</label><input className="input" type="number" step="0.1" value={a.targetWeight} onChange={(e) => setA({ ...a, targetWeight: e.target.value })} /></div></div>
      <div><label className="label">Training days per week</label>{seg("trainingDaysPerWeek", [1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)] as [any, string]))}</div>
      <div><label className="label">Your level now</label>{seg("level", [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]])}</div>
      <div><label className="label">Your main goal</label>{seg("primaryGoal", [["general_fitness", "General"], ["fat_loss", "Fat loss"], ["muscle_gain", "Muscle"], ["endurance", "Endurance"]])}</div>
      <div><label className="label">Minutes per session</label>{seg("sessionDurationMin", [20, 30, 45, 60].map((n) => [n, String(n)] as [any, string]))}</div>
      <div><label className="label">Any new health issue this month?</label>{seg("newHealthIssue", [[false, "No"], [true, "Yes — I'll add it in the check-in"]])}</div>
    </>}
    <div className="row"><button className="btn primary" style={{ flex: 1 }} disabled={busy || (kind === "monthly" && !(Number(a.weightKg) > 0))} onClick={send}>{busy ? "Saving…" : "Save answers"}</button></div>
    {err && <p className="small danger" style={{ margin: 0 }}>{err}</p>}
  </div>;
}

type Review = { summary: string; wins: string[]; concerns: string[]; suggestions: string[]; createdAt: string; source?: string };
/** The 3–7 day review (and monthly one) written by the larger model from everything recorded. */
export function ReviewCard({ latest, due, onChanged }: { latest: Review | null; due: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const make = async () => { setBusy(true); await post("/api/ai/review", { kind: "review", force: true }); setBusy(false); onChanged(); };
  if (!latest && !due) return null;
  return <div className="card stack" style={{ gap: 8 }}>
    <div className="row spread"><h2 className="sectionTitle">Your progress review</h2>{due && <button className="btn primary small" disabled={busy} onClick={make}>{busy ? "Writing…" : latest ? "Update review" : "Get my review"}</button>}</div>
    {latest ? <>
      <p style={{ margin: 0, lineHeight: 1.5 }}>{latest.summary}</p>
      {latest.wins.length > 0 && <><strong className="small">What's working</strong><ul className="reviewList">{latest.wins.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {latest.concerns.length > 0 && <><strong className="small">Watch</strong><ul className="reviewList">{latest.concerns.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {latest.suggestions.length > 0 && <><strong className="small">Suggested changes</strong><ul className="reviewList">{latest.suggestions.map((x) => <li key={x}>{x}</li>)}</ul></>}
      <p className="small dim" style={{ margin: 0 }}>{new Date(latest.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })} · {latest.source === "review-model" ? "written by the larger review model" : latest.source === "standard-model" ? "written by the AI model" : "from your recorded numbers"}</p>
    </> : <p className="subtitle" style={{ margin: 0 }}>Your first review is ready to write from your check-ins, workouts and meals.</p>}
  </div>;
}

type Note = { id: string; title: string; message: string; read: boolean; createdAt: string };
export function NotificationsCard({ unread, items }: { unread: number; items: Note[] }) {
  return <div className="card stack" style={{ gap: 8 }}>
    <div className="row spread"><h2 className="sectionTitle">Notifications{unread ? ` (${unread})` : ""}</h2><Link className="linkBtn" href="/app/notifications" style={{ margin: 0 }}>See all →</Link></div>
    {items.length ? items.map((n) => <div key={n.id} className={`noteRow${n.read ? "" : " unread"}`}><strong>{n.title}</strong><span className="muted">{n.message}</span></div>) : <p className="subtitle" style={{ margin: 0 }}>Nothing new.</p>}
  </div>;
}
