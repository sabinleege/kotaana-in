import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { homePath } from "@/lib/auth/role";

export default async function Complete() {
  const s = await auth();
  if (!s?.user?.id) redirect("/auth?mode=login");
  const role = s.user.role as "athlete" | "coach" | "admin";
  if (role === "athlete") {
    const p = await prisma.profile.findUnique({ where: { userId: s.user.id }, select: { onboardingCompleted: true } });
    if (!p?.onboardingCompleted) redirect("/app/onboarding");
  }
  if (role === "coach") {
    const p = await prisma.profile.findUnique({ where: { userId: s.user.id }, select: { onboardingCompleted: true } });
    if (!p?.onboardingCompleted) redirect("/coach/onboarding");
  }
  redirect(homePath(role as any));
}
