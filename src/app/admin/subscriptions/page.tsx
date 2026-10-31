import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { AccessButtons, PriceForm } from "@/components/billing/BillingForms";
import { MAX_ACCESS_DAYS, accessState, getPricing } from "@/lib/subscription";
import { AdminHeader, Panel } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
export default async function AdminSubscriptions({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const needle = q.trim();
  const [price, users, pendingCount, trials] = await Promise.all([
    getPricing(),
    prisma.user.findMany({ where: { role: { in: ["athlete", "coach"] }, ...(needle ? { OR: [{ email: { contains: needle, mode: "insensitive" } }, { name: { contains: needle, mode: "insensitive" } }] } : {}) }, include: { subscriptions: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.paymentRequest.count({ where: { status: "pending" } }),
    prisma.trialClaim.findMany({ select: { email: true, endsAt: true } }),
  ]);
  const trialOf = new Map(trials.map((t) => [t.email, t.endsAt]));
  return <>
    <AdminHeader eyebrow="Subscriptions" title="Access & pricing" sub={`Total control over who can use Kotaana. Every grant lasts at most ${MAX_ACCESS_DAYS} days; renewing never stacks time.`} actions={<Link className="admBtn primary" href="/admin/payments">Pending payments{pendingCount ? ` (${pendingCount})` : ""}</Link>} />
    <Panel title="Price" sub="What a 30-day Kotaana subscription costs. Each person's AI budget is a share of this price."><PriceForm usd={price.usd} rate={price.rate} /></Panel>
    <Panel title="People" flush actions={<form className="admSearch"><input className="admInput" name="q" defaultValue={q} placeholder="Search name or email" /><button className="admBtn">Search</button></form>}>
      <div className="admTableWrap"><table className="admTable"><thead><tr><th>Person</th><th>Role</th><th>Access</th><th>Source</th><th>Expires</th><th>Free trial</th><th></th></tr></thead><tbody>{users.map((u) => {
        const st = accessState(u.subscriptions); const trialEnd = trialOf.get(u.email.toLowerCase());
        return <tr key={u.id}><td><strong>{u.name || u.email}</strong><small>{u.email}</small></td><td><span className="admTag">{u.role}</span></td><td><span className={`admPill ${st.active ? "ok" : "off"}`}>{st.active ? `${st.daysLeft}d left` : "inactive"}</span></td><td>{st.active ? st.source : "—"}</td><td>{st.expiresAt ? st.expiresAt.toLocaleDateString("en-GB") : "—"}</td><td>{trialEnd ? <span className={`admPill ${trialEnd > new Date() ? "warn" : "off"}`}>{trialEnd > new Date() ? "running" : "used"}</span> : <span className="admMuted">available</span>}</td><td><AccessButtons url="/api/admin/subscriptions" userKey="userId" userId={u.id} active={st.active} /></td></tr>;
      })}{!users.length && <tr><td colSpan={7} className="admEmpty">No users found.</td></tr>}</tbody></table></div>
    </Panel>
  </>;
}
