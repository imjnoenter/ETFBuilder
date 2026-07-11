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

Four server-side endpoints in a custom Vite plugin, using raw Yahoo Finance REST APIs (not the yahoo-finance2 npm package):

- `GET /api/etf/:ticker` — Full ETF data + price history
- `GET /api/quotes?symbols=VOO,QQQ` — Batch live quotes (up to 20)
- `GET /api/stock-sectors?symbols=AAPL,MSFT` — Batch stock sector lookup (up to 20)
- `GET /api/holdings-count?symbols=SPY,QQQ` — Batch holdings count + top holdings from stockanalysis.com (up to 20)

Auth (cookie + crumb) is cached at module scope with retry on stale auth. Transport logic lives in `scripts/lib/yahoo-transport.mjs`. The Vite plugin watches this file and auto-invalidates its module cache on change (no restart needed).

### State (Zustand)

- **`builderStore`**: Portfolio positions, name, portfolioValue, taxRate, savedPortfolios, etfCache, priceCache, quoteCache. Positions, name, value, taxRate, and savedPortfolios persist to localStorage; caches rebuild on mount.
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

## Period Returns (src/lib/returns.ts)

`computePeriodReturns(prices)` computes 1M/3M/1Y/3Y/5Y returns from monthly `PricePoint[]` data in the price cache. Used by screener rows, holdings detail table, and blended 1Y return calculation.

## ETF Data Shape

The `Etf` type has a single `dividendYield: number | null` field (trailing 12-month dividend yield from Yahoo's `detail.yield`). There is no SEC yield — Yahoo doesn't provide it.

`numberOfHoldings` and `topHoldings` are sourced from stockanalysis.com (Yahoo removed `numberOfHoldings` from their API). The `fetchHoldingsData()` function in `yahoo-transport.mjs` scrapes the holdings page and returns both the total count and up to 25 top holdings. This runs on-demand via the `useHoldingsCount` hook when ETFs appear in the Holdings Detail table, not during ETF hydration. Curated fixtures include `numberOfHoldings` from `build-fixtures` but `topHoldings` from Yahoo (10 items); the hook upgrades to 25 at runtime.
