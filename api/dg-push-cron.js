// /api/dg-push-cron.js
//
// Run by Vercel Cron every fifteen minutes (vercel.json). For every phone whose
// reminder time has just arrived in its own time zone: on a Sunday, if next
// week is not set yet, the nudge is the one that asks her to set it. Otherwise,
// if she has logged nothing today and the week is not paused, send one nudge,
// naming a quick drill still on her week when there is one. Never two in a
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
function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Her week as she set it in the app: the stored plan if there is one, else her
// default numbers, else the old single target.
// What the squad and the coach have made compulsory count too, and the
// coach's quick drills come first when a drill is named.
export function requiredOf(pl, monday) {
  const on = (x) => x && x.id && (!x.from || monday >= x.from);
  const squad = (Array.isArray(pl.squad) ? pl.squad : []).filter(on);
  const coach = (Array.isArray(pl.coach) ? pl.coach : []).filter(on);
  return { n: squad.length + coach.length, drills: coach.filter((c) => c.k === 'drill').map((c) => ({ k: 'drill', id: c.id })) };
}
export function planOf(pl, monday) {
  const w = pl.weeks && pl.weeks[monday];
  const req = requiredOf(pl, monday);
  const sum = (n) => (n ? (+n.main || 0) + (+n.sc || 0) + (+n.drill || 0) : 0);
  if (w && w.n) return { total: sum(w.n) + req.n, items: req.drills.concat(Array.isArray(w.items) ? w.items : []), paused: !!w.paused };
  if (pl.weekPlan) return { total: sum(pl.weekPlan) + req.n, items: req.drills, paused: false };
  return { total: Math.max(0, Math.min(14, +pl.weekTarget || 0)), items: req.drills, paused: false };
}
export function isPaused(pl, monday) {
  return (pl.pauseWeeks || []).indexOf(monday) > -1 || !!(pl.weeks && pl.weeks[monday] && pl.weeks[monday].paused);
}
// Sunday: has she set next week? Only a week she chose (set) counts.
export function nextSet(pl, monday) {
  const w = pl.weeks && pl.weeks[addDays(monday, 7)];
  return !!(w && w.set);
}
const DRILL_NAMES = {
  'd-mat-run': 'The run', 'd-mat-startline': 'Start line', 'd-mat-pace': 'Pace', 'd-gdn-corners': 'Four corners',
  'd-gdn-circle': 'The circle', 'gym:4': 'Speed sticks', 'gym:5': 'The band session',
};
// The first planned quick drill she can do at home and has not done this week.
export function drillLeft(plan, ss) {
  const did = new Set(ss.map((x) => (x.kind === 'gym' ? 'gym:' + x.gym : x.drill)).filter(Boolean));
  const it = plan.items.find((x) => x && x.k === 'drill' && DRILL_NAMES[x.id] && !did.has(x.id));
  return it ? it.id : null;
}
export function message(row, L, week, target, today, extra = {}) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (extra.plan) {
    return { title: 'Set next week',
             body: 'How many main sessions and S&C? Your numbers; the app picks the sessions.',
             url: '/?go=settings&wk=next' };
  }
  const lead = row.cue ? cap(row.cue) + ': ten minutes on the mat?' : 'Ten minutes on the mat?';
  const d = MAT[Math.floor(Date.parse(L.date) / 864e5) % MAT.length];
  if (extra.left) {
    const nm = DRILL_NAMES[extra.left];
    const head = row.cue ? cap(row.cue) + ': ' : '';
    return { title: L.dow === 6 && target && week === target - 1 ? 'One more keeps your week' : 'Nothing logged today',
             body: `${head}${nm} is still on your week.` + (target ? ` ${week} of ${target} done.` : ''),
             url: /^gym:/.test(extra.left) ? '/?go=week' : `/?go=drill&id=${extra.left}` };
  }
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
      // Sunday evening: the reminder is the one that sets next week, trained today or not
      const planNext = L.dow === 6 && !nextSet(pl, monday);
      if (!planNext && isPaused(pl, monday)) { out.skipped++; continue; }

      let msg;
      if (planNext) msg = message(row, L, 0, 0, 0, { plan: true });
      else {
        const sr = await timedFetch(
          `${SUPABASE_URL}/rest/v1/dg_sessions?player=eq.${p}&played_on=gte.${monday}&played_on=lte.${L.date}` +
          `&select=played_on,kind,status,gym:body->>gymId,drill:body->>drillId`, { headers: H });
        const ss = sr.ok ? await sr.json() : [];
        const today = counts(ss.filter((x) => x.played_on === L.date));
        if (today > 0) { out.skipped++; continue; }
        const week = counts(ss);
        const plan = planOf(pl, monday);
        msg = message(row, L, week, plan.total, today, { left: drillLeft(plan, ss.filter((x) => x.status !== 'live')) });
      }

      const status = await sendPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
                                    msg, V);
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
