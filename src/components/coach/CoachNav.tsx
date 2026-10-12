"use client";
import { NavDrawer } from "../NavDrawer";

/** Gym portal menu, kept to six entries. Sessions, follow-ups, injuries and attendance are reached from the dashboard and each member's page. */
export function CoachNav({ name, unread, pendingPayments }: { name: string; unread: number; pendingPayments: number }) {
  return <NavDrawer homeHref="/coach" name={name} subtitle="Gym" items={[
    { href: "/coach", label: "Dashboard", icon: "⌂", exact: true },
    { href: "/coach/athletes", label: "Members", icon: "👥" },
    { href: "/coach/analytics", label: "Analytics", icon: "📊" },
    { href: "/coach/memberships", label: "Subscriptions", icon: "🎫", badge: pendingPayments },
    { href: "/coach/notifications", label: "Notifications", icon: "🔔", badge: unread },
  ]} footer={[{ href: "/coach/settings", label: "Settings", icon: "⚙" }, { href: "/api/auth/signout", label: "Sign out", icon: "⎋" }]} />;
}
