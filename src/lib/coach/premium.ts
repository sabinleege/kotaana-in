import { prisma } from "@/lib/db/prisma";
import { accessState } from "@/lib/subscription";

/** A coach, gym or club has "premium" once they have paid Kotaana (or an admin granted it). Without it they can still register, be found by name and log in,
 * but they cannot see their members' data and athletes cannot pay them. A free trial does not count: the coach must pay Kotaana first. */
export async function coachPremium(coachId: string) {
  const [sub, off] = await Promise.all([prisma.subscription.findUnique({ where: { userId: coachId } }), prisma.appConfig.findUnique({ where: { key: "paywall_enabled" } })]);
  if (off?.value === "false") return true;
  return accessState(sub).active;
}
