"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, Check, SlidersHorizontal } from "lucide-react";
type DailyImpact = {
  day: string;
  records: number;
  weights: number[];
};

type MaterialSeries = {
  name: string;
  totalWeightKg: number;
};

type CommunityStats = {
  totalRecycledKg: number;
  totalResidents: number;
  verifiedRecords: number;
  dailyImpact: DailyImpact[];
  materials: MaterialSeries[];
};

const colors = ["#35a7ff", "#1dd6b5", "#fb6d73", "#976cff"];
const weightFormat = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});
const chart = {
  width: 1000,
  height: 480,
  left: 42,
  top: 50,
  plotRight: 790,
  plotBottom: 340,
  volumeTop: 365,
  volumeBottom: 430,
  profileRight: 982,
};

function ImpactChart({ stats }: { stats: CommunityStats }) {
  const points = stats.dailyImpact;
  const materials = stats.materials;
  const plotWidth = chart.plotRight - chart.left;
  const plotHeight = chart.plotBottom - chart.top;
  const maxWeight = Math.max(
    ...points.flatMap((point) => point.weights),
    1
  );
  const maxRecords = Math.max(...points.map((point) => point.records), 1);
  const xForIndex = (index: number) =>
    chart.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    return chart.top + (index / 4) * plotHeight;
  });
  const monthLabels = points.reduce<Array<{ label: string; x: number }>>(
    (labels, point, index) => {
      const label = new Date(`${point.day}T00:00:00`).toLocaleDateString(
        "en-PH",
        { month: "short" }
      );
      if (labels.at(-1)?.label !== label) {
        labels.push({ label, x: xForIndex(index) });
      }
      return labels;
    },
    []
  );
  const volumeBarWidth = Math.max(1.5, plotWidth / points.length - 1);
  const maxMaterialWeight = Math.max(
    ...materials.map((material) => material.totalWeightKg),
    1
  );

  return (
    <svg
      aria-label="Community recycling activity by material over the last 90 days"
      className="block h-auto w-full"
      role="img"
      viewBox={`0 0 ${chart.width} ${chart.height}`}
    >
      <defs>
        <linearGradient id="impact-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2476e8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#10182a" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((y) => (
        <line
          key={y}
          x1={chart.left}
          x2={chart.plotRight}
          y1={y}
          y2={y}
          stroke="#202c40"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 12 }, (_, index) => {
        const x = chart.left + (index / 11) * plotWidth;
        return (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={chart.top}
            y2={chart.volumeBottom}
            stroke="#182337"
            strokeWidth="1"
          />
        );
      })}

      <line
        x1={chart.plotRight + 15}
        x2={chart.plotRight + 15}
        y1={chart.top}
        y2={chart.volumeBottom}
        stroke="#344158"
        strokeWidth="1"
      />

      {points.map((point, index) => {
        const height = (point.records / maxRecords) * (chart.volumeBottom - chart.volumeTop);
        const previous = points[index - 1];
        const isUpDay = !previous || point.records >= previous.records;
        return (
          <rect
            key={`volume-${point.day}`}
            x={xForIndex(index) - volumeBarWidth / 2}
            y={chart.volumeBottom - height}
            width={volumeBarWidth}
            height={height}
            fill={isUpDay ? "#1a9e78" : "#d55362"}
            opacity="0.72"
          >
            <title>
              {point.day}: {point.records} verified{" "}
              {point.records === 1 ? "collection" : "collections"}
            </title>
          </rect>
        );
      })}

      {materials.map((material, seriesIndex) => {
        const color = colors[seriesIndex % colors.length];
        const linePoints = points
          .map((point, index) => {
            const weight = point.weights[seriesIndex] ?? 0;
            const x = xForIndex(index);
            const y =
              chart.plotBottom - (weight / maxWeight) * plotHeight;
            return `${x},${y}`;
          })
          .join(" ");
        const firstX = xForIndex(0);
        const lastX = xForIndex(points.length - 1);
        const firstY =
          chart.plotBottom -
          ((points[0]?.weights[seriesIndex] ?? 0) / maxWeight) * plotHeight;
        const lastY =
          chart.plotBottom -
          ((points.at(-1)?.weights[seriesIndex] ?? 0) / maxWeight) * plotHeight;

        return (
          <g key={material.name}>
            <polygon
              points={`${firstX},${chart.plotBottom} ${linePoints} ${lastX},${chart.plotBottom}`}
              fill="url(#impact-chart-fill)"
              opacity={seriesIndex === 0 ? 1 : 0}
            />
            <polyline
              fill="none"
              points={linePoints}
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.9"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {material.name}: {weightFormat.format(material.totalWeightKg)} kg over
                the last 90 days
              </title>
            </polyline>
            <circle cx={lastX} cy={lastY} fill={color} r="2.5" />
          </g>
        );
      })}

      {materials.map((material, index) => {
        const y = chart.top + 14 + index * 31;
        const width =
          (material.totalWeightKg / maxMaterialWeight) * (chart.profileRight - chart.plotRight - 34);
        return (
          <g key={`profile-${material.name}`}>
            <rect
              x={chart.plotRight + 24}
              y={y}
              width={chart.profileRight - chart.plotRight - 34}
              height="7"
              rx="2"
              fill="#1b2638"
            />
            <rect
              x={chart.profileRight - 10 - width}
              y={y}
              width={width}
              height="7"
              rx="2"
              fill={colors[index % colors.length]}
              opacity="0.85"
            >
              <title>
                {material.name}: {weightFormat.format(material.totalWeightKg)} kg
              </title>
            </rect>
          </g>
        );
      })}

      {monthLabels.map((month, index) => (
        <text
          key={`${month.label}-${index}`}
          x={month.x}
          y="462"
          fill="#8290a6"
          fontSize="13"
          textAnchor="middle"
        >
          {month.label}
        </text>
      ))}
    </svg>
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

  return (
    <section id="impact" className="px-4 py-20 sm:py-24">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Community impact
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {stats
                ? `${weightFormat.format(stats.totalRecycledKg)} kg`
                : error
                  ? "Impact data unavailable"
                  : "Loading community data"}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>
              {stats
                ? `${stats.verifiedRecords.toLocaleString("en-PH")} verified collections`
                : "Verified recycling activity"}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#202b3d] bg-[#0b1220] p-2 shadow-[0_24px_70px_-38px_rgba(9,16,32,0.8)] sm:p-4">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-1.5 text-[#8491a6]">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Last 90 days</span>
            </div>
            <div className="flex items-center gap-1">
              {[BarChart3, SlidersHorizontal].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#8491a6]"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          </div>
          {error ? (
            <p
              aria-live="polite"
              className="flex min-h-64 items-center justify-center px-4 text-sm text-rose-300"
            >
              {error}
            </p>
          ) : stats ? (
            stats.verifiedRecords === 0 || stats.materials.length === 0 ? (
              <p className="flex min-h-64 items-center justify-center px-4 text-center text-sm text-[#94a3b8]">
                {stats.verifiedRecords === 0
                  ? "No verified recycling records yet. Material trends will appear here as collections are recorded."
                  : "There are no verified collections in the last 90 days. New material trends will appear here when recycling is recorded."}
              </p>
            ) : (
              <ImpactChart stats={stats} />
            )
          ) : (
            <div
              aria-label="Loading community recycling data"
              className="aspect-[2/1] min-h-64 animate-pulse rounded-lg bg-[#111b2b]"
              role="status"
            />
          )}
          {stats && stats.verifiedRecords > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 pt-2">
              {stats.materials.map((material, index) => (
                <span
                  key={material.name}
                  className="inline-flex items-center gap-1.5 text-[11px] text-[#94a3b8]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  {material.name}
                </span>
              ))}
              <span className="text-[11px] text-[#64748b]">
                {stats.totalResidents.toLocaleString("en-PH")} residents
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
