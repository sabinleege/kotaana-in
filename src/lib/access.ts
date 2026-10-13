import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { accessState } from "@/lib/subscription";

const DAY = 86400000;
export type AthleteAccess = { allowed: boolean; reason: "admin" | "subscription" | "trial" | "paywall_off" | "expired"; daysLeft: number; expiresAt: Date | null };

async function config() {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: ["trial_days", "paywall_enabled"] } } });
  const trial = Number(rows.find((r) => r.key === "trial_days")?.value);
  return { trialDays: Number.isFinite(trial) && trial >= 0 ? trial : 7, paywall: rows.find((r) => r.key === "paywall_enabled")?.value !== "false" };
}

/** An athlete may use the app with a paid or granted 30-day subscription, or during the free trial counted from sign-up. Admins always may. */
export async function athleteAccess(userId: string, role?: string): Promise<AthleteAccess> {
  if (role === "admin") return { allowed: true, reason: "admin", daysLeft: 9999, expiresAt: null };
  const [cfg, user] = await Promise.all([config(), prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, subscriptions: true } })]);
  if (!cfg.paywall) return { allowed: true, reason: "paywall_off", daysLeft: 9999, expiresAt: null };
  const st = accessState(user?.subscriptions);
  if (st.active) return { allowed: true, reason: "subscription", daysLeft: st.daysLeft, expiresAt: st.expiresAt };
  if (user) {
    const trialEnd = new Date(user.createdAt.getTime() + cfg.trialDays * DAY);
    if (trialEnd.getTime() > Date.now()) return { allowed: true, reason: "trial", daysLeft: Math.ceil((trialEnd.getTime() - Date.now()) / DAY), expiresAt: trialEnd };
  }
  return { allowed: false, reason: "expired", daysLeft: 0, expiresAt: st.expiresAt };
}

/** For API routes: returns a 402 response when the athlete has no access, otherwise null. */
export async function paywallResponse(userId: string, role?: string) {
  const a = await athleteAccess(userId, role);
  return a.allowed ? null : NextResponse.json({ error: "Your access has ended. Renew in Settings → Subscription to keep using Kotaana.", code: "ACCESS_EXPIRED" }, { status: 402 });
}
