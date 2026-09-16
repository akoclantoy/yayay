import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!url || url.includes("user:password@localhost")) {
  console.error("DATABASE_URL is missing or still uses the example localhost value.");
  console.error("Set DATABASE_URL in .env.local to your Render PostgreSQL Internal Database URL.");
  process.exit(1);
}

const needsSsl =
  !url.includes("localhost") &&
  !url.includes(".render.internal") &&
  (url.includes(".render.com") ||
    url.includes("sslmode=require") ||
    process.env.NODE_ENV === "production");

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 10000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

try {
  await pool.query("SELECT 1");
  console.log("Database connection successful.");

  const tables = await pool.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'User'
  `);

  if (tables.rowCount === 0) {
    console.warn("Connected, but schema is missing. Run: npm run db:setup");
    process.exitCode = 1;
  } else {
    const users = await pool.query('SELECT COUNT(*)::int AS count FROM "User"');
    console.log(`User table exists with ${users.rows[0].count} users.`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connection failed:", message);
  console.error("On Render, use the Internal Database URL on your web service (not the external URL).");
  process.exitCode = 1;
} finally {
  await pool.end();
}
