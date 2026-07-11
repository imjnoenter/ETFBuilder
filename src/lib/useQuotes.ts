import { useEffect, useState } from 'react';
import { useBuilderStore } from '../store/builderStore';
import type { QuoteData } from '../data/types';

const QUOTE_TTL = 5 * 60 * 1000;

export function useQuotes() {
  const positions = useBuilderStore((s) => s.positions);
  const quoteCache = useBuilderStore((s) => s.quoteCache);
  const cacheQuotes = useBuilderStore((s) => s.cacheQuotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickers = positions.map((p) => p.ticker).sort().join(',');

  useEffect(() => {
    if (!tickers) return;

    const now = Date.now();
    const needed = tickers.split(',').filter((t) => {
      const cached = quoteCache.get(t);
      return !cached || now - cached.fetchedAt > QUOTE_TTL;
    });

    if (needed.length === 0) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/quotes?symbols=${needed.join(',')}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: { quotes: Record<string, QuoteData> }) => {
        cacheQuotes(data.quotes);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [tickers]);

  return { loading, error };
}
