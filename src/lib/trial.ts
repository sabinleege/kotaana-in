import { prisma } from "@/lib/db/prisma";

const DAY = 86400000;
export const DEFAULT_TRIAL_DAYS = 7;

export type TrialState = {
  /** The trial is running now. */
  active: boolean;
  /** The person may still start their one trial. */
  eligible: boolean;
  /** Why a trial cannot be started: already used, or the person has paid before. */
  blockedBy: "used" | "paid" | null;
  daysLeft: number;
  endsAt: Date | null;
  days: number;
};

export async function trialDays() {
  const row = await prisma.appConfig.findUnique({ where: { key: "trial_days" } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.floor(n) : DEFAULT_TRIAL_DAYS;
}

/** Someone "has paid" once any payment was approved for them or any access was ever granted (paid, gym or admin). */
async function hasPaidBefore(userId: string) {
  const [approved, sub] = await Promise.all([
    prisma.paymentRequest.count({ where: { userId, status: "approved" } }),
    prisma.subscription.findUnique({ where: { userId }, select: { startsAt: true, source: true } }),
  ]);
  return approved > 0 || Boolean(sub?.startsAt && sub.source);
}

/** One free trial per email address, ever. It is started by the person from Settings, never automatically,
 * and only by someone who has never paid. Once it ends it can never be started again. */
export async function trialState(userId: string): Promise<TrialState> {
  const [user, days] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { email: true } }), trialDays()]);
  const claim = user ? await prisma.trialClaim.findUnique({ where: { email: user.email.toLowerCase() } }) : null;
  if (claim) {
    const left = claim.endsAt.getTime() - Date.now();
    return { active: left > 0, eligible: false, blockedBy: "used", daysLeft: left > 0 ? Math.ceil(left / DAY) : 0, endsAt: claim.endsAt, days };
  }
  if (days === 0) return { active: false, eligible: false, blockedBy: null, daysLeft: 0, endsAt: null, days };
  const paid = await hasPaidBefore(userId);
  return { active: false, eligible: !paid, blockedBy: paid ? "paid" : null, daysLeft: 0, endsAt: null, days };
}

export async function startTrial(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user || user.role === "admin") return { ok: false as const, error: "This account cannot start a trial." };
  const st = await trialState(userId);
  if (!st.eligible) return { ok: false as const, error: st.blockedBy === "paid" ? "The free trial is only for people who have not subscribed before." : "Your free trial has already been used. It can only be used once." };
  const endsAt = new Date(Date.now() + st.days * DAY);
  try {
    // The email is the primary key, so two simultaneous requests cannot both create a trial.
    await prisma.trialClaim.create({ data: { email: user.email.toLowerCase(), userId, role: user.role, endsAt } });
  } catch {
    return { ok: false as const, error: "Your free trial has already been used. It can only be used once." };
  }
  await prisma.notification.create({ data: { userId, title: "Your free trial has started", message: `You have ${st.days} days of full access. It ends on ${endsAt.toLocaleDateString("en-GB", { dateStyle: "long" })} and cannot be restarted.`, type: "billing" } }).catch(() => {});
  return { ok: true as const, endsAt, days: st.days };
}
