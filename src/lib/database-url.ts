/** Resolve the pooled runtime URL, falling back to the direct database URL. */
export function resolveDatabaseConnectionString(
  url = process.env.DATABASE_URL
): string | undefined {
  return url ?? process.env.DIRECT_URL;
}
