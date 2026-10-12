-- Coaches choose by search only: invites and join codes are removed, and any request still waiting becomes an active connection.
UPDATE "coach_athlete_relations" SET "status" = 'active' WHERE "status" = 'pending';
DROP TABLE IF EXISTS "coach_invites";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "connectCode";

-- Coach-set membership price (RWF per 30 days) and the athlete's preferred workout intensity.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "membershipPriceRwf" INTEGER;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "workoutIntensity" TEXT;

-- Daily nutrition plans (AI-planned or library-based), one per athlete per day.
CREATE TABLE IF NOT EXISTS "nutrition_plans" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "planJson" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'library',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "nutrition_plans_userId_date_key" ON "nutrition_plans"("userId", "date");
ALTER TABLE "nutrition_plans" DROP CONSTRAINT IF EXISTS "nutrition_plans_userId_fkey";
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
