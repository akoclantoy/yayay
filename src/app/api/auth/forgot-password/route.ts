import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { APP_NAME } from "@/lib/constants";
import {
  createRecoveryCode,
  hashRecoveryValue,
  isSmsRecoveryConfigured,
  normalizePhilippinePhone,
  sendRecoverySms,
} from "@/lib/sms-recovery";

const GENERIC_MESSAGE =
  "If an account matches and has a registered mobile number, a verification code has been sent.";

export async function POST(request: Request) {
  let stage = "configuration";
  try {
    if (!isSmsRecoveryConfigured()) {
      return NextResponse.json(
        { error: "SMS account recovery is temporarily unavailable." },
        { status: 503 },
      );
    }

    stage = "validation";
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email/account name and phone number." }, { status: 400 });
    }

    const identifier = parsed.data.identifier.trim().toLowerCase();
    const identifierHash = hashRecoveryValue(`identifier:${identifier}`);
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientAddress = request.headers.get("x-real-ip")?.trim() || forwardedFor || "unknown";
    const clientHash = hashRecoveryValue(`client:${clientAddress}`);
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60_000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    stage = "account_lookup";
    const matches = await db.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { email: identifier },
          { name: { equals: parsed.data.identifier.trim(), mode: "insensitive" } },
        ],
      },
      select: { id: true, phone: true },
      take: 2,
    });
    const matchedAccount = matches.length === 1 ? matches[0] : null;
    const submittedPhone = normalizePhilippinePhone(parsed.data.phone);
    const storedPhone = normalizePhilippinePhone(matchedAccount?.phone ?? null);
    const user =
      matchedAccount && submittedPhone && storedPhone === submittedPhone
        ? matchedAccount
        : null;
    const phone = user ? storedPhone : null;
    const code = createRecoveryCode();
    stage = "challenge_creation";
    const challengeResult = await db.$transaction(async (tx) => {
      await tx.$queryRaw<{ locked: number }[]>`
        WITH acquired AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtext(${`sms-recovery:client:${clientHash}`}))
        )
        SELECT 1 AS locked FROM acquired
      `;
      await tx.$queryRaw<{ locked: number }[]>`
        WITH acquired AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtext(${`sms-recovery:identifier:${identifierHash}`}))
        )
        SELECT 1 AS locked FROM acquired
      `;

      const [recentIdentifierRequests, recentClientRequests, latestRequest] = await Promise.all([
        tx.smsRecoveryChallenge.count({
          where: { identifierHash, createdAt: { gte: fifteenMinutesAgo } },
        }),
        tx.smsRecoveryChallenge.count({
          where: { clientHash, createdAt: { gte: oneHourAgo } },
        }),
        tx.smsRecoveryChallenge.findFirst({
          where: { identifierHash },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        }),
      ]);
      if (
        recentIdentifierRequests >= 3 ||
        recentClientRequests >= 15 ||
        (latestRequest && now.getTime() - latestRequest.createdAt.getTime() < 60_000)
      ) {
        return { challengeId: latestRequest?.id ?? randomUUID(), challenge: null, throttled: true };
      }

      await tx.smsRecoveryChallenge.updateMany({
        where: { identifierHash, consumedAt: null },
        data: { consumedAt: now, resetTokenHash: null },
      });
      await tx.smsRecoveryChallenge.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } },
      });
      const challenge = await tx.smsRecoveryChallenge.create({
        data: {
          userId: phone ? user?.id : null,
          identifierHash,
          clientHash,
          codeHash: hashRecoveryValue(`code:${code}`),
          expiresAt: new Date(now.getTime() + 5 * 60_000),
        },
        select: { id: true },
      });
      return { challengeId: challenge.id, challenge, throttled: false };
    });

    if (challengeResult.throttled) {
      return NextResponse.json(
        { error: "Please wait before requesting another recovery code." },
        { status: 429 },
      );
    }

    if (user && phone && challengeResult.challenge) {
      stage = "sms_delivery";
      try {
        await sendRecoverySms(
          phone,
          `${APP_NAME} password recovery code: ${code}. It expires in 5 minutes. Do not share this code.`,
        );
      } catch (error) {
        await db.smsRecoveryChallenge.update({
          where: { id: challengeResult.challenge.id },
          data: { consumedAt: new Date() },
        });
        throw error;
      }
    }

    return NextResponse.json({
      message: GENERIC_MESSAGE,
      challengeId: challengeResult.challengeId,
    });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("[forgot-password]", { stage, errorName, errorCode });
    return NextResponse.json(
      { error: "Unable to process the recovery request. Please try again later." },
      { status: stage === "sms_delivery" ? 503 : 500 },
    );
  }
}
