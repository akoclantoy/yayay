"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatPoints, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RewardModel } from "@/generated/prisma/models/Reward";
import type { RedemptionRequestModel } from "@/generated/prisma/models/RedemptionRequest";

type RedemptionWithReward = RedemptionRequestModel & { reward: RewardModel };

export function RewardsCatalog({
  rewards,
  balance,
  redemptions,
}: {
  rewards: RewardModel[];
  balance: number;
  redemptions: RedemptionWithReward[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [currentRedemptions, setCurrentRedemptions] = useState(redemptions);

  async function redeem(rewardId: string) {
    setLoading(rewardId);
    try {
      const res = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Redemption failed");
      }
      const reward = rewards.find((item) => item.id === rewardId);
      if (reward) {
        setCurrentBalance((prev) => prev - reward.pointsCost);
        setCurrentRedemptions((prev) => [
          {
            id: data.id,
            userId: "",
            rewardId,
            points: reward.pointsCost,
            status: "PENDING",
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            fulfilledAt: null,
            reward,
          } as RedemptionWithReward,
          ...prev,
        ]);
      }
      toast.success("Redemption submitted for approval!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Redeem Rewards</h1>
        <p className="text-muted-foreground">
          Available balance: <span className="font-semibold text-primary">{formatPoints(currentBalance)} pts</span>
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((reward) => {
          const hasEnoughPoints = currentBalance >= reward.pointsCost;
          const hasStock = (reward.stock ?? 0) > 0;
          const canRedeem = hasEnoughPoints && hasStock;
          return (
            <Card key={reward.id} className="hover:shadow-lg transition-shadow border-primary/10">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg">{reward.name}</CardTitle>
                  <Badge>{reward.type.replace("_", " ")}</Badge>
                </div>
                {reward.description && (
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-primary">{formatPoints(reward.pointsCost)} pts</p>
                {reward.cashValue && (
                  <p className="text-sm text-muted-foreground">
                    Value: {formatCurrency(reward.cashValue)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{reward.stock} in stock</p>
                <Button
                  className="w-full"
                  variant={canRedeem ? "default" : "secondary"}
                  disabled={!canRedeem || loading === reward.id}
                  onClick={() => redeem(reward.id)}
                >
                  {loading === reward.id
                    ? "Processing..."
                    : canRedeem
                      ? "Redeem"
                      : hasStock
                        ? "Insufficient points"
                        : "Out of stock"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {currentRedemptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent redemptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentRedemptions.map((r) => (
              <div key={r.id} className="flex justify-between items-center rounded-xl border p-3">
                <div>
                  <p className="font-medium">{r.reward.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={r.status === "FULFILLED" ? "success" : "secondary"}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
