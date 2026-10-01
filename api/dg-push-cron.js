// /api/dg-push-cron.js
//
// Run by Vercel Cron every fifteen minutes (vercel.json). For every phone whose
// reminder time has just arrived in its own time zone: if she has logged
// nothing today, and the week is not paused, send one nudge. Never two in a
// day, never after nine at night, and a phone the push service has forgotten is
// dropped rather than retried for ever.
//
// Vercel sends Authorization: Bearer <CRON_SECRET> when that env var is set,
// which is what stops anyone else from triggering a round of messages.

import { sbHeaders, timedFetch } from './dg-load.js';
import { sendPush } from './_webpush.js';
import { vapid } from './dg-push.js';

const WINDOW = 15;   // minutes, the cron interval
const LAST = 21 * 60;
const WARMUPS = new Set([11, 12, 13]);   // a warm-up is not a session

// The three mat drills, in turn. A reminder that names one small thing gets done;
// "practise tonight" does not.
const MAT = [
  { id: 'd-mat-run',       say: 'The run is waiting on the trainer.' },
  { id: 'd-mat-startline', say: 'Twenty through the gate.' },
  { id: 'd-mat-pace',      say: 'Twenty to the trainer, all pace.' },
];

// Her local date, minutes past midnight and weekday, in her own time zone.
export function localNow(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  });
  const p = {}; f.formatToParts(now).forEach((x) => { p[x.type] = x.value; });
  const date = `${p.year}-${p.month}-${p.day}`;
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return { date, mins: (+p.hour) * 60 + (+p.minute), dow };
}
export function mondayOf(date, dow) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export function dueNow(row, L) {
  const m = /^(\d{2}):(\d{2})$/.exec(row.remind_at || '');
  if (!m) return false;
  const at = (+m[1]) * 60 + (+m[2]);
  if (row.last_sent === L.date) return false;
  if (L.mins >= LAST) return false;
  return L.mins >= at && L.mins < at + WINDOW;
}
function counts(rows) {
  return rows.filter((r) => r.status !== 'live' &&
    !(r.kind === 'gym' && WARMUPS.has(+r.gym))).length;
}
export function message(row, L, week, target, today) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lead = row.cue ? cap(row.cue) + ': ten minutes on the mat?' : 'Ten minutes on the mat?';
  const d = MAT[Math.floor(Date.parse(L.date) / 864e5) % MAT.length];
  if (L.dow === 6 && target && week === target - 1) {
    return { title: 'One more keeps your week',
             body: `${week} of ${target} this week. ${lead} ${d.say}`,
             url: `/?go=drill&id=${d.id}` };
  }
  return { title: 'Nothing logged today',
           body: `${lead} ${d.say}` + (target ? ` ${week} of ${target} this week.` : ''),
           url: `/?go=drill&id=${d.id}` };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false });
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const V = vapid();
  if (!SUPABASE_URL || !V.pub || !V.priv) return res.status(500).json({ ok: false, reason: 'not_configured' });

  const H = sbHeaders();
  const out = { checked: 0, sent: 0, skipped: 0, dropped: 0 };
  try {
    const r = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?enabled=eq.true&select=*`, { headers: H });
    const rows = r.ok ? await r.json() : [];
    const metaCache = {};
    for (const row of rows) {
      out.checked++;
      const L = localNow(row.tz || 'Europe/London');
      if (!dueNow(row, L)) { out.skipped++; continue; }

      const p = encodeURIComponent(row.player);
      if (!(row.player in metaCache)) {
        const mr = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_meta?player=eq.${p}&select=body`, { headers: H });
        const mj = mr.ok ? await mr.json() : [];
        metaCache[row.player] = (mj[0] && mj[0].body && mj[0].body.player) || {};
      }
      const pl = metaCache[row.player];
      const monday = mondayOf(L.date, L.dow);
      if ((pl.pauseWeeks || []).indexOf(monday) > -1) { out.skipped++; continue; }

      const sr = await timedFetch(
        `${SUPABASE_URL}/rest/v1/dg_sessions?player=eq.${p}&played_on=gte.${monday}&played_on=lte.${L.date}` +
        `&select=played_on,kind,status,gym:body->>gymId`, { headers: H });
      const ss = sr.ok ? await sr.json() : [];
      const today = counts(ss.filter((x) => x.played_on === L.date));
      if (today > 0) { out.skipped++; continue; }
      const week = counts(ss);
      const target = Math.max(0, Math.min(14, +pl.weekTarget || 0));

      const status = await sendPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
                                    message(row, L, week, target, today), V);
      if (status === 404 || status === 410) {
        await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(row.endpoint)}`,
          { method: 'DELETE', headers: H });
        out.dropped++;
        continue;
      }
      if (status >= 200 && status < 300) {
        await timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(row.endpoint)}`, {
          method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify({ last_sent: L.date }),
        });
        out.sent++;
      }
    }
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    console.error('dg-push-cron error:', err);
    return res.status(500).json({ ok: false, reason: err.message, ...out });
  }
}
