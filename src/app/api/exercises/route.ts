import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const PAGE = 24;
/** The whole exercise library, searchable. Everyone signed in can browse it; the workout builder uses the same table. */
export async function GET(req: Request) {
  const a = await apiAuth(); if ("error" in a) return a.error;
  const u = new URL(req.url); const q = (u.searchParams.get("q") || "").trim(); const part = u.searchParams.get("part") || ""; const eq = u.searchParams.get("equipment") || ""; const page = Math.max(0, Number(u.searchParams.get("page")) || 0);
  const where: any = { verified: true, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}), ...(part ? { bodyPart: { equals: part, mode: "insensitive" } } : {}), ...(eq ? { equipment: { equals: eq, mode: "insensitive" } } : {}) };
  const [rows, total, all, parts, equipment] = await Promise.all([
    prisma.exercise.findMany({ where, orderBy: { name: "asc" }, skip: page * PAGE, take: PAGE, select: { id: true, name: true, bodyPart: true, target: true, equipment: true, difficulty: true, image: true, gif: true } }),
    prisma.exercise.count({ where }), prisma.exercise.count({ where: { verified: true } }),
    prisma.exercise.groupBy({ by: ["bodyPart"], where: { verified: true, bodyPart: { not: null } }, _count: true, orderBy: { _count: { bodyPart: "desc" } }, take: 20 }),
    prisma.exercise.groupBy({ by: ["equipment"], where: { verified: true, equipment: { not: null } }, _count: true, orderBy: { _count: { equipment: "desc" } }, take: 16 }),
  ]);
  return NextResponse.json({ rows, total, all, page, pageSize: PAGE, parts: parts.map((p) => p.bodyPart), equipment: equipment.map((p) => p.equipment) });
}
