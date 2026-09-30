import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { CoachNav } from "@/components/coach/CoachNav";

export const dynamic = "force-dynamic";
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("coach");
  const [p, unread, pending] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: s.user.id }, select: { fullName: true } }),
    prisma.notification.count({ where: { userId: s.user.id, read: false } }),
    prisma.coachAthleteRelation.count({ where: { coachId: s.user.id, status: "pending" } }),
  ]);
  return <div className="page"><CoachNav name={p?.fullName || s.user.name || "Coach"} unread={unread} pending={pending} /><main className="coachMain">{children}</main></div>;
}
