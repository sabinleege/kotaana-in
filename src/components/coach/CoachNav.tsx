"use client";
import { NavDrawer } from "../NavDrawer";

/** Gym portal menu. Coaches and gyms share one portal: a coach's own gym is their workspace. */
export function CoachNav({ name, unread, pending }: { name: string; unread: number; pending: number }) {
  return <NavDrawer homeHref="/coach" name={name} subtitle="Gym" items={[
    { href: "/coach", label: "Dashboard", icon: "⌂", exact: true },
    { href: "/coach/athletes", label: "Members", icon: "👥", badge: pending },
    { href: "/coach/profile", label: "Gym profile", icon: "🏋" },
    { href: "/coach/attendance", label: "Attendance", icon: "✔" },
    { href: "/coach/memberships", label: "Memberships", icon: "🎫" },
    { href: "/coach/payments", label: "Payment approvals", icon: "₪" },
    { href: "/coach/revenue", label: "Revenue", icon: "💰" },
    { href: "/coach/analytics", label: "Analytics", icon: "📊" },
    { href: "/coach/statistics", label: "Statistics", icon: "▦" },
    { href: "/coach/recommendations", label: "Recommendations", icon: "✦" },
    { href: "/coach/follow-ups", label: "Follow-ups", icon: "☑" },
    { href: "/coach/injuries", label: "Injuries", icon: "✚" },
    { href: "/coach/sessions", label: "Sessions", icon: "📅" },
    { href: "/coach/invites", label: "Invites & connect", icon: "✉" },
    { href: "/coach/notifications", label: "Notifications", icon: "🔔", badge: unread },
  ]} footer={[{ href: "/coach/settings", label: "Gym settings", icon: "⚙" }, { href: "/api/auth/signout", label: "Sign out", icon: "⎋" }]} />;
}
