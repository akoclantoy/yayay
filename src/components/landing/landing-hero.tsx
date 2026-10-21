"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Recycle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_TAGLINE } from "@/lib/constants";

type PublicStats = {
  totalRecycledKg: number;
  averageResidentScore: number | null;
  monthlyChangePercent: number | null;
  verifiedRecords: number;
  dailyImpact: { day: string; totalWeightKg: number }[];
};

const numberFormat = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 1,
});

function getMonthChangeLabel(change: number | null) {
  if (change === null) return "First recorded activity this month";
  if (change === 0) return "No change from the same period last month";
  return `${numberFormat.format(Math.abs(change))}% ${
    change > 0 ? "more" : "less"
  } than the same period last month`;
}

export function LandingHero() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/stats/public", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load public impact data.");
        return response.json() as Promise<PublicStats>;
      })
      .then(setStats)
      .catch(() => {
        if (!controller.signal.aborted) setStatsUnavailable(true);
      });

    return () => controller.abort();
  }, []);

  const activity = useMemo(() => {
    if (!stats) return [];
    return stats.dailyImpact;
  }, [stats]);
  const maxActivity = Math.max(...activity.map((day) => day.totalWeightKg), 1);
  const averageScore =
    stats?.averageResidentScore === null ||
    stats?.averageResidentScore === undefined
      ? "—"
      : new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(
          stats.averageResidentScore
        );

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="container mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary"
        >
          <Recycle className="h-4 w-4" />
          Smart community recycling platform
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 max-w-2xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl"
        >
          Transform waste into{" "}
          <span className="text-gradient">rewards</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          {APP_TAGLINE} Earn points, track your environmental impact, and help
          your barangay build a sustainable future.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col gap-4 sm:flex-row"
        >
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto text-base px-8">
              Start earning rewards
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base px-8">
              Explore the program
            </Button>
          </a>
        </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-[1.5rem] bg-[#173c30] p-6 text-white shadow-2xl shadow-primary/20 sm:p-8">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-[#6a9f61]/20" />
            <div className="relative">
              <div className="mb-12 flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/65">Verified recycling to date</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">
                    {stats
                      ? `${numberFormat.format(stats.totalRecycledKg)} kg`
                      : statsUnavailable
                        ? "Data unavailable"
                        : "Loading…"}
                  </p>
                  <p
                    className={`mt-1 flex items-center gap-1 text-sm ${
                      (stats?.monthlyChangePercent ?? 0) < 0
                        ? "text-[#ffd0ca]"
                        : "text-[#b4d88c]"
                    }`}
                  >
                    {(stats?.monthlyChangePercent ?? 0) < 0 ? (
                      <ArrowDownRight className="h-4 w-4 shrink-0" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                    )}
                    {stats
                      ? getMonthChangeLabel(stats.monthlyChangePercent)
                      : "Based on verified recycling records"}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#e8b34b] p-3 text-[#3c2a0b]"><Sparkles className="h-5 w-5" /></div>
              </div>
              <div className="mb-2 flex h-32 items-end gap-0.5 border-b border-white/15 pb-2">
                {activity.map((day, index) => (
                  <div
                    key={day.day}
                    aria-label={`${new Date(`${day.day}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" })}: ${numberFormat.format(day.totalWeightKg)} kilograms`}
                    className="min-w-0 flex-1 rounded-t-sm bg-[#8dbf45] transition-colors hover:bg-[#b4d88c]"
                    role="img"
                    style={{
                      height: `${Math.max((day.totalWeightKg / maxActivity) * 100, day.totalWeightKg > 0 ? 8 : 0)}%`,
                      opacity: 0.45 + (index / Math.max(activity.length - 1, 1)) * 0.5,
                    }}
                    title={`${new Date(`${day.day}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}: ${numberFormat.format(day.totalWeightKg)} kg`}
                  />
                ))}
              </div>
              <p className="mb-3 text-[10px] text-white/65">
                Each bar = 1 day · hover a bar for its total
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/65">Last 90 days</span>
                <span className="flex items-center gap-2 font-medium">
                  <Check className="h-4 w-4 text-[#b4d88c]" />
                  {stats ? `${stats.verifiedRecords} verified records` : "Verified records"}
                </span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-5 rounded-2xl border border-border bg-card p-4 shadow-xl sm:-left-8">
            <p className="text-xs text-muted-foreground">Average resident score</p>
            <p className="mt-1 text-xl font-bold text-primary">
              {averageScore}{" "}
              <span className="text-xs font-medium text-muted-foreground">/ 1000</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
