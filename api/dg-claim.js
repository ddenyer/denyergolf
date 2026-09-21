// /api/dg-claim.js
//
// First use of a code nobody has taken yet: she types what to call herself and
// that creates her player. Adding a player is then a coupon and a link, with no
// file to edit and nothing to deploy.
//
// POST { code, name }  ->  { ok:true, player:"sophie", display:"Sophie" }
//                      ->  { ok:false, reason:"name_taken" | "already_claimed" | ... }
//
// The whole point of this endpoint is what it refuses, so the rules are stated
// plainly rather than buried:
//
//   1. The coupon must be real. WordPress decides that, same as everywhere else.
//   2. A code that already has a player cannot claim again. Otherwise a code
//      could be re-pointed at someone else's history later.
//   3. A name already held by another code is refused. Otherwise anyone issued
//      a fresh coupon could type "Charlotte" and be handed her sessions. This is
//      checked here and enforced again by a unique index, so a race between two
//      people claiming the same name at once still cannot produce two owners.
//
// Rule 3 is the one that matters. Everything else about self-naming is
// convenience; this is the part that keeps it from being a way in.

import { authorise, cleanCode, couponValid, codeRow, sbHeaders } from './dg-load.js';

// A display name becomes a stable key: lowercase, spaces and punctuation to
// hyphens. "Sophie-Anne" and "sophie anne" both land on "sophie-anne", which is
// what we want, because they are almost certainly the same person typing.
function slug(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }

  const body = req.body || {};
  const code = cleanCode(body.code);
  if (!code) return res.status(400).json({ ok: false, reason: 'invalid_code_format' });

  const raw = String(body.name || '').trim();
  if (raw.length < 2)  return res.status(400).json({ ok: false, reason: 'name_too_short' });
  if (raw.length > 40) return res.status(400).json({ ok: false, reason: 'name_too_long' });

  const player = slug(raw);
  if (!player) return res.status(400).json({ ok: false, reason: 'name_unusable' });

  // 1. real coupon?
  const valid = await couponValid(code);
  if (!valid.ok) return res.status(valid.status).json({ ok: false, reason: valid.reason });

  const headers = sbHeaders();

  try {
    // 2. has this code already been claimed?
    const mine = await codeRow(code);
    if (mine && Array.isArray(mine.players) && mine.players.length) {
      return res.status(409).json({ ok: false, reason: 'already_claimed' });
    }

    // 3. does any other code already own this name? Checked across every row,
    //    including multi-player coach codes, which the unique index does not
    //    cover on its own.
    const taken = await fetch(
      `${SUPABASE_URL}/rest/v1/dg_codes?players=cs.{"${player}"}&select=code`,
      { headers }
    );
    if (!taken.ok) {
      const t = await taken.text();
      return res.status(taken.status).json({ ok: false, reason: 'name_check_failed: ' + t });
    }
    const clash = await taken.json();
    if (Array.isArray(clash) && clash.length) {
      return res.status(409).json({ ok: false, reason: 'name_taken' });
    }

    // Belt and braces: a player with sessions already, but no code pointing at
    // her, is someone whose code was deleted. Handing her history to whoever
    // types the name next is exactly what this endpoint must not do.
    const existing = await fetch(
      `${SUPABASE_URL}/rest/v1/dg_sessions?player=eq.${encodeURIComponent(player)}&select=session_id&limit=1`,
      { headers }
    );
    if (existing.ok) {
      const rows = await existing.json();
      if (Array.isArray(rows) && rows.length) {
        return res.status(409).json({ ok: false, reason: 'name_taken' });
      }
    }

    const payload = {
      code,
      players: [player],
      label: raw,
      claimed_at: new Date().toISOString(),
    };

    const write = mine
      ? await fetch(`${SUPABASE_URL}/rest/v1/dg_codes?code=eq.${encodeURIComponent(code)}`,
          { method: 'PATCH', headers, body: JSON.stringify(payload) })
      : await fetch(`${SUPABASE_URL}/rest/v1/dg_codes`,
          { method: 'POST', headers, body: JSON.stringify(payload) });

    if (!write.ok) {
      const t = await write.text();
      // The unique index firing means someone claimed the same name a moment
      // ago. That is the constraint doing its job, not an error to report raw.
      if (/duplicate key|unique/i.test(t)) {
        return res.status(409).json({ ok: false, reason: 'name_taken' });
      }
      return res.status(write.status).json({ ok: false, reason: 'claim_failed: ' + t });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, player, display: raw });
  } catch (err) {
    console.error('dg-claim error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
