import { useEffect, useState } from 'react';
import type { Etf, EtfSort } from '../../data/types';
import type { EtfLookupError } from '../../data/HybridEtfDataSource';
import { dataSource } from '../../data';
import { computePeriodReturns, type PeriodReturns } from '../../lib/returns';
import { EtfRow } from './EtfRow';
import styles from './ResultsList.module.css';

interface ResultsListProps {
  results: Etf[];
  loading: boolean;
  hydrating: string | null;
  lookupError: EtfLookupError | null;
  stockHint: string | null;
  sort: EtfSort;
  portfolioTickers: string[];
  onSortChange: (sort: EtfSort) => void;
  onAdd: (ticker: string) => void;
  onClick: (ticker: string) => void;
}

type SortableField = 'ticker' | 'name' | 'assetClass' | 'risk' | 'expenseRatio' | 'dividendYield';

const COLUMNS: { field: SortableField; label: string; align: 'left' | 'right' }[] = [
  { field: 'ticker', label: 'Ticker', align: 'left' },
  { field: 'name', label: 'Name', align: 'left' },
  { field: 'assetClass', label: 'Class', align: 'left' },
  { field: 'risk', label: 'Risk', align: 'left' },
  { field: 'expenseRatio', label: 'ER', align: 'right' },
  { field: 'dividendYield', label: 'Yield', align: 'right' },
];

const TOTAL_COLS = COLUMNS.length + 5;

export function ResultsList({
  results,
  loading,
  hydrating,
  lookupError,
  stockHint,
  sort,
  portfolioTickers,
  onSortChange,
  onAdd,
  onClick,
}: ResultsListProps) {
  const [sparkData, setSparkData] = useState<Record<string, { spark: number[]; returns: PeriodReturns }>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadSpark() {
      const newData: Record<string, { spark: number[]; returns: PeriodReturns }> = {};
      for (const etf of results) {
        if (etf.hydrated === false) continue;
        if (sparkData[etf.ticker]) {
          newData[etf.ticker] = sparkData[etf.ticker];
          continue;
        }
        try {
          const history = await dataSource.getPriceHistory(etf.ticker);
          const recent = history.slice(-12).map((p) => p.close);
          newData[etf.ticker] = { spark: recent, returns: computePeriodReturns(history) };
        } catch {
          newData[etf.ticker] = { spark: [], returns: { '1M': null, '3M': null, '1Y': null, '3Y': null, '5Y': null } };
        }
      }
      if (!cancelled) setSparkData((prev) => ({ ...prev, ...newData }));
    }
    loadSpark();
    return () => { cancelled = true; };
  }, [results]);

  function handleSort(field: SortableField) {
    const direction =
      sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ field, direction });
  }

  const showHydrating = hydrating && results.length === 0;
  const showError = lookupError && !loading;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colAdd} />
            <col className={styles.colTicker} />
            <col className={styles.colName} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colSpark} />
          </colgroup>
          <thead>
            <tr>
              <th aria-hidden="true" />
              {COLUMNS.map((col, i) => (
                <th
                  key={col.field}
                  className={`${i === 0 ? styles.stickyCorner : ''} ${sort.field === col.field ? styles.activeSort : ''}`}
                  style={{ textAlign: col.align }}
                  onClick={() => handleSort(col.field)}
                >
                  {col.label}
                  {sort.field === col.field && (
                    <span className={styles.sortArrow}>
                      {sort.direction === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </th>
              ))}
              <th style={{ textAlign: 'right' }}>1-Mo</th>
              <th style={{ textAlign: 'right' }}>3-Mo</th>
              <th style={{ textAlign: 'right' }}>1-Yr</th>
              <th style={{ textAlign: 'center' }}>1Y</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={TOTAL_COLS} className={styles.statusCell}>Searching...</td></tr>
            ) : showHydrating ? (
              <tr><td colSpan={TOTAL_COLS} className={styles.statusCell}>Looking up {hydrating}...</td></tr>
            ) : showError ? (
              <tr><td colSpan={TOTAL_COLS} className={styles.statusCell}>{lookupError.message}</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={TOTAL_COLS} className={styles.statusCell}>No ETFs match your criteria</td></tr>
            ) : (
              <>
                {stockHint && (
                  <tr><td colSpan={TOTAL_COLS} className={styles.hintCell}>{stockHint}</td></tr>
                )}
                {results.map((etf) => (
                  <EtfRow
                    key={etf.ticker}
                    etf={etf}
                    priceData={sparkData[etf.ticker]?.spark ?? []}
                    returns={sparkData[etf.ticker]?.returns ?? null}
                    isInPortfolio={portfolioTickers.includes(etf.ticker)}
                    isHydrating={hydrating === etf.ticker}
                    onAdd={onAdd}
                    onClick={onClick}
                  />
                ))}
                {lookupError && (
                  <tr><td colSpan={TOTAL_COLS} className={styles.statusCell}>{lookupError.message}</td></tr>
                )}
                {hydrating && results.length > 0 && !results.some((e) => e.ticker === hydrating) && (
                  <tr><td colSpan={TOTAL_COLS} className={styles.statusCell}>Looking up {hydrating}...</td></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {!loading && results.length > 0 && (
        <div className={styles.count}>{results.length} ETFs</div>
      )}
    </div>
  );
}
