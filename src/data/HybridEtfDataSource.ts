import type { AssetClass, Etf, EtfFilters, EtfIndexEntry, PricePoint, RiskBand } from './types';
import type { EtfDataSource } from './EtfDataSource';
import { FixtureEtfDataSource } from './fixtures/FixtureEtfDataSource';

// ── Error type for hydration failures ──────────────────────────────────

export type EtfLookupErrorKind = 'not_found' | 'not_etf' | 'upstream';

export class EtfLookupError extends Error {
  readonly kind: EtfLookupErrorKind;
  readonly ticker: string;
  readonly quoteType?: string;

  constructor(kind: EtfLookupErrorKind, ticker: string, quoteType?: string) {
    const messages: Record<EtfLookupErrorKind, string> = {
      not_found: `No ETF found for ${ticker}`,
      not_etf: `${ticker} is ${quoteType === 'MUTUALFUND' ? 'a mutual fund' : 'a stock'}, not an ETF`,
      upstream: "Couldn't reach data service — try again",
    };
    super(messages[kind]);
    this.name = 'EtfLookupError';
    this.kind = kind;
    this.ticker = ticker;
    this.quoteType = quoteType;
  }
}

// ── localStorage live-cache ────────────────────────────────────────────

interface LiveCacheEntry {
  etf: Etf;
  prices: PricePoint[];
  fetchedAt: number;
}

const LIVE_CACHE_KEY = 'etfbuilder-livecache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readLiveCache(): Record<string, LiveCacheEntry> {
  try {
    const raw = localStorage.getItem(LIVE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LiveCacheEntry>) : {};
  } catch {
    return {};
  }
}

function writeLiveCache(cache: Record<string, LiveCacheEntry>): void {
  try {
    localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function migratePrices(prices: PricePoint[]): PricePoint[] {
  if (prices.length > 0 && prices[0].adjClose == null) {
    return prices.map((pt) => ({ ...pt, adjClose: pt.close }));
  }
  return prices;
}

function getCached(ticker: string): LiveCacheEntry | null {
  const entry = readLiveCache()[ticker];
  if (!entry) return null;
  entry.prices = migratePrices(entry.prices);
  return entry;
}

function setCached(ticker: string, etf: Etf, prices: PricePoint[]): void {
  const cache = readLiveCache();
  cache[ticker] = { etf, prices, fetchedAt: Date.now() };
  writeLiveCache(cache);
}

// ── Index stub builder ─────────────────────────────────────────────────

/**
 * Build a partial Etf object from an index entry. All numeric/detail
 * fields are null/empty; `hydrated` is explicitly `false` so the UI
 * can detect these stubs and show "--" cells.
 */
function indexEntryToStub(entry: EtfIndexEntry): Etf {
  return {
    ticker: entry.ticker,
    name: entry.name,
    issuer: null,
    assetClass: entry.assetClass,
    risk: 3 as RiskBand, // neutral sentinel — UI never displays this for stubs
    riskLabel: 'Moderate',
    expenseRatio: null,
    aum: null,
    inceptionDate: null,
    dividendYield: null,
    stdDev: null,
    beta: null,
    numberOfHoldings: null,
    topHoldings: [],
    sectorWeights: [],
    assetBreakdown: {},
    overview: '',
    hydrated: false,
  };
}

// ── Proxy hydration ────────────────────────────────────────────────────

interface ProxyResponse {
  etf: Etf;
  prices: PricePoint[];
}

async function hydrateViaProxy(ticker: string): Promise<ProxyResponse> {
  let res: Response;
  try {
    res = await fetch(`/api/etf/${encodeURIComponent(ticker)}`);
  } catch {
    throw new EtfLookupError('upstream', ticker);
  }

  if (res.ok) {
    const data = (await res.json()) as ProxyResponse;
    return data;
  }

  // Error responses
  const body = await res.json().catch(() => null) as Record<string, string> | null;
  if (res.status === 404) {
    throw new EtfLookupError('not_found', ticker);
  }
  if (res.status === 422) {
    throw new EtfLookupError('not_etf', ticker, body?.quoteType);
  }
  // 400, 502, or anything else
  throw new EtfLookupError('upstream', ticker);
}

// ── Helper: check if numeric filters are active ────────────────────────

function hasNumericFilters(filters?: EtfFilters): boolean {
  if (!filters) return false;
  return (
    filters.riskBand != null && filters.riskBand.length > 0 ||
    filters.expenseRatioMin != null ||
    filters.expenseRatioMax != null ||
    filters.minYield != null
  );
}

// ── HybridEtfDataSource ───────────────────────────────────────────────

/**
 * Three-layer data source:
 * 1. Rich curated core (FixtureEtfDataSource) — full data + prices at build time
 * 2. Lightweight index (etfIndex.json) — 5000+ tickers for search matching
 * 3. Live proxy hydration — on-demand via /api/etf/:ticker, cached in localStorage
 */
export class HybridEtfDataSource implements EtfDataSource {
  private readonly core = new FixtureEtfDataSource();
  private indexPromise: Promise<EtfIndexEntry[]> | null = null;
  /** In-memory cache so the same session doesn't re-parse localStorage repeatedly */
  private memoryCache = new Map<string, { etf: Etf; prices: PricePoint[] }>();

  // ── Index lazy-loader ──

  private loadIndex(): Promise<EtfIndexEntry[]> {
    if (!this.indexPromise) {
      this.indexPromise = import('./fixtures/etfIndex.json').then(
        (mod) => (mod.default as unknown as { data: EtfIndexEntry[] }).data,
      );
    }
    return this.indexPromise;
  }

  // ── EtfDataSource interface ──

  async searchEtfs(query: string, filters?: EtfFilters): Promise<Etf[]> {
    // No query → core fixtures only (current behavior)
    if (!query || !query.trim()) {
      return this.core.searchEtfs('', filters);
    }

    const q = query.trim().toLowerCase();

    // (a) Rich-core matches
    const coreAll = await this.core.searchEtfs('', undefined);
    const coreMatches = coreAll.filter(
      (e) =>
        e.ticker.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q),
    );
    // Apply filters to core matches
    const coreFiltered = applyFilters(coreMatches, filters);

    // Collect core tickers for dedup
    const coreTickers = new Set(coreAll.map((e) => e.ticker));

    // Also check live cache for previously hydrated tickers
    const liveCache = readLiveCache();

    // (b) Index matches not in core
    const index = await this.loadIndex();
    const indexMatches = index.filter(
      (e) =>
        !coreTickers.has(e.ticker) &&
        (e.ticker.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)),
    );

    // Convert index matches: prefer live-cached hydrated version, else stub
    const indexAsEtfs: Etf[] = [];
    for (const entry of indexMatches) {
      // Check in-memory cache first, then localStorage
      const mem = this.memoryCache.get(entry.ticker);
      if (mem) {
        indexAsEtfs.push(mem.etf);
        continue;
      }
      const cached = liveCache[entry.ticker];
      if (cached) {
        // Kick off background refresh if stale
        if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
          this.backgroundRefresh(entry.ticker);
        }
        indexAsEtfs.push(cached.etf);
        continue;
      }
      indexAsEtfs.push(indexEntryToStub(entry));
    }

    // Filter index-only results
    const indexFiltered = applyFiltersForIndex(indexAsEtfs, filters);

    // Union: core first, then index, cap at 50
    const cap = 50;
    const results: Etf[] = [...coreFiltered];
    for (const etf of indexFiltered) {
      if (results.length >= cap) break;
      results.push(etf);
    }

    return results;
  }

  async getEtf(ticker: string): Promise<Etf | null> {
    // 1. In-memory cache
    const mem = this.memoryCache.get(ticker);
    if (mem) return mem.etf;

    // 2. Live localStorage cache
    const cached = getCached(ticker);
    if (cached) {
      this.memoryCache.set(ticker, { etf: cached.etf, prices: cached.prices });
      // Soft refresh if stale
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        this.backgroundRefresh(ticker);
      }
      return cached.etf;
    }

    // 3. Rich core
    const coreEtf = await this.core.getEtf(ticker);
    if (coreEtf) return coreEtf;

    // 4. Hydrate via proxy (may throw EtfLookupError)
    const result = await hydrateViaProxy(ticker);
    this.memoryCache.set(ticker, result);
    setCached(ticker, result.etf, result.prices);
    return result.etf;
  }

  async getPriceHistory(ticker: string): Promise<PricePoint[]> {
    // 1. In-memory cache
    const mem = this.memoryCache.get(ticker);
    if (mem) return mem.prices;

    // 2. Live localStorage cache
    const cached = getCached(ticker);
    if (cached) {
      this.memoryCache.set(ticker, { etf: cached.etf, prices: cached.prices });
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        this.backgroundRefresh(ticker);
      }
      return cached.prices;
    }

    // 3. Rich core
    const corePrices = await this.core.getPriceHistory(ticker);
    if (corePrices.length > 0) return corePrices;

    // 4. Hydrate via proxy
    const result = await hydrateViaProxy(ticker);
    this.memoryCache.set(ticker, result);
    setCached(ticker, result.etf, result.prices);
    return result.prices;
  }

  async isKnownTicker(ticker: string): Promise<boolean> {
    const coreEtf = await this.core.getEtf(ticker);
    if (coreEtf) return true;
    const index = await this.loadIndex();
    return index.some(e => e.ticker === ticker);
  }

  listAssetClasses(): AssetClass[] {
    return ['Equity', 'Bond', 'Commodity', 'Real Estate', 'Multi-Asset', 'Other'];
  }

  // ── Background refresh (soft, never blocks) ──

  private backgroundRefresh(ticker: string): void {
    hydrateViaProxy(ticker)
      .then((result) => {
        this.memoryCache.set(ticker, result);
        setCached(ticker, result.etf, result.prices);
      })
      .catch(() => {
        // Background refresh failed — stale cache is fine
      });
  }
}

// ── Filter helpers ─────────────────────────────────────────────────────

/** Apply all filters to fully-hydrated ETF rows (core or live-cached). */
function applyFilters(etfs: Etf[], filters?: EtfFilters): Etf[] {
  if (!filters) return etfs;
  let results = etfs;

  if (filters.assetClass?.length) {
    results = results.filter((e) => filters.assetClass!.includes(e.assetClass));
  }
  if (filters.riskBand?.length) {
    results = results.filter((e) => filters.riskBand!.includes(e.risk));
  }
  if (filters.expenseRatioMin != null) {
    results = results.filter(
      (e) => e.expenseRatio != null && e.expenseRatio >= filters.expenseRatioMin!,
    );
  }
  if (filters.expenseRatioMax != null) {
    results = results.filter(
      (e) => e.expenseRatio != null && e.expenseRatio <= filters.expenseRatioMax!,
    );
  }
  if (filters.minYield != null) {
    results = results.filter(
      (e) => e.dividendYield != null && e.dividendYield >= filters.minYield!,
    );
  }
  return results;
}

/**
 * Apply filters to index-derived ETF rows.
 * Index stubs (hydrated===false) only have ticker/name/assetClass.
 * If numeric filters are active, exclude unhydrated stubs (can't match
 * on data they don't have). Hydrated cached rows get full filtering.
 */
function applyFiltersForIndex(etfs: Etf[], filters?: EtfFilters): Etf[] {
  if (!filters) return etfs;

  const numericActive = hasNumericFilters(filters);

  return etfs.filter((e) => {
    // assetClass filter applies to all rows
    if (filters.assetClass?.length && !filters.assetClass.includes(e.assetClass)) {
      return false;
    }

    // For unhydrated stubs, exclude if any numeric filter is active
    if (e.hydrated === false) {
      return !numericActive;
    }

    // Hydrated (cached) — apply full filters
    if (filters.riskBand?.length && !filters.riskBand.includes(e.risk)) {
      return false;
    }
    if (filters.expenseRatioMin != null) {
      if (e.expenseRatio == null || e.expenseRatio < filters.expenseRatioMin) return false;
    }
    if (filters.expenseRatioMax != null) {
      if (e.expenseRatio == null || e.expenseRatio > filters.expenseRatioMax) return false;
    }
    if (filters.minYield != null) {
      if (e.dividendYield == null || e.dividendYield < filters.minYield) return false;
    }
    return true;
  });
}
