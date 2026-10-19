"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ExerciseDemo from "./ExerciseDemo";
import { equipmentOptions } from "./setup/WorkoutSetupForm";
import { cue, getCueMode, setCueMode, type CueMode } from "@/lib/cues";

type Session = { sessionId: string; estimatedMinutes: number; outdoor: boolean; moves: Array<any>; meta: any; postWorkoutFoodHint: string };
type Answers = { outdoorTrainingOk: boolean; workoutIntensity: "easy" | "moderate" | "hard"; primaryGoal: string; goals: string[]; sessionDurationMin: number; equipment: string[] };
type Fitness = { state: "fit" | "light" | "rest"; label: string; detail: string; daysToFit: number | null };
type Usage = { used: number; limit: number };

const GOALS: Record<string, string> = { general_fitness: "General fitness", fat_loss: "Fat loss", muscle_gain: "Muscle gain", endurance: "Endurance" };
const HARD: [Answers["workoutIntensity"], string, string][] = [["easy", "Easy", "Gentle, lower effort"], ["moderate", "Moderate", "Your normal level"], ["hard", "Hard", "Push a notch harder"]];
const MINUTES = [20, 30, 45, 60];
const fromProfile = (p: any): Answers => ({ outdoorTrainingOk: p.outdoorTrainingOk !== false, workoutIntensity: p.workoutIntensity || "moderate", primaryGoal: p.primaryGoal || "general_fitness", goals: p.goals?.length ? p.goals : [p.primaryGoal || "general_fitness"], sessionDurationMin: p.sessionDurationMin || 35, equipment: p.equipment?.length ? p.equipment : ["bodyweight"] });
const AREAS = ["Knee", "Ankle", "Foot", "Hip", "Lower back", "Upper back", "Neck", "Shoulder", "Elbow", "Wrist / hand", "Thigh", "Calf", "Chest", "Other"];

/** Today's workout. Nothing is built at login: the athlete does the check-in, answers a few questions, and only then is the session made. */
export default function WorkoutScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<{ needsCheckin: boolean; stale: boolean; rest: boolean; fitness: Fitness | null; usage: Usage | null; error?: string }>({ needsCheckin: false, stale: false, rest: false, fitness: null, usage: null });
  const [profile, setProfile] = useState<any>(null);
  const [ans, setAns] = useState<Answers | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<Record<string, string>>({});
  const [checkout, setCheckout] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);
  const [cueMode, setMode] = useState<CueMode>("both");
  const autoStart = useRef(false);

  const load = useCallback(async () => {
    const [w, p] = await Promise.all([fetch("/api/workout/generate").then((r) => r.json()), fetch("/api/profile").then((r) => r.json())]).catch(() => [null, null] as any);
    if (!w) { setMsg("Couldn't load your workout."); setLoaded(true); return; }
    if (w.code === "ACCESS_EXPIRED") { window.location.href = "/app/settings/subscription?expired=1"; return; }
    setSession(w.session); setState({ needsCheckin: Boolean(w.needsCheckin), stale: Boolean(w.stale), rest: Boolean(w.rest), fitness: w.fitness ?? null, usage: w.usage ?? null, error: w.error });
    if (p?.profile) { setProfile(p.profile); setAns(fromProfile(p.profile)); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    autoStart.current = new URLSearchParams(window.location.search).get("start") === "1"; setMode(getCueMode());
    void load();
    const again = () => void load();
    window.addEventListener("kotaana:checkin-saved", again);
    return () => window.removeEventListener("kotaana:checkin-saved", again);
  }, [load]);

  const begin = useCallback(async () => {
    const r = await fetch("/api/workout/start", { method: "POST" }).catch(() => null);
    if (r?.status === 402) { window.location.href = "/app/settings/subscription?expired=1"; return; }
    setStarted(true); setAsking(false); setFinished(null); cue("done");
  }, []);
  useEffect(() => { if (loaded && session && autoStart.current) { autoStart.current = false; void begin(); } }, [loaded, session, begin]);

  /** Saves the answers and builds today's plan. The server refuses a fourth build in a day. */
  const build = async () => {
    if (!ans || !profile) return;
    setBusy(true); setMsg(null);
    if (JSON.stringify(fromProfile(profile)) !== JSON.stringify(ans)) {
      const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ans) }).catch(() => null);
      if (!r?.ok) { setMsg("Could not save your answers."); setBusy(false); return; }
      setProfile((await r.json()).profile);
    }
    const g = await fetch("/api/workout/generate", { method: "POST" }).catch(() => null);
    const d = g ? await g.json().catch(() => ({})) : {};
    setBusy(false);
    if (d.needsCheckin) { setState((s) => ({ ...s, needsCheckin: true })); setMsg(d.error); return; }
    if (d.rest) { setSession(null); setState((s) => ({ ...s, rest: true, fitness: d.fitness })); setAsking(false); return; }
    if (!g?.ok) { setMsg(d.error || d.code || "No safe plan could be built from those answers."); return; }
    setSession(d.session); setDone({}); setAsking(false); setStarted(false); setState((s) => ({ ...s, stale: false, usage: d.usage ?? s.usage, needsCheckin: false }));
    setMsg(`Your workout is ready — built from ${d.session.meta.candidateCount} safe exercises that fit your goal.`);
  };

  const mark = async (m: any, effort: "easy" | "ok" | "hard" | "skipped") => {
    const body = effort === "skipped" ? { exerciseId: m.exerciseId, exerciseName: m.name, effort: "easy", completed: false, notes: "Skipped during session" } : { exerciseId: m.exerciseId, exerciseName: m.name, setsDone: m.sets, repsDone: m.reps ? String(m.reps) : undefined, durationSec: m.durationSec, effort, completed: true };
    await fetch("/api/workout/perform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setDone((d) => ({ ...d, [m.exerciseId]: effort })); cue("done");
  };

  if (!loaded) return <div className="card">Loading your workout…</div>;
  const set = (patch: Partial<Answers>) => ans && setAns({ ...ans, ...patch });
  const moves = session ? session.moves : [];
  const trackable = moves.filter((m: any) => m.role !== "hydration");
  const doneCount = trackable.filter((m: any) => done[m.exerciseId]).length;
  const rebuildsLeft = state.usage ? Math.max(0, state.usage.limit - state.usage.used) : null;

  const questions = ans && <div className="card stack questions">
    <div><h2 className="sectionTitle">Before we build your workout</h2><p className="small muted" style={{ margin: "4px 0 0" }}>A few quick questions so today's session fits you. {rebuildsLeft != null && `You can build ${rebuildsLeft} more time${rebuildsLeft === 1 ? "" : "s"} today.`}</p></div>
    <div><label className="label">Where are you training?</label><div className="segRow"><button type="button" className={`seg${!ans.outdoorTrainingOk ? " sel" : ""}`} onClick={() => set({ outdoorTrainingOk: false })}>🏠 Indoor only</button><button type="button" className={`seg${ans.outdoorTrainingOk ? " sel" : ""}`} onClick={() => set({ outdoorTrainingOk: true })}>🌤 Indoor or outdoor</button></div></div>
    <div><label className="label">How hard do you want it?</label><div className="segRow">{HARD.map(([k, l, sub]) => <button type="button" key={k} className={`seg${ans.workoutIntensity === k ? " sel" : ""}`} onClick={() => set({ workoutIntensity: k })}><strong>{l}</strong><small>{sub}</small></button>)}</div></div>
    <div><label className="label">What are your aims? (pick up to 3)</label><div className="segRow">{Object.entries(GOALS).map(([k, l]) => <button type="button" key={k} className={`seg${ans.goals.includes(k) ? " sel" : ""}`} onClick={() => { const next = ans.goals.includes(k) ? ans.goals.filter((x) => x !== k) : [...ans.goals, k].slice(-3); const goals = next.length ? next : [k]; set({ goals, primaryGoal: goals[0] }); }}>{l}</button>)}</div><p className="small muted" style={{ margin: "4px 0 0" }}>Your plan only contains work that serves your aims, with at least one block for each.</p></div>
    <div><label className="label">How much time do you have?</label><div className="segRow">{[...new Set([...MINUTES, ans.sessionDurationMin])].sort((x, y) => x - y).map((m) => <button type="button" key={m} className={`seg${ans.sessionDurationMin === m ? " sel" : ""}`} onClick={() => set({ sessionDurationMin: m })}>{m} min</button>)}</div></div>
    <details><summary className="small muted" style={{ cursor: "pointer" }}>Equipment available ({ans.equipment.length})</summary><div className="checkboxRow" style={{ marginTop: 8 }}>{equipmentOptions.map((x) => <label className="check" key={x}><input type="checkbox" checked={ans.equipment.includes(x)} onChange={(e) => set({ equipment: e.target.checked ? [...new Set([...ans.equipment, x])] : ans.equipment.filter((v) => v !== x) })} /> {x}</label>)}</div></details>
    <div className="row" style={{ flexWrap: "wrap" }}><button className="btn primary" style={{ flex: "1 1 180px" }} disabled={busy || rebuildsLeft === 0} onClick={build}>{busy ? "Building…" : session ? "Rebuild my workout" : "Build my workout"}</button>{session && <button className="btn secondary" onClick={() => setAsking(false)}>Cancel</button>}</div>
  </div>;

  return <div className="stack">
    <div><span className="pill orange">WORKOUT</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Today's workout</h1><p className="subtitle">Built from your check-in and your answers — it adjusts when your health changes.</p></div>
    {msg && <div className="card small">{msg}</div>}
    {state.fitness && state.fitness.state !== "fit" && <div className={`card fitCard ${state.fitness.state}`}><strong>{state.fitness.label}</strong><p className="small" style={{ margin: "4px 0 0" }}>{state.fitness.detail}</p></div>}

    {state.rest && !session ? <div className="card"><h2 className="sectionTitle">Rest day</h2><p className="subtitle">{state.fitness?.detail || "Your body needs rest today."} We'll build a workout again as soon as you're well. Keep your follow-ups up to date so we can estimate your return.</p></div>
    : state.needsCheckin && !session ? <div className="card"><h2 className="sectionTitle">Check in first</h2><p className="subtitle">A workout is built from how you feel today — including whether you're sick or hurt. It takes 20 seconds.</p><button className="btn primary" style={{ marginTop: 10 }} onClick={() => window.dispatchEvent(new Event("kotaana:open-checkin"))}>Open today's check-in</button></div>
    : !session ? (state.error ? <div className="card"><div className="empty">{state.error}</div><a className="btn primary" href="/app/onboarding" style={{ display: "block", textAlign: "center", marginTop: 12 }}>Finish setup</a></div> : questions)
    : <>
      <div className="card todayCard">
        <div className="row spread"><div><div className="small muted">TODAY</div><div className="metric" style={{ fontSize: 30 }}>~{session.estimatedMinutes} min</div><div className="small muted">{[(ans?.goals || []).map((g) => GOALS[g]).join(" + "), ans?.workoutIntensity, session.outdoor ? "outdoor rotation" : null].filter(Boolean).join(" · ")}</div></div><span className="pill orange">Goal-focused</span></div>
        {state.stale && !started && <p className="small" style={{ margin: "10px 0 0", color: "var(--orange2)" }}>Your health info changed after this plan was made — rebuild it so it stays safe.</p>}
        {!started && !finished && <button className="btn primary" style={{ width: "100%", marginTop: 14, fontSize: 16 }} onClick={begin}>▶ Start Workout</button>}
        {started && <div className="row spread" style={{ marginTop: 12 }}><strong>{doneCount} of {trackable.length} blocks done</strong><select className="select cueSelect" aria-label="Reminders" value={cueMode} onChange={(e) => { setMode(e.target.value as CueMode); setCueMode(e.target.value as CueMode); cue("done"); }}><option value="both">🔔 Vibrate + sound</option><option value="vibrate">📳 Vibrate</option><option value="sound">🔊 Sound</option><option value="off">🔕 Off</option></select></div>}
        {started && <div className="barTrack big" style={{ marginTop: 8 }}><div className="barFill" style={{ width: `${trackable.length ? (doneCount / trackable.length) * 100 : 0}%` }} /></div>}
        {!started && <button className="linkBtn" style={{ marginTop: 10 }} onClick={() => setAsking(!asking)}>{asking ? "Hide questions ▴" : `Change my answers & rebuild${rebuildsLeft != null ? ` (${rebuildsLeft} left today)` : ""} ▾`}</button>}
      </div>
      {asking && questions}
      {finished && <div className="card"><h2 className="sectionTitle">Session finished</h2><p className="subtitle">{finished}</p></div>}

      <div className="card">
        <h2 className="sectionTitle">{started ? "Your session" : "What's in it"}</h2>
        <div className="list" style={{ marginTop: 12 }}>{moves.map((m: any) => m.role === "hydration" ? <div key={`${m.order}-w`} className="item"><span>💧 {m.name}</span><span className="pill">500 ml</span></div> : <MoveRow key={`${m.order}-${m.exerciseId}`} m={m} started={started} state={done[m.exerciseId]} onMark={mark} />)}</div>
        {session.meta?.healthNotes?.length > 0 && <div className="healthNotes"><strong className="small">Adjusted for your health profile</strong><ul>{session.meta.healthNotes.map((n: string) => <li key={n}>{n}</li>)}</ul></div>}
        <p className="small muted" style={{ marginTop: 12 }}>{session.postWorkoutFoodHint}</p>
        {started && !checkout && <button className="btn primary" style={{ width: "100%", marginTop: 8 }} onClick={() => setCheckout(true)}>Finish workout</button>}
      </div>
      {started && checkout && <Checkout onCancel={() => setCheckout(false)} onDone={(text) => { setStarted(false); setCheckout(false); setFinished(text); cue("finish"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
    </>}
  </div>;
}

/** After the last block: how hard it felt, how the body feels, and any pain — saved so tomorrow's plan can use it. */
function Checkout({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [rpe, setRpe] = useState(6); const [felt, setFelt] = useState<"great" | "good" | "tough" | "exhausted">("good");
  const [pain, setPain] = useState(false); const [area, setArea] = useState("Knee"); const [sev, setSev] = useState(2); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/workout/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rpe, felt, pain, painArea: pain ? area : undefined, painSeverity: pain ? sev : undefined, notes: notes.trim() || undefined }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setErr(d.error || "Could not save the check-out."); return; }
    onDone(d.message);
  };
  return <div className="card stack questions">
    <div><h2 className="sectionTitle">Check-out</h2><p className="small muted" style={{ margin: "4px 0 0" }}>Two minutes to close the session properly.</p></div>
    <div className="sliderRow"><div className="row spread"><label>How hard was the whole session?</label><strong>{rpe}/10</strong></div><input type="range" min={1} max={10} step={1} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} /><div className="row spread small muted"><span>Very easy</span><span>Max effort</span></div></div>
    <div><label className="label">How do you feel now?</label><div className="segRow">{([["great", "😄 Great"], ["good", "🙂 Good"], ["tough", "😓 Tough"], ["exhausted", "🥵 Exhausted"]] as const).map(([k, l]) => <button type="button" key={k} className={`seg${felt === k ? " sel" : ""}`} onClick={() => setFelt(k)}>{l}</button>)}</div></div>
    <div><label className="label">Any pain or discomfort during training?</label><div className="segRow"><button type="button" className={`seg${!pain ? " sel" : ""}`} onClick={() => setPain(false)}>No</button><button type="button" className={`seg${pain ? " sel" : ""}`} onClick={() => setPain(true)}>Yes</button></div></div>
    {pain && <div className="formGrid"><div><label className="label">Where?</label><select className="select" value={area} onChange={(e) => setArea(e.target.value)}>{AREAS.map((x) => <option key={x}>{x}</option>)}</select></div><div><label className="label">How bad? ({sev}/5)</label><input type="range" min={1} max={5} value={sev} onChange={(e) => setSev(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--orange)" }} /></div></div>}
    <div><label className="label">Anything else? (optional)</label><textarea className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></div>
    <div className="row" style={{ flexWrap: "wrap" }}><button className="btn primary" style={{ flex: "1 1 160px" }} disabled={busy} onClick={send}>{busy ? "Saving…" : "Save & finish"}</button><button className="btn secondary" onClick={onCancel}>Back</button></div>
    {err && <p className="small danger" style={{ margin: 0 }}>{err}</p>}
  </div>;
}

/** Optional countdown for timed blocks, with vibration and a beep at zero. */
function BlockTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left == null) return;
    if (left <= 0) { cue("timer"); setLeft(null); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return left == null ? <button className="btn secondary small" onClick={() => setLeft(seconds)}>⏱ Timer {seconds}s</button> : <button className="btn primary small" onClick={() => setLeft(null)}>{left}s · stop</button>;
}

function MoveRow({ m, started, state, onMark }: { m: any; started: boolean; state?: string; onMark: (m: any, e: "easy" | "ok" | "hard" | "skipped") => void }) {
  const [open, setOpen] = useState(false);
  const sub = `${m.role}${m.sets ? ` · ${m.sets} sets` : ""}${m.reps ? ` · ${m.reps} reps` : ""}${m.durationSec ? ` · ${m.durationSec}s` : ""}${m.restSec ? ` · rest ${m.restSec}s` : ""}${m.estimatedMin ? ` · ~${m.estimatedMin} min` : ""}`;
  return <div className={`item moveItem${state ? " moveDone" : ""}`}>
    <div className="moveHead"><div><strong>{state && state !== "skipped" ? "✓ " : ""}{m.order}. {m.name}</strong><div className="small muted">{sub}</div>{m.format && <span className="pill orange" style={{ marginTop: 4 }}>New format: {m.format}</span>}<button className="linkBtn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide demo ▴" : "How to do it ▾"}</button></div></div>
    {m.notes && <p className="small muted" style={{ margin: 0 }}>{m.notes}</p>}
    {started && <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
      {m.durationSec ? <BlockTimer seconds={m.durationSec} /> : null}
      {(["easy", "ok", "hard"] as const).map((e) => <button key={e} className="btn secondary small" style={{ padding: "6px 10px" }} onClick={() => onMark(m, e)}>{state === e ? "✓ " : ""}Done · {e}</button>)}
      <button className="btn secondary small" style={{ padding: "6px 10px" }} onClick={() => onMark(m, "skipped")}>{state === "skipped" ? "✓ " : ""}skip</button>
    </div>}
    {open && <HowTo m={m} />}
  </div>;
}

const exerciseCache = new Map<string, Promise<any>>();
function loadExercise(id: string) { if (!exerciseCache.has(id)) exerciseCache.set(id, fetch("/api/exercises/" + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : null)).then((d) => d?.exercise ?? null).catch(() => null)); return exerciseCache.get(id)!; }
function HowTo({ m }: { m: any }) {
  const [ex, setEx] = useState<any>(undefined);
  useEffect(() => { let live = true; loadExercise(m.exerciseId).then((e) => { if (live) setEx(e); }); return () => { live = false; }; }, [m.exerciseId]);
  const media = ex ?? { name: m.name, gif: m.gif, image: m.image };
  return <div className="howTo"><div><ExerciseDemo exercise={media} />{/bryllim/.test(media.image || "") && <p className="small dim" style={{ margin: "6px 0 0" }}>Illustration: <a href="https://bryllim.com" target="_blank" rel="noreferrer">Bryl Lim</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>}</div><div>{ex === undefined ? <p className="small muted">Loading instructions…</p> : ex?.steps?.length ? <ol className="howSteps">{ex.steps.map((st: string, i: number) => <li key={i}>{st}</li>)}</ol> : <p className="small muted">No written steps for this exercise yet — follow the demonstration and move with control.</p>}{ex && <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>{[...new Set([ex.target, ex.bodyPart, ex.equipment].filter(Boolean).map((t: string) => t.toLowerCase()))].map((t: string) => <span key={t} className="pill">{t}</span>)}</div>}</div></div>;
}
