"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

export type NavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean };

/** Floating ☰ button + slide-in menu shared by the athlete and coach areas. */
export function NavDrawer({ name, subtitle, items, footer }: { name?: string | null; subtitle?: string; items: NavItem[]; footer: NavItem[] }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open]);
  const all = [...items, ...footer];
  // The most specific matching href wins, so /coach/athletes/x highlights "Athletes", not "Overview".
  const activeHref = all.filter((i) => i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const unread = all.reduce((s, i) => s + (i.badge || 0), 0);
  const link = (i: NavItem) => <Link key={i.href} href={i.href} className={i.href === activeHref ? "active" : ""}><span className="icon">{i.icon}</span>{i.label}{i.badge ? <span className="navBadge">{i.badge}</span> : null}</Link>;
  return <>
    <button className="menuBtn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>☰{unread > 0 && <span className="menuDot" aria-label={`${unread} unread`} />}</button>
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <nav className={`side${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="sideHead"><Logo /><button className="sideClose" aria-label="Close menu" onClick={() => setOpen(false)}>×</button></div>
      {(name || subtitle) && <div className="sideUser">{name}{subtitle && <div className="small dim">{subtitle}</div>}</div>}
      {items.map(link)}
      <div className="sideFoot">{footer.map(link)}</div>
    </nav>
  </>;
}
