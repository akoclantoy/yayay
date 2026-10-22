import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyRecoveryOtpSchema } from "@/lib/validators/auth";
import {
  createResetToken,
  hashRecoveryValue,
  recoveryValuesMatch,
} from "@/lib/sms-recovery";

const INVALID_CODE = "The verification code is invalid or expired.";

export async function POST(request: Request) {
  try {
    const parsed = verifyRecoveryOtpSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    const now = new Date();
    const challenge = await db.smsRecoveryChallenge.findUnique({
      where: { id: parsed.data.challengeId },
      select: {
        id: true,
        codeHash: true,
        attempts: true,
        expiresAt: true,
        verifiedAt: true,
        consumedAt: true,
      },
    });
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.verifiedAt ||
      challenge.expiresAt <= now ||
      challenge.attempts >= 5 ||
      !recoveryValuesMatch(`code:${parsed.data.code}`, challenge.codeHash)
    ) {
      if (
        challenge &&
        !challenge.consumedAt &&
        !challenge.verifiedAt &&
        challenge.expiresAt > now &&
        challenge.attempts < 5
      ) {
        await db.smsRecoveryChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            verifiedAt: null,
            expiresAt: { gt: now },
            attempts: { lt: 5 },
          },
          data: { attempts: { increment: 1 } },
        });
      }
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    const resetToken = createResetToken();
    const updated = await db.smsRecoveryChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        verifiedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: 5 },
      },
      data: {
        verifiedAt: now,
        resetTokenHash: hashRecoveryValue(`reset:${resetToken}`),
        resetExpiresAt: new Date(now.getTime() + 10 * 60_000),
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    return NextResponse.json({ resetToken });
  } catch (error) {
    console.error("[sms-recovery:verify]", error);
    return NextResponse.json(
      { error: "Unable to verify the code. Please try again." },
      { status: 500 },
    );
  }
}
