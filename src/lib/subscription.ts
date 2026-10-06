import { prisma } from "@/lib/db/prisma";

/** Hard limit: access never extends further than 30 days from the moment it is granted. */
export const MAX_ACCESS_DAYS = 30;
const DAY = 86400000;

export type AccessSource = "direct" | "gym" | "admin";

export async function getPricing() {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: ["price_usd", "usd_to_rwf"] } } });
  const val = (k: string, d: number) => { const n = Number(rows.find((r) => r.key === k)?.value); return Number.isFinite(n) && n > 0 ? n : d; };
  const usd = val("price_usd", 10), rate = val("usd_to_rwf", 1450);
  return { usd, rate, rwf: Math.round(usd * rate) };
}

/** Grants or renews access. The expiry is always at most now + 30 days, so renewing early never stacks time. */
export async function grantAccess(opts: { userId: string; source: AccessSource; grantedById?: string | null; planType?: string; days?: number }) {
  const days = Math.min(MAX_ACCESS_DAYS, Math.max(1, Math.floor(opts.days ?? MAX_ACCESS_DAYS)));
  const now = new Date(); const expiresAt = new Date(now.getTime() + days * DAY);
  const data = { planType: opts.planType ?? "standard", status: "active", startsAt: now, expiresAt, source: opts.source, grantedById: opts.grantedById ?? null };
  return prisma.subscription.upsert({ where: { userId: opts.userId }, create: { userId: opts.userId, ...data }, update: data });
}

export async function revokeAccess(userId: string) {
  return prisma.subscription.updateMany({ where: { userId }, data: { status: "inactive", expiresAt: new Date() } });
}

export type AccessState = { active: boolean; expiresAt: Date | null; daysLeft: number; source: string | null };
export const accessState = (s?: { status: string; expiresAt: Date | null; source: string | null } | null): AccessState => {
  const active = Boolean(s && s.status === "active" && s.expiresAt && s.expiresAt.getTime() > Date.now());
  return { active, expiresAt: s?.expiresAt ?? null, daysLeft: active ? Math.ceil((s!.expiresAt!.getTime() - Date.now()) / DAY) : 0, source: s?.source ?? null };
};

export async function getPlatformCode() {
  const c = await prisma.appConfig.findUnique({ where: { key: "platform_momo_code" } });
  return c?.value || process.env.KOTAANA_PLATFORM_MOMO_CODE || null;
}
export const SOURCE_LABEL: Record<string, string> = { direct: "Paid by you", gym: "Provided by your gym", admin: "Provided by Kotaana" };
