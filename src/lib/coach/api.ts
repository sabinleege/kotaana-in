import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";
import { coachCanAccess } from "./data";
import { coachPremium } from "./premium";

/** Authenticates a coach and, when athleteId is given, checks the coach manages that athlete. */
export async function coachApi(athleteId?: string) {
  const a = await apiAuth("coach");
  if ("error" in a) return { error: a.error } as const;
  if (!(await coachPremium(a.session.user.id))) return { error: NextResponse.json({ error: "Activate your coach plan to use member tools.", code: "COACH_PREMIUM" }, { status: 402 }) } as const;
  if (athleteId && !(await coachCanAccess(a.session.user.id, athleteId))) return { error: NextResponse.json({ error: "This athlete is not on your roster." }, { status: 403 }) } as const;
  return { coachId: a.session.user.id, session: a.session } as const;
}
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const readJson = (req: Request) => req.json().catch(() => null);
