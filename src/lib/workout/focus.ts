/** What a coach, gym or club specialises in. Athletes who join them get workouts that lean towards this and are as demanding as the coach says. */
export const FOCUS_OPTIONS = [
  { id: "strength", label: "Strength & powerlifting", goals: ["muscle_gain"], words: ["squat", "deadlift", "press", "row", "pull", "carry", "barbell"] },
  { id: "hypertrophy", label: "Muscle building", goals: ["muscle_gain"], words: ["curl", "extension", "press", "row", "fly", "raise", "dip"] },
  { id: "fat_loss", label: "Fat loss & conditioning", goals: ["fat_loss"], words: ["burpee", "mountain climber", "jump", "kettlebell", "swing", "skater", "high knees", "cardio"] },
  { id: "endurance", label: "Running & endurance", goals: ["endurance"], words: ["run", "jog", "sprint", "hill", "step", "cycle", "interval", "stride"] },
  { id: "football", label: "Football / team sports", goals: ["endurance", "muscle_gain"], words: ["sprint", "agility", "lunge", "squat", "jump", "cut", "shuffle", "hamstring", "core"] },
  { id: "combat", label: "Boxing & combat sports", goals: ["endurance", "fat_loss"], words: ["punch", "rotation", "twist", "core", "jump rope", "shadow", "push up", "neck", "plank"] },
  { id: "functional", label: "CrossFit / functional", goals: ["fat_loss", "muscle_gain"], words: ["clean", "snatch", "thruster", "kettlebell", "burpee", "pull", "box", "swing", "carry"] },
  { id: "mobility", label: "Yoga, mobility & flexibility", goals: ["general_fitness"], words: ["stretch", "mobility", "yoga", "pose", "rotation", "cat cow", "hip"] },
  { id: "rehab", label: "Rehab & return from injury", goals: ["general_fitness"], words: ["mobility", "stability", "bridge", "band", "balance", "bird dog", "dead bug"] },
  { id: "youth", label: "Youth development", goals: ["general_fitness"], words: ["bodyweight", "agility", "balance", "coordination", "skip", "jump rope"] },
] as const;

export const FOCUS_LEVELS = [
  { id: "standard", label: "Standard", sub: "Your athletes' own level", demand: 0 },
  { id: "high", label: "Demanding", sub: "One more block, one more set, shorter rests", demand: 1 },
  { id: "elite", label: "Elite", sub: "Two more sets and the shortest rests", demand: 2 },
] as const;

export const focusWords = (ids: string[]) => [...new Set(FOCUS_OPTIONS.filter((f) => ids.includes(f.id)).flatMap((f) => f.words))];
export const focusGoals = (ids: string[]) => [...new Set(FOCUS_OPTIONS.filter((f) => ids.includes(f.id)).flatMap((f) => f.goals))];
export const focusLabels = (ids: string[]) => FOCUS_OPTIONS.filter((f) => ids.includes(f.id)).map((f) => f.label);
export const demandOf = (levelId?: string | null): 0 | 1 | 2 => (FOCUS_LEVELS.find((l) => l.id === levelId)?.demand ?? 0) as 0 | 1 | 2;
