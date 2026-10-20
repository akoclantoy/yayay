"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Building2,
  Clock3,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Recycle,
  Scale,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TupiMapClient } from "@/components/maps/tupi-map-client";
import type { TupiMapPoint } from "@/components/maps/tupi-map";
import { TUPI_CENTER } from "@/lib/tupi";
import { cn } from "@/lib/utils";

export type CenterSummary = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  openHours: string | null;
  capacityKg: number | null;
  isActive: boolean;
  barangay: { name: string } | null;
  _count: { recyclingRecords: number };
};

const MUNICIPAL_HALL_ID = "seed-center-001";

const MUNICIPAL_HALL_CENTER: CenterSummary = {
  id: MUNICIPAL_HALL_ID,
  name: "Tupi Municipal Hall Collection Center",
  description: "Community recycling center at Tupi Municipal Hall.",
  address: "Municipal Hall, Poblacion, Tupi, South Cotabato",
  latitude: TUPI_CENTER[0],
  longitude: TUPI_CENTER[1],
  phone: null,
  openHours: "Mon-Sat 8AM-5PM",
  capacityKg: 5000,
  isActive: true,
  barangay: { name: "Poblacion" },
  _count: { recyclingRecords: 0 },
};

function distanceInKm(
  first: [number, number],
  second: [number, number],
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [latitude1, longitude1] = first.map(radians);
  const [latitude2, longitude2] = second.map(radians);
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = longitude2 - longitude1;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapsDirectionsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function CentersDirectory({
  centers,
  audience,
}: {
  centers: CenterSummary[];
  audience: "admin" | "resident";
}) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const municipalHall = centers.find(
    (center) =>
      center.id === MUNICIPAL_HALL_ID ||
      center.name.toLowerCase().includes("tupi municipal hall"),
  ) ?? MUNICIPAL_HALL_CENTER;
  const allCenters = centers.some((center) => center.id === municipalHall.id)
    ? centers
    : [...centers, municipalHall];
  const visibleCenters = audience === "resident"
    ? allCenters.filter((center) => center.isActive)
    : allCenters;
  const sortedCenters = userLocation
    ? [...visibleCenters].sort((first, second) =>
      distanceInKm(userLocation, [first.latitude, first.longitude]) -
      distanceInKm(userLocation, [second.latitude, second.longitude]),
    )
    : visibleCenters;
  const mapPoints: TupiMapPoint[] = visibleCenters.map((center) => ({
    id: center.id,
    name: center.name,
    latitude: center.latitude,
    longitude: center.longitude,
    kind: center.isActive ? "center" : "center-inactive",
    details: [
      center.address,
      center.barangay ? `Barangay: ${center.barangay.name}` : null,
      center.openHours ? `Hours: ${center.openHours}` : null,
      center.phone ? `Phone: ${center.phone}` : null,
      center.capacityKg !== null ? `Capacity: ${center.capacityKg.toLocaleString()} kg` : null,
      `Recycling records: ${center._count.recyclingRecords.toLocaleString()}`,
      center.isActive ? "Active" : "Inactive",
    ].filter((value): value is string => Boolean(value)),
  }));

  function findNearbyCenters() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location services are not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation([coords.latitude, coords.longitude]),
      () => setLocationError("Your location could not be accessed. Check browser permissions and try again."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Tupi, South Cotabato
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {audience === "admin" ? "Collection Centers" : "Nearby Centers"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibleCenters.length} {visibleCenters.length === 1 ? "center" : "centers"}{" "}
            {audience === "resident" ? "available in your community" : "on the Tupi map"}
          </p>
        </div>
        {audience === "resident" && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button type="button" variant="outline" onClick={findNearbyCenters}>
              <Navigation className="h-4 w-4" />
              {userLocation ? "Refresh my location" : "Find centers near me"}
            </Button>
            {locationError && <p role="alert" className="max-w-sm text-xs text-destructive">{locationError}</p>}
            {userLocation && <p className="text-xs text-muted-foreground">Sorted by distance from your location.</p>}
          </div>
        )}
      </header>

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-64 sm:min-h-80 lg:min-h-[360px]">
            <Image
              src="/tupi-municipal-hall.png"
              alt="Tupi Municipal Hall and its landscaped courtyard"
              fill
              fetchPriority="high"
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 text-white sm:p-7">
              <Badge className="border-white/20 bg-white/15 text-white backdrop-blur">
                Featured location
              </Badge>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Tupi Municipal Hall</h2>
              <p className="mt-1 text-sm text-white/85">Poblacion, Tupi, South Cotabato</p>
            </div>
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-7">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.13em]">Municipal Hall Center</span>
            </div>
            <h3 className="mt-3 text-xl font-bold">{municipalHall.name}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {municipalHall.description ?? "Community recycling center at Tupi Municipal Hall."}
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{municipalHall.address}</span>
              </p>
              <p className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{municipalHall.openHours ?? "Operating hours not listed"}</span>
              </p>
              <p className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{municipalHall.phone ?? "Phone number not listed"}</span>
              </p>
              <p className="flex items-start gap-2">
                <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {municipalHall.capacityKg !== null
                    ? `Capacity: ${municipalHall.capacityKg.toLocaleString()} kg`
                    : "Capacity not listed"}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Recycle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{municipalHall._count.recyclingRecords.toLocaleString()} recorded recycling transactions</span>
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Badge variant={municipalHall.isActive ? "success" : "warning"}>
                {municipalHall.isActive ? "Active center" : "Currently inactive"}
              </Badge>
              <a
                href={mapsDirectionsUrl(municipalHall.latitude, municipalHall.longitude)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Get directions <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </Card>

      <section className="space-y-3" aria-labelledby="centers-map-heading">
        <div>
          <h2 id="centers-map-heading" className="text-lg font-bold">Center locations</h2>
          <p className="text-sm text-muted-foreground">Select a map pin to review its center details.</p>
        </div>
        <TupiMapClient points={mapPoints} height={480} interactive />
      </section>

      <section className="space-y-3" aria-labelledby="all-centers-heading">
        <div>
          <h2 id="all-centers-heading" className="text-lg font-bold">
            {audience === "resident" ? "Available centers" : "Center directory"}
          </h2>
          {userLocation && (
            <p className="text-sm text-muted-foreground">Nearest collection centers are listed first.</p>
          )}
        </div>
        {sortedCenters.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedCenters.map((center, index) => {
              const distance = userLocation
                ? distanceInKm(userLocation, [center.latitude, center.longitude])
                : null;
              return (
                <Card key={center.id} className={cn(
                  "flex flex-col",
                  center.id === municipalHall.id && "border-primary/30",
                )}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <MapPin className="h-5 w-5" />
                        </span>
                        <div>
                          <CardTitle className="text-base">{center.name}</CardTitle>
                          {center.barangay && (
                            <p className="mt-1 text-xs text-primary">{center.barangay.name}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={center.isActive ? "success" : "warning"}>
                        {center.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    {center.description && (
                      <p className="leading-5 text-muted-foreground">{center.description}</p>
                    )}
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{center.address}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{center.openHours ?? "Hours not listed"}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{center.phone ?? "Phone not listed"}</span>
                    </p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <span>{center._count.recyclingRecords.toLocaleString()} recycling records</span>
                      {distance !== null ? (
                        <span>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</span>
                      ) : center.capacityKg !== null ? (
                        <span>{center.capacityKg.toLocaleString()} kg capacity</span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
                        {userLocation ? ` · #${index + 1} nearest` : ""}
                      </span>
                      <a
                        href={mapsDirectionsUrl(center.latitude, center.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Get directions to ${center.name}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Directions <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No centers are currently available.</CardContent></Card>
        )}
      </section>
    </div>
  );
}
