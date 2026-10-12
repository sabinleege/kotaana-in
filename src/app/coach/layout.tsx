import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { CoachNav } from "@/components/coach/CoachNav";

export const dynamic = "force-dynamic";
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("coach");
  const [p, unread, pendingPayments] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: s.user.id }, select: { fullName: true } }),
    prisma.notification.count({ where: { userId: s.user.id, read: false } }),
    prisma.paymentRequest.count({ where: { coachId: s.user.id, role: "athlete", status: "pending" } }),
  ]);
  return <div className="page"><CoachNav name={p?.fullName || s.user.name || "Coach"} unread={unread} pendingPayments={pendingPayments} /><main className="coachMain">{children}</main></div>;
}
