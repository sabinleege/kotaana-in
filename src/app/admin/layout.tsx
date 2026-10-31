import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("admin");
  const pending = await prisma.paymentRequest.count({ where: { status: "pending" } });
  return <div className="adm"><AdminNav email={s.user.email || "admin"} pendingPayments={pending} /><main className="admMain">{children}</main></div>;
}
