"use client";
import { useEffect, useRef, useState } from "react";
import NutritionPrefsForm from "./setup/NutritionPrefsForm";
import HydrationTracker from "./HydrationTracker";

type Food = { id: string; name: string; servingSize: string | null; calories: number; protein: number; carbs: number; fat: number };
type Meal = { slot: string; name: string; foods: Food[]; calories: number; protein: number; carbs?: number; fat?: number; note?: string };
type Plan = { meals: Meal[]; hydration: { mlTarget: number }; healthNotes: string[]; summary: string; weatherNote: string; locationLabel: string; source?: "ai" | "library"; targets?: { calories: number; protein: number; carbs: number; fat: number } };
type Logged = { slot: string; calories: number; protein: number; carbs: number; fat: number; status: "eaten" | "verified" | "partial" | "mismatch" | "unchecked"; note?: string };
type Log = { meals: Logged[]; totalCalories: number; totalProtein: number };

const ICON: Record<string, string> = { breakfast: "🌅", lunch: "🍲", snack: "🍎", dinner: "🌙", post_workout: "💪" };
const STATUS: Record<Logged["status"], { text: string; cls: string }> = {
  eaten: { text: "Logged", cls: "low" }, verified: { text: "Photo matches ✓", cls: "low" }, partial: { text: "Partly matches", cls: "normal" }, mismatch: { text: "Doesn't match plan", cls: "high" }, unchecked: { text: "Logged · photo unchecked", cls: "normal" },
};

/** Shrinks a camera photo to a small JPEG before upload so the check is fast on mobile data. */
async function toDataUrl(file: File, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

function Macro({ label, value, target }: { label: string; value: number; target?: number }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return <div><div className="row spread small"><span className="muted">{label}</span><strong>{Math.round(value)}{target ? ` / ${target}` : ""} g</strong></div><div className="barTrack"><div className="barFill" style={{ width: `${pct}%` }} /></div></div>;
}

export default function NutritionScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [log, setLog] = useState<Log>({ meals: [], totalCalories: 0, totalProtein: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoFor = useRef<string>("");

  const load = async (force = false) => {
    setBusy(force ? "plan" : null);
    const n = await fetch("/api/nutrition/daily", { method: force ? "POST" : "GET" }).then((r) => r.json()).catch(() => ({ ok: false, error: "Couldn't load nutrition." }));
    setBusy(null);
    if (!n.ok) { setMsg(n.error); return; }
    setPlan(n.plan); setLog(n.log); if (force) setMsg("New meal plan ready for today.");
  };
  useEffect(() => { void load(); }, []);

  const send = async (slot: string, extra: { image?: string; remove?: boolean }) => {
    setBusy(slot); setMsg(null);
    const r = await fetch("/api/nutrition/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot, ...extra }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    if (!r?.ok) { setMsg(d.error || "Could not log that meal."); return; }
    setLog(d.log); setMsg(d.message);
  };
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const slot = photoFor.current; setBusy(slot); setMsg("Checking your photo…");
    try { await send(slot, { image: await toDataUrl(f) }); } catch { setBusy(null); setMsg("Couldn't read that photo."); }
  };

  if (!plan) return <div className="card">{msg || "Planning your meals…"}</div>;
  const planned = plan.meals.reduce((n, m) => n + m.calories, 0);
  const tgt = plan.targets;
  const sum = (k: "protein" | "carbs" | "fat") => log.meals.reduce((n, m) => n + (m[k] || 0), 0);
  const logged = (slot: string) => log.meals.find((m) => m.slot === slot);

  return <div className="stack">
    <div><span className="pill orange">NUTRITION</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Daily fuel</h1><p className="subtitle">Today's meals with calories, planned for where you live and how you train. Log each one — or snap a photo to check it against the plan.</p></div>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
    {msg && <div className="card small">{msg}</div>}

    <div className="card stack nutriHero" style={{ gap: 12 }}>
      <div className="row spread" style={{ alignItems: "flex-end" }}><div><div className="small muted">EATEN TODAY</div><div className="metric" style={{ fontSize: 34 }}>{log.totalCalories.toLocaleString()} <span className="small muted">/ {(tgt?.calories ?? planned).toLocaleString()} kcal</span></div></div><span className="pill">{plan.source === "ai" ? "✦ AI regional plan" : "Verified food library"}</span></div>
      <div className="barTrack big"><div className="barFill" style={{ width: `${Math.min(100, (log.totalCalories / Math.max(1, tgt?.calories ?? planned)) * 100)}%` }} /></div>
      <Macro label="Protein" value={sum("protein")} target={tgt?.protein} />
      <Macro label="Carbs" value={sum("carbs")} target={tgt?.carbs} />
      <Macro label="Fat" value={sum("fat")} target={tgt?.fat} />
      <div className="small muted">Planned today: {planned.toLocaleString()} kcal across {plan.meals.length} meals · {plan.locationLabel}</div>
    </div>

    <div className="stack mealList">
      {plan.meals.map((m) => {
        const l = logged(m.slot); const isOpen = open === m.slot || !l;
        return <div className={`card mealCard${l ? " logged" : ""}`} key={m.slot}>
          <div className="row spread" style={{ alignItems: "flex-start" }}>
            <div className="row" style={{ alignItems: "flex-start", gap: 12 }}><span className="mealIcon">{ICON[m.slot] || "🍽"}</span><div><h2 className="sectionTitle" style={{ margin: 0 }}>{m.name}</h2><div className="small muted">{m.protein} g protein{m.carbs != null ? ` · ${m.carbs} g carbs` : ""}{m.fat != null ? ` · ${m.fat} g fat` : ""}</div></div></div>
            <div style={{ textAlign: "right" }}><strong style={{ fontSize: 20 }}>{m.calories}</strong><div className="small muted">kcal</div></div>
          </div>
          {l && <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}><span className={`prio ${STATUS[l.status].cls}`}>{STATUS[l.status].text}</span>{l.status !== "eaten" && l.calories !== m.calories && <span className="small muted">counted as {l.calories} kcal</span>}<button className="linkBtn" style={{ margin: 0 }} onClick={() => setOpen(open === m.slot ? null : m.slot)}>{isOpen ? "Hide ▴" : "Details ▾"}</button></div>}
          {l?.note && <p className="small muted" style={{ margin: "6px 0 0" }}>{l.note}</p>}
          {isOpen && <div className="list" style={{ marginTop: 12 }}>{m.foods.map((f, i) => <div className="item" key={f.id + i}><div style={{ minWidth: 0 }}><strong>{f.name}</strong><div className="small muted">{f.servingSize || "1 serving"} · {f.protein} g P · {f.carbs} g C · {f.fat} g F</div></div><strong>{f.calories} <span className="small muted">kcal</span></strong></div>)}</div>}
          {isOpen && m.note && <p className="small muted" style={{ margin: "8px 0 0" }}>💡 {m.note}</p>}
          <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {!l ? <button className="btn primary small" disabled={busy === m.slot} onClick={() => send(m.slot, {})}>✓ I ate this</button> : <button className="btn secondary small" disabled={busy === m.slot} onClick={() => send(m.slot, { remove: true })}>Undo</button>}
            <button className="btn secondary small" disabled={busy === m.slot} onClick={() => { photoFor.current = m.slot; fileRef.current?.click(); }}>📷 {l ? "Re-check with photo" : "Verify with photo"}</button>
          </div>
        </div>;
      })}
    </div>

    {plan.healthNotes?.length > 0 && <div className="healthNotes"><strong className="small">Adjusted for your health profile</strong><ul>{plan.healthNotes.map((n) => <li key={n}>{n}</li>)}</ul></div>}
    <HydrationTracker note={plan.weatherNote} />
    <p className="small muted" style={{ margin: 0 }}>{plan.summary}</p>
    <div className="row" style={{ flexWrap: "wrap" }}><button className="btn secondary" disabled={busy === "plan"} onClick={() => confirm("Replace today's meal plan with a new one? Meals you already logged stay logged.") && load(true)}>{busy === "plan" ? "Planning…" : "↻ New meal plan"}</button></div>
    <details className="card prefsCard"><summary><h2 className="sectionTitle">Preferences</h2><span className="small muted">Calories, diet style, foods to avoid and meals per day</span></summary><div style={{ marginTop: 12 }}><NutritionPrefsForm onSaved={() => load()} /></div></details>
  </div>;
}
