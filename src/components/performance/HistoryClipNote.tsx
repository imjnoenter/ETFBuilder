import type { HistoryWindow } from '../../lib/portfolio';
import styles from './HistoryClipNote.module.css';

interface HistoryClipNoteProps {
  window: HistoryWindow;
}

export function HistoryClipNote({ window }: HistoryClipNoteProps) {
  if (!window.clippedFrom || !window.limitingTicker) return null;

  // Calculate the actual range in human-readable form
  const startDate = new Date(window.start + '-01');
  const endDate = new Date(window.end + '-01');
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  let rangeStr: string;
  if (years > 0 && remMonths > 0) {
    rangeStr = `${years}Y ${remMonths}M`;
  } else if (years > 0) {
    rangeStr = `${years}Y`;
  } else {
    rangeStr = `${remMonths}M`;
  }

  return (
    <p className={styles.note}>
      Limited to {rangeStr} &mdash;{' '}
      <span className={styles.ticker}>{window.limitingTicker}</span> history starts {window.start}.
    </p>
  );
}
