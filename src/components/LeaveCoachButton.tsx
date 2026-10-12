"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Stop sharing data with the current coach and go back to training on your own. */
export default function LeaveCoachButton({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    if (!confirm(`Leave ${name}? They will stop seeing your data and you will train on your own.`)) return;
    setBusy(true);
    await fetch("/api/connections/request", { method: "DELETE" }).catch(() => null);
    setBusy(false); router.refresh();
  };
  return <button className="btn secondary small" disabled={busy} onClick={leave}>{busy ? "…" : "Leave coach"}</button>;
}
