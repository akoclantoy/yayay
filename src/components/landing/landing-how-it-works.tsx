"use client";

import { motion } from "framer-motion";
import { UserPlus, Recycle, Award } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Register & verify",
    description: "Create your free account, verify email, and get your digital QR recycling card instantly.",
  },
  {
    icon: Recycle,
    step: "02",
    title: "Recycle & collect",
    description: "Bring sorted waste to centers or request pickup. Staff scan your QR and record weight.",
  },
  {
    icon: Award,
    step: "03",
    title: "Earn & redeem",
    description: "Points credit automatically to your wallet. Redeem rewards and climb the leaderboard.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-lg">
            Three simple steps to start making an impact
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/20 via-secondary/40 to-accent/20" />

          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-4 ring-background dark:bg-card">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary tracking-widest">
                STEP {item.step}
              </span>
              <h3 className="text-xl font-semibold mt-2 mb-3">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
