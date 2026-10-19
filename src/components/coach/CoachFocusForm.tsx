"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FocusPicker from "../FocusPicker";

export default function CoachFocusForm({ initialAreas, initialLevel }: { initialAreas: string[]; initialLevel: string }) {
  const router = useRouter();
  const [v, setV] = useState({ areas: initialAreas, level: initialLevel });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ focusAreas: v.areas, focusLevel: v.level }) }).catch(() => null);
    setBusy(false); setMsg(r?.ok ? { ok: true, text: "Saved. New workouts for your athletes will follow this." } : { ok: false, text: "Could not save." }); if (r?.ok) router.refresh();
  };
  return <div className="stack" style={{ gap: 12 }}>
    <FocusPicker areas={v.areas} level={v.level} onChange={setV} />
    <div><button className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save training focus"}</button></div>
    {msg && <p className={`small ${msg.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{msg.text}</p>}
  </div>;
}
