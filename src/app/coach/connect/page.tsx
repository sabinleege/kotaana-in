import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { PageHead } from "@/components/coach/CoachUI";
import { ConnectForm } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachConnect() {
  const s = await requireRole("coach");
  const p = await prisma.profile.findUnique({ where: { userId: s.user.id }, select: { fullName: true, momoNumber: true } });
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="CONNECT" title="Connect with athletes" sub="Three ways for an athlete to join your roster." />
    <div className="solid"><h2 className="sectionTitle">1. Send a request by email</h2><p className="small muted">The athlete gets a request in their Notifications and taps Accept.</p><div style={{ marginTop: 10 }}><ConnectForm /></div></div>
    <div className="solid"><h2 className="sectionTitle">2. Share an invite code</h2><p className="small muted">Fastest: the athlete joins instantly with the code or link.</p><Link className="btn primary" style={{ display: "inline-block", marginTop: 10 }} href="/coach/invites">Create invite code</Link></div>
    <div className="solid"><h2 className="sectionTitle">3. Athletes search for you</h2><p className="small muted">Athletes find you in <strong>Settings → Coach connection</strong> by searching <strong>{p?.fullName || "your name"}</strong>{p?.momoNumber ? <> or your MoMo number <strong>{p.momoNumber}</strong></> : null}. Their requests appear on your Overview and Athletes pages.</p><Link className="linkBtn" href="/coach/settings">Edit how athletes see you →</Link></div>
  </div>;
}
