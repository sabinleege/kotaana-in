import Link from "next/link";
import type { AthleteSignal } from "@/lib/coach/data";
import { fmtDate, goalLabel } from "@/lib/coach/data";

export function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return <div className="pageHead"><div><span className="pill orange">{eyebrow}</span><h1>{title}</h1>{sub && <p className="subtitle" style={{ margin: 0 }}>{sub}</p>}</div>{children && <div className="row" style={{ flexWrap: "wrap" }}>{children}</div>}</div>;
}

export function Stat({ label, value, hint, warn }: { label: string; value: React.ReactNode; hint?: string; warn?: boolean }) {
  return <div className={`stat${warn ? " warn" : ""}`}><div className="k">{label}</div><div className="v">{value}</div>{hint && <div className="h">{hint}</div>}</div>;
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const initials = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <span className="avatar" style={{ width: size, height: size, flexBasis: size }}>{src ? <img src={src} alt="" /> : initials}</span>;
}

export function AthleteCard({ a }: { a: AthleteSignal }) {
  return <Link className="athCard" href={`/coach/athletes/${a.athleteId}`}>
    <div className="athTop"><Avatar name={a.name} src={a.avatar} /><div style={{ minWidth: 0 }}><strong>{a.name}</strong><div className="small muted">{goalLabel(a.goal)} · {a.level || "level not set"}{a.status === "paused" ? " · paused" : ""}</div></div></div>
    <div className="athMeta">
      <div><strong>{a.readinessAvg7 ?? "—"}</strong>readiness</div>
      <div><strong>{a.completed7}</strong>blocks (7d)</div>
      <div><strong style={{ color: a.activeInjuries ? "#dc2626" : undefined }}>{a.activeInjuries}</strong>injuries</div>
    </div>
    <div className="small muted" style={{ marginTop: 8 }}>Last check-in {fmtDate(a.lastCheckin)} · last workout {fmtDate(a.lastWorkout)}</div>
  </Link>;
}

export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty">{children}</div>; }
