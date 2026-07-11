import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useBuilderStore } from '../../store/builderStore';
import {
  backtestGrowth,
  benchmarkGrowth,
  commonHistoryWindow,
} from '../../lib/portfolio';
import { currency } from '../../lib/format';
import { useTheme, resolveToken } from '../../lib/useThemeTokens';
import { TimeframeToggle, type Timeframe } from './TimeframeToggle';
import { HistoryClipNote } from './HistoryClipNote';
import styles from './PerformanceChart.module.css';

const TIMEFRAME_YEARS: Record<Timeframe, number | undefined> = {
  '1Y': 1,
  '3Y': 3,
  '5Y': 5,
  '10Y': 10,
  'Max': undefined,
};

interface ChartPoint {
  date: string;
  portfolio?: number;
  spy?: number;
  qqq?: number;
}

export default function PerformanceChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>('5Y');
  const theme = useTheme();

  const positions = useBuilderStore((s) => s.positions);
  const priceCache = useBuilderStore((s) => s.priceCache);

  const colors = useMemo(() => ({
    portfolio: resolveToken('--color-primary'),
    spy: resolveToken('--color-secondary'),
    qqq: resolveToken('--color-muted'),
    grid: resolveToken('--color-chart-grid'),
    tick: resolveToken('--color-chart-tick'),
    tooltipBg: resolveToken('--color-chart-tooltip-bg'),
    tooltipText: resolveToken('--color-chart-tooltip-text'),
  }), [theme]);

  const { chartData, historyWindow } = useMemo(() => {
    if (positions.length === 0 || positions.every((p) => p.weight === 0)) {
      return { chartData: [] as ChartPoint[], historyWindow: null };
    }

    const years = TIMEFRAME_YEARS[timeframe];
    const window = commonHistoryWindow(positions, priceCache, years);
    if (!window) return { chartData: [] as ChartPoint[], historyWindow: null };

    const portfolio = backtestGrowth(positions, priceCache, window);
    const spy = benchmarkGrowth('SPY', priceCache, window);
    const qqq = benchmarkGrowth('QQQ', priceCache, window);

    // Merge all series by date
    const dateMap = new Map<string, ChartPoint>();

    for (const pt of portfolio) {
      const existing = dateMap.get(pt.date) ?? { date: pt.date };
      existing.portfolio = pt.close;
      dateMap.set(pt.date, existing);
    }
    for (const pt of spy) {
      const existing = dateMap.get(pt.date) ?? { date: pt.date };
      existing.spy = pt.close;
      dateMap.set(pt.date, existing);
    }
    for (const pt of qqq) {
      const existing = dateMap.get(pt.date) ?? { date: pt.date };
      existing.qqq = pt.close;
      dateMap.set(pt.date, existing);
    }

    const merged = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return { chartData: merged, historyWindow: window };
  }, [positions, priceCache, timeframe]);

  if (positions.length === 0) return null;

  const hasData = chartData.length > 1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Growth of $10,000</h3>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      {!hasData ? (
        <div className={styles.emptyChart}>
          Adjust weights above zero to see performance.
        </div>
      ) : (
        <>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={colors.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: colors.tick }}
                  tickLine={false}
                  axisLine={{ stroke: colors.grid }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: colors.tick }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: 'none',
                    borderRadius: '6px',
                    color: colors.tooltipText,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                  }}
                  formatter={(value: number, name: string) => [
                    currency(value),
                    name === 'portfolio' ? 'Portfolio' : name === 'spy' ? 'S&P 500' : 'Nasdaq-100',
                  ]}
                  labelStyle={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  stroke={colors.portfolio}
                  strokeWidth={2.5}
                  dot={false}
                  name="portfolio"
                />
                <Line
                  type="monotone"
                  dataKey="spy"
                  stroke={colors.spy}
                  strokeWidth={1.5}
                  dot={false}
                  name="spy"
                  strokeDasharray="4 2"
                />
                <Line
                  type="monotone"
                  dataKey="qqq"
                  stroke={colors.qqq}
                  strokeWidth={1.5}
                  dot={false}
                  name="qqq"
                  strokeDasharray="2 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Custom legend (not Recharts default — matches design system) */}
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={styles.legendLine} style={{ backgroundColor: colors.portfolio }} />
              <span className={styles.legendLabel}>Portfolio</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLine} style={{ backgroundColor: colors.spy }} />
              <span className={styles.legendLabel}>S&P 500</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLine} style={{ backgroundColor: colors.qqq }} />
              <span className={styles.legendLabel}>Nasdaq-100</span>
            </div>
          </div>

          {historyWindow && <HistoryClipNote window={historyWindow} />}
        </>
      )}
    </div>
  );
}
