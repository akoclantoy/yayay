"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
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
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedHeat = heatPoints.find((point) => point.id === selectedHeatId);

  const loadHeat = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/pickup/heat", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Could not load pickup activity.");
    const points = (await response.json()) as TupiMapPoint[];
    setHeatPoints(points);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadHeat(controller.signal).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not load pickup activity.");
      setLoading(false);
    });
    const events = new EventSource("/api/realtime");
    const refresh = () => {
      void loadHeat().catch((error: unknown) =>
        console.error("[pickup-map] Could not refresh activity:", error)
      );
    };
    events.addEventListener("invalidate", refresh);
    return () => {
      controller.abort();
      events.removeEventListener("invalidate", refresh);
      events.close();
    };
  }, [loadHeat]);

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
          onPointSelect={(id) => setSelectedHeatId(id)}
          height={390}
          interactive
          showHeat
        />
        {selectedHeat && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-950 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-200">
                <Activity className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Pickup activity nearby</h3>
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold dark:bg-orange-900/60">
                    {selectedHeat.value} pickups
                  </span>
                </div>
                <p className="mt-1 text-sm text-orange-900/80 dark:text-orange-100/80">
                  {selectedHeat.detail}
                </p>
                <p className="mt-2 text-xs text-orange-900/70 dark:text-orange-100/70">
                  Approximate cluster center: {selectedHeat.latitude.toFixed(3)}, {selectedHeat.longitude.toFixed(3)}.
                  This is an aggregated area, not an individual resident&apos;s address.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHeatId(null)}
                className="rounded-md px-2 py-1 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/60"
                aria-label="Close activity details"
              >
                Close
              </button>
            </div>
          </div>
        )}
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
