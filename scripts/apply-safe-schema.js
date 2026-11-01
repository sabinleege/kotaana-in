/* Runs during `npm run build` (e.g. on Vercel). Applies only the ADDITIVE part of the latest schema change, so the new code
 * never meets a database that lacks its columns. Every statement is idempotent (IF NOT EXISTS) and nothing is dropped:
 * the old coach_invites table and profiles.connectCode column are left in place (the app no longer reads them) and can be
 * removed later by hand with prisma/migrations/20261012_coach_pricing_direct_connect/migration.sql after a backup.
 * It never fails the build: if the database can't be reached it prints a warning and the deploy continues. */
const { PrismaClient } = require("@prisma/client");

const STATEMENTS = [
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "membershipPriceRwf" INTEGER`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "workoutIntensity" TEXT`,
  `CREATE TABLE IF NOT EXISTS "nutrition_plans" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "date" DATE NOT NULL, "planJson" JSONB NOT NULL, "source" TEXT NOT NULL DEFAULT 'library', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_plans_userId_date_key" ON "nutrition_plans"("userId", "date")`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_plans_userId_fkey') THEN ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "organizationType" TEXT`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "memberCapacity" INTEGER NOT NULL DEFAULT 70`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "capacityUntil" TIMESTAMP(3)`,
  `ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "rpe" INTEGER`,
  `ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "feltAfter" TEXT`,
  `ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "painReported" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3)`,
  `ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3)`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'injury'`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "onMedication" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "doctorPrescribed" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "doctorDays" INTEGER`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "estimatedDays" INTEGER`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "estimateSource" TEXT`,
  `ALTER TABLE "injuries" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "usage_counters" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "date" DATE NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "usage_counters_userId_kind_date_key" ON "usage_counters"("userId", "kind", "date")`,
  `CREATE TABLE IF NOT EXISTS "health_updates" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "injuryId" TEXT, "kind" TEXT NOT NULL, "trend" TEXT, "pain" INTEGER, "healingPercent" INTEGER, "imageUrl" TEXT, "aiNote" TEXT, "answers" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "health_updates_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "health_updates_userId_createdAt_idx" ON "health_updates"("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "health_updates_injuryId_idx" ON "health_updates"("injuryId")`,
  `CREATE TABLE IF NOT EXISTS "athlete_reports" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "periodStart" DATE NOT NULL, "periodEnd" DATE NOT NULL, "summary" TEXT NOT NULL, "wins" JSONB NOT NULL DEFAULT '[]', "concerns" JSONB NOT NULL DEFAULT '[]', "suggestions" JSONB NOT NULL DEFAULT '[]', "metrics" JSONB, "source" TEXT NOT NULL DEFAULT 'rules', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "athlete_reports_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "athlete_reports_userId_createdAt_idx" ON "athlete_reports"("userId", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS "questionnaires" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "answers" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "questionnaires_userId_kind_createdAt_idx" ON "questionnaires"("userId", "kind", "createdAt")`,
  `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_userId_fkey') THEN ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'health_updates_userId_fkey') THEN ALTER TABLE "health_updates" ADD CONSTRAINT "health_updates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_reports_userId_fkey') THEN ALTER TABLE "athlete_reports" ADD CONSTRAINT "athlete_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questionnaires_userId_fkey') THEN ALTER TABLE "questionnaires" ADD CONSTRAINT "questionnaires_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
END $$`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "focusLevel" TEXT NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "workSec" INTEGER`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "restSec" INTEGER`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "weightKg" DOUBLE PRECISION`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "repsTotal" INTEGER`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "setReps" JSONB`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3)`,
  `ALTER TABLE "exercise_performances" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3)`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "receiptEmails" BOOLEAN NOT NULL DEFAULT true`,
  // Coaches now accept athletes automatically, so requests that were waiting become active connections.
  `UPDATE "coach_athlete_relations" SET "status" = 'active' WHERE "status" = 'pending'`,
  // Free trial claimed once per email, AI cost per call, compact weekly/monthly summaries, language, pregnancy details.
  `CREATE TABLE IF NOT EXISTS "trial_claims" ("email" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "trial_claims_pkey" PRIMARY KEY ("email"))`,
  `ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "model" TEXT`,
  `ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_createdAt_idx" ON "ai_usage"("createdAt")`,
  `CREATE TABLE IF NOT EXISTS "period_summaries" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "periodStart" DATE NOT NULL, "periodEnd" DATE NOT NULL, "metrics" JSONB NOT NULL, "summary" TEXT NOT NULL, "rowsCompacted" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "period_summaries_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "period_summaries_userId_kind_periodStart_key" ON "period_summaries"("userId", "kind", "periodStart")`,
  `CREATE INDEX IF NOT EXISTS "period_summaries_userId_kind_periodStart_idx" ON "period_summaries"("userId", "kind", "periodStart")`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'period_summaries_userId_fkey') THEN ALTER TABLE "period_summaries" ADD CONSTRAINT "period_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en'`,
  `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "pregnancyDetails" JSONB`,
  // One time only: the trial used to start automatically at sign-up. Athletes still inside that window keep it as their one trial.
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "app_config" WHERE "key" = 'trial_claims_migrated') THEN
    INSERT INTO "trial_claims" ("email", "userId", "role", "startedAt", "endsAt")
      SELECT u."email", u."id", u."role"::text, u."createdAt", u."createdAt" + interval '7 days' FROM "users" u
      WHERE u."role"::text = 'athlete' AND u."createdAt" > now() - interval '7 days'
      ON CONFLICT ("email") DO NOTHING;
    INSERT INTO "app_config" ("key", "value", "updatedAt") VALUES ('trial_claims_migrated', 'true', now());
  END IF; END $$`,
];

(async () => {
  if (!process.env.DATABASE_URL) { console.warn("[schema] DATABASE_URL not set — skipping schema update."); return; }
  // Prisma reads the tables from the schema named in DATABASE_URL (?schema=kotaana); raw SQL does not, so the same
  // search_path is set for every statement. Without this the changes went to the "public" schema instead.
  let schema = "public";
  try { schema = new URL(process.env.DATABASE_URL).searchParams.get("schema") || "public"; } catch {}
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) { console.warn(`[schema] unexpected schema name "${schema}" — skipping.`); return; }
  const db = new PrismaClient();
  // One transaction, so SET LOCAL holds even behind a connection pooler. Each statement runs under its own savepoint:
  // a failure is rolled back on its own and never skips the statements after it.
  let ok = 0;
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const sql of STATEMENTS) {
        await tx.$executeRawUnsafe("SAVEPOINT stmt");
        try { await tx.$executeRawUnsafe(sql); await tx.$executeRawUnsafe("RELEASE SAVEPOINT stmt"); ok++; }
        catch (e) { await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT stmt"); console.warn("[schema] FAILED:", sql.slice(0, 90), "→", e && e.message ? e.message : e); }
      }
    }, { timeout: 120000, maxWait: 20000 });
    console.log(`[schema] ${ok} of ${STATEMENTS.length} additive statements applied to schema "${schema}".`);
  } catch (e) {
    console.warn("[schema] could not update the database during build:", e && e.message ? e.message : e);
  } finally { await db.$disconnect().catch(() => {}); }
})();
