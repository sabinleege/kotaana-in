import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { fmtDate } from "@/lib/coach/data";
import { Empty, PageHead } from "@/components/coach/CoachUI";
import { ActionButton, CopyButton, InviteForm } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function CoachInvites() {
  const s = await requireRole("coach");
  const invites = await prisma.coachInvite.findMany({ where: { coachId: s.user.id }, include: { acceptedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
  const now = new Date();
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="INVITES" title="Invite athletes" sub="Create a code or link and share it (WhatsApp, SMS, email). The athlete joins your roster as soon as they enter it." />
    <div className="solid"><InviteForm /></div>
    <div className="rowList">{invites.map((inv) => { const status = inv.status === "pending" && inv.expiresAt < now ? "expired" : inv.status; return <div className="rowItem" key={inv.id} style={{ opacity: status === "pending" ? 1 : .6 }}>
      <div><div className="row" style={{ gap: 8 }}><code className="inviteCode">{inv.inviteCode}</code><span className={`prio ${status === "accepted" ? "low" : status === "pending" ? "normal" : "high"}`}>{status}</span></div>
        <div className="small muted" style={{ marginTop: 4 }}>{inv.email ? `For ${inv.email} · ` : "Open code · "}Created {fmtDate(inv.createdAt)} · {status === "accepted" ? `Used by ${inv.acceptedBy?.name || inv.acceptedBy?.email} on ${fmtDate(inv.acceptedAt)}` : `Expires ${fmtDate(inv.expiresAt)}`}</div></div>
      {status === "pending" && <div className="row"><CopyButton text={`/join?code=${inv.inviteCode}`} /><CopyButton text={inv.inviteCode} label="Copy code" /><ActionButton url={`/api/coach/invites?id=${inv.id}`} method="DELETE" label="Revoke" confirm="Revoke this invite?" /></div>}
    </div>; })}{!invites.length && <Empty>No invites yet. Create one above.</Empty>}</div>
    <p className="small muted">Athletes can also enter the code in <strong>Settings → Coach connection</strong>.</p>
  </div>;
}
