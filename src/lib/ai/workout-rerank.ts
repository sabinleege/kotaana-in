import { aiText } from "./router";
import type { ExerciseRow, UserWorkoutContext } from "@/lib/workout/types";

const BATCH = 160;
const MAX_BATCHES = 20; // 20 x 160 = 3,200 exercises, so a library of 2,000+ is covered in full
const SYSTEM = "You are a constrained Kotaana fitness personalization layer. You may only choose from verified IDs provided by the application. Never invent exercise IDs, medical diagnoses, or unsafe instructions.";

/** Asks the model about the person's WHOLE safe pool, not a sample: the pool is split into batches, every batch is shown to the model in parallel, and each returns the best few. The union is the AI's preference list. */
export async function rerankWorkoutCandidates(safe: ExerciseRow[], ctx: UserWorkoutContext & { goals?: string[]; focusLabels?: string[] }) {
  const batches: ExerciseRow[][] = [];
  for (let i = 0; i < safe.length && batches.length < MAX_BATCHES; i += BATCH) batches.push(safe.slice(i, i + BATCH));
  const user = { ageBand: ctx.ageBand || "unknown", level: ctx.level || "beginner", track: ctx.track || "general", goals: ctx.goals?.length ? ctx.goals : [ctx.goal || "general_fitness"], coachSpecialty: ctx.focusLabels?.length ? ctx.focusLabels : undefined, availableMinutes: ctx.availableMinutes || 35, readiness: ctx.readiness || 70 };
  const results = await Promise.all(batches.map(async (b) => {
    const allowed = new Set(b.map((e) => e.id));
    const prompt = JSON.stringify({ task: "Return {\"preferredExerciseIds\":string[]} with the 6 IDs from candidates that best fit this user's goals and coach specialty today. Choose ONLY IDs from candidates. Do not judge medical safety; the application already filtered for safety.", user, candidates: b.map((e) => ({ id: e.id, n: e.name, eq: e.equipment, t: e.target, d: e.difficulty })) });
    try {
      const raw = await aiText(prompt, { system: SYSTEM });
      const json = raw?.match(/\{[\s\S]*\}/)?.[0]; if (!json) return [] as string[];
      const d = JSON.parse(json);
      return Array.isArray(d.preferredExerciseIds) ? d.preferredExerciseIds.filter((x: unknown): x is string => typeof x === "string" && allowed.has(x)).slice(0, 6) : [];
    } catch { return [] as string[]; }
  }));
  return [...new Set(results.flat())];
}
