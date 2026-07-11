// GET /api/stock-sectors?symbols=AAPL,MSFT — batch stock sector lookup (up to 20)
import { getAuth, parseSymbols, transport } from './_yahoo.mjs';

export default async function handler(req, res) {
  const symbols = parseSymbols(req.query.symbols);
  if (symbols.length === 0) {
    res.status(400).json({ error: 'bad_symbols' });
    return;
  }

  try {
    let auth = await getAuth();
    const fields = 'symbol,sector,industry';
    const batchUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=${fields}&crumb=${auth.crumb}`;
    let data;
    try {
      data = await transport.yahooJson(batchUrl, auth);
    } catch {
      auth = await getAuth(true);
      const retryUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=${fields}&crumb=${auth.crumb}`;
      data = await transport.yahooJson(retryUrl, auth);
    }

    const results = data?.quoteResponse?.result || [];
    const sectors = {};
    for (const item of results) {
      sectors[item.symbol] = {
        sector: item.sector ?? '',
        industry: item.industry ?? '',
      };
    }

    res.status(200).json({ sectors });
  } catch (err) {
    res.status(502).json({ error: 'upstream', message: err?.message || 'Unknown error' });
  }
}
