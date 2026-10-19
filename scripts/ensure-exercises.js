/* Runs during the build. If the database holds fewer exercises than the data files, load the full library (idempotent: existing rows are skipped). Never fails the build. */
const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs"); const path = require("node:path");
(async () => {
  if (!process.env.DATABASE_URL) { console.warn("[exercises] DATABASE_URL not set — skipping."); return; }
  const dir = path.join(process.cwd(), "data", "exercises");
  let wanted = 0; try { for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-ready.json"))) { const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); wanted += Array.isArray(j) ? j.length : (j.exercises || []).length; } } catch { return; }
  const db = new PrismaClient();
  try {
    const CURATED = 9; // Kotaana baseline stretches, warm-ups and outdoor moves added by the seed on top of the data files
    const have = await db.exercise.count(); wanted += CURATED;
    if (have >= wanted) { console.log("[exercises] library complete (" + have + ")."); return; }
    console.log("[exercises] database has " + have + " of " + wanted + " — loading the rest…");
    const r = spawnSync(process.execPath, [require.resolve("tsx/cli"), "prisma/seed.ts"], { stdio: "inherit", env: { ...process.env, SEED_ONLY: "exercises" } });
    console.log("[exercises] now " + (await db.exercise.count()) + (r.status ? " (seed exited with " + r.status + ")" : ""));
  } catch (e) { console.warn("[exercises] could not top up the library:", e && e.message ? e.message : e); }
  finally { await db.$disconnect().catch(() => {}); }
})();
