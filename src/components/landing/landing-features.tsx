"use client";

import { motion } from "framer-motion";
import {
  QrCode,
  Bot,
  Gift,
  MapPin,
  BarChart3,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: QrCode,
    title: "Digital recycling card",
    description:
      "Unique QR code for instant verification at collection centers. No plastic cards needed.",
  },
  {
    icon: Bot,
    title: "AI recycling assistant",
    description:
      "Ask how to sort waste, find nearby centers, and estimate rewards with smart AI guidance.",
  },
  {
    icon: Gift,
    title: "Reward wallet",
    description:
      "Earn points automatically. Redeem vouchers, discounts, and barangay incentives.",
  },
  {
    icon: MapPin,
    title: "Collection scheduling",
    description:
      "Request pickups, view routes, and never miss a collection day in your area.",
  },
  {
    icon: BarChart3,
    title: "Impact analytics",
    description:
      "Track carbon savings, recycling streaks, badges, and your environmental score.",
  },
  {
    icon: Bell,
    title: "Smart notifications",
    description:
      "Real-time alerts for rewards, pickup updates, and community announcements.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything you need to <span className="text-gradient">recycle smarter</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete platform for residents, collection staff, and administrators.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
