#!/usr/bin/env node
/**
 * build-index.mjs — Generates a lightweight ETF index from the Nasdaq Trader
 * symbol directory. No Yahoo calls; pure name-based asset-class heuristic.
 *
 * Usage: node scripts/build-index.mjs   (or: npm run build-index)
 *
 * Output: src/data/fixtures/etfIndex.json
 *   { _generated: <ISO date>, count: <n>, data: [ {ticker, name, assetClass}, ... ] }
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyAssetClassByName } from './lib/yahoo-transport.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'src', 'data', 'fixtures');

const NASDAQ_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt';

async function main() {
  console.log('Fetching Nasdaq Traded symbol directory...');
  const resp = await fetch(NASDAQ_URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from nasdaqtrader.com`);
  const text = await resp.text();

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  // Drop header (line 0) and the "File Creation Time" footer (last line)
  const dataLines = lines.slice(1).filter((l) => !l.startsWith('File Creation Time'));

  const etfs = [];
  for (const line of dataLines) {
    const cols = line.split('|');
    // Col indices (0-based): 0=Nasdaq Traded, 1=Symbol, 2=Security Name,
    //   3=Listing Exchange, 4=Market Category, 5=ETF, 6=Round Lot Size,
    //   7=Test Issue, 8=Financial Status, 9=CQS Symbol, 10=NASDAQ Symbol, 11=NextShares
    const etfFlag = (cols[5] || '').trim();
    const testIssue = (cols[7] || '').trim();

    if (etfFlag !== 'Y') continue;
    if (testIssue === 'Y') continue;

    const ticker = (cols[1] || '').trim();
    const name = (cols[2] || '').trim();
    if (!ticker) continue;

    const assetClass = classifyAssetClassByName(name);
    etfs.push({ ticker, name, assetClass });
  }

  // Sort by ticker
  etfs.sort((a, b) => a.ticker.localeCompare(b.ticker));

  mkdirSync(FIXTURES_DIR, { recursive: true });

  const output = {
    _generated: new Date().toISOString(),
    count: etfs.length,
    data: etfs,
  };

  const outPath = join(FIXTURES_DIR, 'etfIndex.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`Done! ${etfs.length} ETFs written to ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
