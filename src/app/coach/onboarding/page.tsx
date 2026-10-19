"use client";
import { useEffect, useState } from "react";
import FocusPicker from "@/components/FocusPicker";

export default function CoachOnboarding() {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [price, setPrice] = useState("");
  const [focus, setFocus] = useState<{ areas: string[]; level: string }>({ areas: [], level: "standard" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (!d.profile) return;
      setName(d.profile.fullName || ""); setNumber(d.profile.momoNumber || ""); setMomoName(d.profile.momoName || "");
      setPrice(d.profile.membershipPriceRwf ? String(d.profile.membershipPriceRwf) : "");
    });
  }, []);
  const wantsPay = number.trim().length > 0;
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const p = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name, onboardingCompleted: true, focusAreas: focus.areas, focusLevel: focus.level }) });
      if (!p.ok) throw new Error("Could not save coach profile");
      if (wantsPay) {
        const m = await fetch("/api/coach/momo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, name: momoName, priceRwf: Number(price) }) });
        if (!m.ok) throw new Error((await m.json()).error || "Could not save payment details");
      }
      location.href = "/coach";
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not complete setup"); } finally { setBusy(false); }
  };
  return <div className="page"><div className="mobile" style={{ padding: "24px 0" }}><div className="card">
    <span className="pill orange">COACH</span><h1>Coach onboarding</h1>
    <p className="subtitle">Set the name athletes will search for. Add your price and MoMo number when you are ready to take memberships — you can also do it later in Settings.</p>
    <div className="stack" style={{ marginTop: 14 }}>
      <div><label className="label">Coach / gym name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div><label className="label">Price for 30 days (RWF)</label><input className="input" type="number" min={100} step={100} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 20000" /></div>
      <div><label className="label">MoMo number</label><input className="input" inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="MTN MoMo number" /></div>
      <div><label className="label">MoMo account name</label><input className="input" value={momoName} onChange={(e) => setMomoName(e.target.value)} /></div>
    </div>
    <div style={{ marginTop: 14 }}><FocusPicker areas={focus.areas} level={focus.level} onChange={setFocus} /></div>
    {msg && <p className="small danger">{msg}</p>}
    <button className="btn primary" style={{ marginTop: 14 }} disabled={busy || name.trim().length < 2 || (wantsPay && (!(Number(price) >= 100) || momoName.trim().length < 2))} onClick={save}>{busy ? "Saving…" : "Complete coach setup"}</button>
  </div></div></div>;
}
