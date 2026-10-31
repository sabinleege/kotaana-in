# Running Kotaana on Cloudflare

This guide covers what moving Kotaana from Vercel to Cloudflare involves: what each Cloudflare product does for the app, what has to change in the code, what it costs, and the order to do it in.

**In short:** run the Next.js app on **Cloudflare Workers** through the **OpenNext adapter**. Keep **PostgreSQL** and reach it through **Hyperdrive**. Move photos out of the database into **R2**. Replace the Vercel cron with a **Cron Trigger**. Optionally add **KV** for caching and **Queues** for slow AI work. You need the **Workers Paid** plan ($5/month) because password hashing alone exceeds the free plan's CPU limit.

---

## 1. The pieces and what each one does for Kotaana

| Need in Kotaana | Today (Vercel) | On Cloudflare | Why |
|---|---|---|---|
| Run the Next.js app (pages, API routes, Auth.js) | Vercel Functions, region `fra1` | **Workers** + `@opennextjs/cloudflare` | OpenNext converts the `next build` output into a Worker. It replaces the older `next-on-pages`, which is no longer the recommended path. |
| PostgreSQL connection | Direct `DATABASE_URL` (pooled) | **Hyperdrive** in front of the same Postgres (Supabase / Neon / any) | Workers are short-lived and run everywhere. Hyperdrive keeps a warm connection pool near the database and can cache read queries, so each request does not pay for a new TLS + Postgres handshake. |
| Photos (progress photos, injury photos, medical docs, avatars) | Base64 inside Postgres rows | **R2** (object storage) | Base64 in Postgres is about 33% larger than the file and makes every row read heavy. R2 costs about $0.015/GB-month with **no egress fees**, and the database keeps only a short key. |
| Daily summaries + clean-up (`/api/cron/compact`) | Vercel Cron (`vercel.json`) | **Cron Triggers** | A schedule in `wrangler.jsonc` calls the Worker. Free. |
| Exercise library (up to 5,000 rows read on every workout build) | Read from Postgres each time | **KV** or the Workers Cache API (optional) | The library rarely changes. Caching it for an hour saves a large query on every build. |
| AI re-ranking (up to 20 parallel model calls per build) | Inside the request | **Queues** (optional) | Heavy AI work can run after the response is sent, with retries. Not needed at first, because the AI budget already limits the number of batches. |
| Secrets (AUTH_SECRET, OPENROUTER_API_KEY, …) | Vercel env vars | `wrangler secret put` / dashboard | Same names. OpenNext exposes them as `process.env`. |
| Domain, TLS, firewall | Vercel | Cloudflare DNS + **WAF** + **Turnstile** (optional) | Turnstile on sign-up and password reset stops bot sign-ups, which also protects free-trial abuse. |

### Why not D1 (Cloudflare's own database)?
D1 is SQLite. Kotaana's schema uses Postgres-only features: `String[]` arrays, JSON path filters (`metrics: { path: ["final"] }`), `pg_stat_user_tables`, raw `UPDATE … SET … = NULL` SQL and enum casts. Moving to D1 means rewriting the schema and many queries for little gain. Hyperdrive + Postgres gives Cloudflare's edge without that rewrite.

---

## 2. Changes needed in the code

### 2.1 Prisma on Workers
Workers cannot run Prisma's native query-engine binary. Use a **driver adapter** (generally available since Prisma 6.16; this project is on 6.19):

```bash
npm i @prisma/adapter-pg pg
```

`src/lib/db/prisma.ts` then creates the client through the adapter, using the Hyperdrive connection string:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function connectionString() {
  try { return getCloudflareContext().env.HYPERDRIVE.connectionString; } catch { return process.env.DATABASE_URL!; }
}
// One client per request on Workers: a Worker isolate must not hold a socket across requests.
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });
```

The exact way to read a binding per request depends on the OpenNext version. Follow its "Prisma" / "Hyperdrive" how-to when you do this. Keep the Vercel version on a branch until the Cloudflare one is verified.

`schema.prisma` keeps `provider = "postgresql"`. If your Prisma version still lists it as a preview feature, add `previewFeatures = ["driverAdapters"]` to the generator.

### 2.2 Build and schema step
On Vercel, `npm run build` runs `scripts/apply-safe-schema.js` against the database. On Cloudflare the build runs in CI (Workers Builds or GitHub Actions), so:

```bash
node scripts/apply-safe-schema.js     # needs DATABASE_URL (direct, not Hyperdrive) in the CI environment
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

### 2.3 Wrangler configuration (`wrangler.jsonc`)

```jsonc
{
  "name": "kotaana",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat"],          // pg, bcryptjs, crypto, Buffer
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "placement": { "mode": "smart" },                   // run near the database, like Vercel's fra1
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<from: wrangler hyperdrive create kotaana-db --connection-string=...>" }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "kotaana-media" }],
  "kv_namespaces": [{ "binding": "CACHE", "id": "<from: wrangler kv namespace create CACHE>" }],
  "triggers": { "crons": ["30 1 * * *"] },            // daily summaries + clean-up
  "limits": { "cpu_ms": 60000 }
}
```

### 2.4 The cron
OpenNext's Worker handles HTTP. For the Cron Trigger, add a small `scheduled` handler (or a second tiny Worker) that calls the existing route:

```ts
export default {
  async scheduled(_e, env) {
    await fetch("https://kotaana.example/api/cron/compact", { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
  },
};
```

`/api/cron/compact` already accepts `Authorization: Bearer $CRON_SECRET`. It processes up to 200 athletes per run within a 50-second budget and keeps a cursor, so it never needs a long-running job.

### 2.5 Photos to R2
Today `progress_photos.imageUrl`, `health_updates.imageUrl`, `medical_documents.fileUrl` and `profiles.avatarUrl` hold `data:image/...;base64,...` strings. The change:
1. On upload, the API route writes the bytes to R2 (`env.MEDIA.put(key, bytes, { httpMetadata: { contentType } })`) and stores only `r2:<key>` in the column.
2. A route such as `/api/media/[key]` checks that the signed-in user owns the file (or is their coach), then streams it from R2. Never make the bucket public: these are health photos.
3. A one-off script moves existing base64 rows to R2.

This is the biggest storage saving available, on top of the weekly summaries.

### 2.6 Things that already work unchanged
- **Auth.js v5**: `trustHost: true` is already set. JWT sessions need no database round-trip per request.
- **`bcryptjs`** is pure JavaScript and runs on Workers, but one hash at cost 10–12 takes about 100–300 ms of CPU. That is why the free plan (10 ms CPU per request) is not enough.
- **`fetch` + `AbortSignal.timeout`** for OpenRouter and Gemini. Time spent waiting on the AI does **not** count as CPU time on Workers, so 20–60 s AI calls are fine.
- **`cookies()`**, the language cookie and route handlers are all supported by OpenNext.
- **`next/image`**: set `images.unoptimized = true` or use Cloudflare Images. The app mostly uses plain `<img>` already.

---

## 3. Limits to know

| Limit | Value | Effect on Kotaana |
|---|---|---|
| CPU time per request | Free: 10 ms · Paid: 30 s by default, configurable up to 5 min | Paid is required (bcrypt, building workouts from 5,000 exercises). |
| Worker bundle size | Free: 3 MB · Paid: 10 MB (compressed) | Next.js + Prisma fit on Paid. Check with `wrangler deploy --dry-run`. |
| Subrequests (outgoing `fetch`) per request | 50 Free · 1,000 Paid | AI re-rank does up to 20; fine. |
| Memory per isolate | 128 MB | Loading 5,000 exercises (about 5–10 MB of JSON) is fine; do not load the 10,000-food table on every request. Cache it in KV instead. |

Check Cloudflare's current limits page before you migrate: these values change.

---

## 4. What it costs

| Item | Monthly cost |
|---|---|
| Workers Paid | **$5** base: 10 M requests and 30 M CPU-ms included, then $0.30 per extra million requests and $0.02 per extra million CPU-ms |
| Hyperdrive | Included with Workers |
| R2 | 10 GB free, then $0.015/GB-month. Operations are cents at this scale. **No egress charge.** |
| KV | Free tier (100k reads/day) is enough at the start; then $0.50 per million reads |
| Cron Triggers, WAF basics, Turnstile, DNS, TLS | Free |
| PostgreSQL (unchanged) | Supabase / Neon free tier, then about $19–25/month |

A realistic start is **about $5–30/month** for hosting and database. Enter that number in **Admin → AI & costs → Settings** ("Hosting & database cost per month") so the margin report includes it.

---

## 5. Migration order (lowest risk first)

1. **Domain on Cloudflare DNS** (still pointing at Vercel). This adds WAF and Turnstile right away with no code change.
2. **R2 for photos** while still on Vercel. R2 has an S3-compatible API, and `.env.example` already has the `S3_*` variables. This is the largest storage win and is independent of where the app runs.
3. **Hyperdrive + Prisma driver adapter** on a branch. Test locally with `wrangler dev` / `opennextjs-cloudflare preview`.
4. **Deploy the Worker on a `*.workers.dev` URL**. Set every secret, and set `AUTH_URL` to that URL. Add it to the Google OAuth redirect URIs.
5. **Test the critical paths**: sign-up, Google sign-in, admin sign-in and navigation (the prefetch sign-out bug is fixed in this release), starting the trial, building a workout, a meal photo check, MoMo payment approval and `/api/cron/compact`.
6. **Switch the domain** to the Worker. Keep Vercel running for a week as a fallback, then remove `vercel.json`'s cron so the job does not run twice.

---

## 6. Secrets to set on Cloudflare

`AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_REVIEW_MODEL` (optional), `GEMINI_API_KEY`, `GEMINI_MODEL`, `RESEND_API_KEY`, `MOMO_*`, `MOMO_WEBHOOK_SECRET`, `KOTAANA_PLATFORM_MOMO_CODE`, `CRON_SECRET`. Set `DATABASE_URL` / `DIRECT_URL` only in CI for the schema step. At runtime the app uses the Hyperdrive binding.
