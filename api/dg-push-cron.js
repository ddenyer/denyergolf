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
  const reps = coach.reduce((t, c) => t + Math.max(1, Math.min(7, Math.round(+c.n || 1))), 0);
  return { n: squad.length + reps, drills: coach.filter((c) => c.k === 'drill').map((c) => ({ k: 'drill', id: c.id })) };
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
// What the squad and the coach set that is still to do this week, in the
// app's own order: squad first, then the coach's, each session used once.
// Names match the app. A home drill is left to drillLeft; these are the ones
// that need the range or the course, named from Thursday.
const MAIN = { 2: 'Wedge play', 3: 'Short game', 4: 'Holing out', 10: 'Tee shots', 11: 'Approach' };
const PRACTICE_TYPE = { 'p-approach-short': 11, 'p-putt-lag': 4 };
const TESTS = {
  't-approach-pinhigh': ['Pin high or past', 11], 't-approach-fade': ['Fade on demand', 11], 't-tee-speed': ['Speed and corridor', 10],
  't-wedge-distance': ['Distance control', 2], 't-short-oneclub': ['Inside one club', 3], 't-putt-six': ['Twenty from six feet', 4],
  't-approach-depth': ['Right number, approach', 11], 't-wedge-number': ['Right number, wedges', 2], 't-putt-lag': ['Lag and hole out', 4],
  't-putt-sg18': ['Regional Squad Putting SGx18', 4], 't-short-p9': ['Regional Squad Perfect 9', 3], 't-watson': ['The Watson matrix', 3],
  't-hundred': ['The Hundred', 3],
};
const SQUAD_TESTS = new Set(['t-putt-sg18', 't-short-p9']);
const DRILLS = {
  'd-tee-driver': 'The driver', 'd-tee-woods': 'The woods', 'd-app-windows': 'Windows', 'd-wedge-ladder': 'The wedge ladder',
  'd-short-bunkers': 'Bunkers', 'd-short-awkward': 'Awkward lies', 'd-short-updown': 'Up and down', 'd-putt-six': 'Inside six feet',
  'd-putt-nine': 'Nine and twelve', 'd-putt-rotation': 'The rotation', 'd-putt-lag': 'The lag',
};
const GYM = { 1: 'Session 1', 2: 'Session 2', 3: 'Session 3', 7: 'Strength 1', 8: 'Strength 2', 9: 'Session A', 10: 'Session B' };
function testOf(x) { return x.test || (x.kind === 'test' ? x.area : null); }
function areaOf(x) {
  if (x.kind === 'practice') return PRACTICE_TYPE[x.area] != null ? PRACTICE_TYPE[x.area] : +x.area;
  if (x.kind === 'test') { const t = TESTS[testOf(x)]; return t && !SQUAD_TESTS.has(testOf(x)) ? t[1] : null; }
  return null;
}
function coachHit(c, x) {
  if (c.k === 'test') return x.kind === 'test' && testOf(x) === c.id;
  if (c.k === 'main') return areaOf(x) === +c.id;
  if (c.k === 'sc') return x.kind === 'gym' && +x.gym === +c.id;
  if (c.k === 'drill') {
    const m = /^gym:(\d+)$/.exec(String(c.id));
    return m ? x.kind === 'gym' && +x.gym === +m[1] : x.kind === 'drill' && x.drill === c.id;
  }
  return false;
}
function coachName(c) {
  if (c.k === 'test') return TESTS[c.id] ? TESTS[c.id][0] : null;
  if (c.k === 'main') return MAIN[+c.id] ? MAIN[+c.id] + ' session' : null;
  if (c.k === 'sc') return GYM[+c.id] ? 'S&C ' + GYM[+c.id] : null;
  if (c.k === 'drill') return DRILLS[c.id] || null;   // home drills (mat, garden, sticks, band) are drillLeft's
  return null;
}
export function requiredLeft(pl, monday, ss) {
  const on = (x) => x && x.id && (!x.from || monday >= x.from);
  const done = ss.filter((x) => x.status !== 'live');
  const used = new Set();
  const take = (hit) => { const i = done.findIndex((x, j) => !used.has(j) && hit(x)); if (i < 0) return false; used.add(i); return true; };
  const out = [];
  (Array.isArray(pl.squad) ? pl.squad : []).filter(on).forEach((q) => {
    if (!take((x) => x.kind === 'test' && testOf(x) === q.id) && TESTS[q.id]) out.push(TESTS[q.id][0]);
  });
  (Array.isArray(pl.coach) ? pl.coach : []).filter(on).forEach((c) => {
    const n = Math.max(1, Math.min(7, Math.round(+c.n || 1)));
    for (let i = 0; i < n; i++) {
      if (!take((x) => coachHit(c, x))) { const nm = coachName(c); if (nm && out.indexOf(nm) < 0) out.push(nm); }
    }
  });
  return out;
}
// ---- DiSE hours, the same estimate the app uses (sessMins in the app) ----
// Each session at its plan's length, warm-up included, rounded up to the next
// quarter hour; a part-done one at its share; S&C counts; warm-ups do not.
const MINS_MAIN = { 10: 55, 11: 60, 2: 60, 3: 55, 4: 40, 'p-approach-short': 55, 'p-putt-lag': 40 };
const MINS_TEST = { 't-tee-speed': 25, 't-approach-fade': 30, 't-approach-depth': 30, 't-wedge-number': 30,
                    't-putt-lag': 30, 't-hundred': 60, 't-putt-sg18': 60, 't-short-p9': 45 };
const MINS_DRILL = { 'd-tee-driver': 20, 'd-tee-woods': 20, 'd-app-windows': 25, 'd-wedge-ladder': 20, 'd-short-bunkers': 25,
  'd-short-awkward': 30, 'd-short-updown': 20, 'd-putt-six': 25, 'd-putt-nine': 20, 'd-putt-rotation': 10, 'd-putt-lag': 20,
  'd-gdn-corners': 15, 'd-gdn-circle': 15, 'd-mat-startline': 12, 'd-mat-pace': 12, 'd-mat-run': 15 };
const quarterUp = (m) => Math.max(15, Math.ceil(m / 15) * 15);
export function sessMins(x) {
  if (!x || x.status === 'live' || x.sample === 'true' || x.sample === true) return 0;
  if (x.kind === 'log') return Math.round((+x.hours || 0) * 60);
  const f = x.partial != null && x.partial !== '' ? Math.max(0.25, +x.partial || 0) : 1;
  let base;
  if (x.kind === 'gym') {
    const g = +x.gym;
    if (g === 11 || g === 12 || g === 13) return 0;
    base = g === 4 || g === 5 ? 15 : g === 6 ? 10 : 40;
  } else if (x.kind === 'drill') base = MINS_DRILL[x.drill] || 20;
  else if (x.kind === 'test') {
    const t = testOf(x);
    base = t === 't-watson' && +x.mxend > 0 ? Math.min(+x.mxend, 45 * 60000) / 60000 + 10 : (MINS_TEST[t] || 45);
  } else if (x.kind === 'practice') base = MINS_MAIN[x.area] || MINS_MAIN[PRACTICE_TYPE[x.area]] || 60;
  else return 0;
  return Math.round(quarterUp(base) * f);
}
export function diseTotal(all) { return all.reduce((t, x) => t + sessMins(x), 0) / 60; }

// ---- what a session is called, for the unfinished-session push ----
export function sessionName(x) {
  if (x.kind === 'practice') { const a = PRACTICE_TYPE[x.area] != null ? PRACTICE_TYPE[x.area] : +x.area; return MAIN[a] || 'practice'; }
  if (x.kind === 'test') { const t = TESTS[testOf(x)]; return t ? t[0] : 'test'; }
  if (x.kind === 'drill') return DRILLS[x.drill] || DRILL_NAMES[x.drill] || 'quick drill';
  if (x.kind === 'gym') return GYM[+x.gym] ? 'S&C ' + GYM[+x.gym] : (DRILL_NAMES['gym:' + x.gym] || 'S&C');
  return 'practice';
}
// ---- the pillar left longest: 14 days or more, among pillars she has played ----
export function pillarGap(all, today) {
  const last = {};
  all.forEach((x) => {
    if (x.status === 'live') return;
    let a = null;
    if (x.kind === 'practice') a = PRACTICE_TYPE[x.area] != null ? PRACTICE_TYPE[x.area] : +x.area;
    else if (x.kind === 'test' && TESTS[testOf(x)]) a = TESTS[testOf(x)][1];
    if (MAIN[a] && (!last[a] || x.played_on > last[a])) last[a] = x.played_on;
  });
  let best = null;
  Object.keys(last).forEach((a) => {
    const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(last[a] + 'T12:00:00Z')) / 864e5);
    if (days >= 14 && (!best || days > best.days)) best = { area: +a, days, last: last[a] };
  });
  return best;
}
// What the coach has set, said once whenever it changes.
const PROG_FIELDS = ['coachAt', 'squadAt', 'scProgAt', 'testsAt', 'practiceAt'];
export function progStamp(pl) { return Math.max(0, ...PROG_FIELDS.map((f) => +pl[f] || 0)); }
export function progSummary(pl, monday) {
  const on = (x) => x && x.id && (!x.from || monday >= x.from);
  const bits = [];
  (Array.isArray(pl.coach) ? pl.coach : []).filter(on).forEach((c) => {
    const nm = coachName(c) || DRILL_NAMES[c.id]; const n = Math.max(1, Math.min(7, Math.round(+c.n || 1)));
    if (nm) bits.push(nm + (n > 1 ? ' ×' + n : ''));
  });
  (Array.isArray(pl.squad) ? pl.squad : []).filter(on).forEach((q) => { if (TESTS[q.id]) bits.push(TESTS[q.id][0]); });
  return bits;
}

export function message(row, L, week, target, today, extra = {}) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const head = row.cue ? cap(row.cue) + ': ' : '';
  if (extra.live) {
    return { title: 'Unfinished session',
             body: `${head}yesterday's ${extra.live} session isn't saved. Finish it, or bank what you did so it counts.`.replace(/^([a-z])/, (m) => m.toUpperCase()),
             url: '/?go=week' };
  }
  if (extra.plan) {
    return { title: 'Set next week',
             body: 'Log any rounds or lessons from this week first, so they count. Then how many main sessions and S&C next week?',
             url: '/?go=settings&wk=next' };
  }
  if (extra.prog) {
    return { title: 'Your coach updated your programme',
             body: extra.prog.length ? 'Set by your coach every week: ' + extra.prog.join(', ') + '. It is on This week.' : 'Have a look at This week.',
             url: '/?go=week' };
  }
  if (extra.dise) {
    return { title: extra.dise >= 200 ? '200 DiSE hours. Target reached!' : `${extra.dise} DiSE hours`,
             body: extra.dise >= 200 ? 'Every hour of practice, play and S&C, logged. Brilliant.'
                                     : `${extra.dise} of 200 hours of practice, play and S&C. ${200 - extra.dise} to go.`,
             url: '/?go=bell' };
  }
  const lead = row.cue ? cap(row.cue) + ': ten minutes on the mat?' : 'Ten minutes on the mat?';
  const d = MAT[Math.floor(Date.parse(L.date) / 864e5) % MAT.length];
  // From Thursday, a squad test or a coach session that needs the range or the
  // course comes first: those are the ones that have to be planned in.
  if (extra.req && L.dow >= 3) {
    return { title: L.dow === 6 ? 'Last day of your week' : 'Still on your week',
             body: `${head}${extra.req} is still to do this week. ` + (L.dow === 6 ? 'Today is the last day.' : 'Fit it in before Sunday.') +
                   (target ? ` ${week} of ${target} done.` : ''),
             url: '/?go=week' };
  }
  if (extra.gap) {
    const word = MAIN[extra.gap.area].toLowerCase();
    return { title: `${extra.gap.days} days since your last ${word} session`,
             body: `${head}nothing in ${word} since ${extra.gap.lastWords}. Get one in this week.`.replace(/^([a-z])/, (m) => m.toUpperCase()),
             url: '/?go=week' };
  }
  if (extra.left) {
    const nm = DRILL_NAMES[extra.left];
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
    const metaCache = {}, sessCache = {};
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
      // every session she has, once per player per run: the hours, the gaps
      // and yesterday's unfinished one all come from it
      if (!(row.player in sessCache)) {
        const ar = await timedFetch(`${SUPABASE_URL}/rest/v1/dg_sessions?player=eq.${p}` +
          `&select=session_id,played_on,kind,status,gym:body->>gymId,drill:body->>drillId,test:body->>testId,area:body->>areaId,` +
          `partial:body->>partial,hours:body->>hours,logType:body->>logType,sample:body->>sample,mxend:body->mx->>end&limit=5000`, { headers: H });
        sessCache[row.player] = ar.ok ? await ar.json() : [];
      }
      const all = sessCache[row.player];
      const ss = all.filter((x) => x.played_on >= monday && x.played_on <= L.date);
      const sent = (row.sent && typeof row.sent === 'object') ? row.sent : {};
      const next = { ...sent };
      // first sight of this phone: remember where things stand, push nothing for them
      const stamp = progStamp(pl), diseNow = Math.floor(diseTotal(all) / 25) * 25;
      if (next.prog == null) next.prog = stamp;
      if (next.dise == null) next.dise = diseNow;

      const yesterday = addDays(L.date, -1);
      const live = all.filter((x) => x.status === 'live' && x.played_on === yesterday &&
                                    (next.live || []).indexOf(x.session_id) < 0)[0];
      const planNext = L.dow === 6 && !nextSet(pl, monday);
      const paused = isPaused(pl, monday);

      let msg = null;
      if (live) { msg = message(row, L, 0, 0, 0, { live: sessionName(live) }); next.live = [live.session_id].concat(next.live || []).slice(0, 20); }
      else if (planNext) msg = message(row, L, 0, 0, 0, { plan: true });
      else if (stamp > next.prog) { msg = message(row, L, 0, 0, 0, { prog: progSummary(pl, monday) }); next.prog = stamp; }
      else if (diseNow > next.dise && diseNow > 0 && next.dise < 200) { msg = message(row, L, 0, 0, 0, { dise: Math.min(200, diseNow) }); next.dise = diseNow; }
      else if (!paused && counts(ss.filter((x) => x.played_on === L.date)) === 0) {
        const week = counts(ss);
        const plan = planOf(pl, monday);
        const req = L.dow >= 3 ? (requiredLeft(pl, monday, ss)[0] || null) : null;
        let gap = req ? null : pillarGap(all, L.date);
        if (gap && (next.gap || {})[gap.area] === gap.last) gap = null;      // said once per gap
        if (gap) {
          const d = new Date(gap.last + 'T12:00:00Z');
          gap.lastWords = d.getUTCDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
          next.gap = { ...(next.gap || {}), [gap.area]: gap.last };
        }
        msg = message(row, L, week, plan.total, 0, { req, gap,
          left: drillLeft(plan, ss.filter((x) => x.status !== 'live')) });
      }
      const patchSent = async (extra) => timedFetch(`${SUPABASE_URL}/rest/v1/dg_push?endpoint=eq.${encodeURIComponent(row.endpoint)}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ sent: next, ...extra }) });
      if (!msg) {
        if (JSON.stringify(next) !== JSON.stringify(sent)) await patchSent({});
        out.skipped++; continue;
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
        await patchSent({ last_sent: L.date });
        out.sent++;
      }
    }
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    console.error('dg-push-cron error:', err);
    return res.status(500).json({ ok: false, reason: err.message, ...out });
  }
}
