export type ExerciseRow = {
  id: string;
  name: string;
  bodyPart?: string | null;
  target?: string | null;
  equipment?: string | null;
  category?: string | null;
  muscleGroup?: string | null;
  secondaryMuscles?: string[];
  instructions?: string | null;
  steps?: string[];
  gif?: string | null;
  image?: string | null;
  movementPattern?: string | null;
  difficulty?: string | null;
  tracks?: string[];
  goals?: string[];
  safetyTags?: string[];
  contraindicationTags?: string[];
  roleTags?: string[];
  estimatedMinutes?: number | null;
  verified?: boolean;
};

export type PerformanceRecord = {
  exerciseId: string;
  effort: "easy" | "ok" | "hard";
  completed: boolean;
  setsDone?: number | null;
  repsDone?: string | null;
  durationSec?: number | null;
  date: string;
};

export type UserWorkoutContext = {
  userId: string;
  ageBand?: string | null;
  level?: string | null;
  track?: string | null;
  goal?: string | null;
  equipment?: string[] | null;
  equipmentExclude?: string[] | null;
  injuries?: Array<{ bodyPart?: string; restrictions?: string; status?: string } | string> | null;
  injuryDataKnown?: boolean;
  otherLimitations?: string | null;
  conditions?: string[] | null;
  isPregnant?: boolean | null;
  stressLevel?: number | null;
  outdoorTrainingOk?: boolean | null;
  trainingDays?: number[] | null;
  availableMinutes?: number | null;
  location?: { lat?: number; lng?: number; city?: string; country?: string } | null;
  recentExerciseIds?: string[];
  recentMuscleTags?: string[];
  performanceHistory?: PerformanceRecord[];
  dayOfWeek?: number;
  readiness?: number | null;
  aiPreferredExerciseIds?: string[];
  blockedExerciseIds?: string[];
  recentMovementPatterns?: string[];
  weeklyMuscleTags?: string[];
  weeklyMovementPatterns?: string[];
  missedSessions?: number;
};

export type SessionMove = {
  order: number;
  exerciseId: string;
  name: string;
  role: "stretch" | "warmup" | "main" | "accessory" | "core" | "cooldown" | "hydration" | "outdoor";
  sets?: number;
  reps?: number | string;
  durationSec?: number;
  restSec?: number;
  effort?: "easy" | "moderate" | "hard";
  estimatedMin?: number;
  notes?: string;
  gif?: string | null;
  image?: string | null;
};

export type BuiltSession = {
  sessionId: string;
  userId: string;
  dateKey: string;
  createdAt: string;
  estimatedMinutes: number;
  moves: SessionMove[];
  outdoor: boolean;
  hydrationRemindersMl: number[];
  postWorkoutFoodHint: string;
  meta: {
    usedDefaults: string[];
    candidateCount: number;
    outdoorForced: boolean;
    dataQuality: "complete" | "partial" | "unknown";
    status: "ready";
    version: number;
    adjustment?: string;
    readiness?: number;
    missedSessions?: number;
    selectionPolicy?: string;
    healthNotes?: string[];
  };
};

export class NoSafeExerciseError extends Error {
  code = "NO_SAFE_EXERCISE_AVAILABLE" as const;
  details: string[];
  constructor(details: string[]) {
    super("No safe verified exercise is available for the current constraints.");
    this.name = "NoSafeExerciseError";
    this.details = details;
  }
}
