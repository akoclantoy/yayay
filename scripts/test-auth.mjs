import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

function resolvePgConnectionString(url = process.env.DATABASE_URL) {
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) return url;
  if (!url) return process.env.DIRECT_URL;
  if (url.startsWith("prisma+postgres://")) {
    try {
      const apiKey = new URL(url).searchParams.get("api_key");
      if (apiKey) {
        const payloadSegment = apiKey.includes(".") ? apiKey.split(".")[1] : apiKey;
        const payload = JSON.parse(
          Buffer.from(payloadSegment, "base64url").toString("utf8")
        );
        if (payload.databaseUrl) return payload.databaseUrl;
      }
    } catch {
      /* fall through */
    }
  }
  return process.env.DIRECT_URL;
}

const cs = resolvePgConnectionString();
if (!cs) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: cs, max: 2 });

try {
  await pool.query("SELECT 1");
  console.log("DB connected");

  const { rows: users } = await pool.query(
    `SELECT email, "passwordHash" IS NOT NULL AS has_password, "emailVerified" IS NOT NULL AS verified, "isActive" FROM "User" ORDER BY email`
  );
  console.log("Users:", users.length);
  for (const u of users) console.log(" ", u);

  const admin = users.find((u) => u.email === "admin@example.com");
  if (admin?.has_password) {
    const { rows } = await pool.query(
      `SELECT "passwordHash" FROM "User" WHERE email = $1`,
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
