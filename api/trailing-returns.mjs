// GET /api/trailing-returns?symbols=VOO,QQQ — trailing period returns (up to 20)
import { getAuth, parseSymbols, transport } from './_yahoo.mjs';

export default async function handler(req, res) {
  const symbols = parseSymbols(req.query.symbols);
  if (symbols.length === 0) {
    res.status(400).json({ error: 'bad_symbols' });
    return;
  }

  try {
    let auth = await getAuth();
    if (!auth) {
      auth = await getAuth(true);
    }

    const results = {};
    await Promise.all(
      symbols.map(async (sym) => {
        let ret = await transport.fetchTrailingReturns(auth, sym);
        if (!ret) {
          const freshAuth = await getAuth(true);
          ret = await transport.fetchTrailingReturns(freshAuth, sym);
        }
        if (ret) results[sym] = ret;
      }),
    );

    res.status(200).json({ results });
  } catch (err) {
    res.status(502).json({ error: 'upstream', message: err?.message || 'Unknown error' });
  }
}
