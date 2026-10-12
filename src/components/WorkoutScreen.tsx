"use client";
import { useEffect, useState } from "react";
import ExerciseDemo from "./ExerciseDemo";
import { equipmentOptions } from "./setup/WorkoutSetupForm";

type Session = { sessionId: string; estimatedMinutes: number; outdoor: boolean; moves: Array<any>; meta: any; postWorkoutFoodHint: string };
type Answers = { outdoorTrainingOk: boolean; workoutIntensity: "easy" | "moderate" | "hard"; primaryGoal: string; sessionDurationMin: number; equipment: string[] };

const GOALS: Record<string, string> = { general_fitness: "General fitness", fat_loss: "Fat loss", muscle_gain: "Muscle gain", endurance: "Endurance" };
const HARD: [Answers["workoutIntensity"], string, string][] = [["easy", "Easy", "Gentle, lower effort"], ["moderate", "Moderate", "Your normal level"], ["hard", "Hard", "Push a notch harder"]];
const MINUTES = [20, 30, 45, 60];
const askedKey = () => `kotaana-workout-asked-${new Date().toLocaleDateString("en-CA")}`;
const wasAsked = () => { try { return Boolean(localStorage.getItem(askedKey())); } catch { return false; } };
const markAsked = () => { try { localStorage.setItem(askedKey(), "1"); } catch {} };
const fromProfile = (p: any): Answers => ({ outdoorTrainingOk: p.outdoorTrainingOk !== false, workoutIntensity: p.workoutIntensity || "moderate", primaryGoal: p.primaryGoal || "general_fitness", sessionDurationMin: p.sessionDurationMin || 35, equipment: p.equipment?.length ? p.equipment : ["bodyweight"] });

/** Today's workout. It is built automatically; the athlete answers a few questions (where, how hard, aim, time) and presses Start. */
export default function WorkoutScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [ans, setAns] = useState<Answers | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<Record<string, string>>({});
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    setAutoStart(new URLSearchParams(window.location.search).get("start") === "1");
    Promise.all([fetch("/api/workout/generate").then((r) => r.json()), fetch("/api/profile").then((r) => r.json())]).then(([w, p]) => {
      setSession(w.session); if (!w.session && w.error) setMsg(w.error);
      setProfile(p.profile); setAns(fromProfile(p.profile)); setLoaded(true);
    }).catch(() => { setMsg("Couldn't load your workout."); setLoaded(true); });
  }, []);

  const begin = () => { setStarted(true); setAsking(false); };
  const onStart = () => { if (wasAsked()) begin(); else setAsking(true); };
  useEffect(() => { if (loaded && session && autoStart) { setAutoStart(false); onStart(); } }, [loaded, session, autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Saves the answers and rebuilds today's plan only when something that shapes it changed. */
  const applyAnswers = async (andStart: boolean) => {
    if (!ans || !profile) return;
    setBusy(true); setMsg(null);
    const before = fromProfile(profile);
    const changed = JSON.stringify(before) !== JSON.stringify(ans);
    if (changed) {
      const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ans) }).catch(() => null);
      if (!r?.ok) { setMsg("Could not save your answers."); setBusy(false); return; }
      const saved = await r.json(); setProfile(saved.profile);
      const g = await fetch("/api/workout/generate", { method: "POST" }).catch(() => null);
      const d = g ? await g.json().catch(() => ({})) : {};
      if (!g?.ok) { setMsg(d.error || d.code || "No safe plan could be built from those answers."); setBusy(false); return; }
      setSession(d.session); setDone({}); setMsg("Your workout was rebuilt from your answers.");
    }
    markAsked(); setBusy(false);
    if (andStart) begin(); else setAsking(false);
  };

  if (!loaded) return <div className="card">Loading your workout…</div>;
  const set = (patch: Partial<Answers>) => ans && setAns({ ...ans, ...patch });
  const moves = session ? session.moves : [];

  return <div className="stack">
    <div><span className="pill orange">WORKOUT</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Today's workout</h1><p className="subtitle">Built for you automatically each day, and adjusted when you check in or report an injury.</p></div>
    {msg && <div className="card small">{msg}</div>}

    {session ? <div className="card todayCard">
      <div className="row spread"><div><div className="small muted">TODAY</div><div className="metric" style={{ fontSize: 30 }}>~{session.estimatedMinutes} min</div><div className="small muted">{[ans && GOALS[ans.primaryGoal], ans && ans.workoutIntensity, session.outdoor ? "outdoor rotation" : null].filter(Boolean).join(" · ")}</div></div><span className="pill orange">Verified pool</span></div>
      {!started && <button className="btn primary" style={{ width: "100%", marginTop: 14, fontSize: 16 }} onClick={onStart}>▶ Start Workout</button>}
      {!started && <button className="linkBtn" style={{ marginTop: 10 }} onClick={() => setAsking(!asking)}>{asking ? "Hide today's questions ▴" : "Change today's questions ▾"}</button>}
    </div> : <div className="card"><div className="empty">{msg || "Finish your setup so we can build today's workout."}</div><a className="btn primary" href="/app/settings/workout" style={{ display: "block", textAlign: "center", marginTop: 12 }}>Open workout setup</a></div>}

    {asking && ans && <div className="card stack questions">
      <div><h2 className="sectionTitle">Before we start</h2><p className="small muted" style={{ margin: "4px 0 0" }}>A few quick questions so today's session fits you.</p></div>
      <div><label className="label">Where are you training?</label><div className="segRow"><button type="button" className={`seg${!ans.outdoorTrainingOk ? " sel" : ""}`} onClick={() => set({ outdoorTrainingOk: false })}>🏠 Indoor</button><button type="button" className={`seg${ans.outdoorTrainingOk ? " sel" : ""}`} onClick={() => set({ outdoorTrainingOk: true })}>🌤 Indoor or outdoor</button></div></div>
      <div><label className="label">How hard do you want it?</label><div className="segRow">{HARD.map(([k, l, sub]) => <button type="button" key={k} className={`seg${ans.workoutIntensity === k ? " sel" : ""}`} onClick={() => set({ workoutIntensity: k })}><strong>{l}</strong><small>{sub}</small></button>)}</div></div>
      <div><label className="label">What's your aim?</label><select className="select" value={ans.primaryGoal} onChange={(e) => set({ primaryGoal: e.target.value })}>{Object.entries(GOALS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label className="label">How much time do you have?</label><div className="segRow">{[...new Set([...MINUTES, ans.sessionDurationMin])].sort((x, y) => x - y).map((m) => <button type="button" key={m} className={`seg${ans.sessionDurationMin === m ? " sel" : ""}`} onClick={() => set({ sessionDurationMin: m })}>{m} min</button>)}</div></div>
      <details><summary className="small muted" style={{ cursor: "pointer" }}>Equipment available ({ans.equipment.length})</summary><div className="checkboxRow" style={{ marginTop: 8 }}>{equipmentOptions.map((x) => <label className="check" key={x}><input type="checkbox" checked={ans.equipment.includes(x)} onChange={(e) => set({ equipment: e.target.checked ? [...new Set([...ans.equipment, x])] : ans.equipment.filter((v) => v !== x) })} /> {x}</label>)}</div></details>
      <div className="row" style={{ flexWrap: "wrap" }}>{session && <button className="btn primary" style={{ flex: "1 1 160px" }} disabled={busy} onClick={() => applyAnswers(true)}>{busy ? "Building…" : "Update & start"}</button>}<button className="btn secondary" disabled={busy} onClick={() => applyAnswers(false)}>{session ? "Update only" : "Build my workout"}</button></div>
    </div>}

    {session && <div className="card">
      <div className="row spread"><div><h2 className="sectionTitle">{started ? "Your session" : "What's in it"}</h2><p className="subtitle">~{session.estimatedMinutes} minutes</p></div></div>
      <div className="list" style={{ marginTop: 12 }}>{moves.map((m: any) => <MoveRow key={`${m.order}-${m.exerciseId}`} m={m} title={`${m.order}. ${m.name}`} subtitle={`${m.role}${m.sets ? ` · ${m.sets} sets` : ""}${m.reps ? ` · ${m.reps} reps` : ""}${m.durationSec ? ` · ${m.durationSec}s` : ""}${m.estimatedMin ? ` · ~${m.estimatedMin} min` : ""}`} right={m.role === "hydration" && <span className="pill">500 ml</span>} />)}</div>
      {session.meta?.healthNotes?.length > 0 && <div className="healthNotes"><strong className="small">Adjusted for your health profile</strong><ul>{session.meta.healthNotes.map((n: string) => <li key={n}>{n}</li>)}</ul></div>}
      <p className="small muted" style={{ marginTop: 12 }}>{session.postWorkoutFoodHint}</p>
      {started && <div className="stack" style={{ marginTop: 12 }}>
        <strong>Session tracking</strong>
        {moves.filter((m: any) => m.role !== "hydration").map((m: any) => <MoveRow key={"perf-" + m.order} m={m} title={m.name} subtitle="Record how it felt after this block." right={<div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {["easy", "ok", "hard"].map((e) => <button key={e} className="btn secondary small" style={{ padding: "6px 8px" }} onClick={async () => { await fetch("/api/workout/perform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseId: m.exerciseId, exerciseName: m.name, setsDone: m.sets, repsDone: m.reps ? String(m.reps) : undefined, durationSec: m.durationSec, effort: e, completed: true }) }); setDone({ ...done, [m.exerciseId]: e }); }}>{done[m.exerciseId] === e ? "✓ " : ""}{e}</button>)}
          <button className="btn secondary small" style={{ padding: "6px 8px" }} onClick={async () => { await fetch("/api/workout/perform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exerciseId: m.exerciseId, exerciseName: m.name, effort: "easy", completed: false, notes: "Skipped during session" }) }); setDone({ ...done, [m.exerciseId]: "skipped" }); }}>{done[m.exerciseId] === "skipped" ? "✓ " : ""}skip</button></div>} />)}
        <button className="btn primary" onClick={() => { setStarted(false); setMsg("Workout recorded — well done. Your next plan will adapt from it."); }}>Finish workout</button>
      </div>}
    </div>}
  </div>;
}

const exerciseCache = new Map<string, Promise<any>>();
function loadExercise(id: string) { if (!exerciseCache.has(id)) exerciseCache.set(id, fetch("/api/exercises/" + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : null)).then((d) => d?.exercise ?? null).catch(() => null)); return exerciseCache.get(id)!; }
function MoveRow({ m, title, subtitle, right }: { m: any; title: string; subtitle: string; right?: React.ReactNode }) {
  const [open, setOpen] = useState(false); const demo = m.role !== "hydration";
  return <div className="item moveItem"><div className="moveHead"><div><strong>{title}</strong><div className="small muted">{subtitle}</div>{demo && <button className="linkBtn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide demo ▴" : "How to do it ▾"}</button>}</div>{right}</div>{open && <HowTo m={m} />}</div>;
}
function HowTo({ m }: { m: any }) {
  const [ex, setEx] = useState<any>(undefined);
  useEffect(() => { let live = true; loadExercise(m.exerciseId).then((e) => { if (live) setEx(e); }); return () => { live = false; }; }, [m.exerciseId]);
  const media = ex ?? { name: m.name, gif: m.gif, image: m.image };
  return <div className="howTo"><div><ExerciseDemo exercise={media} />{/bryllim/.test(media.image || "") && <p className="small dim" style={{ margin: "6px 0 0" }}>Illustration: <a href="https://bryllim.com" target="_blank" rel="noreferrer">Bryl Lim</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>}</div><div>{ex === undefined ? <p className="small muted">Loading instructions…</p> : ex?.steps?.length ? <ol className="howSteps">{ex.steps.map((st: string, i: number) => <li key={i}>{st}</li>)}</ol> : <p className="small muted">No written steps for this exercise yet — follow the demonstration and move with control.</p>}{ex && <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>{[...new Set([ex.target, ex.bodyPart, ex.equipment].filter(Boolean).map((t: string) => t.toLowerCase()))].map((t: string) => <span key={t} className="pill">{t}</span>)}</div>}</div></div>;
}
