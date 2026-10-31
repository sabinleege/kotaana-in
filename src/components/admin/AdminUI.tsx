/** Building blocks shared by every admin page, so they all read as one console. */
export function AdminHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return <header className="admHead"><div><div className="admEyebrow">{eyebrow}</div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{actions && <div className="admActions">{actions}</div>}</header>;
}
export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "bad" | "warn" }) {
  return <div className={`admKpi${tone ? " " + tone : ""}`}><div className="admKpiLabel">{label}</div><div className="admKpiValue">{value}</div>{hint && <div className="admKpiHint">{hint}</div>}</div>;
}
export function Panel({ title, sub, actions, children, flush }: { title?: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return <section className={`admPanel${flush ? " flush" : ""}`}>{(title || actions) && <div className="admPanelHead"><div>{title && <h2>{title}</h2>}{sub && <p>{sub}</p>}</div>{actions}</div>}{children}</section>;
}
export const usd = (n: number, digits = 2) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
