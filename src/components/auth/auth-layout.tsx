"use client";

import Link from "next/link";
import { Recycle } from "lucide-react";
import { motion } from "framer-motion";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-secondary to-accent p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/30 blur-3xl animate-float" />
          <div className="absolute bottom-32 right-16 w-48 h-48 rounded-full bg-white/20 blur-2xl animate-float" style={{ animationDelay: "2s" }} />
        </div>
        <Link href="/" className="relative flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Recycle className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </Link>
        <div className="relative space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white leading-tight"
          >
            Transform waste into rewards for your community
          </motion.h2>
          <p className="text-white/80 text-lg max-w-md">
            Join thousands of residents earning points, reducing carbon footprint, and building a greener barangay.
          </p>
        </div>
        <p className="relative text-white/60 text-sm">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Recycle className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold">{APP_NAME}</span>
          </div>
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function AuthDivider({ text = "or continue with" }: { text?: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}

export function GoogleButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white/80 px-4 py-3 text-sm font-medium shadow-sm transition-all hover:bg-white hover:shadow-md dark:bg-white/5 dark:hover:bg-white/10",
        loading && "opacity-50 pointer-events-none"
      )}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Google
    </button>
  );
}
