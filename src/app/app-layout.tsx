import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { athleteAccess } from "@/lib/access";
import { AppPage } from "@/components/Page";

const KIND: Record<string, string> = { gym: "gym", club: "club", coach: "coach" };

/** The athlete shell. Without a paid subscription or free trial the athlete is sent to the payment page; pages that must stay reachable (settings, notifications, onboarding) pass allowExpired. */
export async function AthleteFrame({ children, allowExpired = false }: { children: React.ReactNode; allowExpired?: boolean }) {
  const s = await requireRole("athlete");
  const [p, unread, access, rel] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: s.user.id }, select: { fullName: true, locationLat: true, locationLng: true } }),
    prisma.notification.count({ where: { userId: s.user.id, read: false } }),
    athleteAccess(s.user.id, s.user.role),
    prisma.coachAthleteRelation.findFirst({ where: { athleteId: s.user.id, status: { in: ["active", "paused"] } }, select: { coach: { select: { name: true, profile: { select: { fullName: true, organizationType: true } } } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  if (!allowExpired && !access.allowed) redirect("/app/settings/subscription?expired=1");
  const community = rel ? `Part of ${rel.coach.profile?.fullName || rel.coach.name || "your coach"} · ${KIND[rel.coach.profile?.organizationType || "coach"] || "coach"} community` : undefined;
  return <AppPage name={p?.fullName || s.user.name} unread={unread} needsLocation={p?.locationLat == null || p?.locationLng == null} community={community}>{children}</AppPage>;
}
