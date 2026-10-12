import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth/guard";

const ITEMS: { key: string; label: string; needed: string; vars: string[] }[] = [
  { key: "auth", label: "Sign-in secret & site URL", needed: "Required", vars: ["AUTH_SECRET", "AUTH_URL"] },
  { key: "google", label: "Google sign-in", needed: "Optional", vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { key: "deepseek", label: "AI meal & workout planning (DeepSeek via OpenRouter)", needed: "Recommended", vars: ["OPENROUTER_API_KEY"] },
  { key: "gemini", label: "Meal photo check (Gemini)", needed: "Recommended", vars: ["GEMINI_API_KEY"] },
  { key: "email", label: "Password-reset emails (Resend)", needed: "Recommended", vars: ["RESEND_API_KEY"] },
  { key: "momo", label: "MoMo live payments", needed: "Optional (manual approval works without it)", vars: ["MOMO_SUBSCRIPTION_KEY", "MOMO_API_USER", "MOMO_API_KEY"] },
  { key: "webhook", label: "MoMo webhook signature", needed: "Required if MoMo is live", vars: ["MOMO_WEBHOOK_SECRET"] },
];

/** Which settings are in place — names and yes/no only, never the values. */
export async function GET() {
  const a = await apiAuth("admin"); if ("error" in a) return a.error;
  return NextResponse.json({ items: ITEMS.map((i) => ({ label: i.label, needed: i.needed, ok: i.vars.every((v) => Boolean(process.env[v])), missing: i.vars.filter((v) => !process.env[v]) })) });
}
