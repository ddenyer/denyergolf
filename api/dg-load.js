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

// A code that WordPress has just refused is remembered for a short while too.
// Without it, a device holding a revoked code makes a WordPress round trip on
// every autosave, for as long as the app is open. The window is deliberately
// much shorter than the success cache: a coupon being fixed should take effect
// quickly, whereas a coupon being revoked is covered by the gate on page load.
const refused = new Map();
const BAD_TTL = 30 * 1000;

// Nothing here may hang. A Vercel function that is still waiting on WordPress
// when its own timeout fires returns nothing useful and bills for the wait, and
// upstream being slow is the single most likely reason for a save to fail. Every
// outbound call gets a deadline and a refusal that names itself.
const FETCH_MS = 7000;
export async function timedFetch(url, opts = {}, ms = FETCH_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
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

  const no = refused.get(code);
  if (no && Date.now() - no.at < BAD_TTL) {
    return { ok: false, status: no.status, reason: no.reason };
  }

  const wpUser = process.env.WP_APP_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpUser || !wpPass) {
    console.error('dg: WP_APP_USER or WP_APP_PASSWORD is not set');
    return { ok: false, status: 500, reason: 'server_misconfigured' };
  }
  // cleanCode has already limited this to [A-Z0-9_-], but it is going into a
  // URL path, so encode it anyway rather than relying on a check made elsewhere.
  const safe = encodeURIComponent(code);

  try {
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
    const r = await timedFetch(
      `https://changebefore.com/wp-json/changebefore/v1/validate-coupon/${safe}`,
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
      const out = { ok: false, status: 403, reason: (d && d.reason) || 'not_valid' };
      refused.set(code, { at: Date.now(), status: out.status, reason: out.reason });
      return out;
    }
    if (d.tool && d.tool !== TOOL) {
      const out = { ok: false, status: 403, reason: 'wrong_tool' };
      refused.set(code, { at: Date.now(), status: out.status, reason: out.reason });
      return out;
    }

    seen.set(code, Date.now());
    refused.delete(code);
    return { ok: true };
  } catch (err) {
    // An abort is this endpoint's own deadline firing, not a refusal. Say which,
    // because one is worth retrying in a moment and the other is not.
    const timedOut = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
    if (!timedOut) console.error('dg couponValid error:', err);
    return { ok: false, status: 504, reason: timedOut ? 'upstream_timeout' : 'upstream_unreachable' };
  }
}

// The row for a code, or null. Never cached.
export async function codeRow(code) {
  const url = process.env.SUPABASE_URL;
  const r = await timedFetch(
    `${url}/rest/v1/dg_codes?code=eq.${encodeURIComponent(code)}&select=code,players,label,claimed_at,can_delete&limit=1`,
    { headers: sbHeaders() }
  );
  if (!r.ok) throw new Error('code lookup failed: ' + (await r.text()));
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Player keys are created by slug() in dg-claim, so they are already
// [a-z0-9-]. This is what makes sure of it before one is spliced into a
// PostgREST filter: a key carrying a comma or a quote would not inject SQL,
// but it would silently change which rows the filter selects, and a filter
// that quietly matches the wrong player is worse than one that errors.
const KEY_OK = /^[a-z0-9-]{1,40}$/;
export function safeKeys(players) {
  return (Array.isArray(players) ? players : []).filter((p) => KEY_OK.test(p));
}

// The display name is the one piece of free text a player types that another
// person sees: the coach's list is drawn from it. Angle brackets and control
// characters have no business in a name, and stripping them here means the
// browser is never asked to be careful with it.
export function safeLabel(s) {
  return String(s == null ? '' : s)
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 40);
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

  const keys = safeKeys(auth.players);
  if (!keys.length) {
    return res.status(200).json({ ok: true, players: [], display: {}, sessions: [], meta: {}, canDelete: false });
  }
  const list = keys.map((p) => `"${p}"`).join(',');
  const headers = sbHeaders();

  try {
    const r = await timedFetch(
      `${SUPABASE_URL}/rest/v1/dg_sessions?player=in.(${list})&select=session_id,player,body,updated&order=updated.desc&limit=5000`,
      { headers }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ ok: false, reason: 'load_failed: ' + t });
    }
    const rows = await r.json();

    const m = await timedFetch(
      `${SUPABASE_URL}/rest/v1/dg_meta?player=in.(${list})&select=player,body&limit=200`,
      { headers }
    );
    // Goals and the library live here. Losing them silently is how a device ends
    // up holding sessions it has no practice definition to draw, so say so.
    if (!m.ok) console.error('dg-load: meta lookup failed', m.status, await m.text().catch(() => ''));
    const metaRows = m.ok ? await m.json() : [];

    // Each session says whose it is. The save endpoint strips `player` out of
    // the body because it has its own column, so without putting it back a code
    // that opens several players gets the sessions and no way to tell them
    // apart. That is exactly what happened to the coach view.
    const sessions = rows.map((row) => {
      const s = Object.assign({}, row.body);
      s.id = row.session_id;
      s.player = row.player;
      return s;
    });
    const meta = {};
    metaRows.forEach((row) => { meta[row.player] = row.body; });

    // How each name should be spelled on screen. Capitalising the key gets
    // "Sophie-anne" wrong, so the name she typed is kept and sent back. Done for
    // every player the code opens, not just the single-player case, so a coach
    // sees "Charlotte" rather than a tidied-up slug.
    const display = {};
    try {
      const own = await timedFetch(
        `${SUPABASE_URL}/rest/v1/dg_codes?players=ov.{${list}}&select=players,label&limit=200`,
        { headers }
      );
      if (own.ok) {
        const rows2 = await own.json();
        rows2.forEach((r) => {
          if (r.label && Array.isArray(r.players) && r.players.length === 1) {
            display[r.players[0]] = safeLabel(r.label);
          }
        });
      }
    } catch (e) { /* names fall back to the key, which is cosmetic */ }
    if (keys.length === 1 && auth.row && auth.row.label) {
      display[keys[0]] = safeLabel(auth.row.label);
    }

    // Tells the coach view whether to offer Remove player at all. Not the
    // control itself: the endpoint checks this again, along with the password.
    const canDelete = !!(auth.row && auth.row.can_delete);

    return res.status(200).json({ ok: true, players: keys, display, sessions, meta, canDelete });
  } catch (err) {
    console.error('dg-load error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
