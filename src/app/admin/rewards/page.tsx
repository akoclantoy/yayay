import { db } from "@/lib/db";
import { RewardManager } from "@/components/admin/reward-manager";

export default async function AdminRewardsPage() {
  const rewards = await db.reward.findMany({
    where: { deletedAt: null },
    orderBy: { pointsCost: "asc" },
    include: { _count: { select: { redemptions: true } } },
  });

  const serialized = rewards.map((reward) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    type: reward.type,
    pointsCost: reward.pointsCost,
    cashValue: reward.cashValue,
    imageUrl: reward.imageUrl,
    stock: reward.stock,
    redemptions: reward._count.redemptions,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Manage Rewards</h1>
        <p className="text-muted-foreground">{rewards.length} reward items</p>
      </div>

      <RewardManager initial={serialized} />
    </div>
  );
}
