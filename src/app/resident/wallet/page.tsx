import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatPoints, pointsToCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RewardsCatalog } from "@/components/resident/rewards-catalog";
import { RedeemCard } from "@/components/resident/redeem-card";
import { GCashRedemptionCard } from "@/components/resident/gcash-redemption-card";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [wallet, rewards, redemptions] = await Promise.all([
    db.rewardWallet.findUnique({
      where: { residentId: session.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
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
  const transactions = wallet?.transactions ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Reward Wallet</h1>
        <p className="text-muted-foreground">Your points balance, transaction history, and reward redemptions</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-secondary/5">
          <CardContent className="pt-8 pb-6 text-center">
            <p className="text-sm text-muted-foreground">Available balance</p>
            <p className="text-5xl font-bold text-gradient mt-2">{formatPoints(balance)}</p>
            <p className="text-sm text-muted-foreground mt-1">points</p>
            <p className="text-sm font-medium text-primary mt-2">{formatCurrency(pointsToCurrency(balance))} equivalent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <p className="text-sm text-muted-foreground">Lifetime earned</p>
            <p className="text-4xl font-bold mt-2">{formatPoints(lifetime)}</p>
            <p className="text-sm text-muted-foreground mt-1">total points</p>
            <p className="text-sm font-medium text-primary mt-2">{formatCurrency(pointsToCurrency(lifetime))} equivalent</p>
          </CardContent>
        </Card>
      </div>

      <RedeemCard balance={balance} />
      <GCashRedemptionCard balance={balance} />

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions yet. Start recycling to earn points!
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 p-4"
                >
                  <div>
                    <p className="font-medium">{tx.description ?? tx.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={tx.amount >= 0 ? "success" : "warning"}>
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount} pts
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Balance: {formatPoints(tx.balanceAfter)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RewardsCatalog rewards={rewards} balance={balance} redemptions={redemptions} />
    </div>
  );
}
