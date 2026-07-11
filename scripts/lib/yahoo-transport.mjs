/**
 * yahoo-transport.mjs — Shared Yahoo Finance transport layer.
 *
 * Exports reusable auth, fetch, and classification helpers used by both
 * build-fixtures.mjs (dev-time fixture builder) and the Vite /api proxy
 * (live per-ticker lookup).
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ── Asset class mapping (manual — Yahoo doesn't reliably provide this) ──
export const ASSET_CLASS_MAP = {
  // Equity (core / style / factor / dividend / sector / international / thematic)
  SPY: 'Equity', VOO: 'Equity', IVV: 'Equity', VTI: 'Equity', QQQ: 'Equity',
  ITOT: 'Equity', SPLG: 'Equity', SCHB: 'Equity', DIA: 'Equity', RSP: 'Equity',
  IWM: 'Equity', IWB: 'Equity', VUG: 'Equity', VTV: 'Equity', VO: 'Equity',
  VB: 'Equity', MGK: 'Equity', SCHG: 'Equity', IWF: 'Equity', IWD: 'Equity',
  NOBL: 'Equity', DGRO: 'Equity', SCHD: 'Equity', VIG: 'Equity', VYM: 'Equity',
  HDV: 'Equity', DVY: 'Equity', SDY: 'Equity', JEPI: 'Equity',
  VEA: 'Equity', VWO: 'Equity', VXUS: 'Equity', VT: 'Equity', VEU: 'Equity',
  EFA: 'Equity', IEFA: 'Equity', EEM: 'Equity', IEMG: 'Equity', VGK: 'Equity',
  ACWI: 'Equity', XLK: 'Equity', VGT: 'Equity', XLF: 'Equity', XLE: 'Equity',
  XLV: 'Equity', VHT: 'Equity', XLY: 'Equity', XLP: 'Equity', XLI: 'Equity',
  XLB: 'Equity', XLU: 'Equity', XLC: 'Equity', SOXX: 'Equity', SMH: 'Equity',
  ARKK: 'Equity', IJR: 'Equity', IJH: 'Equity',
  // Bond
  BND: 'Bond', AGG: 'Bond', BNDX: 'Bond', TLT: 'Bond', IEF: 'Bond', SHY: 'Bond',
  GOVT: 'Bond', LQD: 'Bond', VCIT: 'Bond', VCSH: 'Bond', HYG: 'Bond', JNK: 'Bond',
  MUB: 'Bond', TIP: 'Bond', SGOV: 'Bond', BIL: 'Bond',
  // Real estate
  VNQ: 'Real Estate', SCHH: 'Real Estate', IYR: 'Real Estate',
  // Commodity
  GLD: 'Commodity', SLV: 'Commodity', IAU: 'Commodity',
  // Multi-asset
  AOR: 'Multi-Asset', AOA: 'Multi-Asset',
};

export const RISK_LABELS = {
  1: 'Conservative',
  2: 'Moderately Conservative',
  3: 'Moderate',
  4: 'Moderately Aggressive',
  5: 'Aggressive',
};

/**
 * RISK BAND DERIVATION
 *
 * Risk = f(annualized volatility, asset class).
 * Annualized vol = stddev(monthly log returns) * sqrt(12).
 *
 * Thresholds (calibrated from Vanguard-style bands):
 *   Band 1 (Conservative):   vol < 5%   (short-term bonds, money market)
 *   Band 2 (Mod Conservative): 5% <= vol < 10%  (aggregate bond, moderate allocation)
 *   Band 3 (Moderate):       10% <= vol < 16%  (balanced, international equity)
 *   Band 4 (Mod Aggressive): 16% <= vol < 22%  (broad equity, sector)
 *   Band 5 (Aggressive):     vol >= 22%  (sector concentrate, leveraged, EM, thematic)
 *
 * Bond asset class caps at band 3, Commodity caps at band 4.
 */
export function deriveRiskBand(annualizedVol, assetClass) {
  let band;
  if (annualizedVol < 0.05)      band = 1;
  else if (annualizedVol < 0.10) band = 2;
  else if (annualizedVol < 0.16) band = 3;
  else if (annualizedVol < 0.22) band = 4;
  else                           band = 5;

  // Asset class caps
  if (assetClass === 'Bond' && band > 3) band = 3;
  if (assetClass === 'Commodity' && band > 4) band = 4;

  return band;
}

/** "a" vs "an" for the overview sentence. */
export function articleFor(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function computeAnnualizedVol(monthlyCloses) {
  if (monthlyCloses.length < 3) return 0.15; // default
  const logReturns = [];
  for (let i = 1; i < monthlyCloses.length; i++) {
    if (monthlyCloses[i - 1] > 0 && monthlyCloses[i] > 0) {
      logReturns.push(Math.log(monthlyCloses[i] / monthlyCloses[i - 1]));
    }
  }
  if (logReturns.length < 2) return 0.15;
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

/** Unwrap Yahoo v10 {raw,fmt} number objects (or pass through plain numbers). */
export function num(x) {
  if (x == null) return null;
  if (typeof x === 'number') return x;
  if (typeof x === 'object' && typeof x.raw === 'number') return x.raw;
  return null;
}

/**
 * Fetch holdings data (count + top holdings list) from stockanalysis.com.
 * Returns { count: number | null, topHoldings: Array<{ symbol, name, weight }> }.
 */
export async function fetchHoldingsData(ticker) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  for (const path of ['/holdings/', '/']) {
    try {
      const url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}${path}`;
      const resp = await fetch(url, { headers: { 'User-Agent': ua } });
      if (!resp.ok) continue;
      const html = await resp.text();

      let count = null;
      const m1 = html.match(/total of ([\d,]+) individual holdings/i);
      if (m1) count = parseInt(m1[1].replace(/,/g, ''));
      if (count == null) {
        const m2 = html.match(/Showing \d+ of ([\d,]+) holdings/i);
        if (m2) count = parseInt(m2[1].replace(/,/g, ''));
      }
      if (count == null) {
        const m3 = html.match(/holdingsTable:\{count:(\d+)/);
        if (m3) count = parseInt(m3[1]);
      }
      if (count == null) {
        const m4 = html.match(/holdings:(\d+),/);
        if (m4) count = parseInt(m4[1]);
      }

      let topHoldings = [];
      const hm = html.match(/holdings:(\[\{.*?\}\])/s);
      if (hm) {
        try {
          const raw = new Function('return ' + hm[1])();
          topHoldings = raw.map((h) => ({
            symbol: (h.s || '').replace(/^[\$#!]|^mutf\//g, '').trim(),
            name: h.n || '',
            weight: parseFloat((h.as || '0').replace('%', '')) || 0,
          }));
        } catch { /* parse failed, keep empty */ }
      }

      if (count != null || topHoldings.length > 0) {
        return { count, topHoldings };
      }
    } catch {
      continue;
    }
  }
  return { count: null, topHoldings: [] };
}

/** Fetch a session cookie + crumb. Returns { cookie, crumb } or null. */
export async function getYahooAuth() {
  try {
    const c = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } });
    const cookie = (c.headers.get('set-cookie') || '').split(';')[0];
    if (!cookie) return null;
    const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie },
    });
    const crumb = (await cr.text()).trim();
    if (!cr.ok || !crumb || crumb.includes('<')) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

export async function yahooJson(url, auth) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: auth.cookie } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const SECTOR_LABELS = {
  realestate: 'Real Estate', consumer_cyclical: 'Consumer Cyclical',
  basic_materials: 'Basic Materials', consumer_defensive: 'Consumer Defensive',
  technology: 'Technology', communication_services: 'Communication Services',
  financial_services: 'Financial Services', utilities: 'Utilities',
  industrials: 'Industrials', energy: 'Energy', healthcare: 'Healthcare',
};

/**
 * Name-based asset-class heuristic (pure, no network).
 * Used for tickers NOT in ASSET_CLASS_MAP.
 */
export function classifyAssetClassByName(name) {
  const lc = (name || '').toLowerCase();
  if (/treasury|bond|fixed income|aggregate|municipal|t-bill|duration|credit|clo/.test(lc)) return 'Bond';
  if (/gold|silver|copper|oil|commodit|metal|natural gas|uranium/.test(lc)) return 'Commodity';
  if (/reit|real estate|mortgage/.test(lc)) return 'Real Estate';
  if (/allocation|multi-asset|target|balanced/.test(lc)) return 'Multi-Asset';
  return 'Equity';
}

/**
 * Fetch a single ETF from Yahoo Finance.
 *
 * Returns one of:
 *   { etf, prices }        — success (ETF data + PricePoint[])
 *   { notFound: true }     — Yahoo has no such symbol
 *   { notEtf: true, quoteType } — symbol exists but is not an ETF
 *
 * Never throws — upstream failures are returned as null (caller maps to 502).
 */
export async function fetchFromYahoo(auth, ticker) {
  try {
    const mods = 'price,summaryDetail,defaultKeyStatistics,fundProfile,topHoldings';
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10y&interval=1mo`;
    const qsUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${mods}&crumb=${encodeURIComponent(auth.crumb)}`;

    // Fetch chart — if 404, symbol not found
    let chartResp;
    try {
      chartResp = await fetch(chartUrl, { headers: { 'User-Agent': UA, Cookie: auth.cookie } });
    } catch {
      return null; // network failure
    }
    if (chartResp.status === 404) return { notFound: true };
    if (!chartResp.ok) throw new Error(`chart HTTP ${chartResp.status}`);
    const chartJson = await chartResp.json();

    // Check for Yahoo's "not found" inside a 200 response
    const chartErr = chartJson.chart?.error;
    if (chartErr && /not found|no data/i.test(chartErr.description || '')) {
      return { notFound: true };
    }

    // Fetch quoteSummary
    let qsJson;
    try {
      qsJson = await yahooJson(qsUrl, auth);
    } catch {
      // quoteSummary can fail for some tickers; proceed with chart data only
      qsJson = {};
    }

    // ── Check quoteType — reject non-ETFs ──
    const r = qsJson.quoteSummary?.result?.[0] || {};
    const price = r.price || {};
    const quoteType = price.quoteType || chartJson.chart?.result?.[0]?.meta?.instrumentType || null;

    if (quoteType && quoteType !== 'ETF') {
      return { notEtf: true, quoteType };
    }

    // ── Price history from chart endpoint ──
    const cres = chartJson.chart?.result?.[0];
    if (!cres) throw new Error('no chart result');
    const ts = cres.timestamp || [];
    const rawCloses = cres.indicators?.quote?.[0]?.close || [];
    const adjCloses = cres.indicators?.adjclose?.[0]?.adjclose || rawCloses;
    const dateMap = new Map();
    for (let i = 0; i < ts.length; i++) {
      const raw = rawCloses[i];
      const adj = adjCloses[i];
      if (raw == null && adj == null) continue;
      const d = new Date(ts[i] * 1000);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      dateMap.set(date, {
        date,
        close: Math.round((raw ?? adj) * 100) / 100,
        adjClose: Math.round((adj ?? raw) * 100) / 100,
      });
    }
    const dedupedPrices = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    if (dedupedPrices.length < 3) throw new Error('insufficient price history');

    const closes = dedupedPrices.map((p) => p.close);
    const annualizedVol = computeAnnualizedVol(closes);

    // ── Asset class: prefer map, then Yahoo category, then name heuristic ──
    const detail = r.summaryDetail || {};
    const stats = r.defaultKeyStatistics || {};
    const profile = r.fundProfile || {};
    const holdings = r.topHoldings || {};
    const longName = price.longName || price.shortName || cres.meta?.longName || cres.meta?.shortName;

    let assetClass = ASSET_CLASS_MAP[ticker];
    if (!assetClass) {
      const category = (profile.categoryName || '').toLowerCase();
      if (category) {
        if (/bond|fixed|treasury|municipal|aggregate|credit|t-bill|duration|clo/.test(category)) assetClass = 'Bond';
        else if (/commodit|gold|silver|oil|metal/.test(category)) assetClass = 'Commodity';
        else if (/real estate|reit|mortgage/.test(category)) assetClass = 'Real Estate';
        else if (/allocation|multi-asset|target|balanced/.test(category)) assetClass = 'Multi-Asset';
      }
      if (!assetClass) {
        assetClass = classifyAssetClassByName(longName);
      }
    }

    const risk = deriveRiskBand(annualizedVol, assetClass);

    const numberOfHoldings = num(holdings.numberOfHoldings) ?? null;

    const topHoldings = (holdings.holdings || []).map((h) => ({
      symbol: h.symbol || '',
      name: h.holdingName || h.symbol || 'Unknown',
      weight: num(h.holdingPercent) != null ? Math.round(num(h.holdingPercent) * 10000) / 100 : 0,
    }));

    const sectorWeights = (holdings.sectorWeightings || [])
      .map((sw) => {
        const key = Object.keys(sw)[0];
        const w = num(sw[key]);
        return { sector: SECTOR_LABELS[key] || key, weight: w != null ? Math.round(w * 10000) / 100 : 0 };
      })
      .filter((s) => s.weight > 0);

    const inceptionRaw = num(profile.fundInceptionDate) ?? num(stats.fundInceptionDate);
    const expense = num(profile.feesExpensesInvestment?.annualReportExpenseRatio) ?? num(stats.annualReportExpenseRatio) ?? num(detail.expenseRatio);

    const etf = {
      ticker,
      name: longName || ticker,
      issuer: (profile.family || '').trim() || null,
      assetClass,
      risk,
      riskLabel: RISK_LABELS[risk],
      expenseRatio: expense ?? null,
      aum: num(detail.totalAssets) ?? num(price.marketCap) ?? null,
      inceptionDate: inceptionRaw != null
        ? new Date(inceptionRaw * 1000).toISOString().split('T')[0]
        : null,
      dividendYield: num(detail.yield) ?? num(detail.trailingAnnualDividendYield) ?? null,
      stdDev: annualizedVol != null && annualizedVol !== 0 && !Number.isNaN(annualizedVol)
        ? Math.round(annualizedVol * 10000) / 10000
        : null,
      beta: (() => {
        const raw = num(stats.beta3Year) ?? num(detail.beta) ?? null;
        // A real fund cannot have beta exactly 0; treat 0/NaN as missing
        return raw != null && raw !== 0 && !Number.isNaN(raw) ? raw : null;
      })(),
      numberOfHoldings,
      topHoldings,
      sectorWeights,
      assetBreakdown: { [assetClass]: 100 },
      overview: longName
        ? `${longName} (${ticker}) is ${articleFor(assetClass)} ${assetClass.toLowerCase()} ETF.`
        : `${ticker} is ${articleFor(assetClass)} ${assetClass.toLowerCase()} ETF.`,
    };

    return { etf, prices: dedupedPrices };
  } catch (err) {
    console.warn(`  [WARN] fetchFromYahoo(${ticker}): ${err.message}`);
    return null;
  }
}

/**
 * Fetch trailing returns for a single ticker via the fundPerformance module.
 * Returns { '1M', '3M', '1Y', '3Y', '5Y' } or null on failure.
 */
export async function fetchTrailingReturns(auth, ticker) {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=fundPerformance&crumb=${encodeURIComponent(auth.crumb)}`;
    const data = await yahooJson(url, auth);
    const trailing = data?.quoteSummary?.result?.[0]?.fundPerformance?.trailingReturns || {};
    return {
      '1M': num(trailing.oneMonth) ?? null,
      '3M': num(trailing.threeMonth) ?? null,
      '1Y': num(trailing.oneYear) ?? null,
      '3Y': num(trailing.threeYear) ?? null,
      '5Y': num(trailing.fiveYear) ?? null,
    };
  } catch {
    return null;
  }
}
