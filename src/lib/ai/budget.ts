import { prisma } from "@/lib/db/prisma";
import { getPricing } from "@/lib/subscription";

const DAY = 86400000;
/** Hard ceiling: AI may never cost more than half of what the person pays. The admin can set a lower share, never a higher one. */
export const MAX_AI_SHARE = 0.5;

/** US dollars per million tokens. Used when the provider does not report the cost itself (OpenRouter does; Gemini does not).
 * The admin can override any entry with the app_config key "ai_prices" (JSON: {"model": {"in": 0.3, "out": 2.5}}). */
export const DEFAULT_PRICES: Record<string, { in: number; out: number }> = {
  "deepseek/deepseek-chat-v3.1": { in: 0.27, out: 1.1 },
  "deepseek/deepseek-r1": { in: 0.55, out: 2.19 },
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": { in: 0.6, out: 1.8 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  default: { in: 1, out: 3 },
};

async function settings() {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: ["ai_budget_share", "ai_prices"] } } });
  const share = Number(rows.find((r) => r.key === "ai_budget_share")?.value);
  let prices = DEFAULT_PRICES;
  try { const o = JSON.parse(rows.find((r) => r.key === "ai_prices")?.value || "null"); if (o && typeof o === "object") prices = { ...DEFAULT_PRICES, ...o }; } catch {}
  return { share: Number.isFinite(share) && share > 0 ? Math.min(MAX_AI_SHARE, share) : MAX_AI_SHARE, prices };
}

export async function priceOf(model: string) {
  const { prices } = await settings();
  return prices[model] ?? prices.default ?? DEFAULT_PRICES.default;
}
export async function costOf(model: string, tokensIn: number, tokensOut: number) {
  const p = await priceOf(model);
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
/** A rough token count (about 4 characters per token) for estimating a call before it is made. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export type AiBudget = {
  unlimited: boolean;
  periodStart: Date; periodEnd: Date;
  /** What the person pays for this period, and the AI budget (≤ 50% of it). */
  revenueUsd: number; budgetUsd: number; spentUsd: number;
  /** Today's share: what is left of the budget spread over the days left, so unused credit rolls forward but the period total is never exceeded. */
  todayAllowanceUsd: number; spentTodayUsd: number; remainingTodayUsd: number;
  /** Little credit left today: only the cheapest model is used. */
  tight: boolean;
  /** Nothing left today: AI is skipped and the app falls back to its rule-based plans. */
  exhausted: boolean;
};

const startOfDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** The person's AI budget for their current paid period, trial, or (without either) a rolling 30 days. Admins are unlimited. */
export async function aiBudget(userId: string): Promise<AiBudget> {
  const now = new Date();
  const [user, sub, cfg, price] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
    settings(), getPricing(),
  ]);
  if (user?.role === "admin") return { unlimited: true, periodStart: startOfDay(now), periodEnd: new Date(now.getTime() + DAY), revenueUsd: 0, budgetUsd: Infinity, spentUsd: 0, todayAllowanceUsd: Infinity, spentTodayUsd: 0, remainingTodayUsd: Infinity, tight: false, exhausted: false };
  let start: Date, end: Date, revenue = price.usd;
  if (sub?.status === "active" && sub.startsAt && sub.expiresAt && sub.expiresAt > now) { start = sub.startsAt; end = sub.expiresAt; }
  else {
    const trial = user ? await prisma.trialClaim.findUnique({ where: { email: user.email.toLowerCase() } }) : null;
    if (trial && trial.endsAt > now) { start = trial.startedAt; end = trial.endsAt; revenue = price.usd * Math.min(1, (end.getTime() - start.getTime()) / (30 * DAY)); }
    else { start = new Date(now.getTime() - 30 * DAY); end = now; revenue = 0; }
  }
  const budget = revenue * cfg.share;
  const today = startOfDay(now);
  const [period, todayRows] = await Promise.all([
    prisma.aiUsage.aggregate({ where: { userId, createdAt: { gte: start, lt: today } }, _sum: { costUsd: true } }),
    prisma.aiUsage.aggregate({ where: { userId, createdAt: { gte: today } }, _sum: { costUsd: true } }),
  ]);
  const before = period._sum.costUsd ?? 0, spentToday = todayRows._sum.costUsd ?? 0;
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / DAY));
  const allowance = Math.max(0, budget - before) / daysLeft;
  const remaining = allowance - spentToday;
  return { unlimited: false, periodStart: start, periodEnd: end, revenueUsd: revenue, budgetUsd: budget, spentUsd: before + spentToday, todayAllowanceUsd: allowance, spentTodayUsd: spentToday, remainingTodayUsd: Math.max(0, remaining), tight: remaining < allowance * 0.3, exhausted: remaining <= 0 };
}

/** How many calls of a given estimated cost fit in what is left today (used to size batched work such as workout re-ranking). */
export async function affordableCalls(userId: string, estCostUsd: number, wanted: number) {
  const b = await aiBudget(userId);
  if (b.unlimited) return wanted;
  if (b.exhausted || estCostUsd <= 0) return b.exhausted ? 0 : wanted;
  // Leave room for the day's other AI features (meal plan, reviews): one batch job may use at most half of today's remaining credit.
  return Math.max(0, Math.min(wanted, Math.floor((b.remainingTodayUsd * 0.5) / estCostUsd)));
}
