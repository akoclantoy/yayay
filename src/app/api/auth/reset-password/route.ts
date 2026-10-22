import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetRecoveredPasswordSchema } from "@/lib/validators/auth";
import { hashRecoveryValue, recoveryValuesMatch } from "@/lib/sms-recovery";

export async function POST(request: Request) {
  try {
    const parsed = resetRecoveredPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const challenge = await db.smsRecoveryChallenge.findUnique({
      where: { id: parsed.data.challengeId },
      select: {
        id: true,
        userId: true,
        resetTokenHash: true,
        resetExpiresAt: true,
        verifiedAt: true,
        consumedAt: true,
      },
    });
    const now = new Date();
    if (
      !challenge ||
      !challenge.userId ||
      !challenge.verifiedAt ||
      challenge.consumedAt ||
      !challenge.resetTokenHash ||
      !challenge.resetExpiresAt ||
      challenge.resetExpiresAt <= now ||
      !recoveryValuesMatch(`reset:${parsed.data.resetToken}`, challenge.resetTokenHash)
    ) {
      return NextResponse.json(
        { error: "The recovery session is invalid or expired. Request a new code." },
        { status: 400 }
      );
    }

    const userId = challenge.userId;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const reset = await db.$transaction(async (tx) => {
      const claimedChallenge = await tx.smsRecoveryChallenge.updateMany({
        where: {
          id: challenge.id,
          userId,
          verifiedAt: { not: null },
          consumedAt: null,
          resetExpiresAt: { gt: now },
          resetTokenHash: hashRecoveryValue(`reset:${parsed.data.resetToken}`),
        },
        data: { consumedAt: now, resetTokenHash: null },
      });
      if (claimedChallenge.count !== 1) return false;

      const updatedUser = await tx.user.updateMany({
        where: { id: userId, deletedAt: null, isActive: true },
        data: { passwordHash },
      });
      if (updatedUser.count !== 1) {
        throw new Error("RECOVERY_ACCOUNT_UNAVAILABLE");
      }
      return true;
    });
    if (!reset) {
      return NextResponse.json(
        { error: "The recovery session is invalid or expired. Request a new code." },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    if (error instanceof Error && error.message === "RECOVERY_ACCOUNT_UNAVAILABLE") {
      return NextResponse.json(
        { error: "The recovery session is invalid or expired. Request a new code." },
        { status: 400 }
      );
    }
    console.error("[reset-password]", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
