"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { equipmentOptions } from "@/components/setup/WorkoutSetupForm";

/** Gym name and the equipment members may use. Connected athletes get this equipment added to their workout generation. */
export default function GymProfileForm({ initialName, initialEquipment }: { initialName: string; initialEquipment: string[] }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState<string[]>(initialEquipment);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const all = [...new Set([...equipmentOptions, ...equipment])];
  const toggle = (x: string, on: boolean) => setEquipment(on ? [...new Set([...equipment, x])] : equipment.filter((v) => v !== x));
  const addCustom = () => { const v = custom.trim().toLowerCase(); if (v) { toggle(v, true); setCustom(""); } };
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name.trim(), equipment }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setMsg(r?.ok ? { ok: true, text: "Gym profile saved." } : { ok: false, text: d.error || "Could not save." }); if (r?.ok) router.refresh();
  };
  return <div className="stack" style={{ gap: 12 }}>
    <div><label className="label">Gym / coach name (shown to athletes)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
    <div><label className="label">Equipment available to your members</label><div className="checkboxRow">{all.map((x) => <label className="check" key={x}><input type="checkbox" checked={equipment.includes(x)} onChange={(e) => toggle(x, e.target.checked)} /> {x}</label>)}</div>
      <div className="row" style={{ marginTop: 8 }}><input className="input" style={{ maxWidth: 240 }} placeholder="Add other equipment" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} /><button className="btn secondary small" onClick={addCustom}>Add</button></div></div>
    <div><button className="btn primary" disabled={busy || name.trim().length < 2} onClick={save}>{busy ? "Saving…" : "Save gym profile"}</button></div>
    {msg && <p className={`small ${msg.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{msg.text}</p>}
  </div>;
}
