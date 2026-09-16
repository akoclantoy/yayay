"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatPoints } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const REDEEM_THRESHOLD = 150;

export function RedeemCard({ balance }: { balance: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [redeemAmount, setRedeemAmount] = useState(String(Math.min(REDEEM_THRESHOLD, balance)));

  const amount = Number(redeemAmount);
  const canRedeem = Number.isInteger(amount) && amount >= REDEEM_THRESHOLD && amount <= currentBalance;

  async function handleRedeem() {
    if (!canRedeem) return;

    setLoading(true);
    try {
      const redeemRes = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: amount }),
      });

      const data = await redeemRes.json();
      if (!redeemRes.ok) {
        throw new Error(data.error ?? "Redemption failed");
      }

      setCurrentBalance((prev) => prev - amount);
      setRedeemAmount("");
      toast.success(`${amount} points submitted for approval!`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem");
    } finally {
      setLoading(false);
    }
  }

  // Only show the card if user has close to the threshold or above
  if (currentBalance < REDEEM_THRESHOLD - 50) {
    return null;
  }

  const pointsNeeded = REDEEM_THRESHOLD - currentBalance;
  const isEligible = currentBalance >= REDEEM_THRESHOLD;

  return (
    <Card className={`border-2 ${isEligible ? "border-primary/50 bg-gradient-to-br from-primary/5 to-secondary/5" : "border-border/50"}`}>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg">Redeem Your Points</CardTitle>
          <Badge variant={isEligible ? "success" : "secondary"}>
            {isEligible ? "Eligible" : `${pointsNeeded} pts needed`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Enter the points amount you want to redeem.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-primary">{formatPoints(currentBalance)}</p>
            <p className="text-sm text-muted-foreground">current balance</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatPoints(REDEEM_THRESHOLD)}</p>
            <p className="text-sm text-muted-foreground">points needed</p>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="redeem-amount" className="text-sm font-medium">Points to redeem</label>
          <input
            id="redeem-amount"
            type="number"
            min={REDEEM_THRESHOLD}
            max={currentBalance}
            step="1"
            value={redeemAmount}
            onChange={(event) => setRedeemAmount(event.target.value)}
            className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
          />
          <p className="text-xs text-muted-foreground">Minimum: {formatPoints(REDEEM_THRESHOLD)} pts. Maximum: {formatPoints(currentBalance)} pts.</p>
        </div>
        <Button
          className="w-full"
          variant={isEligible ? "default" : "secondary"}
          disabled={!isEligible || loading}
          onClick={handleRedeem}
          size="lg"
        >
          {loading ? "Processing..." : canRedeem ? "Redeem Points" : "Enter a valid amount"}
        </Button>
        {!canRedeem && (
          <p className="text-xs text-center text-muted-foreground">
            Continue recycling to earn more points and unlock rewards!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
