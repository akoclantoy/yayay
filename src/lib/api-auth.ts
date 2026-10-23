import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePhilippinePhone } from "@/lib/sms-recovery";

export async function requireSession(options: { requirePhone?: boolean } = {}) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (options.requirePhone !== false) {
    try {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { phone: true, isActive: true, deletedAt: true },
      });
      if (!user || !user.isActive || user.deletedAt) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
      }
      if (!normalizePhilippinePhone(user.phone)) {
        return {
          error: NextResponse.json(
            { error: "Add a registered phone number to continue.", code: "PHONE_SETUP_REQUIRED" },
            { status: 403 },
          ),
        };
      }
    } catch (error) {
      console.error("[api-auth:phone-check]", error);
      return {
        error: NextResponse.json({ error: "Unable to verify your account. Please try again." }, { status: 503 }),
      };
    }
  }

  return { session };
}

export async function requireRole(
  roles: UserRole[],
  options: { requirePhone?: boolean } = {},
) {
  const result = await requireSession(options);
  if ("error" in result) return result;

  const role = result.session.user.role ?? "RESIDENT";
  if (!roles.includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
