"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GCASH_REWARD_ID, getGcashRewardMetadata, sanitizeGcashNumber } from "@/lib/gcash-redemption";

const metadata = getGcashRewardMetadata();

export function GCashRedemptionCard({ balance }: { balance: number }) {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  if (balance < 1) {
    return null;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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
          const maxDimension = 1200;
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
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
    const sanitizedNumber = sanitizeGcashNumber(mobileNumber);
    const points = Number(pointsToRedeem);

    if (!Number.isInteger(points) || points < 1 || points > balance) {
      toast.error(`Enter a whole number from 1 to ${balance} points.`);
      return;
    }

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
      const res = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardId: GCASH_REWARD_ID,
          points,
          gcashNumber: sanitizedNumber,
          qrImageUrl: qrPreview,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "GCash redemption failed");
      }

      setMobileNumber("");
      setPointsToRedeem("");
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
          <Badge variant="secondary">Any amount up to {balance} pts</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{metadata.description}</p>

        <div className="space-y-2">
          <label htmlFor="gcash-points" className="text-sm font-medium">
            Points to redeem
          </label>
          <input
            id="gcash-points"
            type="number"
            min="1"
            max={balance}
            step="1"
            value={pointsToRedeem}
            onChange={(event) => setPointsToRedeem(event.target.value)}
            placeholder={`1-${balance}`}
            className="flex h-11 w-full rounded-xl border border-border/80 bg-white/80 px-4 text-sm dark:bg-white/5"
          />
          <p className="text-xs text-muted-foreground">Available balance: {balance} points</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="gcash-mobile" className="text-sm font-medium">
            GCash mobile number
          </label>
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
          <label htmlFor="gcash-qr" className="text-sm font-medium">
            Upload GCash QR image
          </label>
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

        <Button className="w-full" onClick={handleSubmit} disabled={loading} size="lg">
          {loading ? "Submitting..." : "Submit GCash Redemption"}
        </Button>
      </CardContent>
    </Card>
  );
}