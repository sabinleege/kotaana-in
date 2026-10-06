"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Pay for a Kotaana plan. The amount is shown for information; the server always charges the current price. */
export function SubscribePanel({ planType, rwf, usd, code, pending }: { planType: "direct" | "coach_plan"; rwf: number; usd: number; code: string | null; pending: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ number: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/payments/momo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: rwf, payerNumber: f.number, payerName: f.name.trim(), planType, idempotencyKey: crypto.randomUUID() }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setMsg(r?.ok ? { ok: true, text: d.message || "Payment recorded. You'll get access as soon as it is confirmed." } : { ok: false, text: d.error || "Could not record the payment." });
    if (r?.ok) router.refresh();
  };
  if (pending) return <div className="solid"><span className="prio normal">pending</span><p style={{ margin: "8px 0 0" }}>Your payment is waiting for confirmation. Access starts as soon as it is approved.</p></div>;
  if (!code) return <div className="solid"><p className="small muted" style={{ margin: 0 }}>Kotaana has not published its MoMo payment code yet, so payments can't be recorded. Please try again later.</p></div>;
  return <div className="solid stack" style={{ gap: 12 }}>
    <ol className="howSteps"><li>Send <strong>{rwf.toLocaleString()} RWF</strong> (≈ ${usd}) by MoMo to code <code className="inviteCode">{code}</code>.</li><li>Enter the number and name you paid from.</li><li>We confirm it and unlock <strong>30 days</strong> of access.</li></ol>
    <div className="formGrid"><div><label className="label">Your MoMo number</label><input className="input" inputMode="tel" placeholder="07XXXXXXXX" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div><div><label className="label">Name on the MoMo account</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div></div>
    <div><button className="btn primary" disabled={busy || f.number.replace(/\D/g, "").length < 9 || f.name.trim().length < 2} onClick={submit}>{busy ? "Sending…" : `I paid ${rwf.toLocaleString()} RWF`}</button></div>
    {msg && <p className={`small ${msg.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{msg.text}</p>}
  </div>;
}

/** Admin: set the price and exchange rate. */
export function PriceForm({ usd, rate }: { usd: number; rate: number }) {
  const router = useRouter();
  const [v, setV] = useState({ usd, rate }); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => { setBusy(true); setMsg(null); const r = await fetch("/api/admin/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "price", usd: v.usd, rate: v.rate }) }).catch(() => null); const d = r ? await r.json().catch(() => ({})) : {}; setBusy(false); setMsg(r?.ok ? { ok: true, text: "Price saved." } : { ok: false, text: d.error || "Could not save." }); if (r?.ok) router.refresh(); };
  return <div className="stack" style={{ gap: 10 }}><div className="formGrid"><div><label className="label">Price per 30 days (USD)</label><input className="input" type="number" min={1} step="0.5" value={v.usd} onChange={(e) => setV({ ...v, usd: Number(e.target.value) })} /></div><div><label className="label">RWF per 1 USD</label><input className="input" type="number" min={1} value={v.rate} onChange={(e) => setV({ ...v, rate: Number(e.target.value) })} /></div><div><label className="label">Members pay</label><div className="item"><strong>{Math.round(v.usd * v.rate).toLocaleString()} RWF</strong></div></div></div><div><button className="btn primary" disabled={busy || !(v.usd > 0) || !(v.rate > 0)} onClick={save}>{busy ? "Saving…" : "Save price"}</button></div>{msg && <p className={`small ${msg.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{msg.text}</p>}</div>;
}

/** Grant or revoke access (admin: any user, up to 30 days; gym: its own members, always 30 days). */
export function AccessButtons({ url, userKey, userId, active, canRevoke = true }: { url: string; userKey: "userId" | "athleteId"; userId: string; active: boolean; canRevoke?: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const send = async (action: "grant" | "revoke") => { setBusy(true); setErr(null); const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, [userKey]: userId }) }).catch(() => null); const d = r ? await r.json().catch(() => ({})) : {}; setBusy(false); if (r?.ok) router.refresh(); else setErr(d.error || "Failed"); };
  return <span className="row" style={{ gap: 6 }}><button className="btn secondary small" disabled={busy} onClick={() => send("grant")}>{active ? "Renew 30 days" : "Grant 30 days"}</button>{active && canRevoke && <button className="btn secondary small" disabled={busy} onClick={() => confirm("Revoke access now?") && send("revoke")}>Revoke</button>}{err && <span className="small danger">{err}</span>}</span>;
}
