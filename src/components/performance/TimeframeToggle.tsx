import styles from './TimeframeToggle.module.css';

export type Timeframe = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';

const TIMEFRAMES: Timeframe[] = ['1Y', '3Y', '5Y', '10Y', 'Max'];

interface TimeframeToggleProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeToggle({ value, onChange }: TimeframeToggleProps) {
  return (
    <div className={styles.container} role="radiogroup" aria-label="Chart timeframe">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          className={`${styles.option} ${value === tf ? styles.active : ''}`}
          role="radio"
          aria-checked={value === tf}
          onClick={() => onChange(tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
