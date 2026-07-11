import { useState, useMemo } from 'react';
import { useBuilderStore } from '../../store/builderStore';
import { useQuotes } from '../../lib/useQuotes';
import { useTrailingReturns } from '../../lib/useTrailingReturns';
import { computePeriodReturns } from '../../lib/returns';
import { currency, percent, compactAum, compactVolume, number } from '../../lib/format';
import styles from './HoldingsTable.module.css';

const COLUMNS = [
  { key: 'symbol', label: 'Symbol', align: 'left' as const },
  { key: 'name', label: 'Name', align: 'left' as const },
  { key: 'price', label: 'Price', align: 'right' as const },
  { key: 'volume', label: 'Volume', align: 'right' as const },
  { key: 'ytdReturn', label: 'YTD', align: 'right' as const },
  { key: '1M', label: '1-Mo', align: 'right' as const },
  { key: '3M', label: '3-Mo', align: 'right' as const },
  { key: '1Y', label: '1-Yr', align: 'right' as const },
  { key: '3Y', label: '3-Yr', align: 'right' as const },
  { key: '5Y', label: '5-Yr', align: 'right' as const },
  { key: 'dividendYield', label: 'Yield', align: 'right' as const },
  { key: 'netER', label: 'Net ER', align: 'right' as const },
  { key: 'grossER', label: 'Gross ER', align: 'right' as const },
  { key: 'netAssets', label: 'Net Assets', align: 'right' as const },
  { key: 'holdings', label: 'Holdings', align: 'right' as const },
  { key: 'morningstar', label: 'M-Star', align: 'center' as const },
  { key: 'fiftyDayAvg', label: '50D Avg', align: 'right' as const },
  { key: 'twoHundredDayAvg', label: '200D Avg', align: 'right' as const },
  { key: 'range52w', label: '52W Range', align: 'center' as const },
  { key: 'sector', label: 'Sector', align: 'left' as const },
];

interface RowData {
  symbol: string;
  name: string;
  price: number | null;
  volume: number | null;
  ytdReturn: number | null;
  '1M': number | null;
  '3M': number | null;
  '1Y': number | null;
  '3Y': number | null;
  '5Y': number | null;
  dividendYield: number | null;
  netER: number | null;
  grossER: number | null;
  netAssets: number | null;
  holdings: number | null;
  morningstar: number | null;
  fiftyDayAvg: number | null;
  twoHundredDayAvg: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  sector: string;
}

type SortKey = string;
type SortDir = 'asc' | 'desc';

function returnClass(value: number | null): string {
  if (value == null) return styles.num;
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.num;
}

export default function HoldingsTable() {
  const positions = useBuilderStore((s) => s.positions);
  const etfCache = useBuilderStore((s) => s.etfCache);
  const priceCache = useBuilderStore((s) => s.priceCache);
  const quoteCache = useBuilderStore((s) => s.quoteCache);
  const trailingReturnsCache = useBuilderStore((s) => s.trailingReturnsCache);
  const { loading: quotesLoading, error } = useQuotes();
  const holdingsLoading = useBuilderStore((s) => s.holdingsLoading);
  useTrailingReturns();

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'symbol',
    dir: 'asc',
  });

  const rows = useMemo<RowData[]>(() => {
    return positions.map((pos) => {
      const quote = quoteCache.get(pos.ticker);
      const etf = etfCache.get(pos.ticker);
      const prices = priceCache.get(pos.ticker);
      const tr = trailingReturnsCache.get(pos.ticker);
      const periodReturns = tr ?? computePeriodReturns(prices);

      return {
        symbol: pos.ticker,
        name: quote?.shortName ?? etf?.name ?? pos.ticker,
        price: quote?.regularMarketPrice ?? null,
        volume: quote?.regularMarketVolume ?? null,
        ytdReturn: quote?.ytdReturn ?? null,
        '1M': periodReturns['1M'],
        '3M': periodReturns['3M'],
        '1Y': periodReturns['1Y'],
        '3Y': periodReturns['3Y'],
        '5Y': periodReturns['5Y'],
        dividendYield: etf?.dividendYield ?? null,
        netER: quote?.netExpenseRatio ?? etf?.expenseRatio ?? null,
        grossER: quote?.grossExpenseRatio ?? null,
        netAssets: quote?.netAssets ?? etf?.aum ?? null,
        holdings: etf?.numberOfHoldings ?? null,
        morningstar: quote?.morningstarRating ?? null,
        fiftyDayAvg: quote?.fiftyDayAverage ?? null,
        twoHundredDayAvg: quote?.twoHundredDayAverage ?? null,
        fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
        fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
        sector: etf?.sectorWeights?.[0]?.sector ?? '--',
      };
    });
  }, [positions, quoteCache, etfCache, priceCache, trailingReturnsCache]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort.key];
      const bVal = (b as Record<string, unknown>)[sort.key];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp: number;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = (aVal as number) - (bVal as number);
      }

      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sort]);

  function handleSort(key: SortKey) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  }

  function renderCell(row: RowData, key: string) {
    switch (key) {
      case 'symbol':
        return <span className={styles.ticker}>{row.symbol}</span>;
      case 'name':
        return <span className={styles.name} title={row.name}>{row.name}</span>;
      case 'price':
        return <span className={styles.num}>{currency(row.price)}</span>;
      case 'volume':
        return <span className={styles.num}>{compactVolume(row.volume)}</span>;
      case 'ytdReturn':
      case '1M':
      case '3M':
      case '1Y':
      case '3Y':
      case '5Y': {
        const value = row[key as keyof RowData] as number | null;
        return <span className={returnClass(value)}>{percent(value)}</span>;
      }
      case 'dividendYield':
        return <span className={styles.num}>{percent(row.dividendYield)}</span>;
      case 'netER':
        return <span className={styles.num}>{percent(row.netER)}</span>;
      case 'grossER':
        return <span className={styles.num}>{percent(row.grossER)}</span>;
      case 'netAssets':
        return <span className={styles.num}>{compactAum(row.netAssets)}</span>;
      case 'holdings':
        return <span className={styles.num}>{number(row.holdings)}</span>;
      case 'morningstar': {
        if (row.morningstar != null && row.morningstar >= 1 && row.morningstar <= 5) {
          return <span className={styles.stars}>{'★'.repeat(row.morningstar)}</span>;
        }
        return <span className={styles.num}>--</span>;
      }
      case 'fiftyDayAvg':
        return <span className={styles.num}>{currency(row.fiftyDayAvg)}</span>;
      case 'twoHundredDayAvg':
        return <span className={styles.num}>{currency(row.twoHundredDayAvg)}</span>;
      case 'range52w': {
        if (row.fiftyTwoWeekLow == null || row.fiftyTwoWeekHigh == null || row.price == null) {
          return <span className={styles.num}>--</span>;
        }
        const range = row.fiftyTwoWeekHigh - row.fiftyTwoWeekLow;
        const pct = range > 0
          ? ((row.price - row.fiftyTwoWeekLow) / range) * 100
          : 50;
        return (
          <div className={styles.rangeBar}>
            <div className={styles.rangeTrack}>
              <div
                className={styles.rangeDot}
                style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
            <div className={styles.rangeLabels}>
              <span>{currency(row.fiftyTwoWeekLow, 0)}</span>
              <span>{currency(row.fiftyTwoWeekHigh, 0)}</span>
            </div>
          </div>
        );
      }
      case 'sector':
        return <span>{row.sector}</span>;
      default:
        return null;
    }
  }

  if (positions.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Holdings Detail</h3>
      {(quotesLoading || holdingsLoading) && <div className={styles.loadingBar} />}
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.wrapper}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colSymbol} />
            <col className={styles.colName} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colNum} />
            <col className={styles.colRange} />
            <col className={styles.colSector} />
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  className={`${i === 0 ? styles.stickyCorner : ''} ${sort.key === col.key ? styles.activeSort : ''}`}
                  style={{ textAlign: col.align }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sort.key === col.key && (
                    <span className={styles.sortArrow}>
                      {sort.dir === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.symbol}>
                {COLUMNS.map((col, i) => (
                  <td
                    key={col.key}
                    className={i === 0 ? styles.stickyCol : undefined}
                    style={{ textAlign: col.align }}
                  >
                    {renderCell(row, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
