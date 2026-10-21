type RealtimeListener = () => void;

const listeners = new Set<RealtimeListener>();

export function subscribeToRealtimeChanges(listener: RealtimeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyRealtimeChanges() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[realtime:client] A live update listener failed:", error);
    }
  }
}
