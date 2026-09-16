import { execSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

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
execSync("npx prisma db push", {
  stdio: "inherit",
  env: process.env,
});

console.log("[setup-db] Seeding demo data and users...");
execSync("npx tsx prisma/seed.ts", {
  stdio: "inherit",
  env: process.env,
});

console.log("[setup-db] Database ready.");
