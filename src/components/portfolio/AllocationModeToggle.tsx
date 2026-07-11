import styles from './AllocationModeToggle.module.css';

export type AllocationMode = 'etf' | 'assetClass';

interface AllocationModeToggleProps {
  mode: AllocationMode;
  onChange: (mode: AllocationMode) => void;
}

export function AllocationModeToggle({ mode, onChange }: AllocationModeToggleProps) {
  return (
    <div className={styles.container} role="radiogroup" aria-label="Allocation view mode">
      <button
        className={`${styles.option} ${mode === 'etf' ? styles.active : ''}`}
        role="radio"
        aria-checked={mode === 'etf'}
        onClick={() => onChange('etf')}
      >
        By ETF
      </button>
      <button
        className={`${styles.option} ${mode === 'assetClass' ? styles.active : ''}`}
        role="radio"
        aria-checked={mode === 'assetClass'}
        onClick={() => onChange('assetClass')}
      >
        By Asset Class
      </button>
    </div>
  );
}
