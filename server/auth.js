import crypto from 'node:crypto';

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '==='.slice((normalized.length + 3) % 4), 'base64').toString('utf8');
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function verifyJwtHs256(token, { issuer, audience, secret }) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing bearer token');
  }
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const [encodedHeader, encodedPayload, signature] = parts;
  const header = JSON.parse(base64UrlDecode(encodedHeader));
  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (header.alg !== 'HS256') throw new Error('Unsupported JWT algorithm');
  if (payload.iss !== issuer) throw new Error('JWT issuer mismatch');

  const aud = payload.aud;
  const audValid = Array.isArray(aud) ? aud.includes(audience) : aud === audience;
  if (!audValid) throw new Error('JWT audience mismatch');

  if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) {
    throw new Error('JWT expired');
  }

  const expected = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest()
  );

  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    throw new Error('JWT signature invalid');
  }

  return payload;
}
