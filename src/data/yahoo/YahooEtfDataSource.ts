import type { AssetClass, Etf, EtfFilters, PricePoint } from '../types';
import type { EtfDataSource } from '../EtfDataSource';

/**
 * Live Yahoo Finance data source — STUB.
 *
 * TODO: Requires a backend /api proxy to avoid CORS issues with Yahoo Finance.
 * When implementing:
 * 1. Stand up a server endpoint (e.g., /api/yahoo/quote/:ticker)
 * 2. The proxy calls yahoo-finance2 server-side and returns JSON
 * 3. This class fetches from the proxy, not Yahoo directly
 *
 * For now, all methods throw with a helpful message.
 */
export class YahooEtfDataSource implements EtfDataSource {
  async searchEtfs(_query: string, _filters?: EtfFilters): Promise<Etf[]> {
    throw new Error(
      'YahooEtfDataSource is not yet implemented. ' +
      'A backend /api proxy is needed. See YahooEtfDataSource.ts for details.'
    );
  }

  async getEtf(_ticker: string): Promise<Etf | null> {
    throw new Error(
      'YahooEtfDataSource is not yet implemented. ' +
      'A backend /api proxy is needed. See YahooEtfDataSource.ts for details.'
    );
  }

  async getPriceHistory(_ticker: string): Promise<PricePoint[]> {
    throw new Error(
      'YahooEtfDataSource is not yet implemented. ' +
      'A backend /api proxy is needed. See YahooEtfDataSource.ts for details.'
    );
  }

  listAssetClasses(): AssetClass[] {
    return ['Equity', 'Bond', 'Commodity', 'Real Estate', 'Multi-Asset', 'Other'];
  }
}
