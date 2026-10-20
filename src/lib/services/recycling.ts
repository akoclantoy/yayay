import { db } from "@/lib/db";
import { syncWeightMilestoneBadges } from "@/lib/services/badges";

export async function recordRecycling(input: {
  residentId: string;
  wasteCategoryId: string;
  weightKg: number;
  quantity?: number;
  centerId?: string;
  recordedById: string;
  notes?: string;
  images?: string[];
}) {
  const category = await db.wasteCategory.findUnique({
    where: { id: input.wasteCategoryId },
    select: { id: true, name: true, pointsPerKg: true, carbonFactorKg: true, isActive: true },
  });
  if (!category?.isActive) throw new Error("Invalid waste category");

  const pointsEarned = Math.round(input.weightKg * category.pointsPerKg);
  const carbonSavedKg = input.weightKg * category.carbonFactorKg;

  const record = await db.$transaction(async (tx) => {
    const record = await tx.recyclingRecord.create({
      data: {
        residentId: input.residentId,
        wasteCategoryId: input.wasteCategoryId,
        weightKg: input.weightKg,
        quantity: input.quantity ?? 1,
        centerId: input.centerId,
        recordedById: input.recordedById,
        verifiedById: input.recordedById,
        pointsEarned,
        carbonSavedKg,
        notes: input.notes,
        images: input.images ?? [],
        verified: true,
      },
      include: { wasteCategory: true },
    });

    const wallet = await tx.rewardWallet.upsert({
      where: { residentId: input.residentId },
      create: {
        residentId: input.residentId,
        balance: pointsEarned,
        lifetime: pointsEarned,
      },
      update: {
        balance: { increment: pointsEarned },
        lifetime: { increment: pointsEarned },
      },
    });

    await tx.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.residentId,
        type: "EARN",
        amount: pointsEarned,
        balanceAfter: wallet.balance,
        description: `Recycled ${category.name}`,
        referenceId: record.id,
      },
    });

    const profile = await tx.residentProfile.findUnique({
      where: { userId: input.residentId },
      select: { environmentalScore: true },
    });

    if (profile) {
      await tx.residentProfile.update({
        where: { userId: input.residentId },
        data: {
          totalWeightKg: { increment: input.weightKg },
          carbonSavedKg: { increment: carbonSavedKg },
          environmentalScore: Math.min(
            1000,
            profile.environmentalScore + Math.round(pointsEarned / 2)
          ),
          recyclingStreak: { increment: 1 },
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: input.residentId,
        title: "Points earned!",
        message: `You earned ${pointsEarned} points for recycling ${input.weightKg}kg of ${category.name}.`,
        type: "reward",
        link: "/resident/wallet",
      },
    });
    const admins = await tx.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: "Recycling transaction recorded",
          message: `A staff member recorded ${input.weightKg}kg of ${category.name} recycling.`,
          type: "recycling",
          link: "/admin/reports",
        })),
      });
    }

    return record;
  });

  try {
    await syncWeightMilestoneBadges(input.residentId);
  } catch (error) {
    console.error("[recycling badge milestones]", error);
  }

  return record;
}
