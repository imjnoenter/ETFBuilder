import { useCallback, useEffect, useState } from 'react';
import styles from './WeightSlider.module.css';

interface WeightSliderProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  ticker: string;
}

export function WeightSlider({ value, max, onChange, ticker }: WeightSliderProps) {
  const [editValue, setEditValue] = useState(value.toFixed(1));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setEditValue(value.toFixed(1));
  }, [value, isEditing]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Fine-grained arrow key control: 0.5% steps, shift for 5%
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        onChange(Math.min(max, value + step));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        onChange(Math.max(0, value - step));
      }
    },
    [value, onChange, max]
  );

  const handleTextFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    e.target.select();
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const commitEdit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed)) {
        onChange(Math.min(max, Math.max(0, Math.round(parsed * 10) / 10)));
      }
      setIsEditing(false);
    },
    [max, onChange]
  );

  const handleTextBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => commitEdit(e.target.value),
    [commitEdit]
  );

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        setEditValue(value.toFixed(1));
        setIsEditing(false);
        e.currentTarget.blur();
      }
    },
    [value]
  );

  return (
    <div className={styles.container}>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label={`Weight for ${ticker}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <span className={styles.valueWrap}>
        <input
          className={styles.valueInput}
          type="text"
          inputMode="decimal"
          value={editValue}
          onFocus={handleTextFocus}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          aria-label={`Weight percent for ${ticker}`}
        />
        <span className={styles.percentSign}>%</span>
      </span>
    </div>
  );
}
