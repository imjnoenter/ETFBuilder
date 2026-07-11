import { useCallback } from 'react';
import { WeightSlider } from './WeightSlider';
import styles from './PositionRow.module.css';

interface PositionRowProps {
  ticker: string;
  weight: number;
  maxWeight: number;
  onWeightChange: (ticker: string, weight: number) => void;
  onRemove: (ticker: string) => void;
}

export function PositionRow({ ticker, weight, maxWeight, onWeightChange, onRemove }: PositionRowProps) {
  const handleWeight = useCallback(
    (value: number) => onWeightChange(ticker, value),
    [ticker, onWeightChange]
  );

  const handleRemove = useCallback(() => onRemove(ticker), [ticker, onRemove]);

  return (
    <div className={styles.row}>
      <span className={styles.ticker}>{ticker}</span>
      <div className={styles.sliderWrap}>
        <WeightSlider value={weight} max={maxWeight} onChange={handleWeight} ticker={ticker} />
      </div>
      <button
        className={styles.remove}
        onClick={handleRemove}
        aria-label={`Remove ${ticker}`}
        title={`Remove ${ticker}`}
      >
        &times;
      </button>
    </div>
  );
}
