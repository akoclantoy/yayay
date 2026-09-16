import { execSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

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

if (databaseUrl.includes("mysql.railway.internal") || databaseUrl.includes("railway.internal")) {
  console.error(
    "[setup-db] DATABASE_URL points to a Railway internal host (mysql.railway.internal). Render cannot reach this hostname. Use the Railway public MySQL connection URL, or move the database to a Render-accessible service."
  );
  process.exit(1);
}

console.log("[setup-db] Applying Prisma schema...");
// Prisma 7 does not accept --skip-generate in this command; schema generation
// already happens in the build step, so we only need to push the schema here.
try {
  await withRetry("Prisma schema push", "npx prisma db push");
} catch (error) {
  console.error(
    "[setup-db] Prisma schema push failed. Check that DATABASE_URL is reachable from Render and not using the internal mysql.railway.internal hostname."
  );
  throw error;
}

console.log("[setup-db] Seeding demo data and users...");
try {
  await withRetry("Demo database seed", "npx tsx prisma/seed.ts");
} catch (error) {
  console.error("[setup-db] Demo seed failed after repeated connection retries.");
  throw error;
}

console.log("[setup-db] Database ready.");
