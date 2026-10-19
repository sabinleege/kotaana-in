"use client";
import { useEffect, useState } from "react";
import ExerciseDemo from "./ExerciseDemo";

type Row = { id: string; name: string; bodyPart: string | null; target: string | null; equipment: string | null; difficulty: string | null; image: string | null; gif: string | null };
type Data = { rows: Row[]; total: number; all: number; page: number; pageSize: number; parts: string[]; equipment: string[] };
const cache = new Map<string, any>();

/** Browse every exercise the app can use: search, filter by body part or equipment, and open one to see how it is done. */
export default function ExerciseLibrary() {
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState(""); const [part, setPart] = useState(""); const [eq, setEq] = useState(""); const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(async () => { const r = await fetch("/api/exercises?q=" + encodeURIComponent(q) + "&part=" + encodeURIComponent(part) + "&equipment=" + encodeURIComponent(eq) + "&page=" + page); if (r.ok) setD(await r.json()); }, 200); return () => clearTimeout(t); }, [q, part, eq, page]);
  if (!d) return <div className="card">Loading the library…</div>;
  return <div className="stack">
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row spread"><strong>{d.all.toLocaleString()} exercises in the library</strong><span className="small muted">{d.total.toLocaleString()} shown</span></div>
      <input className="input" placeholder="Search exercises" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><select className="select" style={{ flex: "1 1 150px" }} value={part} onChange={(e) => { setPart(e.target.value); setPage(0); }}><option value="">All body parts</option>{d.parts.map((p) => <option key={p}>{p}</option>)}</select><select className="select" style={{ flex: "1 1 150px" }} value={eq} onChange={(e) => { setEq(e.target.value); setPage(0); }}><option value="">All equipment</option>{d.equipment.map((p) => <option key={p}>{p}</option>)}</select></div>
    </div>
    <div className="list">{d.rows.map((r) => <div className="item moveItem" key={r.id}>
      <div className="moveHead"><div><strong>{r.name}</strong><div className="small muted">{[r.bodyPart, r.target, r.equipment, r.difficulty].filter(Boolean).join(" · ")}</div><button className="linkBtn" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide ▴" : "How to do it ▾"}</button></div></div>
      {open === r.id && <Demo id={r.id} fallback={r} />}
    </div>)}{!d.rows.length && <div className="empty">No exercise matches.</div>}</div>
    <div className="row spread"><button className="btn secondary small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button><span className="small muted">Page {page + 1} of {Math.max(1, Math.ceil(d.total / d.pageSize))}</span><button className="btn secondary small" disabled={(page + 1) * d.pageSize >= d.total} onClick={() => setPage(page + 1)}>Next →</button></div>
  </div>;
}
function Demo({ id, fallback }: { id: string; fallback: Row }) {
  const [ex, setEx] = useState<any>(cache.get(id));
  useEffect(() => { if (cache.has(id)) return; fetch("/api/exercises/" + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : null)).then((d) => { cache.set(id, d?.exercise ?? null); setEx(d?.exercise ?? null); }); }, [id]);
  const media = ex ?? fallback;
  return <div className="howTo"><div><ExerciseDemo exercise={media} /></div><div>{ex === undefined ? <p className="small muted">Loading…</p> : ex?.steps?.length ? <ol className="howSteps">{ex.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol> : <p className="small muted">No written steps yet — follow the demonstration and move with control.</p>}</div></div>;
}
