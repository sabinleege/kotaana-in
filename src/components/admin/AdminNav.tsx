"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/NavDrawer";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: "◈", exact: true },
  { href: "/admin/costs", label: "AI & costs", icon: "◎" },
  { href: "/admin/payments", label: "Payments", icon: "▤", badgeKey: "payments" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "◆" },
  { href: "/admin/people", label: "People", icon: "◉" },
  { href: "/admin/exercises", label: "Exercise review", icon: "◇" },
] as const;

/** Left rail on desktop, a scrolling tab bar on phones. */
export default function AdminNav({ email, pendingPayments }: { email: string; pendingPayments: number }) {
  const path = usePathname();
  const active = (h: string, exact?: boolean) => (exact ? path === h : path === h || path.startsWith(h + "/"));
  return <aside className="admRail">
    <div className="admBrand"><span className="admMark">K</span><div><strong>Kotaana</strong><span>Admin console</span></div></div>
    <nav className="admNav">{ITEMS.map((i) => <Link key={i.href} href={i.href} className={active(i.href, "exact" in i && i.exact) ? "on" : ""}><span className="admIco" aria-hidden>{i.icon}</span>{i.label}{"badgeKey" in i && pendingPayments > 0 && <span className="admBadge">{pendingPayments}</span>}</Link>)}</nav>
    <div className="admFoot"><div className="admWho" title={email}>{email}</div><SignOutButton className="admSignOut" /></div>
  </aside>;
}
