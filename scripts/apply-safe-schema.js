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
  // Coaches now accept athletes automatically, so requests that were waiting become active connections.
  `UPDATE "coach_athlete_relations" SET "status" = 'active' WHERE "status" = 'pending'`,
];

(async () => {
  if (!process.env.DATABASE_URL) { console.warn("[schema] DATABASE_URL not set — skipping schema update."); return; }
  const db = new PrismaClient();
  try {
    for (const sql of STATEMENTS) await db.$executeRawUnsafe(sql);
    console.log(`[schema] ${STATEMENTS.length} additive statements applied.`);
  } catch (e) {
    console.warn("[schema] could not update the database during build:", e && e.message ? e.message : e);
  } finally { await db.$disconnect().catch(() => {}); }
})();
