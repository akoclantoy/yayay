import { NextResponse } from "next/server";
import { requireRole, requireSession } from "@/lib/api-auth";
import { uploadImage } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { GCASH_REWARD_ID, getGcashRewardMetadata, sanitizeGcashNumber } from "@/lib/gcash-redemption";
import { z } from "zod";
import { MIN_GCASH_REDEMPTION_POINTS, MIN_REDEMPTION_PHP } from "@/lib/constants";
import { currencyToPoints } from "@/lib/utils";

async function ensureWallet(userId: string) {
  const existing = await db.rewardWallet.findUnique({ where: { residentId: userId } });
  if (existing) return existing;

  return db.rewardWallet.create({ data: { residentId: userId, balance: 0, lifetime: 0 } });
}

async function ensureGcashReward() {
  const metadata = getGcashRewardMetadata();

  return db.reward.upsert({
    where: { id: metadata.id },
    update: {
      name: metadata.name,
      description: metadata.description,
      type: metadata.type,
      pointsCost: metadata.pointsCost,
      imageUrl: metadata.imageUrl,
      isActive: true,
      stock: 9999,
    },
    create: {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      type: metadata.type,
      pointsCost: metadata.pointsCost,
      imageUrl: metadata.imageUrl,
      stock: 9999,
      isActive: true,
    },
  });
}

export async function GET() {
  const authResult = await requireSession();
  if ("error" in authResult) return authResult.error;

  const rewards = await db.reward.findMany({
    where: { isActive: true, deletedAt: null, stock: { gt: 0 } },
    orderBy: { pointsCost: "asc" },
  });

  return NextResponse.json(rewards);
}

const redeemSchema = z.object({
  rewardId: z.string().min(1).optional(),
  points: z.number().int().positive().optional(),
  amount: z.number().positive().optional(),
}).refine((data) => data.rewardId || data.points || data.amount, {
  message: "A reward, points amount, or PHP amount is required",
});

const updateRedemptionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "FULFILLED", "CANCELLED"]),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const payload = await request.json().catch(() => ({}));
    const rewardId = typeof payload.rewardId === "string" ? payload.rewardId : undefined;
    const points = typeof payload.points === "number" ? payload.points : undefined;
    const gcashNumber = typeof payload.gcashNumber === "string" ? payload.gcashNumber : undefined;
    const qrImageUrl = typeof payload.qrImageUrl === "string" ? payload.qrImageUrl : undefined;

    if (rewardId === GCASH_REWARD_ID || gcashNumber || qrImageUrl) {
      const sanitizedNumber = sanitizeGcashNumber(gcashNumber ?? "");
      if (!sanitizedNumber) {
        return NextResponse.json({ error: "A valid GCash mobile number is required." }, { status: 400 });
      }

      if (!qrImageUrl || !qrImageUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "Please upload your GCash QR image." }, { status: 400 });
      }

      let uploadedQrUrl = qrImageUrl;
      try {
        const uploadedQr = await uploadImage(qrImageUrl, "gcash-redemptions");
        uploadedQrUrl = uploadedQr.url;
      } catch {
        // Keep the compressed image in the redemption metadata when Cloudinary is unavailable.
        // RedemptionRequest.notes is LONGTEXT, so the request can still reach admin review.
      }

      const gcashReward = await ensureGcashReward();
      const wallet = await ensureWallet(authResult.session.user.id);
      const redemptionPoints = points ?? gcashReward.pointsCost;

      if (!Number.isInteger(redemptionPoints) || redemptionPoints <= 0) {
        return NextResponse.json({ error: "Enter a positive whole number of points." }, { status: 400 });
      }

      if (redemptionPoints < MIN_GCASH_REDEMPTION_POINTS) {
        return NextResponse.json(
          { error: `GCash redemption requires at least ${MIN_GCASH_REDEMPTION_POINTS} points (PHP 100).` },
          { status: 400 }
        );
      }

      if (wallet.balance < redemptionPoints) {
        return NextResponse.json(
          {
            error: `Insufficient points. You need ${redemptionPoints} points but have ${wallet.balance}.`,
          },
          { status: 400 }
        );
      }

      const redemption = await db.$transaction(async (tx) => {
        const req = await tx.redemptionRequest.create({
          data: {
            userId: authResult.session.user.id,
            rewardId: gcashReward.id,
            points: redemptionPoints,
            status: "PENDING",
            notes: JSON.stringify({
              type: "GCASH",
              gcashNumber: sanitizedNumber,
              qrImageUrl: uploadedQrUrl,
              submittedAt: new Date().toISOString(),
            }),
          },
          include: { reward: true },
        });

        await tx.notification.create({
          data: {
            userId: authResult.session.user.id,
            title: "GCash redemption submitted",
            message: `Your GCash redemption request for ${sanitizedNumber} is pending approval.`,
            type: "reward",
            link: "/resident/wallet",
          },
        });

        return req;
      });

      return NextResponse.json(redemption, { status: 201 });
    }

    const {
      rewardId: standardRewardId,
      points: standardPoints,
      amount: standardAmount,
    } = redeemSchema.parse(payload);
    if (standardAmount !== undefined) {
      const convertedPoints = currencyToPoints(standardAmount);
      if (standardAmount < MIN_REDEMPTION_PHP) {
        return NextResponse.json({ error: `Redemption requires at least PHP ${MIN_REDEMPTION_PHP}.` }, { status: 400 });
      }
      if (!Number.isInteger(convertedPoints) || convertedPoints <= 0 || Math.abs(standardAmount - convertedPoints * 0.05) > 0.001) {
        return NextResponse.json({ error: "PHP amount must be in PHP 0.05 increments." }, { status: 400 });
      }
    }
    const requestedPoints = standardPoints ?? (standardAmount !== undefined ? currencyToPoints(standardAmount) : undefined);
    const userId = authResult.session.user.id;

    const [requestedReward, wallet] = await Promise.all([
      standardRewardId
        ? db.reward.findFirst({ where: { id: standardRewardId, isActive: true, deletedAt: null } })
        : db.reward.findFirst({
            where: {
              isActive: true,
              deletedAt: null,
              stock: { gt: 0 },
              pointsCost: { lte: requestedPoints },
            },
            orderBy: { pointsCost: "desc" },
          }),
      ensureWallet(userId),
    ]);

    if (!requestedReward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    if (requestedReward.stock <= 0) {
      return NextResponse.json({ error: "Reward out of stock" }, { status: 400 });
    }

    const redemptionPoints = requestedPoints ?? requestedReward.pointsCost;
    if (wallet.balance < redemptionPoints) {
      return NextResponse.json(
        {
          error: `Insufficient points. You need ${redemptionPoints} points but have ${wallet.balance}.`,
        },
        { status: 400 }
      );
    }

    const redemption = await db.$transaction(async (tx) => {
      const req = await tx.redemptionRequest.create({
        data: {
          userId,
          rewardId: requestedReward.id,
          points: redemptionPoints,
          status: "PENDING",
        },
        include: { reward: true },
      });

      await tx.notification.create({
        data: {
          userId,
          title: "Redemption submitted",
          message: `Your request to redeem ${redemptionPoints} points is pending approval.`,
          type: "reward",
          link: "/resident/rewards",
        },
      });

      return req;
    });

    return NextResponse.json(redemption, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Redemption failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRole(["ADMIN"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { id, status, notes } = updateRedemptionSchema.parse(await request.json());

    const redemption = await db.redemptionRequest.findUnique({
      where: { id },
      include: {
        reward: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (!redemption) {
      return NextResponse.json({ error: "Redemption request not found" }, { status: 404 });
    }

    const actionIsApproval = status === "APPROVED" || status === "FULFILLED";
    const isTerminalState = ["REJECTED", "CANCELLED", "FULFILLED"].includes(redemption.status);

    if (isTerminalState && status !== redemption.status) {
      return NextResponse.json({ error: "This redemption request is already closed." }, { status: 400 });
    }

    if (actionIsApproval) {
      const wallet = await ensureWallet(redemption.userId);
      if (wallet.balance < redemption.points) {
        return NextResponse.json(
          {
            error: `This resident does not have enough points for this redemption. Required: ${redemption.points}, available: ${wallet.balance}.`,
          },
          { status: 400 }
        );
      }

      const updated = await db.$transaction(async (tx) => {
        const currentWallet = await tx.rewardWallet.findUnique({
          where: { residentId: redemption.userId },
        });

        if (!currentWallet) {
          throw new Error("Resident wallet not found");
        }

        if (currentWallet.balance < redemption.points) {
          throw new Error("Insufficient resident points");
        }

        const newBalance = currentWallet.balance - redemption.points;

        const nextStatus = status === "FULFILLED" ? "FULFILLED" : "APPROVED";

        const updatedRedemption = await tx.redemptionRequest.update({
          where: { id },
          data: {
            status: nextStatus,
            notes,
            fulfilledAt: status === "FULFILLED" ? new Date() : null,
          },
          include: {
            reward: true,
            user: { select: { id: true, name: true } },
          },
        });

        await tx.rewardWallet.update({
          where: { id: currentWallet.id },
          data: { balance: newBalance },
        });

        await tx.rewardTransaction.create({
          data: {
            walletId: currentWallet.id,
            userId: redemption.userId,
            type: "REDEEM",
            amount: -redemption.points,
            balanceAfter: newBalance,
            description: `Approved redemption: ${redemption.reward.name}`,
            referenceId: redemption.id,
          },
        });

        await tx.reward.update({
          where: { id: redemption.rewardId },
          data: { stock: { decrement: 1 } },
        });

        await tx.notification.create({
          data: {
            userId: redemption.userId,
            title: "Redemption approved",
            message: `Your redemption for "${redemption.reward.name}" has been approved and ${redemption.points} points were deducted from your balance.`,
            type: "reward",
            link: "/resident/rewards",
          },
        });

        return updatedRedemption;
      });

      return NextResponse.json(updated);
    }

    const updated = await db.redemptionRequest.update({
      where: { id },
      data: {
        status,
        notes,
        fulfilledAt: null,
      },
      include: { reward: true, user: { select: { id: true, name: true } } },
    });

    await db.notification.create({
      data: {
        userId: redemption.userId,
        title: "Redemption update",
        message: `Your redemption for "${redemption.reward.name}" was ${status.toLowerCase()}.`,
        type: "reward",
        link: "/resident/rewards",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 500 });
  }
}
