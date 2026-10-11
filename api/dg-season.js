// /api/dg-season.js
//
// The season: tournaments, each player's entry and checklist, squad days and
// lessons, and the private link to the DenyerGolf calendar.
//
// POST { code, action:"get" }
//   -> { ok, events:[{id, players, ...body}], entries:[{event, player, ...body}],
//        dates:[{id, players, ...body}] }
// POST { code, action:"event", event:{ id?, players?, name, venue, month, start, end,
//        open, close, confirmed, guide, entry, flag, link, notes } }      coach or manager
// POST { code, action:"event_del", id }                                  coach or manager
// POST { code, action:"entry", event, player, entry:{ status, practice, tees, owners, notes } }
//        coach or manager; the ticks are kept as they are on the server
// POST { code, action:"tick", event, player, item, done }                anyone with that player
// POST { code, action:"date", date:{ id?, players?, kind, title, start, end, venue, notes, with } }
// POST { code, action:"date_del", id }                                   coach or manager
// POST { code, action:"cal" }  -> { ok, url }   the calendar link, made the first time
// POST { code, action:"cal_new" } -> { ok, url } a new link; the old one stops working
// POST { code, action:"accept", id } / { code, action:"ignore", id }
//        what the Monday search found: anyone with those players can decide it,
//        and accepting tells everyone at once
//
// The same gate as every other dg-* endpoint: the code decides which players
// it may touch. Nothing here is ever readable without a code, except the
// calendar feed, which has its own long key (dg-cal.js).

import crypto from 'node:crypto';
import { authorise, sbHeaders, timedFetch, safeLabel, safeKeys, whoIs, isStaff } from './dg-load.js';
import { addNews, playerNames, STATUS_NEWS, niceDates, niceWhen, applyProposal } from './_season.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WHEN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const STATUSES = ['none', 'considering', 'entered', 'ballot', 'confirmed', 'reserve', 'withdrawn', 'played'];
const OWNERS = ['player', 'manager', 'coach'];
const KINDS = ['squad', 'lesson', 'other'];
const ITEM = /^[a-z0-9-]{1,24}$/;

const txt = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const day = (s) => (DAY.test(String(s || '')) ? String(s) : null);
const when = (s) => (WHEN.test(String(s || '')) ? String(s) : null);
const link = (s) => { const u = String(s || '').trim(); return /^https:\/\/[^\s<>"]{3,300}$/.test(u) ? u : null; };
const newId = (p) => p + '-' + crypto.randomBytes(6).toString('hex');

export function cleanEvent(e) {
  e = e || {};
  const m = Math.round(+e.month);
  return {
    name: txt(e.name, 80) || 'Tournament',
    venue: txt(e.venue, 80),
    month: m >= 1 && m <= 12 ? m : null,
    start: day(e.start), end: day(e.end) || day(e.start),
    open: day(e.open), close: day(e.close),
    confirmed: !!e.confirmed,
    guide: txt(e.guide, 240), entry: txt(e.entry, 240), flag: txt(e.flag, 240),
    link: link(e.link), notes: txt(e.notes, 500),
  };
}
export function cleanEntry(x, keep) {
  x = x || {}; keep = keep || {};
  const status = STATUSES.indexOf(x.status) > -1 ? x.status : (keep.status || 'considering');
  const statusAt = Object.assign({}, keep.statusAt || {});
  if (status !== keep.status) statusAt[status] = new Date().toISOString().slice(0, 10);
  const owners = {};
  Object.keys(x.owners || {}).slice(0, 40).forEach((k) => { if (ITEM.test(k) && OWNERS.indexOf(x.owners[k]) > -1) owners[k] = x.owners[k]; });
  const tees = (Array.isArray(x.tees) ? x.tees : []).slice(0, 6)
    .map((t, i) => ({ r: Math.max(1, Math.min(6, Math.round(+(t && t.r) || i + 1))), at: when(t && t.at) }))
    .filter((t) => t.at);
  return { status, statusAt, practice: when(x.practice), tees, owners, notes: txt(x.notes, 500), check: keep.check || {} };
}
export function cleanDate(d) {
  d = d || {};
  return {
    kind: KINDS.indexOf(d.kind) > -1 ? d.kind : 'other',
    title: txt(d.title, 80) || (d.kind === 'lesson' ? 'Lesson' : d.kind === 'squad' ? 'Squad day' : 'Golf'),
    start: when(d.start), end: when(d.end),
    venue: txt(d.venue, 80), notes: txt(d.notes, 300), with: txt(d.with, 40),
  };
}

async function sb(path, opts) {
  const r = await timedFetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...(opts || {}), headers: { ...sbHeaders(), ...((opts && opts.headers) || {}) } });
  if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const inList = (keys) => keys.map((p) => `"${p}"`).join(',');
const upsert = { Prefer: 'resolution=merge-duplicates,return=minimal' };

export async function calUrl(players, by, fresh) {
  const keys = safeKeys(players).sort();
  const rows = await sb(`dg_cal?players=eq.{${keys.join(',')}}&select=token`);
  if (fresh && rows.length) await sb(`dg_cal?players=eq.{${keys.join(',')}}`, { method: 'DELETE' });
  let token = !fresh && rows.length ? rows[0].token : null;
  if (!token) {
    token = crypto.randomBytes(24).toString('base64url');
    await sb('dg_cal', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ token, players: keys, created_by: by }) });
  }
  const host = process.env.PUBLIC_HOST || 'training.denyergolf.com';
  return { url: `https://${host}/api/dg-cal?k=${token}`, webcal: `webcal://${host}/api/dg-cal?k=${token}` };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, reason: 'supabase_not_configured' });
  }
  const body = req.body || {};
  const auth = await authorise(body.code);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, reason: auth.reason });
  if (auth.unclaimed) return res.status(409).json({ ok: false, reason: 'needs_name' });
  const keys = safeKeys(auth.players);
  if (!keys.length) return res.status(403).json({ ok: false, reason: 'no_players' });
  const me = whoIs(auth.row), staff = isStaff(me), by = me.name || 'someone';
  const mine = (p) => keys.indexOf(String(p || '')) > -1;
  const pick = (list) => { const l = safeKeys(Array.isArray(list) ? list : []).filter(mine); return l.length ? l : keys; };
  const needStaff = () => { if (!staff) { res.status(403).json({ ok: false, reason: 'staff_only' }); return true; } return false; };

  try {
    const a = body.action;
    if (a === 'get') {
      const L = inList(keys);
      const ev = await sb(`dg_events?players=ov.{${keys.join(',')}}&select=id,players,body,updated,updated_by&limit=500`);
      const en = await sb(`dg_entries?player=in.(${L})&select=event_id,player,body,updated,updated_by&limit=2000`);
      const dt = await sb(`dg_dates?players=ov.{${keys.join(',')}}&select=id,players,body,updated,updated_by&limit=1000`);
      let pr = [];
      try { pr = await sb(`dg_proposals?status=eq.pending&players=ov.{${keys.join(',')}}&select=id,event_id,field,value,note,source,found&order=found.asc&limit=100`); } catch (e) { pr = []; }
      return res.status(200).json({ ok: true,
        events: ev.map((r) => ({ ...r.body, id: r.id, players: r.players.filter(mine), updated: r.updated, by: r.updated_by })),
        entries: en.map((r) => ({ ...r.body, event: r.event_id, player: r.player, updated: r.updated, by: r.updated_by })),
        dates: dt.map((r) => ({ ...r.body, id: r.id, players: r.players.filter(mine), updated: r.updated, by: r.updated_by })),
        proposals: pr });
    }

    if (a === 'event') {
      if (needStaff()) return;
      const e = body.event || {};
      let id = String(e.id || '');
      let players = pick(e.players);
      if (id) {
        const cur = await sb(`dg_events?id=eq.${encodeURIComponent(id)}&select=players`);
        if (cur.length && !cur[0].players.some(mine)) return res.status(403).json({ ok: false, reason: 'not_your_event' });
        // players this code cannot see stay on the event
        if (cur.length) players = [...new Set(cur[0].players.filter((p) => !mine(p)).concat(players))];
      } else id = newId('ev');
      if (!/^[a-z0-9-]{3,60}$/.test(id)) return res.status(400).json({ ok: false, reason: 'bad_id' });
      const row = { id, players, body: cleanEvent(e), updated: new Date().toISOString(), updated_by: by };
      await sb('dg_events?on_conflict=id', { method: 'POST', headers: upsert, body: JSON.stringify(row) });
      return res.status(200).json({ ok: true, id });
    }
    if (a === 'event_del') {
      if (needStaff()) return;
      const id = String(body.id || '');
      const cur = await sb(`dg_events?id=eq.${encodeURIComponent(id)}&select=players`);
      if (!cur.length) return res.status(200).json({ ok: true });
      if (!cur[0].players.every(mine)) return res.status(403).json({ ok: false, reason: 'shared_with_others' });
      await sb(`dg_events?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    if (a === 'entry' || a === 'tick') {
      const ev = String(body.event || ''), pl = String(body.player || '');
      if (!mine(pl)) return res.status(403).json({ ok: false, reason: 'not_your_player' });
      const evs = await sb(`dg_events?id=eq.${encodeURIComponent(ev)}&select=players`);
      if (!evs.length || evs[0].players.indexOf(pl) < 0) return res.status(404).json({ ok: false, reason: 'no_event' });
      const cur = await sb(`dg_entries?event_id=eq.${encodeURIComponent(ev)}&player=eq.${encodeURIComponent(pl)}&select=body`);
      const keep = cur.length ? cur[0].body : {};
      let next;
      if (a === 'entry') {
        if (needStaff()) return;
        next = cleanEntry(body.entry, keep);
        // news: a status worth telling people about, or tee times, goes out at once
        try {
          const evb = (await sb(`dg_events?id=eq.${encodeURIComponent(ev)}&select=body`))[0].body || {};
          const nm = await playerNames([pl]);
          if (next.status !== (keep.status || 'considering') && STATUS_NEWS[next.status]) {
            await addNews([pl], `${nm(pl)}: ${STATUS_NEWS[next.status]}`, evb.name + (evb.start ? ', ' + niceDates(evb) : '') + (evb.venue ? ', ' + evb.venue : ''),
              `/?go=event&id=${ev}`, 'status');
          }
          const was = {}; (keep.tees || []).forEach((t) => { was[t.r] = t.at; });
          const fresh = next.tees.filter((t) => was[t.r] !== t.at);
          if (fresh.length) {
            await addNews([pl], `${nm(pl)}: tee time${fresh.length > 1 ? 's' : ''}`,
              fresh.map((t) => `Round ${t.r}, ${niceWhen(t.at)}`).join('; ') + ` (${evb.name})`, `/?go=event&id=${ev}`, 'tees');
          }
        } catch (e) { console.error('dg-season news:', e.message); }
      } else {
        const item = String(body.item || '');
        if (!ITEM.test(item)) return res.status(400).json({ ok: false, reason: 'bad_item' });
        next = Object.assign({ status: 'considering' }, keep);
        next.check = Object.assign({}, keep.check || {});
        if (body.done) next.check[item] = { at: Date.now(), by };
        else delete next.check[item];
      }
      await sb('dg_entries?on_conflict=event_id,player', { method: 'POST', headers: upsert,
        body: JSON.stringify({ event_id: ev, player: pl, body: next, updated: new Date().toISOString(), updated_by: by }) });
      return res.status(200).json({ ok: true, entry: { ...next, event: ev, player: pl } });
    }

    if (a === 'date') {
      if (needStaff()) return;
      const d = body.date || {};
      let id = String(d.id || '');
      if (id) {
        const cur = await sb(`dg_dates?id=eq.${encodeURIComponent(id)}&select=players`);
        if (cur.length && !cur[0].players.some(mine)) return res.status(403).json({ ok: false, reason: 'not_yours' });
      } else id = newId('dt');
      if (!/^[a-z0-9-]{3,60}$/.test(id)) return res.status(400).json({ ok: false, reason: 'bad_id' });
      const clean = cleanDate(d);
      if (!clean.start) return res.status(400).json({ ok: false, reason: 'needs_a_start' });
      await sb('dg_dates?on_conflict=id', { method: 'POST', headers: upsert,
        body: JSON.stringify({ id, players: pick(d.players), body: clean, updated: new Date().toISOString(), updated_by: by }) });
      return res.status(200).json({ ok: true, id });
    }
    if (a === 'date_del') {
      if (needStaff()) return;
      const id = String(body.id || '');
      const cur = await sb(`dg_dates?id=eq.${encodeURIComponent(id)}&select=players`);
      if (cur.length && !cur[0].players.every(mine)) return res.status(403).json({ ok: false, reason: 'shared_with_others' });
      if (cur.length) await sb(`dg_dates?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    if (a === 'accept' || a === 'ignore') {
      const id = String(body.id || '');
      const prs = await sb(`dg_proposals?id=eq.${encodeURIComponent(id)}&select=*`);
      if (!prs.length) return res.status(404).json({ ok: false, reason: 'not_found' });
      const pr = prs[0];
      if (!(pr.players || []).some(mine)) return res.status(403).json({ ok: false, reason: 'not_yours' });
      if (pr.status !== 'pending') return res.status(200).json({ ok: true, already: pr.status });
      const decide = (st) => sb(`dg_proposals?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: st, decided_by: by, decided: new Date().toISOString() }) });
      if (a === 'ignore') { await decide('ignored'); return res.status(200).json({ ok: true }); }
      let evId = pr.event_id, evBody, evPlayers = pr.players || keys, words;
      if (pr.field === 'new_event') {
        let v = {}; try { v = JSON.parse(pr.value || '{}'); } catch (e) { v = {}; }
        evBody = cleanEvent(v); evId = newId('ev'); words = 'Added to the calendar' + (evBody.start ? ': ' + niceDates(evBody) : '');
      } else {
        const evs = await sb(`dg_events?id=eq.${encodeURIComponent(evId || '')}&select=players,body`);
        if (!evs.length) { await decide('ignored'); return res.status(404).json({ ok: false, reason: 'no_event' }); }
        const ap = applyProposal(evs[0].body, pr);
        if (!ap) return res.status(400).json({ ok: false, reason: 'cannot_apply' });
        evBody = cleanEvent(ap.body); evPlayers = evs[0].players; words = ap.words;
      }
      await sb('dg_events?on_conflict=id', { method: 'POST', headers: upsert,
        body: JSON.stringify({ id: evId, players: evPlayers, body: evBody, updated: new Date().toISOString(), updated_by: by }) });
      await decide('accepted');
      await addNews(evPlayers, evBody.name, words + (evBody.venue && pr.field === 'dates' ? ', ' + evBody.venue : '') + '.', `/?go=event&id=${evId}`, 'confirmed');
      return res.status(200).json({ ok: true, event: evId });
    }

    if (a === 'cal' || a === 'cal_new') {
      if (needStaff()) return;
      const u = await calUrl(keys, by, a === 'cal_new');
      return res.status(200).json({ ok: true, ...u });
    }

    return res.status(400).json({ ok: false, reason: 'unknown action' });
  } catch (err) {
    console.error('dg-season error:', err);
    return res.status(500).json({ ok: false, reason: err.message });
  }
}
