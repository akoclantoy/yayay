"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MIN_REDEMPTION_POINTS } from "@/lib/constants";
import { currencyToPoints, formatCurrency, pointsToCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RedeemCard({ balance }: { balance: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [redeemAmount, setRedeemAmount] = useState("");

  const amount = Number(redeemAmount);
  const points = currencyToPoints(amount);
  const canRedeem = Number.isFinite(amount)
    && Number.isInteger(points)
    && amount >= pointsToCurrency(MIN_REDEMPTION_POINTS)
    && amount <= pointsToCurrency(currentBalance)
    && Math.abs(pointsToCurrency(points) - amount) < 0.001;

  async function handleRedeem() {
    if (!canRedeem) return;

    setLoading(true);
    try {
      const redeemRes = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await redeemRes.json();
      if (!redeemRes.ok) {
        throw new Error(data.error ?? "Redemption failed");
      }

      setCurrentBalance((prev) => prev - points);
      setRedeemAmount("");
      toast.success(`${formatCurrency(amount)} submitted for approval!`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem");
    } finally {
      setLoading(false);
    }
  }

  // Only show the card if user has close to the threshold or above
  if (currentBalance < MIN_REDEMPTION_POINTS - 50) {
    return null;
  }

  const amountNeeded = pointsToCurrency(MIN_REDEMPTION_POINTS - currentBalance);
  const isEligible = currentBalance >= MIN_REDEMPTION_POINTS;

  return (
    <Card className={`border-2 ${isEligible ? "border-primary/50 bg-gradient-to-br from-primary/5 to-secondary/5" : "border-border/50"}`}>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg">Redeem Your Balance</CardTitle>
          <Badge variant={isEligible ? "success" : "secondary"}>
            {isEligible ? "Eligible" : `${formatCurrency(amountNeeded)} needed`}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Enter the PHP amount you want to redeem.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-primary">{formatCurrency(pointsToCurrency(currentBalance))}</p>
            <p className="text-sm text-muted-foreground">current balance</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(pointsToCurrency(MIN_REDEMPTION_POINTS))}</p>
            <p className="text-sm text-muted-foreground">minimum amount</p>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="redeem-amount" className="text-sm font-medium">PHP amount to redeem</label>
          <input
            id="redeem-amount"
            type="number"
            min={pointsToCurrency(MIN_REDEMPTION_POINTS).toFixed(2)}
            max={pointsToCurrency(currentBalance).toFixed(2)}
            step="0.05"
            value={redeemAmount}
            onChange={(event) => setRedeemAmount(event.target.value)}
            className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
          />
          <p className="text-xs text-muted-foreground">Minimum: {formatCurrency(pointsToCurrency(MIN_REDEMPTION_POINTS))}. Maximum: {formatCurrency(pointsToCurrency(currentBalance))}.</p>
        </div>
        <Button
          className="w-full"
          variant={isEligible ? "default" : "secondary"}
          disabled={!isEligible || loading}
          onClick={handleRedeem}
          size="lg"
        >
          {loading ? "Processing..." : canRedeem ? "Redeem PHP" : "Enter a valid amount"}
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
