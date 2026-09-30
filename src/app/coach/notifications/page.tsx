import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { PageHead } from "@/components/coach/CoachUI";
import NotificationsList from "@/components/NotificationsList";

export const dynamic = "force-dynamic";
export default async function CoachNotifications() {
  const s = await requireRole("coach");
  const items = await prisma.notification.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return <div className="stack" style={{ gap: 14 }}><PageHead eyebrow="INBOX" title="Notifications" sub="Connection requests, accepted invites and payment updates." /><div className="solid"><NotificationsList items={JSON.parse(JSON.stringify(items))} /></div></div>;
}
