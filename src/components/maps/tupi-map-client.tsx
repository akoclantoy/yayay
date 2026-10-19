"use client";

import dynamic from "next/dynamic";
import type { TupiMapPoint } from "@/components/maps/tupi-map";

const TupiLeafletMap = dynamic(
  () =>
    import("@/components/maps/tupi-map").then(
      (module) => module.TupiLeafletMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-2xl border bg-muted" />
    ),
  }
);

export function TupiMapClient({
  points,
  selected,
  onSelect,
  onPointSelect,
  height,
  interactive,
  showHeat,
  className,
}: {
  points?: TupiMapPoint[];
  selected?: [number, number] | null;
  onSelect?: (latitude: number, longitude: number) => void;
  onPointSelect?: (id: string) => void;
  height?: number;
  interactive?: boolean;
  showHeat?: boolean;
  className?: string;
}) {
  return (
    <TupiLeafletMap
      points={points}
      selected={selected}
      onSelect={onSelect}
      onPointSelect={onPointSelect}
      height={height}
      interactive={interactive}
      showHeat={showHeat}
      className={className}
    />
  );
}
