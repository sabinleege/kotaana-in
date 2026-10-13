import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { aiVision } from "@/lib/ai/router";
import { logError } from "@/lib/observability";
import { paywallResponse } from "@/lib/access";
import { refundUsage, takeUsage } from "@/lib/usage";
import type { DailyFoodPlan } from "@/lib/nutrition/engine";

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const body = z.object({ slot: z.enum(["breakfast", "lunch", "dinner", "snack", "post_workout"]), image: z.string().max(6_000_000).optional(), remove: z.boolean().optional() });

export type LoggedMeal = { foods?: string[]; slot: string; name: string; calories: number; protein: number; carbs: number; fat: number; status: "eaten" | "verified" | "partial" | "mismatch" | "unchecked"; note?: string; loggedAt: string };

const clean = (raw: string) => raw.replace(/^```(?:json)?|```$/g, "").trim();

/** Marks a planned meal as eaten. With a photo, the AI checks that the plate matches the plan and the logged calories follow what it sees. */
export async function POST(req: Request) {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid meal log." }, { status: 400 });
  const userId = a.session.user.id; const today = dateOnly(new Date());
  const blocked = await paywallResponse(userId, a.session.user.role); if (blocked) return blocked;
  const planRow = await prisma.nutritionPlan.findUnique({ where: { userId_date: { userId, date: today } } });
  const plan = planRow?.planJson as unknown as DailyFoodPlan | undefined;
  const meal = plan?.meals.find((m) => m.slot === p.data.slot);
  if (!meal) return NextResponse.json({ error: "That meal is not part of today's plan." }, { status: 404 });

  const existing = await prisma.mealLog.findUnique({ where: { userId_date: { userId, date: today } } });
  const prior = (Array.isArray(existing?.meals) ? existing!.meals : []) as unknown as LoggedMeal[];
  const others = prior.filter((m) => m.slot !== p.data.slot);

  let entry: LoggedMeal | null = null;
  let message = "";
  if (p.data.remove) message = `${meal.name} removed from today's log.`;
  else {
    const e: LoggedMeal = { foods: meal.foods.map((f) => f.name), slot: meal.slot, name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs ?? 0, fat: meal.fat ?? 0, status: "eaten", loggedAt: new Date().toISOString() };
    message = `${meal.name} logged.`;
    const m = p.data.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (p.data.image && !m) return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 400 });
    const rescale = (est: number) => { if (!est) return; const k = est / Math.max(1, meal.calories); e.calories = est; e.protein = Math.round(meal.protein * k); e.carbs = Math.round(e.carbs * k); e.fat = Math.round(e.fat * k); };
    if (m) {
      const cap = await takeUsage(userId, "meal_photo");
      if (!cap.ok) return NextResponse.json({ error: `You've checked ${cap.limit} meal photos today — that's the daily limit. You can still log meals without a photo.`, code: "DAILY_LIMIT" }, { status: 429 });
      try {
        const raw = await aiVision(`You check meal photos for a nutrition app. The athlete was planned to eat: ${meal.foods.map((f) => `${f.name} (${f.servingSize || "1 serving"})`).join(", ")}. Look at the photo. Return {"isFood":boolean,"match":"yes"|"partly"|"no","seen":string[],"estimatedCalories":number,"comment":string} where match says whether the plate reasonably corresponds to the plan, and estimatedCalories is your estimate of what is on the plate.`, { mimeType: m[1], base64: m[2] });
        if (!raw) { e.status = "unchecked"; e.note = "Photo could not be checked automatically — logged as planned."; message = `${meal.name} logged. Photo checking is not available right now, so it was logged as planned.`; }
        else {
          const v = JSON.parse(clean(raw));
          const est = Math.max(0, Math.min(3000, Math.round(Number(v.estimatedCalories) || 0)));
          if (v.isFood === false) return NextResponse.json({ error: "That photo doesn't look like a meal. Try again with your plate in view." }, { status: 422 });
          if (v.match === "yes") { e.status = "verified"; message = `Looks like your planned ${meal.name.toLowerCase()} ✓`; }
          else if (v.match === "partly") { e.status = "partial"; rescale(est); message = `Partly matches your plan — logged about ${e.calories} kcal.`; }
          else { e.status = "mismatch"; rescale(est); message = `This doesn't look like the planned ${meal.name.toLowerCase()} — logged what we can see (about ${e.calories} kcal).`; }
          if (Array.isArray(v.seen) && (e.status === "partial" || e.status === "mismatch")) e.foods = v.seen.slice(0, 6).map((x: unknown) => String(x).slice(0, 60));
          const comment = typeof v.comment === "string" ? v.comment.slice(0, 200) : "";
          e.note = [Array.isArray(v.seen) ? `Seen: ${v.seen.slice(0, 6).join(", ")}` : "", comment].filter(Boolean).join(" · ").slice(0, 300) || undefined;
        }
      } catch (err) {
        logError("api_error", err, { where: "meal_photo" });
        e.status = "unchecked"; e.note = "Photo could not be checked — logged as planned."; message = `${meal.name} logged. The photo couldn't be checked, so it was logged as planned.`;
      }
    }
    entry = e;
  }

  const meals = entry ? [...others, entry] : others;
  const totalCalories = meals.reduce((n, x) => n + x.calories, 0);
  const totalProtein = meals.reduce((n, x) => n + x.protein, 0);
  await prisma.mealLog.upsert({ where: { userId_date: { userId, date: today } }, create: { userId, date: today, meals: meals as unknown as object, totalCalories, totalProtein }, update: { meals: meals as unknown as object, totalCalories, totalProtein } });
  return NextResponse.json({ ok: true, message, entry, log: { meals, totalCalories, totalProtein } });
}
