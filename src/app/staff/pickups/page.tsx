"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TupiMapClient } from "@/components/maps/tupi-map-client";
import type { TupiMapPoint } from "@/components/maps/tupi-map";
import { MessageCircle, MapPinned } from "lucide-react";
import Link from "next/link";
import { isWithinTupi } from "@/lib/tupi";

type Pickup = {
  id: string;
  address: string;
  status: string;
  scheduledDate: string | null;
  wasteNotes: string | null;
  latitude: number | null;
  longitude: number | null;
  assignedStaffId: string | null;
  assignedStaff: { name: string | null } | null;
  createdAt: string;
  user: { name: string | null; email: string; phone: string | null };
};

const STATUSES = ["PENDING", "APPROVED", "COLLECTED", "COMPLETED", "CANCELLED"];

export default function StaffPickupsPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadPickups = useCallback(async () => {
    const response = await fetch("/api/pickup", { cache: "no-store" });
    const data = (await response.json()) as Pickup[] | { error?: string };
    if (!response.ok || !Array.isArray(data)) {
      throw new Error(!Array.isArray(data) ? data.error ?? "Could not load pickups." : "Could not load pickups.");
    }
    setPickups(data);
    setLoadError("");
  }, []);

  useEffect(() => {
    void loadPickups()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not load pickups.";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
    const events = new EventSource("/api/realtime");
    const refresh = () => {
      void loadPickups().catch((error: unknown) => {
        console.error("[staff-pickups] Could not refresh pickups:", error);
      });
    };
    events.addEventListener("invalidate", refresh);
    return () => {
      events.removeEventListener("invalidate", refresh);
      events.close();
    };
  }, [loadPickups]);

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch("/api/pickup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = (await res.json()) as { assignedStaffId: string | null };
      setPickups((prev) => prev.map((p) => (p.id === id ? {
        ...p,
        status,
        assignedStaffId: updated.assignedStaffId,
        assignedStaff: updated.assignedStaffId ? { name: "You" } : null,
      } : p)));
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error("Update failed");
    }
  }

  const mapPoints: TupiMapPoint[] = pickups.flatMap((pickup) => {
    if (
      pickup.latitude === null ||
      pickup.longitude === null ||
      !isWithinTupi(pickup.latitude, pickup.longitude)
    ) return [];
    return [{
      id: pickup.id,
      name: pickup.user.name ?? pickup.user.email,
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      detail: `${pickup.status} · ${pickup.address}`,
      kind: "pickup",
    }];
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Pickups</h1>
        <p className="text-muted-foreground">Review and update pickup requests across Tupi, South Cotabato.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary" /> Pickup locations in Tupi
          </CardTitle>
          <p className="text-sm text-muted-foreground">Exact pickup pins are visible only to authorized pickup staff and admins.</p>
        </CardHeader>
        <CardContent>
          <TupiMapClient points={mapPoints} height={400} />
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : loadError ? (
        <Card><CardContent className="py-12 text-center text-destructive">{loadError}</CardContent></Card>
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
                {p.assignedStaff && <p className="text-xs text-muted-foreground">Assigned to {p.assignedStaff.name ?? "staff"}</p>}
                {p.wasteNotes && <p className="text-muted-foreground">{p.wasteNotes}</p>}
                {p.scheduledDate && (
                  <p>Scheduled: {new Date(p.scheduledDate).toLocaleString()}</p>
                )}
                <Link
                  href={`/staff/messages?pickupId=${encodeURIComponent(p.id)}`}
                  className="inline-flex items-center gap-2 pt-1 font-medium text-primary hover:underline"
                >
                  <MessageCircle className="h-4 w-4" /> Open pickup conversation
                </Link>
                <p className="text-xs text-muted-foreground">
                  Requested {new Date(p.createdAt).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {!p.assignedStaffId && p.status !== "CANCELLED" && (
                    <Button variant="default" size="sm" onClick={() => updateStatus(p.id, p.status)}>
                      Assign to me
                    </Button>
                  )}
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
