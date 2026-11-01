import { prisma } from "@/lib/db/prisma";
import { getPricing } from "@/lib/subscription";
import { MAX_AI_SHARE, aiBudget } from "@/lib/ai/budget";

const DAY = 86400000;
/** Payments that go to Kotaana itself. Gym memberships (coach_service) are paid to the gym, not to Kotaana. */
const KOTAANA_PLANS = (planType: string) => planType === "direct" || planType === "coach_plan" || planType.startsWith("coach_capacity_");

export async function costSettings() {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: ["ai_budget_share", "infra_cost_usd_month"] } } });
  const share = Number(rows.find((r) => r.key === "ai_budget_share")?.value);
  const infra = Number(rows.find((r) => r.key === "infra_cost_usd_month")?.value);
  return { share: Number.isFinite(share) && share > 0 ? Math.min(MAX_AI_SHARE, share) : MAX_AI_SHARE, infraUsdMonth: Number.isFinite(infra) && infra >= 0 ? infra : 0 };
}

/** What AI and hosting cost against what Kotaana earned: totals, by feature and model, a daily series, the heaviest users against their budget, and table sizes. */
export async function costReport() {
  const now = Date.now(); const since30 = new Date(now - 30 * DAY), since7 = new Date(now - 7 * DAY);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [rows, payments, price, cfg, activeSubs, activeTrials, skipped] = await Promise.all([
    prisma.aiUsage.findMany({ where: { createdAt: { gte: since30 } }, select: { userId: true, functionName: true, model: true, tokensIn: true, tokensOut: true, costUsd: true, status: true, createdAt: true } }),
    prisma.paymentRequest.findMany({ where: { status: "approved", updatedAt: { gte: since30 } }, select: { planType: true, amount: true, currency: true } }),
    getPricing(), costSettings(),
    prisma.subscription.count({ where: { status: "active", expiresAt: { gt: new Date() } } }),
    prisma.trialClaim.count({ where: { endsAt: { gt: new Date() } } }),
    prisma.aiUsage.count({ where: { createdAt: { gte: since30 }, status: "skipped_budget" } }),
  ]);
  const window = (from: Date) => { const xs = rows.filter((r) => r.createdAt >= from && r.status !== "skipped_budget"); return { costUsd: xs.reduce((n, r) => n + r.costUsd, 0), calls: xs.length, tokens: xs.reduce((n, r) => n + r.tokensIn + r.tokensOut, 0), errors: xs.filter((r) => r.status === "error").length }; };
  const group = (key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, { key: string; costUsd: number; calls: number; tokens: number }>();
    for (const r of rows) { if (r.status === "skipped_budget") continue; const k = key(r); const g = m.get(k) ?? { key: k, costUsd: 0, calls: 0, tokens: 0 }; g.costUsd += r.costUsd; g.calls++; g.tokens += r.tokensIn + r.tokensOut; m.set(k, g); }
    return [...m.values()].sort((a, b) => b.costUsd - a.costUsd);
  };
  const daily = Array.from({ length: 30 }, (_, i) => { const d = new Date(today.getTime() - (29 - i) * DAY); const e = new Date(d.getTime() + DAY); return { date: d.toISOString().slice(0, 10), costUsd: rows.filter((r) => r.createdAt >= d && r.createdAt < e).reduce((n, r) => n + r.costUsd, 0) }; });
  const revenueRwf = payments.filter((p) => KOTAANA_PLANS(p.planType)).reduce((n, p) => n + (p.currency === "USD" ? p.amount * price.rate : p.amount), 0);
  const revenueUsd = revenueRwf / price.rate;
  const ai30 = window(since30);
  const margin = revenueUsd - ai30.costUsd - cfg.infraUsdMonth;

  const perUser = group((r) => r.userId).slice(0, 10);
  const users = await prisma.user.findMany({ where: { id: { in: perUser.map((u) => u.key) } }, select: { id: true, email: true, name: true, role: true } });
  const topUsers = await Promise.all(perUser.map(async (u) => { const b = await aiBudget(u.key).catch(() => null); const who = users.find((x) => x.id === u.key); return { ...u, name: who?.name || who?.email || "deleted user", email: who?.email ?? null, role: who?.role ?? null, budgetUsd: b && !b.unlimited ? b.budgetUsd : null, periodSpentUsd: b?.spentUsd ?? null, budgetUsedPct: b && !b.unlimited && b.budgetUsd > 0 ? Math.round((b.spentUsd / b.budgetUsd) * 100) : null }; }));

  let storage: { table: string; bytes: number; rows: number }[] = [];
  try {
    // Only the app's own schema (DATABASE_URL ?schema=…), not other schemas in the same database.
    let schema = "public"; try { schema = new URL(process.env.DATABASE_URL || "").searchParams.get("schema") || "public"; } catch {}
    storage = (await prisma.$queryRaw<{ table: string; bytes: bigint; rows: bigint }[]>`SELECT relname AS "table", pg_total_relation_size(relid) AS bytes, n_live_tup AS rows FROM pg_catalog.pg_stat_user_tables WHERE schemaname = ${schema} ORDER BY pg_total_relation_size(relid) DESC LIMIT 14`).map((r) => ({ table: r.table, bytes: Number(r.bytes), rows: Number(r.rows) }));
  } catch {}
  const summaries = await prisma.periodSummary.aggregate({ _count: true, _sum: { rowsCompacted: true } }).catch(() => null);

  return {
    generatedAt: new Date().toISOString(), price, settings: cfg,
    windows: { today: window(today), d7: window(since7), d30: ai30 },
    byFeature: group((r) => r.functionName), byModel: group((r) => r.model || "unknown"), daily, topUsers,
    finance: { revenueUsd, revenueRwf, aiCostUsd: ai30.costUsd, infraUsd: cfg.infraUsdMonth, marginUsd: margin, aiShareOfRevenuePct: revenueUsd > 0 ? Math.round((ai30.costUsd / revenueUsd) * 1000) / 10 : null, perPayingUserAiUsd: activeSubs ? ai30.costUsd / activeSubs : null, maxAiPerUserUsd: price.usd * cfg.share },
    people: { activeSubs, activeTrials }, skippedForBudget: skipped,
    storage, summaries: { count: summaries?._count ?? 0, rowsCompacted: summaries?._sum.rowsCompacted ?? 0 },
  };
}
export type CostReport = Awaited<ReturnType<typeof costReport>>;
