/**
 * Shared helpers for the Vercel serverless /api functions.
 *
 * Reuses the same Yahoo Finance transport layer as the dev-time Vite plugin
 * (scripts/lib/yahoo-transport.mjs). Files prefixed with "_" are not treated
 * as routes by Vercel.
 */
import * as transport from '../scripts/lib/yahoo-transport.mjs';

// Auth (cookie + crumb) is cached at module scope. It survives while the
// serverless instance stays warm; a cold start re-authenticates.
let authCache = null;

export async function getAuth(forceRefresh = false) {
  if (!authCache || forceRefresh) {
    authCache = await transport.getYahooAuth();
  }
  return authCache;
}

const VALID_TICKER = /^[A-Z0-9.\-]{1,8}$/;

/** Parse a comma-separated `symbols` param into up to 20 valid tickers. */
export function parseSymbols(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => VALID_TICKER.test(s))
    .slice(0, 20);
}

export function isValidTicker(ticker) {
  return VALID_TICKER.test(ticker);
}

export { transport };
