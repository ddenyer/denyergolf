// /api/dg-cal.js
//
// The DenyerGolf calendar, as a feed a phone or a Mac subscribes to.
//
// GET /api/dg-cal?k=<key>   -> text/calendar
//
// The key is the only thing that opens it: long, random, made by
// /api/dg-season (action "cal"), and replaced there when it has been passed
// on. A wrong or missing key gets a 404 and no hint of why.
//
// What goes in, for the players the key covers:
//   - each tournament with a date that someone is considering, entered,
//     balloted, confirmed, reserve or has played, with names and status
//   - entries open and entries close, as all-day reminders
//   - each player's practice round and tee times, once they are known
//   - squad days, lessons and anything else on dg_dates
// Times are kept in the app as UK local time and written here in UTC, so the
// calendar is right on any phone in any time zone.

import { sbHeaders, timedFetch, safeLabel, safeKeys } from './dg-load.js';

const ACTIVE = { considering: 1, entered: 1, ballot: 1, confirmed: 1, reserve: 1, played: 1 };
const WORD = { considering: 'considering', entered: 'entered', ballot: 'in the ballot', confirmed: 'confirmed', reserve: 'reserve', played: 'played' };

// UK local "2027-08-09T07:30" to a UTC Date, through the zone database rather
// than a guess about when the clocks change.
export function londonToUtc(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const off = (t) => {
    const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(t)).forEach((x) => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let t = guess - off(guess);
  t = guess - off(t);
  return new Date(t);
}
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dayStamp = (s) => String(s).replace(/-/g, '');
function nextDay(s) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
export function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
// Lines longer than 75 octets are folded, as the standard asks; some
// calendars refuse a feed that does not.
export function fold(line) {
  const b = Buffer.from(line, 'utf8');
  if (b.length <= 75) return line;
  const out = []; let i = 0, first = true;
  while (i < b.length) {
    let n = first ? 75 : 74;
    while (n > 0 && i + n < b.length && (b[i + n] & 0xc0) === 0x80) n--;   // never split a character
    out.push((first ? '' : ' ') + b.slice(i, i + n).toString('utf8'));
    i += n; first = false;
  }
  return out.join('\r\n');
}
export function names(list) {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}
// "Charlotte and Annabel (confirmed)" or "Charlotte (confirmed), Annabel (entered)"
export function whoLine(rows, nm) {
  const by = {};
  rows.forEach((r) => { (by[r.status] = by[r.status] || []).push(nm(r.player)); });
  const ks = Object.keys(by);
  if (ks.length === 1) return names(by[ks[0]]) + ' (' + WORD[ks[0]] + ')';
  return rows.map((r) => nm(r.player) + ' (' + WORD[r.status] + ')').join(', ');
}

export function buildIcs({ name, events, entries, dates, nm, now }) {
  now = now || new Date();
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DenyerGolf//Longer Closer Lower//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name || 'DenyerGolf'), 'X-WR-TIMEZONE:Europe/London',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const ds = stamp(now);
  const allDay = (uid, from, to, summary, desc, loc, url) => {
    L.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + ds, 'DTSTART;VALUE=DATE:' + dayStamp(from),
      'DTEND;VALUE=DATE:' + dayStamp(nextDay(to || from)), 'SUMMARY:' + esc(summary), 'TRANSP:TRANSPARENT');
    if (desc) L.push('DESCRIPTION:' + esc(desc));
    if (loc) L.push('LOCATION:' + esc(loc));
    if (url) L.push('URL:' + url);
    L.push('END:VEVENT');
  };
  const timed = (uid, at, mins, summary, desc, loc, endAt) => {
    const s = londonToUtc(at); if (!s) return;
    const e = (endAt && londonToUtc(endAt)) || new Date(s.getTime() + mins * 60000);
    L.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + ds, 'DTSTART:' + stamp(s), 'DTEND:' + stamp(e > s ? e : new Date(s.getTime() + mins * 60000)),
      'SUMMARY:' + esc(summary));
    if (desc) L.push('DESCRIPTION:' + esc(desc));
    if (loc) L.push('LOCATION:' + esc(loc));
    L.push('END:VEVENT');
  };

  events.forEach((ev) => {
    // a player with no row yet is Considering: everything on the list starts there
    const rows = ev.players.map((p) => entries.find((x) => x.event === ev.id && x.player === p) || { event: ev.id, player: p, status: 'considering' })
      .filter((x) => ACTIVE[x.status]);
    if (!rows.length) return;
    const who = whoLine(rows, nm);
    const desc = [ev.venue, ev.entry, ev.close ? 'Entries close ' + ev.close : '', ev.flag, ev.notes, ev.link].filter(Boolean).join('\n');
    // dates the organiser has not confirmed yet are typed in as a guide, and say so
    if (ev.start) allDay(ev.id + '@denyergolf', ev.start, ev.end, ev.name + (ev.confirmed ? '' : ' (provisional)') + ': ' + who, desc, ev.venue, ev.link);
    // no dates even as a guide: a note on the 1st of its month, so the month is held in mind
    if (!ev.start && ev.month) {
      const y = +ev.year || 2027, d1 = y + '-' + String(ev.month).padStart(2, '0') + '-01';
      const mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][ev.month - 1];
      allDay(ev.id + '-month@denyergolf', d1, d1, ev.name + ': ' + mon + ', dates TBC (' + who + ')', desc, '', ev.link);
    }
    const live = rows.filter((r) => r.status !== 'played');
    if (live.length && ev.open) allDay(ev.id + '-open@denyergolf', ev.open, ev.open, 'Entries open: ' + ev.name, desc, '', ev.link);
    if (live.length && ev.close) allDay(ev.id + '-close@denyergolf', ev.close, ev.close, 'Entries close: ' + ev.name, desc, '', ev.link);
    rows.forEach((r) => {
      if (r.practice) timed(ev.id + '-' + r.player + '-pr@denyergolf', r.practice, 270, nm(r.player) + ': practice round, ' + ev.name, '', ev.venue);
      (r.tees || []).forEach((t) => timed(ev.id + '-' + r.player + '-r' + t.r + '@denyergolf', t.at, 300,
        nm(r.player) + ': ' + ev.name + ', round ' + t.r + ' tee time', '', ev.venue));
    });
  });
  dates.forEach((d) => {
    if (!d.start) return;
    const who = names(d.players.map(nm));
    const desc = [d.with ? 'With ' + d.with : '', d.notes].filter(Boolean).join('\n');
    timed(d.id + '@denyergolf', d.start, d.kind === 'lesson' ? 60 : 180, (who ? who + ': ' : '') + d.title, desc, d.venue, d.end);
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

export default async function handler(req, res) {
  const k = String((req.query && req.query.k) || '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(k)) return res.status(404).send('Not found');
  const url = process.env.SUPABASE_URL;
  const get = async (p) => {
    const r = await timedFetch(`${url}/rest/v1/${p}`, { headers: sbHeaders() });
    if (!r.ok) throw new Error(p.split('?')[0] + ' ' + r.status);
    return r.json();
  };
  try {
    const cal = await get(`dg_cal?token=eq.${encodeURIComponent(k)}&select=players,name`);
    if (!cal.length) return res.status(404).send('Not found');
    const keys = safeKeys(cal[0].players);
    if (!keys.length) return res.status(404).send('Not found');
    const L = keys.map((p) => `"${p}"`).join(',');
    const [ev, en, dt, codes] = await Promise.all([
      get(`dg_events?players=ov.{${keys.join(',')}}&select=id,players,body&limit=500`),
      get(`dg_entries?player=in.(${L})&select=event_id,player,body&limit=2000`),
      get(`dg_dates?players=ov.{${keys.join(',')}}&select=id,players,body&limit=1000`),
      get(`dg_codes?players=ov.{${keys.join(',')}}&select=players,label&limit=200`).catch(() => []),
    ]);
    const display = {};
    codes.forEach((r) => { if (r.label && Array.isArray(r.players) && r.players.length === 1) display[r.players[0]] = safeLabel(r.label); });
    const nm = (p) => display[p] || (p.charAt(0).toUpperCase() + p.slice(1));
    const mine = (p) => keys.indexOf(p) > -1;
    const ics = buildIcs({
      name: cal[0].name,
      events: ev.map((r) => ({ ...r.body, id: r.id, players: r.players.filter(mine) })),
      entries: en.map((r) => ({ ...r.body, event: r.event_id, player: r.player })),
      dates: dt.map((r) => ({ ...r.body, id: r.id, players: r.players.filter(mine) })),
      nm,
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="DenyerGolf.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(ics);
  } catch (err) {
    console.error('dg-cal error:', err);
    return res.status(500).send('Calendar unavailable');
  }
}
