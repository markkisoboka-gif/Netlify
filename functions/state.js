// /netlify/functions/state.js
// Shared trade-data store, backed by Upstash Redis.
//
// GET  -> returns the current platform state (public — no auth required).
// POST -> overwrites the platform state (owner-only — requires a valid
//         session token from /api/login in the Authorization header).
//
// This replaces localStorage as the platform's source of truth, so every
// visitor sees the same real data, while only the owner can change it.

import { verifyToken } from './_auth.js';

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;
const STATE_KEY = 'platform:state';

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result; // null if key doesn't exist
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'text/plain'
    },
    body: value
  });
  if (!res.ok) throw new Error('Redis set failed: ' + res.status);
}

export default async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return new Response(JSON.stringify({
      error: 'Storage not configured on the server yet.',
      diagnostic: {
        urlPresent: !!REDIS_URL,
        urlLength: REDIS_URL ? REDIS_URL.length : 0,
        urlStartsCorrectly: REDIS_URL ? REDIS_URL.startsWith('https://') : false,
        tokenPresent: !!REDIS_TOKEN,
        tokenLength: REDIS_TOKEN ? REDIS_TOKEN.length : 0
      }
    }), { status: 500, headers: jsonHeaders });
  }

  if (request.method === 'GET') {
    try {
      const raw = await redisGet(STATE_KEY);
      if (raw === null) {
        return new Response(JSON.stringify({ state: null }), { status: 200, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ state: JSON.parse(raw) }), { status: 200, headers: jsonHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to read state', detail: String(err) }), {
        status: 500, headers: jsonHeaders
      });
    }
  }

  if (request.method === 'POST') {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!verifyToken(token)) {
      return new Response(JSON.stringify({ error: 'Not authorized. Please sign in again.' }), {
        status: 401, headers: jsonHeaders
      });
    }
    try {
      const body = await request.json();
      if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({ error: 'Invalid state payload' }), {
          status: 400, headers: jsonHeaders
        });
      }
      await redisSet(STATE_KEY, JSON.stringify(body));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to save state', detail: String(err) }), {
        status: 500, headers: jsonHeaders
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders });
};
