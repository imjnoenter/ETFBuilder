import { useCallback, useEffect, useRef, useState } from 'react';
import { dataSource } from '../../data';
import { EtfLookupError } from '../../data/HybridEtfDataSource';
import type { AssetClass, Etf, EtfSort } from '../../data/types';
import { useScreenerStore } from '../../store/screenerStore';
import { useBuilderStore } from '../../store/builderStore';
import etfsJson from '../../data/fixtures/etfs.json';
import { SearchBar } from './SearchBar';
import { FilterControls } from './FilterControls';
import { ResultsList } from './ResultsList';
import styles from './ScreenerPanel.module.css';

const isSynthetic = (etfsJson as unknown as { _synthetic?: boolean })._synthetic === true;

/** All asset classes supported by the hybrid source */
const ASSET_CLASSES: AssetClass[] = dataSource.listAssetClasses();

interface ScreenerPanelProps {
  onEtfClick: (ticker: string) => void;
}

export function ScreenerPanel({ onEtfClick }: ScreenerPanelProps) {
  const [showFilters, setShowFilters] = useState(false);

  const query = useScreenerStore((s) => s.query);
  const filters = useScreenerStore((s) => s.filters);
  const sort = useScreenerStore((s) => s.sort);
  const results = useScreenerStore((s) => s.results);
  const loading = useScreenerStore((s) => s.loading);
  const hydrating = useScreenerStore((s) => s.hydrating);
  const lookupError = useScreenerStore((s) => s.lookupError);
  const stockHint = useScreenerStore((s) => s.stockHint);

  const setQuery = useScreenerStore((s) => s.setQuery);
  const setAssetClassFilter = useScreenerStore((s) => s.setAssetClassFilter);
  const setRiskBandFilter = useScreenerStore((s) => s.setRiskBandFilter);
  const setExpenseRatioRange = useScreenerStore((s) => s.setExpenseRatioRange);
  const setMinYield = useScreenerStore((s) => s.setMinYield);
  const setSort = useScreenerStore((s) => s.setSort);
  const clearFilters = useScreenerStore((s) => s.clearFilters);
  const search = useScreenerStore((s) => s.search);
  const setHydrating = useScreenerStore((s) => s.setHydrating);
  const setLookupError = useScreenerStore((s) => s.setLookupError);
  const replaceResult = useScreenerStore((s) => s.replaceResult);

  const positions = useBuilderStore((s) => s.positions);
  const addPosition = useBuilderStore((s) => s.addPosition);
  const cacheEtf = useBuilderStore((s) => s.cacheEtf);
  const cachePrices = useBuilderStore((s) => s.cachePrices);

  const portfolioTickers = positions.map((p) => p.ticker);

  // Debounce search on query/filter/sort changes
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(dataSource);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, filters, sort, search]);

  // Initial search on mount
  useEffect(() => {
    search(dataSource);
  }, []);

  /**
   * Hydrate an un-hydrated ETF stub, then run a callback with the result.
   * Returns the hydrated Etf, or null on failure (error is surfaced inline).
   */
  const hydrateAndProceed = useCallback(
    async (ticker: string): Promise<Etf | null> => {
      setHydrating(ticker);
      setLookupError(null);
      try {
        const etf = await dataSource.getEtf(ticker);
        if (etf) {
          replaceResult(ticker, etf);
          setHydrating(null);
          return etf;
        }
        setHydrating(null);
        return null;
      } catch (err) {
        setHydrating(null);
        if (err instanceof EtfLookupError) {
          setLookupError(err);
        }
        return null;
      }
    },
    [setHydrating, setLookupError, replaceResult],
  );

  /**
   * Handle "+ Add" click. If the ETF is a stub, hydrate first.
   * A user must NOT be able to add an un-hydrated stub.
   */
  const handleAdd = useCallback(
    async (ticker: string) => {
      // Check if this is a stub row
      const row = results.find((e) => e.ticker === ticker);
      if (row && row.hydrated === false) {
        // Must hydrate before adding
        const etf = await hydrateAndProceed(ticker);
        if (!etf) return; // hydration failed — error shown inline
        addPosition(ticker);
        cacheEtf(ticker, etf);
        const prices = await dataSource.getPriceHistory(ticker);
        cachePrices(ticker, prices);
        return;
      }

      // Already hydrated — proceed normally
      addPosition(ticker);
      const etf = await dataSource.getEtf(ticker);
      if (etf) cacheEtf(ticker, etf);
      const prices = await dataSource.getPriceHistory(ticker);
      cachePrices(ticker, prices);
    },
    [results, addPosition, cacheEtf, cachePrices, hydrateAndProceed],
  );

  /**
   * Handle row click (open profile). If the ETF is a stub, hydrate first.
   */
  const handleClick = useCallback(
    async (ticker: string) => {
      const row = results.find((e) => e.ticker === ticker);
      if (row && row.hydrated === false) {
        const etf = await hydrateAndProceed(ticker);
        if (!etf) return; // hydration failed
      }
      onEtfClick(ticker);
    },
    [results, onEtfClick, hydrateAndProceed],
  );

  const handleSortChange = useCallback(
    (newSort: EtfSort) => {
      setSort(newSort);
    },
    [setSort],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>ETF Screener</h2>
        {isSynthetic && <span className={styles.demoBadge}>Demo data</span>}
        <button
          className={`${styles.filtersToggle} ${showFilters ? styles.filtersToggleActive : ''}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters {showFilters ? '−' : '+'}
        </button>
      </div>

      <SearchBar value={query} onChange={setQuery} />

      {showFilters && (
        <FilterControls
          assetClasses={ASSET_CLASSES}
          selectedAssetClasses={filters.assetClass ?? []}
          selectedRiskBands={filters.riskBand ?? []}
          expenseRatioMin={filters.expenseRatioMin}
          expenseRatioMax={filters.expenseRatioMax}
          minYield={filters.minYield}
          onAssetClassChange={setAssetClassFilter}
          onRiskBandChange={setRiskBandFilter}
          onExpenseRatioChange={setExpenseRatioRange}
          onMinYieldChange={setMinYield}
          onClear={clearFilters}
        />
      )}

      <ResultsList
        results={results}
        loading={loading}
        hydrating={hydrating}
        lookupError={lookupError}
        stockHint={stockHint}
        sort={sort}
        portfolioTickers={portfolioTickers}
        onSortChange={handleSortChange}
        onAdd={handleAdd}
        onClick={handleClick}
      />
    </div>
  );
}
