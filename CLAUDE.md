# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server + Yahoo Finance API proxy
npx vite --host      # Same, but exposed on LAN for mobile testing
npm run build        # tsc -b && vite build
npm run preview      # Preview production build
npx tsc --noEmit     # Type-check only (no emit)
npm test             # vitest run (all tests, once)
npm run test:watch   # vitest in watch mode
npx vitest run src/lib/format.test.ts   # Run a single test file
npm run build-fixtures   # Re-fetch ~80 curated ETFs from Yahoo → src/data/fixtures/etfs.json
npm run build-index      # Rebuild 5000+ ticker index from Nasdaq → src/data/fixtures/etfIndex.json
```

Vitest uses happy-dom. Test files: `src/**/*.test.ts`.

TypeScript config is split: `tsconfig.app.json` (app), `tsconfig.node.json` (build scripts). Run `npx tsc --noEmit` to type-check.

## Architecture

### Three-Layer Data Model (HybridEtfDataSource)

The app has a swappable `EtfDataSource` interface with three layers combined in `HybridEtfDataSource`:

1. **Curated Core** (`FixtureEtfDataSource`): ~80 ETFs with full data + 10-year monthly prices, bundled as JSON at build time.
2. **Lightweight Index** (`etfIndex.json`): 5000+ tickers with only `{ ticker, name, assetClass }`. Dynamic-imported on first search, not bundled.
3. **Live Proxy** (`/api/etf/:ticker`): On-demand Yahoo Finance fetch via Vite middleware plugin. Cached 24h in localStorage + in-memory per session.

Index entries become `Etf` stubs with `hydrated: false`. UI shows `--` cells for stubs and triggers background hydration. Results are replaced in-place when data arrives.

Data source is selected by `VITE_DATA_SOURCE` env var: `hybrid` (default), `fixture`, or `yahoo`.

### Vite API Plugin (vite.config.ts)

Five server-side endpoints in a custom Vite plugin, using raw Yahoo Finance REST APIs (not the yahoo-finance2 npm package):

- `GET /api/etf/:ticker` — Full ETF data + price history
- `GET /api/quotes?symbols=VOO,QQQ` — Batch live quotes (up to 20)
- `GET /api/stock-sectors?symbols=AAPL,MSFT` — Batch stock sector lookup (up to 20)
- `GET /api/holdings-count?symbols=SPY,QQQ` — Batch holdings count + top holdings from stockanalysis.com (up to 20)
- `GET /api/trailing-returns?symbols=VOO,QQQ` — Batch trailing 1M/3M/1Y/3Y/5Y returns from Yahoo's fundPerformance module (up to 20)

Auth (cookie + crumb) is cached at module scope with retry on stale auth. Transport logic lives in `scripts/lib/yahoo-transport.mjs`. The Vite plugin watches this file and auto-invalidates its module cache on change (no restart needed).

### State (Zustand)

- **`builderStore`**: Portfolio positions, name, portfolioValue, taxRate, savedPortfolios, etfCache, priceCache, quoteCache, trailingReturnsCache. Positions, name, value, taxRate, and savedPortfolios persist to localStorage; caches rebuild on mount.
- **`screenerStore`**: Search query, filters, sort, results, loading/hydrating state.

Saved portfolios store `{ name, positions, portfolioValue, taxRate }`. Auto-saves current portfolio before switching.

### Layout

`BuilderLayout` is the root: two-column desktop (screener left, portfolio right), bottom row (blended metrics + performance chart), then holdings detail table and top-10 stock holdings table. Mobile uses tab switching. `ProfileDrawer` slides in on ETF click.

### Screener Table

The screener results list (`ResultsList` + `EtfRow`) uses a real `<table>` with `overflow-x: auto` for horizontal scrolling. Ticker column is sticky. Columns: Add (+), Ticker, Name, Class, Risk, ER, Yield, 1-Mo, 3-Mo, 1-Yr, Sparkline.

### Blended Metrics Panel

Shows weighted portfolio metrics: Expense Ratio, Dividend Yield, Risk Band, plus dollar-based annual estimates (Dividend Income, After-Tax Dividend at user-configurable tax rate, Unrealized Gain 1Y, Total Return 1Y). User inputs Portfolio Value and Tax Rate at the top; both persist per portfolio.

### Price Data

Price history uses Yahoo's adjusted close (`adjclose`), which accounts for dividends reinvested and stock splits. ETF NAV already reflects expense ratio deductions. So Growth of $10,000 shows net total return.

## Design System

All styles use CSS Modules. Tokens in `src/styles/tokens.css`:

- **Fonts**: `--font-display` (Space Grotesk), `--font-body` (Inter), `--font-mono` (JetBrains Mono)
- **Colors**: OKLCH-based. `--color-primary` (warm crimson), `--color-secondary` (deep teal), `--color-success`/`--color-danger` for return coloring
- **Theme**: `[data-theme="dark"]` on `<html>`, initialized before React renders. Use `resolveToken()` from `useThemeTokens.ts` when Recharts needs string color values.
- **Spacing**: 4px base (`--space-1` through `--space-16`)
- **Z-index**: `--z-dropdown` (100) through `--z-tooltip` (600)

**Key rules**:
- Every number must use `--font-mono` with `font-variant-numeric: tabular-nums`
- Never hardcode colors — use CSS tokens. Dark mode must work.
- Motion via `motion/react` package, gated behind `prefers-reduced-motion`

## Formatting Utilities (src/lib/format.ts)

`percent(0.0325)` → `"3.25%"` | `currency(10000)` → `"$10,000.00"` | `compactAum(1.2e9)` → `"$1.2B"` | `compactVolume(12.3e6)` → `"12.3M"` | `number(10000)` → `"10,000"`

All return `"--"` for null/undefined.

## Period Returns: Two Sources

There are two ways period returns get computed, and most consumers prefer the live one but fall back to the computed one:

1. **Computed** — `computePeriodReturns(prices)` in `src/lib/returns.ts` derives 1M/3M/1Y/3Y/5Y from monthly `PricePoint[]` data already sitting in `priceCache`. No extra network call. Used by the screener rows (`ResultsList`), since screener results churn too fast to justify a live fetch per row.
2. **Live trailing returns** — `useTrailingReturns()` (`src/lib/useTrailingReturns.ts`) fetches `/api/trailing-returns` for the current portfolio's positions, backed by Yahoo's fundPerformance module (more accurate than price-derived math, especially for annualized 3Y/5Y). Cached 24h in both `trailingReturnsCache` (Zustand) and localStorage (`etfbuilder-trailing-returns`). `HoldingsTable` and `builderStore`'s `getBlended1YReturn()` use `trailingReturnsCache.get(ticker) ?? computePeriodReturns(prices)` — live data when available, computed as a same-shape fallback while the fetch is in flight or if it fails.

When adding a new returns consumer, default to the live+fallback pattern unless the call site is high-frequency (like screener rows), where computed-only is intentional.

## AllocationDonut (src/components/portfolio/AllocationDonut.tsx)

Shared donut chart used by both `PortfolioPanel` (live portfolio builder, ETF-ticker or asset-class mode via `AllocationModeToggle`) and `ShareCard` (export card, ETF donut + stock look-through donut). Beyond `slices`/`unallocatedPct`, it takes:

- `theme?: 'light' | 'dark'` — overrides the app-wide theme for just this instance (used by `ShareCard` to force a fixed dark look regardless of the viewer's theme).
- `centerLabel?: { value, sub }` — overrides the default "{pct}% Allocated" center text (e.g. `ShareCard`'s stock donut shows a stock count instead, since that donut is rescaled to always fill 100% and a percentage there would be misleading).
- `showArcLabels?: boolean` — renders each slice's `label` directly on its arc, auto-skipped when the arc is too thin to fit the text (estimated from text length vs. arc length at the ring's midpoint). Used by `PortfolioPanel` and `ShareCard`'s ETF donut.
- `leaderLabels?: boolean` — like `showArcLabels`, but slices too thin for an inline label get a leader-line callout (line + color dot + truncated text) in a fixed column outside the ring instead of being dropped; slices below a minimum share still get no on-graph label at all (legend only), to avoid a wall of callouts. Widens the SVG canvas to fit the label columns — used only by `ShareCard`'s stock donut, which can have up to 20 slices.
- `slices[].fullLabel?: string` — shown truncated inline next to the slice label in the legend ("VOO — Vanguard S&P 500 ETF"), full text available via the legend item's `title` tooltip.

Passing `unallocatedPct={0}` makes the pie auto-normalize to fill 100% using only the given slices (d3's `pie()` generator sizes arcs by each slice's share of the *provided* total, not a fixed 100) — this is how the stock donut fills the ring even though the underlying blended weights only cover a fraction of the portfolio.

## Share / Export (src/components/share/)

`ShareButton` (header) opens `ShareDrawer`, which renders `ShareCard` — a purpose-built, always-dark summary card (independent of the app's current theme) — and captures it to PNG via `modern-screenshot`'s `domToPng`/`domToBlob` at 2x scale. Actions: Download, Copy to clipboard, Web Share API (each feature-detected; unsupported ones are hidden rather than disabled).

`ShareDrawer` waits for two things before rendering the card: all positions hydrated in `etfCache`, and `holdingsLoading` to settle (capped at 8s, then renders with whatever resolved). The card shows the ETF allocation donut plus a look-through stock donut built by `blendedStockHoldings()` (`src/lib/stockHoldings.ts`), which blends each position's `topHoldings` weighted by position weight — the same aggregation `TopHoldingsTable` uses, extracted so both stay in sync. The stock donut always fills 100% (see `AllocationDonut` above) with a plain-text "{pct}% of portfolio unallocated" caption below it instead of a grey ring gap, since with up to 20 stocks a dedicated wedge would be illegible.

## ETF Data Shape

The `Etf` type has a single `dividendYield: number | null` field (trailing 12-month dividend yield from Yahoo's `detail.yield`). There is no SEC yield — Yahoo doesn't provide it.

`numberOfHoldings` and `topHoldings` are sourced from stockanalysis.com (Yahoo removed `numberOfHoldings` from their API). The `fetchHoldingsData()` function in `yahoo-transport.mjs` scrapes the holdings page and returns both the total count and up to 25 top holdings. This runs on-demand via the `useHoldingsCount` hook when ETFs appear in the Holdings Detail table, not during ETF hydration. Curated fixtures include `numberOfHoldings` from `build-fixtures` but `topHoldings` from Yahoo (10 items); the hook upgrades to 25 at runtime.
