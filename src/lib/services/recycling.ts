import { db } from "@/lib/db";

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

  const record = await db.recyclingRecord.create({
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

  void (async () => {
    try {
      const wallet = await db.rewardWallet.findUnique({
        where: { residentId: input.residentId },
      });

      const balance = (wallet?.balance ?? 0) + pointsEarned;
      const lifetime = (wallet?.lifetime ?? 0) + pointsEarned;

      if (wallet) {
        await db.rewardWallet.update({
          where: { id: wallet.id },
          data: { balance, lifetime },
        });
        await db.rewardTransaction.create({
          data: {
            walletId: wallet.id,
            userId: input.residentId,
            type: "EARN",
            amount: pointsEarned,
            balanceAfter: balance,
            description: `Recycled ${category.name}`,
            referenceId: record.id,
          },
        });
      } else {
        const created = await db.rewardWallet.create({
          data: {
            residentId: input.residentId,
            balance: pointsEarned,
            lifetime: pointsEarned,
          },
        });
        await db.rewardTransaction.create({
          data: {
            walletId: created.id,
            userId: input.residentId,
            type: "EARN",
            amount: pointsEarned,
            balanceAfter: pointsEarned,
            description: `Recycled ${category.name}`,
            referenceId: record.id,
          },
        });
      }
    } catch (error) {
      console.error("[recycling wallet update]", error);
    }
  })();

  void (async () => {
    try {
      const profile = await db.residentProfile.findUnique({
        where: { userId: input.residentId },
      });

      if (profile) {
        const totalWeight = profile.totalWeightKg + input.weightKg;
        const carbonSaved = profile.carbonSavedKg + carbonSavedKg;
        const envScore = Math.min(1000, profile.environmentalScore + Math.round(pointsEarned / 2));

        await db.residentProfile.update({
          where: { userId: input.residentId },
          data: {
            totalWeightKg: totalWeight,
            carbonSavedKg: carbonSaved,
            environmentalScore: envScore,
            recyclingStreak: profile.recyclingStreak + 1,
          },
        });
      }
    } catch (error) {
      console.error("[recycling profile update]", error);
    }
  })();

  void (async () => {
    try {
      await db.notification.create({
        data: {
          userId: input.residentId,
          title: "Points earned!",
          message: `You earned ${pointsEarned} points for recycling ${input.weightKg}kg of ${category.name}.`,
          type: "reward",
          link: "/resident/wallet",
        },
      });
    } catch (error) {
      console.error("[recycling notification]", error);
    }
  })();

  return record;
}
