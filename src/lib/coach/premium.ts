import { prisma } from "@/lib/db/prisma";
import { accessState } from "@/lib/subscription";
import { trialState } from "@/lib/trial";

async function paywallOff() {
  const off = await prisma.appConfig.findUnique({ where: { key: "paywall_enabled" } });
  return off?.value === "false";
}

/** A coach, gym or club has paid Kotaana (or an admin granted it). Only a paid coach may receive payments from athletes:
 * a trial never counts here, so nobody can collect members' money during a free trial and leave. */
export async function coachPaid(coachId: string) {
  if (await paywallOff()) return true;
  return accessState(await prisma.subscription.findUnique({ where: { userId: coachId } })).active;
}

/** "Premium" for the portal: paid, or inside the coach's one 7-day free trial. Without it a coach can still register, be found by name,
 * log in and look around, but cannot see members' data. */
export async function coachPremium(coachId: string) {
  if (await coachPaid(coachId)) return true;
  return (await trialState(coachId)).active;
}
