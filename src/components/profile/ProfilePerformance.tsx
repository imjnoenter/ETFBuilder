import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { currency } from '../../lib/format';
import { useTheme, resolveToken } from '../../lib/useThemeTokens';
import styles from './ProfileDrawer.module.css';

interface ProfilePerformanceProps {
  ticker: string;
  data: Array<{ date: string; etf?: number; spy?: number }>;
}

export default function ProfilePerformance({ ticker, data }: ProfilePerformanceProps) {
  const theme = useTheme();
  const colors = useMemo(() => ({
    etf: resolveToken('--color-primary'),
    spy: resolveToken('--color-secondary'),
    grid: resolveToken('--color-chart-grid'),
    tick: resolveToken('--color-chart-tick'),
    tooltipBg: resolveToken('--color-chart-tooltip-bg'),
    tooltipText: resolveToken('--color-chart-tooltip-text'),
  }), [theme]);
  if (data.length < 2) {
    return <p className={styles.emptyNote}>Performance data unavailable.</p>;
  }

  return (
    <>
      <div className={styles.perfWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: colors.tick }}
              tickLine={false}
              axisLine={{ stroke: colors.grid }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: colors.tick }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              width={40}
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
                name === 'etf' ? ticker : 'S&P 500',
              ]}
            />
            <Line
              type="monotone"
              dataKey="etf"
              stroke={colors.etf}
              strokeWidth={2}
              dot={false}
              name="etf"
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
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.perfLegend}>
        <div className={styles.perfLegendItem}>
          <div className={styles.perfLegendLine} style={{ backgroundColor: colors.etf }} />
          <span className={styles.perfLegendLabel}>{ticker}</span>
        </div>
        <div className={styles.perfLegendItem}>
          <div className={styles.perfLegendLine} style={{ backgroundColor: colors.spy }} />
          <span className={styles.perfLegendLabel}>S&P 500</span>
        </div>
      </div>
    </>
  );
}
