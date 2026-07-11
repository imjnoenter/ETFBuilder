import { describe, it, expect } from 'vitest';
import {
  equalize,
  balanceTo100,
  allocatedPct,
  remainingPct,
  blendedMetric,
  assetClassMix,
  commonHistoryWindow,
  backtestGrowth,
  benchmarkGrowth,
} from './portfolio';
import type { Etf, Position, PricePoint } from '../data/types';

// ── Helpers ──

function makeEtf(overrides: Partial<Etf> & { ticker: string }): Etf {
  return {
    name: `${overrides.ticker} ETF`,
    issuer: 'Test',
    assetClass: 'Equity',
    risk: 3,
    riskLabel: 'Moderate',
    expenseRatio: 0.001,
    aum: 1_000_000_000,
    inceptionDate: '2010-01-01',
    dividendYield: 0.02,
    stdDev: 0.15,
    beta: 1.0,
    numberOfHoldings: null,
    topHoldings: [],
    sectorWeights: [],
    assetBreakdown: { Equity: 100 },
    overview: '',
    ...overrides,
  };
}

// ── Weight operations ──

describe('equalize', () => {
  it('sets equal weights summing to 100 for 3 positions', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 10 },
      { ticker: 'B', weight: 50 },
      { ticker: 'C', weight: 20 },
    ];
    const result = equalize(positions);
    const total = result.reduce((s, p) => s + p.weight, 0);
    expect(total).toBeCloseTo(100, 10);
    // All should be near 33.33
    for (const p of result) {
      expect(p.weight).toBeCloseTo(100 / 3, 1);
    }
  });

  it('returns empty array for empty input', () => {
    expect(equalize([])).toEqual([]);
  });

  it('sets single position to 100', () => {
    const result = equalize([{ ticker: 'A', weight: 42 }]);
    expect(result[0].weight).toBe(100);
  });

  it('handles 7 positions with rounding', () => {
    const positions: Position[] = Array.from({ length: 7 }, (_, i) => ({
      ticker: `T${i}`,
      weight: 10,
    }));
    const result = equalize(positions);
    const total = result.reduce((s, p) => s + p.weight, 0);
    expect(total).toBeCloseTo(100, 10);
  });
});

describe('balanceTo100', () => {
  it('scales weights proportionally to sum to 100', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 20 },
      { ticker: 'B', weight: 30 },
    ];
    const result = balanceTo100(positions);
    const total = result.reduce((s, p) => s + p.weight, 0);
    expect(total).toBeCloseTo(100, 10);
    // A was 20/50 = 40%, B was 30/50 = 60%
    expect(result[0].weight).toBeCloseTo(40, 1);
    expect(result[1].weight).toBeCloseTo(60, 1);
  });

  it('distributes equally when all weights are zero', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 0 },
      { ticker: 'B', weight: 0 },
      { ticker: 'C', weight: 0 },
    ];
    const result = balanceTo100(positions);
    const total = result.reduce((s, p) => s + p.weight, 0);
    expect(total).toBeCloseTo(100, 10);
    for (const p of result) {
      expect(p.weight).toBeCloseTo(100 / 3, 1);
    }
  });
});

describe('allocatedPct / remainingPct', () => {
  it('computes correctly', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 30 },
      { ticker: 'B', weight: 45.5 },
    ];
    expect(allocatedPct(positions)).toBeCloseTo(75.5, 2);
    expect(remainingPct(positions)).toBeCloseTo(24.5, 2);
  });

  it('returns 0/100 for empty', () => {
    expect(allocatedPct([])).toBe(0);
    expect(remainingPct([])).toBe(100);
  });
});

// ── Blended metrics ──

describe('blendedMetric', () => {
  it('computes weighted average of expense ratio', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 60 },
      { ticker: 'B', weight: 40 },
    ];
    const etfs = new Map<string, Etf>([
      ['A', makeEtf({ ticker: 'A', expenseRatio: 0.001 })],
      ['B', makeEtf({ ticker: 'B', expenseRatio: 0.003 })],
    ]);

    const result = blendedMetric(positions, etfs, 'expenseRatio');
    // (60*0.001 + 40*0.003) / 100 = 0.0018
    expect(result).toBeCloseTo(0.0018, 6);
  });

  it('excludes positions with null values', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 50 },
      { ticker: 'B', weight: 50 },
    ];
    const etfs = new Map<string, Etf>([
      ['A', makeEtf({ ticker: 'A', dividendYield: 0.04 })],
      ['B', makeEtf({ ticker: 'B', dividendYield: null })],
    ]);

    const result = blendedMetric(positions, etfs, 'dividendYield');
    // Only A contributes, so result = 0.04
    expect(result).toBeCloseTo(0.04, 6);
  });

  it('returns null when no positions have the field', () => {
    const positions: Position[] = [{ ticker: 'A', weight: 50 }];
    const etfs = new Map<string, Etf>([
      ['A', makeEtf({ ticker: 'A', dividendYield: null })],
    ]);
    expect(blendedMetric(positions, etfs, 'dividendYield')).toBeNull();
  });
});

describe('assetClassMix', () => {
  it('aggregates weights by asset class', () => {
    const positions: Position[] = [
      { ticker: 'A', weight: 40 },
      { ticker: 'B', weight: 30 },
      { ticker: 'C', weight: 30 },
    ];
    const etfs = new Map<string, Etf>([
      ['A', makeEtf({ ticker: 'A', assetClass: 'Equity' })],
      ['B', makeEtf({ ticker: 'B', assetClass: 'Bond' })],
      ['C', makeEtf({ ticker: 'C', assetClass: 'Equity' })],
    ]);

    const mix = assetClassMix(positions, etfs);
    expect(mix).toEqual([
      { assetClass: 'Equity', weight: 70 },
      { assetClass: 'Bond', weight: 30 },
    ]);
  });
});

// ── History / Backtest ──

// Hand-crafted tiny fixture for backtest verification
// Two tickers: X and Y, 4 months of data
// X: 100 -> 110 -> 105 -> 115
// Y: 50  -> 55  -> 52  -> 58
const TINY_HISTORY: Map<string, PricePoint[]> = new Map([
  [
    'X',
    [
      { date: '2023-01', close: 100, adjClose: 100 },
      { date: '2023-02', close: 110, adjClose: 110 },
      { date: '2023-03', close: 105, adjClose: 105 },
      { date: '2023-04', close: 115, adjClose: 115 },
    ],
  ],
  [
    'Y',
    [
      { date: '2023-01', close: 50, adjClose: 50 },
      { date: '2023-02', close: 55, adjClose: 55 },
      { date: '2023-03', close: 52, adjClose: 52 },
      { date: '2023-04', close: 58, adjClose: 58 },
    ],
  ],
]);

describe('commonHistoryWindow', () => {
  it('finds the intersection of two histories', () => {
    const positions: Position[] = [
      { ticker: 'X', weight: 50 },
      { ticker: 'Y', weight: 50 },
    ];

    const window = commonHistoryWindow(positions, TINY_HISTORY);
    expect(window).not.toBeNull();
    expect(window!.start).toBe('2023-01');
    expect(window!.end).toBe('2023-04');
  });

  it('clips to youngest inception', () => {
    const lateStart = new Map(TINY_HISTORY);
    lateStart.set('Z', [
      { date: '2023-03', close: 100, adjClose: 100 },
      { date: '2023-04', close: 105, adjClose: 105 },
    ]);

    const positions: Position[] = [
      { ticker: 'X', weight: 50 },
      { ticker: 'Z', weight: 50 },
    ];

    const window = commonHistoryWindow(positions, lateStart);
    expect(window).not.toBeNull();
    expect(window!.start).toBe('2023-03');
    expect(window!.limitingTicker).toBe('Z');
  });

  it('returns null for empty positions', () => {
    expect(commonHistoryWindow([], TINY_HISTORY)).toBeNull();
  });

  it('does NOT mark as clipped when all holdings have enough history for the timeframe', () => {
    // All funds have 10+ years of history; viewing at 5Y should NOT show a clip note
    const longHistory = new Map<string, PricePoint[]>();
    const makeSeries = (startYear: number) => {
      const pts: PricePoint[] = [];
      for (let y = startYear; y <= 2025; y++) {
        for (let m = 1; m <= 12; m++) {
          const v = 100 + y - startYear;
          pts.push({ date: `${y}-${String(m).padStart(2, '0')}`, close: v, adjClose: v });
        }
      }
      return pts;
    };
    longHistory.set('A', makeSeries(2010));
    longHistory.set('B', makeSeries(2012));

    const positions: Position[] = [
      { ticker: 'A', weight: 50 },
      { ticker: 'B', weight: 50 },
    ];

    // 5Y view — both have >5Y of history, no clip expected
    const window = commonHistoryWindow(positions, longHistory, 5);
    expect(window).not.toBeNull();
    expect(window!.clippedFrom).toBeUndefined();
    expect(window!.limitingTicker).toBeUndefined();
  });

  it('DOES mark as clipped when a holding has less history than the timeframe', () => {
    const mixedHistory = new Map<string, PricePoint[]>();
    const makeSeries = (startYear: number) => {
      const pts: PricePoint[] = [];
      for (let y = startYear; y <= 2025; y++) {
        for (let m = 1; m <= 12; m++) {
          const v = 100 + y - startYear;
          pts.push({ date: `${y}-${String(m).padStart(2, '0')}`, close: v, adjClose: v });
        }
      }
      return pts;
    };
    mixedHistory.set('A', makeSeries(2010));
    mixedHistory.set('JEPI', makeSeries(2020)); // Only 5 years

    const positions: Position[] = [
      { ticker: 'A', weight: 50 },
      { ticker: 'JEPI', weight: 50 },
    ];

    // 10Y view — JEPI only has data from 2020, should be clipped
    const window = commonHistoryWindow(positions, mixedHistory, 10);
    expect(window).not.toBeNull();
    expect(window!.clippedFrom).toBeDefined();
    expect(window!.limitingTicker).toBe('JEPI');
  });
});

describe('backtestGrowth', () => {
  it('computes constant-weight compounding from $10,000', () => {
    const positions: Position[] = [
      { ticker: 'X', weight: 50 },
      { ticker: 'Y', weight: 50 },
    ];

    const window = { start: '2023-01', end: '2023-04' };
    const result = backtestGrowth(positions, TINY_HISTORY, window);

    expect(result).toHaveLength(4);
    expect(result[0].close).toBe(10000);

    // Month 1 -> 2: X: 10%, Y: 10% => portfolio: 10%
    expect(result[1].close).toBeCloseTo(11000, 0);

    // Month 2 -> 3: X: (105-110)/110 = -4.545%, Y: (52-55)/55 = -5.455%
    // Portfolio return: 0.5 * (-0.04545) + 0.5 * (-0.05455) = -0.05 = -5%
    expect(result[2].close).toBeCloseTo(11000 * 0.95, 0);

    // Month 3 -> 4: X: (115-105)/105 = 9.524%, Y: (58-52)/52 = 11.538%
    // Portfolio return: 0.5 * 0.09524 + 0.5 * 0.11538 = 0.10531 = 10.531%
    const expected3 = 11000 * 0.95 * (1 + 0.10531);
    expect(result[3].close).toBeCloseTo(expected3, 0);
  });

  it('returns empty for empty positions', () => {
    const window = { start: '2023-01', end: '2023-04' };
    expect(backtestGrowth([], TINY_HISTORY, window)).toEqual([]);
  });
});

describe('benchmarkGrowth', () => {
  it('indexes from $10,000', () => {
    const window = { start: '2023-01', end: '2023-04' };
    const result = benchmarkGrowth('X', TINY_HISTORY, window);

    expect(result).toHaveLength(4);
    expect(result[0].close).toBe(10000);
    // X goes 100 -> 115 = 15% gain
    expect(result[3].close).toBeCloseTo(11500, 0);
  });
});
