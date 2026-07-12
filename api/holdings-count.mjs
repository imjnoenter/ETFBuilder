// GET /api/holdings-count?symbols=SPY,QQQ — holdings count + top holdings (up to 20)
import { parseSymbols, transport } from './_yahoo.mjs';

export default async function handler(req, res) {
  const symbols = parseSymbols(req.query.symbols);
  if (symbols.length === 0) {
    res.status(400).json({ error: 'bad_symbols' });
    return;
  }

  try {
    const results = {};
    await Promise.all(
      symbols.map(async (sym) => {
        results[sym] = await transport.fetchHoldingsData(sym);
      }),
    );
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
    res.status(200).json({ results });
  } catch (err) {
    res.status(502).json({ error: 'upstream', message: err?.message || 'Unknown error' });
  }
}
