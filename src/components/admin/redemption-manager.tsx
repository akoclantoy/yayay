"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPoints } from "@/lib/utils";

type Redemption = {
  id: string;
  points: number;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string };
  reward: { name: string };
};

const ACTIONS = [
  { label: "Approve", status: "APPROVED" },
  { label: "Reject", status: "REJECTED" },
] as const;

export function RedemptionManager({ initial }: { initial: Redemption[] }) {
  const [redemptions, setRedemptions] = useState(initial);

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
      {redemptions.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start gap-4">
              <CardTitle className="text-base">{r.reward.name}</CardTitle>
              <Badge>{r.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {r.user.name ?? r.user.email} · {formatPoints(r.points)} pts
            </p>
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
    </div>
  );
}
