// /api/dg-push.js
//
// Turns a phone's reminder on, changes it, or turns it off.
//
// POST { action:"key" }
//   -> { ok:true, key:"<VAPID public key>" }      what the phone subscribes with
// POST { action:"sub", code, player, sub:{endpoint, keys:{p256dh, auth}},
//        time:"19:00", tz:"Europe/London", cue:"after dinner", test:true }
//   -> { ok:true, sent:201 }                      stored; a test arrives if asked
// POST { action:"off", code, player, endpoint }
//   -> { ok:true }
// POST { action:"msg", code, players:["charlotte","annabel"], text:"..." }
//   -> { ok:true, results:{ charlotte:{ phones:1, sent:1 }, ... } }
//   a message from the coach, to every phone each player has signed up. It
//   does not count as her one reminder for the day.
//
// The same rule as every other dg-* endpoint: the code decides which players
// it may touch, and a phone can only be signed up for one of those.

import { authorise, sbHeaders, timedFetch, safeLabel } from './dg-load.js';
import { sendPush, lastPush } from './_webpush.js';

const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.mozilla\.com|googleapis\.com)\//i;

// Never before six in the morning and never after nine at night, whatever is sent.
function cleanTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return '19:00';
  let mins = Math.min(21 * 60, Math.max(6 * 60, (+m[1]) * 60 + (+m[2])));
  mins = Math.round(mins / 15) * 15;
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}
function cleanTz(tz) {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: String(tz) }); return String(tz); }
  catch (e) { return 'Europe/London'; }
}
export function vapid() {
  return {
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || 'https://training.denyergolf.com',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const body = req.body || {};
  const V = vapid();

  if (body.action === 'key') {
    if (!V.pub) return res.status(500).json({ ok: false, reason: 'push_not_configured' });
    return res.status(200).json({ ok: true, key: V.pub });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }
  const auth = await authorise(body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });
  if (auth.unclaimed) return res.status(409).json({ ok: false, reason: 'needs_name' });
  if (body.action === 'msg') {
    const text = String(body.text == null ? '' : body.text)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!text) return res.status(400).json({ ok: false, reason: 'no_text' });
    const want = Array.isArray(body.players) ? body.players.map((x) => String(x).trim().toLowerCase()) : [];
    const targets = [...new Set(want)].filter((x) => auth.players.indexOf(x) > -1).slice(0, 20);
    if (!targets.length) return res.status(403).json({ ok: false, reason: 'not_your_player' });
    if (!V.pub || !V.priv) return res.status(500).json({ ok: false, reason: 'push_not_configured' });
    const results = {};
    try {
      for (const pl of targets) {
        const r = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?player=eq.${encodeURIComponent(pl)}&enabled=eq.true&select=endpoint,p256dh,auth`,
          { headers: sbHeaders() });
        const rows = r.ok ? await r.json() : [];
        const out = { phones: rows.length, sent: 0, status: [] };
        for (const row of rows) {
          const st = await sendPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            { title: 'From your coach', body: text, url: '/?go=bell' }, V);
          out.status.push(st);
          if (st >= 200 && st < 300) out.sent++;
          else if (st === 404 || st === 410) {
            await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(row.endpoint)}`,
              { method: 'DELETE', headers: sbHeaders() });
          }
        }
        results[pl] = out;
      }
      return res.status(200).json({ ok: true, results });
    } catch (err) {
      console.error('dg-push msg error:', err);
      return res.status(500).json({ ok: false, reason: err.message, results });
    }
  }

  const player = String(body.player || '').trim().toLowerCase();
  if (!player || auth.players.indexOf(player) === -1) {
    return res.status(403).json({ ok: false, reason: 'not_your_player' });
  }

  try {
    if (body.action === 'off') {
      const ep = String(body.endpoint || '');
      if (!ep) return res.status(400).json({ ok: false, reason: 'endpoint required' });
      await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(ep)}&player=eq.${encodeURIComponent(player)}`,
        { method: 'DELETE', headers: sbHeaders() });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'sub') {
      const s = body.sub || {};
      const keys = s.keys || {};
      if (!PUSH_HOSTS.test(String(s.endpoint || '')) || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ ok: false, reason: 'bad_subscription' });
      }
      if (!V.pub || !V.priv) return res.status(500).json({ ok: false, reason: 'push_not_configured' });
      const row = {
        endpoint: s.endpoint, player,
        p256dh: String(keys.p256dh), auth: String(keys.auth),
        remind_at: cleanTime(body.time), tz: cleanTz(body.tz),
        cue: safeLabel(body.cue || '').slice(0, 40) || null,
        enabled: true, updated: new Date().toISOString(),
      };
      const r = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?on_conflict=endpoint`, {
        method: 'POST',
        headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      });
      if (!r.ok) return res.status(r.status).json({ ok: false, reason: 'store failed: ' + (await r.text()) });

      let sent = null;
      if (body.test) {
        sent = await sendPush({ endpoint: s.endpoint, keys }, {
          title: 'Reminders are on',
          body: 'If nothing is logged by ' + row.remind_at + ', you will get one nudge. Never more than one a day.',
          url: '/?go=bell',
        }, V);
        // kept on the row, so a test that never arrived can be looked up
        try {
          const g = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(s.endpoint)}&select=sent`, { headers: sbHeaders() });
          const cur = g.ok ? ((await g.json())[0] || {}).sent || {} : {};
          cur.test = { status: sent, reason: lastPush.reason, at: new Date().toISOString() };
          await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
            method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ sent: cur }) });
        } catch (e) { /* the record is a nicety; the answer below is what matters */ }
      }
      return res.status(200).json({ ok: true, sent, why: lastPush.reason || undefined, time: row.remind_at });
    }

    return res.status(400).json({ ok: false, reason: 'unknown action' });
  } catch (err) {
    console.error('dg-push error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
