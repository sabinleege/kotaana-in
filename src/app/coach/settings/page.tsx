import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { PageHead } from "@/components/coach/CoachUI";
import GymProfileForm from "@/components/coach/GymProfileForm";
import CoachMomo from "@/components/CoachMomo";
import CoachFocusForm from "@/components/coach/CoachFocusForm";
import InstallApp from "@/components/InstallApp";
import { CapacityPanel } from "@/components/billing/BillingForms";
import { capacityState } from "@/lib/coach/capacity";
import { getPlatformCode, getPricing } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export default async function CoachSettings() {
  const s = await requireRole("coach");
  const [p, cap, price, code, pendingCap] = await Promise.all([prisma.profile.findUnique({ where: { userId: s.user.id } }), capacityState(s.user.id), getPricing(), getPlatformCode(), prisma.paymentRequest.findFirst({ where: { userId: s.user.id, status: "pending", planType: { startsWith: "coach_capacity_" } } })]);
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SETTINGS" title="Settings" sub={s.user.email || undefined} />
    <div className="solid"><h2 className="sectionTitle">Training focus</h2><p className="small muted" style={{ margin: "4px 0 10px" }}>What you specialise in decides how your athletes' workouts are built.</p><CoachFocusForm initialAreas={p?.focusAreas || []} initialLevel={p?.focusLevel || "standard"} /></div>
    <InstallApp />
    <div className="solid"><h2 className="sectionTitle">Member capacity</h2><p className="small muted" style={{ margin: "4px 0 10px" }}>You look after up to 70 members free. For more, upgrade every 30 days: 150 members $20, 230 members $30, and $10 more for each further 80.</p><div className="statGrid"><div className="stat"><div className="k">Members</div><div className="v">{cap.count} / {cap.capacity}</div>{cap.full && <div className="h" style={{ color: "var(--danger)" }}>Full — new athletes cannot join</div>}</div><div className="stat"><div className="k">Next upgrade</div><div className="v">{cap.nextTier.max}</div><div className="h">${cap.nextTier.usd} / 30 days</div></div>{cap.until && cap.capacity > 70 && <div className="stat"><div className="k">Upgrade until</div><div className="v" style={{ fontSize: 16 }}>{cap.until.toLocaleDateString("en-GB", { dateStyle: "medium" })}</div></div>}</div><div style={{ marginTop: 12 }}><CapacityPanel max={cap.nextTier.max} usd={cap.nextTier.usd} rwf={Math.round(cap.nextTier.usd * price.rate)} code={code} pending={Boolean(pendingCap)} /></div></div>
    <div className="solid"><CoachMomo initial={{ number: p?.momoNumber || "", name: p?.momoName || "", priceRwf: p?.membershipPriceRwf ?? null }} /></div>
    <div className="solid"><h2 className="sectionTitle">Gym profile</h2><p className="small muted" style={{ margin: "4px 0 12px" }}>The name athletes search for, and the equipment members can use in their workouts.</p><GymProfileForm initialName={p?.fullName || ""} initialEquipment={p?.equipment || []} initialType={p?.organizationType || "coach"} /></div>
    <div className="solid"><h2 className="sectionTitle">How athletes join you</h2><p className="small muted" style={{ margin: "4px 0 0" }}>Athletes open <strong>Settings → Coach</strong> in their app, search for <strong>{p?.fullName || "your name"}</strong> and choose you. They are connected immediately — there are no invites or codes to manage.</p></div>
    <div className="solid"><h2 className="sectionTitle">More</h2><div className="rowList" style={{ marginTop: 10 }}>
      <Link className="rowItem" href="/coach/subscription"><span>Your Kotaana plan</span><span>›</span></Link>
      <Link className="rowItem" href="/coach/sessions"><span>Sessions</span><span>›</span></Link>
      <Link className="rowItem" href="/coach/follow-ups"><span>Follow-ups</span><span>›</span></Link>
      <Link className="rowItem" href="/coach/injuries"><span>Injuries</span><span>›</span></Link>
      <Link className="rowItem" href="/coach/attendance"><span>Attendance</span><span>›</span></Link>
    </div></div>
  </div>;
}
