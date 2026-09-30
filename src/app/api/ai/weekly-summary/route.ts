import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { getReportData } from "@/lib/reports-data";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const a = await apiAuth("athlete");
  if ("error" in a) return a.error;
  const data = await getReportData(a.session.user.id);
  const s = data.sevenDay;
  const text = data.status === "insufficient"
    ? `No complete weekly report is available yet. Recorded data: ${s.performanceEntries} workout performance entries, ${s.trackedSessions} GPS sessions, ${s.checkins} health check-ins and ${s.mealsLogged} nutrition logs.`
    : `This weekly report uses recorded data only: ${s.completedEntries} completed workout entries out of ${s.performanceEntries}, ${s.trackedSessions} GPS sessions covering ${s.distanceKm} km, ${s.checkins} health check-ins and ${s.mealsLogged} nutrition logs.`;
  await prisma.profile.update({ where: { userId: a.session.user.id }, data: { weeklySummary: text, weeklySummaryAt: new Date() } });
  return NextResponse.json({ summary: { ...s, dataStatus: data.status, missing: data.missing, periodDays: 7 }, text, generatedAt: data.generatedAt });
}
