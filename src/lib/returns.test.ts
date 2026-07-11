import { describe, it, expect } from 'vitest';
import { computePeriodReturns } from './returns';
import type { PricePoint } from '../data/types';

/** Generate N months of price data starting from startYear-startMonth */
function makePrices(length: number, startYear = 2020, startMonth = 1): PricePoint[] {
  return Array.from({ length }, (_, i) => {
    const totalMonths = (startYear - 1) * 12 + (startMonth - 1) + i;
    const year = Math.floor(totalMonths / 12) + 1;
    const month = (totalMonths % 12) + 1;
    return {
      date: `${year}-${String(month).padStart(2, '0')}`,
      close: 100 + i,
      adjClose: 100 + i,
    };
  });
}

describe('computePeriodReturns', () => {
  it('returns all nulls for undefined input', () => {
    const result = computePeriodReturns(undefined);
    expect(result).toEqual({ '1M': null, '3M': null, '1Y': null, '3Y': null, '5Y': null });
  });

  it('returns all nulls for empty array', () => {
    const result = computePeriodReturns([]);
    expect(result).toEqual({ '1M': null, '3M': null, '1Y': null, '3Y': null, '5Y': null });
  });

  it('returns all nulls for single data point', () => {
    const result = computePeriodReturns([{ date: '2020-01', close: 100, adjClose: 100 }]);
    expect(result).toEqual({ '1M': null, '3M': null, '1Y': null, '3Y': null, '5Y': null });
  });

  it('computes 1M return with 2 data points', () => {
    const prices: PricePoint[] = [
      { date: '2020-01', close: 100, adjClose: 100 },
      { date: '2020-02', close: 110, adjClose: 110 },
    ];
    const result = computePeriodReturns(prices);
    expect(result['1M']).toBeCloseTo(0.1, 6);
    expect(result['3M']).toBeNull();
    expect(result['1Y']).toBeNull();
    expect(result['3Y']).toBeNull();
    expect(result['5Y']).toBeNull();
  });

  it('computes all periods with 61 data points', () => {
    const prices = makePrices(61);
    const result = computePeriodReturns(prices);

    // latest = close 160 (index 60), 1M ago = close 159 (index 59)
    expect(result['1M']).toBeCloseTo((160 - 159) / 159, 6);
    // 3M ago = close 157 (index 57)
    expect(result['3M']).toBeCloseTo((160 - 157) / 157, 6);
    // 1Y ago = close 148 (index 48)
    expect(result['1Y']).toBeCloseTo((160 - 148) / 148, 6);
    // 3Y ago = close 124 (index 24)
    expect(result['3Y']).toBeCloseTo((160 - 124) / 124, 6);
    // 5Y ago = close 100 (index 0)
    expect(result['5Y']).toBeCloseTo((160 - 100) / 100, 6);
  });

  it('returns null for periods with insufficient data', () => {
    // 6 months of data: enough for 1M and 3M, not 1Y/3Y/5Y
    const prices = makePrices(6);
    const result = computePeriodReturns(prices);

    expect(result['1M']).not.toBeNull();
    expect(result['3M']).not.toBeNull();
    expect(result['1Y']).toBeNull();
    expect(result['3Y']).toBeNull();
    expect(result['5Y']).toBeNull();
  });

  it('handles zero-price edge case without division by zero', () => {
    const prices: PricePoint[] = [
      { date: '2020-01', close: 0, adjClose: 0 },
      { date: '2020-02', close: 50, adjClose: 50 },
    ];
    const result = computePeriodReturns(prices);
    // past.close is 0, so the return should remain null (no division by zero)
    expect(result['1M']).toBeNull();
  });
});
