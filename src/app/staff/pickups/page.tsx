"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Pickup = {
  id: string;
  address: string;
  status: string;
  scheduledDate: string | null;
  wasteNotes: string | null;
  createdAt: string;
  user: { name: string | null; email: string; phone: string | null };
};

const STATUSES = ["PENDING", "APPROVED", "COLLECTED", "COMPLETED", "CANCELLED"];

export default function StaffPickupsPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pickup")
      .then((r) => r.json())
      .then(setPickups)
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch("/api/pickup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
      setPickups((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error("Update failed");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Manage Pickups</h1>
        <p className="text-muted-foreground">Review and update pickup requests</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : pickups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No pickup requests</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {pickups.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{p.user.name ?? p.user.email}</CardTitle>
                  <Badge>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{p.address}</p>
                {p.wasteNotes && <p className="text-muted-foreground">{p.wasteNotes}</p>}
                {p.scheduledDate && (
                  <p>Scheduled: {new Date(p.scheduledDate).toLocaleString()}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Requested {new Date(p.createdAt).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {STATUSES.filter((s) => s !== p.status).map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => updateStatus(p.id, s)}>
                      Mark {s.toLowerCase()}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
