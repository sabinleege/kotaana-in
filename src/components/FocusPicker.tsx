"use client";
import { FOCUS_LEVELS, FOCUS_OPTIONS } from "@/lib/workout/focus";

/** The coach / gym / club chooses what they specialise in and how demanding athletes' workouts should be. */
export default function FocusPicker({ areas, level, onChange }: { areas: string[]; level: string; onChange: (v: { areas: string[]; level: string }) => void }) {
  const toggle = (id: string) => onChange({ level, areas: areas.includes(id) ? areas.filter((x) => x !== id) : [...areas, id].slice(0, 6) });
  return <div className="stack" style={{ gap: 10 }}>
    <div><label className="label">What do you specialise in? (pick up to 6)</label><div className="checkboxRow">{FOCUS_OPTIONS.map((f) => <label className="check" key={f.id}><input type="checkbox" checked={areas.includes(f.id)} onChange={() => toggle(f.id)} /> {f.label}</label>)}</div></div>
    <div><label className="label">How demanding should your athletes' workouts be?</label><div className="segRow">{FOCUS_LEVELS.map((l) => <button type="button" key={l.id} className={`seg${level === l.id ? " sel" : ""}`} onClick={() => onChange({ areas, level: l.id })}><strong>{l.label}</strong><small>{l.sub}</small></button>)}</div></div>
    <p className="small muted" style={{ margin: 0 }}>Athletes who join you get workouts that lean towards this, built harder and more specifically. Children are never pushed beyond a safe level.</p>
  </div>;
}
