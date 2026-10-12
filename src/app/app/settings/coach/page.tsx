import Link from "next/link";
import { AthleteFrame } from "@/app/app-layout";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import CoachFinder from "@/components/CoachFinder";
import LeaveCoachButton from "@/components/LeaveCoachButton";

export const dynamic = "force-dynamic";
export default async function CoachSettings() {
  const s = await auth();
  const rel = s?.user?.id ? await prisma.coachAthleteRelation.findFirst({ where: { athleteId: s.user.id, status: { in: ["active", "paused"] } }, include: { coach: { select: { id: true, name: true, profile: { select: { fullName: true, membershipPriceRwf: true } } } } }, orderBy: { updatedAt: "desc" } }) : null;
  const coachName = rel ? rel.coach.profile?.fullName || rel.coach.name || "Your coach" : null;
  return <AthleteFrame><div className="stack">
    <Link href="/app/settings" className="small muted">← Settings</Link>
    <div><span className="pill orange">COACH</span><h1 style={{ fontSize: 28, margin: "9px 0 4px" }}>Your coach</h1><p className="subtitle">With a coach, your workouts, check-ins and progress go to them. On your own, only you see your data.</p></div>
    {rel ? <div className="card"><div className="row spread" style={{ flexWrap: "wrap" }}><div><div className="small muted">CONNECTED</div><div style={{ fontSize: 20, fontWeight: 800 }}>{coachName}</div><div className="small muted">{rel.status === "paused" ? "Paused by your coach · " : ""}{rel.coach.profile?.membershipPriceRwf ? `${rel.coach.profile.membershipPriceRwf.toLocaleString()} RWF / 30 days` : "Price not set yet"}</div></div><div className="row" style={{ flexWrap: "wrap" }}><Link className="btn primary small" href="/app/settings/subscription">Pay membership</Link><LeaveCoachButton name={coachName!} /></div></div></div>
      : <div className="card"><div className="small muted">TRAINING ON YOUR OWN</div><p className="subtitle" style={{ margin: "4px 0 0" }}>Your plans are built from your own setup. Find a coach below whenever you want one.</p></div>}
    <CoachFinder currentCoachId={rel?.coachId ?? null} currentCoachName={coachName} />
  </div></AthleteFrame>;
}
