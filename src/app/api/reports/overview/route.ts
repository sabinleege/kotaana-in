import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { getReportData } from "@/lib/reports-data";

export async function GET() {
  const a = await apiAuth("athlete");
  if ("error" in a) return a.error;
  return NextResponse.json({ report: await getReportData(a.session.user.id) });
}
