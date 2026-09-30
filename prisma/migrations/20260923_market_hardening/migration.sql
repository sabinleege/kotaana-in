ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "safetyReviewed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "sourceLicense" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "normalizedVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_idempotencyKey_key" ON "payment_requests"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "exercises_safetyReviewed_qualityScore_idx" ON "exercises"("safetyReviewed", "qualityScore");
