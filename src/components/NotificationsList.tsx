"use client";
import { useRouter } from "next/navigation";

type N = { id: string; title: string; message: string; type: string; read: boolean; createdAt: string; data?: any };

/** Notification inbox for athletes and coaches. */
export default function NotificationsList({ items }: { items: N[] }) {
  const router = useRouter();
  const patch = async (body: unknown) => { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); router.refresh(); };
  const unread = items.filter((n) => !n.read).length;
  return <div className="stack" style={{ gap: 10 }}>
    <div className="row spread"><span className="small muted">{unread ? `${unread} unread` : "All read"}</span>{unread > 0 && <button className="btn secondary small" onClick={() => patch({ markAllRead: true })}>✓ Mark all read</button>}</div>
    {items.map((n) => <div key={n.id} className={`rowItem notif${n.read ? "" : " unread"}`} onClick={() => { if (!n.read) patch({ id: n.id, read: true }); }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>{!n.read && <span className="unreadDot" />}<strong>{n.title}</strong></div>
        <div className="small" style={{ marginTop: 3, whiteSpace: "pre-wrap" }}>{n.message}</div>
        <div className="small dim" style={{ marginTop: 3 }}>{new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
      </div>
    </div>)}
    {!items.length && <div className="empty">🔔 No notifications yet.</div>}
  </div>;
}
