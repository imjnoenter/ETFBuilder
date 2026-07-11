#!/usr/bin/env node
/**
 * build-fixtures.mjs — Dev-time script to fetch real ETF data from Yahoo Finance.
 *
 * Usage: node scripts/build-fixtures.mjs
 *
 * Fetches ~30 popular US ETFs + benchmarks (SPY, QQQ) using yahoo-finance2.
 * Writes:
 *   src/data/fixtures/etfs.json       — static ETF metadata
 *   src/data/fixtures/priceHistory.json — monthly adjusted-close series (~10Y)
 *
 * NETWORK FALLBACK: If Yahoo is unreachable or fails, generates plausible
 * monthly series with a SEEDED RNG anchored to asset-class-typical return & vol.
 * Sets top-level "_synthetic": true + console.warn. Prefers null over fabrication
 * for static fields.
 *
 * RISK BAND DERIVATION: Risk band 1-5 is computed from annualized volatility
 * of the monthly series + asset class. See deriveRiskBand().
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getYahooAuth,
  fetchFromYahoo,
  deriveRiskBand,
  computeAnnualizedVol,
  articleFor,
  RISK_LABELS,
  ASSET_CLASS_MAP,
} from './lib/yahoo-transport.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'src', 'data', 'fixtures');

// ── ETF Universe ──
const TICKERS = [
  // Core US equity
  'SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'ITOT', 'SPLG', 'SCHB', 'DIA', 'RSP', 'IWM', 'IWB',
  // Style / factor
  'VUG', 'VTV', 'VO', 'VB', 'MGK', 'SCHG', 'IWF', 'IWD', 'NOBL', 'DGRO',
  // Dividend / income
  'SCHD', 'VIG', 'VYM', 'HDV', 'DVY', 'SDY', 'JEPI',
  // International equity
  'VEA', 'VWO', 'VXUS', 'VT', 'VEU', 'EFA', 'IEFA', 'EEM', 'IEMG', 'VGK', 'ACWI',
  // Sector equity
  'XLK', 'VGT', 'XLF', 'XLE', 'XLV', 'VHT', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLC', 'SOXX', 'SMH',
  // Thematic / mid-small
  'ARKK', 'IJR', 'IJH',
  // Bonds
  'BND', 'AGG', 'BNDX', 'TLT', 'IEF', 'SHY', 'GOVT', 'LQD', 'VCIT', 'VCSH', 'HYG', 'JNK',
  'MUB', 'TIP', 'SGOV', 'BIL',
  // Real estate
  'VNQ', 'SCHH', 'IYR',
  // Commodity
  'GLD', 'SLV', 'IAU',
  // Multi-asset
  'AOR', 'AOA',
];

const BENCHMARKS = ['SPY', 'QQQ'];

// ── Seeded RNG for synthetic fallback ──
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── Asset-class typical annual return & vol (for synthetic fallback) ──
const ASSET_CLASS_PROFILES = {
  Equity:      { annualReturn: 0.10, annualVol: 0.16 },
  Bond:        { annualReturn: 0.03, annualVol: 0.05 },
  Commodity:   { annualReturn: 0.05, annualVol: 0.15 },
  'Real Estate': { annualReturn: 0.08, annualVol: 0.18 },
  'Multi-Asset': { annualReturn: 0.07, annualVol: 0.10 },
  Other:       { annualReturn: 0.06, annualVol: 0.12 },
};

/**
 * Generate synthetic monthly series for a ticker when Yahoo is unavailable.
 * Uses seeded RNG based on ticker hash for reproducibility.
 */
function generateSyntheticSeries(ticker, months = 120) {
  const assetClass = ASSET_CLASS_MAP[ticker] || 'Equity';
  const profile = ASSET_CLASS_PROFILES[assetClass];
  const rng = mulberry32(hashString(ticker) + 42);

  const monthlyReturn = profile.annualReturn / 12;
  const monthlyVol = profile.annualVol / Math.sqrt(12);

  // Box-Muller for normal distribution
  function normalRandom() {
    const u1 = rng();
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  }

  const series = [];
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  let price = 100; // start at $100
  for (let i = 0; i <= months; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rounded = Math.round(price * 100) / 100;
    series.push({ date: dateStr, close: rounded, adjClose: rounded });
    price *= Math.exp(monthlyReturn + monthlyVol * normalRandom());
    if (price < 1) price = 1;
  }

  return series;
}

function buildSyntheticEtf(ticker) {
  const assetClass = ASSET_CLASS_MAP[ticker] || 'Equity';
  const prices = generateSyntheticSeries(ticker);
  const closes = prices.map((p) => p.close);
  const annualizedVol = computeAnnualizedVol(closes);
  const risk = deriveRiskBand(annualizedVol, assetClass);

  return {
    etf: {
      ticker,
      name: `${ticker} ETF`,
      issuer: null,
      assetClass,
      risk,
      riskLabel: RISK_LABELS[risk],
      expenseRatio: null,
      aum: null,
      inceptionDate: null,
      dividendYield: null,
      stdDev: Math.round(annualizedVol * 10000) / 10000,
      beta: null,
      numberOfHoldings: null,
      topHoldings: [],
      sectorWeights: [],
      assetBreakdown: { [assetClass]: 100 },
      overview: `${ticker} is ${articleFor(assetClass)} ${assetClass.toLowerCase()} ETF. (Synthetic data — real data unavailable.)`,
    },
    prices,
  };
}

// ── Main ──
async function main() {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const auth = await getYahooAuth();
  let useSynthetic = !auth;

  if (useSynthetic) {
    console.warn('[WARN] Could not authenticate with Yahoo (no network/crumb). Generating synthetic data.');
  }

  const etfs = [];
  const priceHistory = {};
  let fetchedCount = 0;
  let syntheticCount = 0;

  for (const ticker of TICKERS) {
    process.stdout.write(`Fetching ${ticker}...`);

    let result = null;
    if (!useSynthetic) {
      result = await fetchFromYahoo(auth, ticker);
    }

    if (result && result.etf) {
      etfs.push(result.etf);
      priceHistory[ticker] = result.prices;
      fetchedCount++;
      console.log(` OK (${result.prices.length} months)`);
    } else {
      const synthetic = buildSyntheticEtf(ticker);
      etfs.push(synthetic.etf);
      priceHistory[ticker] = synthetic.prices;
      syntheticCount++;
      console.log(` SYNTHETIC (${synthetic.prices.length} months)`);
    }

    // Small delay to be respectful to Yahoo
    if (!useSynthetic) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Build output
  const etfsOutput = useSynthetic || syntheticCount === TICKERS.length
    ? { _synthetic: true, etfs }
    : { _synthetic: syntheticCount > 0, etfs };

  const priceHistoryOutput = useSynthetic || syntheticCount === TICKERS.length
    ? { _synthetic: true, data: priceHistory }
    : { _synthetic: syntheticCount > 0, data: priceHistory };

  const etfsPath = join(FIXTURES_DIR, 'etfs.json');
  const pricesPath = join(FIXTURES_DIR, 'priceHistory.json');

  writeFileSync(etfsPath, JSON.stringify(etfsOutput, null, 2), 'utf-8');
  writeFileSync(pricesPath, JSON.stringify(priceHistoryOutput, null, 2), 'utf-8');

  console.log(`\nDone!`);
  console.log(`  ETFs: ${etfsPath} (${etfs.length} entries)`);
  console.log(`  Prices: ${pricesPath}`);
  console.log(`  Fetched: ${fetchedCount}, Synthetic: ${syntheticCount}`);

  if (syntheticCount > 0) {
    console.warn('\n[WARN] Some or all data is synthetic. Re-run with network access for real data.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
