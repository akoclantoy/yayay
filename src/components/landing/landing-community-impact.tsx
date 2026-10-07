"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Leaf,
  Recycle,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPoints } from "@/lib/utils";

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
  carbonSavedKg: number;
  totalPoints: number;
  totalResidents: number;
  averageResidentScore: number;
  monthlyChangePercent: number | null;
  verifiedRecords: number;
  dailyImpact: DailyImpact[];
  materials: MaterialSeries[];
  materialBreakdown: MaterialSeries[];
};

type ActivityBucket = {
  startDay: string;
  endDay: string;
  weightKg: number;
  records: number;
};

const numberFormat = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});

const preciseNumberFormat = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 1,
});

function formatDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function groupActivityByNineDays(days: DailyImpact[]): ActivityBucket[] {
  const buckets: ActivityBucket[] = [];

  for (let index = 0; index < days.length; index += 9) {
    const group = days.slice(index, index + 9);
    if (group.length === 0) continue;

    buckets.push({
      startDay: group[0].day,
      endDay: group[group.length - 1].day,
      weightKg: group.reduce(
        (total, day) =>
          total + day.weights.reduce((daily, weight) => daily + weight, 0),
        0
      ),
      records: group.reduce((total, day) => total + day.records, 0),
    });
  }

  return buckets;
}

function monthChangeLabel(change: number | null) {
  if (change === null) return "No previous-month activity to compare yet";
  if (change === 0) return "No change from the same period last month";
  const direction = change > 0 ? "more" : "less";
  return `${preciseNumberFormat.format(Math.abs(change))}% ${direction} than the same period last month`;
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

  const activity = useMemo(
    () => groupActivityByNineDays(stats?.dailyImpact ?? []),
    [stats]
  );
  const maxActivity = Math.max(
    ...activity.map((bucket) => bucket.weightKg),
    1
  );
  const monthlyChange = stats?.monthlyChangePercent ?? 0;

  const detailCards = [
    {
      icon: Leaf,
      label: "Carbon emissions avoided",
      value: stats
        ? `${preciseNumberFormat.format(stats.carbonSavedKg)} kg`
        : "—",
      detail:
        "Estimated CO₂ savings calculated from each material’s recorded carbon factor.",
    },
    {
      icon: BadgeCheck,
      label: "Verified collections",
      value: stats ? formatPoints(stats.verifiedRecords) : "—",
      detail:
        "Recycling records confirmed by collection staff and included in the impact totals.",
    },
    {
      icon: Recycle,
      label: "Reward points earned",
      value: stats ? formatPoints(stats.totalPoints) : "—",
      detail:
        "Points awarded to residents for the verified materials they recycled.",
    },
    {
      icon: Users,
      label: "Residents in the program",
      value: stats ? formatPoints(stats.totalResidents) : "—",
      detail:
        "Residents with an account in EcoRewards; this is not limited to recent recyclers.",
    },
  ];

  return (
    <section id="impact" className="px-4 py-20 sm:py-24">
      <div className="container mx-auto max-w-5xl">
        <header className="mb-9 text-center sm:mb-11">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Real records. Shared progress.
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Community impact
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            See how much verified recycling our community has collected, how
            activity is changing, and the environmental benefits those records
            represent.
          </p>
        </header>

        <div className="relative mb-12 px-0 pb-5 sm:px-7">
          <article
            aria-labelledby="community-impact-total"
            className="relative isolate h-[355px] overflow-hidden rounded-[24px] bg-[#153f32] px-6 pb-7 pt-7 text-white shadow-[0_24px_70px_-35px_rgba(13,50,37,0.55)] sm:h-[380px] sm:px-8 sm:pt-8"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-[38px] -top-[116px] h-[250px] w-[250px] rounded-full border-[22px] border-[#d7e4dc]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-5 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#f0b943] text-[#382807] sm:right-8 sm:top-8"
            >
              <Sparkles className="h-5 w-5" strokeWidth={1.8} />
            </div>

            <div className="relative z-10">
              <p className="text-sm font-medium text-[#c1d7ce]">
                Total community recycling
              </p>
              <h3
                className="mt-1 text-[34px] font-semibold leading-tight tracking-tight sm:text-[38px]"
                id="community-impact-total"
              >
                {error
                  ? "Data unavailable"
                  : stats
                    ? `${numberFormat.format(stats.totalRecycledKg)} kg`
                    : "Loading impact…"}
              </h3>
              {error ? (
                <p aria-live="polite" className="mt-1 text-sm text-rose-200">
                  {error}
                </p>
              ) : (
                <p
                  className={`mt-1 flex max-w-[75%] items-center gap-1 text-sm font-medium ${
                    monthlyChange < 0
                      ? "text-[#ffd0ca]"
                      : "text-[#c6eb83]"
                  }`}
                  title="Compares this month so far with the same number of days from last month."
                >
                  {stats?.monthlyChangePercent === null ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : monthlyChange < 0 ? (
                    <ArrowDownRight className="h-4 w-4 shrink-0" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {stats
                      ? monthChangeLabel(stats.monthlyChangePercent)
                      : "Month-to-date comparison"}
                  </span>
                </p>
              )}
            </div>

            {stats &&
            stats.verifiedRecords > 0 &&
            stats.materials.length > 0 ? (
              <>
                <div
                  aria-label="Verified recycling weight in ten consecutive nine-day periods"
                  className="absolute inset-x-6 bottom-[82px] flex h-[118px] items-end gap-2 border-b border-[#c1d7ce]/90 sm:inset-x-8 sm:gap-2.5"
                  role="img"
                >
                  {activity.map((bucket, index) => (
                    <div
                      key={bucket.startDay}
                      aria-label={`${formatDate(bucket.startDay)} to ${formatDate(bucket.endDay)}: ${preciseNumberFormat.format(bucket.weightKg)} kilograms in ${bucket.records} verified collections`}
                      className="min-w-0 flex-1 rounded-t-[6px] bg-[#86b440] transition-colors hover:bg-[#a1ce56]"
                      style={{
                        height: `${Math.max(
                          (bucket.weightKg / maxActivity) * 100,
                          bucket.weightKg > 0 ? 8 : 0
                        )}%`,
                        opacity: 0.5 + (index / Math.max(activity.length - 1, 1)) * 0.5,
                      }}
                      title={`${formatDate(bucket.startDay)}–${formatDate(bucket.endDay)}: ${preciseNumberFormat.format(bucket.weightKg)} kg recycled · ${bucket.records} verified collections`}
                    />
                  ))}
                </div>
                <p className="absolute bottom-[61px] left-6 text-[10px] text-[#c1d7ce]/80 sm:left-8">
                  Each bar = 9 days · hover a bar for its total
                </p>
              </>
            ) : (
              <div className="absolute inset-x-6 bottom-[82px] flex h-[118px] items-center justify-center rounded-xl border border-dashed border-[#c1d7ce]/40 px-4 text-center text-sm text-[#d0e0d8] sm:inset-x-8">
                {error
                  ? "Recycling activity could not be loaded. Please try again later."
                  : stats?.verifiedRecords
                    ? "No verified recycling collections were recorded in the last 90 days."
                    : "No verified recycling collections have been recorded yet."}
              </div>
            )}

            <div className="absolute bottom-7 right-6 flex items-center gap-2 text-sm font-semibold sm:right-8">
              <Check className="h-[17px] w-[17px] text-[#c6eb83]" />
              <span>Verified collections</span>
              {stats && (
                <span className="text-[#c1d7ce]">
                  {formatPoints(stats.verifiedRecords)}
                </span>
              )}
            </div>
          </article>

          <div className="absolute bottom-0 left-[-3px] z-20 rounded-tr-[20px] bg-white px-4 pb-3 pt-3 text-[#153f32] shadow-[8px_-5px_22px_-18px_rgba(13,50,37,0.65)] dark:bg-[#173028] dark:text-[#edf5ed] sm:left-0">
            <p className="text-xs font-medium text-[#60756b] dark:text-[#9ab2a4]">
              Average resident score
            </p>
            <p className="mt-1 text-lg font-bold leading-none">
              {stats ? formatPoints(stats.averageResidentScore) : "—"}
              <span className="ml-1 text-xs font-medium text-[#60756b] dark:text-[#9ab2a4]">
                / 1000
              </span>
            </p>
          </div>
        </div>

        <section aria-labelledby="impact-details-title" className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold" id="impact-details-title">
              What these numbers mean
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              These totals come from verified, non-deleted recycling records.
              Carbon savings use the saved estimate for each waste category.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {detailCards.map((item) => (
              <Card key={item.label} className="h-full">
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gradient">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="mb-4">
                <h3 className="font-semibold">Recycling by material</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Weight collected for each material over the last 90 days.
                  Percentages show each material&apos;s share of the period&apos;s
                  total.
                </p>
              </div>
              {stats?.materialBreakdown.length ? (
                <div className="space-y-4">
                  {stats.materialBreakdown.map((material, index) => {
                    const totalRecentWeight = stats.materialBreakdown.reduce(
                      (total, item) => total + item.totalWeightKg,
                      0
                    );
                    const share =
                      totalRecentWeight > 0
                        ? (material.totalWeightKg / totalRecentWeight) * 100
                        : 0;

                    return (
                      <div key={material.name}>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{material.name}</span>
                          <span className="text-muted-foreground">
                            {preciseNumberFormat.format(material.totalWeightKg)}{" "}
                            kg · {share.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          aria-label={`${material.name}: ${share.toFixed(1)} percent of recent recycling weight`}
                          className="h-2 overflow-hidden rounded-full bg-muted"
                          role="img"
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${share}%`,
                              backgroundColor:
                                ["#35a7ff", "#1dd6b5", "#fb6d73", "#976cff"][
                                  index % 4
                                ],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Material breakdown will appear after verified recycling is
                  recorded in the last 90 days.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </section>
  );
}
