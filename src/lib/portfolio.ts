/**
 * Portfolio math — pure functions, no React dependency.
 *
 * All functions operate on Position[] + Etf data.
 * Weights are user-set percentages (0-100). Total may be < 100%.
 */

import type { AssetClass, Etf, Position, PricePoint } from '../data/types';

// ── Weight operations ──

/** Normalize weights so they sum to exactly 100 (proportional scaling) */
export function normalizeWeights(positions: Position[]): Position[] {
  const total = positions.reduce((sum, p) => sum + p.weight, 0);
  if (total === 0) return positions.map((p) => ({ ...p, weight: 0 }));
  return positions.map((p) => ({
    ...p,
    weight: Math.round((p.weight / total) * 10000) / 100,
  }));
}

/** Set all positions to equal weight summing to 100% */
export function equalize(positions: Position[]): Position[] {
  if (positions.length === 0) return [];
  const weight = Math.round((100 / positions.length) * 100) / 100;
  const result = positions.map((p) => ({ ...p, weight }));
  // Fix rounding: adjust last position so sum = exactly 100
  const sum = result.reduce((s, p) => s + p.weight, 0);
  const diff = Math.round((100 - sum) * 100) / 100;
  if (result.length > 0) {
    result[result.length - 1] = {
      ...result[result.length - 1],
      weight: Math.round((result[result.length - 1].weight + diff) * 100) / 100,
    };
  }
  return result;
}

/**
 * Scale all weights proportionally so they sum to exactly 100%.
 * When the current total is 0 (e.g. freshly added ETFs at 0% each),
 * distribute equally instead — scaling 0 by any factor is still 0.
 */
export function balanceTo100(positions: Position[]): Position[] {
  const total = positions.reduce((sum, p) => sum + p.weight, 0);
  if (total === 0) return equalize(positions);
  return normalizeWeights(positions);
}

/** Sum of all position weights */
export function allocatedPct(positions: Position[]): number {
  return Math.round(positions.reduce((sum, p) => sum + p.weight, 0) * 100) / 100;
}

/** 100 minus allocated percentage */
export function remainingPct(positions: Position[]): number {
  return Math.round((100 - allocatedPct(positions)) * 100) / 100;
}

// ── Blended metrics ──

/**
 * Compute a weighted average of a numeric ETF field across positions.
 * Positions with null values for the field are excluded (their weight
 * is redistributed proportionally among positions that have the value).
 */
export function blendedMetric(
  positions: Position[],
  etfs: Map<string, Etf>,
  field: keyof Etf
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const pos of positions) {
    const etf = etfs.get(pos.ticker);
    if (!etf) continue;
    const val = etf[field];
    if (typeof val !== 'number') continue;
    weightedSum += pos.weight * val;
    totalWeight += pos.weight;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

/**
 * Compute asset class mix: sum weights by asset class.
 * Returns sorted by weight descending.
 */
export function assetClassMix(
  positions: Position[],
  etfs: Map<string, Etf>
): Array<{ assetClass: AssetClass; weight: number }> {
  const mix = new Map<AssetClass, number>();

  for (const pos of positions) {
    const etf = etfs.get(pos.ticker);
    if (!etf) continue;
    const current = mix.get(etf.assetClass) ?? 0;
    mix.set(etf.assetClass, current + pos.weight);
  }

  return Array.from(mix.entries())
    .map(([assetClass, weight]) => ({
      assetClass,
      weight: Math.round(weight * 100) / 100,
    }))
    .sort((a, b) => b.weight - a.weight);
}

// ── History / Backtest ──

export interface HistoryWindow {
  start: string;
  end: string;
  /** If clipped, the full range that was available before clipping */
  clippedFrom?: string;
  /** The ticker that limits the history window */
  limitingTicker?: string;
}

/**
 * Find the common date range across all position histories,
 * optionally clamped to a timeframe (in years).
 */
export function commonHistoryWindow(
  positions: Position[],
  priceHistories: Map<string, PricePoint[]>,
  timeframeYears?: number
): HistoryWindow | null {
  if (positions.length === 0) return null;

  let latestStart = '';
  let earliestEnd = 'Z'; // Sorts after any date string
  let limitingTicker = '';

  for (const pos of positions) {
    const history = priceHistories.get(pos.ticker);
    if (!history || history.length === 0) return null;

    const first = history[0].date;
    const last = history[history.length - 1].date;

    if (first > latestStart) {
      latestStart = first;
      limitingTicker = pos.ticker;
    }
    if (last < earliestEnd) {
      earliestEnd = last;
    }
  }

  if (latestStart >= earliestEnd) return null;

  // Apply timeframe clamp. Compute the ideal start date for the
  // selected timeframe (e.g. 5Y back from the end).
  let timeframeStart: string | null = null;
  if (timeframeYears != null) {
    const endDate = new Date(earliestEnd + '-01');
    const clampedStart = new Date(endDate);
    clampedStart.setFullYear(clampedStart.getFullYear() - timeframeYears);
    timeframeStart = `${clampedStart.getFullYear()}-${String(clampedStart.getMonth() + 1).padStart(2, '0')}`;

    if (timeframeStart > latestStart) {
      // The timeframe window starts AFTER the common history start.
      // All holdings have enough data — the timeframe fits, no clipping.
      latestStart = timeframeStart;
    }
    // Otherwise latestStart stays as-is (a holding limits us).
  }

  const result: HistoryWindow = { start: latestStart, end: earliestEnd };

  // Determine if there is genuine clipping:
  // - With a timeframe: clipped if the common start (latestStart) is
  //   AFTER the ideal timeframe start. This means a holding doesn't
  //   have enough history for the requested range.
  // - At "Max": clipped if different holdings have different start dates
  //   (the limiting ticker constrains the window for other holdings).
  if (timeframeYears != null && timeframeStart != null) {
    // Clipped when the common start couldn't be pushed back to the
    // ideal timeframe start (i.e. a holding's history starts too late).
    if (latestStart > timeframeStart && limitingTicker) {
      result.clippedFrom = latestStart;
      result.limitingTicker = limitingTicker;
    }
  } else {
    // Max mode: check if the limiting ticker constrains other tickers.
    let earliestAcrossAll = 'Z';
    for (const pos of positions) {
      const history = priceHistories.get(pos.ticker);
      if (!history || history.length === 0) continue;
      if (history[0].date < earliestAcrossAll) {
        earliestAcrossAll = history[0].date;
      }
    }
    if (latestStart > earliestAcrossAll && limitingTicker) {
      result.clippedFrom = latestStart;
      result.limitingTicker = limitingTicker;
    }
  }

  return result;
}

/**
 * Backtest: constant-weight rebalanced compounding from $10,000.
 *
 * For each month t:
 *   portfolio_return_t = sum(w_i * r_i_t) where r_i_t = (close_t / close_{t-1}) - 1
 *   portfolio_value_t = portfolio_value_{t-1} * (1 + portfolio_return_t)
 *
 * Weights are renormalized to sum to 1 (constant-weight assumption).
 */
export function backtestGrowth(
  positions: Position[],
  priceHistories: Map<string, PricePoint[]>,
  window: HistoryWindow
): PricePoint[] {
  if (positions.length === 0) return [];

  // Normalize weights to sum to 1
  const totalWeight = positions.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return [];
  const normalizedPositions = positions.map((p) => ({
    ...p,
    weight: p.weight / totalWeight,
  }));

  // Build per-ticker date->adjClose maps, filtered to window
  const tickerSeries = new Map<string, Map<string, number>>();
  for (const pos of normalizedPositions) {
    const history = priceHistories.get(pos.ticker) ?? [];
    const dateMap = new Map<string, number>();
    for (const pt of history) {
      if (pt.date >= window.start && pt.date <= window.end) {
        dateMap.set(pt.date, pt.adjClose);
      }
    }
    tickerSeries.set(pos.ticker, dateMap);
  }

  // Collect all dates in window, sorted
  const allDates = new Set<string>();
  for (const dateMap of tickerSeries.values()) {
    for (const date of dateMap.keys()) {
      allDates.add(date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  if (sortedDates.length === 0) return [];

  // Compound from $10,000
  const result: PricePoint[] = [];
  let portfolioValue = 10000;
  result.push({ date: sortedDates[0], close: portfolioValue, adjClose: portfolioValue });

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currDate = sortedDates[i];

    let portfolioReturn = 0;
    for (const pos of normalizedPositions) {
      const series = tickerSeries.get(pos.ticker);
      if (!series) continue;
      const prevClose = series.get(prevDate);
      const currClose = series.get(currDate);
      if (prevClose != null && currClose != null && prevClose > 0) {
        const holdingReturn = (currClose - prevClose) / prevClose;
        portfolioReturn += pos.weight * holdingReturn;
      }
    }

    portfolioValue = portfolioValue * (1 + portfolioReturn);
    const rounded = Math.round(portfolioValue * 100) / 100;
    result.push({
      date: currDate,
      close: rounded,
      adjClose: rounded,
    });
  }

  return result;
}

/**
 * Benchmark growth: index a single ticker's price history from $10,000.
 * May extend beyond the portfolio's common window (dimmed in the UI).
 */
export function benchmarkGrowth(
  ticker: string,
  priceHistories: Map<string, PricePoint[]>,
  window: HistoryWindow
): PricePoint[] {
  const history = priceHistories.get(ticker);
  if (!history || history.length === 0) return [];

  // Filter to window range
  const inWindow = history.filter(
    (pt) => pt.date >= window.start && pt.date <= window.end
  );
  if (inWindow.length === 0) return [];

  const basePrice = inWindow[0].adjClose;
  if (basePrice <= 0) return [];

  return inWindow.map((pt) => ({
    date: pt.date,
    close: Math.round((pt.adjClose / basePrice) * 10000 * 100) / 100,
    adjClose: Math.round((pt.adjClose / basePrice) * 10000 * 100) / 100,
  }));
}
