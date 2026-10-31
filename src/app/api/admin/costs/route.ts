import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { costReport } from "@/lib/admin/costs";
import { MAX_AI_SHARE } from "@/lib/ai/budget";

export const dynamic = "force-dynamic";
export async function GET() {
  const a = await apiAuth("admin"); if ("error" in a) return a.error;
  return NextResponse.json(await costReport());
}

/** AI budget share (never above 50% of the subscription price) and the monthly hosting cost used in the margin. */
const body = z.object({ share: z.number().min(0.05).max(MAX_AI_SHARE), infraUsdMonth: z.number().min(0).max(100000) });
export async function POST(req: Request) {
  const a = await apiAuth("admin"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: `The AI share must be between 5% and ${MAX_AI_SHARE * 100}% of the price.` }, { status: 400 });
  await prisma.$transaction([
    prisma.appConfig.upsert({ where: { key: "ai_budget_share" }, create: { key: "ai_budget_share", value: String(p.data.share) }, update: { value: String(p.data.share) } }),
    prisma.appConfig.upsert({ where: { key: "infra_cost_usd_month" }, create: { key: "infra_cost_usd_month", value: String(p.data.infraUsdMonth) }, update: { value: String(p.data.infraUsdMonth) } }),
  ]);
  return NextResponse.json({ ok: true });
}
