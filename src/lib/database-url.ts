/** Resolve the Railway MySQL URL used by Prisma and the MariaDB adapter. */
export function resolveDatabaseConnectionString(
  url = process.env.DATABASE_URL
): string | undefined {
  return url ?? process.env.DIRECT_URL;
}
