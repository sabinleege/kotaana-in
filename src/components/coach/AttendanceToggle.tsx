"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AttendanceToggle({ athleteId, present }: { athleteId: string; present: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState(false);
  const flip = async () => { setBusy(true); setErr(false); const r = await fetch("/api/coach/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ athleteId, present: !present }) }).catch(() => null); setBusy(false); if (r?.ok) router.refresh(); else setErr(true); };
  return <span><button className={present ? "btn primary small" : "btn secondary small"} disabled={busy} onClick={flip}>{present ? "✓ Present" : "Check in"}</button>{err && <span className="small danger"> failed</span>}</span>;
}
