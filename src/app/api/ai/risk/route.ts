import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const a = await apiAuth("athlete");
  if ("error" in a) return a.error;
  const u = a.session.user.id;
  const [profile, checkin, injuries] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: u }, select: { injuryDataStatus: true } }),
    prisma.dailyCheckin.findFirst({ where: { userId: u }, orderBy: { date: "desc" } }),
    prisma.injury.findMany({ where: { athleteId: u, status: { in: ["active", "recovering"] } } }),
  ]);

  const factors: string[] = [];
  const missing: string[] = [];
  let score = 0;
  let measuredFactors = 0;

  if (checkin?.readiness != null) {
    measuredFactors++;
    if (checkin.readiness < 45) { score += 35; factors.push("low readiness"); }
  } else missing.push("readiness");
  if (checkin?.sleepHours != null) {
    measuredFactors++;
    if (checkin.sleepHours < 6) { score += 25; factors.push("low sleep"); }
  } else missing.push("sleep");
  if (checkin?.soreness != null) {
    measuredFactors++;
    if (checkin.soreness >= 4) { score += 25; factors.push("high soreness"); }
  } else missing.push("soreness");
  if (injuries.length) { score += 30; measuredFactors++; factors.push(`${injuries.length} active/recovering restriction(s)`); }
  if (profile?.injuryDataStatus !== "known") { missing.push("confirmed injury status"); }

  const status = measuredFactors === 0 ? "insufficient" : missing.length ? "partial" : "complete";
  return NextResponse.json({
    riskScore: measuredFactors === 0 ? null : Math.min(100, score),
    level: measuredFactors === 0 ? null : score >= 60 ? "high" : score >= 30 ? "moderate" : "low",
    status,
    factors,
    missing,
    note: status === "complete" ? "Risk signal calculated from recorded health data." : "Risk signal is limited because some health data has not been recorded. No missing value is treated as a normal value.",
    generatedAt: new Date().toISOString(),
  });
}
