"use client";

import { useEffect, useState } from "react";
import { LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { TupiMapClient } from "@/components/maps/tupi-map-client";
import type { TupiMapPoint } from "@/components/maps/tupi-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPoints } from "@/lib/utils";
import { isWithinTupi } from "@/lib/tupi";

export function PickupLocationPicker({
  value,
  onChange,
}: {
  value: [number, number] | null;
  onChange: (location: [number, number]) => void;
}) {
  const [heatPoints, setHeatPoints] = useState<TupiMapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pickup/heat", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load pickup activity.");
        return response.json() as Promise<TupiMapPoint[]>;
      })
      .then(setHeatPoints)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        toast.error(error instanceof Error ? error.message : "Could not load pickup activity.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  function selectLocation(latitude: number, longitude: number) {
    if (!isWithinTupi(latitude, longitude)) {
      toast.error("Please select a location within Tupi.");
      return;
    }
    onChange([latitude, longitude]);
  }

  return (
    <Card className="overflow-hidden border-emerald-900/10 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-emerald-950 to-emerald-800 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-200">
              Tupi, South Cotabato
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-lime-200" />
              Pin your collection point
            </CardTitle>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">
            Map required
          </span>
        </div>
        <p className="text-sm text-emerald-100/80">
          Click your home or preferred pickup spot. The map is limited to Tupi.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <TupiMapClient
          points={heatPoints}
          selected={value}
          onSelect={selectLocation}
          height={390}
          interactive
          showHeat
        />
        <div className="flex flex-col justify-between gap-3 rounded-xl border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            {value ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">Location pinned in Tupi</span>
                <span className="text-xs text-muted-foreground">
                  {value[0].toFixed(5)}, {value[1].toFixed(5)}
                </span>
              </>
            ) : (
              <>
                <LocateFixed className="h-4 w-4 text-amber-600" />
                <span className="text-muted-foreground">Choose a point on the map to continue.</span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {loading
              ? "Loading neighborhood activity…"
              : `${formatPoints(heatPoints.reduce((total, point) => total + (point.value ?? 0), 0))} pickups in activity clusters`}
          </span>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          Orange circles show recent clusters (3 or more pickups per roughly 600 m area) from the last 90 days. The heat layer is aggregated and does not reveal other residents&apos; addresses.
        </p>
      </CardContent>
    </Card>
  );
}
