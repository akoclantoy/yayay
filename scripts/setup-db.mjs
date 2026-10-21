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

const schemaClient = new pg.Client({
  connectionString: realtimeDatabaseUrl,
  application_name: "ecorewards-schema-setup",
});

try {
  await schemaClient.connect();
  await schemaClient.query("CREATE SCHEMA IF NOT EXISTS ecorewards");
  await schemaClient.query("BEGIN");
  const reactionTable = await schemaClient.query(
    `SELECT to_regclass('ecorewards."DirectMessageReaction"') IS NOT NULL AS table_exists`
  );
  if (reactionTable.rows[0].table_exists) {
    const deduplicated = await schemaClient.query(`
      DELETE FROM ecorewards."DirectMessageReaction" AS older
      USING ecorewards."DirectMessageReaction" AS newer
      WHERE older."messageId" = newer."messageId"
        AND older."userId" = newer."userId"
        AND (
          older."createdAt" < newer."createdAt"
          OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
        )
    `);
    if (deduplicated.rowCount) {
      console.log(
        `[setup-db] Kept each resident's latest message reaction and removed ${deduplicated.rowCount} superseded reaction(s).`
      );
    }
    await schemaClient.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DirectMessageReaction_messageId_userId_key"
      ON ecorewards."DirectMessageReaction" ("messageId", "userId")
    `);
  }
  await schemaClient.query("COMMIT");
} catch (error) {
  try {
    await schemaClient.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("[setup-db] Failed to roll back the reaction-index preparation:", rollbackError);
  }
  console.error("[setup-db] Could not create or access the ecorewards database schema:", error);
  throw error;
} finally {
  await schemaClient.end();
}

console.log("[setup-db] Applying Prisma schema...");
// Prisma 7 does not accept --skip-generate in this command; schema generation
// already happens in the build step, so we only need to push the schema here.
try {
  await withRetry("Prisma schema push", "npx prisma db push");
  console.log("[setup-db] Prisma schema is ready.");
} catch (error) {
  console.error(
    "[setup-db] Prisma schema push to ecorewards failed. Verify that DIRECT_URL is reachable, the database role can create tables in ecorewards, and DATABASE_URL is set for runtime traffic."
  );
  throw error;
}

const staffAvatarClient = new pg.Client({
  connectionString: realtimeDatabaseUrl,
  application_name: "ecorewards-staff-avatar-setup",
});
try {
  await staffAvatarClient.connect();
  const result = await staffAvatarClient.query(
    `UPDATE ecorewards."User"
     SET image = $1
     WHERE role::text IN ('COLLECTION_STAFF', 'BARANGAY_STAFF')
       AND image IS DISTINCT FROM $1`,
    ["/staff-profile.png"]
  );
  if (result.rowCount) {
    console.log(
      `[setup-db] Set the standard staff profile picture for ${result.rowCount} existing account(s).`
    );
  }
} catch (error) {
  console.error("[setup-db] Failed to set the standard staff profile picture:", error);
  throw error;
} finally {
  await staffAvatarClient.end();
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
const tupiBootstrapSql = await readFile(
  new URL("./tupi-bootstrap.sql", import.meta.url),
  "utf8"
);
const realtimeClient = new pg.Client({
  connectionString: realtimeDatabaseUrl,
  application_name: "ecorewards-realtime-setup",
});

try {
  await realtimeClient.connect();
  await realtimeClient.query(tupiBootstrapSql);
  console.log("[setup-db] Tupi barangays and existing pickup conversations are ready.");
  await realtimeClient.query(realtimeSql);
  console.log("[setup-db] Realtime notifications are ready.");
} catch (error) {
  console.error("[setup-db] Failed to configure realtime notifications:", error);
  throw error;
} finally {
  await realtimeClient.end();
}

console.log("[setup-db] Database ready.");
