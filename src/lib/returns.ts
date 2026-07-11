import type { PricePoint } from '../data/types';

export interface PeriodReturns {
  '1M': number | null;
  '3M': number | null;
  '1Y': number | null;
  '3Y': number | null;
  '5Y': number | null;
}

const PERIODS: { key: keyof PeriodReturns; months: number }[] = [
  { key: '1M', months: 1 },
  { key: '3M', months: 3 },
  { key: '1Y', months: 12 },
  { key: '3Y', months: 36 },
  { key: '5Y', months: 60 },
];

export function computePeriodReturns(prices: PricePoint[] | undefined): PeriodReturns {
  const result: PeriodReturns = { '1M': null, '3M': null, '1Y': null, '3Y': null, '5Y': null };
  if (!prices || prices.length < 2) return result;

  const latest = prices[prices.length - 1];
  for (const { key, months } of PERIODS) {
    const idx = prices.length - 1 - months;
    if (idx >= 0) {
      const past = prices[idx];
      if (past.close > 0) {
        result[key] = (latest.close - past.close) / past.close;
      }
    }
  }
  return result;
}
