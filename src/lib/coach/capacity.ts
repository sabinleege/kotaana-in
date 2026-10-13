import { prisma } from "@/lib/db/prisma";

/** A coach, gym or club looks after up to 70 members for free. Beyond that they pay for a bigger tier every 30 days. */
export const FREE_MEMBERS = 70;
export const TIERS = [
  { max: 70, usd: 0 },
  { max: 150, usd: 20 },
  { max: 230, usd: 30 },
  { max: 310, usd: 40 },
] as const;

/** Past the table, each further block of 80 members costs $10 more. */
export function tierAfter(max: number) {
  const next = TIERS.find((t) => t.max > max);
  if (next) return { max: next.max, usd: next.usd };
  const steps = Math.ceil((max + 1 - TIERS[TIERS.length - 1].max) / 80);
  return { max: TIERS[TIERS.length - 1].max + steps * 80, usd: TIERS[TIERS.length - 1].usd + steps * 10 };
}

export function tierCovering(members: number) {
  let t: { max: number; usd: number } = { max: TIERS[0].max, usd: TIERS[0].usd };
  while (t.max < members) t = tierAfter(t.max);
  return t;
}

/** What a coach may hold right now: the paid tier while it lasts, otherwise the free 70. */
export function effectiveCapacity(p?: { memberCapacity: number; capacityUntil: Date | null } | null) {
  if (p && p.capacityUntil && p.capacityUntil.getTime() > Date.now()) return Math.max(FREE_MEMBERS, p.memberCapacity);
  return FREE_MEMBERS;
}

export async function memberCount(coachId: string) {
  return prisma.coachAthleteRelation.count({ where: { coachId, status: { in: ["active", "paused"] } } });
}

export async function capacityState(coachId: string) {
  const [p, count] = await Promise.all([prisma.profile.findUnique({ where: { userId: coachId }, select: { memberCapacity: true, capacityUntil: true } }), memberCount(coachId)]);
  const capacity = effectiveCapacity(p);
  const next = tierAfter(capacity);
  return { count, capacity, full: count >= capacity, nextTier: next, until: p?.capacityUntil ?? null };
}

export const capacityPlanType = (max: number) => `coach_capacity_${max}`;
export const parseCapacityPlan = (planType: string) => { const m = /^coach_capacity_(\d+)$/.exec(planType); return m ? Number(m[1]) : null; };
