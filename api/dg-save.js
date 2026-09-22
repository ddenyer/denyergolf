// /api/dg-save.js
//
// Saves sessions and goals for the players an access code is allowed to write.
// Idempotent: matches an existing row on (player, session_id) and updates it,
// or inserts a new one.
//
// POST {
//   code,                  the access code, checked against WordPress
//   sessions: [ { id, player, ... } ],   one on autosave, many on first sync
//   meta:     { charlotte: {...} }       optional, roster and goals
// }
//   -> { ok:true, updated:n, inserted:n, rejected:[...] }
//
// Explicit GET-then-PATCH-or-INSERT, not `Prefer: resolution=merge-duplicates`.
// The merge header relies on a unique constraint that is easy to misconfigure
// and its failure mode is a save that quietly did not happen. See the building
// reference: this is the first thing to check when a save goes missing.

import { authorise, sbHeaders, timedFetch } from './dg-load.js';

const MAX_BATCH = 500;

// A session body that is wildly larger than any real session is a corrupted one,
// and letting it through means every later save in the batch fails behind it.
const MAX_BODY = 400 * 1024;

// Same rule as dg-claim's slug(). A device sending "Sophie Anne" where the
// server filed "sophie-anne" used to be rejected as somebody else's player, and
// the rejection was invisible: the save simply never happened. Deriving the key
// the same way on both sides is the only version of this that stays fixed.
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
  const auth = await authorise(body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });
  // A real coupon that nobody has named themselves on yet. It owns no player,
  // so there is nothing it may write to.
  if (auth.unclaimed) return res.status(409).json({ ok: false, reason: 'needs_name' });

  const allowed = {};
  auth.players.forEach((p) => { allowed[p] = true; });

  const sessions = Array.isArray(body.sessions) ? body.sessions.slice(0, MAX_BATCH) : [];
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : null;
  const headers = sbHeaders();

  let updated = 0, inserted = 0;
  const rejected = [];

  // One session that Supabase will not take used to abort the whole request.
  // Every session queued behind it was never written, the device retried the
  // same batch on every load, and it failed at the same row every time. A
  // history could therefore stop backing up permanently because of one bad row,
  // and nothing anywhere said so. Each session now stands or falls on its own,
  // and what was refused comes back by name.
  let broke = null;

  try {
    for (const s of sessions) {
      const player = slug(s && s.player);
      const sessionId = s && s.id ? String(s.id) : '';

      if (!player || !allowed[player]) { rejected.push({ id: sessionId, why: 'not_your_player' }); continue; }
      if (!sessionId) { rejected.push({ id: '', why: 'no_id' }); continue; }
      if (sessionId.length > 200) { rejected.push({ id: sessionId.slice(0, 40), why: 'bad_id' }); continue; }

      // The row body is the session as the tool holds it, minus the routing
      // fields that get their own columns.
      const clean = Object.assign({}, s);
      delete clean.player;
      delete clean.id;

      let encoded;
      try {
        encoded = JSON.stringify(clean);
      } catch (e) {
        rejected.push({ id: sessionId, why: 'unserialisable' });
        continue;
      }
      if (encoded.length > MAX_BODY) { rejected.push({ id: sessionId, why: 'too_big' }); continue; }

      const lookup =
        `player=eq.${encodeURIComponent(player)}&session_id=eq.${encodeURIComponent(sessionId)}`;

      try {
        const getResp = await timedFetch(
          `${SUPABASE_URL}/rest/v1/dg_sessions?${lookup}&select=id,sv&limit=1`,
          { headers }
        );
        if (!getResp.ok) {
          // A 5xx from Supabase is about the service, not this row, so stop
          // rather than grinding through five hundred of them.
          if (getResp.status >= 500) { broke = 'lookup failed: ' + (await getResp.text()); break; }
          rejected.push({ id: sessionId, why: 'lookup_refused' });
          continue;
        }
        const existing = await getResp.json();

        const sv = Number(s.sv) || 0;
        const payload = {
          player,
          session_id: sessionId,
          status: s.status || null,
          played_on: s.date || null,
          area_id: s.areaId || null,
          kind: s.kind || null,
          sv,
          body: clean,
          updated: new Date().toISOString(),
        };

        if (Array.isArray(existing) && existing.length > 0) {
          // A device that has been offline holds an old copy. When it reconnects
          // it offers that copy back; taking it would undo whatever was scored on
          // the other device in the meantime. Oldest loses, every time.
          const held = Number(existing[0].sv) || 0;
          if (sv && held && sv < held) { rejected.push({ id: sessionId, why: 'stale' }); continue; }

          const patchResp = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_sessions?${lookup}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
          });
          if (!patchResp.ok) {
            if (patchResp.status >= 500) { broke = 'patch failed: ' + (await patchResp.text()); break; }
            rejected.push({ id: sessionId, why: 'patch_refused' });
            continue;
          }
          updated++;
        } else {
          const insResp = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_sessions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          if (!insResp.ok) {
            if (insResp.status >= 500) { broke = 'insert failed: ' + (await insResp.text()); break; }
            rejected.push({ id: sessionId, why: 'insert_refused' });
            continue;
          }
          inserted++;
        }
      } catch (rowErr) {
        // A timeout on one row is worth reporting and worth stopping for: the
        // rest of the batch will almost certainly time out too.
        broke = (rowErr && rowErr.name === 'AbortError') ? 'supabase_timeout' : String(rowErr && rowErr.message);
        break;
      }
    }

    // Anything that did get written stays written, and the device is told the
    // truth about the rest so it can try again rather than assume it is safe.
    if (broke) {
      return res.status(503).json({ ok: false, reason: broke, updated, inserted, rejected });
    }

    if (meta) {
      for (const player of Object.keys(meta)) {
        const key = slug(player);
        if (!key || !allowed[key]) { rejected.push({ id: 'meta:' + key, why: 'not_your_player' }); continue; }

        let metaBody;
        try {
          metaBody = JSON.stringify(meta[player]);
        } catch (e) { rejected.push({ id: 'meta:' + key, why: 'unserialisable' }); continue; }
        if (metaBody.length > MAX_BODY) { rejected.push({ id: 'meta:' + key, why: 'too_big' }); continue; }

        const lookup = `player=eq.${encodeURIComponent(key)}`;
        const getResp = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_meta?${lookup}&select=player&limit=1`, { headers });
        if (!getResp.ok) {
          const t = await getResp.text();
          return res.status(getResp.status).json({ ok: false, reason: 'meta lookup failed: ' + t, updated, inserted, rejected });
        }
        const has = await getResp.json();
        const payload = { player: key, body: meta[player], updated: new Date().toISOString() };

        const r = Array.isArray(has) && has.length
          ? await timedFetch(`${SUPABASE_URL}/rest/v1/dg_meta?${lookup}`, {
              method: 'PATCH', headers, body: JSON.stringify(payload),
            })
          : await timedFetch(`${SUPABASE_URL}/rest/v1/dg_meta`, {
              method: 'POST', headers, body: JSON.stringify(payload),
            });
        if (!r.ok) {
          const t = await r.text();
          return res.status(r.status).json({ ok: false, reason: 'meta save failed: ' + t, updated, inserted, rejected });
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, updated, inserted, rejected });
  } catch (err) {
    console.error('dg-save error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
