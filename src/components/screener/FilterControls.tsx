import { useCallback } from 'react';
import type { AssetClass, RiskBand } from '../../data/types';
import { Chip } from '../ui/Chip';
import styles from './FilterControls.module.css';

interface FilterControlsProps {
  assetClasses: AssetClass[];
  selectedAssetClasses: AssetClass[];
  selectedRiskBands: RiskBand[];
  expenseRatioMin?: number;
  expenseRatioMax?: number;
  minYield?: number;
  onAssetClassChange: (classes: AssetClass[]) => void;
  onRiskBandChange: (bands: RiskBand[]) => void;
  onExpenseRatioChange: (min?: number, max?: number) => void;
  onMinYieldChange: (minYield?: number) => void;
  onClear: () => void;
}

const RISK_BANDS: { value: RiskBand; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
];

export function FilterControls({
  assetClasses,
  selectedAssetClasses,
  selectedRiskBands,
  expenseRatioMin,
  expenseRatioMax,
  minYield,
  onAssetClassChange,
  onRiskBandChange,
  onExpenseRatioChange,
  onMinYieldChange,
  onClear,
}: FilterControlsProps) {
  const toggleAssetClass = useCallback(
    (ac: AssetClass) => {
      if (selectedAssetClasses.includes(ac)) {
        onAssetClassChange(selectedAssetClasses.filter((c) => c !== ac));
      } else {
        onAssetClassChange([...selectedAssetClasses, ac]);
      }
    },
    [selectedAssetClasses, onAssetClassChange]
  );

  const toggleRiskBand = useCallback(
    (band: RiskBand) => {
      if (selectedRiskBands.includes(band)) {
        onRiskBandChange(selectedRiskBands.filter((b) => b !== band));
      } else {
        onRiskBandChange([...selectedRiskBands, band]);
      }
    },
    [selectedRiskBands, onRiskBandChange]
  );

  const hasFilters =
    selectedAssetClasses.length > 0 ||
    selectedRiskBands.length > 0 ||
    expenseRatioMin != null ||
    expenseRatioMax != null ||
    minYield != null;

  return (
    <div className={styles.container}>
      {/* Asset Class */}
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Asset Class</span>
        <div className={styles.chipRow} role="listbox" aria-label="Asset class filter">
          {assetClasses.map((ac) => (
            <Chip
              key={ac}
              label={ac}
              active={selectedAssetClasses.includes(ac)}
              onClick={() => toggleAssetClass(ac)}
            />
          ))}
        </div>
      </div>

      {/* Risk Band */}
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Risk</span>
        <div className={styles.chipRow} role="listbox" aria-label="Risk band filter">
          {RISK_BANDS.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              active={selectedRiskBands.includes(value)}
              onClick={() => toggleRiskBand(value)}
            />
          ))}
        </div>
      </div>

      {/* Expense Ratio Range */}
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Expense Ratio</span>
        <div className={styles.rangeRow}>
          <input
            className={styles.rangeInput}
            type="number"
            step="0.01"
            min="0"
            placeholder="Min %"
            value={expenseRatioMin != null ? (expenseRatioMin * 100).toFixed(2) : ''}
            onChange={(e) => {
              const v = e.target.value ? parseFloat(e.target.value) / 100 : undefined;
              onExpenseRatioChange(v, expenseRatioMax);
            }}
            aria-label="Minimum expense ratio"
          />
          <span className={styles.rangeSeparator}>to</span>
          <input
            className={styles.rangeInput}
            type="number"
            step="0.01"
            min="0"
            placeholder="Max %"
            value={expenseRatioMax != null ? (expenseRatioMax * 100).toFixed(2) : ''}
            onChange={(e) => {
              const v = e.target.value ? parseFloat(e.target.value) / 100 : undefined;
              onExpenseRatioChange(expenseRatioMin, v);
            }}
            aria-label="Maximum expense ratio"
          />
        </div>
      </div>

      {/* Min Yield */}
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Min Dividend Yield</span>
        <div className={styles.rangeRow}>
          <input
            className={styles.rangeInput}
            type="number"
            step="0.01"
            min="0"
            placeholder="Min %"
            value={minYield != null ? (minYield * 100).toFixed(2) : ''}
            onChange={(e) => {
              const v = e.target.value ? parseFloat(e.target.value) / 100 : undefined;
              onMinYieldChange(v);
            }}
            aria-label="Minimum dividend yield"
          />
        </div>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button className={styles.clearButton} onClick={onClear}>
          Clear all filters
        </button>
      )}
    </div>
  );
}
