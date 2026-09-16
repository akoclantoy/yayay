"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MIN_GCASH_REDEMPTION_POINTS, MIN_GCASH_REDEMPTION_PHP } from "@/lib/constants";
import { currencyToPoints, formatCurrency, formatPoints, pointsToCurrency } from "@/lib/utils";
import { GCASH_REWARD_ID, getGcashRewardMetadata, sanitizeGcashNumber } from "@/lib/gcash-redemption";

const metadata = getGcashRewardMetadata();

export function GCashRedemptionCard({ balance }: { balance: number }) {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState("");
  const [amountToRedeem, setAmountToRedeem] = useState("");
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  if (balance < 1) return null;

  const isEligible = balance >= MIN_GCASH_REDEMPTION_POINTS;
  const pointsNeeded = MIN_GCASH_REDEMPTION_POINTS - balance;
  const requestedAmount = Number(amountToRedeem);
  const requestedPoints = currencyToPoints(requestedAmount);
  const isValidAmount = Number.isFinite(requestedAmount)
    && requestedAmount >= MIN_GCASH_REDEMPTION_PHP
    && requestedAmount <= pointsToCurrency(balance)
    && Math.abs(pointsToCurrency(requestedPoints) - requestedAmount) <= 0.001;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please upload an image smaller than 5MB.");
      return;
    }

    try {
      const preview = await compressImage(file);
      setQrPreview(preview);
      setFileName(file.name);
    } catch {
      toast.error("Unable to read this image. Please choose another QR image.");
    }
  }

  function compressImage(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read image"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Unable to decode image"));
        image.onload = () => {
          const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (!isValidAmount) {
      toast.error(`Enter a PHP amount from ${formatCurrency(MIN_GCASH_REDEMPTION_PHP)} to ${formatCurrency(pointsToCurrency(balance))} in PHP 0.05 increments.`);
      return;
    }

    const sanitizedNumber = sanitizeGcashNumber(mobileNumber);
    if (!sanitizedNumber || sanitizedNumber.length < 11) {
      toast.error("Please enter a valid GCash number.");
      return;
    }
    if (!qrPreview) {
      toast.error("Please upload a QR image for verification.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardId: GCASH_REWARD_ID,
          points: requestedPoints,
          gcashNumber: sanitizedNumber,
          qrImageUrl: qrPreview,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "GCash redemption failed");

      setMobileNumber("");
      setAmountToRedeem("");
      setQrPreview(null);
      setFileName("");
      toast.success("GCash redemption submitted for approval!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GCash redemption failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/gcash.svg" alt="GCash logo" className="h-10 w-10 rounded-lg bg-white p-1 shadow-sm" />
            <CardTitle className="text-lg">GCash Redemption</CardTitle>
          </div>
          <Badge variant={isEligible ? "success" : "secondary"}>
            {isEligible ? `Minimum PHP ${MIN_GCASH_REDEMPTION_PHP}` : `${formatPoints(pointsNeeded)} pts needed`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{metadata.description}</p>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-medium text-primary">1 point = PHP 0.05</p>
          <p className="mt-1 text-muted-foreground">
            GCash redemption starts at {formatPoints(MIN_GCASH_REDEMPTION_POINTS)} points ({formatCurrency(MIN_GCASH_REDEMPTION_PHP)}).
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="gcash-amount" className="text-sm font-medium">Redemption amount (PHP)</label>
          <input
            id="gcash-amount"
            type="number"
            min={MIN_GCASH_REDEMPTION_PHP}
            max={pointsToCurrency(balance)}
            step="0.05"
            value={amountToRedeem}
            onChange={(event) => setAmountToRedeem(event.target.value)}
            placeholder={`${MIN_GCASH_REDEMPTION_PHP}-${pointsToCurrency(balance)}`}
            className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
          />
          <p className="text-xs text-muted-foreground">
            Available: {formatCurrency(pointsToCurrency(balance))} ({formatPoints(balance)} points)
          </p>
          {isValidAmount && (
            <p className="text-xs font-medium text-primary">This uses {formatPoints(requestedPoints)} points.</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="gcash-mobile" className="text-sm font-medium">GCash mobile number</label>
          <input
            id="gcash-mobile"
            type="tel"
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.target.value)}
            placeholder="0917 123 4567"
            className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="gcash-qr" className="text-sm font-medium">Upload GCash QR image</label>
          <input
            id="gcash-qr"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="flex h-11 w-full rounded-xl border border-dashed border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-white/5"
          />
          {fileName && <p className="text-xs text-muted-foreground">Selected file: {fileName}</p>}
        </div>

        {qrPreview && (
          <div className="overflow-hidden rounded-xl border border-primary/20 bg-white p-2">
            <img src={qrPreview} alt="GCash QR preview" className="max-h-40 w-full object-contain" />
          </div>
        )}

        <Button className="w-full" onClick={handleSubmit} disabled={loading || !isEligible} size="lg">
          {loading ? "Submitting..." : isEligible ? "Submit GCash Redemption" : "Earn more points to redeem"}
        </Button>
      </CardContent>
    </Card>
  );
}
