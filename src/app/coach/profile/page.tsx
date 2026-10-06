import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { PageHead } from "@/components/coach/CoachUI";
import GymProfileForm from "@/components/coach/GymProfileForm";
import { CopyButton } from "@/components/coach/CoachForms";

export const dynamic = "force-dynamic";
export default async function GymProfile() {
  const s = await requireRole("coach");
  const p = await prisma.profile.findUnique({ where: { userId: s.user.id } });
  return <div className="stack" style={{ gap: 14 }}>
    <PageHead eyebrow="GYM" title="Gym profile" sub="How athletes see you, what equipment members can use, and the codes they use to join and pay." />
    <div className="solid"><GymProfileForm initialName={p?.fullName || ""} initialEquipment={p?.equipment || []} /></div>
    <div className="grid grid2">
      <div className="solid"><h2 className="sectionTitle">Gym join code</h2><p className="small muted">Permanent. Anyone who enters it in <strong>Settings → Coach connection</strong> joins your members.</p><div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}><code className="inviteCode">{p?.connectCode || "—"}</code>{p?.connectCode && <CopyButton text={p.connectCode} label="Copy code" />}</div></div>
      <div className="solid"><h2 className="sectionTitle">Payment details</h2><p className="small muted">Members pay this MoMo number; you approve each payment under Memberships.</p><div className="rowList" style={{ marginTop: 10 }}><div className="rowItem"><span className="small muted">MoMo number</span><strong>{p?.momoNumber || "Not set"}</strong></div><div className="rowItem"><span className="small muted">Account name</span><strong>{p?.momoName || "Not set"}</strong></div></div><a className="linkBtn" href="/coach/settings">Edit payment details →</a></div>
    </div>
  </div>;
}
