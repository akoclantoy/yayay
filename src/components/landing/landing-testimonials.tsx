"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    quote:
      "Our barangay recycling rate jumped 40% in six months. Residents love earning points for something they already do.",
    name: "Maria Santos",
    role: "Barangay Captain, Brgy. San Jose",
  },
  {
    quote:
      "The QR scanning makes collection fast and accurate. No more paper logs — everything is tracked in real time.",
    name: "Carlos Reyes",
    role: "Collection Staff",
  },
  {
    quote:
      "I redeemed my points for grocery vouchers twice this month. The AI assistant helped me sort electronics properly.",
    name: "Ana Cruz",
    role: "Resident since 2024",
  },
];

export function LandingTestimonials() {
  return (
    <section className="py-24 px-4 bg-muted/20">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Trusted by communities
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full">
                <CardContent className="pt-8 pb-6">
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
