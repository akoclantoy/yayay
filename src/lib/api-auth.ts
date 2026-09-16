import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function requireRole(roles: UserRole[]) {
  const result = await requireSession();
  if ("error" in result) return result;

  const role = result.session.user.role ?? "RESIDENT";
  if (!roles.includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
