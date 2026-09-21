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

import { authorise, sbHeaders } from './dg-load.js';

const MAX_BATCH = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }

  const body = req.body || {};
  const auth = await authorise(body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });

  const allowed = {};
  auth.players.forEach((p) => { allowed[p] = true; });

  const sessions = Array.isArray(body.sessions) ? body.sessions.slice(0, MAX_BATCH) : [];
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : null;
  const headers = sbHeaders();

  let updated = 0, inserted = 0;
  const rejected = [];

  try {
    for (const s of sessions) {
      const player = (s && s.player ? String(s.player) : '').trim().toLowerCase();
      const sessionId = s && s.id ? String(s.id) : '';

      if (!player || !allowed[player]) { rejected.push({ id: sessionId, why: 'not_your_player' }); continue; }
      if (!sessionId) { rejected.push({ id: '', why: 'no_id' }); continue; }

      // The row body is the session as the tool holds it, minus the routing
      // fields that get their own columns.
      const clean = Object.assign({}, s);
      delete clean.player;
      delete clean.id;

      const lookup =
        `player=eq.${encodeURIComponent(player)}&session_id=eq.${encodeURIComponent(sessionId)}`;

      const getResp = await fetch(
        `${SUPABASE_URL}/rest/v1/dg_sessions?${lookup}&select=id,sv`,
        { headers }
      );
      if (!getResp.ok) {
        const t = await getResp.text();
        return res.status(getResp.status).json({ ok: false, reason: 'lookup failed: ' + t });
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

        const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/dg_sessions?${lookup}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });
        if (!patchResp.ok) {
          const t = await patchResp.text();
          return res.status(patchResp.status).json({ ok: false, reason: 'patch failed: ' + t });
        }
        updated++;
      } else {
        const insResp = await fetch(`${SUPABASE_URL}/rest/v1/dg_sessions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!insResp.ok) {
          const t = await insResp.text();
          return res.status(insResp.status).json({ ok: false, reason: 'insert failed: ' + t });
        }
        inserted++;
      }
    }

    if (meta) {
      for (const player of Object.keys(meta)) {
        const key = player.trim().toLowerCase();
        if (!allowed[key]) { rejected.push({ id: 'meta:' + key, why: 'not_your_player' }); continue; }

        const lookup = `player=eq.${encodeURIComponent(key)}`;
        const getResp = await fetch(`${SUPABASE_URL}/rest/v1/dg_meta?${lookup}&select=player`, { headers });
        if (!getResp.ok) {
          const t = await getResp.text();
          return res.status(getResp.status).json({ ok: false, reason: 'meta lookup failed: ' + t });
        }
        const has = await getResp.json();
        const payload = { player: key, body: meta[player], updated: new Date().toISOString() };

        const r = Array.isArray(has) && has.length
          ? await fetch(`${SUPABASE_URL}/rest/v1/dg_meta?${lookup}`, {
              method: 'PATCH', headers, body: JSON.stringify(payload),
            })
          : await fetch(`${SUPABASE_URL}/rest/v1/dg_meta`, {
              method: 'POST', headers, body: JSON.stringify(payload),
            });
        if (!r.ok) {
          const t = await r.text();
          return res.status(r.status).json({ ok: false, reason: 'meta save failed: ' + t });
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
