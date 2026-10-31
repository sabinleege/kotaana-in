import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { accessState } from "@/lib/subscription";
import { trialState, type TrialState } from "@/lib/trial";

export type AthleteAccess = { allowed: boolean; reason: "admin" | "subscription" | "trial" | "paywall_off" | "expired"; daysLeft: number; expiresAt: Date | null; trial: TrialState | null };

async function paywallOn() {
  const row = await prisma.appConfig.findUnique({ where: { key: "paywall_enabled" } });
  return row?.value !== "false";
}

/** An athlete may use the app with a paid or granted 30-day subscription, or during the one free trial they started themselves. Admins always may.
 * Without either they can still sign in and look around (preview mode), but every action that builds or records something is refused. */
export async function athleteAccess(userId: string, role?: string): Promise<AthleteAccess> {
  if (role === "admin") return { allowed: true, reason: "admin", daysLeft: 9999, expiresAt: null, trial: null };
  const [paywall, sub] = await Promise.all([paywallOn(), prisma.subscription.findUnique({ where: { userId } })]);
  if (!paywall) return { allowed: true, reason: "paywall_off", daysLeft: 9999, expiresAt: null, trial: null };
  const st = accessState(sub);
  if (st.active) return { allowed: true, reason: "subscription", daysLeft: st.daysLeft, expiresAt: st.expiresAt, trial: null };
  const trial = await trialState(userId);
  if (trial.active) return { allowed: true, reason: "trial", daysLeft: trial.daysLeft, expiresAt: trial.endsAt, trial };
  return { allowed: false, reason: "expired", daysLeft: 0, expiresAt: st.expiresAt, trial };
}

/** For API routes: returns a 402 response when the athlete has no access, otherwise null. */
export async function paywallResponse(userId: string, role?: string) {
  const a = await athleteAccess(userId, role);
  if (a.allowed) return null;
  const error = a.trial?.eligible ? "You're exploring Kotaana. Start your free trial in Settings → Subscription to use this." : "Your access has ended. Renew in Settings → Subscription to keep using Kotaana.";
  return NextResponse.json({ error, code: "ACCESS_EXPIRED", trialEligible: Boolean(a.trial?.eligible) }, { status: 402 });
}
