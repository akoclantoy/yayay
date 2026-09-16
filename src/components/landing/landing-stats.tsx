"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatPoints, formatWeight } from "@/lib/utils";

type Stats = {
  totalResidents: number;
  totalRecycledKg: number;
  totalPoints: number;
  carbonSavedKg: number;
};

export function LandingStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => null);
  }, []);

  const items = [
    {
      label: "Residents enrolled",
      value: stats ? formatPoints(stats.totalResidents) : "—",
    },
    {
      label: "Kg recycled",
      value: stats ? formatWeight(stats.totalRecycledKg) : "—",
    },
    {
      label: "Points earned",
      value: stats ? formatPoints(stats.totalPoints) : "—",
    },
    {
      label: "Carbon saved",
      value: stats ? formatWeight(stats.carbonSavedKg) : "—",
    },
  ];

  return (
    <section className="py-12 px-4 border-y border-border/50 bg-white/40 dark:bg-white/5 backdrop-blur-sm">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-2xl sm:text-3xl font-bold text-gradient">
                {item.value}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
