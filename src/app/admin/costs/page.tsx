import { costReport } from "@/lib/admin/costs";
import { AdminHeader, Kpi, Panel, usd } from "@/components/admin/AdminUI";
import CostControls from "@/components/admin/CostControls";

const FEATURE: Record<string, string> = { workout_rerank: "Workout picks", meal_plan: "Meal plans", review: "3–7 day reviews", monthly_review: "Monthly reviews", meal_photo: "Meal photo checks", health_photo: "Injury photo checks", ai: "Other" };
const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`);

export default async function AdminCosts() {
  const r = await costReport();
  const f = r.finance; const max = Math.max(...r.daily.map((d) => d.costUsd), 0.0001);
  return <>
    <AdminHeader eyebrow="AI & costs" title="What it costs to serve people" sub={<>Every AI call is costed from the provider&apos;s reported usage. Each person&apos;s AI is capped at {Math.round(r.settings.share * 100)}% of what they pay ({usd(f.maxAiPerUserUsd)} per 30 days), released as a daily allowance. When it runs low only the cheapest model is used; when it runs out the app falls back to its rule-based plans.</>} />
    <div className="admKpis">
      <Kpi label="AI cost · today" value={usd(r.windows.today.costUsd, 3)} hint={`${r.windows.today.calls} calls · ${r.windows.today.tokens.toLocaleString()} tokens`} />
      <Kpi label="AI cost · 7 days" value={usd(r.windows.d7.costUsd)} hint={`${r.windows.d7.calls} calls`} />
      <Kpi label="AI cost · 30 days" value={usd(r.windows.d30.costUsd)} hint={`${r.windows.d30.tokens.toLocaleString()} tokens · ${r.windows.d30.errors} failed`} />
      <Kpi label="AI per paying person" value={f.perPayingUserAiUsd == null ? "—" : usd(f.perPayingUserAiUsd)} hint={`cap ${usd(f.maxAiPerUserUsd)}`} tone={f.perPayingUserAiUsd != null && f.perPayingUserAiUsd > f.maxAiPerUserUsd ? "bad" : "good"} />
    </div>
    <Panel title="Profit & loss · last 30 days" sub="Kotaana payments only (gym memberships go to the gyms). Hosting is the monthly figure entered in Settings below.">
      <div className="admPnl">
        <div><span>Revenue</span><strong>{usd(f.revenueUsd)}</strong></div>
        <div className="minus"><span>AI (tokens)</span><strong>− {usd(f.aiCostUsd)}</strong></div>
        <div className="minus"><span>Hosting & database</span><strong>− {usd(f.infraUsd)}</strong></div>
        <div className={`total ${f.marginUsd >= 0 ? "good" : "bad"}`}><span>Margin</span><strong>{usd(f.marginUsd)}</strong></div>
      </div>
      <p className="admMuted" style={{ marginTop: 12 }}>{f.aiShareOfRevenuePct == null ? "No Kotaana revenue in the last 30 days yet." : `AI is ${f.aiShareOfRevenuePct}% of revenue.`} {r.skippedForBudget ? `${r.skippedForBudget} AI call(s) were skipped because a person's daily allowance was used up.` : "No calls had to be skipped for budget."}</p>
    </Panel>
    <Panel title="Daily AI spend" sub="Last 30 days, in US dollars.">
      <div className="admBars" role="img" aria-label="Daily AI cost for the last 30 days">{r.daily.map((d) => <div key={d.date} className="admBar" title={`${d.date}: ${usd(d.costUsd, 4)}`}><div style={{ height: `${Math.max(2, (d.costUsd / max) * 100)}%` }} /></div>)}</div>
      <div className="admBarsAxis"><span>{r.daily[0].date}</span><span>peak {usd(max, 3)}</span><span>{r.daily.at(-1)!.date}</span></div>
    </Panel>
    <div className="admGrid2">
      <Panel title="By feature" flush><div className="admTableWrap"><table className="admTable"><thead><tr><th>Feature</th><th>Calls</th><th>Avg / call</th><th>Cost</th></tr></thead><tbody>{r.byFeature.map((g) => <tr key={g.key}><td>{FEATURE[g.key] || g.key}</td><td>{g.calls}</td><td>{usd(g.costUsd / Math.max(1, g.calls), 4)}</td><td><strong>{usd(g.costUsd, 3)}</strong></td></tr>)}{!r.byFeature.length && <tr><td colSpan={4} className="admEmpty">No AI calls in 30 days.</td></tr>}</tbody></table></div></Panel>
      <Panel title="By model" flush><div className="admTableWrap"><table className="admTable"><thead><tr><th>Model</th><th>Calls</th><th>Tokens</th><th>Cost</th></tr></thead><tbody>{r.byModel.map((g) => <tr key={g.key}><td className="admMono">{g.key}</td><td>{g.calls}</td><td>{g.tokens.toLocaleString()}</td><td><strong>{usd(g.costUsd, 3)}</strong></td></tr>)}{!r.byModel.length && <tr><td colSpan={4} className="admEmpty">No AI calls in 30 days.</td></tr>}</tbody></table></div></Panel>
    </div>
    <Panel title="Heaviest users" sub="Against their own budget for the current period." flush>
      <div className="admTableWrap"><table className="admTable"><thead><tr><th>Person</th><th>Calls (30d)</th><th>Cost (30d)</th><th>Budget used</th></tr></thead><tbody>{r.topUsers.map((u) => <tr key={u.key}><td><strong>{u.name}</strong>{u.email && u.email !== u.name && <small>{u.email}</small>}</td><td>{u.calls}</td><td>{usd(u.costUsd, 3)}</td><td>{u.budgetUsedPct == null ? <span className="admMuted">{u.role === "admin" ? "unlimited" : "no access"}</span> : <div className="admMeter"><div className={u.budgetUsedPct >= 90 ? "bad" : u.budgetUsedPct >= 70 ? "warn" : ""} style={{ width: `${Math.min(100, u.budgetUsedPct)}%` }} /><span>{u.budgetUsedPct}% of {usd(u.budgetUsd ?? 0)}</span></div>}</td></tr>)}{!r.topUsers.length && <tr><td colSpan={4} className="admEmpty">Nobody has used AI in 30 days.</td></tr>}</tbody></table></div>
    </Panel>
    <div className="admGrid2">
      <Panel title="Settings"><CostControls share={r.settings.share} infraUsdMonth={r.settings.infraUsdMonth} priceUsd={r.price.usd} /></Panel>
      <Panel title="Storage" sub={`${r.summaries.count.toLocaleString()} weekly/monthly summaries now stand in for ${r.summaries.rowsCompacted.toLocaleString()} raw rows.`} flush>
        {r.storage.length ? <div className="admTableWrap"><table className="admTable"><thead><tr><th>Table</th><th>Rows</th><th>Size</th></tr></thead><tbody>{r.storage.map((s) => <tr key={s.table}><td className="admMono">{s.table}</td><td>{s.rows.toLocaleString()}</td><td>{mb(s.bytes)}</td></tr>)}</tbody></table></div> : <div className="admEmpty">Table sizes are not available on this database.</div>}
      </Panel>
    </div>
  </>;
}
