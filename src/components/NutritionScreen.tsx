"use client";
import { useEffect, useRef, useState } from "react";
import NutritionPrefsForm from "./setup/NutritionPrefsForm";
import HydrationTracker from "./HydrationTracker";

type Alt = { name: string; portion: string; calories: number };
type Food = { id: string; name: string; servingSize: string | null; calories: number; protein: number; carbs: number; fat: number; grams?: number; alternatives?: Alt[] };
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
      {([["Breakfast", ["breakfast"]], ["Lunch", ["lunch"]], ["Dinner", ["dinner"]], ["Snacks & post-workout", ["snack", "post_workout"]]] as [string, string[]][]).map(([title, slots]) => {
        const meals = plan.meals.filter((m) => slots.includes(m.slot)); if (!meals.length) return null;
        const kcal = meals.reduce((n, m) => n + m.calories, 0); const allLogged = meals.every((m) => logged(m.slot));
        return <details className={`card mealSection${allLogged ? " logged" : ""}`} key={title} open={open === title}>
          <summary onClick={(e) => { e.preventDefault(); setOpen(open === title ? null : title); }}>
            <div className="row spread" style={{ alignItems: "flex-start" }}>
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}><span className="mealIcon">{ICON[meals[0].slot] || "🍽"}</span><div><h2 className="sectionTitle" style={{ margin: 0 }}>{title}</h2><div className="small muted">{meals.flatMap((m) => m.foods).map((f) => `${f.name.split(",")[0]} ${f.grams ? f.grams + " g" : (f.servingSize || "")}`.trim()).join(" · ")}</div></div></div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}><strong style={{ fontSize: 20 }}>{kcal}</strong><div className="small muted">kcal {open === title ? "▴" : "▾"}</div></div>
            </div>
            {allLogged && <div className="row" style={{ marginTop: 8 }}><span className="prio low">eaten</span></div>}
          </summary>
          {open === title && meals.map((m) => {
            const l = logged(m.slot);
            return <div key={m.slot} className="stack" style={{ gap: 10, marginTop: 14 }}>
              {meals.length > 1 && <div className="row spread"><strong>{m.name}</strong><span className="small muted">{m.calories} kcal</span></div>}
              <div className="tableWrap"><table className="nutriTable"><thead><tr><th>Food</th><th>Quantity</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead>
                <tbody>{m.foods.map((f, i) => <>
                  <tr key={f.id + i}><td className="foodName" title={f.name}>{f.name.split(",").slice(0, 3).join(",")}</td><td>{f.grams ? `${f.grams} g` : f.servingSize || "1 serving"}{f.grams && f.servingSize ? <div className="small muted">{f.servingSize}</div> : null}</td><td>{f.calories}</td><td>{f.protein} g</td><td>{f.carbs} g</td><td>{f.fat} g</td></tr>
                  {f.alternatives && f.alternatives.length > 0 && <tr key={f.id + i + "alt"} className="altRow"><td colSpan={6}><span className="altLabel">Or instead</span>{f.alternatives.map((a) => <span className="altChip" key={a.name}>{a.name.split(",").slice(0, 2).join(",")} · {a.portion}</span>)}</td></tr>}
                </>)}</tbody>
                <tfoot><tr><td colSpan={2}>Total</td><td>{m.calories}</td><td>{m.protein} g</td><td>{m.carbs ?? "—"}{m.carbs != null ? " g" : ""}</td><td>{m.fat ?? "—"}{m.fat != null ? " g" : ""}</td></tr></tfoot></table></div>
              {m.note && <p className="small muted" style={{ margin: 0 }}>💡 {m.note}</p>}
              {l && <div className="row" style={{ flexWrap: "wrap" }}><span className={`prio ${STATUS[l.status].cls}`}>{STATUS[l.status].text}</span>{l.status !== "eaten" && l.calories !== m.calories && <span className="small muted">counted as {l.calories} kcal</span>}</div>}
              {l?.note && <p className="small muted" style={{ margin: 0 }}>{l.note}</p>}
              <div className="row" style={{ flexWrap: "wrap" }}>
                {!l ? <button className="btn primary small" disabled={busy === m.slot} onClick={() => send(m.slot, {})}>✓ I ate this</button> : <button className="btn secondary small" disabled={busy === m.slot} onClick={() => send(m.slot, { remove: true })}>Undo</button>}
                <button className="btn secondary small" disabled={busy === m.slot} onClick={() => { photoFor.current = m.slot; fileRef.current?.click(); }}>📷 {l ? "Re-check with photo" : "Verify with photo"}</button>
              </div>
            </div>;
          })}
        </details>;
      })}
    </div>

    {plan.healthNotes?.length > 0 && <div className="healthNotes"><strong className="small">Adjusted for your health profile</strong><ul>{plan.healthNotes.map((n) => <li key={n}>{n}</li>)}</ul></div>}
    <HydrationTracker note={plan.weatherNote} />
    <p className="small muted" style={{ margin: 0 }}>{plan.summary}</p>
    <div className="row" style={{ flexWrap: "wrap" }}><button className="btn secondary" disabled={busy === "plan"} onClick={() => confirm("Replace today's meal plan with a new one? Meals you already logged stay logged.") && load(true)}>{busy === "plan" ? "Planning…" : "↻ New meal plan"}</button></div>
    <details className="card prefsCard"><summary><h2 className="sectionTitle">Preferences</h2><span className="small muted">Calories, diet style, foods to avoid and meals per day</span></summary><div style={{ marginTop: 12 }}><NutritionPrefsForm onSaved={() => load()} /></div></details>
  </div>;
}
