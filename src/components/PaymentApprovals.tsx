"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { id: string; planType: string; currency: string; amount: number; payerNumber: string; payerName: string; createdAt: string | Date; user?: { name: string | null; email: string } | null };
const PLAN: Record<string, string> = { coach_service: "Gym membership", direct: "Kotaana subscription", coach_plan: "Gym plan" };

/** Pending MoMo payments. Approving grants 30 days of access; rejecting leaves access unchanged. */
export default function PaymentApprovals({ rows, back, title = "Payment approvals" }: { rows: Row[]; back: string; title?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (id: string, approved: boolean) => {
    setBusy(id); setError(null);
    const r = await fetch("/api/payments/momo/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: id, approved }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    if (r?.ok) router.refresh(); else setError(d.error || "Could not update this payment — try again.");
  };
  return <div className="stack" style={{ gap: 12 }}>
    <div className="pageHead"><div><span className="pill orange">PAYMENTS</span><h1>{title}</h1><p className="subtitle" style={{ margin: 0 }}>{rows.length ? `${rows.length} waiting for your confirmation. Confirm only after the MoMo money has arrived.` : "Nothing waiting for confirmation."}</p></div><Link className="btn secondary" href={back}>Back</Link></div>
    {error && <p className="small danger" style={{ margin: 0 }}>{error}</p>}
    <div className="rowList">{rows.map((x) => <div className="solid" key={x.id}>
      <div className="row spread" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><div className="row" style={{ gap: 8 }}><strong style={{ fontSize: 16 }}>{x.user?.name || x.user?.email || "Member"}</strong><span className="prio normal">pending</span></div>
          <div className="small muted" style={{ marginTop: 4 }}>{PLAN[x.planType] || x.planType} · {new Date(x.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
          <div className="small" style={{ marginTop: 6 }}>From <strong>{x.payerName}</strong> · {x.payerNumber}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 900 }}>{x.amount.toLocaleString()} <span className="small muted">{x.currency}</span></div><div className="small muted">approving gives 30 days</div></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary" disabled={busy === x.id} onClick={() => act(x.id, true)}>{busy === x.id ? "…" : "✓ Approve"}</button><button className="btn secondary" disabled={busy === x.id} onClick={() => act(x.id, false)}>Reject</button></div>
    </div>)}{!rows.length && <div className="empty">No pending payment requests.</div>}</div>
  </div>;
}
