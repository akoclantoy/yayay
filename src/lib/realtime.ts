import { Client } from "pg";
import { resolveDatabaseConnectionString } from "@/lib/database-url";

type Subscriber = () => void;

type RealtimeHub = {
  client: Client | null;
  connecting: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  subscribers: Set<Subscriber>;
};

const globalForRealtime = globalThis as typeof globalThis & {
  ecorewardsRealtimeHub?: RealtimeHub;
};

const hub =
  globalForRealtime.ecorewardsRealtimeHub ??
  (globalForRealtime.ecorewardsRealtimeHub = {
    client: null,
    connecting: null,
    reconnectTimer: null,
    subscribers: new Set<Subscriber>(),
  });

function notifySubscribers() {
  for (const subscriber of hub.subscribers) {
    try {
      subscriber();
    } catch (error) {
      console.error("[realtime] Failed to notify a connected client:", error);
    }
  }
}

function scheduleReconnect() {
  if (hub.reconnectTimer || hub.subscribers.size === 0) return;

  hub.reconnectTimer = setTimeout(() => {
    hub.reconnectTimer = null;
    ensureListener();
  }, 3000);
  hub.reconnectTimer.unref();
}

function ensureListener() {
  if (hub.client || hub.connecting) return;

  const connectionString = resolveDatabaseConnectionString(
    process.env.DIRECT_URL ?? process.env.DATABASE_URL
  );
  if (!connectionString) {
    console.error("[realtime] DIRECT_URL or DATABASE_URL is required.");
    return;
  }

  const client = new Client({
    connectionString,
    application_name: "ecorewards-realtime-listener",
  });
  let isListening = false;

  client.on("error", (error) => {
    if (!isListening || hub.client !== client) return;
    console.error("[realtime] PostgreSQL listener connection failed:", error);
    hub.client = null;
    scheduleReconnect();
    void client.end().catch((endError: unknown) => {
      console.error("[realtime] Failed to close the listener connection:", endError);
    });
  });

  hub.connecting = (async () => {
    try {
      await client.connect();
      await client.query("LISTEN ecorewards_data_changed");
      isListening = true;

      client.on("notification", (message) => {
        if (message.channel === "ecorewards_data_changed") {
          notifySubscribers();
        }
      });
      client.on("end", () => {
        if (hub.client !== client) return;
        console.error("[realtime] PostgreSQL listener connection ended.");
        hub.client = null;
        scheduleReconnect();
      });

      hub.client = client;
      notifySubscribers();
    } catch (error) {
      console.error("[realtime] Could not start the PostgreSQL listener:", error);
      try {
        await client.end();
      } catch (endError) {
        console.error("[realtime] Failed to close the listener connection:", endError);
      }
      scheduleReconnect();
    } finally {
      hub.connecting = null;
    }
  })();
}

export function subscribeToRealtimeChanges(subscriber: Subscriber) {
  hub.subscribers.add(subscriber);
  ensureListener();

  return () => {
    hub.subscribers.delete(subscriber);
  };
}

export function hasRealtimeDatabaseUrl() {
  return Boolean(
    resolveDatabaseConnectionString(
      process.env.DIRECT_URL ?? process.env.DATABASE_URL
    )
  );
}
