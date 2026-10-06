import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { AccessButtons, PriceForm } from "@/components/billing/BillingForms";
import { MAX_ACCESS_DAYS, accessState, getPricing } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export default async function AdminSubscriptions({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("admin"); const { q = "" } = await searchParams;
  const needle = q.trim();
  const [price, users, pendingCount] = await Promise.all([
    getPricing(),
    prisma.user.findMany({ where: { role: { in: ["athlete", "coach"] }, ...(needle ? { OR: [{ email: { contains: needle, mode: "insensitive" } }, { name: { contains: needle, mode: "insensitive" } }] } : {}) }, include: { subscriptions: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.paymentRequest.count({ where: { status: "pending" } }),
  ]);
  return <div className="page"><div className="container" style={{ padding: "22px 0" }}><div className="stack" style={{ gap: 14 }}>
    <div className="pageHead"><div><span className="pill orange">ADMIN</span><h1>Subscriptions</h1><p className="subtitle" style={{ margin: 0 }}>Total control over access. Every grant lasts at most {MAX_ACCESS_DAYS} days.</p></div><div className="row"><Link className="btn primary" href="/admin/payments">Pending payments{pendingCount ? ` (${pendingCount})` : ""}</Link><Link className="btn secondary" href="/admin">Back</Link></div></div>
    <div className="solid"><h2 className="sectionTitle">Price</h2><div style={{ marginTop: 10 }}><PriceForm usd={price.usd} rate={price.rate} /></div></div>
    <form className="row" style={{ flexWrap: "wrap" }}><input className="input" style={{ flex: "1 1 260px" }} name="q" defaultValue={q} placeholder="Search by name or email" /><button className="btn secondary">Search</button></form>
    <div className="solid tableWrap"><table className="dataTable"><thead><tr><th>User</th><th>Role</th><th>Access</th><th>Source</th><th>Expires</th><th></th></tr></thead><tbody>{users.map((u) => { const st = accessState(u.subscriptions); return <tr key={u.id}><td><strong>{u.name || u.email}</strong><div className="small muted">{u.email}</div></td><td>{u.role}</td><td><span className={`prio ${st.active ? "low" : "high"}`}>{st.active ? `${st.daysLeft}d left` : "inactive"}</span></td><td>{st.active ? st.source : "—"}</td><td>{st.expiresAt ? st.expiresAt.toLocaleDateString("en-GB") : "—"}</td><td><AccessButtons url="/api/admin/subscriptions" userKey="userId" userId={u.id} active={st.active} /></td></tr>; })}</tbody></table>{!users.length && <div className="empty">No users found.</div>}</div>
  </div></div></div>;
}
