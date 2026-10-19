-- Coach organisation type and member capacity tiers.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "organizationType" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "memberCapacity" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "capacityUntil" TIMESTAMP(3);

-- Workout check-out (start/finish, effort, pain).
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "rpe" INTEGER;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "feltAfter" TEXT;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "painReported" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

-- Injuries and illness with recovery estimates.
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'injury';
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "onMedication" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "doctorPrescribed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "doctorDays" INTEGER;
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "estimatedDays" INTEGER;
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "estimateSource" TEXT;
ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "usage_counters" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "date" DATE NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "usage_counters_userId_kind_date_key" ON "usage_counters"("userId", "kind", "date");

CREATE TABLE IF NOT EXISTS "health_updates" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "injuryId" TEXT, "kind" TEXT NOT NULL, "trend" TEXT, "pain" INTEGER, "healingPercent" INTEGER, "imageUrl" TEXT, "aiNote" TEXT, "answers" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "health_updates_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "health_updates_userId_createdAt_idx" ON "health_updates"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "health_updates_injuryId_idx" ON "health_updates"("injuryId");

CREATE TABLE IF NOT EXISTS "athlete_reports" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "periodStart" DATE NOT NULL, "periodEnd" DATE NOT NULL, "summary" TEXT NOT NULL, "wins" JSONB NOT NULL DEFAULT '[]', "concerns" JSONB NOT NULL DEFAULT '[]', "suggestions" JSONB NOT NULL DEFAULT '[]', "metrics" JSONB, "source" TEXT NOT NULL DEFAULT 'rules', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "athlete_reports_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "athlete_reports_userId_createdAt_idx" ON "athlete_reports"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "questionnaires" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "answers" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "questionnaires_userId_kind_createdAt_idx" ON "questionnaires"("userId", "kind", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_userId_fkey') THEN ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'health_updates_userId_fkey') THEN ALTER TABLE "health_updates" ADD CONSTRAINT "health_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_reports_userId_fkey') THEN ALTER TABLE "athlete_reports" ADD CONSTRAINT "athlete_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_userId_fkey') THEN ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
END $$;

-- Coach specialty and how demanding the coach wants athletes' workouts.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "focusLevel" TEXT NOT NULL DEFAULT 'standard';

-- Richer per-exercise metrics and receipt e-mail preference.
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "workSec" INTEGER;
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "restSec" INTEGER;
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "weightKg" DOUBLE PRECISION;
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "repsTotal" INTEGER;
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "setReps" JSONB;
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "receiptEmails" BOOLEAN NOT NULL DEFAULT true;
