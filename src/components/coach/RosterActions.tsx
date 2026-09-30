"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Accept / decline a pending athlete request from the coach roster. */
export default function RosterActions({ relationId }: { relationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const respond = async (accept: boolean) => {
    setBusy(true); setError(null);
    const r = await fetch("/api/connections/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationId, accept }) }).catch(() => null);
    if (r?.ok) router.refresh(); else setError("Could not update — try again.");
    setBusy(false);
  };
  return <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
    <button className="btn primary small" disabled={busy} onClick={() => respond(true)}>Accept</button>
    <button className="btn secondary small" disabled={busy} onClick={() => respond(false)}>Decline</button>
    {error && <span className="small danger">{error}</span>}
  </div>;
}
