import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const DEMO_USERS = [
  {
    email: "admin@example.com",
    name: "System Admin",
    password: "Admin123!",
    role: "ADMIN" as const,
  },
  {
    email: "staff@example.com",
    name: "Collection Staff",
    password: "Staff123!",
    role: "COLLECTION_STAFF" as const,
  },
  {
    email: "resident@example.com",
    name: "Juan Dela Cruz",
    password: "Resident123!",
    role: "RESIDENT" as const,
  },
];

let bootstrapPromise: Promise<void> | null = null;

/**
 * Ensures demo accounts exist and can sign in (verified, active, password set).
 * Safe to call on every server start — idempotent upserts only.
 */
export async function ensureDemoUsers() {
  if (bootstrapPromise) return bootstrapPromise;
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    return;
  }

  bootstrapPromise = (async () => {
    try {
      const center = await db.collectionCenter.findFirst({
        where: { id: "seed-center-001" },
        select: { id: true },
      }).catch(() => null); // Handle database connection errors gracefully

      for (const demo of DEMO_USERS) {
        try {
          const passwordHash = await bcrypt.hash(demo.password, 12);

          await db.user.upsert({
            where: { email: demo.email },
            update: {
              name: demo.name,
              passwordHash,
              emailVerified: new Date(),
              isActive: true,
              deletedAt: null,
              role: demo.role,
            },
            create: {
              name: demo.name,
              email: demo.email,
              passwordHash,
              emailVerified: new Date(),
              role: demo.role,
              ...(demo.role === "COLLECTION_STAFF" && center
                ? {
                    staffProfile: {
                      create: {
                        employeeId: "EMP-001",
                        assignedCenterId: center.id,
                      },
                    },
                  }
                : {}),
              ...(demo.role === "RESIDENT"
                ? {
                    residentProfile: {
                      create: {
                        wallet: { create: {} },
                      },
                    },
                  }
                : {}),
            },
          });
        } catch (userError) {
          console.error(`[bootstrap-users] Failed to create user ${demo.email}:`, userError);
        }
      }

      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        await db.user.updateMany({
          where: { emailVerified: null },
          data: { emailVerified: new Date() },
        }).catch(() => {}); // Ignore errors
      }
    } catch (error) {
      console.error("[bootstrap-users] Bootstrap failed:", error);
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}
