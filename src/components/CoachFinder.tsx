"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Coach = { id: string; name: string; avatar: string | null; city: string | null; payable?: boolean; priceRwf: number | null; momoNumber: string | null; momoName: string | null };

/** Search coaches by name and pick one; the connection is made immediately. */
export default function CoachFinder({ currentCoachId, currentCoachName }: { currentCoachId?: string | null; currentCoachName?: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Coach[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearched(false); return; }
    const t = setTimeout(async () => {
      const r = await fetch("/api/connections/search?q=" + encodeURIComponent(term)).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (r?.ok) { setResults(d.results || []); setSearched(true); } else setMsg({ ok: false, text: d.error || "Search failed." });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const choose = async (c: Coach) => {
    if (currentCoachId && currentCoachId !== c.id && !confirm(`Switch from ${currentCoachName || "your current coach"} to ${c.name}? Your data will go to ${c.name} from now on.`)) return;
    setBusy(c.id); setMsg(null);
    const r = await fetch("/api/connections/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coachId: c.id }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    setMsg(r?.ok ? { ok: true, text: d.message || "Connected." } : { ok: false, text: d.error || "Could not connect." });
    if (r?.ok) { setQ(""); router.refresh(); }
  };

  return <div className="card stack">
    <div><h2 className="sectionTitle">{currentCoachId ? "Switch coach" : "Find your coach"}</h2><p className="subtitle" style={{ margin: "4px 0 0" }}>Type the name of your coach or gym. Choose them and you are connected straight away.</p></div>
    <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Coach or gym name" autoComplete="off" />
    {msg && <p className={`small ${msg.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{msg.text}</p>}
    <div className="list">
      {results.map((c) => <div className="item" key={c.id}>
        <div style={{ minWidth: 0 }}><strong>{c.name}</strong><div className="small muted">{[c.city, c.priceRwf ? `${c.priceRwf.toLocaleString()} RWF / 30 days` : "Price not set yet", c.payable === false ? "Not taking payments yet" : null].filter(Boolean).join(" · ")}</div></div>
        {c.id === currentCoachId ? <span className="pill">✓ Your coach</span> : <button className="btn primary small" disabled={busy === c.id} onClick={() => choose(c)}>{busy === c.id ? "…" : "Choose"}</button>}
      </div>)}
      {searched && !results.length && <div className="empty">No coach found with that name.</div>}
    </div>
  </div>;
}
