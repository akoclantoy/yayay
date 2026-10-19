"use client";

import { useState } from "react";
import { Award, Building2, MapPinned, Recycle, Users } from "lucide-react";
import { TupiMapClient } from "@/components/maps/tupi-map-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPoints, formatWeight } from "@/lib/utils";

type BarangaySummary = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  residents: number;
  collections: number;
  recycledKg: number;
  pointsEarned: number;
};

export function BarangayImpactMap({
  barangays,
}: {
  barangays: BarangaySummary[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedBarangay = barangays.find((item) => item.id === selected);
  const rankedBarangays = [...barangays].sort(
    (left, right) => right.recycledKg - left.recycledKg
  );
  const selectedRank = rankedBarangays.findIndex((item) => item.id === selected) + 1;
  const averageKgPerResident = selectedBarangay && selectedBarangay.residents > 0
    ? selectedBarangay.recycledKg / selectedBarangay.residents
    : 0;
  const averageKgPerCollection = selectedBarangay && selectedBarangay.collections > 0
    ? selectedBarangay.recycledKg / selectedBarangay.collections
    : 0;
  const mapPoints = barangays.map((barangay) => ({
    id: barangay.id,
    name: barangay.name,
    latitude: barangay.latitude,
    longitude: barangay.longitude,
    value: barangay.recycledKg,
    details: [
      `${formatWeight(barangay.recycledKg)} recycled`,
      `${barangay.collections} collections`,
      `${formatPoints(barangay.residents)} registered residents`,
      `${formatPoints(barangay.pointsEarned)} points earned`,
    ],
    kind: "barangay" as const,
  }));

  return (
    <Card className="overflow-hidden border-emerald-900/10 bg-card shadow-lg">
      <CardHeader className="flex flex-col gap-3 border-b bg-gradient-to-r from-emerald-950 to-emerald-800 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge className="mb-2 border-white/20 bg-white/10 text-white hover:bg-white/10">
            TUPI · SOUTH COTABATO
          </Badge>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPinned className="h-5 w-5 text-lime-200" />
            Recycling activity map
          </CardTitle>
          <p className="mt-1 text-sm text-emerald-100/80">
            Select a barangay marker to inspect activity. Pins show approximate barangay locations.
          </p>
        </div>
        <div className="flex gap-4 text-sm text-emerald-50">
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{barangays.reduce((total, item) => total + item.residents, 0)} residents</span>
          <span className="flex items-center gap-1.5"><Recycle className="h-4 w-4" />{formatWeight(barangays.reduce((total, item) => total + item.recycledKg, 0))}</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,1fr)_290px]">
        <TupiMapClient
          points={mapPoints}
          selected={
            selectedBarangay
              ? [selectedBarangay.latitude, selectedBarangay.longitude]
              : null
          }
          height={500}
          onPointSelect={(id) => setSelected(id)}
        />
        <aside className="max-h-[500px] overflow-y-auto border-t bg-muted/20 p-4 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Barangay performance</h3>
            <span className="text-xs text-muted-foreground">{barangays.length} areas</span>
          </div>
          {selectedBarangay && (
            <div className="mb-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{selectedBarangay.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedBarangay.address}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  #{selectedRank} by weight
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background/80 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Recycled</p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">
                    {formatWeight(selectedBarangay.recycledKg)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/80 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Points earned</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {formatPoints(selectedBarangay.pointsEarned)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/80 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Registered residents</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {formatPoints(selectedBarangay.residents)}
                  </p>
                </div>
                <div className="rounded-lg bg-background/80 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Collections logged</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {formatPoints(selectedBarangay.collections)}
                  </p>
                </div>
              </div>
              <div className="space-y-2 border-t border-primary/10 pt-3 text-xs">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Average per resident</span>
                  <span className="font-medium">{formatWeight(averageKgPerResident)}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Average per collection</span>
                  <span className="font-medium">{formatWeight(averageKgPerCollection)}</span>
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Award className="h-3.5 w-3.5" />
                  Map marker size represents total recycled weight.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {rankedBarangays.map((barangay, index) => (
              <button
                key={barangay.id}
                type="button"
                onClick={() => setSelected(barangay.id)}
                aria-pressed={selected === barangay.id}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected === barangay.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 bg-background hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                      {index + 1}
                    </span>
                    <span className="truncate">{barangay.name}</span>
                  </span>
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-2 flex justify-between pl-8 text-xs text-muted-foreground">
                  <span>{barangay.residents} residents</span>
                  <span>{formatWeight(barangay.recycledKg)}</span>
                </div>
                <div className="mt-2 pl-8 text-[11px] text-muted-foreground">
                  {formatPoints(barangay.collections)} collections · {formatPoints(barangay.pointsEarned)} points
                </div>
              </button>
            ))}
          </div>
        </aside>
      </CardContent>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-600" /> Larger markers indicate more recycling</span>
        <span>Map tiles © OpenStreetMap contributors</span>
      </div>
    </Card>
  );
}
