import { prisma } from "@/lib/db/prisma";
import PaymentApprovals from "@/components/PaymentApprovals";
import { AdminHeader } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
export default async function AdminPayments() {
  const rows = await prisma.paymentRequest.findMany({ where: { status: "pending" }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
  return <>
    <AdminHeader eyebrow="Payments" title="Payment approvals" sub={rows.length ? `${rows.length} waiting. Confirm only after the MoMo money has arrived.` : "Nothing is waiting for confirmation."} />
    <div className="admPayments"><PaymentApprovals rows={rows} back="/admin" embedded /></div>
  </>;
}
