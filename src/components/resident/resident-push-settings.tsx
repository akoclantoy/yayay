"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type PushSettings = {
  configured: boolean;
  enabled: boolean;
  publicKey: string | null;
};

function decodeApplicationServerKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function ResidentPushSettings() {
  const [settings, setSettings] = useState<PushSettings | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const registration = await navigator.serviceWorker?.getRegistration("/service-worker.js");
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
      const response = await fetch(`/api/resident/push-subscriptions${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load notification settings.");
      if (active) setSettings(data as PushSettings);
    })()
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Unable to load notification settings.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function enableNotifications() {
    if (
      !settings?.publicKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      toast.error("Device notifications are not supported by this browser.");
      return;
    }
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Allow notifications in your browser settings to receive device alerts.");
      }

      await navigator.serviceWorker.register("/service-worker.js");
      const readyRegistration = await navigator.serviceWorker.ready;
      const subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(settings.publicKey),
      });
      const response = await fetch("/api/resident/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to enable device notifications.");
      setSettings((current) => current ? { ...current, enabled: true } : current);
      toast.success("Device notifications are enabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to enable device notifications.");
    } finally {
      setWorking(false);
    }
  }

  async function disableNotifications() {
    setWorking(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/service-worker.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setSettings((current) => current ? { ...current, enabled: false } : current);
        return;
      }
      const response = await fetch("/api/resident/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to disable device notifications.");
      await subscription.unsubscribe();
      setSettings((current) => current ? { ...current, enabled: false } : current);
      toast.success("Device notifications are disabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to disable device notifications.");
    } finally {
      setWorking(false);
    }
  }

  if (!settings || (!settings.configured && !settings.enabled)) {
    return (
      <p className="text-sm text-muted-foreground">
        Device notifications are unavailable until push service credentials are configured.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {settings.enabled ? (
        <Button type="button" variant="outline" disabled={working} onClick={() => void disableNotifications()}>
          <BellOff className="h-4 w-4" />
          {working ? "Updating..." : "Disable device notifications"}
        </Button>
      ) : (
        <Button type="button" disabled={working} onClick={() => void enableNotifications()}>
          <Bell className="h-4 w-4" />
          {working ? "Enabling..." : "Enable device notifications"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Includes account updates and incoming call alerts. Calls still need the messenger open to answer.
      </p>
    </div>
  );
}
