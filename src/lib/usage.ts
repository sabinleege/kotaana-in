import { prisma } from "@/lib/db/prisma";

/** Fair-use caps per person per day. Everything not listed here (water, check-ins, weights, logs…) is unlimited. */
export const DAILY_LIMITS = { meal_photo: 10, workout_build: 3, nutrition_plan: 5 } as const;
export type UsageKind = keyof typeof DAILY_LIMITS;

const today = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };

export async function usageToday(userId: string, kind: UsageKind) {
  const row = await prisma.usageCounter.findUnique({ where: { userId_kind_date: { userId, kind, date: today() } } });
  return { used: row?.count ?? 0, limit: DAILY_LIMITS[kind] };
}

/** Counts one use and says whether it was allowed. A refused use is not counted. */
export async function takeUsage(userId: string, kind: UsageKind) {
  const limit = DAILY_LIMITS[kind]; const date = today();
  const row = await prisma.usageCounter.upsert({ where: { userId_kind_date: { userId, kind, date } }, create: { userId, kind, date, count: 1 }, update: { count: { increment: 1 } } });
  if (row.count > limit) {
    await prisma.usageCounter.update({ where: { id: row.id }, data: { count: { decrement: 1 } } });
    return { ok: false as const, used: limit, limit };
  }
  return { ok: true as const, used: row.count, limit };
}

/** Gives a use back, for example when a build failed after it was counted. */
export async function refundUsage(userId: string, kind: UsageKind) {
  await prisma.usageCounter.updateMany({ where: { userId, kind, date: today(), count: { gt: 0 } }, data: { count: { decrement: 1 } } });
}
