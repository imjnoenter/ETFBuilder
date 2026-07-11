import type { Etf } from '../../data/types';
import type { PeriodReturns } from '../../lib/returns';
import { percent } from '../../lib/format';
import { Button } from '../ui/Button';
import { RiskMeter } from '../ui/RiskMeter';
import { Sparkline } from '../ui/Sparkline';
import styles from './EtfRow.module.css';

interface EtfRowProps {
  etf: Etf;
  priceData: number[];
  returns: PeriodReturns | null;
  isInPortfolio: boolean;
  isHydrating?: boolean;
  onAdd: (ticker: string) => void;
  onClick: (ticker: string) => void;
}

export function EtfRow({ etf, priceData, returns, isInPortfolio, isHydrating, onAdd, onClick }: EtfRowProps) {
  const isStub = etf.hydrated === false;

  return (
    <tr
      className={`${styles.row} ${isStub ? styles.stubRow : ''}`}
      onClick={() => onClick(etf.ticker)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(etf.ticker);
        }
      }}
    >
      <td className={styles.addCell}>
        {isHydrating ? (
          <span className={styles.hydrating}>...</span>
        ) : isInPortfolio ? (
          <span className={styles.added}>Added</span>
        ) : (
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(etf.ticker);
            }}
          >
            +
          </Button>
        )}
      </td>
      <td className={styles.stickyCol}>
        <span className={styles.ticker}>{etf.ticker}</span>
      </td>
      <td><span className={styles.name} title={etf.name}>{etf.name}</span></td>
      <td className={styles.assetClass}>{etf.assetClass}</td>
      <td className={styles.riskCell}>
        {isStub ? (
          <span className={styles.num}>--</span>
        ) : (
          <RiskMeter risk={etf.risk} showLabel={false} />
        )}
      </td>
      <td className={styles.num}>{isStub ? '--' : percent(etf.expenseRatio)}</td>
      <td className={styles.num}>{isStub ? '--' : percent(etf.dividendYield)}</td>
      <td className={styles.returnCell} data-sign={returns?.['1M'] != null ? (returns['1M'] > 0 ? 'pos' : returns['1M'] < 0 ? 'neg' : '') : ''}>{isStub ? '--' : percent(returns?.['1M'] ?? null)}</td>
      <td className={styles.returnCell} data-sign={returns?.['3M'] != null ? (returns['3M'] > 0 ? 'pos' : returns['3M'] < 0 ? 'neg' : '') : ''}>{isStub ? '--' : percent(returns?.['3M'] ?? null)}</td>
      <td className={styles.returnCell} data-sign={returns?.['1Y'] != null ? (returns['1Y'] > 0 ? 'pos' : returns['1Y'] < 0 ? 'neg' : '') : ''}>{isStub ? '--' : percent(returns?.['1Y'] ?? null)}</td>
      <td className={styles.sparkCell}>
        {isStub ? null : <Sparkline data={priceData} width={64} height={20} />}
      </td>
    </tr>
  );
}
