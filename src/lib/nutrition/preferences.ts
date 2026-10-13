import { prisma } from "@/lib/db/prisma";

type Logged = { foods?: string[]; status?: string };
const clean = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Foods this athlete actually eats: counted from the meals they logged in the last 30 days. Anything eaten at least twice counts as a favourite. */
export async function favoriteFoods(userId: string, limit = 12) {
  const since = new Date(Date.now() - 30 * 86400000);
  const logs = await prisma.mealLog.findMany({ where: { userId, date: { gte: since } }, select: { meals: true } });
  const counts = new Map<string, number>();
  for (const l of logs) for (const m of (Array.isArray(l.meals) ? l.meals : []) as unknown as Logged[]) for (const f of m.foods ?? []) { const k = clean(f); if (k.length > 2) counts.set(k, (counts.get(k) ?? 0) + 1); }
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}

/** True when a food name matches one of the favourites (either contains the other). */
export const isFavorite = (name: string, favorites: string[]) => { const n = clean(name); return favorites.some((f) => n.includes(f) || f.includes(n)); };
