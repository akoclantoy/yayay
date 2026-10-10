import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { db } from "@/lib/db";

const claimSchema = z.object({ badgeId: z.string().min(1) });

export async function POST(request: Request) {
  const authResult = await requireRole(["RESIDENT"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { badgeId } = claimSchema.parse(await request.json());
    const userId = authResult.session.user.id;
    const earnedBadge = await db.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
      include: { badge: true },
    });

    if (!earnedBadge) {
      return NextResponse.json({ error: "You have not earned this badge" }, { status: 404 });
    }
    if (earnedBadge.claimedAt) {
      return NextResponse.json({ error: "This bonus has already been claimed" }, { status: 409 });
    }
    if (earnedBadge.bonusPoints <= 0) {
      return NextResponse.json({ error: "This badge has no points bonus" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const claim = await tx.userBadge.updateMany({
        where: { id: earnedBadge.id, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (claim.count !== 1) throw new Error("BONUS_ALREADY_CLAIMED");

      const wallet = await tx.rewardWallet.upsert({
        where: { residentId: userId },
        create: {
          residentId: userId,
          balance: earnedBadge.bonusPoints,
          lifetime: earnedBadge.bonusPoints,
        },
        update: {
          balance: { increment: earnedBadge.bonusPoints },
          lifetime: { increment: earnedBadge.bonusPoints },
        },
      });

      await tx.rewardTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: "BONUS",
          amount: earnedBadge.bonusPoints,
          balanceAfter: wallet.balance,
          description: `${earnedBadge.badge.name} badge bonus`,
          referenceId: earnedBadge.id,
        },
      });

      return { points: earnedBadge.bonusPoints, balance: wallet.balance };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === "BONUS_ALREADY_CLAIMED") {
      return NextResponse.json({ error: "This bonus has already been claimed" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to claim badge bonus" },
      { status: 500 }
    );
  }
}
