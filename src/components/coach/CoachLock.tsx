import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { coachPremium } from "@/lib/coach/premium";
import { getPricing } from "@/lib/subscription";
import { PageHead } from "./CoachUI";

/** Shown instead of member data while the coach has not paid Kotaana. */
export async function coachLock(coachId: string, what = "your members' data") {
  if (await coachPremium(coachId)) return null;
  const price = await getPricing();
  const members = await prisma.coachAthleteRelation.count({ where: { coachId, status: { in: ["active", "paused"] } } });
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="PREMIUM" title="Activate your coach plan" sub={`Seeing ${what} is part of the paid plan.`} />
    <div className="solid stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}><span className="prio high">locked</span><strong>{members ? `${members} member${members === 1 ? " is" : "s are"} already connected to you.` : "Athletes can find you by name already."}</strong></div>
      <p className="small muted" style={{ margin: 0 }}>You can sign in, set your price and payment details, and be found by athletes without paying. To see member data, run your portal and take payments from athletes, activate your plan: <strong>${price.usd} every 30 days</strong>. Athletes can't pay you until you have paid Kotaana first.</p>
      <div className="row" style={{ flexWrap: "wrap" }}><Link className="btn primary" href="/coach/subscription">Activate my plan</Link><Link className="btn secondary" href="/coach/settings">Settings</Link></div>
    </div>
  </div>;
}
