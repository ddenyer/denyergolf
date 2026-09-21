// /api/dg-load.js
//
// Returns every session and the saved goals for the players an access code is
// allowed to see. Also the home of authorise(), which the other dg-* endpoints
// import, so there is one place where "is this code allowed to touch this
// player" is decided.
//
// POST { code }
//   -> { ok:true, players:["charlotte"], display:{charlotte:"Charlotte"},
//        sessions:[...], meta:{...} }
//   -> { ok:true, needsName:true, players:[] }   valid coupon, nobody attached yet
//
// The code is the credential, not the key. Rows are keyed on a stable player
// name, so a code can be rotated without orphaning a single session.
//
// Env vars required on this Vercel project:
//   WP_APP_USER, WP_APP_PASSWORD            used by validate-code as well
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const TOOL = 'denyer-golf';

// A validated code is cached on the warm lambda so autosave does not make a
// WordPress round trip per save. A revoked code therefore keeps working for up
// to five minutes; the gate re-checks on every page load, which is the boundary
// that matters. The player lookup is NOT cached: claiming a name has to take
// effect on the very next request.
const seen = new Map();
const TTL = 5 * 60 * 1000;

export function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

export function cleanCode(code) {
  if (!code || typeof code !== 'string' || code.length > 50) return null;
  const c = code.trim().toUpperCase();
  return /^[A-Z0-9_-]+$/.test(c) ? c : null;
}

// Is this a real, live coupon for this tool? WordPress is the only authority on
// that, and it is a separate question from which player the code belongs to.
export async function couponValid(code) {
  const hit = seen.get(code);
  if (hit && Date.now() - hit < TTL) return { ok: true };

  const wpUser = process.env.WP_APP_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpUser || !wpPass) {
    console.error('dg: WP_APP_USER or WP_APP_PASSWORD is not set');
    return { ok: false, status: 500, reason: 'server_misconfigured' };
  }
  try {
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
    const r = await fetch(
      `https://changebefore.com/wp-json/changebefore/v1/validate-coupon/${code}`,
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
    if (d.tool && d.tool !== TOOL) return { ok: false, status: 403, reason: 'wrong_tool' };

    seen.set(code, Date.now());
    return { ok: true };
  } catch (err) {
    console.error('dg couponValid error:', err);
    return { ok: false, status: 502, reason: 'upstream_unreachable' };
  }
}

// The row for a code, or null. Never cached.
export async function codeRow(code) {
  const url = process.env.SUPABASE_URL;
  const r = await fetch(
    `${url}/rest/v1/dg_codes?code=eq.${encodeURIComponent(code)}&select=code,players,label,claimed_at,can_delete`,
    { headers: sbHeaders() }
  );
  if (!r.ok) throw new Error('code lookup failed: ' + (await r.text()));
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// The one gate every dg-* endpoint goes through.
//   { ok:true, code, players, row }        allowed
//   { ok:true, code, players:[], unclaimed:true }   real coupon, no player yet
//   { ok:false, status, reason }           refused
export async function authorise(raw) {
  const code = cleanCode(raw);
  if (!code) return { ok: false, status: 400, reason: 'invalid_code_format' };

  const valid = await couponValid(code);
  if (!valid.ok) return valid;

  let row;
  try {
    row = await codeRow(code);
  } catch (err) {
    console.error('dg authorise error:', err);
    return { ok: false, status: 500, reason: 'lookup_failed' };
  }

  const players = (row && Array.isArray(row.players)) ? row.players : [];
  if (!players.length) return { ok: true, code, players: [], unclaimed: true };
  return { ok: true, code, players, row };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }

  const auth = await authorise(req.body && req.body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });

  res.setHeader('Cache-Control', 'no-store');

  // A real coupon nobody has taken yet. The tool asks her what to call herself
  // and posts it to /api/dg-claim. Deliberately returns no sessions at all.
  if (auth.unclaimed) {
    return res.status(200).json({ ok: true, needsName: true, players: [], sessions: [], meta: {} });
  }

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

    // How her name should be spelled on screen. Capitalising the key gets
    // "Sophie-anne" wrong, so the name she actually typed is kept and sent back.
    const display = {};
    if (auth.players.length === 1 && auth.row && auth.row.label) {
      display[auth.players[0]] = auth.row.label;
    }

    // Tells the coach view whether to offer Remove player at all. Not the
    // control itself: the endpoint checks this again, along with the password.
    const canDelete = !!(auth.row && auth.row.can_delete);

    return res.status(200).json({ ok: true, players: auth.players, display, sessions, meta, canDelete });
  } catch (err) {
    console.error('dg-load error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
