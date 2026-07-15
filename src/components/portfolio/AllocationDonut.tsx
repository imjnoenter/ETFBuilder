import { useState, useMemo } from 'react';
import { arc as d3Arc, pie as d3Pie } from 'd3-shape';
import type { PieArcDatum } from 'd3-shape';
import { useTheme } from '../../lib/useThemeTokens';
import styles from './AllocationDonut.module.css';

interface DonutSlice {
  label: string;
  value: number;
  color: string;
  /** Full name shown alongside the label in the legend (e.g. an ETF's fund name). */
  fullLabel?: string;
}

interface AllocationDonutProps {
  slices: DonutSlice[];
  unallocatedPct: number;
  className?: string;
  /** Overrides the app-wide theme for this instance (e.g. for a fixed-look export card). */
  theme?: 'light' | 'dark';
  /** Overrides the default "{pct}% Allocated" center text (e.g. a stock count instead of a percentage). */
  centerLabel?: { value: string; sub: string };
  /** Render each slice's label directly on its arc, when the arc is wide enough to fit it. */
  showArcLabels?: boolean;
  /**
   * Like `showArcLabels`, but slices too thin to fit an in-arc label get a leader-line
   * label outside the ring instead of being dropped. Slices below a minimum share still
   * get no on-graph label (only the legend covers them) — otherwise a long tail of tiny
   * slices produces a wall of overlapping callouts. Widens the chart's canvas to fit the
   * label columns, so use it only where there's room (e.g. the Share export card).
   */
  leaderLabels?: boolean;
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
const MID_R = (INNER_R + OUTER_R) / 2;

// Rough estimate of an arc label's pixel width at the 11px mono size used below,
// so thin slices skip the label instead of overlapping their neighbors.
const ARC_LABEL_CHAR_WIDTH = 6.5;
const ARC_LABEL_PADDING = 6;

function fitsArcLabel(label: string, angleSpan: number): boolean {
  const estWidth = label.length * ARC_LABEL_CHAR_WIDTH + ARC_LABEL_PADDING;
  const arcLength = angleSpan * MID_R;
  return arcLength >= estWidth;
}

// The percentage sub-line (e.g. "(65.0%)") renders smaller than the ticker line,
// so it gets its own narrower per-char width estimate for its own fit check.
const ARC_PCT_CHAR_WIDTH = 5.2;
const ARC_PCT_PADDING = 6;

function fitsArcPercent(pctText: string, angleSpan: number): boolean {
  const estWidth = pctText.length * ARC_PCT_CHAR_WIDTH + ARC_PCT_PADDING;
  const arcLength = angleSpan * MID_R;
  return arcLength >= estWidth;
}

// Leader-line labels: for slices too thin to fit inline, draw a short line out to a
// label in a fixed column to the left/right of the ring, rather than dropping the label.
const LEADER_ELBOW_R = OUTER_R + 14; // radial waypoint, keeps the line clear of the ring before bending
const LEADER_COLUMN_X = OUTER_R + 24;
const LEADER_LABEL_MAX_CHARS = 10; // longer holding names (e.g. a fund's cash-equivalent line item) get truncated
const LEADER_CANVAS_PAD = LEADER_COLUMN_X - OUTER_R + 55; // room for the column offset + label text
const LEADER_MIN_GAP = 15; // minimum vertical px between stacked leader labels on one side
const LEADER_MIN_SHARE = 0.012; // slices below 1.2% of the ring get no on-graph label at all

interface LeaderLabel {
  key: string;
  text: string;
  fullText: string;
  color: string;
  ringX: number;
  ringY: number;
  elbowX: number;
  elbowY: number;
  x: number;
  y: number;
}

function truncateLabel(label: string): string {
  return label.length > LEADER_LABEL_MAX_CHARS ? `${label.slice(0, LEADER_LABEL_MAX_CHARS - 1)}…` : label;
}

function buildLeaderLabels(
  arcs: PieArcDatum<{ label: string; value: number; color: string; isUnallocated: boolean }>[]
): LeaderLabel[] {
  const totalAngle = 2 * Math.PI;
  const candidates = arcs
    .map((a, i) => {
      if (a.data.isUnallocated) return null;
      const span = a.endAngle - a.startAngle;
      if (fitsArcLabel(a.data.label, span)) return null; // already shown inline
      if (span / totalAngle < LEADER_MIN_SHARE) return null; // too small to bother
      const mid = (a.startAngle + a.endAngle) / 2;
      const side = Math.sin(mid) >= 0 ? 1 : -1;
      return {
        key: `${a.data.label}-${i}`,
        text: truncateLabel(a.data.label),
        fullText: a.data.label,
        color: a.data.color,
        ringX: OUTER_R * Math.sin(mid),
        ringY: -OUTER_R * Math.cos(mid),
        elbowX: LEADER_ELBOW_R * Math.sin(mid),
        elbowY: -LEADER_ELBOW_R * Math.cos(mid),
        idealY: -(OUTER_R + 20) * Math.cos(mid),
        side,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const result: LeaderLabel[] = [];
  for (const side of [1, -1] as const) {
    const onSide = candidates.filter((c) => c.side === side).sort((a, b) => a.idealY - b.idealY);
    let prevY = -Infinity;
    for (const c of onSide) {
      const y = prevY === -Infinity ? c.idealY : Math.max(c.idealY, prevY + LEADER_MIN_GAP);
      prevY = y;
      result.push({
        key: c.key,
        text: c.text,
        fullText: c.fullText,
        color: c.color,
        ringX: c.ringX,
        ringY: c.ringY,
        elbowX: c.elbowX,
        elbowY: c.elbowY,
        x: side * LEADER_COLUMN_X,
        y,
      });
    }
  }
  return result;
}

export function AllocationDonut({
  slices,
  unallocatedPct,
  className,
  theme: themeProp,
  centerLabel,
  showArcLabels,
  leaderLabels,
}: AllocationDonutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const globalTheme = useTheme();
  const theme = themeProp ?? globalTheme;
  const SLICE_COLORS = theme === 'dark' ? SLICE_COLORS_DARK : SLICE_COLORS_LIGHT;
  const UNALLOCATED_COLOR = theme === 'dark' ? UNALLOCATED_DARK : UNALLOCATED_LIGHT;
  const svgSize = leaderLabels ? SIZE + LEADER_CANVAS_PAD * 2 : SIZE;

  const isOver100 = unallocatedPct < 0;

  // Build data array: real slices + unallocated (only when under 100%)
  const data = useMemo(() => {
    const items: { label: string; fullLabel?: string; value: number; color: string; isUnallocated: boolean }[] =
      slices.map((s, i) => ({
        label: s.label,
        fullLabel: s.fullLabel,
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

  const leaderLabelList = useMemo(
    () => (leaderLabels ? buildLeaderLabels(arcs) : []),
    [leaderLabels, arcs]
  );

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
            <span className={styles.centerPct}>{centerLabel?.value ?? '0%'}</span>
            <span className={styles.centerSub}>{centerLabel?.sub ?? 'Allocated'}</span>
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
          width={svgSize}
          height={svgSize}
          viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
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
          {showArcLabels &&
            arcs.map((a, i) => {
              if (a.data.isUnallocated) return null;
              const span = a.endAngle - a.startAngle;
              if (!fitsArcLabel(a.data.label, span)) return null;
              const [cx, cy] = arcGen.centroid(a);
              const pctText = `(${a.data.value.toFixed(1)}%)`;
              const showPct = fitsArcPercent(pctText, span);
              return (
                <text
                  key={`arc-label-${a.data.label}-${i}`}
                  className={styles.arcLabel}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {showPct ? (
                    <>
                      <tspan x={cx} dy="-0.5em">{a.data.label}</tspan>
                      <tspan x={cx} dy="1.15em" className={styles.arcLabelPct}>{pctText}</tspan>
                    </>
                  ) : (
                    a.data.label
                  )}
                </text>
              );
            })}
          {leaderLabels &&
            arcs.map((a, i) => {
              if (a.data.isUnallocated) return null;
              const span = a.endAngle - a.startAngle;
              if (!fitsArcLabel(a.data.label, span)) return null;
              const [cx, cy] = arcGen.centroid(a);
              return (
                <text
                  key={`arc-label-${a.data.label}-${i}`}
                  className={styles.arcLabel}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {a.data.label}
                </text>
              );
            })}
          {leaderLabelList.map((l) => (
            <g key={l.key}>
              <polyline
                className={styles.leaderLine}
                points={`${l.ringX},${l.ringY} ${l.elbowX},${l.elbowY} ${l.x},${l.y}`}
                fill="none"
                pointerEvents="none"
              />
              <circle
                className={styles.leaderDot}
                cx={l.ringX}
                cy={l.ringY}
                r={2.5}
                fill={l.color}
                pointerEvents="none"
              />
              <text
                className={styles.leaderLabel}
                x={l.x + (l.x >= 0 ? 5 : -5)}
                y={l.y}
                textAnchor={l.x >= 0 ? 'start' : 'end'}
                dominantBaseline="middle"
              >
                {l.text !== l.fullText && <title>{l.fullText}</title>}
                {l.text}
              </text>
            </g>
          ))}
        </svg>
        <div className={styles.centerLabel}>
          <span className={`${styles.centerPct} ${isOver100 ? styles.centerOver : ''}`}>
            {centerLabel?.value ?? `${totalAllocated.toFixed(0)}%`}
          </span>
          <span className={styles.centerSub}>
            {centerLabel?.sub ?? (isOver100 ? 'Over-allocated' : 'Allocated')}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {data
          .filter((d) => !d.isUnallocated)
          .map((d, i) => {
            const text = d.fullLabel ? `${d.label} — ${d.fullLabel}` : d.label;
            return (
              <div key={`${d.label}-${i}`} className={styles.legendItem}>
                <div className={styles.legendSwatch} style={{ backgroundColor: d.color }} />
                <span className={styles.legendLabel} title={text}>{text}</span>
                <span className={styles.legendValue}>{d.value.toFixed(1)}%</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export { SLICE_COLORS_LIGHT as SLICE_COLORS, SLICE_COLORS_DARK };
