import { useMemo, useEffect, useState } from 'react';
import { useBuilderStore } from '../../store/builderStore';
import { percent } from '../../lib/format';
import styles from './TopHoldingsTable.module.css';

interface BlendedHolding {
  symbol: string;
  name: string;
  blended: number;
  sources: { ticker: string; weight: number }[];
}

export default function TopHoldingsTable({ embedded }: { embedded?: boolean }) {
  const positions = useBuilderStore((s) => s.positions);
  const etfCache = useBuilderStore((s) => s.etfCache);
  const holdingsLoading = useBuilderStore((s) => s.holdingsLoading);

  const top20 = useMemo<BlendedHolding[]>(() => {
    const map = new Map<string, { symbol: string; name: string; blended: number; sources: { ticker: string; weight: number }[] }>();

    for (const pos of positions) {
      const etf = etfCache.get(pos.ticker);
      if (!etf?.topHoldings) continue;

      for (const holding of etf.topHoldings) {
        const blended = (pos.weight / 100) * (holding.weight / 100);
        const key = holding.symbol || holding.name;
        const existing = map.get(key);
        if (existing) {
          existing.blended += blended;
          existing.sources.push({ ticker: pos.ticker, weight: holding.weight });
        } else {
          map.set(key, {
            symbol: holding.symbol,
            name: holding.name,
            blended,
            sources: [{ ticker: pos.ticker, weight: holding.weight }],
          });
        }
      }
    }

    const totalAllocated = positions.reduce((sum, p) => sum + p.weight / 100, 0);
    const entries = Array.from(map.values());
    if (totalAllocated > 0) {
      for (const e of entries) e.blended /= totalAllocated;
    }

    return entries
      .sort((a, b) => b.blended - a.blended)
      .slice(0, 20);
  }, [positions, etfCache]);

  const [sectors, setSectors] = useState<Record<string, string>>({});

  useEffect(() => {
    const symbols = top20
      .map((h) => h.symbol)
      .filter((s) => s && !sectors[s]);

    if (symbols.length === 0) return;

    let cancelled = false;

    fetch(`/api/stock-sectors?symbols=${symbols.join(',')}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { sectors: Record<string, { sector: string }> } | null) => {
        if (cancelled || !data) return;
        setSectors((prev) => {
          const next = { ...prev };
          for (const [sym, info] of Object.entries(data.sectors)) {
            next[sym] = info.sector || '--';
          }
          return next;
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [top20]);

  if (positions.length === 0) return null;

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      <h3 className={styles.title}>Top 20 Stock Holdings</h3>
      {holdingsLoading && <div className={styles.loadingBar} />}
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colRank} />
          <col className={styles.colSymbol} />
          <col className={styles.colName} />
          <col className={styles.colWeight} />
          <col className={styles.colBreakdown} />
          <col className={styles.colSector} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.colRank}>#</th>
            <th className={styles.colSymbol}>Symbol</th>
            <th className={styles.colName}>Stock Name</th>
            <th className={styles.colWeight}>Blended Weight</th>
            <th className={styles.colBreakdown}>Breakdown</th>
            <th className={styles.colSector}>Sector</th>
          </tr>
        </thead>
        <tbody>
          {top20.map((item, i) => (
            <tr key={item.symbol || item.name}>
              <td className={styles.rank}>{i + 1}</td>
              <td className={styles.ticker}>{item.symbol || '--'}</td>
              <td>{item.name}</td>
              <td className={styles.weight}>{percent(item.blended)}</td>
              <td className={styles.breakdown}>
                {item.sources.map((s) => `${s.ticker} ${s.weight.toFixed(2)}%`).join(' · ')}
              </td>
              <td className={styles.sector}>{sectors[item.symbol] ?? '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
