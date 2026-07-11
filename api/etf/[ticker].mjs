// GET /api/etf/:ticker — full ETF data + price history
import { getAuth, isValidTicker, transport } from '../_yahoo.mjs';

export default async function handler(req, res) {
  const rawTicker = String(req.query.ticker || '').toUpperCase();

  // Sanitize: only A-Z, 0-9, dot, hyphen; 1-8 chars
  if (!isValidTicker(rawTicker)) {
    res.status(400).json({ error: 'bad_ticker', message: 'Ticker must be 1-8 chars: A-Z 0-9 . -' });
    return;
  }

  try {
    let auth = await getAuth();
    if (!auth) {
      res.status(502).json({ error: 'upstream', message: 'Could not authenticate with Yahoo Finance' });
      return;
    }

    let result = await transport.fetchFromYahoo(auth, rawTicker);

    // If null (possible 401/stale auth), retry once with fresh auth
    if (result === null) {
      auth = await getAuth(true);
      if (auth) {
        result = await transport.fetchFromYahoo(auth, rawTicker);
      }
    }

    if (result === null) {
      res.status(502).json({ error: 'upstream', message: 'Yahoo Finance request failed' });
    } else if (result.notFound) {
      res.status(404).json({ error: 'not_found', ticker: rawTicker });
    } else if (result.notEtf) {
      res.status(422).json({ error: 'not_etf', ticker: rawTicker, quoteType: result.quoteType });
    } else {
      res.status(200).json({ etf: result.etf, prices: result.prices });
    }
  } catch (err) {
    res.status(502).json({ error: 'upstream', message: err?.message || 'Unknown error' });
  }
}
