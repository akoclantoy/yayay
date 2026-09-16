import { config } from "dotenv";
import mariadb from "mariadb";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!url || url.includes("user:password@localhost")) {
  console.error("DATABASE_URL is missing or still uses the example localhost value.");
  console.error("Set DATABASE_URL in .env.local to your MySQL connection URL.");
  process.exit(1);
}

const pool = mariadb.createPool(url.replace(/^mysql:/, "mariadb:"));

try {
  await pool.query("SELECT 1");
  console.log("Database connection successful.");

  const tables = await pool.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'User'"
  );

  if (Number(tables[0].count) === 0) {
    console.warn("Connected, but schema is missing. Run: npm run db:setup");
    process.exitCode = 1;
  } else {
    const users = await pool.query("SELECT COUNT(*) AS count FROM `User`");
    console.log(`User table exists with ${users[0].count} users.`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connection failed:", message);
  console.error("Verify the Railway MySQL service is running and that DATABASE_URL is correct.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
