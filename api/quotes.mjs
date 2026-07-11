// GET /api/quotes?symbols=VOO,QQQ — batch live quotes (up to 20)
import { getAuth, parseSymbols, transport } from './_yahoo.mjs';

export default async function handler(req, res) {
  const symbols = parseSymbols(req.query.symbols);
  if (symbols.length === 0) {
    res.status(400).json({ error: 'bad_symbols', message: 'Provide 1-20 valid ticker symbols' });
    return;
  }

  try {
    let auth = await getAuth();
    const batchUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${auth.crumb}`;
    let data;
    try {
      data = await transport.yahooJson(batchUrl, auth);
    } catch {
      auth = await getAuth(true);
      const retryUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&crumb=${auth.crumb}`;
      data = await transport.yahooJson(retryUrl, auth);
    }

    const results = data?.quoteResponse?.result || [];
    const quotes = {};
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

    res.status(200).json({ quotes });
  } catch (err) {
    res.status(502).json({ error: 'upstream', message: err?.message || 'Unknown error' });
  }
}
