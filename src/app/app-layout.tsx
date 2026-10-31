import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { athleteAccess } from "@/lib/access";
import { AppPage } from "@/components/Page";
import { getT } from "@/lib/i18n/server";

const KIND: Record<string, string> = { gym: "gym", club: "club", coach: "coach" };

/** The athlete shell. Without a subscription or a running free trial the athlete stays signed in and can look around (preview mode):
 * a banner explains it, and every action that builds or records something is refused by the API with a 402. */
export async function AthleteFrame({ children }: { children: React.ReactNode; allowExpired?: boolean }) {
  const s = await requireRole("athlete");
  const [p, unread, access, rel, t] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: s.user.id }, select: { fullName: true, locationLat: true, locationLng: true } }),
    prisma.notification.count({ where: { userId: s.user.id, read: false } }),
    athleteAccess(s.user.id, s.user.role),
    prisma.coachAthleteRelation.findFirst({ where: { athleteId: s.user.id, status: { in: ["active", "paused"] } }, select: { coach: { select: { name: true, profile: { select: { fullName: true, organizationType: true } } } } }, orderBy: { updatedAt: "desc" } }),
    getT(),
  ]);
  const community = rel ? `Part of ${rel.coach.profile?.fullName || rel.coach.name || "your coach"} · ${KIND[rel.coach.profile?.organizationType || "coach"] || "coach"} community` : undefined;
  const banner = access.allowed ? null : <div className="previewBanner"><span>{access.trial?.eligible ? t("preview.banner") : t("preview.bannerUsed")}</span><Link className="btn primary small" href="/app/settings/subscription">{t("preview.bannerCta")}</Link></div>;
  return <AppPage name={p?.fullName || s.user.name} unread={unread} needsLocation={access.allowed && (p?.locationLat == null || p?.locationLng == null)} community={community}>{banner}{children}</AppPage>;
}
