// /api/dg-remove-player.js
//
// Removes a player and everything they have ever logged. Final, no recovery.
//
// POST { code, player, confirm, password }
//   -> { ok:true, removed:{ sessions:n, meta:n, codes:n } }
//
// Three things must line up before anything is deleted, because there is no
// putting it back:
//
//   1. The code must be one that is allowed to delete (can_delete on its row)
//      AND must already open that player. A player's own code cannot delete her.
//   2. `confirm` must be the word yes, typed by hand.
//   3. `password` must match DG_ADMIN_PASSWORD, which lives in the Vercel
//      environment and never reaches the browser.
//
// Point 3 is the one worth understanding. The coach password in the page
// (Coach1*) is readable by anyone who opens the tool, so it is a partition, not
// a lock. This one is not in the page and not in this file. If it is not set,
// deletion is refused outright rather than falling open.

import { authorise, sbHeaders, timedFetch } from './dg-load.js';

// Same time regardless of where the mismatch is, so the response cannot be used
// to work the password out a character at a time.
// A wrong password costs nothing to try again, and this endpoint is the only
// thing between a valid coach code and wiping a player for good. Five wrong
// answers and this code is refused for fifteen minutes, whatever it sends.
// Per warm lambda rather than global, so it is a speed bump and not a lock, but
// a speed bump turns an afternoon's guessing into something that cannot finish.
const misses = new Map();
const MAX_MISS = 5;
const LOCKOUT = 15 * 60 * 1000;

function lockedOut(code) {
  const m = misses.get(code);
  if (!m) return false;
  if (Date.now() - m.at > LOCKOUT) { misses.delete(code); return false; }
  return m.n >= MAX_MISS;
}
function noteMiss(code) {
  const m = misses.get(code);
  if (m && Date.now() - m.at <= LOCKOUT) { m.n++; m.at = Date.now(); }
  else misses.set(code, { n: 1, at: Date.now() });
}

function sameSecret(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!x || !y) return false;
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }

  const admin = process.env.DG_ADMIN_PASSWORD;
  if (!admin) {
    console.error('dg-remove-player: DG_ADMIN_PASSWORD is not set, refusing');
    return res.status(500).json({ ok: false, reason: 'no_admin_password' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim().toLowerCase();
  if (!player) return res.status(400).json({ ok: false, reason: 'no_player' });

  if (String(body.confirm || '').trim().toLowerCase() !== 'yes') {
    return res.status(400).json({ ok: false, reason: 'not_confirmed' });
  }

  const auth = await authorise(body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });
  if (auth.unclaimed) return res.status(403).json({ ok: false, reason: 'not_allowed' });

  if (!auth.row || auth.row.can_delete !== true) {
    return res.status(403).json({ ok: false, reason: 'not_allowed' });
  }
  if (auth.players.indexOf(player) === -1) {
    return res.status(403).json({ ok: false, reason: 'not_your_player' });
  }
  if (lockedOut(auth.code)) {
    return res.status(429).json({ ok: false, reason: 'too_many_attempts' });
  }
  if (!sameSecret(body.password, admin)) {
    noteMiss(auth.code);
    return res.status(403).json({ ok: false, reason: 'bad_password' });
  }
  misses.delete(auth.code);

  const headers = Object.assign({}, sbHeaders(), { Prefer: 'return=representation' });
  const p = encodeURIComponent(player);
  const removed = { sessions: 0, meta: 0, codes: 0 };

  try {
    // Her codes go first. If anything below fails, she is already locked out
    // rather than left with a working code and half her history.
    const dropCode = await timedFetch(
      `${SUPABASE_URL}/rest/v1/dg_codes?players=eq.{${p}}&select=code`,
      { method: 'DELETE', headers }
    );
    if (!dropCode.ok) {
      const t = await dropCode.text();
      return res.status(dropCode.status).json({ ok: false, reason: 'code delete failed: ' + t });
    }
    removed.codes = (await dropCode.json()).length;

    // Take her out of any code that opens several players, such as the coach's,
    // without deleting that code.
    const shared = await timedFetch(
      `${SUPABASE_URL}/rest/v1/dg_codes?players=cs.{"${player}"}&select=code,players`,
      { headers: sbHeaders() }
    );
    if (shared.ok) {
      const rows = await shared.json();
      for (const row of rows) {
        const left = (row.players || []).filter((x) => x !== player);
        await timedFetch(`${SUPABASE_URL}/rest/v1/dg_codes?code=eq.${encodeURIComponent(row.code)}`, {
          method: 'PATCH', headers: sbHeaders(), body: JSON.stringify({ players: left }),
        });
      }
    }

    const dropMeta = await timedFetch(
      `${SUPABASE_URL}/rest/v1/dg_meta?player=eq.${p}&select=player`,
      { method: 'DELETE', headers }
    );
    if (dropMeta.ok) removed.meta = (await dropMeta.json()).length;

    const dropSessions = await timedFetch(
      `${SUPABASE_URL}/rest/v1/dg_sessions?player=eq.${p}&select=session_id`,
      { method: 'DELETE', headers }
    );
    if (!dropSessions.ok) {
      const t = await dropSessions.text();
      return res.status(dropSessions.status).json({ ok: false, reason: 'session delete failed: ' + t });
    }
    removed.sessions = (await dropSessions.json()).length;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, player, removed });
  } catch (err) {
    console.error('dg-remove-player error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
