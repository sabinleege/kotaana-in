"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

export type NavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean };

/** Floating ☰ button, a back button on every inner page, and the slide-in menu shared by the athlete and coach areas. */
export function NavDrawer({ name, subtitle, items, footer, homeHref }: { name?: string | null; subtitle?: string; items: NavItem[]; footer: NavItem[]; homeHref: string }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open]);
  const all = [...items, ...footer];
  // The most specific matching href wins, so /coach/athletes/x highlights "Members", not "Dashboard".
  const activeHref = all.filter((i) => i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const unread = all.reduce((s, i) => s + (i.badge || 0), 0);
  const goBack = () => { if (window.history.length > 1) router.back(); else router.push(homeHref); };
  // Close immediately on click so the menu never stays covering the page while the next page loads.
  const link = (i: NavItem) => <Link key={i.href} href={i.href} className={i.href === activeHref ? "active" : ""} onClick={() => setOpen(false)}><span className="icon">{i.icon}</span>{i.label}{i.badge ? <span className="navBadge">{i.badge}</span> : null}</Link>;
  return <>
    <button className="menuBtn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>☰{unread > 0 && <span className="menuDot" aria-label={`${unread} unread`} />}</button>
    {path !== homeHref && <button className="backBtn" aria-label="Go back" onClick={goBack}>←</button>}
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <nav className={`side${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="sideHead"><Logo /><button className="sideClose" aria-label="Close menu" onClick={() => setOpen(false)}>×</button></div>
      {(name || subtitle) && <div className="sideUser">{name}{subtitle && <div className="small dim">{subtitle}</div>}</div>}
      {items.map(link)}
      <div className="sideFoot">{footer.map(link)}</div>
    </nav>
  </>;
}
