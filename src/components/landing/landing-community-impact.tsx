"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Leaf,
  Recycle,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPoints } from "@/lib/utils";
import { VerifiedRecyclingChart } from "@/components/landing/verified-recycling-chart";

type MaterialSeries = {
  name: string;
  totalWeightKg: number;
};

type CommunityStats = {
  totalRecycledKg: number;
  carbonSavedKg: number;
  totalPoints: number;
  totalResidents: number;
  averageResidentScore: number | null;
  scoredResidentCount: number;
  monthlyChangePercent: number | null;
  verifiedRecords: number;
  materials: MaterialSeries[];
  materialBreakdown: MaterialSeries[];
};

const preciseNumberFormat = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 1,
});

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
    {
      icon: Users,
      label: "Average resident score",
      value:
        stats?.averageResidentScore !== null && stats?.averageResidentScore !== undefined
          ? new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(stats.averageResidentScore)
          : "—",
      detail: stats
        ? `Environmental score average across ${formatPoints(stats.scoredResidentCount)} residents.`
        : "Environmental score average across residents with recorded scores.",
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
          {error && (
            <p role="status" className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Some community impact details are unavailable right now.
            </p>
          )}
        </header>

        <div className="relative mb-12 px-0 pb-5 sm:px-7">
          <VerifiedRecyclingChart />
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
