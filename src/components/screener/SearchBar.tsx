import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className={styles.container}>
      <span className={styles.icon} aria-hidden="true">
        &#x2315;
      </span>
      <input
        className={styles.input}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by ticker or name..."
        aria-label="Search ETFs"
      />
    </div>
  );
}
