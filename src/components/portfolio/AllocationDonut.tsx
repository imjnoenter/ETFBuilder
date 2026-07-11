import { useState, useMemo } from 'react';
import { arc as d3Arc, pie as d3Pie } from 'd3-shape';
import type { PieArcDatum } from 'd3-shape';
import { useTheme } from '../../lib/useThemeTokens';
import styles from './AllocationDonut.module.css';

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface AllocationDonutProps {
  slices: DonutSlice[];
  unallocatedPct: number;
  className?: string;
}

const SLICE_COLORS_LIGHT = [
  'oklch(0.56 0.20 29)',   // crimson primary
  'oklch(0.55 0.12 185)',  // teal secondary
  'oklch(0.65 0.15 55)',   // amber
  'oklch(0.60 0.14 330)',  // rose
  'oklch(0.62 0.10 145)',  // sage green
  'oklch(0.55 0.12 310)',  // plum
  'oklch(0.70 0.10 75)',   // gold
  'oklch(0.50 0.08 200)',  // dark teal
  'oklch(0.65 0.18 15)',   // coral
  'oklch(0.58 0.06 270)',  // slate
];

const SLICE_COLORS_DARK = [
  'oklch(0.68 0.19 29)',   // crimson lifted
  'oklch(0.68 0.11 185)',  // teal lifted
  'oklch(0.75 0.14 55)',   // amber lifted
  'oklch(0.72 0.13 330)',  // rose lifted
  'oklch(0.72 0.09 145)',  // sage lifted
  'oklch(0.68 0.11 310)',  // plum lifted
  'oklch(0.78 0.09 75)',   // gold lifted
  'oklch(0.62 0.07 200)',  // dark teal lifted
  'oklch(0.75 0.16 15)',   // coral lifted
  'oklch(0.68 0.05 270)',  // slate lifted
];

const UNALLOCATED_LIGHT = 'oklch(0.92 0.005 29)';
const UNALLOCATED_DARK = 'oklch(0.28 0.01 29)';

const SIZE = 220;
const OUTER_R = SIZE / 2;
const INNER_R = OUTER_R * 0.62;
const HOVER_OUTER = OUTER_R + 6;

export function AllocationDonut({ slices, unallocatedPct, className }: AllocationDonutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const theme = useTheme();
  const SLICE_COLORS = theme === 'dark' ? SLICE_COLORS_DARK : SLICE_COLORS_LIGHT;
  const UNALLOCATED_COLOR = theme === 'dark' ? UNALLOCATED_DARK : UNALLOCATED_LIGHT;

  const isOver100 = unallocatedPct < 0;

  // Build data array: real slices + unallocated (only when under 100%)
  const data = useMemo(() => {
    const items: { label: string; value: number; color: string; isUnallocated: boolean }[] =
      slices.map((s, i) => ({
        label: s.label,
        value: s.value,
        color: s.color || SLICE_COLORS[i % SLICE_COLORS.length],
        isUnallocated: false,
      }));

    if (!isOver100 && unallocatedPct > 0.01) {
      items.push({
        label: 'Unallocated',
        value: unallocatedPct,
        color: UNALLOCATED_COLOR,
        isUnallocated: true,
      });
    }

    return items;
  }, [slices, unallocatedPct, isOver100]);

  // d3 pie + arc generators
  const pieGen = useMemo(
    () =>
      d3Pie<(typeof data)[0]>()
        .value((d) => d.value)
        .sort(null)
        .padAngle(0.02),
    []
  );

  const arcs = useMemo(() => pieGen(data), [pieGen, data]);

  const arcGen = useMemo(
    () =>
      d3Arc<PieArcDatum<(typeof data)[0]>>()
        .innerRadius(INNER_R)
        .outerRadius(OUTER_R)
        .cornerRadius(3),
    []
  );

  const arcHoverGen = useMemo(
    () =>
      d3Arc<PieArcDatum<(typeof data)[0]>>()
        .innerRadius(INNER_R)
        .outerRadius(HOVER_OUTER)
        .cornerRadius(3),
    []
  );

  const totalAllocated = Math.round((100 - unallocatedPct) * 100) / 100;

  // Empty state: show a single grey ring
  if (data.length === 0 || (data.length === 1 && data[0].isUnallocated)) {
    return (
      <div className={`${styles.container} ${className ?? ''}`}>
        <div className={styles.svgWrap}>
          <svg
            className={styles.donutSvg}
            width={SIZE}
            height={SIZE}
            viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
          >
            <circle
              cx={0}
              cy={0}
              r={(OUTER_R + INNER_R) / 2}
              fill="none"
              stroke={UNALLOCATED_COLOR}
              strokeWidth={OUTER_R - INNER_R}
            />
          </svg>
          <div className={styles.centerLabel}>
            <span className={styles.centerPct}>0%</span>
            <span className={styles.centerSub}>Allocated</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className ?? ''}`}>
      <div className={styles.svgWrap}>
        <svg
          className={styles.donutSvg}
          width={SIZE}
          height={SIZE}
          viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Portfolio allocation donut chart"
        >
          {arcs.map((a, i) => {
            const isHovered = hoveredIndex === i;
            const gen = isHovered ? arcHoverGen : arcGen;
            const pathD = gen(a);
            return (
              <path
                key={`${a.data.label}-${i}`}
                className={styles.slice}
                d={pathD ?? undefined}
                fill={a.data.color}
                opacity={hoveredIndex != null && !isHovered ? 0.65 : 1}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <title>{`${a.data.label}: ${a.data.value.toFixed(1)}%`}</title>
              </path>
            );
          })}
        </svg>
        <div className={styles.centerLabel}>
          <span className={`${styles.centerPct} ${isOver100 ? styles.centerOver : ''}`}>
            {totalAllocated.toFixed(0)}%
          </span>
          <span className={styles.centerSub}>
            {isOver100 ? 'Over-allocated' : 'Allocated'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {data
          .filter((d) => !d.isUnallocated)
          .map((d, i) => (
            <div key={`${d.label}-${i}`} className={styles.legendItem}>
              <div className={styles.legendSwatch} style={{ backgroundColor: d.color }} />
              <span className={styles.legendLabel}>{d.label}</span>
              <span className={styles.legendValue}>{d.value.toFixed(1)}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export { SLICE_COLORS_LIGHT as SLICE_COLORS, SLICE_COLORS_DARK };
