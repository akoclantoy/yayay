import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { pgPoolSsl, resolvePgConnectionString } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient(connectionString: string) {
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      ssl: pgPoolSsl(connectionString),
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function getPrismaClient() {
  const connectionString = resolvePgConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient(connectionString);
  }

  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    return Reflect.get(client, prop, receiver);
  },
  set(_target, prop, value, receiver) {
    const client = getPrismaClient();
    return Reflect.set(client, prop, value, receiver);
  },
  has(_target, prop) {
    const client = getPrismaClient();
    return prop in client;
  },
  ownKeys() {
    const client = getPrismaClient();
    return Reflect.ownKeys(client);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const client = getPrismaClient();
    return Object.getOwnPropertyDescriptor(client, prop);
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  const client = globalForPrisma.prisma;
  if (client) {
    globalForPrisma.prisma = client;
  }
}
