/**
 * Number formatting utilities for ETFbuilder.
 * All formatters return strings suitable for display in .num elements
 * (JetBrains Mono + tabular-nums).
 */

/** Format as percentage: 0.0325 -> "3.25%" */
export function percent(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '--';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format as currency: 10000 -> "$10,000.00" */
export function currency(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format as basis points: 0.0003 -> "3 bps" */
export function basisPoints(value: number | null | undefined): string {
  if (value == null) return '--';
  return `${Math.round(value * 10000)} bps`;
}

/**
 * Format AUM in compact form:
 *   1_200_000_000 -> "$1.2B"
 *   500_000_000   -> "$500M"
 *   3_000_000     -> "$3.0M"
 */
export function compactAum(value: number | null | undefined): string {
  if (value == null) return '--';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3)  return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/** Format a plain number with commas: 10000 -> "10,000" */
export function number(value: number | null | undefined, decimals = 0): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format volume in compact form: 12345678 -> "12.3M" */
export function compactVolume(value: number | null | undefined): string {
  if (value == null) return '--';
  if (value >= 1e9)  return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6)  return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3)  return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(0);
}
