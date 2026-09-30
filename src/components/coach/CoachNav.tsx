"use client";
import { NavDrawer } from "../NavDrawer";

export function CoachNav({ name, unread, pending }: { name: string; unread: number; pending: number }) {
  return <NavDrawer name={name} subtitle="Coach" items={[
    { href: "/coach", label: "Overview", icon: "⌂", exact: true },
    { href: "/coach/athletes", label: "Athletes", icon: "👥", badge: pending },
    { href: "/coach/statistics", label: "Statistics", icon: "▦" },
    { href: "/coach/recommendations", label: "Recommendations", icon: "✦" },
    { href: "/coach/follow-ups", label: "Follow-ups", icon: "☑" },
    { href: "/coach/injuries", label: "Injuries", icon: "✚" },
    { href: "/coach/sessions", label: "Sessions", icon: "📅" },
    { href: "/coach/invites", label: "Invites", icon: "✉" },
    { href: "/coach/connect", label: "Connect", icon: "🔗" },
    { href: "/coach/analytics", label: "Analytics", icon: "📊" },
    { href: "/coach/notifications", label: "Notifications", icon: "🔔", badge: unread },
    { href: "/coach/members", label: "Members", icon: "⚑" },
    { href: "/coach/payments", label: "Athlete payments", icon: "₪" },
    { href: "/coach/subscription", label: "Subscription", icon: "★" },
  ]} footer={[{ href: "/coach/settings", label: "Settings", icon: "⚙" }, { href: "/api/auth/signout", label: "Sign out", icon: "⎋" }]} />;
}
