import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!url || url.includes("user:password@localhost")) {
  console.error("DATABASE_URL is missing or still uses the example localhost value.");
  console.error("Set DATABASE_URL in .env.local to your PostgreSQL connection URL.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

try {
  await pool.query("SELECT 1");
  console.log("Database connection successful.");

  const { rows: tables } = await pool.query(
    `SELECT to_regclass('"public"."User"') IS NOT NULL AS exists`
  );

  if (!tables[0].exists) {
    console.warn("Connected, but schema is missing. Run: npm run db:setup");
    process.exitCode = 1;
  } else {
    const { rows: users } = await pool.query('SELECT COUNT(*)::int AS count FROM "User"');
    console.log(`User table exists with ${users[0].count} users.`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connection failed:", message);
  console.error("Verify the PostgreSQL service is reachable and DATABASE_URL is correct.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
