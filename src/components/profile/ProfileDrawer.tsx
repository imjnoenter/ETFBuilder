import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { dataSource } from '../../data';
import type { Etf, Holding, PricePoint } from '../../data/types';
import { benchmarkGrowth, type HistoryWindow } from '../../lib/portfolio';
import { percent, compactAum } from '../../lib/format';
import { useBuilderStore } from '../../store/builderStore';
import { Drawer } from '../ui/Drawer';
import { Stat } from '../ui/Stat';
import { RiskMeter } from '../ui/RiskMeter';
import { Button } from '../ui/Button';
import styles from './ProfileDrawer.module.css';

const LazyProfilePerformance = lazy(() => import('./ProfilePerformance'));


interface ProfileDrawerProps {
  ticker: string | null;
  onClose: () => void;
}

export function ProfileDrawer({ ticker, onClose }: ProfileDrawerProps) {
  const [etf, setEtf] = useState<Etf | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [spyPrices, setSpyPrices] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);

  const positions = useBuilderStore((s) => s.positions);
  const addPosition = useBuilderStore((s) => s.addPosition);
  const cacheEtf = useBuilderStore((s) => s.cacheEtf);
  const cachePrices = useBuilderStore((s) => s.cachePrices);

  const isInPortfolio = ticker ? positions.some((p) => p.ticker === ticker) : false;

  // Load ETF data when ticker changes
  useEffect(() => {
    if (!ticker) {
      setEtf(null);
      setPrices([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      const [etfData, priceData, spyData] = await Promise.all([
        dataSource.getEtf(ticker!),
        dataSource.getPriceHistory(ticker!),
        dataSource.getPriceHistory('SPY'),
      ]);
      if (cancelled) return;
      setEtf(etfData);
      setPrices(priceData);
      setSpyPrices(spyData);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [ticker]);

  // Live-fetch fresh holdings for the drawer's ETF (may not be in the portfolio,
  // so useHoldingsCount won't cover it).
  useEffect(() => {
    if (!etf) return;
    if ((etf.topHoldings?.length ?? 0) >= 25) return;

    const controller = new AbortController();

    fetch(`/api/holdings-count?symbols=${encodeURIComponent(etf.ticker)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Holdings fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data: { results: Record<string, { count: number | null; topHoldings: Holding[] }> }) => {
        const result = data.results[etf.ticker];
        if (!result) return;
        const patch: Record<string, unknown> = {};
        if (result.count != null) patch.numberOfHoldings = result.count;
        if (result.topHoldings.length > (etf.topHoldings?.length ?? 0)) {
          patch.topHoldings = result.topHoldings;
        }
        if (Object.keys(patch).length > 0) {
          setEtf((prev) => (prev ? { ...prev, ...patch } : prev));
          cacheEtf(etf.ticker, { ...etf, ...patch });
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Holdings fetch error:', err.message);
        }
      });

    return () => controller.abort();
  }, [etf?.ticker]);

  // Performance chart data: this ETF vs S&P 500, growth of $10k
  const perfData = useMemo(() => {
    if (prices.length < 2) return [];

    // Build a window from this ETF's full history
    const start = prices[0].date;
    const end = prices[prices.length - 1].date;
    const window: HistoryWindow = { start, end };

    // Index this ETF from $10k using adjClose for total return
    const basePrice = prices[0].adjClose;
    if (basePrice <= 0) return [];
    const etfSeries = prices.map((pt) => ({
      date: pt.date,
      close: Math.round((pt.adjClose / basePrice) * 10000 * 100) / 100,
    }));

    // Benchmark
    const priceMap = new Map<string, PricePoint[]>();
    priceMap.set('SPY', spyPrices);
    const spySeries = benchmarkGrowth('SPY', priceMap, window);

    // Merge
    const dateMap = new Map<string, { date: string; etf?: number; spy?: number }>();
    for (const pt of etfSeries) {
      dateMap.set(pt.date, { date: pt.date, etf: pt.close });
    }
    for (const pt of spySeries) {
      const existing = dateMap.get(pt.date) ?? { date: pt.date };
      existing.spy = pt.close;
      dateMap.set(pt.date, existing);
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [prices, spyPrices]);

  const handleAdd = () => {
    if (!ticker || !etf) return;
    addPosition(ticker);
    cacheEtf(ticker, etf);
    cachePrices(ticker, prices);
  };

  return (
    <Drawer open={ticker != null} onClose={onClose} title={ticker ?? ''}>
      {loading ? (
        <div className={styles.emptyNote}>Loading...</div>
      ) : !etf ? (
        <div className={styles.emptyNote}>ETF not found.</div>
      ) : (
        <div className={styles.content}>
          {/* Overview */}
          <p className={styles.overview}>{etf.overview}</p>

          {/* Key Facts */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Key Facts</h3>
            <div className={styles.factsGrid}>
              <Stat label="Expense Ratio" value={percent(etf.expenseRatio)} size="small" />
              <Stat label="AUM" value={compactAum(etf.aum)} size="small" />
              <Stat label="Inception" value={etf.inceptionDate ?? '--'} size="small" />
              <Stat label="Dividend Yield" value={percent(etf.dividendYield)} size="small" />
              <div>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--color-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'block',
                  marginBottom: 'var(--space-1)',
                }}>
                  Risk
                </span>
                <RiskMeter risk={etf.risk} showLabel />
              </div>
              <Stat label="Std Dev" value={etf.stdDev != null ? `${(etf.stdDev * 100).toFixed(1)}%` : '--'} size="small" />
              <Stat label="Beta" value={etf.beta != null ? etf.beta.toFixed(2) : '--'} size="small" />
            </div>
          </div>

          {/* Top Holdings */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Top Holdings</h3>
            {etf.topHoldings.length === 0 ? (
              <p className={styles.emptyNote}>Holdings data unavailable for this fund.</p>
            ) : (
              <table className={styles.holdingsTable}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {etf.topHoldings.slice(0, 10).map((h, i) => (
                    <tr key={`${h.name}-${i}`}>
                      <td>{h.symbol || '--'}</td>
                      <td>{h.name}</td>
                      <td>{h.weight.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sector Breakdown */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Sector Breakdown</h3>
            {etf.sectorWeights.length === 0 ? (
              <p className={styles.emptyNote}>Sector data unavailable for this fund.</p>
            ) : (
              [...etf.sectorWeights].sort((a, b) => b.weight - a.weight).map((s) => (
                <div key={s.sector} className={styles.barRow}>
                  <span className={styles.barLabel}>{s.sector}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        transform: `scaleX(${Math.min(s.weight, 100) / 100})`,
                        backgroundColor: 'var(--color-primary)',
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{s.weight.toFixed(1)}%</span>
                </div>
              ))
            )}
          </div>

          {/* Asset Class Breakdown */}
          {Object.keys(etf.assetBreakdown).length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Asset Breakdown</h3>
              {Object.entries(etf.assetBreakdown).map(([cls, weight]) => (
                <div key={cls} className={styles.barRow}>
                  <span className={styles.barLabel}>{cls}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        transform: `scaleX(${Math.min(weight, 100) / 100})`,
                        backgroundColor: 'var(--color-secondary)',
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{weight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Performance: Growth of $10k (lazy-loaded with Recharts) */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Growth of $10,000</h3>
            <Suspense fallback={<p className={styles.emptyNote}>Loading chart...</p>}>
              <LazyProfilePerformance ticker={ticker!} data={perfData} />
            </Suspense>
          </div>

          {/* Add to portfolio */}
          <div className={styles.addWrap}>
            {isInPortfolio ? (
              <Button variant="ghost" disabled>
                Already in portfolio
              </Button>
            ) : (
              <Button onClick={handleAdd}>
                + Add to portfolio
              </Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
