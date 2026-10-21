import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, pointsToCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { RewardsCatalog } from "@/components/resident/rewards-catalog";
import { RedeemCard } from "@/components/resident/redeem-card";
import { GCashRedemptionCard } from "@/components/resident/gcash-redemption-card";
import { AnimatedPoints } from "@/components/resident/animated-points";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [wallet, rewards, redemptions] = await Promise.all([
    db.rewardWallet.findUnique({
      where: { residentId: session.user.id },
    }),
    db.reward.findMany({
      where: { isActive: true, deletedAt: null, stock: { gt: 0 } },
      orderBy: { pointsCost: "asc" },
    }),
    db.redemptionRequest.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { reward: true },
    }),
  ]);

  const balance = wallet?.balance ?? 0;
  const lifetime = wallet?.lifetime ?? 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Reward Wallet</h1>
        <p className="text-muted-foreground">Your points balance and available reward redemptions</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-secondary/5">
          <CardContent className="pt-8 pb-6 text-center">
            <p className="text-sm text-muted-foreground">Available balance</p>
            <AnimatedPoints
              value={balance}
              className="mt-2 block text-5xl font-bold text-gradient"
            />
            <p className="text-sm text-muted-foreground mt-1">points</p>
            <p className="text-sm font-medium text-primary mt-2">{formatCurrency(pointsToCurrency(balance))} equivalent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <p className="text-sm text-muted-foreground">Lifetime earned</p>
            <AnimatedPoints
              value={lifetime}
              className="mt-2 block text-4xl font-bold"
            />
            <p className="text-sm text-muted-foreground mt-1">total points</p>
            <p className="text-sm font-medium text-primary mt-2">{formatCurrency(pointsToCurrency(lifetime))} equivalent</p>
          </CardContent>
        </Card>
      </div>

      <RedeemCard balance={balance} />
      <GCashRedemptionCard balance={balance} />

      <RewardsCatalog rewards={rewards} balance={balance} redemptions={redemptions} />
    </div>
  );
}
