import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssetClass, Etf, Position, PricePoint, QuoteData, TrailingReturns } from '../data/types';
import { computePeriodReturns } from '../lib/returns';
import {
  allocatedPct,
  assetClassMix,
  balanceTo100,
  blendedMetric,
  equalize,
  remainingPct,
} from '../lib/portfolio';

// ── Saved portfolio type ──

export interface SavedPortfolio {
  name: string;
  positions: Position[];
  portfolioValue: number;
  taxRate: number;
}

export interface BuilderState {
  /** Current portfolio positions */
  positions: Position[];

  /** Current portfolio name */
  portfolioName: string;

  /** Total portfolio value in dollars */
  portfolioValue: number;

  /** Tax rate for dividend withholding (0-100) */
  taxRate: number;

  /** Saved portfolios */
  savedPortfolios: SavedPortfolio[];

  /** Cached ETF data for positions (populated by UI) */
  etfCache: Map<string, Etf>;

  /** Cached price histories for positions (populated by UI) */
  priceCache: Map<string, PricePoint[]>;

  /** Cached live quote data for positions */
  quoteCache: Map<string, QuoteData>;

  /** Cached trailing returns from Yahoo fundPerformance */
  trailingReturnsCache: Map<string, TrailingReturns>;

  /** True while the holdings-count fetch is in flight */
  holdingsLoading: boolean;

  // ── Actions ──
  addPosition: (ticker: string) => void;
  removePosition: (ticker: string) => void;
  setWeight: (ticker: string, weight: number) => void;
  equalizeWeights: () => void;
  balanceTo100: () => void;
  reset: () => void;
  cacheEtf: (ticker: string, etf: Etf) => void;
  cachePrices: (ticker: string, prices: PricePoint[]) => void;
  cacheQuotes: (quotes: Record<string, QuoteData>) => void;
  cacheTrailingReturns: (results: Record<string, TrailingReturns>) => void;
  setHoldingsLoading: (loading: boolean) => void;
  setPortfolioName: (name: string) => void;
  setPortfolioValue: (value: number) => void;
  setTaxRate: (rate: number) => void;
  savePortfolio: () => void;
  loadPortfolio: (index: number) => void;
  deletePortfolio: (index: number) => void;

  // ── Derived (computed on access) ──
  getAllocatedPct: () => number;
  getRemainingPct: () => number;
  getBlendedExpenseRatio: () => number | null;
  getBlendedDividendYield: () => number | null;
  getBlended1YReturn: () => number | null;
  getBlendedRisk: () => number | null;
  getAssetClassMix: () => Array<{ assetClass: AssetClass; weight: number }>;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      positions: [],
      portfolioName: 'My Portfolio',
      portfolioValue: 10000,
      taxRate: 15,
      savedPortfolios: [],
      etfCache: new Map(),
      priceCache: new Map(),
      quoteCache: new Map(),
      trailingReturnsCache: new Map(),
      holdingsLoading: false,

      addPosition: (ticker: string) => {
        const { positions } = get();
        if (positions.some((p) => p.ticker === ticker)) return;
        set({ positions: [...positions, { ticker, weight: 0 }] });
      },

      removePosition: (ticker: string) => {
        set({ positions: get().positions.filter((p) => p.ticker !== ticker) });
      },

      setWeight: (ticker: string, weight: number) => {
        const { positions } = get();
        const othersTotal = positions.reduce((s, p) => s + (p.ticker === ticker ? 0 : p.weight), 0);
        const maxForThis = Math.round((100 - othersTotal) * 100) / 100;
        set({
          positions: positions.map((p) =>
            p.ticker === ticker ? { ...p, weight: Math.max(0, Math.min(maxForThis, weight)) } : p
          ),
        });
      },

      equalizeWeights: () => {
        set({ positions: equalize(get().positions) });
      },

      balanceTo100: () => {
        set({ positions: balanceTo100(get().positions) });
      },

      reset: () => {
        set({
          positions: [],
          portfolioName: 'My Portfolio',
          portfolioValue: 10000,
          taxRate: 15,
          etfCache: new Map(),
          priceCache: new Map(),
          quoteCache: new Map(),
          trailingReturnsCache: new Map(),
          holdingsLoading: false,
        });
      },

      cacheEtf: (ticker: string, etf: Etf) => {
        const cache = new Map(get().etfCache);
        cache.set(ticker, etf);
        set({ etfCache: cache });
      },

      cachePrices: (ticker: string, prices: PricePoint[]) => {
        const cache = new Map(get().priceCache);
        cache.set(ticker, prices);
        set({ priceCache: cache });
      },

      cacheQuotes: (quotes: Record<string, QuoteData>) => {
        const cache = new Map(get().quoteCache);
        for (const [sym, data] of Object.entries(quotes)) {
          cache.set(sym, data);
        }
        set({ quoteCache: cache });
      },

      cacheTrailingReturns: (results: Record<string, TrailingReturns>) => {
        const cache = new Map(get().trailingReturnsCache);
        for (const [sym, data] of Object.entries(results)) {
          cache.set(sym, data);
        }
        set({ trailingReturnsCache: cache });
      },

      setHoldingsLoading: (loading: boolean) => set({ holdingsLoading: loading }),
      setPortfolioName: (name: string) => set({ portfolioName: name }),
      setPortfolioValue: (value: number) => set({ portfolioValue: value }),
      setTaxRate: (rate: number) => set({ taxRate: rate }),

      savePortfolio: () => {
        const { portfolioName, positions, portfolioValue, taxRate, savedPortfolios } = get();
        const existing = savedPortfolios.findIndex((p) => p.name === portfolioName);
        const entry: SavedPortfolio = { name: portfolioName, positions, portfolioValue, taxRate };
        const updated = [...savedPortfolios];
        if (existing >= 0) {
          updated[existing] = entry;
        } else {
          updated.push(entry);
        }
        set({ savedPortfolios: updated });
      },

      loadPortfolio: (index: number) => {
        const { savedPortfolios, portfolioName, positions, portfolioValue, taxRate } = get();
        const target = savedPortfolios[index];
        if (!target) return;
        // Auto-save current before switching
        const currentIdx = savedPortfolios.findIndex((p) => p.name === portfolioName);
        const currentEntry: SavedPortfolio = { name: portfolioName, positions, portfolioValue, taxRate };
        const updated = [...savedPortfolios];
        if (currentIdx >= 0) {
          updated[currentIdx] = currentEntry;
        } else if (positions.length > 0) {
          updated.push(currentEntry);
        }
        set({
          savedPortfolios: updated,
          portfolioName: target.name,
          positions: target.positions,
          portfolioValue: target.portfolioValue,
          taxRate: target.taxRate,
          etfCache: new Map(),
          priceCache: new Map(),
          quoteCache: new Map(),
          trailingReturnsCache: new Map(),
        });
      },

      deletePortfolio: (index: number) => {
        const updated = get().savedPortfolios.filter((_, i) => i !== index);
        set({ savedPortfolios: updated });
      },

      // Derived accessors
      getAllocatedPct: () => allocatedPct(get().positions),
      getRemainingPct: () => remainingPct(get().positions),

      getBlendedExpenseRatio: () =>
        blendedMetric(get().positions, get().etfCache, 'expenseRatio'),

      getBlendedDividendYield: () =>
        blendedMetric(get().positions, get().etfCache, 'dividendYield'),

      getBlended1YReturn: () => {
        const { positions, trailingReturnsCache, priceCache } = get();
        let weightedSum = 0;
        let totalWeight = 0;
        for (const pos of positions) {
          const val = trailingReturnsCache.get(pos.ticker)?.['1Y'] ?? computePeriodReturns(priceCache.get(pos.ticker))['1Y'];
          if (val != null) {
            weightedSum += pos.weight * val;
            totalWeight += pos.weight;
          }
        }
        return totalWeight > 0 ? weightedSum / totalWeight : null;
      },

      getBlendedRisk: () => {
        const raw = blendedMetric(get().positions, get().etfCache, 'risk');
        return raw != null ? Math.round(raw) : null;
      },

      getAssetClassMix: () =>
        assetClassMix(get().positions, get().etfCache),
    }),
    {
      name: 'etfbuilder-portfolio',
      partialize: (state) => ({
        positions: state.positions,
        portfolioName: state.portfolioName,
        portfolioValue: state.portfolioValue,
        taxRate: state.taxRate,
        savedPortfolios: state.savedPortfolios,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<BuilderState>),
        etfCache: new Map(),
        priceCache: new Map(),
        quoteCache: new Map(),
        trailingReturnsCache: new Map(),
      }),
    }
  )
);
