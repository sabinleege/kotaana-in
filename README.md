# Kotaana — Market-Ready Integrated Application

This repository is the integrated Kotaana application built from the supplied Kotaana integration pack and Coach Connect/Kotaana product specification.

## Product structure

Primary athlete navigation:

- Home
- Workout
- Nutrition
- Health
- Progress
- Track Me
  - Background/locked-screen behavior: see `docs/TRACK_BACKGROUND.md`.

Settings contains only controls that do not have their own primary page:

- Profile & photo
- Appearance

Workout setup remains in **Workout**. Nutrition preferences remain in **Nutrition**. Injuries/readiness/health information remain in **Health**. Progress photos remain in **Progress**. Location remains in **Track Me**. Sign out is a standalone menu action.

## Core workout engine

`src/lib/workout/engine.ts` implements:

1. Load authenticated user state.
2. Apply safe defaults for missing non-safety data and explicitly record those defaults.
3. Query verified exercises from the database.
4. Hard-filter by equipment, age, level and health/safety constraints.
5. Score by goal, track, recent load, recent exercise use, readiness and previous performance.
6. Build Stretch → Warm-up → Main/Accessory → Hydration breaks (500 ml) → Optional outdoor rotation → Core → Cool-down.
7. Adjust prescriptions using previous performance.
8. Reject generation when no safe verified exercise set can be built (`NO_SAFE_EXERCISE_AVAILABLE`).
9. Persist the generated daily session.
10. Record performance so the next generation can adapt.

AI can rerank only verified candidates supplied by the rule engine; it cannot inject an invented exercise into a workout.

## Authentication

- One authentication page for login/signup.
- Athlete or Coach/Gym account creation.
- Account role is stored server-side and drives routing.
- Admin role is reserved for `ADMIN_EMAIL` (default `sabinleege@gmail.com`).
- Google OAuth is supported when configured.
- Email/password authentication is supported.
- No demo accounts or demo-user fallbacks are included in application routes.
- Password reset uses a time-limited verification token and Resend when configured.

## Database

PostgreSQL via Prisma.

Seed sources included in the supplied pack are loaded by `prisma/seed.ts`, including the exercise JSON sources and USDA food files.

Commands:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

For production:

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run build
npm start
```

A production migration pipeline should use your normal reviewed Prisma migration workflow rather than relying on `db push` after schema stabilization.

## Required environment variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`
- `DIRECT_URL` when your provider supports a direct migration connection
- `AUTH_SECRET`
- `AUTH_URL`
- Google OAuth credentials when enabling Google sign-in
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` for OpenRouter
- `GEMINI_API_KEY` / `GEMINI_MODEL` for Gemini fallback
- MTN MoMo production credentials for live request-to-pay
- `ADMIN_EMAIL` and a secure admin bootstrap password for the initial seed, when using that seed path
- Resend settings for production password-reset email

## Safety / privacy boundaries

Kotaana is not a diagnostic or emergency medical service. Recorded restrictions are used to filter the verified exercise library. Do not use an LLM response as a substitute for medical clearance.

Health documents are private to the authenticated athlete in the application API. For production, configure a durable private object-storage solution if health-document volume grows instead of relying on database-stored data URLs.

## Verification in this package

- TypeScript/TSX source parse audit completed successfully.
- Source audit found no `demo-user`, TODO, FIXME, stub, fake-data or not-implemented markers in the application source.
- Workout engine smoke tests passed for stretch/warm-up ordering, 500 ml hydration breaks and the no-safe-exercise failure path.
- A full dependency install/build could not be executed in the build environment because `npm install` did not complete before the execution limit; therefore the package should be run through `npm install`, Prisma generation and `npm run build` in the target deployment environment before release.
