import styles from './ShareButton.module.css';

interface ShareButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function ShareButton({ disabled, onClick }: ShareButtonProps) {
  return (
    <button
      className={styles.button}
      onClick={onClick}
      disabled={disabled}
      aria-label="Share your plan"
      title={disabled ? 'Add positions to share your plan' : 'Share your plan'}
    >
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    </button>
  );
}
