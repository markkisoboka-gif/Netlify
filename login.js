// /netlify/functions/login.js
// Checks the submitted password against the server-side secret and, if it
// matches, issues a session token the browser can use to unlock write access.
// The real password never lives in any file that gets deployed — only in a
// Netlify environment variable.

import crypto from 'crypto';
import { createToken } from './_auth.js';

const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';

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

  if (!OWNER_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Owner password not configured on the server yet.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const submitted = ((body && body.password) || '').trim();
  const expected = OWNER_PASSWORD.trim();

  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ token: createToken() }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
