type CacheEntry = { value: unknown; storedAt: number };

const dataCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 20_000;

export function setCachedMessengerData<T>(key: string, value: T) {
  dataCache.set(key, { value, storedAt: Date.now() });
}

export function getCachedMessengerData<T>(key: string): T | null {
  const entry = dataCache.get(key);
  if (!entry || Date.now() - entry.storedAt > CACHE_TTL_MS) {
    dataCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function loadCachedMessengerData<T>(
  key: string,
  load: () => Promise<T>,
  force = false,
): Promise<T> {
  const cached = !force ? getCachedMessengerData<T>(key) : null;
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      setCachedMessengerData(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export function prefetchMessengerData(residentId: string) {
  if (!residentId) return;
  const bootstrapKey = `messenger-bootstrap:${residentId}`;
  const cached = getCachedMessengerData<unknown>(bootstrapKey);
  if (cached) return;
  void loadCachedMessengerData(bootstrapKey, async () => {
    const [friendsResponse, conversationsResponse] = await Promise.all([
      fetch("/api/resident/friends", { cache: "no-store" }),
      fetch("/api/resident/direct-messages", { cache: "no-store" }),
    ]);
    if (!friendsResponse.ok || !conversationsResponse.ok) {
      throw new Error("Could not prefetch resident messages.");
    }
    const [friends, conversations] = await Promise.all([
      friendsResponse.json(),
      conversationsResponse.json(),
    ]);
    return { friends, conversations };
  }).catch((error: unknown) => {
    console.error("[messenger-cache] Could not prefetch inbox:", error);
  });
}
