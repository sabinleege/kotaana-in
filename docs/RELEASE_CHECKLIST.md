# Kotaana release checklist

## Application

- Authentication routes are protected by server session and role.
- Athlete primary navigation is Home / Workout / Nutrition / Health / Progress / Track Me.
- Settings contains only Profile & Photo and Appearance.
- Sign out is a standalone menu action.
- No separate Exercise / Medical / Photo pages are exposed.
- Workout, Nutrition, Health, Progress and Track Me each own their related configuration.

## Workout

- Generation reads the authenticated athlete profile and database exercise library.
- Missing non-safety inputs use explicit safe defaults.
- Unknown injury state is not treated as "no injury".
- Verified exercise hard filtering occurs before AI reranking.
- Every generated session starts with stretching and warm-up.
- Hydration breaks are 500 ml.
- Outdoor rotation is deterministic and constrained to configured training days.
- No safe verified exercise produces `NO_SAFE_EXERCISE_AVAILABLE` rather than an invented exercise.
- Performance records feed later prescriptions.

## Production setup

- Configure Postgres.
- Run Prisma generation/schema deployment.
- Seed exercise and food datasets.
- Configure authentication secrets and OAuth callbacks.
- Configure live MoMo credentials before enabling live request-to-pay.
- Configure email delivery for password reset.
- Configure HTTPS because browser geolocation for Track Me requires a secure context in normal production browsers.
- Track Me persists active routes locally and restores them after reload/background resume.
- Track Me uses a 3-second GPS acquisition timeout and keeps retrying transient GPS errors.
- Reports use recorded database data only; missing data is disclosed and never silently replaced with estimates.
- Weekly and monthly reports expose data status and missing sources.
- Progress presents actual recorded source counts, weight history and activity metrics with minimal data-first UI.
- Track Me does not claim impossible GPS collection while the physical phone is powered off; native Android background tracking is required for locked-screen/foreground-service operation.
- Review source-data licenses/attributions before commercial distribution.
- Complete a deployment smoke test with an athlete, coach and admin account.
