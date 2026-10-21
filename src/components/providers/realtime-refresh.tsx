"use client";

import { LoaderCircle, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { notifyRealtimeChanges } from "@/lib/realtime-client";

export function RealtimeRefresh() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const connectionKey = `${session?.user?.id ?? ""}:${session?.expires ?? ""}`;
  const [connectionState, setConnectionState] = useState({
    key: "",
    connected: false,
    hasConnected: false,
  });
  const connected =
    connectionState.key === connectionKey && connectionState.connected;
  const hasConnected =
    connectionState.key === connectionKey && connectionState.hasConnected;
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
    const onOpen = () => {
      setConnectionState({
        key: connectionKey,
        connected: true,
        hasConnected: true,
      });
    };
    const onError = () => {
      setConnectionState((previous) => ({
        key: connectionKey,
        connected: false,
        hasConnected:
          previous.key === connectionKey && previous.hasConnected,
      }));
    };
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

    events.addEventListener("open", onOpen);
    events.addEventListener("error", onError);
    events.addEventListener("invalidate", onInvalidate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      events.removeEventListener("open", onOpen);
      events.removeEventListener("error", onError);
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
  }, [connectionKey, scheduleRefresh, status]);

  if (status !== "authenticated") return null;

  const label = isPending
    ? "Syncing updates"
    : connected
      ? "Live updates"
      : hasConnected
        ? "Reconnecting"
        : "Connecting";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground shadow-lg shadow-black/5 backdrop-blur-xl"
    >
      {isPending || (!connected && !hasConnected) ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : connected ? (
        <Wifi className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-amber-600" />
      )}
      <span>{label}</span>
      {isPending && (
        <span className="sr-only">Fresh system data is loading.</span>
      )}
    </div>
  );
}
