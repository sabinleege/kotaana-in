import { prisma } from "@/lib/db/prisma";
import { aiBudget, costOf, estimateTokens } from "./budget";

type Provider = "openrouter" | "gemini";
export type AiOptions = {
  system?: string; temperature?: number; timeoutMs?: number;
  /** Overrides the default model (used for the larger review model). Dropped for the default model when the person's credit for the day is low. */
  model?: string;
  /** Whose budget pays for the call. Without it the call is not budgeted (system work). */
  userId?: string;
  /** Feature name for the admin cost report: workout_rerank, meal_plan, review, meal_photo, health_photo… */
  feature?: string;
};
type Result = { text: string; model: string; tokensIn: number; tokensOut: number; costUsd: number | null };

const WORKOUT_SYSTEM = "You are a constrained Kotaana fitness personalization layer. You may only choose from verified IDs provided by the application. Never invent exercise IDs, medical diagnoses, or unsafe instructions.";
const DEFAULT_OPENROUTER = () => process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3.1";
const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

function pick(): Provider | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function openrouter(prompt: string, o: AiOptions): Promise<Result> {
  // Some models (for example Nemotron) reject JSON mode; if so, ask again as plain text and let the caller pull the JSON out of it.
  const first = await openrouterCall(prompt, o, true);
  if (first.status === 400) { const again = await openrouterCall(prompt, o, false); if (again.ok) return again.result; }
  if (!first.ok) throw new Error(`OpenRouter ${first.status}`);
  return first.result;
}
async function openrouterCall(prompt: string, o: AiOptions, json: boolean) {
  const model = o.model || DEFAULT_OPENROUTER();
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    signal: AbortSignal.timeout(o.timeoutMs ?? 22000),
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": process.env.AUTH_URL || "http://localhost:3000", "X-Title": "Kotaana" },
    // usage.include asks OpenRouter to report the exact cost of the call, which is what the budget counts.
    body: JSON.stringify({ model, temperature: o.temperature ?? 0.1, usage: { include: true }, ...(json ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: o.system || WORKOUT_SYSTEM }, { role: "user", content: prompt }] }),
  });
  if (!r.ok) return { ok: false as const, status: r.status, result: null as never };
  const d = await r.json();
  const u = d.usage ?? {};
  const result: Result = { text: (d.choices?.[0]?.message?.content || "") as string, model: d.model || model, tokensIn: Number(u.prompt_tokens) || 0, tokensOut: Number(u.completion_tokens) || 0, costUsd: typeof u.cost === "number" ? u.cost : null };
  return { ok: true as const, status: r.status, result };
}

async function gemini(prompt: string, o: AiOptions): Promise<Result> {
  const key = process.env.GEMINI_API_KEY;
  const model = GEMINI_MODEL();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key!)}`, {
    signal: AbortSignal.timeout(22000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${o.system || "You are a constrained Kotaana fitness personalization layer. Only choose verified IDs supplied by the app."} Return JSON only.\n${prompt}` }] }], generationConfig: { temperature: o.temperature ?? 0.1, responseMimeType: "application/json" } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return { text: d.candidates?.[0]?.content?.parts?.[0]?.text || "", model, tokensIn: Number(d.usageMetadata?.promptTokenCount) || 0, tokensOut: Number(d.usageMetadata?.candidatesTokenCount) || 0, costUsd: null };
}

/** Checks the person's budget before a call. Returns the options to use (possibly a cheaper model) or null when today's credit is used up. */
async function guard(o: AiOptions, prompt: string) {
  if (!o.userId) return o;
  const b = await aiBudget(o.userId);
  if (b.exhausted) {
    await prisma.aiUsage.create({ data: { userId: o.userId, functionName: o.feature || "ai", status: "skipped_budget", tokensIn: estimateTokens(prompt) } }).catch(() => {});
    return null;
  }
  return b.tight ? { ...o, model: undefined } : o;
}
async function record(o: AiOptions, started: number, res: Result | null, error?: unknown) {
  if (!o.userId) return;
  const costUsd = res ? res.costUsd ?? (await costOf(res.model, res.tokensIn, res.tokensOut)) : 0;
  await prisma.aiUsage.create({ data: { userId: o.userId, functionName: o.feature || "ai", model: res?.model ?? o.model ?? null, tokensIn: res?.tokensIn ?? 0, tokensOut: res?.tokensOut ?? 0, costUsd, durationMs: Date.now() - started, status: error ? "error" : "success", errorMessage: error ? String(error instanceof Error ? error.message : error).slice(0, 300) : null } }).catch(() => {});
}

export async function aiText(prompt: string, options: AiOptions = {}) {
  const provider = pick();
  if (!provider) return null;
  const o = await guard(options, prompt);
  if (!o) return null;
  const started = Date.now();
  try {
    const res = provider === "openrouter" ? await openrouter(prompt, o) : await gemini(prompt, o);
    await record(o, started, res);
    return res.text;
  } catch (e) { await record(o, started, null, e); throw e; }
}
export function aiProvider() { return pick(); }

/** Looks at a photo (meal, wound) and says what it appears to contain. Needs a Gemini key; returns null when vision is unavailable or today's AI credit is used up. */
export async function aiVision(prompt: string, image: { mimeType: string; base64: string }, options: Pick<AiOptions, "userId" | "feature"> = {}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const o = await guard({ ...options }, prompt);
  if (!o) return null;
  const model = GEMINI_MODEL(); const started = Date.now();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(22000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\nReturn JSON only.` }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const d = await r.json();
    await record(o, started, { text: "", model, tokensIn: Number(d.usageMetadata?.promptTokenCount) || 0, tokensOut: Number(d.usageMetadata?.candidatesTokenCount) || 0, costUsd: null });
    return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) { await record(o, started, null, e); throw e; }
}
