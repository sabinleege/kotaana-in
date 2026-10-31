import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { LANG_COOKIE, isLang } from "@/lib/i18n/dict";

/** Sets the interface language. Works signed out too (sign-in page); when signed in it is also saved to the profile so AI replies use it. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isLang(body?.lang)) return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  const s = await auth();
  if (s?.user?.id) await prisma.profile.updateMany({ where: { userId: s.user.id }, data: { language: body.lang } });
  const res = NextResponse.json({ ok: true, lang: body.lang });
  res.cookies.set(LANG_COOKIE, body.lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
