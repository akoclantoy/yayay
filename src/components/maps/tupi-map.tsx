"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { LatLngBounds, type LeafletMouseEvent } from "leaflet";
import { isWithinTupi, TUPI_BOUNDARY, TUPI_BOUNDS, TUPI_CENTER } from "@/lib/tupi";

export type TupiMapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  value?: number;
  detail?: string;
  details?: string[];
  kind?: "barangay" | "pickup" | "heat";
};

function getBounds() {
  return new LatLngBounds(TUPI_BOUNDS[0], TUPI_BOUNDS[1]);
}

function MapInteractions({
  onSelect,
  selected,
}: {
  onSelect?: (latitude: number, longitude: number) => void;
  selected?: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selected) {
      map.flyTo(selected, Math.max(map.getZoom(), 15), { duration: 0.7 });
    }
  }, [map, selected]);

  useMapEvents({
    click(event: LeafletMouseEvent) {
      if (onSelect && isWithinTupi(event.latlng.lat, event.latlng.lng)) {
        onSelect(event.latlng.lat, event.latlng.lng);
      }
    },
  });

  return null;
}

function pointColor(point: TupiMapPoint) {
  if (point.kind === "pickup") return "#2563eb";
  if (point.kind === "heat") return "#f97316";
  return "#16a34a";
}

function pointRadius(point: TupiMapPoint, maxValue: number) {
  if (point.kind === "heat") {
    return Math.min(34, 13 + Math.log2((point.value ?? 1) + 1) * 4);
  }
  if (point.kind === "barangay") {
    return Math.min(24, 9 + ((point.value ?? 0) / Math.max(maxValue, 1)) * 12);
  }
  return 9;
}

export function TupiLeafletMap({
  points = [],
  selected,
  onSelect,
  onPointSelect,
  height = 420,
  interactive = false,
  showHeat = false,
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
  const maxValue = Math.max(
    ...points.filter((point) => point.kind === "barangay").map((point) => point.value ?? 0),
    1
  );

  return (
    <div
      className={`relative isolate overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-inner ${className ?? ""}`}
      style={{ height }}
      aria-label="Interactive map of Tupi, South Cotabato"
    >
      <MapContainer
        center={TUPI_CENTER}
        zoom={12}
        minZoom={11}
        maxZoom={18}
        maxBounds={getBounds()}
        maxBoundsViscosity={1}
        scrollWheelZoom={interactive}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapInteractions onSelect={onSelect} selected={selected} />
        <Polygon
          positions={TUPI_BOUNDARY}
          pathOptions={{ color: "#047857", weight: 3, fill: false, dashArray: "7 6" }}
        />
        {points.map((point) => {
          const radius = pointRadius(point, maxValue);
          const color = pointColor(point);
          const isHeat = point.kind === "heat";
          if (isHeat && !showHeat) return null;
          return (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={radius}
              pathOptions={{
                color,
                weight: isHeat ? 1 : 2,
                fillColor: color,
                fillOpacity: isHeat ? 0.22 : 0.8,
              }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent.stopPropagation();
                  onPointSelect?.(point.id);
                },
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{point.name}</p>
                  {point.detail && <p>{point.detail}</p>}
                  {point.details?.map((detail) => <p key={detail}>{detail}</p>)}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
        {selected && (
          <CircleMarker
            center={selected}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#0f766e",
              fillOpacity: 1,
            }}
          >
            <Popup>Selected pickup location</Popup>
          </CircleMarker>
        )}
      </MapContainer>
      {onSelect && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur">
          Click anywhere within Tupi to pin your pickup location
        </div>
      )}
    </div>
  );
}
