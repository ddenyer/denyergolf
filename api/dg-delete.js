// /api/dg-delete.js
//
// Removes one session for a player the code is allowed to write.
// The tool already warns before deleting; this is the server half of it.
//
// POST { code, id }  ->  { ok:true }

import { authorise, sbHeaders } from './dg-load.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }

  const body = req.body || {};
  const auth = await authorise(body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });

  const player = (body.player ? String(body.player) : '').trim().toLowerCase();
  const sessionId = body.id ? String(body.id) : '';
  if (!sessionId) return res.status(400).json({ ok: false, reason: 'id required' });
  if (!player || auth.players.indexOf(player) === -1) {
    return res.status(403).json({ ok: false, reason: 'not_your_player' });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/dg_sessions?player=eq.${encodeURIComponent(player)}&session_id=eq.${encodeURIComponent(sessionId)}`,
      { method: 'DELETE', headers: sbHeaders() }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ ok: false, reason: 'delete failed: ' + t });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('dg-delete error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
