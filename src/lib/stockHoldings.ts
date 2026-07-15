/**
 * Look-through stock holdings — blends each position's topHoldings
 * (weighted by position weight) into a single portfolio-wide ranking.
 * Mirrors the aggregation used by TopHoldingsTable.
 */

import type { Etf, Position } from '../data/types';

export interface BlendedStockHolding {
  symbol: string;
  name: string;
  /** Percentage points (0-100 scale), matching Position.weight */
  blended: number;
}

export function blendedStockHoldings(
  positions: Position[],
  etfCache: Map<string, Etf>,
  limit = 20
): BlendedStockHolding[] {
  const map = new Map<string, { symbol: string; name: string; blended: number }>();

  for (const pos of positions) {
    const etf = etfCache.get(pos.ticker);
    if (!etf?.topHoldings) continue;

    for (const holding of etf.topHoldings) {
      const blended = (pos.weight / 100) * holding.weight;
      const key = holding.symbol || holding.name;
      const existing = map.get(key);
      if (existing) {
        existing.blended += blended;
      } else {
        map.set(key, { symbol: holding.symbol, name: holding.name, blended });
      }
    }
  }

  const totalAllocated = positions.reduce((sum, p) => sum + p.weight / 100, 0);
  const entries = Array.from(map.values());
  if (totalAllocated > 0) {
    for (const e of entries) e.blended /= totalAllocated;
  }

  return entries.sort((a, b) => b.blended - a.blended).slice(0, limit);
}

/** True if any position has topHoldings data cached (holdings-count fetch resolved for at least one). */
export function hasAnyHoldingsData(positions: Position[], etfCache: Map<string, Etf>): boolean {
  return positions.some((p) => (etfCache.get(p.ticker)?.topHoldings?.length ?? 0) > 0);
}
