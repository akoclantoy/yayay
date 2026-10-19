import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
const realtimeDatabaseUrl = process.env.DIRECT_URL ?? databaseUrl;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(label, command, { retries = 5, delayMs = 2500 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      execSync(command, {
        stdio: "inherit",
        env: process.env,
      });
      return;
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error ?? "");
      const isTransient = /pool timeout|Can't reach database|ECONN|timed out|P1001|P2039/i.test(message);

      if (!isTransient || attempt === retries) {
        throw error;
      }

      console.warn(
        `[setup-db] ${label} failed (attempt ${attempt}/${retries}); retrying in ${delayMs}ms...`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

if (!databaseUrl) {
  console.warn("[setup-db] DATABASE_URL is not set — skipping database setup.");
  process.exit(0);
}

if (databaseUrl.includes("user:password@localhost")) {
  console.warn("[setup-db] DATABASE_URL still uses the example localhost value — skipping.");
  process.exit(0);
}

console.log("[setup-db] Applying Prisma schema...");
// Prisma 7 does not accept --skip-generate in this command; schema generation
// already happens in the build step, so we only need to push the schema here.
try {
  await withRetry("Prisma schema push", "npx prisma db push");
  console.log("[setup-db] Prisma schema is ready.");
} catch {
  console.warn(
    "[setup-db] Prisma schema push failed. The app may still start, but database schema sync could be incomplete."
  );
  console.warn(
    "[setup-db] Check that DIRECT_URL is reachable from Render and DATABASE_URL is set for runtime traffic."
  );
}

if (process.env.SKIP_DATABASE_SEED === "true" || process.env.RENDER === "true") {
  console.log("[setup-db] Skipping demo data seed in Render/production startup to avoid pool-timeout hangs.");
} else {
  console.log("[setup-db] Seeding demo data and users...");
  try {
    await withRetry("Demo database seed", "npx tsx prisma/seed.ts");
  } catch {
    console.warn("[setup-db] Demo seed failed after repeated connection retries; continuing without seed data.");
    console.warn("[setup-db] The app can still start while the database remains reachable for runtime requests.");
  }
}

if (!realtimeDatabaseUrl) {
  throw new Error("[setup-db] A PostgreSQL URL is required to configure realtime notifications.");
}

console.log("[setup-db] Configuring PostgreSQL realtime notifications...");
const realtimeSql = await readFile(
  new URL("./realtime-triggers.sql", import.meta.url),
  "utf8"
);
const realtimeClient = new pg.Client({
  connectionString: realtimeDatabaseUrl,
  application_name: "ecorewards-realtime-setup",
});

try {
  await realtimeClient.connect();
  await realtimeClient.query(realtimeSql);
  console.log("[setup-db] Realtime notifications are ready.");
} catch (error) {
  console.error("[setup-db] Failed to configure realtime notifications:", error);
  throw error;
} finally {
  await realtimeClient.end();
}

console.log("[setup-db] Database ready.");
