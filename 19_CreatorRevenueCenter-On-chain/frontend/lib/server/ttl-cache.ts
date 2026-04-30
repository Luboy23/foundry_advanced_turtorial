type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  inFlight?: Promise<T>;
};

const ttlCache = new Map<string, CacheEntry<unknown>>();

export async function readThroughTtlCache<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options?: { fresh?: boolean }
): Promise<T> {
  if (options?.fresh) {
    return load();
  }

  const now = Date.now();
  const existing = ttlCache.get(key) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const inFlight = load()
    .then((value) => {
      ttlCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
      });
      return value;
    })
    .catch((error) => {
      ttlCache.delete(key);
      throw error;
    });

  ttlCache.set(key, {
    expiresAt: now + ttlMs,
    inFlight
  });

  return inFlight;
}
