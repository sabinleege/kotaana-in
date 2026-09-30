import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth(); if ("error" in a) return a.error;
  const { id } = await params;
  const e = await prisma.exercise.findUnique({ where: { id }, select: { id: true, name: true, gif: true, image: true, steps: true, instructions: true, frames: true, equipment: true, target: true, bodyPart: true } });
  if (!e) return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  // Instructions may carry a machine-readable "[frames] …" note; keep only the human text.
  const instructions = e.instructions?.replace(/\[frames\][^\n]*/g, "").trim() || null;
  const steps = e.steps.length ? e.steps : instructions ? instructions.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean) : [];
  return NextResponse.json({ exercise: { ...e, instructions, steps } });
}
