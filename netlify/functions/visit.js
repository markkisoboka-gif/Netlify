// /netlify/functions/visit.js
// Increments a named visit counter. Public — anyone loading either page
// triggers this once. No personal data is stored, just a running total.

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

const VALID_SITES = ['platform', 'landing'];

export default async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return new Response(JSON.stringify({ error: 'Storage not configured on the server yet.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const site = body && body.site;

  if (!VALID_SITES.includes(site)) {
    return new Response(JSON.stringify({ error: 'site must be "platform" or "landing"' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const key = `visits:${site}`;
    const redisRes = await fetch(`${REDIS_URL}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    if (!redisRes.ok) throw new Error('Redis incr failed: ' + redisRes.status);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to record visit', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
