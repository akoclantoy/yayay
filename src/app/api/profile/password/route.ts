import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const user = await db.user.findUnique({
      where: { id: authResult.session.user.id },
      select: { passwordHash: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return NextResponse.json(
        { error: "This account is not available." },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "This account does not have a password yet. Use the forgot-password option to set one.",
        },
        { status: 400 }
      );
    }

    const currentPasswordIsValid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash
    );
    if (!currentPasswordIsValid) {
      return NextResponse.json(
        { error: "Your current password is incorrect." },
        { status: 400 }
      );
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json(
        { error: "Your new password must be different from your current password." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: authResult.session.user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[profile:update-password]", error);
    return NextResponse.json(
      { error: "Unable to update your password. Please try again." },
      { status: 500 }
    );
  }
}
