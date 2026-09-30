"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type N = { id: string; title: string; message: string; type: string; read: boolean; createdAt: string; data?: any };

/** Notification inbox for athletes and coaches. Coach connection requests can be answered in place. */
export default function NotificationsList({ items }: { items: N[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const patch = async (body: unknown) => { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); router.refresh(); };
  const respond = async (n: N, accept: boolean) => {
    setBusy(n.id);
    const r = await fetch("/api/connections/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationId: n.data?.relationId, accept }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setAnswered({ ...answered, [n.id]: r?.ok ? (accept ? "✓ Connected" : "Declined") : d.error || "Could not answer" });
    setBusy(null); if (!n.read) patch({ id: n.id, read: true }); else router.refresh();
  };
  const unread = items.filter((n) => !n.read).length;
  return <div className="stack" style={{ gap: 10 }}>
    <div className="row spread"><span className="small muted">{unread ? `${unread} unread` : "All read"}</span>{unread > 0 && <button className="btn secondary small" onClick={() => patch({ markAllRead: true })}>✓ Mark all read</button>}</div>
    {items.map((n) => <div key={n.id} className={`rowItem notif${n.read ? "" : " unread"}`} onClick={() => { if (!n.read && n.type !== "connection_request") patch({ id: n.id, read: true }); }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>{!n.read && <span className="unreadDot" />}<strong>{n.title}</strong></div>
        <div className="small" style={{ marginTop: 3, whiteSpace: "pre-wrap" }}>{n.message}</div>
        <div className="small dim" style={{ marginTop: 3 }}>{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
      </div>
      {n.type === "connection_request" && n.data?.relationId && (answered[n.id] ? <span className="small muted">{answered[n.id]}</span> : <div className="row" onClick={(e) => e.stopPropagation()}><button className="btn primary small" disabled={busy === n.id} onClick={() => respond(n, true)}>Accept</button><button className="btn secondary small" disabled={busy === n.id} onClick={() => respond(n, false)}>Decline</button></div>)}
    </div>)}
    {!items.length && <div className="empty">🔔 No notifications yet.</div>}
  </div>;
}
