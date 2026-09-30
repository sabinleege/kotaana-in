import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { getProgressSeries } from "@/lib/reports-data";

export async function GET(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const days = Number(new URL(req.url).searchParams.get("days") || 30);
  if (![7, 30, 90].includes(days)) return NextResponse.json({ error: "days must be 7, 30 or 90" }, { status: 400 });
  return NextResponse.json(await getProgressSeries(a.session.user.id, days));
}
