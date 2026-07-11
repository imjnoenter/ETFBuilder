import styles from './EmptyState.module.css';

export function EmptyState() {
  return (
    <div className={styles.container}>
      <div className={styles.icon} aria-hidden="true">&#x25EF;</div>
      <h3 className={styles.heading}>No holdings yet</h3>
      <p className={styles.body}>
        Search and add an ETF to start building your portfolio.
      </p>
    </div>
  );
}
