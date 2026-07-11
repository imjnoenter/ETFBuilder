import styles from './Stat.module.css';

export interface StatProps {
  label: string;
  value: string;
  size?: 'default' | 'small';
  className?: string;
  /** Tooltip shown on hover (applied to the container) */
  title?: string;
}

/**
 * Stat — a label + monospace value pair.
 * Values are always rendered in JetBrains Mono with tabular-nums
 * (The Numbers Rule).
 */
export function Stat({ label, value, size = 'default', className, title }: StatProps) {
  return (
    <div
      className={`${styles.stat} ${size === 'small' ? styles.small : ''} ${className ?? ''}`}
      title={title}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
