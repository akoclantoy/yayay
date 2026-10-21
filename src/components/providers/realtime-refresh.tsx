"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { notifyRealtimeChanges } from "@/lib/realtime-client";

export function RealtimeRefresh() {
  const router = useRouter();
  const { status } = useSession();
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      if (document.visibilityState !== "visible" || pendingRef.current) return;

      queuedRefreshRef.current = false;
      pendingRef.current = true;
      startTransition(() => router.refresh());
    }, 180);
  }, [router, startTransition]);

  useEffect(() => {
    pendingRef.current = isPending;
    if (!isPending && queuedRefreshRef.current && document.visibilityState === "visible") {
      scheduleRefresh();
    }
  }, [isPending, scheduleRefresh]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const events = new EventSource("/api/realtime");
    const onInvalidate = () => {
      notifyRealtimeChanges();
      queuedRefreshRef.current = true;
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !queuedRefreshRef.current) return;
      notifyRealtimeChanges();
      scheduleRefresh();
    };
    const onOnline = () => {
      if (queuedRefreshRef.current) scheduleRefresh();
    };

    events.addEventListener("invalidate", onInvalidate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      events.removeEventListener("invalidate", onInvalidate);
      events.close();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      pendingRef.current = false;
      queuedRefreshRef.current = false;
    };
  }, [scheduleRefresh, status]);

  return null;
}
