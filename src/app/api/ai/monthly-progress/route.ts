import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { getReportData } from "@/lib/reports-data";

function monthKey(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; }

export async function GET() {
  const a = await apiAuth("athlete");
  if ("error" in a) return a.error;
  const data = await getReportData(a.session.user.id);
  const m = data.thirtyDay;
  const summary = data.status === "insufficient"
    ? "No complete monthly report is available yet. The report will become more useful as real activity is recorded."
    : `This monthly report is based only on recorded data: ${m.performanceEntries} workout performance entries, ${m.trackedSessions} GPS sessions, ${m.checkins} health check-ins, ${m.mealsLogged} nutrition logs and ${m.weightEntries} weight records.`;
  const metrics = { ...m, dataStatus: data.status, missing: data.missing, sources: data.sources, generatedAt: data.generatedAt };
  const report = await prisma.monthlyProgressReport.upsert({
    where: { userId_monthKey: { userId: a.session.user.id, monthKey: monthKey() } },
    update: { metrics, summary },
    create: { userId: a.session.user.id, monthKey: monthKey(), metrics, summary },
  });
  return NextResponse.json({ report, dataStatus: data.status, missing: data.missing });
}
