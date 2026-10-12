# Deploying the coach pricing / dashboard / nutrition update

1. **Back up the production database first** (Neon/Supabase/Vercel Postgres snapshot, or `pg_dump`).
2. **Schema:** `npm run build` now runs `scripts/apply-safe-schema.js`, which adds the new columns/table (`profiles.membershipPriceRwf`,
   `profiles.workoutIntensity`, `nutrition_plans`) and turns waiting coach requests into active connections. It is additive and idempotent,
   and it never drops anything. After the backup you can clean up by hand with the DROP statements in
   `prisma/migrations/20261012_coach_pricing_direct_connect/migration.sql` (old `coach_invites` table and `profiles.connectCode`).
3. **Environment variables** (Vercel → Settings → Environment Variables): see `.env.example`. At minimum `AUTH_SECRET`, `AUTH_URL`;
   recommended `OPENROUTER_API_KEY` (DeepSeek meal planning), `GEMINI_API_KEY` (meal photo check), `RESEND_API_KEY` (reset emails).
   Admin → Configuration shows which are set.
4. Redeploy, then sign in as admin and check Admin → Configuration and Admin → People.
