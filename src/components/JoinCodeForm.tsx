"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Athlete enters a coach invite code (or arrives with ?code= from an invite link). */
export default function JoinCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string; login?: boolean } | null>(null);
  const join = async () => {
    setBusy(true); setRes(null);
    const r = await fetch("/api/invites/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.status === 401 || r?.status === 403 && d.error === "Forbidden") { setRes({ ok: false, text: "Log in with your athlete account to use this code.", login: true }); return; }
    setRes(r?.ok ? { ok: true, text: `You're connected to ${d.coachName}! They can now see your progress and send you follow-ups.` } : { ok: false, text: d.error || "Could not join — try again." });
    if (r?.ok) router.refresh();
  };
  return <div className="stack" style={{ gap: 8 }}>
    <div className="row" style={{ flexWrap: "wrap" }}><input className="input inviteInput" style={{ flex: "1 1 200px" }} placeholder="Invite code, e.g. K7M2QX9P" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><button className="btn primary" disabled={busy || code.trim().length < 4} onClick={join}>{busy ? "Joining…" : "Join coach"}</button></div>
    {res && <p className={`small ${res.ok ? "success" : "danger"}`} style={{ margin: 0 }}>{res.text} {res.login && <Link href={`/auth?mode=login`} style={{ color: "var(--orange2)" }}>Log in →</Link>}</p>}
  </div>;
}
