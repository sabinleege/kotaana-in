"use client";
import { NavDrawer } from "./NavDrawer";
import { useT } from "@/lib/i18n/client";

export function AppNav({ name, unread = 0, community }: { name?: string | null; unread?: number; community?: string }) {
  const t = useT();
  const items = [
    { href: "/app", label: t("nav.dashboard"), icon: "⌂", exact: true }, { href: "/app/workout", label: t("nav.workout"), icon: "◒" }, { href: "/app/nutrition", label: t("nav.nutrition"), icon: "◔" },
    { href: "/app/health", label: t("nav.health"), icon: "♥" }, { href: "/app/progress", label: t("nav.progress"), icon: "↗" }, { href: "/app/track", label: t("nav.track"), icon: "⌖" }, { href: "/app/exercises", label: t("nav.exercises"), icon: "☰" },
  ];
  return <NavDrawer homeHref="/app" name={name} subtitle={community} items={[...items, { href: "/app/notifications", label: t("nav.notifications"), icon: "🔔", badge: unread }]} footer={[{ href: "/app/settings", label: t("nav.settings"), icon: "⚙" }, { href: "/api/auth/signout", label: t("nav.signout"), icon: "⎋" }]} />;
}
