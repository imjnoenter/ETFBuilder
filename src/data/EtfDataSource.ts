import type { AssetClass, Etf, EtfFilters, PricePoint } from './types'

/**
 * Swappable data source interface for ETF data.
 * Implementations: FixtureEtfDataSource (curated JSON), YahooEtfDataSource (future live).
 */
export interface EtfDataSource {
  /** Search ETFs by text query (ticker/name) with optional filters */
  searchEtfs(query: string, filters?: EtfFilters): Promise<Etf[]>;

  /** Get a single ETF by ticker, or null if not found */
  getEtf(ticker: string): Promise<Etf | null>;

  /** Get monthly price history for a ticker */
  getPriceHistory(ticker: string): Promise<PricePoint[]>;

  /** List all available asset classes in the data set */
  listAssetClasses(): AssetClass[];
}
