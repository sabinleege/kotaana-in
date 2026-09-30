# Kotaana market-readiness checklist

This is the implementation checklist for the ten hardening areas requested for the production package.

1. **Production build / PostgreSQL / E2E**
   - Prisma PostgreSQL schema and forward migration included.
   - `build`, `typecheck`, `test`, `db:migrate`, `db:seed` scripts wired.
   - Production smoke procedure documented.
   - Local dependency installation is environment-dependent and must be run in the deployment environment because this build workspace has no cached npm dependencies.

2. **Workout decision engine**
   - Weekly muscle and movement-pattern load included.
   - Recent exercise and muscle avoidance.
   - Readiness/fatigue reduction.
   - Missed-session adjustment.
   - Performance-driven progression/regression.
   - Deterministic daily rotation.
   - Closed-loop performance recording.
   - Fail-closed no-safe-exercise path.

3. **AI as constrained brain**
   - AI only returns preference IDs from the candidate list.
   - Rule/database safety filtering occurs before selection.
   - AI cannot create or persist an exercise.
   - AI cannot override injury/equipment/age/difficulty rules.

4. **Authentication / authorization**
   - Email/password and optional Google OAuth.
   - Role-based server authorization.
   - Admin email policy.
   - Password reset flow.
   - API ownership checks on workout and payment resources.

5. **Exercise data curation**
   - Source, license, quality, normalized version, verification and safety-review metadata stored.
   - Curation script and generated report included.
   - Seed normalization is deterministic and deduplicated.
   - Missing instructions are surfaced as review warnings rather than invented.

6. **Nutrition intelligence**
   - Verified food database.
   - Allergy hard filtering with common allergen aliases.
   - Dietary-style filtering.
   - User calorie target incorporated into portion scaling.
   - Location/weather-aware hydration.
   - 500 ml workout hydration breaks and post-workout meal connection.

7. **Health / readiness safety**
   - Injury records and limitations feed workout safety filtering.
   - Daily readiness feeds exercise intensity/volume.
   - Unknown injury status remains conservative.
   - Health remains its own primary section rather than being duplicated in Settings.

8. **Settings architecture**
   - Settings contains only Profile & photo and Appearance.
   - Workout, Nutrition, Health, Progress and Track Me retain their own controls.

9. **Track Me GPS**
   - Location must exist before persistence.
   - GPS timestamps must be monotonic.
   - Track drafts are persisted locally in IndexedDB (with localStorage fallback) so reload/network interruption does not immediately lose an active route.
   - Tracking resumes its GPS watcher after the page returns from the lock/background state.
   - Elapsed time is derived from timestamps rather than a background JavaScript timer, so mobile timer throttling does not reset the session.
   - Run/walk/ride selection is preserved in the saved activity type.
   - A fully powered-off phone cannot collect GPS points; true locked-screen/background tracking requires the native Android foreground-location service.
   - Poor-accuracy points are rejected.
   - Route distance is independently calculated and compared with reported distance.
   - Implausible speed is rejected.
   - Persisted route remains user-owned and authenticated.

10. **MoMo payments**
    - Idempotency key prevents duplicate payment creation.
    - Destination must be configured.
    - Live request-to-pay errors are not represented as successful payments.
    - Webhook can be HMAC protected.
    - Terminal payment states are idempotent.
    - Payment ownership is enforced for athlete/coach reads.

## Verification boundary

The source package has been statically audited and the pure-data files parse successfully. A real production build, Prisma client generation, PostgreSQL migration/seed, OAuth callback, live MoMo transaction, email delivery and device GPS E2E test require the target deployment environment and credentials. Those are external execution steps, not source-code omissions.
