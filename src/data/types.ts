/** Asset class categorization for ETFs */
export type AssetClass =
  | 'Equity'
  | 'Bond'
  | 'Commodity'
  | 'Real Estate'
  | 'Multi-Asset'
  | 'Other';

/** Risk band: 1 (Conservative) through 5 (Aggressive) */
export type RiskBand = 1 | 2 | 3 | 4 | 5;

/** Monthly price point for time-series data */
export interface PricePoint {
  /** Format: YYYY-MM */
  date: string;
  /** Unadjusted close price */
  close: number;
  /** Adjusted close (dividends reinvested + splits). Used for total-return charts. */
  adjClose: number;
}

/** A portfolio position: ticker + weight percentage */
export interface Position {
  ticker: string;
  weight: number;
}

/** A single holding within an ETF */
export interface Holding {
  symbol: string;
  name: string;
  weight: number;
}

/** Sector allocation within an ETF */
export interface SectorWeight {
  sector: string;
  weight: number;
}

/** Lightweight index entry (ticker + name + assetClass only) */
export interface EtfIndexEntry {
  ticker: string;
  name: string;
  assetClass: AssetClass;
}

/** Complete ETF data record */
export interface Etf {
  ticker: string;
  name: string;
  issuer: string | null;
  assetClass: AssetClass;
  risk: RiskBand;
  riskLabel: string;
  expenseRatio: number | null;
  aum: number | null;
  inceptionDate: string | null;
  dividendYield: number | null;
  stdDev: number | null;
  beta: number | null;
  numberOfHoldings: number | null;
  topHoldings: Holding[];
  sectorWeights: SectorWeight[];
  assetBreakdown: Record<string, number>;
  overview: string;
  /**
   * `false` for index-only stub rows that have not been hydrated via the
   * live proxy yet. UI uses this to show "--" cells and trigger on-demand
   * hydration. Omitted (undefined, treated as truthy) for fully hydrated
   * or curated-core ETFs.
   */
  hydrated?: boolean;
}

/** Screener filter options */
export interface EtfFilters {
  assetClass?: AssetClass[];
  riskBand?: RiskBand[];
  expenseRatioMin?: number;
  expenseRatioMax?: number;
  minYield?: number;
}

/** Sort configuration */
export interface EtfSort {
  field: keyof Etf;
  direction: 'asc' | 'desc';
}

/** Trailing period returns from Yahoo Finance fundPerformance */
export interface TrailingReturns {
  '1M': number | null;
  '3M': number | null;
  '1Y': number | null;
  '3Y': number | null;
  '5Y': number | null;
  fetchedAt: number;
}

/** Live quote snapshot from Yahoo Finance batch endpoint */
export interface QuoteData {
  symbol: string;
  shortName: string | null;
  regularMarketPrice: number | null;
  regularMarketVolume: number | null;
  ytdReturn: number | null;
  netExpenseRatio: number | null;
  grossExpenseRatio: number | null;
  netAssets: number | null;
  morningstarRating: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fetchedAt: number;
}
