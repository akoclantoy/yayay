/**
 * Resolves a PostgreSQL connection string for the `pg` driver.
 * Prisma CLI accepts `prisma+postgres://` URLs, but node-postgres needs `postgres://`.
 */
export function resolvePgConnectionString(
  url = process.env.DATABASE_URL
): string | undefined {
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) {
    return url;
  }

  if (url?.startsWith("prisma+postgres://")) {
    try {
      const apiKey = new URL(url).searchParams.get("api_key");
      if (apiKey) {
        const payloadSegment = apiKey.includes(".")
          ? apiKey.split(".")[1]
          : apiKey;
        const payload = JSON.parse(
          Buffer.from(payloadSegment, "base64url").toString("utf8")
        ) as { databaseUrl?: string };
        if (payload.databaseUrl) return payload.databaseUrl;
      }
    } catch {
      // fall through
    }
  }

  // DIRECT_URL is primarily for Prisma migrations. Use it at runtime only
  // when DATABASE_URL is absent or cannot be converted for node-postgres.
  return process.env.DIRECT_URL;
}

/** Render and other hosted Postgres URLs usually require SSL. */
export function pgPoolSsl(connectionString: string) {
  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const isRenderInternal =
    connectionString.includes(".render.internal") ||
    /@dpg-[a-z0-9-]+-a[/.]/.test(connectionString);

  const requiresSsl =
    !isLocal &&
    !isRenderInternal &&
    (connectionString.includes(".render.com") ||
      connectionString.includes("sslmode=require") ||
      connectionString.includes("ssl=true") ||
      process.env.NODE_ENV === "production");

  return requiresSsl ? { rejectUnauthorized: false } : undefined;
}
