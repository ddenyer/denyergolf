// /api/dg-load.js
//
// Returns every session and the saved goals for the players an access code is
// allowed to see.
//
// POST { code }
//   -> { ok:true, players:["charlotte"], sessions:[...], meta:{ charlotte:{...} } }
//
// The code is the credential, not the key. Rows are keyed on a stable player
// name, so a code can be rotated (and it should be: CHABO and BELLA are
// guessable) without orphaning a single session.
//
// Env vars required on this Vercel project:
//   WP_APP_USER, WP_APP_PASSWORD            already set, used by validate-code
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY copy from changebefore-tools

const TOOL = 'denyer-golf';

// Which players each code may read and write. Server-side on purpose: this used
// to sit in the page, where anyone who opened the tool could read that CHABO is
// Charlotte. A coach code listing both players is all it would take to drop the
// manual export/import step in the coach view.
const PLAYERS = {
  CHABO: ['charlotte'],
  BELLA: ['annabel'],
};

// A validated code is cached on the warm lambda so autosave does not make a
// WordPress round trip per save. A revoked code therefore keeps working for up
// to five minutes; the gate re-checks on every page load, which is the boundary
// that matters.
const seen = new Map();
const TTL = 5 * 60 * 1000;

export async function authorise(code) {
  if (!code || typeof code !== 'string' || code.length > 50) {
    return { ok: false, status: 400, reason: 'invalid_code_format' };
  }
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(clean)) {
    return { ok: false, status: 400, reason: 'invalid_code_format' };
  }

  const players = PLAYERS[clean];
  if (!players) return { ok: false, status: 403, reason: 'unknown_code' };

  const hit = seen.get(clean);
  if (hit && Date.now() - hit < TTL) return { ok: true, code: clean, players };

  const wpUser = process.env.WP_APP_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpUser || !wpPass) {
    console.error('dg: WP_APP_USER or WP_APP_PASSWORD is not set');
    return { ok: false, status: 500, reason: 'server_misconfigured' };
  }

  try {
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
    const r = await fetch(
      `https://changebefore.com/wp-json/changebefore/v1/validate-coupon/${clean}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (!r.ok) return { ok: false, status: 502, reason: 'upstream_error' };

    let d;
    try {
      d = await r.json();
    } catch (e) {
      // Usually a SiteGround HTML block page rather than JSON. Clears in an hour.
      return { ok: false, status: 502, reason: 'non_json_response' };
    }
    if (!d || d.valid !== true) {
      return { ok: false, status: 403, reason: (d && d.reason) || 'not_valid' };
    }
    if (d.tool && d.tool !== TOOL) {
      return { ok: false, status: 403, reason: 'wrong_tool' };
    }

    seen.set(clean, Date.now());
    return { ok: true, code: clean, players };
  } catch (err) {
    console.error('dg authorise error:', err);
    return { ok: false, status: 502, reason: 'upstream_unreachable' };
  }
}

export function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }

  const auth = await authorise(req.body && req.body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });

  const list = auth.players.map((p) => `"${p}"`).join(',');
  const headers = sbHeaders();

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/dg_sessions?player=in.(${list})&select=session_id,player,body,updated&order=updated.desc&limit=2000`,
      { headers }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ ok: false, reason: 'load_failed: ' + t });
    }
    const rows = await r.json();

    const m = await fetch(
      `${SUPABASE_URL}/rest/v1/dg_meta?player=in.(${list})&select=player,body`,
      { headers }
    );
    const metaRows = m.ok ? await m.json() : [];

    const sessions = rows.map((row) => {
      const s = Object.assign({}, row.body);
      s.id = row.session_id;
      return s;
    });
    const meta = {};
    metaRows.forEach((row) => { meta[row.player] = row.body; });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, players: auth.players, sessions, meta });
  } catch (err) {
    console.error('dg-load error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
