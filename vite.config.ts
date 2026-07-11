import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

/**
 * Inline Vite plugin: serves GET /api/etf/:ticker during dev.
 * Uses the shared yahoo-transport module for auth + data fetching.
 * Zero npm dependencies beyond Node built-ins.
 */
function etfApiPlugin(): Plugin {
  // Module-scoped Yahoo auth cache
  let authCache: { cookie: string; crumb: string } | null = null;
  let transport: any = null;

  const transportPath = join(process.cwd(), 'scripts', 'lib', 'yahoo-transport.mjs');

  async function loadTransport() {
    if (transport) return transport;
    const modUrl = pathToFileURL(transportPath).href + `?t=${Date.now()}`;
    transport = await import(/* @vite-ignore */ modUrl);
    return transport;
  }

  async function getAuth(forceRefresh = false) {
    const t = await loadTransport();
    if (!authCache || forceRefresh) {
      authCache = await t.getYahooAuth();
    }
    return authCache;
  }

  return {
    name: 'etf-api',
    configureServer(server) {
      server.watcher.add(transportPath);
      server.watcher.on('change', (file) => {
        if (file.replace(/\\/g, '/').endsWith('scripts/lib/yahoo-transport.mjs')) {
          transport = null;
          authCache = null;
          console.log('[etf-api] yahoo-transport.mjs changed — cache invalidated');
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET') return next();

        // Batch quotes endpoint: GET /api/quotes?symbols=VOO,QQQ,SCHD
        if (req.url?.startsWith('/api/quotes')) {
          const url = new URL(req.url, 'http://localhost');
          const raw = url.searchParams.get('symbols') || '';
          const validTicker = /^[A-Z0-9.\-]{1,8}$/;
          const symbols = raw
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter((s) => validTicker.test(s))
            .slice(0, 20);

          if (symbols.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'bad_symbols', message: 'Provide 1-20 valid ticker symbols' }));
            return;
          }

          try {
            const t = await loadTransport();
            let auth = await getAuth();
            const batchUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${auth!.crumb}`;
            let data: any;
            try {
              data = await t.yahooJson(batchUrl, auth);
            } catch {
              auth = await getAuth(true);
              const retryUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${auth!.crumb}`;
              data = await t.yahooJson(retryUrl, auth);
            }

            const results: any[] = data?.quoteResponse?.result || [];
            const quotes: Record<string, any> = {};
            for (const item of results) {
              quotes[item.symbol] = {
                symbol: item.symbol,
                shortName: item.shortName ?? null,
                regularMarketPrice: item.regularMarketPrice ?? null,
                regularMarketVolume: item.regularMarketVolume ?? null,
                ytdReturn: item.ytdReturn != null ? item.ytdReturn / 100 : null,
                netExpenseRatio: item.annualReportExpenseRatio ?? null,
                grossExpenseRatio: null,
                netAssets: item.totalAssets ?? null,
                morningstarRating: item.morningStarOverallRating ?? null,
                fiftyDayAverage: item.fiftyDayAverage ?? null,
                twoHundredDayAverage: item.twoHundredDayAverage ?? null,
                fiftyTwoWeekLow: item.fiftyTwoWeekLow ?? null,
                fiftyTwoWeekHigh: item.fiftyTwoWeekHigh ?? null,
                fetchedAt: Date.now(),
              };
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ quotes }));
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'upstream', message: err?.message || 'Unknown error' }));
          }
          return;
        }

        // Stock sectors endpoint: GET /api/stock-sectors?symbols=AAPL,MSFT
        if (req.url?.startsWith('/api/stock-sectors')) {
          const url = new URL(req.url, 'http://localhost');
          const raw = url.searchParams.get('symbols') || '';
          const validTicker = /^[A-Z0-9.\-]{1,8}$/;
          const symbols = raw
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter((s) => validTicker.test(s))
            .slice(0, 20);

          if (symbols.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'bad_symbols' }));
            return;
          }

          try {
            const t = await loadTransport();
            let auth = await getAuth();
            const batchUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=symbol,sector,industry&crumb=${auth!.crumb}`;
            let data: any;
            try {
              data = await t.yahooJson(batchUrl, auth);
            } catch {
              auth = await getAuth(true);
              const retryUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=symbol,sector,industry&crumb=${auth!.crumb}`;
              data = await t.yahooJson(retryUrl, auth);
            }

            const results: any[] = data?.quoteResponse?.result || [];
            const sectors: Record<string, { sector: string; industry: string }> = {};
            for (const item of results) {
              sectors[item.symbol] = {
                sector: item.sector ?? '',
                industry: item.industry ?? '',
              };
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ sectors }));
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'upstream', message: err?.message || 'Unknown error' }));
          }
          return;
        }

        // Holdings count endpoint: GET /api/holdings-count?symbols=SPY,QQQ
        if (req.url?.startsWith('/api/holdings-count')) {
          const url = new URL(req.url, 'http://localhost');
          const raw = url.searchParams.get('symbols') || '';
          const validTicker = /^[A-Z0-9.\-]{1,8}$/;
          const symbols = raw
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter((s) => validTicker.test(s))
            .slice(0, 20);

          if (symbols.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'bad_symbols' }));
            return;
          }

          try {
            const t = await loadTransport();
            const results: Record<string, any> = {};
            await Promise.all(
              symbols.map(async (sym) => {
                results[sym] = await t.fetchHoldingsData(sym);
              }),
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ results }));
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'upstream', message: err?.message || 'Unknown error' }));
          }
          return;
        }

        // Trailing returns endpoint: GET /api/trailing-returns?symbols=VOO,QQQ
        if (req.url?.startsWith('/api/trailing-returns')) {
          const url = new URL(req.url, 'http://localhost');
          const raw = url.searchParams.get('symbols') || '';
          const validTicker = /^[A-Z0-9.\-]{1,8}$/;
          const symbols = raw
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter((s) => validTicker.test(s))
            .slice(0, 20);

          if (symbols.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'bad_symbols' }));
            return;
          }

          try {
            const t = await loadTransport();
            let auth = await getAuth();
            if (!auth) {
              auth = await getAuth(true);
            }

            const results: Record<string, any> = {};
            await Promise.all(
              symbols.map(async (sym) => {
                let ret = await t.fetchTrailingReturns(auth, sym);
                if (!ret) {
                  const freshAuth = await getAuth(true);
                  ret = await t.fetchTrailingReturns(freshAuth, sym);
                }
                if (ret) results[sym] = ret;
              }),
            );

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ results }));
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'upstream', message: err?.message || 'Unknown error' }));
          }
          return;
        }

        // Single ETF endpoint: GET /api/etf/:ticker
        const match = req.url?.match(/^\/api\/etf\/([^/?#]+)/);
        if (!match) return next();

        const rawTicker = decodeURIComponent(match[1]).toUpperCase();

        // Sanitize: only A-Z, 0-9, dot, hyphen; 1-8 chars
        if (!/^[A-Z0-9.\-]{1,8}$/.test(rawTicker)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'bad_ticker', message: 'Ticker must be 1-8 chars: A-Z 0-9 . -' }));
          return;
        }

        try {
          const t = await loadTransport();
          let auth = await getAuth();
          if (!auth) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'upstream', message: 'Could not authenticate with Yahoo Finance' }));
            return;
          }

          let result = await t.fetchFromYahoo(auth, rawTicker);

          // If null (possible 401/stale auth), retry once with fresh auth
          if (result === null) {
            auth = await getAuth(true);
            if (auth) {
              result = await t.fetchFromYahoo(auth, rawTicker);
            }
          }

          res.setHeader('Content-Type', 'application/json');

          if (result === null) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'upstream', message: 'Yahoo Finance request failed' }));
          } else if (result.notFound) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'not_found', ticker: rawTicker }));
          } else if (result.notEtf) {
            res.statusCode = 422;
            res.end(JSON.stringify({ error: 'not_etf', ticker: rawTicker, quoteType: result.quoteType }));
          } else {
            res.statusCode = 200;
            res.end(JSON.stringify({ etf: result.etf, prices: result.prices }));
          }
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'upstream', message: err?.message || 'Unknown error' }));
        }
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  plugins: [react(), etfApiPlugin()],
  build: {
    chunkSizeWarningLimit: 650, // Main chunk includes ~800KB of static ETF fixture data
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
            return 'motion';
          }
        },
      },
    },
  },
})
