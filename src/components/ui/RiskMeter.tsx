import type { RiskBand } from '../../data/types';
import styles from './RiskMeter.module.css';

const RISK_LABELS: Record<RiskBand, string> = {
  1: 'Conservative',
  2: 'Mod Conservative',
  3: 'Moderate',
  4: 'Mod Aggressive',
  5: 'Aggressive',
};

export interface RiskMeterProps {
  risk: RiskBand;
  showLabel?: boolean;
  className?: string;
}

/**
 * RiskMeter — visual 1-5 risk band indicator.
 * Uses filled dots + label (not color-only) for accessibility.
 * Higher risk dots are progressively larger for shape differentiation.
 */
export function RiskMeter({ risk, showLabel = true, className }: RiskMeterProps) {
  return (
    <div
      className={`${styles.container} ${className ?? ''}`}
      role="meter"
      aria-valuenow={risk}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-label={`Risk: ${RISK_LABELS[risk]}`}
    >
      <div className={styles.dots}>
        {([1, 2, 3, 4, 5] as const).map((level) => (
          <div
            key={level}
            className={`${styles.dot} ${level <= risk ? styles.filled : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>
      {showLabel && <span className={styles.label}>{RISK_LABELS[risk]}</span>}
    </div>
  );
}
