import { useEffect, useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import type { TrailingReturns } from '../data/types';

const RETURNS_TTL = 24 * 60 * 60 * 1000;
const LS_KEY = 'etfbuilder-trailing-returns';

function readLocalCache(): Record<string, TrailingReturns> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TrailingReturns>) : {};
  } catch {
    return {};
  }
}

function writeLocalCache(cache: Record<string, TrailingReturns>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

export function useTrailingReturns() {
  const positions = useBuilderStore((s) => s.positions);
  const trailingReturnsCache = useBuilderStore((s) => s.trailingReturnsCache);
  const cacheTrailingReturns = useBuilderStore((s) => s.cacheTrailingReturns);
  const [loading, setLoading] = useState(false);

  const tickers = positions.map((p) => p.ticker).sort().join(',');

  useEffect(() => {
    if (!tickers) return;

    const now = Date.now();
    const all = tickers.split(',');

    // Restore from localStorage into Zustand for any tickers not yet in memory
    const localCache = readLocalCache();
    const restorable: Record<string, TrailingReturns> = {};
    for (const t of all) {
      if (!trailingReturnsCache.get(t) && localCache[t] && now - localCache[t].fetchedAt < RETURNS_TTL) {
        restorable[t] = localCache[t];
      }
    }
    if (Object.keys(restorable).length > 0) {
      cacheTrailingReturns(restorable);
    }

    // Determine what still needs fetching
    const needed = all.filter((t) => {
      const cached = trailingReturnsCache.get(t) ?? restorable[t];
      return !cached || now - cached.fetchedAt > RETURNS_TTL;
    });

    if (needed.length === 0) return;

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/trailing-returns?symbols=${needed.join(',')}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Trailing returns fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: { results: Record<string, Omit<TrailingReturns, 'fetchedAt'>> }) => {
        const stamped: Record<string, TrailingReturns> = {};
        const ts = Date.now();
        for (const [sym, ret] of Object.entries(data.results)) {
          stamped[sym] = { ...ret, fetchedAt: ts };
        }
        cacheTrailingReturns(stamped);

        // Persist to localStorage
        const updated = { ...readLocalCache(), ...stamped };
        // Evict stale entries
        for (const key of Object.keys(updated)) {
          if (ts - updated[key].fetchedAt > RETURNS_TTL) delete updated[key];
        }
        writeLocalCache(updated);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Trailing returns fetch error:', err.message);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [tickers]);

  return { loading };
}
