import Link from "next/link";
import { AthleteFrame } from "@/app/app-layout";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { CoachPayPanel, SubscribePanel } from "@/components/billing/BillingForms";
import { SOURCE_LABEL, accessState, getPlatformCode, getPricing } from "@/lib/subscription";
import { athleteAccess } from "@/lib/access";
import { coachPremium } from "@/lib/coach/premium";

export const dynamic = "force-dynamic";
export default async function AthleteSubscription() {
  const s = await auth(); const userId = s?.user?.id || "";
  const [sub, price, code, history, rel] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }), getPricing(), getPlatformCode(),
    prisma.paymentRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.coachAthleteRelation.findFirst({ where: { athleteId: userId, status: { in: ["active", "paused"] } }, include: { coach: { select: { id: true, name: true, profile: { select: { fullName: true, membershipPriceRwf: true, momoNumber: true, momoName: true } } } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const st = accessState(sub);
  const coachPayable = rel ? await coachPremium(rel.coachId) : true;
  const gate = await athleteAccess(userId, s?.user?.role);
  const coach = rel?.coach; const coachName = coach ? coach.profile?.fullName || coach.name || "your coach" : "";
  const pendingCoach = rel ? history.some((p) => p.status === "pending" && p.planType === "coach_service" && p.coachId === rel.coachId) : false;
  const pendingDirect = history.some((p) => p.status === "pending" && p.planType === "direct");
  const direct = <SubscribePanel planType="direct" rwf={price.rwf} usd={price.usd} code={code} pending={pendingDirect} />;
  return <AthleteFrame allowExpired><div className="stack">
    <Link href="/app/settings" className="small muted">← Settings</Link>
    <div><span className="pill orange">PAYMENT</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Your access</h1></div>
    {gate.reason === "trial" && <div className="card"><span className="prio normal">free trial</span><p style={{ margin: "8px 0 0" }}><strong>{gate.daysLeft} day{gate.daysLeft === 1 ? "" : "s"}</strong> of free trial left. Subscribe any time to keep your workouts, meals and dashboard after that.</p></div>}
    {!gate.allowed && <div className="card" style={{ borderColor: "var(--danger)" }}><strong>Your access has ended.</strong><p className="small muted" style={{ margin: "4px 0 0" }}>Renew below to open your dashboard, workouts and nutrition again. Your data is safe.</p></div>}
    <div className="card">{st.active ? <><span className="prio low">active</span><div style={{ fontSize: 22, fontWeight: 900, margin: "8px 0 2px" }}>{st.daysLeft} day{st.daysLeft === 1 ? "" : "s"} left</div><p className="small muted" style={{ margin: 0 }}>Until {st.expiresAt!.toLocaleDateString("en-GB", { dateStyle: "long" })} · {SOURCE_LABEL[st.source || ""] || "Active"}</p></> : <><span className="prio high">inactive</span><p style={{ margin: "8px 0 0" }}>{coach ? `You don't have active access. Pay ${coachName} below to unlock 30 days.` : "You don't have active access. Subscribe below, or find a coach who can give you access."}</p></>}</div>
    {coach ? <>
      <div><h2 className="sectionTitle">{st.active ? "Renew" : "Pay"} your membership</h2><p className="small muted" style={{ margin: "4px 0 10px" }}>Access always lasts 30 days from confirmation; renewing early never adds extra days.</p></div>
      <CoachPayPanel coachId={coach.id} coachName={coachName} priceRwf={coach.profile?.membershipPriceRwf ?? null} momoNumber={coach.profile?.momoNumber ?? null} momoName={coach.profile?.momoName ?? null} pending={pendingCoach} payable={coachPayable} />
      <details className="card prefsCard"><summary><h2 className="sectionTitle">Or subscribe to Kotaana directly</h2><span className="small muted">${price.usd} / 30 days, no coach needed</span></summary><div style={{ marginTop: 12 }}>{direct}</div></details>
    </> : <>
      <div><h2 className="sectionTitle">{st.active ? "Renew" : "Subscribe"} — ${price.usd} / 30 days</h2><p className="small muted" style={{ margin: "4px 0 10px" }}>Access always lasts 30 days from approval; renewing early never adds extra days. Training with a coach? <Link href="/app/settings/coach" style={{ color: "var(--orange2)" }}>Find your coach</Link> and pay them instead.</p></div>
      {direct}
    </>}
    {history.length > 0 && <div className="card"><h2 className="sectionTitle">Payments</h2><div className="list" style={{ marginTop: 10 }}>{history.map((p) => <div className="item" key={p.id}><div><strong>{p.amount.toLocaleString()} {p.currency}</strong><div className="small muted">{p.planType === "coach_service" ? "Gym membership" : "Kotaana"} · {p.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</div></div><span className={`prio ${p.status === "approved" ? "low" : p.status === "pending" ? "normal" : "high"}`}>{p.status}</span></div>)}</div></div>}
  </div></AthleteFrame>;
}
