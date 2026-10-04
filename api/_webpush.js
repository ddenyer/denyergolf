// /api/_webpush.js
//
// Web Push with no dependencies: the VAPID signature (RFC 8292) and the
// aes128gcm payload encryption (RFC 8291), on Node's own crypto. The leading
// underscore keeps Vercel from serving this file as an endpoint; it is only
// ever imported.
//
// Written out rather than pulled in as the web-push package because this
// project deploys api/*.js with no package.json, and adding one to a working
// deployment to send two messages a day is a bigger change than eighty lines.
//
// Env vars:
//   VAPID_PUBLIC_KEY   65-byte uncompressed P-256 point, base64url
//   VAPID_PRIVATE_KEY  32-byte private scalar, base64url
//   VAPID_SUBJECT      optional: a mailto: or https: contact for the push services

import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }

// The private key as a KeyObject, rebuilt from the two env strings.
function vapidKey(pub, priv) {
  const p = unb64u(pub);
  if (p.length !== 65 || p[0] !== 4) throw new Error('VAPID_PUBLIC_KEY is not an uncompressed P-256 point');
  return crypto.createPrivateKey({ key: {
    kty: 'EC', crv: 'P-256',
    x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)), d: String(priv),
  }, format: 'jwk' });
}

// The signed token that proves the message comes from the holder of the key the
// browser subscribed with. Raw r||s signature, as JWS ES256 requires.
export function vapidAuth(endpoint, { pub, priv, subject }, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: vapidKey(pub, priv), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${pub}`;
}

// RFC 8291: one record, aes128gcm. Salt and the sender's ephemeral key are
// fresh for every message.
export function encrypt(sub, payload, salt = crypto.randomBytes(16), eph = null) {
  const uaPub = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  const ecdh = eph || crypto.createECDH('prime256v1');
  if (!eph) ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPub);

  const prkKey = hmac(auth, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);

  const plain = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);   // 0x02: the last record
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);

  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

// Send one message. Gives back the push service's status: 201 is delivered to
// the service, 404 and 410 mean the subscription is dead and should be dropped.
export async function sendPush(sub, data, vapid, ttl = 6 * 3600) {
  const body = encrypt(sub, JSON.stringify(data));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
      Authorization: vapidAuth(sub.endpoint, vapid),
    },
    body,
  });
  // the push service's own words when it refuses, for the record (Apple sends
  // a reason such as BadJwtToken)
  lastPush.status = r.status;
  lastPush.reason = r.ok ? '' : String(await r.text().catch(() => '')).slice(0, 200);
  return r.status;
}
export const lastPush = { status: 0, reason: '' };

export { b64u, unb64u };
