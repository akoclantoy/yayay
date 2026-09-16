import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDemoUsers } from "@/lib/bootstrap-users";

async function pingDatabaseWithRetry() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await db.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  throw lastError;
}

function getHealthFailureReason(error: unknown, databaseConfigured: boolean) {
  const message = error instanceof Error ? error.message : "Unknown database error";
  const normalized = message.toLowerCase();

  if (!databaseConfigured) {
    return "DATABASE_URL is not configured";
  }

  if (
    normalized.includes("does not exist") ||
    normalized.includes("relation \"") ||
    normalized.includes("table \"") ||
    normalized.includes("public.user")
  ) {
    return "Database schema is not initialized. Run prisma db push and prisma db seed for this project.";
  }

  return `Database connection failed. Check DATABASE_URL/DIRECT_URL and the Railway MySQL service. Details: ${message}`;
}

export async function GET() {
  try {
    await pingDatabaseWithRetry();
    await ensureDemoUsers();

    const userCount = await db.user.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      users: userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health]", error);
    const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.DIRECT_URL);

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        databaseConfigured,
        reason: getHealthFailureReason(error, databaseConfigured),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
