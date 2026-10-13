import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { paywallResponse } from "@/lib/access";
import { generateReview, reviewDue, type ReviewKind } from "@/lib/ai/review";

const DAY = 86400000;
export async function GET() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const d = await reviewDue(a.session.user.id);
  return NextResponse.json({ due: { review: d.review, monthly: d.monthly }, review: d.latestReview, monthly: d.latestMonthly });
}

/** Writes a new review when one is due (or when asked for explicitly with { force: true }, at most once a day). */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const userId = a.session.user.id;
  const blocked = await paywallResponse(userId, a.session.user.role); if (blocked) return blocked;
  const body = await req.json().catch(() => ({}));
  const kind: ReviewKind = body?.kind === "monthly" ? "monthly" : "review";
  const d = await reviewDue(userId);
  const prev = kind === "monthly" ? d.latestMonthly : d.latestReview;
  const isDue = kind === "monthly" ? d.monthly : d.review;
  const sameDay = prev && Date.now() - prev.createdAt.getTime() < DAY;
  if (!isDue && !(body?.force && !sameDay)) return NextResponse.json({ ok: true, report: prev, generated: false });
  return NextResponse.json({ ok: true, report: await generateReview(userId, kind), generated: true });
}
