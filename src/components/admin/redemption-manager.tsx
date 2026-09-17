"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatPoints } from "@/lib/utils";
import { parseGcashNotes } from "@/lib/gcash-redemption";

type Redemption = {
  id: string;
  points: number;
  status: string;
  notes: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
  reward: { name: string; imageUrl?: string | null };
};

const ACTIONS = [
  { label: "Approve", status: "APPROVED" },
  { label: "Reject", status: "REJECTED" },
] as const;

export function RedemptionManager({ initial }: { initial: Redemption[] }) {
  const [redemptions, setRedemptions] = useState(initial);
  const [search, setSearch] = useState("");
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const filteredRedemptions = redemptions.filter((redemption) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (redemption.user.name ?? redemption.user.email).toLowerCase().includes(query);
  });

  function renderNotes(redemption: Redemption) {
    const parsed = parseGcashNotes(redemption.notes);
    if (!parsed || parsed.type !== "GCASH") return null;

    return (
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3 text-xs">
        <p className="font-medium text-foreground">GCash redemption request</p>
        <p className="font-semibold text-foreground">
          Points requested: {formatPoints(redemption.points)} pts
        </p>
        <p>
          <span className="text-muted-foreground">GCash number:</span> {parsed.gcashNumber}
        </p>
        {parsed.qrImageUrl && (
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedQr(parsed.qrImageUrl)}>
            View submitted QR
          </Button>
        )}
      </div>
    );
  }

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch("/api/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed");
      }
      setRedemptions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      toast.success(`Redemption ${status === "APPROVED" ? "approved" : "rejected"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  if (redemptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No redemption requests yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search resident name"
          aria-label="Search resident name"
          className="pl-9"
        />
      </div>

      {filteredRedemptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No redemption requests match this resident search.
          </CardContent>
        </Card>
      ) : filteredRedemptions.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-3">
                {r.reward.name === "GCash Redemption" ? (
                  <img src="/gcash.svg" alt="GCash" className="h-9 w-9 rounded-md object-contain" />
                ) : r.reward.imageUrl ? (
                  <img src={r.reward.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                ) : null}
                <CardTitle className="text-base">
                  {r.reward.name === "10% Partner Discount" ? "Reward Redemption" : r.reward.name}
                </CardTitle>
              </div>
              <Badge>{r.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {r.user.name ?? r.user.email} · {formatPoints(r.points)} pts
            </p>
            {renderNotes(r)}
            <p className="text-xs text-muted-foreground">
              Requested {new Date(r.createdAt).toLocaleString()}
            </p>
            {r.status === "PENDING" && (
              <div className="flex flex-wrap gap-2 pt-2">
                {ACTIONS.map((action) => (
                  <Button
                    key={action.status}
                    variant={action.status === "APPROVED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateStatus(r.id, action.status)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {selectedQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submitted GCash QR code"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedQr(null)}
        >
          <div className="relative max-h-[90vh] max-w-xl rounded-xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Close QR viewer"
              className="absolute right-2 top-2 bg-white"
              onClick={() => setSelectedQr(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img src={selectedQr} alt="GCash QR proof sent by resident" className="max-h-[82vh] w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
