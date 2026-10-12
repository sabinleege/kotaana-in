"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Where athletes pay this coach/gym, and the fixed price for 30 days of membership. */
export default function CoachMomo({ initial }: { initial: { number: string; name: string; priceRwf: number | null } }) {
  const router = useRouter();
  const [v, setV] = useState({ number: initial.number, name: initial.name, price: initial.priceRwf ? String(initial.priceRwf) : "" });
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true); setM(null);
    const r = await fetch("/api/coach/momo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: v.number, name: v.name, priceRwf: Number(v.price) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setM(r?.ok ? { ok: true, text: "Price and payment details saved. Athletes who choose you will pay exactly this amount." } : { ok: false, text: d.error || "Could not save." });
    if (r?.ok) router.refresh();
  };
  return <div className="stack" style={{ gap: 12 }}>
    <div><h2 className="sectionTitle">Membership price & payment</h2><p className="small muted" style={{ margin: "4px 0 0" }}>Set the fixed price for 30 days at your gym. Athletes who choose you pay this amount to the MoMo number below.</p></div>
    <div className="formGrid">
      <div><label className="label">Price for 30 days (RWF)</label><input className="input" type="number" min={100} step={100} inputMode="numeric" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} placeholder="e.g. 20000" /></div>
      <div><label className="label">MoMo number</label><input className="input" inputMode="tel" value={v.number} onChange={(e) => setV({ ...v, number: e.target.value })} /></div>
      <div><label className="label">MoMo account name</label><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
    </div>
    <div><button className="btn primary" disabled={busy || !(Number(v.price) >= 100) || v.number.trim().length < 7 || v.name.trim().length < 2} onClick={save}>{busy ? "Saving…" : "Save price & payment"}</button></div>
    {m && <p className={`small ${m.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{m.text}</p>}
  </div>;
}
