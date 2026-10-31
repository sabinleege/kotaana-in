"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** AI share of the price (capped at 50%), monthly hosting cost, and a button to run the weekly/monthly summaries now. */
export default function CostControls({ share, infraUsdMonth, priceUsd }: { share: number; infraUsdMonth: number; priceUsd: number }) {
  const router = useRouter();
  const [v, setV] = useState({ pct: Math.round(share * 100), infra: infraUsdMonth });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const save = async () => {
    setBusy("save"); setMsg(null);
    const r = await fetch("/api/admin/costs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ share: v.pct / 100, infraUsdMonth: v.infra }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(null); setMsg(r?.ok ? { ok: true, text: "Saved." } : { ok: false, text: d.error || "Could not save." }); if (r?.ok) router.refresh();
  };
  const compact = async () => {
    setBusy("compact"); setMsg(null);
    const r = await fetch("/api/cron/compact").catch(() => null); const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(null); setMsg(r?.ok ? { ok: true, text: `Summarised ${d.weeks} week(s) for ${d.users} athlete(s); ${d.rows} raw rows folded into summaries.` } : { ok: false, text: d.error || "Could not run." }); if (r?.ok) router.refresh();
  };
  const perMonth = (priceUsd * v.pct) / 100;
  return <div className="admForm">
    <label className="admField"><span>AI budget per person — share of the ${priceUsd} price (max 50%)</span><div className="admRow"><input className="admInput" style={{ maxWidth: 110 }} type="number" min={5} max={50} value={v.pct} onChange={(e) => setV({ ...v, pct: Math.max(5, Math.min(50, Number(e.target.value))) })} /><span className="admMuted">% = ${perMonth.toFixed(2)} per person per 30 days · ${(perMonth / 30).toFixed(3)} per day</span></div></label>
    <label className="admField"><span>Hosting & database cost per month (USD)</span><input className="admInput" style={{ maxWidth: 160 }} type="number" min={0} step="1" value={v.infra} onChange={(e) => setV({ ...v, infra: Number(e.target.value) })} /></label>
    <div className="admRow"><button className="admBtn primary" disabled={busy !== null} onClick={save}>{busy === "save" ? "Saving…" : "Save"}</button><button className="admBtn" disabled={busy !== null} onClick={compact}>{busy === "compact" ? "Running…" : "Run weekly summaries now"}</button>{msg && <span className={`admMsg ${msg.ok ? "ok" : "bad"}`}>{msg.text}</span>}</div>
  </div>;
}
