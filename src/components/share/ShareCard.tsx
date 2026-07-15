import { forwardRef } from 'react';
import type { RiskBand } from '../../data/types';
import { percent } from '../../lib/format';
import { AllocationDonut } from '../portfolio/AllocationDonut';
import { Stat } from '../ui/Stat';
import { RiskMeter } from '../ui/RiskMeter';
import styles from './ShareCard.module.css';

export interface ShareCardSlice {
  label: string;
  value: number;
  color: string;
  fullLabel?: string;
}

export interface ShareCardStockRow {
  symbol: string;
  name: string;
  /** Blended weight in percentage points (0-100 scale). */
  blended: number;
  /** Matches the corresponding donut slice color. */
  color: string;
}

export interface ShareCardProps {
  portfolioName: string;
  etfSlices: ShareCardSlice[];
  etfUnallocatedPct: number;
  stockSlices: ShareCardSlice[];
  stockRows: ShareCardStockRow[];
  stockUnallocatedPct: number;
  stockHoldingsAvailable: boolean;
  expenseRatio: number | null;
  dividendYield: number | null;
  risk: RiskBand | null;
  return1Y: number | null;
}

/**
 * ShareCard — a purpose-built, always-dark summary card for image export.
 * Rendered independent of the app's current light/dark theme so every
 * exported image looks the same regardless of who generates it.
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  {
    portfolioName,
    etfSlices,
    etfUnallocatedPct,
    stockSlices,
    stockRows,
    stockUnallocatedPct,
    stockHoldingsAvailable,
    expenseRatio,
    dividendYield,
    risk,
    return1Y,
  },
  ref
) {
  const returnClass = return1Y == null ? '' : return1Y >= 0 ? styles.positive : styles.negative;

  return (
    <div ref={ref} className={styles.card}>
      <h2 className={styles.title}>{portfolioName}</h2>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Allocation</span>
        <AllocationDonut slices={etfSlices} unallocatedPct={etfUnallocatedPct} theme="dark" showArcLabels />
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Top Holdings (Look-Through)</span>
        {stockHoldingsAvailable ? (
          <>
            <AllocationDonut
              slices={stockSlices}
              unallocatedPct={0}
              theme="dark"
              centerLabel={{
                value: String(stockSlices.length),
                sub: stockSlices.length === 1 ? 'Stock' : 'Stocks',
              }}
              leaderLabels
            />
            {stockUnallocatedPct >= 0.5 && (
              <p className={styles.unallocatedNote}>
                {stockUnallocatedPct.toFixed(0)}% of portfolio unallocated
              </p>
            )}
          </>
        ) : (
          <p className={styles.emptyNote}>Stock holdings unavailable</p>
        )}
      </div>

      <div className={styles.metrics}>
        <Stat label="Expense Ratio" value={percent(expenseRatio)} size="small" />
        <Stat label="Dividend Yield" value={percent(dividendYield)} size="small" />
        <div className={styles.metricStat}>
          <span className={styles.metricLabel}>Risk Band</span>
          {risk != null ? <RiskMeter risk={risk} showLabel /> : <span className={styles.emptyNote}>--</span>}
        </div>
        <div className={styles.metricStat}>
          <span className={styles.metricLabel}>1-Yr Return</span>
          <span className={`${styles.metricValue} ${returnClass}`}>{percent(return1Y)}</span>
        </div>
      </div>

      {stockHoldingsAvailable && stockRows.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Top Stock Holdings</span>
          <table className={styles.holdingsTable}>
            <tbody>
              {stockRows.map((row, i) => (
                <tr key={row.symbol || row.name}>
                  <td className={styles.hRank}>{i + 1}</td>
                  <td className={styles.hDotCell}>
                    <span className={styles.hDot} style={{ backgroundColor: row.color }} />
                  </td>
                  <td className={styles.hSymbol}>{row.symbol || '--'}</td>
                  <td className={styles.hName}>{row.name}</td>
                  <td className={styles.hWeight}>{percent(row.blended / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
