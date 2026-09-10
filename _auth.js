// /api/_auth.js
// Simple, stateless session tokens for a single owner — no session database needed.
// A token is: base64(payload) + "." + HMAC-SHA256 signature of that payload,
// signed with a server-only secret. Anyone can read the payload, but nobody
// can forge a valid signature without the secret, so it can't be faked.

import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || '';
const SESSION_HOURS = 24;

export function createToken() {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !SECRET) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');

  // Constant-time comparison to avoid timing attacks
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    return typeof payload.exp === 'number' && Date.now() < payload.exp;
  } catch {
    return false;
  }
}
