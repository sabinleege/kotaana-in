"use client";
import { NavDrawer } from "./NavDrawer";

const items = [
  { href: "/app", label: "Dashboard", icon: "⌂", exact: true }, { href: "/app/workout", label: "Workout", icon: "◒" }, { href: "/app/nutrition", label: "Nutrition", icon: "◔" },
  { href: "/app/health", label: "Health", icon: "♥" }, { href: "/app/progress", label: "Progress", icon: "↗" }, { href: "/app/track", label: "Track Me", icon: "⌖" },
];
export function AppNav({ name, unread = 0, community }: { name?: string | null; unread?: number; community?: string }) {
  return <NavDrawer homeHref="/app" name={name} subtitle={community} items={[...items, { href: "/app/notifications", label: "Notifications", icon: "🔔", badge: unread }]} footer={[{ href: "/app/settings", label: "Settings", icon: "⚙" }, { href: "/api/auth/signout", label: "Sign out", icon: "⎋" }]} />;
}
