import { NextResponse } from "next/server";
import { logError } from "@/lib/observability";
import { prisma } from "@/lib/db/prisma";
import { apiAuth } from "@/lib/auth/guard";
import { fetchWeather, hydrationTargetMl } from "@/lib/location/weather";
import { buildDailyFoodPlan, type DailyFoodPlan } from "@/lib/nutrition/engine";
import { aiDailyFoodPlan } from "@/lib/ai/meal-plan";
import { nutritionTargets } from "@/lib/health/targets";
import { activeRules } from "@/lib/health/conditions";
import { paywallResponse } from "@/lib/access";
import { takeUsage } from "@/lib/usage";
import { favoriteFoods } from "@/lib/nutrition/preferences";
import { isChild } from "@/lib/health/targets";

const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const loadProfile = (userId: string) => prisma.profile.findUnique({ where: { userId } });
type Profile = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;

/** A cached plan is reused until the athlete changes anything that feeds it. */
const prefsKey = (p: Profile) => JSON.stringify([p.primaryGoal, p.dietaryStyle, p.allergies, p.targetCalories, p.weight, p.height, p.mealsPerDay, p.culturalRestrictions, p.healthConditions, p.isPregnant, p.locationCountry, p.locationCity, p.trainingDaysPerWeek]);

async function generate(userId: string, profile: Profile, today: Date): Promise<DailyFoodPlan> {
  const conditions = Array.isArray(profile.healthConditions) ? profile.healthConditions.map(String) : [];
  const targets = nutritionTargets(profile) ?? { calories: 2200, protein: 130, carbs: 260, fat: 70 };
  const weather = profile.locationLat != null && profile.locationLng != null ? await fetchWeather(profile.locationLat, profile.locationLng) : null;
  const favorites = await favoriteFoods(userId);
  const child = isChild(profile.age);
  const common = { userId, favorites, goal: profile.primaryGoal, dietaryStyle: profile.dietaryStyle, allergies: profile.allergies, conditions, isPregnant: profile.isPregnant, targetCalories: targets.calories, location: { city: profile.locationCity, country: profile.locationCountry }, weather };

  // The library plan supplies hydration, health notes and the fallback meals; the AI model only replaces the meals.
  let base: DailyFoodPlan | null = null;
  try {
    const foods = await prisma.food.findMany({ where: { verified: true }, take: 10000 });
    base = buildDailyFoodPlan(foods, common);
  } catch (e) { logError("api_error", e, { where: "nutrition_library" }); }

  const rules = activeRules(conditions, profile.isPregnant);
  const temp = weather?.temperatureC;
  const trainsToday = (await prisma.workoutPlan.count({ where: { userId, date: today, isActive: true } })) > 0;
  const ai = await aiDailyFoodPlan({
    country: profile.locationCountry, city: profile.locationCity, climate: temp == null ? "unknown" : temp >= 28 ? "hot" : temp <= 12 ? "cold" : "mild",
    dietaryStyle: profile.dietaryStyle, allergies: profile.allergies, culturalRestrictions: profile.culturalRestrictions,
    healthNotes: [...new Set(rules.map((r) => r.nutritionNote).filter(Boolean) as string[])], avoidFoods: rules.map((r) => r.avoidFoods).filter(Boolean) as RegExp[],
    goal: profile.primaryGoal, favorites, childAge: child ? profile.age : null, targets, mealsPerDay: profile.mealsPerDay ?? 3, trainsToday, dayKey: today.toISOString().slice(0, 10),
  }).catch((e) => { logError("api_error", e, { where: "nutrition_ai" }); return null; });

  if (!ai && !base) throw new Error("No usable foods for the current preferences.");
  const water = base?.hydration.mlTarget ?? hydrationTargetMl(2500, weather);
  const plan: DailyFoodPlan = {
    dateKey: today.toISOString().slice(0, 10),
    locationLabel: base?.locationLabel ?? ([profile.locationCity, profile.locationCountry].filter(Boolean).join(", ") || "Location not set"),
    weatherNote: base?.weatherNote ?? "Weather unavailable.",
    hydration: base?.hydration ?? { mlTarget: water, glassesTarget: Math.ceil(water / 300), workoutBreakMl: 500, tips: ["Drink 500 ml between workout blocks."] },
    healthNotes: [...(base?.healthNotes ?? []), ...(child ? ["Growing body: calories are not restricted and meals include dairy and iron-rich foods."] : [])],
    meals: ai ? ai.meals : base!.meals,
    source: ai ? "ai" : "library",
    targets,
    summary: ai ? `${ai.summary || "Meals planned for your region, goal and health profile."} Estimated by the AI planner — portions are approximate.` : base!.summary,
  };
  const stored = { ...plan, prefsKey: prefsKey(profile) } as unknown as object;
  await prisma.nutritionPlan.upsert({ where: { userId_date: { userId, date: today } }, create: { userId, date: today, planJson: stored, source: plan.source! }, update: { planJson: stored, source: plan.source!, createdAt: new Date() } });
  if (plan.hydration.mlTarget !== profile.waterTargetMl) await prisma.profile.update({ where: { userId }, data: { waterTargetMl: plan.hydration.mlTarget } });
  return plan;
}

async function respond(userId: string, force: boolean) {
  const profile = await loadProfile(userId);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const today = dateOnly(new Date());
  try {
    let plan: DailyFoodPlan | null = null;
    if (!force) {
      const cached = await prisma.nutritionPlan.findUnique({ where: { userId_date: { userId, date: today } } });
      const j = cached?.planJson as (DailyFoodPlan & { prefsKey?: string }) | undefined;
      if (j && j.prefsKey === prefsKey(profile)) plan = j;
    }
    if (!plan) plan = await generate(userId, profile, today);
    const log = await prisma.mealLog.findUnique({ where: { userId_date: { userId, date: today } } });
    return NextResponse.json({ ok: true, plan, log: log ? { meals: log.meals, totalCalories: log.totalCalories, totalProtein: log.totalProtein } : { meals: [], totalCalories: 0, totalProtein: 0 } });
  } catch (e) {
    logError("api_error", e, {});
    return NextResponse.json({ ok: false, error: "Food library has no usable foods for these dietary constraints." }, { status: 422 });
  }
}

export const maxDuration = 60;
export async function GET() { const a = await apiAuth("athlete"); if ("error" in a) return a.error; const blocked = await paywallResponse(a.session.user.id, a.session.user.role); if (blocked) return blocked; return respond(a.session.user.id, false); }
/** Builds a fresh plan for today on request. */
export async function POST() {
  const a = await apiAuth("athlete"); if ("error" in a) return a.error;
  const blocked = await paywallResponse(a.session.user.id, a.session.user.role); if (blocked) return blocked;
  const cap = await takeUsage(a.session.user.id, "nutrition_plan");
  if (!cap.ok) return NextResponse.json({ ok: false, code: "DAILY_LIMIT", error: `You've rebuilt your meal plan ${cap.limit} times today — that's the daily limit. Today's plan stays available.` }, { status: 429 });
  return respond(a.session.user.id, true);
}
