import styles from './Sparkline.module.css';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Sparkline — inline SVG line chart from a number array.
 * Presentational; scales data to fit the SVG viewBox.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Padding inside the SVG
  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = data.map((val, i) => {
    const x = pad + (i / (data.length - 1)) * innerW;
    const y = pad + innerH - ((val - min) / range) * innerH;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;

  return (
    <svg
      className={`${styles.sparkline} ${className ?? ''}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Price trend sparkline"
    >
      <path className={styles.line} d={pathD} />
    </svg>
  );
}
