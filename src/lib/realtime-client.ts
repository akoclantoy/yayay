type RealtimeListener = () => void;

const listeners = new Set<RealtimeListener>();
const MIN_REFRESH_INTERVAL_MS = 2_000;
let lastDispatchAt = 0;
let pendingDispatch: ReturnType<typeof setTimeout> | null = null;

function dispatchRealtimeChanges() {
  pendingDispatch = null;
  lastDispatchAt = Date.now();
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[realtime:client] A live update listener failed:", error);
    }
  }
}

export function subscribeToRealtimeChanges(listener: RealtimeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && pendingDispatch !== null) {
      clearTimeout(pendingDispatch);
      pendingDispatch = null;
    }
  };
}

export function notifyRealtimeChanges() {
  if (listeners.size === 0 || pendingDispatch !== null) return;

  const delay = Math.max(
    0,
    MIN_REFRESH_INTERVAL_MS - (Date.now() - lastDispatchAt),
  );
  if (delay === 0) {
    dispatchRealtimeChanges();
    return;
  }

  pendingDispatch = setTimeout(dispatchRealtimeChanges, delay);
}
