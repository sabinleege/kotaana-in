"use client";
import { NavDrawer } from "../NavDrawer";
import { useT } from "@/lib/i18n/client";

/** Gym portal menu, kept to six entries. Sessions, follow-ups, injuries and attendance are reached from the dashboard and each member's page. */
export function CoachNav({ name, unread, pendingPayments }: { name: string; unread: number; pendingPayments: number }) {
  const t = useT();
  return <NavDrawer homeHref="/coach" name={name} subtitle={t("nav.gym")} items={[
    { href: "/coach", label: t("nav.dashboard"), icon: "⌂", exact: true },
    { href: "/coach/athletes", label: t("nav.members"), icon: "👥" },
    { href: "/coach/analytics", label: t("nav.analytics"), icon: "📊" },
    { href: "/coach/memberships", label: t("nav.subscriptions"), icon: "🎫", badge: pendingPayments },
    { href: "/coach/notifications", label: t("nav.notifications"), icon: "🔔", badge: unread },
  ]} footer={[{ href: "/coach/settings", label: t("nav.settings"), icon: "⚙" }, { href: "/api/auth/signout", label: t("nav.signout"), icon: "⎋" }]} />;
}
