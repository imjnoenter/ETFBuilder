import { create } from 'zustand';
import type { AssetClass, Etf, EtfFilters, EtfSort, RiskBand } from '../data/types';
import type { EtfDataSource } from '../data/EtfDataSource';
import { EtfLookupError } from '../data/HybridEtfDataSource';

export interface ScreenerState {
  /** Current search query (ticker/name text) */
  query: string;

  /** Active filters */
  filters: EtfFilters;

  /** Current sort configuration */
  sort: EtfSort;

  /** Search results from the data source */
  results: Etf[];

  /** Whether a search is in progress */
  loading: boolean;

  /** Ticker currently being hydrated via proxy (shown as "Looking up..." row) */
  hydrating: string | null;

  /** Error from a hydration attempt, shown inline in the results area */
  lookupError: EtfLookupError | null;

  /** When the query is a stock ticker but name-matched ETFs are shown */
  stockHint: string | null;

  // ── Actions ──
  setQuery: (query: string) => void;
  setAssetClassFilter: (classes: AssetClass[]) => void;
  setRiskBandFilter: (bands: RiskBand[]) => void;
  setExpenseRatioRange: (min?: number, max?: number) => void;
  setMinYield: (minYield?: number) => void;
  setSort: (sort: EtfSort) => void;
  clearFilters: () => void;

  /** Execute search against the data source */
  search: (dataSource: EtfDataSource) => Promise<void>;

  /** Set hydrating ticker (for "Looking up..." row) */
  setHydrating: (ticker: string | null) => void;

  /** Set lookup error */
  setLookupError: (error: EtfLookupError | null) => void;

  /** Replace a stub row with a hydrated Etf in results */
  replaceResult: (ticker: string, etf: Etf) => void;
}

const DEFAULT_SORT: EtfSort = { field: 'ticker', direction: 'asc' };

function sortResults(results: Etf[], sort: EtfSort): Etf[] {
  return [...results].sort((a, b) => {
    const aVal = a[sort.field];
    const bVal = b[sort.field];

    // Nulls sort last
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    let cmp: number;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      cmp = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal;
    } else {
      cmp = String(aVal).localeCompare(String(bVal));
    }

    return sort.direction === 'desc' ? -cmp : cmp;
  });
}

export const useScreenerStore = create<ScreenerState>()((set, get) => ({
  query: '',
  filters: {},
  sort: DEFAULT_SORT,
  results: [],
  loading: false,
  hydrating: null,
  lookupError: null,
  stockHint: null,

  setQuery: (query: string) => set({ query, lookupError: null, stockHint: null }),

  setAssetClassFilter: (classes: AssetClass[]) =>
    set({ filters: { ...get().filters, assetClass: classes.length ? classes : undefined } }),

  setRiskBandFilter: (bands: RiskBand[]) =>
    set({ filters: { ...get().filters, riskBand: bands.length ? bands : undefined } }),

  setExpenseRatioRange: (min?: number, max?: number) =>
    set({
      filters: {
        ...get().filters,
        expenseRatioMin: min,
        expenseRatioMax: max,
      },
    }),

  setMinYield: (minYield?: number) =>
    set({ filters: { ...get().filters, minYield } }),

  setSort: (sort: EtfSort) => {
    set({ sort, results: sortResults(get().results, sort) });
  },

  clearFilters: () =>
    set({ query: '', filters: {}, sort: DEFAULT_SORT, lookupError: null, stockHint: null }),

  search: async (dataSource: EtfDataSource) => {
    const { query, filters, sort } = get();
    set({ loading: true, lookupError: null, stockHint: null });
    try {
      const results = await dataSource.searchEtfs(query, filters);

      // Exact-ticker fallback: if query looks like a ticker, no core match,
      // and not in results at all, attempt a direct proxy hydration
      const trimmed = query.trim();
      const isTicker = /^[A-Z]{1,8}$/i.test(trimmed);
      const upperTicker = trimmed.toUpperCase();

      if (isTicker && results.length === 0) {
        // No results at all — attempt direct hydration
        set({ results: [], loading: false, hydrating: upperTicker });
        try {
          const etf = await dataSource.getEtf(upperTicker);
          if (etf) {
            set({ results: [etf], hydrating: null });
          } else {
            set({ hydrating: null });
          }
        } catch (err) {
          if (err instanceof EtfLookupError) {
            set({ hydrating: null, lookupError: err });
          } else {
            set({ hydrating: null });
          }
        }
        return;
      }

      // Check if exact ticker match exists but only as stub — if query is
      // an exact ticker and the only match is unhydrated, also try direct hydration
      if (isTicker) {
        const exactMatch = results.find(
          (e) => e.ticker.toUpperCase() === upperTicker,
        );
        if (exactMatch && exactMatch.hydrated === false) {
          // Show results now (with stub), kick off hydration in background
          set({ results: sortResults(results, sort), loading: false, hydrating: upperTicker });
          try {
            const etf = await dataSource.getEtf(upperTicker);
            if (etf) {
              // Replace the stub in results
              const current = get().results;
              const updated = current.map((e) =>
                e.ticker === upperTicker ? etf : e,
              );
              set({ results: updated, hydrating: null });
            } else {
              set({ hydrating: null });
            }
          } catch (err) {
            if (err instanceof EtfLookupError) {
              set({ hydrating: null, lookupError: err });
            } else {
              set({ hydrating: null });
            }
          }
          return;
        }
      }

      // Stock-hint banner: query looks like a ticker, results came back
      // (name-matched themed ETFs), but the query itself isn't a known ETF.
      let stockHint: string | null = null;
      if (isTicker && results.length > 0 && !results.some(e => e.ticker.toUpperCase() === upperTicker)) {
        const isKnown = 'isKnownTicker' in dataSource
          && typeof (dataSource as Record<string, unknown>).isKnownTicker === 'function'
          && await (dataSource as { isKnownTicker: (t: string) => Promise<boolean> }).isKnownTicker(upperTicker);
        if (!isKnown) {
          stockHint = `${upperTicker} is a stock — showing related ETFs`;
        }
      }

      set({ results: sortResults(results, sort), loading: false, stockHint });
    } catch (err) {
      console.error('Search failed:', err);
      set({ results: [], loading: false });
    }
  },

  setHydrating: (ticker: string | null) => set({ hydrating: ticker }),
  setLookupError: (error: EtfLookupError | null) => set({ lookupError: error }),

  replaceResult: (ticker: string, etf: Etf) => {
    const current = get().results;
    const updated = current.map((e) => (e.ticker === ticker ? etf : e));
    set({ results: updated });
  },
}));
