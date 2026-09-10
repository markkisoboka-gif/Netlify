// /netlify/functions/quote.js
// Runs server-side — fetches Yahoo Finance directly.
// No third-party CORS proxy involved, since server-to-server requests
// aren't subject to browser CORS restrictions at all.
//
// Usage from the browser: fetch('/api/quote?symbol=^FTSE')

export default async (request) => {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const yahooRes = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProportionalPlatform/1.0)'
      }
    });

    if (!yahooRes.ok) {
      return new Response(JSON.stringify({ error: `Yahoo responded with ${yahooRes.status}` }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await yahooRes.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof price !== 'number') {
      return new Response(JSON.stringify({ error: 'No price in Yahoo response' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ symbol, price }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=15, stale-while-revalidate=30'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed', detail: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
