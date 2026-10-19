import { config } from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });
config();

const cs = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!cs) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: cs });

try {
  await pool.query("SELECT 1");
  console.log("DB connected");

  const { rows: users } = await pool.query(
    'SELECT email, "passwordHash" IS NOT NULL AS has_password, "emailVerified" IS NOT NULL AS verified, "isActive" FROM ecorewards."User" ORDER BY email'
  );
  console.log("Users:", users.length);
  for (const user of users) console.log(" ", user);

  const admin = users.find((u) => u.email === "admin@example.com");
  if (admin?.has_password) {
    const { rows } = await pool.query(
      'SELECT "passwordHash" FROM ecorewards."User" WHERE email = $1',
      ["admin@example.com"]
    );
    const ok = await bcrypt.compare("Admin123!", rows[0].passwordHash);
    console.log("admin@example.com password matches Admin123!:", ok);
  } else {
    console.log("admin@example.com missing or no password");
  }
} catch (error) {
  console.error("Test failed:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
