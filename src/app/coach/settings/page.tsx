import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { PageHead } from "@/components/coach/CoachUI";
import GymProfileForm from "@/components/coach/GymProfileForm";
import CoachMomo from "@/components/CoachMomo";

export const dynamic = "force-dynamic";
export default async function CoachSettings() {
  const s = await requireRole("coach");
  const p = await prisma.profile.findUnique({ where: { userId: s.user.id } });
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SETTINGS" title="Settings" sub={s.user.email || undefined} />
    <div className="solid"><CoachMomo initial={{ number: p?.momoNumber || "", name: p?.momoName || "", priceRwf: p?.membershipPriceRwf ?? null }} /></div>
    <div className="solid"><h2 className="sectionTitle">Gym profile</h2><p className="small muted" style={{ margin: "4px 0 12px" }}>The name athletes search for, and the equipment members can use in their workouts.</p><GymProfileForm initialName={p?.fullName || ""} initialEquipment={p?.equipment || []} /></div>
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
