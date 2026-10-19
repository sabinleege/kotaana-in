"use client";
import { useCallback, useEffect, useState } from "react";

type Row = { id: string; name: string; bodyPart: string | null; target: string | null; equipment: string | null; difficulty: string | null; steps: string[]; instructions: string | null; image: string | null; gif: string | null; safetyTags: string[]; contraindicationTags: string[]; safetyReviewed: boolean; verified: boolean };
type Data = { rows: Row[]; total: number; page: number; pageSize: number; stats: { all: number; reviewed: number; hidden: number }; onlyReviewed: boolean; options: { contra: string[]; safety: string[] } };
const FILTERS = [["todo", "To review"], ["noinstructions", "No instructions"], ["reviewed", "Reviewed"], ["hidden", "Hidden"]] as const;

export default function ExerciseReview() {
  const [d, setD] = useState<Data | null>(null);
  const [filter, setFilter] = useState("todo"); const [q, setQ] = useState(""); const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Record<string, { safety: string[]; contra: string[] }>>({});
  const load = useCallback(async () => { const r = await fetch(`/api/admin/exercises?filter=${filter}&q=${encodeURIComponent(q)}&page=${page}`); if (r.ok) setD(await r.json()); }, [filter, q, page]);
  useEffect(() => { void load(); }, [load]);
  const send = async (body: unknown) => { await fetch("/api/admin/exercises", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); await load(); };
  if (!d) return <div className="card">Loading…</div>;
  const pct = Math.round((d.stats.reviewed / Math.max(1, d.stats.all)) * 100);
  const tags = (r: Row) => edit[r.id] ?? { safety: r.safetyTags, contra: r.contraindicationTags };
  const toggle = (r: Row, kind: "safety" | "contra", t: string) => { const cur = tags(r); const list = cur[kind]; setEdit({ ...edit, [r.id]: { ...cur, [kind]: list.includes(t) ? list.filter((x) => x !== t) : [...list, t] } }); };
  return <div className="stack">
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row spread"><strong>{d.stats.reviewed} of {d.stats.all} reviewed ({pct}%)</strong><span className="small muted">{d.stats.hidden} hidden</span></div>
      <div className="barTrack big"><div className="barFill" style={{ width: `${pct}%` }} /></div>
      <label className="check"><input type="checkbox" checked={d.onlyReviewed} onChange={(e) => send({ action: "require_reviewed", value: e.target.checked })} /> Only use reviewed exercises in athletes' workouts (turn on once enough are reviewed)</label>
    </div>
    <div className="row" style={{ flexWrap: "wrap" }}>{FILTERS.map(([k, l]) => <button key={k} className={`rangeBtn${filter === k ? " on" : ""}`} onClick={() => { setFilter(k); setPage(0); }}>{l}</button>)}<input className="input" style={{ flex: "1 1 200px" }} placeholder="Search by name" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
    <div className="rowList">{d.rows.map((r) => <div className="solid stack" style={{ gap: 8 }} key={r.id}>
      <div className="row spread" style={{ alignItems: "flex-start" }}><div><strong>{r.name}</strong><div className="small muted">{[r.bodyPart, r.target, r.equipment, r.difficulty].filter(Boolean).join(" · ")}</div></div>{r.safetyReviewed ? <span className="prio low">reviewed</span> : <span className="prio high">to review</span>}</div>
      <div className="small muted">{r.steps.length ? `${r.steps.length} written steps` : r.instructions ? "Has instructions" : "⚠ No instructions written"}{r.image || r.gif ? " · has picture" : " · no picture"}</div>
      {r.steps.length > 0 && <details><summary className="small muted" style={{ cursor: "pointer" }}>Read the steps</summary><ol className="howSteps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></details>}
      <div><div className="small muted">Risky for (tick what applies):</div><div className="checkboxRow">{d.options.contra.map((t) => <label className="check" key={t}><input type="checkbox" checked={tags(r).contra.includes(t)} onChange={() => toggle(r, "contra", t)} /> {t.replace("_", " ")}</label>)}</div></div>
      <div><div className="small muted">Safety flags:</div><div className="checkboxRow">{d.options.safety.map((t) => <label className="check" key={t}><input type="checkbox" checked={tags(r).safety.includes(t)} onChange={() => toggle(r, "safety", t)} /> {t.replace("_", " ")}</label>)}</div></div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn primary small" onClick={() => send({ action: "approve", id: r.id, safetyTags: tags(r).safety, contraindicationTags: tags(r).contra })}>✓ Tags are right — mark reviewed</button>
        {r.verified ? <button className="btn secondary small" onClick={() => send({ action: "hide", id: r.id })}>Hide from workouts</button> : <button className="btn secondary small" onClick={() => send({ action: "restore", id: r.id })}>Restore</button>}
      </div>
    </div>)}{!d.rows.length && <div className="empty">Nothing here.</div>}</div>
    <div className="row spread"><button className="btn secondary small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button><span className="small muted">{d.total ? `${page * d.pageSize + 1}–${Math.min(d.total, (page + 1) * d.pageSize)} of ${d.total}` : "0"}</span><button className="btn secondary small" disabled={(page + 1) * d.pageSize >= d.total} onClick={() => setPage(page + 1)}>Next →</button></div>
  </div>;
}
