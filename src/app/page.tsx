import Link from "next/link";
import { Suspense } from "react";
import {
  Recycle,
  ArrowRight,
  Download,
  Leaf,
  Sparkles,
  Users,
  TrendingUp,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Recycle className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold">{APP_NAME}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#impact" className="hover:text-foreground transition-colors">Impact</a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="https://drive.google.com/file/d/1ySO6l4DZZVOFRdtMEEbrrdG6rNwkhaO-/view?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Install the EcoRewards application"
            >
              <Button
                variant="outline"
                size="sm"
                className="group inline-flex border-primary/30 bg-primary/5 text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 hover:shadow-md"
              >
                <Download className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                <span className="hidden sm:inline">Install app</span>
              </Button>
            </a>
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <LandingHero />
        <Suspense fallback={null}>
          <LandingStats />
        </Suspense>
        <LandingFeatures />
        <LandingHowItWorks />
        <section id="impact" className="py-24 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Community impact that <span className="text-gradient">matters</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Every kilogram recycled reduces landfill waste and earns rewards for your barangay.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Leaf, label: "Carbon reduced", value: "98.5t", desc: "CO₂ equivalent saved" },
                { icon: Users, label: "Active residents", value: "1,250+", desc: "Across partner barangays" },
                { icon: TrendingUp, label: "Recycling rate", value: "+34%", desc: "Year-over-year growth" },
                { icon: Shield, label: "Verified collections", value: "100%", desc: "QR-tracked & audited" },
              ].map((item) => (
                <Card key={item.label} className="text-center hover:shadow-2xl transition-shadow duration-300">
                  <CardContent className="pt-8 pb-6">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-gradient">{item.value}</p>
                    <p className="font-medium mt-2">{item.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <LandingTestimonials />
        <section className="py-24 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/90 via-secondary/90 to-accent/80 text-white shadow-2xl">
              <CardContent className="py-16 px-8">
                <Sparkles className="h-10 w-10 mx-auto mb-6 opacity-90" />
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Ready to turn waste into rewards?
                </h2>
                <p className="text-white/85 text-lg mb-8 max-w-xl mx-auto">
                  Join your community&apos;s smart recycling program. Free to register, instant QR card, AI-powered guidance.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/register">
                    <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 w-full sm:w-auto">
                      Create free account
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="glass" className="text-white border-white/30 w-full sm:w-auto">
                      Sign in
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
