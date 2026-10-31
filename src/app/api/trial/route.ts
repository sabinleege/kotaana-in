import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { startTrial, trialState } from "@/lib/trial";

export async function GET() {
  const a = await apiAuth("athlete", "coach"); if ("error" in a) return a.error;
  return NextResponse.json(await trialState(a.session.user.id));
}

/** Starts the person's one free trial. Refused if it was ever used (for this email) or if they have paid before. */
export async function POST() {
  const a = await apiAuth("athlete", "coach"); if ("error" in a) return a.error;
  const r = await startTrial(a.session.user.id);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 409 });
}
