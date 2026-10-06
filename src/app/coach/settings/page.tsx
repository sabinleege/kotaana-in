import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { PageHead } from "@/components/coach/CoachUI";
import { CoachNameForm } from "@/components/coach/CoachForms";
import CoachMomo from "@/components/CoachMomo";

export const dynamic = "force-dynamic";
export default async function CoachSettings() {
  const s = await requireRole("coach");
  const p = await prisma.profile.findUnique({ where: { userId: s.user.id } });
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="SETTINGS" title="Gym settings" sub={s.user.email || undefined} />
    <div className="solid"><h2 className="sectionTitle">Profile</h2><div style={{ marginTop: 10 }}><CoachNameForm initial={p?.fullName || ""} /></div></div>
    <div className="solid"><CoachMomo initial={{ number: p?.momoNumber || "", name: p?.momoName || "" }} /></div>
    <div className="solid"><h2 className="sectionTitle">More</h2><div className="rowList" style={{ marginTop: 10 }}>
      <Link className="rowItem" href="/coach/members"><span>Members management</span><span>›</span></Link>
      <Link className="rowItem" href="/coach/subscription"><span>Subscription</span><span>›</span></Link>
      <Link className="rowItem" href="/coach/payments"><span>Athlete payments</span><span>›</span></Link>
    </div></div>
  </div>;
}
