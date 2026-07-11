import { useEffect, useRef } from 'react';
import { useBuilderStore } from '../store/builderStore';
import type { Holding } from '../data/types';

interface HoldingsResult {
  count: number | null;
  topHoldings: Holding[];
}

export function useHoldingsCount() {
  const positions = useBuilderStore((s) => s.positions);
  const etfCache = useBuilderStore((s) => s.etfCache);
  const setHoldingsLoading = useBuilderStore((s) => s.setHoldingsLoading);
  const fetched = useRef(new Set<string>());

  const cachedTickers = positions
    .map((p) => p.ticker)
    .filter((t) => etfCache.has(t))
    .sort()
    .join(',');

  useEffect(() => {
    if (!cachedTickers) return;

    const needed = cachedTickers.split(',').filter((t) => !fetched.current.has(t));
    if (needed.length === 0) return;

    const controller = new AbortController();
    setHoldingsLoading(true);

    fetch(`/api/holdings-count?symbols=${needed.join(',')}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Holdings fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: { results: Record<string, HoldingsResult> }) => {
        const { etfCache: freshCache, cacheEtf } = useBuilderStore.getState();
        for (const [sym, result] of Object.entries(data.results)) {
          fetched.current.add(sym);
          const etf = freshCache.get(sym);
          if (!etf) continue;
          const patch: Record<string, unknown> = {};
          if (result.count != null) patch.numberOfHoldings = result.count;
          if (result.topHoldings.length > (etf.topHoldings?.length ?? 0)) {
            patch.topHoldings = result.topHoldings;
          }
          if (Object.keys(patch).length > 0) {
            cacheEtf(sym, { ...etf, ...patch });
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Holdings fetch error:', err.message);
        }
      })
      .finally(() => setHoldingsLoading(false));

    return () => controller.abort();
  }, [cachedTickers]);
}
