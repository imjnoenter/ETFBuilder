import type { ButtonHTMLAttributes } from 'react';
import styles from './Chip.module.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

/**
 * Chip — toggle chip for filter selections (asset class, risk band, etc.).
 * Presentational; parent handles toggle state.
 */
export function Chip({ label, active = false, className, ...props }: ChipProps) {
  const classes = [
    styles.chip,
    active ? styles.active : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      role="option"
      aria-selected={active}
      {...props}
    >
      {label}
    </button>
  );
}
