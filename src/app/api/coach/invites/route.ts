import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { coachApi, bad, readJson } from "@/lib/coach/api";

// Unambiguous characters only (no 0/O, 1/I) so codes can be read out loud or typed from a screen.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

const create = z.object({ email: z.string().trim().email().optional().nullable().or(z.literal("")), days: z.number().int().min(1).max(60).default(14) });
export async function POST(req: Request) {
  const p = create.safeParse((await readJson(req)) ?? {}); if (!p.success) return bad("Enter a valid email or leave it empty.");
  const c = await coachApi(); if ("error" in c) return c.error;
  const invite = await prisma.coachInvite.create({ data: { coachId: c.coachId, email: p.data.email ? p.data.email.toLowerCase() : null, inviteCode: newCode(), expiresAt: new Date(Date.now() + p.data.days * 86400000) } });
  return NextResponse.json({ ok: true, invite });
}
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const c = await coachApi(); if ("error" in c) return c.error;
  const n = await prisma.coachInvite.updateMany({ where: { id, coachId: c.coachId, status: "pending" }, data: { status: "revoked" } });
  return n.count ? NextResponse.json({ ok: true }) : bad("Invite not found or already used.", 404);
}
