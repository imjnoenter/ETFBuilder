---
name: ETFbuilder
description: Build and explore ETF portfolios like playing a strategy game.
---

# Design System: ETFbuilder

## 1. Overview

**Creative North Star: "The Builder's Arcade"**

A strategy table with the responsiveness of an arcade cabinet. Every piece snaps into place. Every adjustment ripples through the board. The interface rewards precision and exploration equally — add an ETF to your portfolio and watch the donut, blended metrics, and performance chart reflow in real time. It's a tool that makes you feel like you're building something, not filling out a form.

The system is built on the idea that financial tools can feel as satisfying as well-designed games without cheapening the subject. No confetti, no badges, no "you're doing great!" — the delight comes from the interaction itself. A slider that responds instantly. A chart that breathes when you hover. A weight adjustment that cascades through every visualization at once.

This is not a banking app. It's not conservative, not corporate, not dressed in navy and gold. It's not Bloomberg (overwhelming density), not Robinhood (hiding complexity behind cheerful oversimplification), and not a crypto exchange (neon-soaked chaos). It respects the user's intelligence while making the experience genuinely fun.

**Key Characteristics:**
- Direct manipulation everywhere — sliders, inline editing, click-to-add
- Instant visual feedback on every interaction — no dead clicks, no waiting
- Progressive disclosure — clean for beginners, deep for power users
- Data through visualization first, numbers as supporting detail
- Monospace numbers that feel native to financial data, not decorative
- Light/dark theme with OS preference detection and toggle persistence

**References:**
- Figma — the canvas-builder feel, direct manipulation of objects, professional but energizing
- Nintendo Switch UI — tactile, colorful, every interaction has weight and feedback
- Stripe Dashboard — clean data density, clear hierarchy, feels sharp without being cold

## 2. Colors

All colors use OKLCH. The palette is anchored in warm crimson-red (hue 29°) as the committed primary. Tokens live in `src/styles/tokens.css` as CSS custom properties on `:root` (light) and `[data-theme="dark"]`.

### Light theme (`:root`)

| Role | Token | Value |
|---|---|---|
| Primary | `--color-primary` | `oklch(0.56 0.20 29)` |
| Primary hover | `--color-primary-hover` | `oklch(0.50 0.22 29)` |
| Primary active | `--color-primary-active` | `oklch(0.46 0.22 29)` |
| Primary subtle | `--color-primary-subtle` | `oklch(0.92 0.04 29)` |
| Secondary | `--color-secondary` | `oklch(0.55 0.12 185)` |
| Secondary hover | `--color-secondary-hover` | `oklch(0.49 0.13 185)` |
| Secondary subtle | `--color-secondary-subtle` | `oklch(0.92 0.03 185)` |
| Background | `--color-bg` | `oklch(1 0 0)` (pure white) |
| Ink | `--color-ink` | `oklch(0.15 0.01 29)` |
| Muted | `--color-muted` | `oklch(0.55 0.01 29)` |
| Surface | `--color-surface` | `oklch(0.97 0.005 29)` |
| Border | `--color-border` | `oklch(0.88 0.01 29)` |
| Success | `--color-success` | `oklch(0.62 0.17 145)` |
| Warning | `--color-warning` | `oklch(0.75 0.15 85)` |
| Danger | `--color-danger` | `oklch(0.56 0.20 29)` |

### Dark theme (`[data-theme="dark"]`)

| Role | Token | Value |
|---|---|---|
| Primary | `--color-primary` | `oklch(0.68 0.19 29)` |
| Primary hover | `--color-primary-hover` | `oklch(0.74 0.20 29)` |
| Primary active | `--color-primary-active` | `oklch(0.62 0.20 29)` |
| Primary subtle | `--color-primary-subtle` | `oklch(0.25 0.06 29)` |
| Secondary | `--color-secondary` | `oklch(0.68 0.11 185)` |
| Secondary hover | `--color-secondary-hover` | `oklch(0.74 0.12 185)` |
| Secondary subtle | `--color-secondary-subtle` | `oklch(0.25 0.04 185)` |
| Background | `--color-bg` | `oklch(0.16 0.01 29)` |
| Ink | `--color-ink` | `oklch(0.93 0.005 29)` |
| Muted | `--color-muted` | `oklch(0.60 0.01 29)` |
| Surface | `--color-surface` | `oklch(0.21 0.01 29)` |
| Border | `--color-border` | `oklch(0.30 0.01 29)` |

### Chart tokens (theme-aware)

Both themes define: `--color-chart-grid`, `--color-chart-tick`, `--color-chart-tooltip-bg`, `--color-chart-tooltip-text`, `--color-overlay`, `--color-slider-shadow`.

### Data-viz palette (donut slices)

10-color palette per theme in `AllocationDonut.tsx`. Light theme uses L 0.50–0.70; dark theme lifts to L 0.62–0.78 for visibility on dark surfaces. Hues: crimson (29°), teal (185°), amber (55°), rose (330°), sage (145°), plum (310°), gold (75°), dark teal (200°), coral (15°), slate (270° at low chroma — no pure blue).

### Named Rules

**The Committed Voice Rule.** Primary crimson is the dominant brand color — CTAs, active states, progress indicators, and key UI highlights. Its saturation is the identity.

**The No Corporate Blue Rule.** Blue is prohibited as a UI color — not primary, not secondary, not chart. Teal secondary fills the cool-tone role.

## 3. Typography

**Display:** Space Grotesk 600/700 (`--font-display`)
**Body:** Inter 400/500/600 (`--font-body`)
**Data/Mono:** JetBrains Mono 400/500 (`--font-mono`)

All self-hosted via `@fontsource`. The pairing is geometric display (Space Grotesk) against humanist body (Inter) — contrast on the serif axis. JetBrains Mono is used for every number in the interface, enforced by the `.num` utility class and `font-variant-numeric: tabular-nums`.

### Hierarchy
- **Display** (Space Grotesk 700, `clamp(1.75rem, 4vw, 3rem)`, line-height 1.2, letter-spacing -0.03em): Brand name, hero values.
- **Headline** (Space Grotesk 600, `clamp(1.25rem, 3vw, 2rem)`, line-height 1.2, letter-spacing -0.02em): Section headers, panel titles.
- **Title** (Space Grotesk 600, `clamp(1.1rem, 2.5vw, 1.5rem)`, line-height 1.2): Card titles, filter labels.
- **Body** (Inter 400, 1rem, line-height 1.6, max-width 70ch): Descriptions, explanations.
- **Label/Data** (JetBrains Mono 400, tabular-nums): All numbers — expense ratios, percentages, weights, prices.

### Named Rules
**The Numbers Rule.** Every number in the interface is set in JetBrains Mono with `font-variant-numeric: tabular-nums`. Columns of numbers must align. No exceptions.

## 4. Elevation

Flat by default. Depth is earned through interaction, not decoration.

### Shadow tokens
| Token | Light | Dark |
|---|---|---|
| `--shadow-hover` | `0 4px 12px oklch(0.15 0.01 29 / 0.10)` | `0 4px 12px oklch(0.05 0.01 29 / 0.30)` |
| `--shadow-focus` | `0 0 0 3px oklch(0.56 0.20 29 / 0.25)` | `0 0 0 3px oklch(0.68 0.19 29 / 0.30)` |
| `--shadow-drawer` | `-4px 0 24px oklch(0.15 0.01 29 / 0.15)` | `-4px 0 24px oklch(0.05 0.01 29 / 0.40)` |

Tonal layering (bg → surface → elevated surface) creates spatial hierarchy. Shadow is the accent, not the structure.

### Named Rules
**The Earned Depth Rule.** Surfaces are flat at rest. Shadows appear only as a response to user interaction (hover, drag, focus).

## 5. Spacing & Radius

### Spacing scale (4px base)
`--space-1` (4px) through `--space-16` (64px), 12 steps.

### Radius scale
| Token | Value |
|---|---|
| `--radius-sm` | 4px |
| `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--radius-xl` | 16px |
| `--radius-full` | 9999px |

## 6. Motion

| Token | Value |
|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--duration-fast` | 150ms |
| `--duration-normal` | 250ms |
| `--duration-slow` | 400ms |

Motion library: `motion` (Framer Motion). Used for donut spring reflow, drawer slide, list enter/exit, position row animations. All gated behind `@media (prefers-reduced-motion: reduce)` — crossfade or instant transition as fallback.

Theme transitions use `--duration-normal` on body `background-color` and `color`.

## 7. Z-index scale

| Token | Value | Usage |
|---|---|---|
| `--z-dropdown` | 100 | Dropdowns, filter panels |
| `--z-sticky` | 200 | Sticky headers |
| `--z-drawer-backdrop` | 300 | Drawer overlay |
| `--z-drawer` | 400 | Profile drawer |
| `--z-toast` | 500 | Toast notifications |
| `--z-tooltip` | 600 | Tooltips |

## 8. Components

All components use CSS Modules (`.module.css`) and reference design tokens via `var()`. Recharts components use `resolveToken()` from `src/lib/useThemeTokens.ts` to get computed values.

### UI primitives (`src/components/ui/`)
- **Button** — primary/secondary/ghost variants, crimson and teal fills
- **Chip** — filter pills with active state, used in FilterControls
- **Drawer** — right slide-over panel with backdrop overlay, focus trap, Esc dismiss
- **RiskMeter** — 1-5 dot display with label, not color-only
- **Sparkline** — inline SVG mini-chart for 1Y trend in screener rows
- **Stat** — label + mono value pair for blended metrics
- **ThemeToggle** — sun/moon icon button, toggles `data-theme` on `<html>`

### Screener (`src/components/screener/`)
- **SearchBar** — text input for ticker/name search
- **FilterControls** — asset class chips, risk band, expense ratio range, yield filter
- **EtfRow** — table row: ticker (mono), name, class, risk meter, ER, yields, sparkline, +Add
- **ResultsList** — sortable table with column headers, stock-hint banner
- **ScreenerPanel** — composed screener with search + filters + results

### Portfolio (`src/components/portfolio/`)
- **AllocationDonut** — SVG donut (d3-shape arcs), segment hover-lift, theme-aware 10-color palette, ETF/asset-class toggle
- **PortfolioPanel** — position list + donut + allocation readout ("X% allocated", "fully built" at 100%)
- **PositionRow** — ticker + weight slider + remove, animated enter/exit via motion
- **WeightSlider** — range input hard-capped to remaining headroom
- **BlendedPanel** — live weighted expense ratio, yields, risk, asset-class mix
- **AllocationModeToggle** — switch donut view between ETF and asset class
- **EmptyState** — "No holdings yet" prompt

### Performance (`src/components/performance/`)
- **PerformanceChart** — Growth-of-$10k multi-series line (Recharts), portfolio vs SPY vs QQQ, theme-aware colors via `resolveToken()`
- **TimeframeToggle** — 1Y/3Y/5Y/10Y/Max selector
- **HistoryClipNote** — shows limiting ticker when portfolio history is clipped

### Profile (`src/components/profile/`)
- **ProfileDrawer** — full ETF detail: overview, key facts, top-10 holdings, sector/asset breakdown bars, own performance chart
- **ProfilePerformance** — individual Growth-of-$10k vs SPY, theme-aware

### Layout
- **BuilderLayout** — two-column desktop (screener left, portfolio right), bottom row (blended + perf chart), mobile tab switching, theme init

## 9. Theme System

Theme switching uses `[data-theme="dark"]` on `<html>`. Managed by `src/lib/useThemeTokens.ts`:
- `initTheme()` — reads localStorage, falls back to `prefers-color-scheme`, sets attribute before React renders (no flash)
- `setTheme()` / `toggleTheme()` — updates attribute + localStorage + notifies subscribers
- `useTheme()` — React hook via `useSyncExternalStore`, triggers re-render on toggle
- `resolveToken()` — reads `getComputedStyle` for Recharts (which needs resolved values, not `var()` references)

Persisted to `localStorage` under key `etfbuilder-theme`.

## 10. Do's and Don'ts

### Do:
- **Do** use direct manipulation (sliders, inline edit) instead of forms and modals wherever possible.
- **Do** make every interaction produce instant, visible feedback.
- **Do** set all numbers in JetBrains Mono with tabular-nums.
- **Do** use the primary crimson confidently — it's the committed brand voice.
- **Do** provide reduced-motion alternatives for all animations.
- **Do** use CSS custom properties (`var()`) for all colors — never hardcode oklch values in components.
- **Do** use `resolveToken()` for Recharts and SVG contexts that need computed color strings.

### Don't:
- **Don't** use blue in any UI role. Teal secondary fills the cool-tone role.
- **Don't** add gamification mechanics.
- **Don't** hide complexity behind oversimplification.
- **Don't** use dense terminal-style layouts.
- **Don't** use corporate fintech aesthetics (navy, gold, stock photography).
- **Don't** use ambient shadows at rest.
- **Don't** use side-stripe borders, gradient text, or glassmorphism.
- **Don't** hardcode color values in component files — use tokens from `tokens.css`.
