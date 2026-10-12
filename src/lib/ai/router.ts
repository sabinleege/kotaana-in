type Provider = "openrouter" | "gemini";
export type AiOptions = { system?: string; temperature?: number };

const WORKOUT_SYSTEM = "You are a constrained Kotaana fitness personalization layer. You may only choose from verified IDs provided by the application. Never invent exercise IDs, medical diagnoses, or unsafe instructions.";

function pick(): Provider | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function openrouter(prompt: string, o: AiOptions) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": process.env.AUTH_URL || "http://localhost:3000", "X-Title": "Kotaana" },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3.1", temperature: o.temperature ?? 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: o.system || WORKOUT_SYSTEM }, { role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || "";
}

async function gemini(prompt: string, o: AiOptions) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key!)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${o.system || "You are a constrained Kotaana fitness personalization layer. Only choose verified IDs supplied by the app."} Return JSON only.\n${prompt}` }] }], generationConfig: { temperature: o.temperature ?? 0.1, responseMimeType: "application/json" } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function aiText(prompt: string, options: AiOptions = {}) {
  const provider = pick();
  if (!provider) return null;
  return provider === "openrouter" ? openrouter(prompt, options) : gemini(prompt, options);
}
export function aiProvider() { return pick(); }

/** Looks at a photo of a meal and says what it appears to contain. Needs a Gemini key; returns null when vision is unavailable. */
export async function aiVision(prompt: string, image: { mimeType: string; base64: string }): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\nReturn JSON only.` }, { inline_data: { mime_type: image.mimeType, data: image.base64 } }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
}
