import { AthleteFrame } from "@/app/app-layout";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import NotificationsList from "@/components/NotificationsList";

export const dynamic = "force-dynamic";
export default async function AthleteNotifications() {
  const s = await auth();
  const userId = s?.user?.id || "";
  const [items, notes] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.coachNote.findMany({ where: { athleteId: userId, visibleToAthlete: true }, include: { coach: { select: { name: true, profile: { select: { fullName: true } } } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return <AthleteFrame><div className="stack">
    <div><span className="pill orange">INBOX</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Notifications</h1><p className="subtitle">Messages from your coach, session reminders and account updates.</p></div>
    <div className="card"><NotificationsList items={JSON.parse(JSON.stringify(items))} /></div>
    {notes.length > 0 && <div className="card"><h2 className="sectionTitle">Notes from your coach</h2><div className="rowList" style={{ marginTop: 10 }}>{notes.map((n) => <div className="rowItem" key={n.id} style={{ display: "block" }}><div className="small muted">{n.coach.profile?.fullName || n.coach.name || "Coach"} · {n.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</div><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{n.content}</p></div>)}</div></div>}
  </div></AthleteFrame>;
}
