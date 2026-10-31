import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { LANG_COOKIE, isLang, translate, type Key, type Lang } from "./dict";

/** The language for this request: the cookie set when the person picks a language (fast, no database call). */
export async function getLang(): Promise<Lang> {
  try { const v = (await cookies()).get(LANG_COOKIE)?.value; return isLang(v) ? v : "en"; } catch { return "en"; }
}
export async function getT() {
  const lang = await getLang();
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
/** The saved language of a person, for work done outside a request from them (AI reviews, summaries). */
export async function userLang(userId: string): Promise<Lang> {
  const p = await prisma.profile.findUnique({ where: { userId }, select: { language: true } }).catch(() => null);
  return isLang(p?.language) ? p.language : "en";
}
