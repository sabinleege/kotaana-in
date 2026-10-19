import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

const PAGE = 20;
const CONTRA = ["knee", "squat_depth", "impact", "shoulder", "overhead", "lower_back", "hinge", "wrist", "loaded_wrist", "ankle"];
const SAFETY = ["high_risk", "injury_sensitive", "advanced_load", "adult_only", "age_restricted"];

/** Admin: the exercise safety-review queue. Every injury and health filter depends on these tags, so a person checks each exercise here. */
export async function GET(req: Request) {
  const a = await apiAuth("admin"); if ("error" in a) return a.error;
  const u = new URL(req.url); const filter = u.searchParams.get("filter") || "todo"; const q = (u.searchParams.get("q") || "").trim(); const page = Math.max(0, Number(u.searchParams.get("page")) || 0);
  const where: any = { ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) };
  if (filter === "todo") { where.safetyReviewed = false; where.verified = true; }
  else if (filter === "noinstructions") { where.safetyReviewed = false; where.verified = true; where.steps = { isEmpty: true }; where.instructions = null; }
  else if (filter === "reviewed") where.safetyReviewed = true;
  else if (filter === "hidden") where.verified = false;
  const [rows, total, reviewed, all, hidden, cfg] = await Promise.all([
    prisma.exercise.findMany({ where, orderBy: { name: "asc" }, skip: page * PAGE, take: PAGE, select: { id: true, name: true, bodyPart: true, target: true, equipment: true, difficulty: true, steps: true, instructions: true, image: true, gif: true, safetyTags: true, contraindicationTags: true, safetyReviewed: true, verified: true } }),
    prisma.exercise.count({ where }), prisma.exercise.count({ where: { safetyReviewed: true } }), prisma.exercise.count(), prisma.exercise.count({ where: { verified: false } }),
    prisma.appConfig.findUnique({ where: { key: "require_reviewed_exercises" } }),
  ]);
  return NextResponse.json({ rows, total, page, pageSize: PAGE, stats: { all, reviewed, hidden }, onlyReviewed: cfg?.value === "true", options: { contra: CONTRA, safety: SAFETY } });
}

const patch = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), id: z.string(), safetyTags: z.array(z.string().max(40)).max(12).optional(), contraindicationTags: z.array(z.string().max(40)).max(20).optional() }),
  z.object({ action: z.literal("hide"), id: z.string() }),
  z.object({ action: z.literal("restore"), id: z.string() }),
  z.object({ action: z.literal("require_reviewed"), value: z.boolean() }),
]);
export async function PATCH(req: Request) {
  const a = await apiAuth("admin"); if ("error" in a) return a.error;
  const p = patch.safeParse(await req.json().catch(() => null)); if (!p.success) return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  const d = p.data;
  if (d.action === "require_reviewed") { await prisma.appConfig.upsert({ where: { key: "require_reviewed_exercises" }, create: { key: "require_reviewed_exercises", value: String(d.value) }, update: { value: String(d.value) } }); return NextResponse.json({ ok: true }); }
  if (d.action === "approve") await prisma.exercise.update({ where: { id: d.id }, data: { safetyReviewed: true, verified: true, qualityScore: 100, ...(d.safetyTags ? { safetyTags: d.safetyTags } : {}), ...(d.contraindicationTags ? { contraindicationTags: d.contraindicationTags } : {}) } });
  else if (d.action === "hide") await prisma.exercise.update({ where: { id: d.id }, data: { verified: false } });
  else await prisma.exercise.update({ where: { id: d.id }, data: { verified: true } });
  return NextResponse.json({ ok: true });
}
