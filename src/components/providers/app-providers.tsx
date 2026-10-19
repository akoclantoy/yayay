"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { RealtimeRefresh } from "@/components/providers/realtime-refresh";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <RealtimeRefresh />
        {children}
        <Toaster richColors position="top-right" closeButton />
      </ThemeProvider>
    </SessionProvider>
  );
}
