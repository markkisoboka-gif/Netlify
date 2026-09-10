// /netlify/functions/visits-stats.js
// Returns both visit counters. Owner-only — requires a valid session token,
// since these numbers were explicitly decided to stay private.

import { verifyToken } from './_auth.js';

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

export default async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!verifyToken(token)) {
    return new Response(JSON.stringify({ error: 'Not authorized.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return new Response(JSON.stringify({ error: 'Storage not configured on the server yet.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const [platformRes, landingRes] = await Promise.all([
      fetch(`${REDIS_URL}/get/visits:platform`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } }),
      fetch(`${REDIS_URL}/get/visits:landing`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } })
    ]);
    const platformData = await platformRes.json();
    const landingData = await landingRes.json();
    return new Response(JSON.stringify({
      platform: parseInt(platformData.result, 10) || 0,
      landing: parseInt(landingData.result, 10) || 0
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read visit stats', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
