import Link from "next/link";
import { AthleteFrame } from "@/app/app-layout";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import CoachFinder from "@/components/CoachFinder";
import JoinCodeForm from "@/components/JoinCodeForm";

export const dynamic = "force-dynamic";
export default async function CoachSettings() {
  const s = await auth();
  const rels = s?.user?.id ? await prisma.coachAthleteRelation.findMany({ where: { athleteId: s.user.id, status: { in: ["active", "paused", "pending"] } }, include: { coach: { select: { name: true, email: true, profile: { select: { fullName: true, momoNumber: true } } } } }, orderBy: { createdAt: "desc" } }) : [];
  const label = (st: string, by: string) => st === "active" ? "Connected" : st === "paused" ? "Paused by coach" : by === "athlete" ? "Request sent — waiting for coach" : "Coach invited you — answer in Notifications";
  return <AthleteFrame><div className="stack">
    <Link href="/app/settings" className="small muted">← Settings</Link>
    {rels.length > 0 && <div className="card"><h2 className="sectionTitle">Your coaches</h2><div className="list" style={{ marginTop: 10 }}>{rels.map((r) => <div className="item" key={r.id}><div><strong>{r.coach.profile?.fullName || r.coach.name || r.coach.email}</strong><div className="small muted">{label(r.status, r.requestedByRole)}</div></div>{r.status === "active" && <span className="pill">✓</span>}</div>)}</div></div>}
    <div className="card"><h2 className="sectionTitle">Have an invite code?</h2><p className="subtitle">Enter the code your coach gave you to join instantly.</p><div style={{ marginTop: 10 }}><JoinCodeForm /></div></div>
    <CoachFinder />
  </div></AthleteFrame>;
}
