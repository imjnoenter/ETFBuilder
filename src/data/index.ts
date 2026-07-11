import type { EtfDataSource } from './EtfDataSource';
import { FixtureEtfDataSource } from './fixtures/FixtureEtfDataSource';
import { HybridEtfDataSource } from './HybridEtfDataSource';
import { YahooEtfDataSource } from './yahoo/YahooEtfDataSource';

/**
 * Select data source based on environment variable.
 *
 * VITE_DATA_SOURCE=yahoo   -> YahooEtfDataSource (stub — requires /api proxy)
 * VITE_DATA_SOURCE=fixture -> FixtureEtfDataSource (curated core only)
 * VITE_DATA_SOURCE=hybrid  -> HybridEtfDataSource (default)
 * (unset)                  -> HybridEtfDataSource (default)
 */
function createDataSource(): EtfDataSource {
  const source = import.meta.env.VITE_DATA_SOURCE;

  if (source === 'yahoo') {
    return new YahooEtfDataSource();
  }

  if (source === 'fixture') {
    return new FixtureEtfDataSource();
  }

  // Default: hybrid (rich core + index search + live proxy hydration)
  return new HybridEtfDataSource();
}

/** Singleton data source instance, selected by VITE_DATA_SOURCE env var */
export const dataSource: EtfDataSource = createDataSource();

export { EtfLookupError } from './HybridEtfDataSource';
export type { EtfDataSource } from './EtfDataSource';
export type {
  AssetClass,
  Etf,
  EtfFilters,
  EtfIndexEntry,
  EtfSort,
  Holding,
  Position,
  PricePoint,
  RiskBand,
  SectorWeight,
} from './types';
