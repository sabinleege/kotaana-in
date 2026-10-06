import Link from "next/link";
import { AthleteFrame } from "@/app/app-layout";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { SubscribePanel } from "@/components/billing/BillingForms";
import { SOURCE_LABEL, accessState, getPlatformCode, getPricing } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export default async function AthleteSubscription() {
  const s = await auth(); const userId = s?.user?.id || "";
  const [sub, price, code, pending, history] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }), getPricing(), getPlatformCode(),
    prisma.paymentRequest.findFirst({ where: { userId, status: "pending", planType: "direct" } }),
    prisma.paymentRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const st = accessState(sub);
  return <AthleteFrame><div className="stack">
    <Link href="/app/settings" className="small muted">← Settings</Link>
    <div><span className="pill orange">SUBSCRIPTION</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Your access</h1></div>
    <div className="card">{st.active ? <><span className="prio low">active</span><div style={{ fontSize: 22, fontWeight: 900, margin: "8px 0 2px" }}>{st.daysLeft} day{st.daysLeft === 1 ? "" : "s"} left</div><p className="small muted" style={{ margin: 0 }}>Until {st.expiresAt!.toLocaleDateString("en-GB", { dateStyle: "long" })} · {SOURCE_LABEL[st.source || ""] || "Active"}</p></> : <><span className="prio high">inactive</span><p style={{ margin: "8px 0 0" }}>You don't have active access. Subscribe below, or ask your gym to give you access.</p></>}</div>
    <div><h2 className="sectionTitle">{st.active ? "Renew" : "Subscribe"} — ${price.usd} / 30 days</h2><p className="small muted" style={{ margin: "4px 0 10px" }}>Access always lasts 30 days from approval; renewing early never adds extra days.</p></div>
    <SubscribePanel planType="direct" rwf={price.rwf} usd={price.usd} code={code} pending={Boolean(pending)} />
    {history.length > 0 && <div className="card"><h2 className="sectionTitle">Payments</h2><div className="list" style={{ marginTop: 10 }}>{history.map((p) => <div className="item" key={p.id}><div><strong>{p.amount.toLocaleString()} {p.currency}</strong><div className="small muted">{p.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</div></div><span className={`prio ${p.status === "approved" ? "low" : p.status === "pending" ? "normal" : "high"}`}>{p.status}</span></div>)}</div></div>}
  </div></AthleteFrame>;
}
