"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Recycle, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_TAGLINE } from "@/lib/constants";

export function LandingHero() {
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
                  <p className="text-sm text-white/65">Community impact</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight">12,480 kg</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[#b4d88c]"><TrendingUp className="h-4 w-4" /> 18.6% this month</p>
                </div>
                <div className="rounded-2xl bg-[#e8b34b] p-3 text-[#3c2a0b]"><Sparkles className="h-5 w-5" /></div>
              </div>
              <div className="mb-7 flex h-32 items-end gap-2 border-b border-white/15 pb-2">
                {[34, 48, 42, 67, 58, 82, 74, 96, 86, 100].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-md bg-[#8dbf45]" style={{ height: `${height}%`, opacity: 0.45 + index * 0.05 }} />
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/65">This year</span>
                <span className="flex items-center gap-2 font-medium"><Check className="h-4 w-4 text-[#b4d88c]" /> Verified collections</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-5 rounded-2xl border border-border bg-card p-4 shadow-xl sm:-left-8">
            <p className="text-xs text-muted-foreground">Average resident score</p>
            <p className="mt-1 text-xl font-bold text-primary">742 <span className="text-xs font-medium text-muted-foreground">/ 1000</span></p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
