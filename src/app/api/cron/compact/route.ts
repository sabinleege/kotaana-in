import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { compactAll } from "@/lib/summaries";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Daily job: summarise closed weeks and months, then delete raw data the summaries cover.
 * Called by the scheduler with "Authorization: Bearer $CRON_SECRET" (Vercel Cron and Cloudflare Cron Triggers both can), or by an admin from the dashboard. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  if (!(secret && bearer)) {
    const s = await auth();
    if (s?.user?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await compactAll()) });
}
