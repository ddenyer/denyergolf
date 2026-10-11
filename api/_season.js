// /api/_season.js  (not an endpoint: the underscore keeps Vercel from serving it)
//
// The season's rules on the server: the checklist, what is due on a given
// day, the daily summary each phone gets, and the news that goes out at once.
// The app holds the same checklist (season_module.js); a test checks the two
// agree item for item.

import { sbHeaders, timedFetch, safeLabel } from './dg-load.js';

export const LIVE = { entered: 1, ballot: 1, confirmed: 1, reserve: 1, played: 1 };
const mk = (id, label, owner, anchor, off, extra) => ({ id, label, owner, anchor, off, ...(extra || {}) });
export const CHECK = [
  mk('enter', 'Enter', 'manager', 'open', 0, { on: { considering: 1 }, done: (en) => !!LIVE[en.status] }),
  mk('accom', 'Book accommodation, free cancellation', 'manager', 'entered', 0),
  mk('result', 'Check the ballot or the entry list', 'manager', 'close', 1, { on: { entered: 1, ballot: 1 }, done: (en) => /confirmed|reserve|withdrawn|played/.test(en.status) }),
  mk('practice', 'Book the practice round', 'manager', 'confirmed', 0, { done: (en) => !!en.practice }),
  mk('travel', 'Plan travel', 'manager', 'confirmed', 0),
  mk('yardage', 'Order the yardage book and green maps', 'manager', 'confirmed', 0),
  mk('rules', 'Check caddie and distance device rules', 'manager', 'start', -21),
  mk('course', 'Practise the shots this course asks for', 'player', 'start', -21),
  mk('freeze', 'Equipment freeze: clubs and balls on the conforming lists', 'player', 'start', -21),
  mk('plan', 'Course plan with your coach', 'coach', 'start', -7),
  mk('tees', 'Add the tee times when the draw is out', 'manager', 'start', -7, { done: (en) => !!(en.tees && en.tees.length) }),
  mk('local', 'Read the Local Rules and the draw', 'player', 'start', -5),
  mk('pack', 'Pack: the full list', 'player', 'start', -2),
  mk('weather', 'Weather and course planner', 'player', 'start', -2),
  mk('food', 'Food and drink for the round', 'manager', 'start', -1),
  mk('morning', 'Morning of: the timeline back from the tee time', 'player', 'start', 0),
  mk('card', 'Scorecard checked and signed, every round', 'player', 'start', 0),
  mk('review', 'Review: what went well, one thing to fix', 'player', 'end', 1),
  mk('debrief', 'Debrief with your coach', 'coach', 'end', 3),
];

export function plusDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function niceDay(iso) { if (!iso) return ''; const d = new Date(iso + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
export function niceWhen(s) {
  if (!s) return '';
  const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + niceDay(s.slice(0, 10)) + (s.length > 10 ? ', ' + s.slice(11, 16) : '');
}
export function niceDates(ev) {
  if (!ev.start) return '';
  if (!ev.end || ev.end === ev.start) return niceDay(ev.start);
  const a = new Date(ev.start + 'T12:00:00Z'), b = new Date(ev.end + 'T12:00:00Z');
  return (a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() : niceDay(ev.start)) + ' to ' + niceDay(ev.end);
}

function anchorDate(a, ev, en) {
  const at = en.statusAt || {};
  if (a === 'open') return ev.open || null;
  if (a === 'close') return ev.close || null;
  if (a === 'entered') return at.entered || at.ballot || at.confirmed || at.reserve || null;
  if (a === 'confirmed') return at.confirmed || null;
  if (a === 'start') return ev.start || null;
  if (a === 'end') return ev.end || ev.start || null;
  return null;
}
// The same rules as checkFor() in the app.
export function checkFor(ev, en, today) {
  const st = en.status || 'none', out = [];
  // an option is on the list to look at, nothing more: no checklist, no reminders
  if (st === 'none' || st === 'withdrawn' || st === 'option') return out;
  CHECK.forEach((it) => {
    let applies = it.on ? (!!it.on[st] || (it.done && it.done(en) && st !== 'considering'))
                        : (!!LIVE[st] && (it.anchor !== 'confirmed' || /confirmed|played/.test(st)));
    if (it.id === 'enter') applies = true;
    if (!applies) return;
    const base = anchorDate(it.anchor, ev, en), due = base ? plusDays(base, it.off) : null;
    const done = !!((en.check || {})[it.id]) || !!(it.done && it.done(en));
    const owner = (en.owners || {})[it.id] || it.owner;
    out.push({ it, due, done, owner, overdue: !!(due && due < today) });
  });
  return out;
}

// What goes in today's summary for one player at one event. A thing due today,
// and an overdue one every third day so it is not dropped and not nagged about
// daily. Entry deadlines are said in their own words while she is considering.
export function dueToday(ev, en, today) {
  const out = [], st = en.status || 'none';
  if (st === 'considering') {
    if (ev.open === today) out.push({ text: 'entries open today', owner: 'manager' });
    if (ev.close) {
      const n = daysBetween(today, ev.close);
      if (n === 7 || n === 2) out.push({ text: `entries close in ${n} days`, owner: 'manager' });
      if (n === 0) out.push({ text: 'entries close today', owner: 'manager' });
    }
  }
  checkFor(ev, en, today).forEach((c) => {
    if (c.done || !c.due || c.it.id === 'enter') return;
    const late = daysBetween(c.due, today);
    if (late === 0 || (late > 0 && late % 3 === 0)) {
      out.push({ text: c.it.label.charAt(0).toLowerCase() + c.it.label.slice(1) + (late > 0 ? ' (overdue)' : ''), owner: c.owner, late: late > 0 });
    }
  });
  // today's things first, the overdue ones after
  return out.sort((x, y) => (x.late ? 1 : 0) - (y.late ? 1 : 0));
}

// One push per phone per day: everything due today for the players it follows.
//   player phone: "Herts Girls Open: pack: the full list; book the practice round (manager)."
//   staff phone:  "Charlotte, Herts Girls Open: pack, ... Annabel, R&A Girls': entries close in 2 days."
const OWN = { manager: 'parent/manager', coach: 'coach' };
export function summary({ players, events, entries, today, nm, staff }) {
  const groups = [];
  events.forEach((ev) => {
    (ev.players || []).forEach((p) => {
      if (players.indexOf(p) < 0) return;
      // no row yet: every tournament on the list starts as Considering
      const en = entries.find((x) => x.event === ev.id && x.player === p) || { status: 'considering' };
      const items = dueToday(ev, en, today);
      if (items.length) groups.push({ p, ev, items });
    });
  });
  if (!groups.length) return null;
  // the groups with something due today before the ones that are only overdue
  groups.sort((x, y) => (x.items.every((i) => i.late) ? 1 : 0) - (y.items.every((i) => i.late) ? 1 : 0));
  const line = (g) => (staff ? nm(g.p) + ', ' : '') + g.ev.name + ': ' +
    g.items.map((i) => i.text + (!staff && i.owner !== 'player' && OWN[i.owner] ? ' (' + OWN[i.owner] + ')' : '')).join('; ') + '.';
  let body = groups.map(line).join(' ');
  if (body.length > 230) {
    const n = groups.reduce((t, g) => t + g.items.length, 0);
    body = body.slice(0, 200).replace(/\s+\S*$/, '') + '… ' + n + ' things in all.';
  }
  const one = !staff && groups.length === 1;
  return { title: one ? groups[0].ev.name : 'Tournaments today', body, url: one ? '/?go=event&id=' + groups[0].ev.id : '/?go=calendar' };
}

// ---- news: told at once ----
export const STATUS_NEWS = {
  entered: 'entered', ballot: 'in the ballot', confirmed: 'place confirmed', reserve: 'on the reserve list', withdrawn: 'withdrawn',
};
export async function addNews(players, title, body, url, kind) {
  const r = await timedFetch(`${process.env.SUPABASE_URL}/rest/v1/dg_news`, {
    method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ players, title: String(title).slice(0, 80), body: String(body || '').slice(0, 240), url: url || '/?go=calendar', kind: kind || null }),
  });
  return r.ok;
}
// How each player is named: the name on her own code.
export async function playerNames(keys) {
  const out = {};
  try {
    const r = await timedFetch(`${process.env.SUPABASE_URL}/rest/v1/dg_codes?players=ov.{${keys.join(',')}}&select=players,label&limit=200`, { headers: sbHeaders() });
    if (r.ok) (await r.json()).forEach((x) => { if (x.label && Array.isArray(x.players) && x.players.length === 1) out[x.players[0]] = safeLabel(x.label); });
  } catch (e) { /* the key, capitalised, is a fair stand-in */ }
  return (p) => out[p] || (p.charAt(0).toUpperCase() + p.slice(1));
}

// ---- what the Monday search found, applied ----
// Returns the event as it should be after, and the words for the news.
export function applyProposal(ev, pr) {
  const body = { ...ev };
  const v = String(pr.value || '').trim();
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  let words = '';
  if (pr.field === 'dates') {
    const [a, b] = v.split('/');
    if (!DAY.test(a || '') || (b && !DAY.test(b))) return null;
    body.start = a; body.end = b || a; body.confirmed = true;
    words = 'Dates confirmed: ' + niceDates(body) + ' ' + a.slice(0, 4);
  } else if (pr.field === 'venue') {
    if (!v) return null; body.venue = v.slice(0, 80); words = 'Venue confirmed: ' + body.venue;
  } else if (pr.field === 'open' || pr.field === 'close') {
    if (!DAY.test(v)) return null; body[pr.field] = v;
    words = (pr.field === 'open' ? 'Entries open ' : 'Entries close ') + niceDay(v) + ' ' + v.slice(0, 4);
  } else if (pr.field === 'link') {
    if (!/^https:\/\/\S{3,300}$/.test(v)) return null; body.link = v; words = 'New organiser page';
  } else if (pr.field === 'note') {
    if (!v) return null; body.flag = (body.flag ? body.flag + ' ' : '') + v.slice(0, 200); words = v.slice(0, 160);
  } else return null;
  return { body, words };
}
