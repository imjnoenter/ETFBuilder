import type { AssetClass, Etf, EtfFilters, PricePoint } from '../types';
import type { EtfDataSource } from '../EtfDataSource';
import etfsJson from './etfs.json';
import priceHistoryJson from './priceHistory.json';

const etfsData = etfsJson as unknown as { _synthetic: boolean; etfs: Etf[] };
const rawPriceData = priceHistoryJson as unknown as {
  _synthetic: boolean;
  data: Record<string, Array<{ date: string; close: number; adjClose?: number }>>;
};

// Migrate legacy fixtures that only have `close` (which was adjclose)
const priceData: { _synthetic: boolean; data: Record<string, PricePoint[]> } = {
  _synthetic: rawPriceData._synthetic,
  data: Object.fromEntries(
    Object.entries(rawPriceData.data).map(([ticker, pts]) => [
      ticker,
      pts.map((pt) => ({ date: pt.date, close: pt.close, adjClose: pt.adjClose ?? pt.close })),
    ])
  ),
};

if (etfsData._synthetic) {
  console.warn(
    '[ETFbuilder] Using synthetic fixture data. Run `npm run build-fixtures` with network access for real data.'
  );
}

/**
 * Data source backed by curated JSON fixtures.
 * Loaded at build time — no runtime network requests.
 */
export class FixtureEtfDataSource implements EtfDataSource {
  private readonly etfs: Etf[] = etfsData.etfs;
  private readonly prices: Record<string, PricePoint[]> = priceData.data;

  async searchEtfs(query: string, filters?: EtfFilters): Promise<Etf[]> {
    let results = this.etfs;

    // Text search: ticker or name
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (e) =>
          e.ticker.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)
      );
    }

    // Apply filters
    if (filters) {
      if (filters.assetClass?.length) {
        results = results.filter((e) => filters.assetClass!.includes(e.assetClass));
      }
      if (filters.riskBand?.length) {
        results = results.filter((e) => filters.riskBand!.includes(e.risk));
      }
      if (filters.expenseRatioMin != null) {
        results = results.filter(
          (e) => e.expenseRatio != null && e.expenseRatio >= filters.expenseRatioMin!
        );
      }
      if (filters.expenseRatioMax != null) {
        results = results.filter(
          (e) => e.expenseRatio != null && e.expenseRatio <= filters.expenseRatioMax!
        );
      }
      if (filters.minYield != null) {
        results = results.filter(
          (e) => e.dividendYield != null && e.dividendYield >= filters.minYield!
        );
      }
    }

    return results;
  }

  async getEtf(ticker: string): Promise<Etf | null> {
    return this.etfs.find((e) => e.ticker === ticker) ?? null;
  }

  async getPriceHistory(ticker: string): Promise<PricePoint[]> {
    return this.prices[ticker] ?? [];
  }

  listAssetClasses(): AssetClass[] {
    const classes = new Set(this.etfs.map((e) => e.assetClass));
    return Array.from(classes).sort() as AssetClass[];
  }
}
