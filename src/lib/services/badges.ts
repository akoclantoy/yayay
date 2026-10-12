import { db } from "@/lib/db";

export async function syncWeightMilestoneBadges(userId: string) {
  const [weight, badges] = await Promise.all([
    db.recyclingRecord.aggregate({
      where: { residentId: userId, verified: true, deletedAt: null },
      _sum: { weightKg: true },
    }),
    db.badge.findMany({
      where: { targetWeightKg: { not: null } },
      select: { id: true, targetWeightKg: true, points: true },
    }),
  ]);
  const totalWeightKg = weight._sum.weightKg ?? 0;
  const eligibleBadges = badges.filter(
    (badge) => badge.targetWeightKg !== null && totalWeightKg >= badge.targetWeightKg
  );

  if (eligibleBadges.length > 0) {
    await db.userBadge.createMany({
      data: eligibleBadges.map((badge) => ({
        userId,
        badgeId: badge.id,
        bonusPoints: badge.points,
      })),
      skipDuplicates: true,
    });
  }

  return totalWeightKg;
}
