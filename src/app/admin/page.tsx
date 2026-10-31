import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import AdminScreen from "@/components/AdminScreen";
import { AdminHeader, Kpi, Panel, usd } from "@/components/admin/AdminUI";
import { costReport } from "@/lib/admin/costs";

export default async function Admin() {
  const [users, athletes, coaches, pending, approved, plans, runs, newWeek, cost] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { role: "athlete" } }), prisma.user.count({ where: { role: "coach" } }),
    prisma.paymentRequest.count({ where: { status: "pending" } }), prisma.paymentRequest.count({ where: { status: "approved" } }),
    prisma.workoutPlan.count(), prisma.runActivity.count(), prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }), costReport(),
  ]);
  const f = cost.finance;
  return <>
    <AdminHeader eyebrow="Overview" title="Good to see you" sub="Everything that needs you today, then the health of the business." actions={pending ? <Link className="admBtn primary" href="/admin/payments">Review {pending} payment{pending === 1 ? "" : "s"}</Link> : undefined} />
    <div className="admKpis">
      <Kpi label="People" value={users.toLocaleString()} hint={`${athletes} athletes · ${coaches} coaches · +${newWeek} this week`} />
      <Kpi label="Paying now" value={cost.people.activeSubs} hint={`${cost.people.activeTrials} on a free trial`} />
      <Kpi label="Revenue · 30 days" value={usd(f.revenueUsd)} hint={`${Math.round(f.revenueRwf).toLocaleString()} RWF`} />
      <Kpi label="Margin · 30 days" value={usd(f.marginUsd)} tone={f.marginUsd >= 0 ? "good" : "bad"} hint={`AI ${usd(f.aiCostUsd)} · hosting ${usd(f.infraUsd, 0)}`} />
    </div>
    <div className="admGrid2">
      <Panel title="Payments" sub="MoMo orders waiting for a check." actions={<Link className="admLink" href="/admin/payments">Open →</Link>}><div className="admStatRow"><div><span>Waiting</span><strong className={pending ? "warn" : ""}>{pending}</strong></div><div><span>Approved, all time</span><strong>{approved}</strong></div></div></Panel>
      <Panel title="AI spend" sub={`Capped at ${Math.round(cost.settings.share * 100)}% of the price per person.`} actions={<Link className="admLink" href="/admin/costs">Details →</Link>}><div className="admStatRow"><div><span>Today</span><strong>{usd(cost.windows.today.costUsd, 3)}</strong></div><div><span>30 days</span><strong>{usd(cost.windows.d30.costUsd)}</strong></div><div><span>Share of revenue</span><strong>{f.aiShareOfRevenuePct == null ? "—" : `${f.aiShareOfRevenuePct}%`}</strong></div></div></Panel>
      <Panel title="Activity" sub="Generated plans and tracked sessions still stored."><div className="admStatRow"><div><span>Workout plans</span><strong>{plans.toLocaleString()}</strong></div><div><span>GPS sessions</span><strong>{runs.toLocaleString()}</strong></div><div><span>Weekly summaries</span><strong>{cost.summaries.count.toLocaleString()}</strong></div></div></Panel>
    </div>
    <AdminScreen />
  </>;
}
