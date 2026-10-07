"use client";

import { useEffect, useState } from "react";
import { Leaf, Recycle, Users, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPoints, formatWeight } from "@/lib/utils";

type DailyImpact = {
  day: string;
  weightKg: number;
  records: number;
};

type CommunityStats = {
  totalResidents: number;
  totalRecycledKg: number;
  carbonSavedKg: number;
  verifiedRecords: number;
  dailyImpact: DailyImpact[];
};

const chartWidth = 720;
const chartHeight = 240;
const chartPadding = { top: 18, right: 12, bottom: 30, left: 12 };

function CommunityChart({ data }: { data: DailyImpact[] }) {
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const maxWeight = Math.max(...data.map((item) => item.weightKg), 1);
  const maxRecords = Math.max(...data.map((item) => item.records), 1);
  const points = data.map((item, index) => {
    const x =
      chartPadding.left +
      (index / Math.max(data.length - 1, 1)) * plotWidth;
    const y =
      chartPadding.top + plotHeight - (item.weightKg / maxWeight) * plotHeight;

    return { ...item, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    `${chartPadding.left},${chartPadding.top + plotHeight}`,
    linePoints,
    `${chartPadding.left + plotWidth},${chartPadding.top + plotHeight}`,
  ].join(" ");
  const step = plotWidth / Math.max(points.length - 1, 1);
  const labelIndices = [0, 7, 14, 21, 29].filter((index) => index < data.length);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-[#080f1d] p-3 sm:p-5">
      <svg
        aria-label="Verified recycling weight and collection count by day for the last 30 days"
        className="block h-auto w-full"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <defs>
          <linearGradient id="community-impact-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = chartPadding.top + fraction * plotHeight;
          return (
            <line
              key={fraction}
              x1={chartPadding.left}
              x2={chartPadding.left + plotWidth}
              y1={y}
              y2={y}
              stroke="#263348"
              strokeDasharray={fraction === 1 ? undefined : "2 5"}
              strokeWidth="1"
            />
          );
        })}

        {points.map((point) => {
          const barHeight = (point.records / maxRecords) * 22;
          return (
            <rect
              key={point.day}
              x={point.x - Math.max(2, step * 0.18)}
              y={chartPadding.top + plotHeight - barHeight}
              width={Math.max(4, step * 0.36)}
              height={barHeight}
              fill="#34d399"
              opacity="0.48"
            >
              <title>
                {point.day}: {point.records} verified{" "}
                {point.records === 1 ? "record" : "records"}
              </title>
            </rect>
          );
        })}

        <polygon points={areaPoints} fill="url(#community-impact-fill)" />
        <polyline
          fill="none"
          points={linePoints}
          stroke="#3b82f6"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point) => (
          <circle
            key={`point-${point.day}`}
            cx={point.x}
            cy={point.y}
            r="2"
            fill="#93c5fd"
          >
            <title>
              {point.day}: {formatWeight(point.weightKg)} recycled
            </title>
          </circle>
        ))}
        {labelIndices.map((index) => {
          const point = points[index];
          return (
            <text
              key={`label-${point.day}`}
              x={point.x}
              y={chartHeight - 6}
              fill="#94a3b8"
              fontSize="10"
              textAnchor={
                index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"
              }
            >
              {new Date(`${point.day}T00:00:00`).toLocaleDateString("en-PH", {
                month: "short",
                day: "numeric",
              })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function LandingCommunityImpact() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/stats/public", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Unable to load community impact.");
        }
        return (await response.json()) as CommunityStats;
      })
      .then(setStats)
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load community impact."
        );
      });

    return () => controller.abort();
  }, []);

  const cards = [
    {
      icon: Recycle,
      label: "Verified recycling",
      value: stats ? formatWeight(stats.totalRecycledKg) : "—",
      detail: "Total weight recorded",
    },
    {
      icon: Leaf,
      label: "Carbon saved",
      value: stats ? formatWeight(stats.carbonSavedKg) : "—",
      detail: "CO₂ equivalent",
    },
    {
      icon: Users,
      label: "Residents",
      value: stats ? formatPoints(stats.totalResidents) : "—",
      detail: "Registered in the program",
    },
    {
      icon: BadgeCheck,
      label: "Verified collections",
      value: stats ? formatPoints(stats.verifiedRecords) : "—",
      detail: "Confirmed recycling records",
    },
  ];

  return (
    <section id="impact" className="px-4 py-20 sm:py-24">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-10 text-center sm:mb-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Measured from real recycling records
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Community impact that <span className="text-gradient">matters</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Every number reflects verified recycling activity in the EcoRewards
            community.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((item) => (
            <Card
              key={item.label}
              className="transition-shadow duration-300 hover:shadow-xl"
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="truncate text-2xl font-bold text-gradient">
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border-slate-200/80 dark:border-slate-700/70">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h3 className="text-lg font-semibold">Recycling activity</h3>
                <p className="text-sm text-muted-foreground">
                  Verified weight per day · last 30 days
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-0.5 w-4 bg-blue-500" />
                  Weight recycled
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                  Verified records
                </span>
              </div>
            </div>
            {error ? (
              <p
                aria-live="polite"
                className="rounded-xl border border-red-300/60 bg-red-50 px-4 py-8 text-center text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
              >
                {error}
              </p>
            ) : stats ? (
              stats.verifiedRecords === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
                  <Recycle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">No verified recycling records yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Community impact will appear here as recycling is recorded.
                  </p>
                </div>
              ) : (
                <CommunityChart data={stats.dailyImpact} />
              )
            ) : (
              <div
                aria-label="Loading community recycling data"
                className="h-56 animate-pulse rounded-xl bg-muted"
                role="status"
              />
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Only verified, non-deleted recycling records are included.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
