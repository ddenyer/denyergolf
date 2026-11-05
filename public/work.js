// The work: stocks, processes and flows (4 November 2026; capture screens built 4 November 2026).
// One record that every step adds to and every model reads. Stocks are the resources the service holds (the
// inventory's resources, each with its regulatory heading and its capital); processes are the tasks (the inventory's
// processes); load is what creates work (drivers, with their modifiers) and the packages it is organised by; time says
// when it falls and how quickly it must be done; flows are the handovers between people and the failure demand that
// errors create. Load per person is read from the packages and compared with each person's manageable band. Every
// figure carries an evidence level, 0 to 5. Reads and saves the inventory tile.
(function () {
  'use strict';
  var X, el;
  var ST = { tab: 'overview', sub: { stocks: 'capital', load: 'drivers', time: 'scale', flows: 'handovers' }, task: null, lane: null, scale: 'month', all: false };
  var HEAD = [['people', 'People'], ['tech', 'Technology'], ['fac', 'Facilities'], ['info', 'Information'], ['third', 'Third party'], ['other', 'Other']];
  var CAPS = [['human', 'People'], ['social', 'Relationships and trust'], ['manufactured', 'Buildings and kit'], ['information', 'Information'], ['financial', 'Money'], ['natural', 'Land, water, energy']];
  var CAP_OF = { people: 'human', tech: 'manufactured', fac: 'manufactured', info: 'information', third: 'social', other: 'financial' };
  var KIND = [['volume', 'Volume: grows with the number'], ['container', 'Container: carries its own work'], ['event', 'Event: happens at set times']];
  var MKIND = [['variant', 'Variant: a kind of unit that costs more'], ['complication', 'Complication: a condition that adds a fixed amount']];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var HOURS = []; for (var hh = 0; hh < 24; hh++) HOURS.push((hh < 10 ? '0' : '') + hh);
  var SCALES = [['month', 'Year, by month', MONTHS], ['day', 'Week, by day', DAYS], ['hour', 'Day, by hour', HOURS]];
  var STEPS = [['frame', '1 Frame'], ['diagnose', '2 Diagnose'], ['model', '3 Model'], ['test', '4 Test']];
  var EVL = [[0, 'No evidence'], [1, 'Said'], [2, 'Written down'], [3, 'Done, or confirmed'], [4, 'Tested, or independently confirmed'], [5, 'Tested end to end, or across sources']];
  var TABS = [['overview', 'Overview'], ['stocks', 'Stocks'], ['processes', 'Processes'], ['load', 'Load'], ['time', 'Time'], ['flows', 'Flows'], ['shows', 'What it shows']];
  var SUBS = {
    stocks: [['capital', '1 By capital'], ['skills', '7 Who can do what'], ['overtime', '11 Stocks over time']],
    load: [['drivers', '2 Drivers'], ['heavier', '3 Heavier work'], ['packages', '4 Packages']],
    time: [['scale', '5 Time at the right scale'], ['limits', '6 Time limits']],
    flows: [['handovers', '9 Flow and handovers'], ['errors', '10 Errors and failure demand']]
  };
  // where each numbered screen lives
  var SCREENS = [
    [1, 'By capital', 'stocks', 'capital'], [2, 'Drivers', 'load', 'drivers'], [3, 'What makes some work heavier', 'load', 'heavier'], [4, 'Packages', 'load', 'packages'],
    [5, 'Time at the right scale', 'time', 'scale'], [6, 'Time limits', 'time', 'limits'], [7, 'Who can do what', 'stocks', 'skills'], [8, 'The task list, each in full', 'processes', null],
    [9, 'Flow and handovers', 'flows', 'handovers'], [10, 'Errors and failure demand', 'flows', 'errors'], [11, 'Stocks over time', 'stocks', 'overtime'], [12, 'What it shows', 'shows', null]
  ];
  var GROUPS = [
    ['Stocks', 'What the service holds. It gives capacity and is not used up by each piece of work.', [1, 7, 11]],
    ['Processes', 'What is done. Each task draws on the stocks and hands on to the next.', [8, 9]],
    ['Load', 'What creates the work, how it is bundled and given out, and when it falls.', [2, 3, 4, 5, 6]],
    ['Loops', 'What connects them: how overload turns into errors and more work.', [10, 12]]
  ];
  var SIX = [
    ['passes', '1 What passes with it', 'The information or message handed on, and who must be told.', 'What is handed on, and who must be told', 'what could go unnoticed; barriers'],
    ['asdone', '2 As written and as done', 'The procedure, what people actually do, and the adjustments between them.', 'Where practice differs from the procedure', 'how small variations combine'],
    ['checks', '3 Checks and signals', 'The check meant to catch a problem, how anyone knows it was done, and how anyone knows it failed.', 'Who would notice, and when', 'what could go unnoticed; barriers'],
    ['roundway', '4 The degraded way', 'The workaround when the normal route is down, how much it can handle, and who can switch to it.', 'What happens when the normal route is down', 'the minimum the service needs'],
    ['across', '5 Across boundaries', 'Parts done by another unit or organisation, the agreement that covers the join, and who owns it.', 'Other units, suppliers, the agreement', 'who is connected to whom; the wider picture of causes'],
    ['decides', '6 Who decides, who escalates', 'Who can decide, who can stop it, and how a problem is raised at each hour.', 'Who to call, and out of hours', 'how the service steers itself']
  ];
  var EKINDS = [['fix', 'Putting it right'], ['chase', 'Chasing and queries'], ['complain', 'Complaints'], ['invest', 'Investigations and reviews']];

  var ro = function () { return !!X.S.readonly; };
  var lab = function (L, v) { var x = L.filter(function (y) { return y[0] === v; })[0]; return x ? x[1] : ''; };
  var num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var has = function (v) { return v != null && String(v).trim() !== ''; };
  var rnd = function (x) { return Math.round(x * 100) / 100; };
  var fmt = function (x) { return Math.round(x).toLocaleString('en-GB'); };
  var W = function (v) {
    v.work = v.work || {}; var w = v.work;
    w.drivers = w.drivers || []; w.mods = w.mods || []; w.packages = w.packages || []; w.loops = w.loops || [];
    w.presence = w.presence || {}; w.err = w.err || {}; w.err.rates = w.err.rates || []; w.err.kinds = w.err.kinds || {}; w.pflow = w.pflow || {};
    if (w.cw == null) w.cw = 1; return w;
  };
  var q = Promise.resolve();
  function save(fn) {
    var run = q.then(async function () { var v = X.invData(); W(v); fn(v); await X.saveInv(v); });
    q = run.catch(function () {});
    return run.then(function () { var m = document.getElementById('wkMsg'); if (m) m.textContent = 'All changes saved.'; }, function (e) { var m = document.getElementById('wkMsg'); if (m) m.textContent = 'Not saved: ' + (e.message || e); });
  }
  function inp(v, on, ph, aria, cls) { var t = el('input', { type: 'text', value: v == null ? '' : String(v), placeholder: ph || '', disabled: ro(), 'aria-label': aria || ph || '', class: cls || '' }); t.addEventListener('change', function () { on(t.value.trim()); }); return t; }
  function sel(list, v, on, aria) { var s = el('select', { disabled: ro(), 'aria-label': aria || '' }, list.map(function (o) { return el('option', { value: o[0], text: o[1] }); })); s.value = v == null ? '' : String(v); s.addEventListener('change', function () { on(s.value); }); return s; }
  function evSel(v, on, aria) { return sel([['', 'Evidence: not set']].concat(EVL.map(function (e) { return [String(e[0]), e[0] + ' ' + e[1]]; })), v, function (x) { on(x === '' ? '' : Number(x)); }, aria || 'How good is the evidence?'); }
  function stepSel(v, on) { return sel([['', 'Added in…']].concat(STEPS), v, on, 'Added in which step'); }
  function lvTag(lv) { if (lv == null || lv === '') return el('span', { class: 'wklv wkl-n', text: 'Not set' }); var n = Number(lv); return el('span', { class: 'wklv wkl' + n, text: n + ' ' + EVL[n][1] }); }
  var upd = function (list, id, patch) { return function (v) { var x = listOf(v, list).filter(function (y) { return y.id === id; })[0]; if (x) Object.assign(x, typeof patch === 'function' ? patch(x) : patch); }; };
  var listOf = function (v, k) { return k === 'resources' || k === 'processes' ? v[k] : W(v)[k]; };
  function field(k, id, f, rerender) { return function (val) { var r = save(function (v) { var x = listOf(v, k).filter(function (y) { return y.id === id; })[0]; if (x) x[f] = val; }); if (rerender) r.then(X.render); }; }
  function wset(path, rerender) { return function (val) { var r = save(function (v) { var o = W(v); for (var i = 0; i < path.length - 1; i++) { o[path[i]] = o[path[i]] || {}; o = o[path[i]]; } o[path[path.length - 1]] = val; }); if (rerender) r.then(X.render); }; }
  function add(k, pre, obj) { return function () { save(function (v) { var L = listOf(v, k); L.push(Object.assign({ id: X.nid(pre, L) }, obj)); }).then(X.render); }; }
  function del(k, id) { return function () { save(function (v) { var L = listOf(v, k), i = L.map(function (y) { return y.id; }).indexOf(id); if (i >= 0) L.splice(i, 1); }).then(X.render); }; }
  function card(kids, attrs) { return el('section', Object.assign({ class: 'fxcard wksec' }, attrs || {}), kids); }
  function h2(t) { return el('h2', { class: 'fxsech', text: t }); }
  function lede(t) { return el('p', { class: 'fxmuted wklede', text: t }); }
  function table(hd, rows, cls) { return el('div', { class: 'skscroll' }, [el('table', { class: 'fxtable wktab ' + (cls || '') }, [el('thead', {}, [el('tr', {}, hd.map(function (h) { return el('th', { text: h }); }))]), el('tbody', {}, rows)])]); }
  function goto(tab, sub) { return function (e) { if (e) e.preventDefault(); ST.tab = tab; if (sub) ST.sub[tab] = sub; X.render(); var t = document.getElementById('theWork'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }; }
  function screenLink(n, text) { var s = SCREENS[n - 1]; return el('a', { href: '#thework', class: 'wkgo', text: text || ('screen ' + n), onclick: goto(s[2], s[3]) }); }

  // ---------- the sums ----------
  function loads(v) {
    var w = W(v), out = {};
    var drv = {}; w.drivers.forEach(function (d) { drv[d.id] = d; });
    w.packages.forEach(function (p) {
      var t = 0; Object.keys(p.counts || {}).forEach(function (k) { if (drv[k]) t += num(p.counts[k]) * num(drv[k].w == null ? 1 : drv[k].w); });
      t += num(p.comp) * num(w.cw);
      p._load = t;
      if (p.owner) { var o = out[p.owner] = out[p.owner] || { load: 0, packages: [] }; o.load += t; o.packages.push(p); }
    });
    return out;
  }
  function people(v) { return v.resources.filter(function (r) { return r.t === 'people'; }); }
  function driverTotal(w, d) { var t = 0; w.packages.forEach(function (p) { t += num((p.counts || {})[d.id]); }); return t; }
  // when a driver falls, at a scale: 0 not known, 1 some work arrives, 2 peak
  function whenOf(d, scale) {
    var n = scale === 'month' ? 12 : scale === 'day' ? 7 : 24;
    var a = d.when && d.when[scale];
    if (a && a.length === n) return a.slice();
    var out = []; for (var i = 0; i < n; i++) out.push(0);
    if (scale === 'month' && d.months) d.months.forEach(function (m) { out[m] = 1; });
    return out;
  }
  function presOf(w, scale) { var n = scale === 'month' ? 12 : scale === 'day' ? 7 : 24, a = w.presence[scale]; if (a && a.length === n) return a.slice(); var out = []; for (var i = 0; i < n; i++) out.push(0); return out; }
  function skillOf(p, rid) { var s = p.skill || {}; if (s[rid] != null) return s[rid]; return p.who === rid ? 'D' : ''; }
  function stepsOf(p) {
    if (p.stepList && p.stepList.length) return p.stepList;
    if (has(p.steps)) return String(p.steps).split(/\s*;\s*/).filter(Boolean).map(function (t) { return { t: t, who: '', to: '' }; });
    return [];
  }
  function whoName(v, p) { var r = v.resources.filter(function (x) { return x.id === p.who; })[0]; return r ? r.n : ''; }
  // the handovers in a task: each step hands to the next step's doer, or to whoever it names; with no steps, the task hands its output on
  function handovers(v, p) {
    var s = stepsOf(p);
    if (!s.length) return [{ from: whoName(v, p) || p.owner || '', to: p.output || '', obj: p.ho || {}, at: 'ho' }];
    return s.map(function (x, i) { return { from: x.who || '', to: x.to || (s[i + 1] || {}).who || (i === s.length - 1 ? p.output || '' : ''), obj: x, at: i, step: x.t }; });
  }
  function meanLv(list) { var xs = list.filter(function (x) { return x != null && x !== ''; }).map(Number); if (!xs.length) return null; return Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length); }
  // started, and the evidence level, for each numbered screen
  function screenState(v) {
    var w = W(v), ps = v.processes, ppl = people(v);
    var anyWhen = w.drivers.some(function (d) { return ['month', 'day', 'hour'].some(function (s) { return whenOf(d, s).some(Boolean); }); }) || ['month', 'day', 'hour'].some(function (s) { return presOf(w, s).some(Boolean); });
    var anySkill = ps.some(function (p) { return Object.keys(p.skill || {}).some(function (k) { return p.skill[k]; }) || p.who; });
    var anyHo = ps.some(function (p) { return stepsOf(p).length || has(p.output); });
    var anyErr = w.err.rates.some(has) || EKINDS.some(function (k) { var o = w.err.kinds[k[0]] || {}; return has(o.work) || has(o.who); });
    var flowRows = v.resources.filter(function (r) { return r.t !== 'people'; }).filter(function (r) { return has(r.fills) || has(r.drains) || has(r.floor); });
    var pfl = has(w.pflow.fills) || has(w.pflow.drains) || has(w.pflow.floor);
    return {
      1: { on: v.resources.length > 0, lv: meanLv(v.resources.map(function (r) { return r.lv; })) },
      2: { on: w.drivers.length > 0, lv: meanLv(w.drivers.map(function (d) { return d.lv; })) },
      3: { on: w.mods.length > 0, lv: meanLv(w.mods.map(function (m) { return m.lv; })) },
      4: { on: w.packages.length > 0, lv: w.pkgLv != null && w.pkgLv !== '' ? Number(w.pkgLv) : (w.packages.length ? meanLv(w.drivers.map(function (d) { return d.lv; })) : null) },
      5: { on: anyWhen, lv: anyWhen ? (w.timeLv === '' || w.timeLv == null ? 0 : Number(w.timeLv)) : null },
      6: { on: ps.some(function (p) { return has(p.limit) || has(p.limitMax); }), lv: meanLv(ps.filter(function (p) { return has(p.limit) || has(p.limitMax); }).map(function (p) { return p.limitLv; })) },
      7: { on: anySkill && ppl.length > 0, lv: anySkill ? (w.skillLv === '' || w.skillLv == null ? 0 : Number(w.skillLv)) : null },
      8: { on: ps.length > 0, lv: meanLv(ps.map(function (p) { return p.lv; })) },
      9: { on: anyHo, lv: anyHo ? (w.hoLv === '' || w.hoLv == null ? 0 : Number(w.hoLv)) : null },
      10: { on: anyErr, lv: anyErr ? (w.err.lv === '' || w.err.lv == null ? 0 : Number(w.err.lv)) : null },
      11: { on: flowRows.length > 0 || pfl, lv: meanLv(flowRows.map(function (r) { return r.flv; }).concat(pfl ? [w.pflow.lv] : [])) },
      12: { on: true, lv: null }
    };
  }

  // ---------- the page ----------
  function render(main, x) {
    X = x; el = x.el; css();
    var v = X.invData(); W(v);
    var L = loads(v);
    var wrap = el('div', { class: 'fx wk', id: 'theWork' }); main.appendChild(wrap);
    wrap.appendChild(el('div', { class: 'fxtop' }, [el('a', { class: 'fxback', href: '#fhome', text: '‹ 1 Frame' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxsave ok', id: 'wkMsg', role: 'status', text: '' })]));
    wrap.appendChild(el('h1', { class: 'fxh1', text: 'The work: stocks, processes and flows' }));
    var ppl = people(v), over = ppl.filter(function (r) { var l = (L[r.id] || {}).load || 0; return r.bandHi && l > num(r.bandHi); });
    wrap.appendChild(el('p', { class: 'fxmuted', id: 'wkSum', text: v.resources.length + ' stocks · ' + v.processes.length + ' processes · ' + W(v).drivers.length + ' drivers · ' + W(v).packages.length + ' packages' + (over.length ? ' · ' + over.length + ' of ' + ppl.length + ' people above their band' : '') }));
    wrap.appendChild(el('div', { class: 'seg wktabs', role: 'tablist', 'aria-label': 'The work' }, TABS.map(function (t) { var on = ST.tab === t[0]; return el('button', { type: 'button', role: 'tab', 'data-wtab': t[0], class: on ? 'on' : '', 'aria-selected': String(on), 'aria-pressed': String(on), text: t[1], onclick: goto(t[0]) }); })));
    var subs = SUBS[ST.tab];
    if (subs) wrap.appendChild(el('div', { class: 'wksubs', role: 'tablist', 'aria-label': 'Screens' }, subs.map(function (s) { var on = ST.sub[ST.tab] === s[0]; return el('button', { type: 'button', role: 'tab', 'data-wsub': s[0], class: 'wkpill' + (on ? ' on' : ''), 'aria-selected': String(on), text: s[1], onclick: goto(ST.tab, s[0]) }); })));
    var host = el('div', { id: 'wkHost' }); wrap.appendChild(host);
    var key = subs ? ST.sub[ST.tab] : ST.tab;
    ({ overview: overview, capital: stocks, skills: skills, overtime: overtime, processes: processes, drivers: drivers, heavier: heavier, packages: packages, scale: timeScale, limits: limits, handovers: flowsHo, errors: errors, shows: shows })[key](host, v, L);
  }

  // Overview: the screens, grouped, with how far each has got
  function overview(host, v) {
    var S = screenState(v), started = 0, lvs = [];
    for (var i = 1; i <= 11; i++) { if (S[i].on) { started++; lvs.push(S[i].lv == null ? 0 : S[i].lv); } }
    var all = lvs.length ? Math.floor(lvs.reduce(function (a, b) { return a + b; }, 0) / lvs.length) : 0;
    host.appendChild(lede('One record of what the service holds, what it does, and what moves through it. Start with what you know; each figure says how good the evidence is, from 0 to 5. Use only the parts this case needs.'));
    host.appendChild(el('div', { class: 'wkbars' }, [
      el('div', { class: 'fxcard wkbarcard' }, [el('div', { class: 'fxmuted sm', id: 'wkProg', text: 'Progress: ' + started + ' of 11 screens started' }), el('div', { class: 'wkpb' }, [el('span', { style: 'width:' + Math.round(100 * started / 11) + '%' })])]),
      el('div', { class: 'fxcard wkbarcard' }, [el('div', { class: 'fxmuted sm', id: 'wkEv', text: 'Evidence: level ' + all + ' of 5, ' + EVL[all][1].toLowerCase() }), el('div', { class: 'wkpb ev' }, [el('span', { style: 'width:' + Math.round(100 * all / 5) + '%' })])])
    ]));
    host.appendChild(el('div', { class: 'wkgroups' }, GROUPS.map(function (g) {
      return card([h2(g[0]), el('p', { class: 'fxmuted sm', text: g[1] })].concat(g[2].map(function (n) {
        var s = SCREENS[n - 1], st = S[n];
        return el('a', { href: '#thework', class: 'wkitem', 'data-screen': String(n), onclick: goto(s[2], s[3]) }, [el('span', {}, [el('span', { class: 'wknum', text: String(n) }), document.createTextNode(s[1])]), n === 12 ? el('span', { class: 'fxmuted sm', text: 'Read only' }) : !st.on ? el('span', { class: 'fxmuted sm', text: 'Not started' }) : lvTag(st.lv)]);
      })), { class: 'fxcard wksec wkgroup' });
    })));
    host.appendChild(card([h2('Where this feeds'), el('p', { class: 'fxmuted sm', text: 'Nothing here is typed twice. Each part of the method reads from this record.' }), el('div', { class: 'wkfeeds' }, ['1.2 The system: questions', '1.3 Thresholds', '2.3.6 Load and capability', '3.1 Process and service maps', '3.3 Flow model and people model', '4.1 Testing the model'].map(function (t) { return el('span', { class: 'wkchip2', text: t }); }))]));
  }

  // 1 Stocks: the resources, by capital
  function stocks(host, v, L) {
    host.appendChild(lede('List what the work draws on, by capital. A stock gives capacity: people, trust, buildings and kit, information, money, and land, water and energy. Say how much it can carry and who covers when it is not there. Ownership says whether it is the organisation’s own or someone else’s.'));
    CAPS.forEach(function (cp) {
      var rs = v.resources.filter(function (r) { return (r.cap || CAP_OF[r.t] || 'financial') === cp[0]; });
      var sec = card([el('div', { class: 'fxqhead' }, [h2(cp[1]), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag', text: rs.length + (rs.length === 1 ? ' item' : ' items') })])], { 'data-cap': cp[0] });
      if (rs.length) {
        var isP = cp[0] === 'human';
        var hd = ['Item', 'Heading', 'Owner', isP ? 'Alternative' : 'When it is not there'].concat(isP ? ['Capacity', 'Band', 'Absence', 'Covered by', 'Load'] : ['How much it can carry']).concat(['Evidence', 'Added in', '']);
        sec.appendChild(table(hd, rs.map(function (r) {
          var l = (L[r.id] || {}).load || 0, hi = num(r.bandHi), lo = num(r.bandLo);
          var cells = [el('td', {}, [inp(r.n, field('resources', r.id, 'n'), 'Name', 'Name of the stock')]), el('td', {}, [sel(HEAD, r.t, field('resources', r.id, 't'), 'Regulatory heading')]), el('td', {}, [inp(r.owner, field('resources', r.id, 'owner'), 'Ours, or whose', 'Owner')]), el('td', {}, [inp(r.alt, field('resources', r.id, 'alt'), isP ? 'None' : 'What people do without it', 'Alternative')])];
          if (isP) cells = cells.concat([el('td', {}, [inp(r.capacity, field('resources', r.id, 'capacity'), 'points a year', 'Capacity', 'wkn')]), el('td', { class: 'wkband' }, [inp(r.bandLo, field('resources', r.id, 'bandLo'), 'low', 'Band low', 'wkn'), el('span', { text: 'to' }), inp(r.bandHi, field('resources', r.id, 'bandHi'), 'high', 'Band high', 'wkn')]), el('td', {}, [inp(r.absence, field('resources', r.id, 'absence'), 'per cent', 'Expected absence', 'wkn')]), el('td', {}, [inp(r.cover, field('resources', r.id, 'cover'), 'Nobody', 'Who covers')]), el('td', { class: 'wkload' + (hi && l > hi ? ' over' : lo && l < lo ? ' under' : ''), text: l ? fmt(l) : '–' })]);
          else cells.push(el('td', {}, [inp(r.capacity, field('resources', r.id, 'capacity'), 'A figure and a unit', 'How much it can carry')]));
          cells = cells.concat([el('td', {}, [evSel(r.lv, field('resources', r.id, 'lv'))]), el('td', {}, [stepSel(r.step, field('resources', r.id, 'step'))]), el('td', {}, ro() ? [] : [el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: del('resources', r.id) })])]);
          return el('tr', { 'data-res': r.id }, cells);
        })));
      } else sec.appendChild(el('p', { class: 'fxmuted', text: 'None yet.' }));
      if (!ro()) sec.appendChild(el('button', { class: 'btn sm', type: 'button', text: 'Add to ' + cp[1].toLowerCase(), onclick: add('resources', 'r', { n: '', t: cp[0] === 'human' ? 'people' : cp[0] === 'information' ? 'info' : cp[0] === 'social' ? 'third' : cp[0] === 'manufactured' ? 'tech' : 'other', cap: cp[0], alt: '', u: [], step: 'diagnose' }) }));
      host.appendChild(sec);
    });
  }

  // 7 Who can do what: tasks against people
  function skills(host, v, L) {
    var w = W(v), ppl = people(v), ps = v.processes;
    host.appendChild(lede('For each task, who does it now, who could stand in, and who has the authority or the system access it needs. A task only one person can do is a single point.'));
    if (!ps.length || !ppl.length) { host.appendChild(card([el('p', { class: 'fxmuted', text: 'Add people under 1 By capital and tasks under Processes first.' })])); return; }
    var marked = function (r) { return ps.some(function (p) { return skillOf(p, r.id); }); };
    var shown = ST.all ? ppl : ppl.filter(function (r) { return (L[r.id] || {}).packages || marked(r); });
    if (!shown.length) shown = ppl;
    var hidden = ppl.length - shown.length;
    var CYC = ['', 'D', 'S', 'A'], NAME = { '': 'not set', D: 'does it now', S: 'could stand in', A: 'has the authority or access' };
    var rows = ps.map(function (p) {
      var stand = ppl.filter(function (r) { return skillOf(p, r.id) === 'S'; }).map(function (r) { return r.n; });
      return el('tr', { 'data-proc': p.id }, [el('th', { class: 'wkmxt', text: p.n || 'Unnamed task' })].concat(shown.map(function (r) {
        var cur = skillOf(p, r.id);
        return el('td', {}, [el('button', { type: 'button', class: 'wkmx' + (cur ? ' k' + cur : ''), disabled: ro(), 'data-cell': p.id + ':' + r.id, 'aria-label': (r.n || 'Unnamed') + ', ' + (p.n || 'task') + ': ' + NAME[cur], text: cur, onclick: function () {
          var nx = CYC[(CYC.indexOf(cur) + 1) % CYC.length];
          save(upd('processes', p.id, function (x) { var s = Object.assign({}, x.skill || {}); s[r.id] = nx; return { skill: s }; })).then(X.render);
        } })]);
      })).concat([el('td', { class: 'fxmuted sm wkmxn', text: stand.length ? stand.join(', ') : 'None named' })]));
    });
    var sec = card([el('div', { class: 'wklegend' }, [el('span', {}, [el('span', { class: 'wkk kD', text: 'D' }), document.createTextNode('Does it now')]), el('span', {}, [el('span', { class: 'wkk kS', text: 'S' }), document.createTextNode('Could stand in')]), el('span', {}, [el('span', { class: 'wkk kA', text: 'A' }), document.createTextNode('Has the authority or access')]), el('span', { class: 'fxmuted', text: 'Press a cell to move through these.' })]),
      el('div', { class: 'skscroll' }, [el('table', { class: 'wkmxtab', id: 'wkSkills' }, [el('thead', {}, [el('tr', {}, [el('th', { class: 'wkmxt', text: 'Task' })].concat(shown.map(function (r) { return el('th', { text: r.n || 'Unnamed' }); })).concat([el('th', { text: 'Stand-ins' })]))]), el('tbody', {}, rows)])]),
      hidden ? el('p', { class: 'fxmuted sm' }, [document.createTextNode(hidden + (hidden === 1 ? ' person' : ' people') + ' hidden: no packages and nothing marked. '), el('button', { type: 'button', class: 'btn sm', text: 'Show everyone', onclick: function () { ST.all = true; X.render(); } })]) : null,
      el('label', { class: 'wkf wkevrow' }, [el('span', { text: 'How good is the evidence for this grid?' }), evSel(w.skillLv, wset(['skillLv']))])]);
    host.appendChild(sec);
    var finds = [];
    ps.forEach(function (p) { var can = ppl.filter(function (r) { var s = skillOf(p, r.id); return s === 'D' || s === 'S'; }); if (can.length <= 1) finds.push((p.n || 'A task') + ': ' + (can.length ? 'only ' + can[0].n + ' can do it' : 'nobody is marked as able to do it')); });
    var noCover = ppl.filter(function (r) { return !has(r.cover); }).length;
    if (noCover) finds.push(noCover + ' of ' + ppl.length + ' people have nobody named to cover them.');
    host.appendChild(el('div', { class: 'wkfinds', id: 'wkSkillFinds' }, finds.map(function (t) { return el('div', { class: 'wkfind' }, [el('b', { text: 'To find out' }), el('span', { text: t })]); })));
  }

  // 11 Stocks over time: what fills and drains each stock, and the level it cannot fall below
  function overtime(host, v) {
    var w = W(v), ppl = people(v), nonP = v.resources.filter(function (r) { return r.t !== 'people'; });
    host.appendChild(lede('Work can keep going out on time while what carries it runs down. This is how drift happens. For each stock, say what fills it, what drains it, how fast, and the level below which the service cannot work.'));
    host.appendChild(card([el('div', { class: 'wktwo' }, [el('div', { html: '<svg viewBox="0 0 520 200" width="100%" role="img" aria-label="Illustration: work done on time stays level while a stock falls towards the level the service needs"><g stroke="currentColor" stroke-opacity=".2"><line x1="40" y1="20" x2="40" y2="170"/><line x1="40" y1="170" x2="510" y2="170"/></g><line x1="40" y1="140" x2="510" y2="140" stroke="#c4502c" stroke-dasharray="6 5" stroke-width="2"/><path d="M40,52 L120,52 L200,53 L280,52 L360,54 L440,52 L510,53" fill="none" stroke="#2f7d52" stroke-width="3"/><path d="M40,60 L120,72 L200,80 L280,96 L360,108 L440,124 L510,136" fill="none" stroke="#e07030" stroke-width="3"/><g font-size="12" fill="currentColor" fill-opacity=".6"><text x="44" y="190">Then</text><text x="480" y="190">Now</text></g></svg>' }),
      el('div', { class: 'fxmuted sm' }, [el('p', { text: 'An illustration, not data.' }), el('p', {}, [el('span', { class: 'wksw', style: 'background:#2f7d52' }), document.createTextNode('Work done on time')]), el('p', {}, [el('span', { class: 'wksw', style: 'background:#e07030' }), document.createTextNode('The stock')]), el('p', {}, [el('span', { class: 'wksw', style: 'background:#c4502c' }), document.createTextNode('The level the service needs')])])])]));
    var rows = [];
    var row = function (name, sub, o, on, key) { return el('tr', { 'data-flow': key }, [el('td', {}, [el('div', { text: name }), el('div', { class: 'fxmuted sm', text: sub })]), el('td', {}, [inp(o.fills, on('fills'), key === 'people' ? 'Recruitment, training, rest' : 'Upgrades, updates, funding', 'Fills it')]), el('td', {}, [inp(o.drains, on('drains'), key === 'people' ? 'Leaving, sickness, tiredness' : 'Age, wear, changes not made', 'Drains it')]), el('td', {}, [inp(o.rate, on('rate'), 'For example per term', 'How fast')]), el('td', {}, [inp(o.floor, on('floor'), key === 'people' ? 'For example 9 people' : 'The least it can work with', 'The level it cannot fall below')]), el('td', {}, [evSel(key === 'people' ? o.lv : o.flv, on(key === 'people' ? 'lv' : 'flv'))])]); };
    if (ppl.length) rows.push(row('People', ppl.length + ' in the stocks', w.pflow, function (f) { return wset(['pflow', f]); }, 'people'));
    nonP.forEach(function (r) { rows.push(row(r.n || 'Unnamed', lab(CAPS, r.cap || CAP_OF[r.t]) || '', r, function (f) { return field('resources', r.id, f); }, r.id)); });
    host.appendChild(card([h2('What fills and drains each stock'), rows.length ? table(['Stock', 'Fills it', 'Drains it', 'How fast', 'The level it cannot fall below', 'Evidence'], rows, 'wkflow') : el('p', { class: 'fxmuted', text: 'Add stocks under 1 By capital first.' }), el('p', { class: 'fxmuted sm', text: 'A level a stock cannot fall below becomes a threshold in 1.3, alongside the time limits.' })]));
  }

  // 8 The task list: one task at a time, in full
  function processes(host, v) {
    var w = W(v), ppl = people(v), ps = v.processes;
    if (!ps.some(function (p) { return p.id === ST.task; })) ST.task = ps.length ? ps[0].id : null;
    var side = el('nav', { class: 'wkside', 'aria-label': 'Tasks' }, [el('div', { class: 'fxmuted sm', text: '8 The task list' })].concat(ps.map(function (p) {
      var d = w.drivers.filter(function (x) { return x.id === p.trigger; })[0];
      return el('button', { type: 'button', class: 'wkst' + (p.id === ST.task ? ' on' : ''), 'data-task': p.id, 'aria-pressed': String(p.id === ST.task), onclick: function () { ST.task = p.id; X.render(); } }, [el('span', { text: p.n || 'Unnamed task' }), el('span', { class: 'fxmuted sm', text: d ? 'From ' + (d.n || 'a driver').toLowerCase() : 'Trigger not said' })]);
    })).concat(ro() ? [] : [el('button', { class: 'btn sm', type: 'button', id: 'wkAddTask', text: 'Add a task', onclick: function () { save(function (vv) { var L2 = vv.processes, id = X.nid('p', L2); L2.push({ id: id, n: '', step: 'diagnose' }); ST.task = id; }).then(X.render); } })]));
    var mainc = el('div', { class: 'wkmain' });
    host.appendChild(el('div', { class: 'wkpro' }, [side, mainc]));
    var p = ps.filter(function (x) { return x.id === ST.task; })[0];
    if (!p) { mainc.appendChild(card([el('p', { class: 'fxmuted', text: 'No tasks yet. Each driver or event creates tasks: add the first one.' })])); return; }
    var cell = function (label, node) { return el('label', { class: 'wkf' }, [el('span', { text: label }), node]); };
    mainc.appendChild(el('div', { class: 'fxqhead wkthead', 'data-proc': p.id }, [inp(p.n, field('processes', p.id, 'n', true), 'Task', 'Task name', 'wkname'), el('span', { class: 'fxgrow' }), evSel(p.lv, field('processes', p.id, 'lv')), stepSel(p.step, field('processes', p.id, 'step'))]));
    mainc.appendChild(el('p', { class: 'fxmuted sm', text: 'One task, in full. Fill what you know; the rest stays as a question.' }));
    var grid = el('div', { class: 'wkgrid' });
    grid.appendChild(cell('What triggers it', sel([['', 'Not said']].concat(w.drivers.map(function (d) { return [d.id, d.n || 'Unnamed driver']; })), p.trigger, field('processes', p.id, 'trigger', true), 'What triggers it')));
    grid.appendChild(cell('Who does it', sel([['', 'Not said']].concat(ppl.map(function (r) { return [r.id, r.n || 'Unnamed']; })), p.who, field('processes', p.id, 'who'), 'Who does it')));
    grid.appendChild(cell('Who owns it', inp(p.owner, field('processes', p.id, 'owner'), 'Who owns it', 'Who owns it')));
    grid.appendChild(cell('Who depends on its output', inp(p.output, field('processes', p.id, 'output'), 'For example students, module leaders', 'Who depends on its output')));
    grid.appendChild(cell('Work each time', inp(p.effort, field('processes', p.id, 'effort'), 'Points, or minutes', 'Work each time')));
    grid.appendChild(cell('How often, and when last done', inp(p.often, field('processes', p.id, 'often'), 'For example each term; last done in October', 'How often')));
    mainc.appendChild(card([h2('The basics'), grid, el('p', { class: 'fxmuted sm' }, [document.createTextNode('When it must be done by: '), screenLink(6, '6 Time limits'), document.createTextNode('. Who else can do it: '), screenLink(7, '7 Who can do what'), document.createTextNode('.')])]));
    // what it needs, from the stocks
    var nd = el('div', { class: 'wkneeds' });
    var nonP = v.resources.filter(function (r) { return r.t !== 'people'; });
    nonP.forEach(function (r) { var on = (r.u || []).indexOf(p.id) >= 0, cb = el('input', { type: 'checkbox', disabled: ro() }); cb.checked = on; cb.addEventListener('change', function () { save(function (vv) { var rr = vv.resources.filter(function (y) { return y.id === r.id; })[0]; if (!rr) return; rr.u = (rr.u || []).filter(function (z) { return z !== p.id; }); if (cb.checked) rr.u.push(p.id); }); }); nd.appendChild(el('label', { class: 'wkchip' + (on ? ' on' : '') }, [cb, el('span', { text: r.n || 'Unnamed' })])); });
    if (!nonP.length) nd.appendChild(el('span', { class: 'fxmuted sm', text: 'Add systems, information or kit under 1 By capital first.' }));
    mainc.appendChild(card([h2('What it needs, from the stocks'), nd]));
    // the steps
    var steps = stepsOf(p);
    var putSteps = function (fn) { return save(upd('processes', p.id, function (x) { var s = stepsOf(x).map(function (y) { return Object.assign({}, y); }); fn(s); return { stepList: s, steps: s.map(function (y) { return y.t; }).filter(Boolean).join('; ') }; })); };
    var srow = function (s, i) { var on = function (f) { return function (val) { putSteps(function (a) { a[i][f] = val; }); }; }; return el('div', { class: 'wkstep', 'data-step': String(i) }, [el('span', { class: 'wkno', text: String(i + 1) }), inp(s.t, on('t'), i ? 'Then' : 'What happens first', 'Step ' + (i + 1)), inp(s.who, on('who'), 'Role', 'Step ' + (i + 1) + ', who does it'), inp(s.to, on('to'), i === steps.length - 1 ? (p.output || 'Role') : 'The next step', 'Step ' + (i + 1) + ', handed to'), ro() ? el('span') : el('button', { type: 'button', class: 'btn sm', text: 'Remove', 'aria-label': 'Remove step ' + (i + 1), onclick: function () { putSteps(function (a) { a.splice(i, 1); }).then(X.render); } })]); };
    mainc.appendChild(card([el('div', { class: 'fxqhead' }, [h2('The steps'), el('span', { class: 'fxgrow' }), el('span', { class: 'fxmuted sm', text: 'Who does each, and who it goes to next' })]), el('div', { class: 'wksteps', id: 'wkSteps' }, [el('div', { class: 'wkstep wksh' }, [el('span'), el('span', { text: 'Step' }), el('span', { text: 'Who does it' }), el('span', { text: 'Handed to' }), el('span')])].concat(steps.map(srow))), ro() ? null : el('button', { type: 'button', class: 'btn sm', id: 'wkAddStep', text: 'Add a step', onclick: function () { putSteps(function (a) { a.push({ t: '', who: '', to: '' }); }).then(X.render); } })]));
    // the six things that matter when it goes wrong
    mainc.appendChild(h2('Six things that matter when it goes wrong'));
    mainc.appendChild(el('div', { class: 'wksix' }, SIX.map(function (f) {
      var kids = [el('h3', { text: f[1] }), el('p', { class: 'fxmuted sm', text: f[2] })];
      if (f[0] === 'roundway') kids.push(el('div', { class: 'wkrw' }, [inp(p[f[0]], field('processes', p.id, f[0]), f[3], f[1]), evSel(p.roundLv, field('processes', p.id, 'roundLv'), 'How much the degraded way can handle: evidence')]));
      else kids.push(inp(p[f[0]], field('processes', p.id, f[0]), f[3], f[1]));
      kids.push(el('div', { class: 'wkfeed', text: 'Feeds: ' + f[4] }));
      return el('div', { class: 'fxcard wks6', 'data-six': f[0] }, kids);
    })));
    mainc.appendChild(el('div', { class: 'wkfoot' }, [el('span', { class: 'fxmuted sm', text: 'Tasks become the boxes on the process map in 3.1.' }), el('span', { class: 'fxgrow' }), ro() ? null : el('button', { class: 'btn sm', type: 'button', text: 'Remove task', onclick: del('processes', p.id) })]));
  }

  // 2 Drivers: what creates the work
  function drivers(host, v) {
    var w = W(v);
    host.appendChild(lede('Name each thing that creates work, then say which kind it is. The weight is how much work one of it brings, in points to start; it can be turned into hours later.'));
    host.appendChild(el('div', { class: 'wkkinds' }, [['Volume', 'Things that come through. Work grows with the number: students, cases, patients, orders.'], ['Container', 'Things that carry their own work whatever their size: courses, modules, contracts, sites.'], ['Event', 'Things that happen at set times: intakes, exam boards, audits, inspections.']].map(function (k) { return el('div', { class: 'fxcard wkkind' }, [el('b', { text: k[0] }), el('p', { class: 'fxmuted sm', text: k[1] })]); })));
    var rows = w.drivers.map(function (d) {
      var ms = whenOf(d, 'month'), wn = ms.map(function (x, i) { return x ? MONTHS[i] : null; }).filter(Boolean);
      return el('tr', { 'data-drv': d.id }, [el('td', {}, [inp(d.n, field('drivers', d.id, 'n'), 'Driver', 'Driver name')]), el('td', {}, [sel(KIND, d.kind, field('drivers', d.id, 'kind'), 'Kind')]), el('td', {}, [inp(d.w, field('drivers', d.id, 'w', true), '1', 'Weight', 'wkn')]), el('td', { class: 'wkload', text: fmt(driverTotal(w, d)) }), el('td', {}, [el('a', { href: '#thework', class: 'wkgo', text: wn.length ? wn.join(', ') : 'Not given', onclick: goto('time', 'scale') })]), el('td', {}, [evSel(d.lv, field('drivers', d.id, 'lv'))]), el('td', {}, [inp(d.note, field('drivers', d.id, 'note'), 'Where the weight comes from', 'Note')]), el('td', {}, ro() ? [] : [el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: del('drivers', d.id) })])]);
    });
    host.appendChild(card([table(['Driver', 'Kind', 'Weight', 'Count', 'When it falls', 'Evidence', 'Where the weight comes from', ''], rows), ro() ? null : el('button', { class: 'btn sm', type: 'button', text: 'Add a driver', onclick: add('drivers', 'd', { n: '', kind: 'volume', w: 1 }) }), el('p', { class: 'fxmuted sm', text: 'The count is added up from the packages. A weight above 1 that nothing explains stays at level 1, said, until someone can say where it comes from.' })]));
  }

  // 3 What makes some work heavier
  function heavier(host, v) {
    var w = W(v);
    host.appendChild(lede('Two kinds. A variant is a kind of unit that costs more than the usual one: give it its own driver with a higher weight. A complication is a condition on a package that adds a fixed amount, whatever its size.'));
    var variants = w.drivers.filter(function (d) { return num(d.w) > 1; });
    host.appendChild(card([h2('Variants'), el('p', { class: 'fxmuted sm', text: 'Set on the driver, as its weight.' }), variants.length ? el('div', {}, variants.map(function (d) { return el('div', { class: 'wkli' }, [el('span', { text: d.n || 'Unnamed' }), el('span', { class: 'fxgrow' }), lvTag(d.lv), el('b', { class: 'wkw', text: String(d.w) })]); })) : el('p', { class: 'fxmuted', text: 'None yet: a driver with a weight above 1 shows here.' }), el('a', { href: '#thework', class: 'wkgo', text: 'Change weights under 2 Drivers', onclick: goto('load', 'drivers') })]));
    var rows = w.mods.map(function (m) { return el('tr', { 'data-mod': m.id }, [el('td', {}, [inp(m.n, field('mods', m.id, 'n'), 'Modifier', 'Modifier')]), el('td', {}, [sel(MKIND, m.kind, field('mods', m.id, 'kind'), 'Kind')]), el('td', {}, [inp(m.w, field('mods', m.id, 'w'), 'e.g. 0.5', 'Adds', 'wkn')]), el('td', {}, [inp(m.per, field('mods', m.id, 'per'), 'per course, per cohort', 'Per')]), el('td', {}, [evSel(m.lv, field('mods', m.id, 'lv'))]), el('td', {}, ro() ? [] : [el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: del('mods', m.id) })])]); });
    host.appendChild(card([el('div', { class: 'fxqhead' }, [h2('Complications'), el('span', { class: 'fxgrow' }), el('label', { class: 'wkf wkcw' }, [el('span', { text: 'Each point of complication counts as' }), inp(w.cw, function (val) { save(function (vv) { W(vv).cw = num(val); }).then(X.render); }, '1', 'Complication weight', 'wkn')])]), el('p', { class: 'fxmuted sm', text: 'Ticked on each package as points; the points are multiplied by the complication weight.' }), table(['Modifier', 'Kind', 'Adds', 'Per', 'Evidence', ''], rows), ro() ? null : el('button', { class: 'btn sm', type: 'button', text: 'Add a modifier', onclick: add('mods', 'm', { n: '', kind: 'complication', w: 0.5 }) })]));
  }

  // 4 Packages: the bundles the work is organised by, with a count for each driver
  function packages(host, v, L) {
    var w = W(v), ppl = people(v);
    host.appendChild(lede('A package is the bundle work is allocated by, each with one owner. Type a count for each driver; the load adds itself up, with the complication points at the complication weight (' + w.cw + ').'));
    var hd = ['Package', 'Allocated to'].concat(w.drivers.map(function (d) { return d.n || 'Driver'; })).concat(['Complication points', 'Load', '']);
    var rows = w.packages.map(function (p) {
      var ow = ppl.filter(function (r) { return r.id === p.owner; })[0], hi = ow ? num(ow.bandHi) : 0;
      return el('tr', { 'data-pkg': p.id }, [el('td', {}, [inp(p.n, field('packages', p.id, 'n'), 'Package', 'Package')]), el('td', {}, [sel([['', 'Nobody']].concat(ppl.map(function (r) { return [r.id, r.n || 'Unnamed']; })), p.owner, function (val) { save(upd('packages', p.id, { owner: val })).then(X.render); }, 'Allocated to')])]
        .concat(w.drivers.map(function (d) { return el('td', {}, [inp((p.counts || {})[d.id], function (val) { save(upd('packages', p.id, function (x) { var c = Object.assign({}, x.counts || {}); c[d.id] = val; return { counts: c }; })).then(X.render); }, '0', d.n + ' count', 'wkn')]); }))
        .concat([el('td', {}, [inp(p.comp, function (val) { save(upd('packages', p.id, { comp: val })).then(X.render); }, '0', 'Complication points', 'wkn')]), el('td', { class: 'wkload' + (hi && (p._load || 0) > hi ? ' over' : ''), text: fmt(p._load || 0) }), el('td', {}, ro() ? [] : [el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: del('packages', p.id) })])]));
    });
    var foot = el('tr', { class: 'wkwt' }, [el('td', { text: 'Weight' }), el('td')].concat(w.drivers.map(function (d) { return el('td', { text: String(d.w == null ? 1 : d.w) }); })).concat([el('td', { text: String(w.cw) }), el('td'), el('td')]));
    host.appendChild(card([table(hd, rows.concat([foot]), 'wkpk'), ro() ? null : el('button', { class: 'btn sm', type: 'button', text: 'Add a package', onclick: add('packages', 'k', { n: '', counts: {} }) }), el('p', { class: 'fxmuted sm', text: 'Highlighted: a single package above the top of its owner’s band. Totals per person are under What it shows.' }), el('label', { class: 'wkf wkevrow' }, [el('span', { text: 'How good is the evidence for the counts?' }), evSel(w.pkgLv, wset(['pkgLv']))])]));
  }

  // 5 Time at the right scale
  function timeScale(host, v) {
    var w = W(v), sc = SCALES.filter(function (s) { return s[0] === ST.scale; })[0] || SCALES[0], labels = sc[2];
    host.appendChild(lede('A year’s total can hide a month that breaks. Say when work arrives and when people are there, at the scale that matters: by month for a teaching year, by hour for a control room, by day for a post round.'));
    host.appendChild(el('div', { class: 'seg wkscale', role: 'group', 'aria-label': 'Scale' }, SCALES.map(function (s) { return el('button', { type: 'button', 'data-scale': s[0], 'aria-pressed': String(s[0] === sc[0]), text: s[1], onclick: function () { ST.scale = s[0]; X.render(); } }); })));
    var WNAME = ['not known', 'some work arrives', 'peak'], PNAME = ['not known', 'most people there', 'fewer there'];
    var grid = el('div', { class: 'wktg', id: 'wkTime', style: 'grid-template-columns:200px repeat(' + labels.length + ',minmax(' + (labels.length > 12 ? 30 : 44) + 'px,1fr))' }, [el('div')].concat(labels.map(function (m) { return el('div', { class: 'wkth', text: m }); })));
    w.drivers.forEach(function (d) {
      var a = whenOf(d, sc[0]);
      grid.appendChild(el('div', { class: 'wktn' }, [el('span', { text: d.n || 'Unnamed' }), el('span', { class: 'fxmuted sm', text: lab(KIND, d.kind).split(':')[0] + ', ' + fmt(driverTotal(w, d)) })]));
      a.forEach(function (x, i) { grid.appendChild(el('button', { type: 'button', class: 'wkc a' + x, disabled: ro(), 'data-cell': d.id + ':' + i, 'aria-label': (d.n || 'Driver') + ', ' + labels[i] + ': ' + WNAME[x], onclick: function () { var nx = (x + 1) % 3; save(upd('drivers', d.id, function (dd) { var arr = whenOf(dd, sc[0]); arr[i] = nx; var wh = Object.assign({}, dd.when || {}); wh[sc[0]] = arr; var o = { when: wh }; if (sc[0] === 'month') o.months = arr.map(function (y, j) { return y ? j : -1; }).filter(function (j) { return j >= 0; }); return o; })).then(X.render); } })); });
    });
    var pr = presOf(w, sc[0]);
    grid.appendChild(el('div', { class: 'wktn' }, [el('span', { text: 'People there' }), el('span', { class: 'fxmuted sm', text: people(v).length + ' in the stocks' })]));
    pr.forEach(function (x, i) { grid.appendChild(el('button', { type: 'button', class: 'wkc p' + x, disabled: ro(), 'data-cell': 'people:' + i, 'aria-label': 'People there, ' + labels[i] + ': ' + PNAME[x], onclick: function () { save(function (vv) { var ww = W(vv), arr = presOf(ww, sc[0]); arr[i] = (x + 1) % 3; ww.presence[sc[0]] = arr; }).then(X.render); } })); });
    host.appendChild(card([el('div', { class: 'skscroll' }, [grid]), el('div', { class: 'wklegend' }, [el('span', {}, [el('span', { class: 'wksq a1' }), document.createTextNode('Some work arrives')]), el('span', {}, [el('span', { class: 'wksq a2' }), document.createTextNode('Peak')]), el('span', {}, [el('span', { class: 'wksq p1' }), document.createTextNode('Most people there')]), el('span', {}, [el('span', { class: 'wksq p2' }), document.createTextNode('Fewer there: leave, sickness, vacancies')]), el('span', {}, [el('span', { class: 'wksq a0' }), document.createTextNode('Not yet known')])]), el('p', { class: 'fxmuted sm', text: 'Press a cell to mark it; press again to change or clear it.' }), el('label', { class: 'wkf wkevrow' }, [el('span', { text: 'How good is the evidence for when the work falls?' }), evSel(w.timeLv, wset(['timeLv']))])]));
    var u = sc[0] === 'month' ? 'months' : sc[0] === 'day' ? 'days' : 'hours', u1 = sc[0] === 'month' ? 'month' : sc[0] === 'day' ? 'day' : 'hour';
    host.appendChild(card([h2('Questions that fill this in'), el('div', { class: 'wkqs' }, ['Which ' + u + ' does each driver fall in, and how much in each?', 'When are the set events (boards, audits, inspections, peaks), and who prepares for them?', 'When are most people away, and is any ' + u1 + ' closed to leave?', 'Which ' + u1 + ' was the hardest last year, and what made it so?'].map(function (t) { return el('div', { class: 'wkq', text: t }); }))]));
  }

  // 6 Time limits
  function limits(host, v) {
    host.appendChild(lede('How quickly each piece of work must be done, and what happens if it is late. This is where load meets the thresholds: a limit that matters to someone outside becomes a threshold in 1.3.'));
    if (!v.processes.length) { host.appendChild(card([el('p', { class: 'fxmuted', text: 'Add tasks under Processes first.' })])); return; }
    var cell = function (label, node, hint) { return el('label', { class: 'wkf' }, [el('span', { text: label }), node, hint ? el('em', { class: 'fxmuted sm', text: hint }) : null]); };
    v.processes.forEach(function (p) {
      var g = el('div', { class: 'wkgrid wkg3' }, [
        cell('Must be done by', inp(p.limit, field('processes', p.id, 'limit'), 'For example before teaching starts', 'Must be done by'), 'A time from when the work arrives, or a fixed date'),
        cell('How long, at most', inp(p.limitMax, field('processes', p.id, 'limitMax'), 'For example 10 working days', 'How long, at most')),
        cell('How many can be late before it matters', inp(p.lateOk, field('processes', p.id, 'lateOk'), 'For example none, or 1 in 20', 'How many can be late before it matters')),
        cell('What happens if it is late', inp(p.ifLate, field('processes', p.id, 'ifLate'), 'Who is affected, and how', 'What happens if it is late')),
        cell('Who feels it first', inp(p.feels, field('processes', p.id, 'feels'), p.output || 'Who depends on it', 'Who feels it first')),
        cell('How good is the evidence?', evSel(p.limitLv, field('processes', p.id, 'limitLv')))
      ]);
      var prop = p.thr === 'proposed';
      host.appendChild(card([el('div', { class: 'fxqhead' }, [h2(p.n || 'Unnamed task'), el('span', { class: 'fxgrow' }), prop ? el('span', { class: 'fxtag', text: 'Proposed as a threshold' }) : null]), g,
        el('div', { class: 'wkthr' }, [el('span', { text: prop ? 'Proposed as a threshold. Agree its wording and figure in 1.3.' : 'If this limit affects people outside the team, it is a threshold.' }), el('span', { class: 'fxgrow' }), ro() ? null : el('button', { type: 'button', class: 'btn sm', 'data-propose': p.id, text: prop ? 'Withdraw' : 'Propose as a threshold', onclick: function () { save(upd('processes', p.id, { thr: prop ? '' : 'proposed' })).then(X.render); } }), el('a', { href: '/frame' + (X.EXAMPLE ? location.search : '') + '#line', text: 'Open 1.3 Thresholds' })])], { 'data-limit': p.id }));
    });
  }

  // 9 Flow and handovers
  function flowsHo(host, v) {
    var w = W(v), ps = v.processes;
    host.appendChild(lede('Follow the work from where it starts to who receives it. At every step someone must own it. A step with no owner, or a handover nobody confirms, is a finding.'));
    if (!ps.length) { host.appendChild(card([el('p', { class: 'fxmuted', text: 'Add tasks under Processes first.' })])); return; }
    if (!ps.some(function (p) { return p.id === ST.lane; })) ST.lane = ps[0].id;
    var p = ps.filter(function (x) { return x.id === ST.lane; })[0], hs = handovers(v, p);
    // the lane picture: one row per person or role, one column per step, and the receiver at the end
    var lanes = [];
    var NONE = 'Nobody named';
    hs.forEach(function (h) { var k = h.from || NONE; if (lanes.indexOf(k) < 0) lanes.push(k); });
    var last = hs[hs.length - 1], recv = last.to || NONE;
    if (lanes.indexOf(recv) < 0) lanes.push(recv);
    var ncol = hs.length + 1;
    var lg = el('div', { class: 'wklanes', id: 'wkLanes', style: 'grid-template-columns:170px repeat(' + ncol + ',minmax(130px,1fr))' }, [el('div')].concat(hs.map(function (h, i) { return el('div', { class: 'wkth', text: 'Step ' + (i + 1) }); })).concat([el('div', { class: 'wkth', text: 'Received by' })]));
    lanes.forEach(function (ln) {
      lg.appendChild(el('div', { class: 'wkln' + (ln === NONE ? ' gap' : ''), text: ln }));
      hs.forEach(function (h) { var mine = (h.from || NONE) === ln; lg.appendChild(el('div', { class: 'wkcl' }, mine ? [el('div', { class: 'wkbx' + (h.from ? '' : ' gap'), text: h.step || p.n || 'The task' })] : [])); });
      lg.appendChild(el('div', { class: 'wkcl' }, recv === ln ? [el('div', { class: 'wkbx ' + (last.to ? 'out' : 'gap'), text: last.to ? 'Receives it' : 'No receiver named' })] : []));
    });
    host.appendChild(card([el('div', { class: 'fxqhead' }, [h2((p.n || 'The task') + ', by who holds the work'), el('span', { class: 'fxgrow' }), sel(ps.map(function (x) { return [x.id, x.n || 'Unnamed task']; }), p.id, function (val) { ST.lane = val; X.render(); }, 'Which task')]), el('div', { class: 'skscroll' }, [lg]), stepsOf(p).length ? null : el('p', { class: 'fxmuted sm' }, [document.createTextNode('No steps yet, so this shows the task as one step. Add steps under '), el('a', { href: '#thework', class: 'wkgo', text: '8 The task list', onclick: function (e) { e.preventDefault(); ST.task = p.id; goto('processes')(); } }), document.createTextNode('.')])]));
    // every handover
    var CONF = [['', 'Not known'], ['yes', 'Yes'], ['no', 'No']];
    var rows = [];
    ps.forEach(function (pp) {
      handovers(v, pp).forEach(function (h) {
        var on = function (f) { return function (val) { save(upd('processes', pp.id, function (x) { if (h.at === 'ho') { var o = Object.assign({}, x.ho || {}); o[f] = val; return { ho: o }; } var s = stepsOf(x).map(function (y) { return Object.assign({}, y); }); if (s[h.at]) s[h.at][f] = val; return { stepList: s }; })).then(X.render); }; };
        var flag = !h.from ? 'Nobody named for this step' : !h.to ? 'No owner for what happens next' : h.obj.conf === 'no' ? 'Not confirmed' : '';
        rows.push(el('tr', { 'data-ho': pp.id + ':' + h.at }, [el('td', { text: (pp.n || 'Unnamed task') + (h.step ? ': ' + h.step : '') }), el('td', { text: h.from || '–' }), el('td', { text: h.to || '–' }), el('td', {}, [inp(h.obj.passes, on('passes'), 'What is handed on', 'What passes')]), el('td', {}, [inp(h.obj.how, on('how'), 'System, email, in person', 'How')]), el('td', {}, [sel(CONF, h.obj.conf || '', on('conf'), 'Does anyone confirm it arrived?')]), el('td', { class: flag ? 'wkflag' : 'fxmuted', text: flag || 'None' })]));
      });
    });
    host.appendChild(card([h2('Every handover'), table(['Task', 'From', 'To', 'What passes', 'How', 'Does anyone confirm it arrived?', 'Finding'], rows, 'wkho'), el('label', { class: 'wkf wkevrow' }, [el('span', { text: 'How good is the evidence for these handovers?' }), evSel(w.hoLv, wset(['hoLv']))])]));
  }

  // 10 Errors and failure demand
  function errors(host, v, L) {
    var w = W(v), ppl = people(v), his = ppl.map(function (r) { return num(r.bandHi); }).filter(Boolean);
    var same = his.length && his.every(function (h) { return h === his[0]; }) ? his[0] : 0;
    var overN = ppl.filter(function (r) { var l = (L[r.id] || {}).load || 0; return num(r.bandHi) && l > num(r.bandHi); }).length;
    host.appendChild(lede('Past the band, people make more mistakes, and each mistake makes more work: putting it right, answering the chase, handling the complaint. That extra work pushes load higher still. Capture how fast this happens.'));
    var loop = el('div', { html: '<svg viewBox="0 0 400 300" width="100%" role="img" aria-label="A loop: load above the band leads to more errors, errors create failure demand, failure demand adds to load"><defs><marker id="wkar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#e07030"/></marker></defs><g font-size="14" fill="currentColor" text-anchor="middle"><rect x="130" y="16" width="140" height="46" rx="8" fill="none" stroke="#e07030"/><text x="200" y="44">Load above the band</text><rect x="262" y="128" width="128" height="46" rx="8" fill="none" stroke="#e07030"/><text x="326" y="156">More errors</text><rect x="130" y="236" width="140" height="46" rx="8" fill="none" stroke="#e07030"/><text x="200" y="264">Failure demand</text><rect x="10" y="128" width="128" height="46" rx="8" fill="none" stroke="#e07030"/><text x="74" y="156">More work</text></g><g fill="none" stroke="#e07030" stroke-width="2" marker-end="url(#wkar)"><path d="M262,48 Q320,60 326,124"/><path d="M326,178 Q320,240 274,256"/><path d="M130,256 Q80,240 74,178"/><path d="M74,124 Q80,60 126,46"/></g><text x="200" y="160" font-size="22" fill="#e07030" text-anchor="middle">+</text></svg>' });
    var BANDS = same ? ['Within the band, up to ' + fmt(same), 'Up to a fifth over, to ' + fmt(same * 1.2), 'Up to half over, to ' + fmt(same * 1.5), 'More than half over'] : ['Within the band', 'Up to a fifth over the top of the band', 'Up to half over', 'More than half over'];
    var rates = BANDS.map(function (b, i) { return el('tr', {}, [el('td', { text: b }), el('td', {}, [inp(w.err.rates[i], function (val) { save(function (vv) { var e = W(vv).err; e.rates = e.rates.slice(); while (e.rates.length < 4) e.rates.push(''); e.rates[i] = val; }); }, i ? '' : 'For example 1', 'Errors in each 100 items: ' + b, 'wkrate')])]); });
    host.appendChild(el('div', { class: 'wktwo' }, [card([h2('The loop'), loop, el('p', { class: 'fxmuted sm', text: 'A reinforcing loop: each turn makes the next one worse, until something breaks it.' })]),
      card([h2('How errors rise past the band'), table(['Load', 'Errors in each 100 items'], rates, 'wkerr'), el('p', { class: 'fxmuted sm', text: 'Where to look: rework logs, complaints, queries, audit findings.' + (overN ? ' ' + overN + (overN === 1 ? ' person is' : ' people are') + ' above the band now, so this can be checked.' : '') }), el('label', { class: 'wkf wkevrow' }, [el('span', { text: 'How good is the evidence?' }), evSel(w.err.lv, wset(['err', 'lv']))])])]));
    var krow = EKINDS.map(function (k) { var o = w.err.kinds[k[0]] || {}, on = function (f) { return wset(['err', 'kinds', k[0], f]); }; return el('tr', { 'data-ek': k[0] }, [el('td', { text: k[1] }), el('td', {}, [inp(o.work, on('work'), 'Points or minutes', k[1] + ': work each time')]), el('td', {}, [inp(o.who, on('who'), 'Role', k[1] + ': who does it')]), el('td', {}, [sel([['', 'Not known'], ['yes', 'Yes'], ['no', 'No']], o.same || '', on('same'), k[1] + ': does it come back to the same person?')])]); });
    host.appendChild(card([h2('The work each error creates'), table(['Kind', 'How much work, each time', 'Who does it', 'Does it come back to the same person?'], krow, 'wkek')]));
  }

  // 12 What it shows: worked out from the screens before it
  function shows(host, v, L) {
    var w = W(v), ppl = people(v);
    host.appendChild(lede('Read only. This is worked out from the screens before it, and changes as they fill in.'));
    var withBand = ppl.filter(function (r) { return num(r.bandHi); });
    var over = withBand.filter(function (r) { return ((L[r.id] || {}).load || 0) > num(r.bandHi); });
    var top = withBand.slice().sort(function (a, b) { return ((L[b.id] || {}).load || 0) / num(b.bandHi) - ((L[a.id] || {}).load || 0) / num(a.bandHi); })[0];
    var topX = top ? ((L[top.id] || {}).load || 0) / num(top.bandHi) : 0;
    var low = withBand.filter(function (r) { return ((L[r.id] || {}).load || 0) < 0.1 * num(r.bandLo || r.bandHi); });
    var cover = ppl.filter(function (r) { return has(r.cover); }).length;
    if (ppl.length) host.appendChild(el('div', { class: 'wkstats', id: 'wkStats' }, [
      [over.length + ' of ' + withBand.length, 'people above the top of their band'],
      [topX > 1 ? (Math.round(topX * 10) / 10) + ' times' : 'None', topX > 1 ? 'the top of the band: the heaviest load, ' + top.n : 'above the band'],
      [String(low.length), 'people with almost no load'],
      [String(cover), 'people with named cover']
    ].map(function (s) { return el('div', { class: 'fxcard wkstat' }, [el('b', { text: s[0] }), el('span', { text: s[1] })]); })));
    // load per person against the band
    var maxL = Math.max.apply(null, [1].concat(ppl.map(function (r) { return Math.max((L[r.id] || {}).load || 0, num(r.bandHi)); })));
    var pLv = meanLv(ppl.map(function (r) { return r.lv; }));
    var lb = card([el('div', { class: 'fxqhead' }, [h2('Load against the manageable band'), el('span', { class: 'fxgrow' }), pLv != null ? el('span', { class: 'fxmuted sm', text: 'Evidence: level ' + pLv + ' of 5, ' + EVL[pLv][1].toLowerCase() }) : null]), el('p', { class: 'fxmuted sm', text: 'Each bar is one person’s load from the packages allocated to them. The shaded part is their manageable band. Above the band is overloaded; below it has room.' })], { id: 'wkLoad' });
    ppl.forEach(function (r) {
      var l = (L[r.id] || {}).load || 0, lo = num(r.bandLo), hi = num(r.bandHi), pc = function (x) { return (100 * x / maxL).toFixed(2) + '%'; };
      lb.appendChild(el('div', { class: 'wkbar', 'data-person': r.id }, [el('span', { class: 'wkbn', text: r.n || 'Unnamed' }), el('span', { class: 'wkbt' }, [hi ? el('span', { class: 'wkband2', style: 'left:' + pc(lo) + ';width:' + pc(Math.max(0, hi - lo)) }) : null, el('span', { class: 'wkbl' + (hi && l > hi ? ' over' : ''), style: 'width:' + pc(l) })]), el('span', { class: 'wkbv', text: fmt(l) + (hi ? (l > hi ? ' · ' + Math.round(100 * l / hi) + '% of the top of the band' : l < lo ? ' · below the band' : ' · within the band') : '') })]));
    });
    if (!ppl.length) lb.appendChild(el('p', { class: 'fxmuted', text: 'No people under Stocks yet.' }));
    host.appendChild(lb);
    // when the work falls
    var mo = MONTHS.map(function () { return 0; });
    w.drivers.forEach(function (d) { var tot = driverTotal(w, d) * num(d.w == null ? 1 : d.w), a = whenOf(d, 'month'), s = a.reduce(function (x, y) { return x + y; }, 0); if (s) a.forEach(function (x, i) { mo[i] += tot * x / s; }); });
    var any = mo.some(function (x) { return x > 0; }), mm = Math.max.apply(null, [1].concat(mo));
    host.appendChild(card([h2('When the work falls'), any ? el('div', { class: 'wkmo' }, mo.map(function (x, i) { return el('span', { class: 'wkmc', title: MONTHS[i] + ': ' + Math.round(x) }, [el('span', { class: 'wkmf', style: 'height:' + Math.round(100 * x / mm) + '%' }), el('b', { text: MONTHS[i][0] })]); })) : el('p', { class: 'fxmuted' }, [document.createTextNode('Not known yet: say which months each driver falls in under '), screenLink(5, '5 Time at the right scale'), document.createTextNode('. An annual total hides the busy weeks.')])], { id: 'wkMonths' }));
    // single points and gaps
    var sp = [];
    ppl.forEach(function (r) { var l = (L[r.id] || {}).load || 0; if (num(r.bandHi) && l > num(r.bandHi) && !has(r.cover)) sp.push(['Single point', (r.n || 'Unnamed') + ': above the band, and nobody named to cover']); });
    v.resources.forEach(function (r) { if (r.t !== 'people' && /^none$/i.test(String(r.alt || '').trim()) && (r.u || []).length) sp.push(['Single point', (r.n || 'Unnamed') + ': ' + (r.u || []).length + (r.u.length === 1 ? ' task depends' : ' tasks depend') + ' on it, with no alternative']); });
    var anySkill = v.processes.some(function (p) { return Object.keys(p.skill || {}).some(function (k) { return p.skill[k]; }); });
    v.processes.forEach(function (p) {
      if (!p.who && !anySkill) sp.push(['Gap', (p.n || 'A task') + ': nobody named to do it']);
      if (anySkill) { var can = ppl.filter(function (r) { var s = skillOf(p, r.id); return s === 'D' || s === 'S'; }); if (can.length <= 1) sp.push(['Single point', (p.n || 'A task') + ': ' + (can.length ? 'only ' + can[0].n + ' can do it' : 'nobody is marked as able to do it')]); }
      handovers(v, p).forEach(function (h) { if (h.from && !h.to) sp.push(['No owner', (p.n || 'A task') + (h.step ? ', ' + h.step : '') + ': nobody named for what happens next']); });
    });
    if (low.length && withBand.length > low.length) sp.push(['Check', low.length + (low.length === 1 ? ' person has' : ' people have') + ' almost no load (' + low.map(function (r) { return r.n; }).join(', ') + '). New, part-time, covering, or work held somewhere else?']);
    var unexplained = w.drivers.filter(function (d) { return num(d.w) > 1 && (d.lv == null || d.lv === '' || Number(d.lv) <= 1); });
    if (unexplained.length) sp.push(['Check', unexplained.length + (unexplained.length === 1 ? ' weight has' : ' weights have') + ' no source: ' + unexplained.map(function (d) { return d.n + ' (' + d.w + ')'; }).join(', ') + '.']);
    host.appendChild(card([h2('Single points and gaps'), sp.length ? el('div', {}, sp.map(function (t) { return el('div', { class: 'wkli' }, [el('span', { class: 'wktag ' + (t[0] === 'Check' ? 'c' : 'f'), text: t[0] }), el('span', { text: t[1] })]); })) : el('p', { class: 'fxmuted', text: 'None found from what is recorded.' })], { id: 'wkSpof' }));
    // what would lift the evidence
    var lift = [];
    if (!any) lift.push(['When the work falls.', ' Months (or days, or hours) for each driver would show whether the heavy loads peak together. ', 5]);
    var noCov = ppl.length - cover; if (noCov) lift.push(['Who covers.', ' ' + noCov + (noCov === 1 ? ' person has' : ' people have') + ' nobody named. One question each. ', 7]);
    if (over.length && !w.err.rates.some(has)) lift.push(['Errors past the band.', ' Rework and queries for the people above the band, against the rest. ', 10]);
    if (withBand.length && (pLv == null || pLv <= 1)) lift.push(['The band itself.', ' Where it came from, and whether the people in it agree with it, would move it beyond said. ', 1]);
    if (v.processes.length && !v.processes.some(function (p) { return stepsOf(p).length; })) lift.push(['The steps.', ' No task has its steps yet, so the handovers cannot be checked. ', 8]);
    host.appendChild(card([h2('What would lift the evidence'), lift.length ? el('div', {}, lift.map(function (t) { return el('div', { class: 'wkli' }, [el('span', {}, [el('b', { text: t[0] }), document.createTextNode(t[1]), screenLink(t[2], 'Screen ' + t[2])])]); })) : el('p', { class: 'fxmuted', text: 'Nothing obvious from what is recorded.' })], { id: 'wkLift' }));
    // dependency grid: tasks against stocks
    var nonP = v.resources.filter(function (r) { return r.t !== 'people'; });
    if (v.processes.length && v.resources.length) {
      var head = el('tr', {}, [el('th', { text: 'Task' }), el('th', { text: 'Who' })].concat(nonP.map(function (r) { return el('th', { class: 'wkvh', title: r.n, text: r.n }); })));
      var body = el('tbody', {}, v.processes.map(function (p) { var who = v.resources.filter(function (r) { return r.id === p.who; })[0]; return el('tr', {}, [el('td', { text: p.n || 'Unnamed' }), el('td', { text: who ? who.n : '–' })].concat(nonP.map(function (r) { return el('td', { class: 'wkdot', text: (r.u || []).indexOf(p.id) >= 0 ? '●' : '' }); }))); }));
      host.appendChild(card([h2('What each task depends on'), el('p', { class: 'fxmuted sm', text: 'Read across for a task’s dependencies; read down for everything that stops if one stock is lost. This is the mapping an important business service needs.' }), el('div', { class: 'skscroll' }, [el('table', { class: 'fxtable wkdeps' }, [el('thead', {}, [head]), body])])], { id: 'wkDeps' }));
    }
    // loops
    var lp = card([h2('Loops'), el('p', { class: 'fxmuted sm', text: 'What feeds back. For example: overload leads to errors, errors create more work, more work deepens the overload.' })], { id: 'wkLoops' });
    w.loops.forEach(function (o) { lp.appendChild(el('div', { class: 'row', style: 'gap:6px;margin:4px 0' }, [inp(o.t, field('loops', o.id, 't'), 'This leads to that, which leads back to this', 'Loop'), evSel(o.lv, field('loops', o.id, 'lv')), ro() ? null : el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: del('loops', o.id) })])); });
    if (!ro()) lp.appendChild(el('button', { class: 'btn sm', type: 'button', text: 'Add a loop', onclick: add('loops', 'l', { t: '' }) }));
    host.appendChild(lp);
    host.appendChild(card([h2('Where this goes next'), el('p', { class: 'fxmuted sm', text: 'Bands and time limits become thresholds in 1.3. The tasks become the process map in 3.1. Load and cover feed the flow model and people model in 3.3, where moving packages between people can be tried before anyone is asked to.' })]));
  }

  function css() {
    if (document.getElementById('wkCss')) return;
    var s = document.createElement('style'); s.id = 'wkCss';
    var A = '#e07030', OK = '#2f7d52', BAD = '#c4502c', RULE = 'color-mix(in srgb,currentColor 16%,transparent)', TINT = 'color-mix(in srgb,currentColor 6%,transparent)';
    s.textContent = '.wk .wksec{margin:0 0 14px}.wk .wksec>h2,.wk .wksec .fxqhead h2{margin:0 0 10px}.wk .wklede{max-width:780px;line-height:1.5}.wktabs{margin:8px 0 12px;flex-wrap:wrap}.wktabs button.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0)}' +
      '.wksubs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.wkpill{font:inherit;font-size:14px;padding:8px 14px;min-height:40px;border-radius:999px;border:1px solid ' + RULE + ';background:none;color:inherit;cursor:pointer}.wkpill.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0);border-color:transparent}' +
      '.wktab{min-width:760px}.wktab td{vertical-align:top}.wktab input[type=text]{width:100%;min-width:90px}.wktab input.wkn{min-width:56px;width:70px}.wktab select{max-width:200px}.wkband{white-space:nowrap}.wkband span{margin:0 4px}.wkload{font-family:"DM Mono",monospace;text-align:right}.wkload.over{color:' + BAD + ';font-weight:700}.wkload.under{opacity:.6}.wkpk{min-width:1100px}.wkwt td{opacity:.7;font-size:13px}.wkerr,.wkek{min-width:0}.wkho{min-width:1000px}' +
      '.wkgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;margin:8px 0}.wkg3{grid-template-columns:repeat(3,minmax(0,1fr))}.wkf{display:flex;flex-direction:column;gap:4px;font-size:13px}.wkf>span{opacity:.8}.wkf input,.wkf select{font:inherit;font-size:14px;width:100%;min-height:40px;box-sizing:border-box}.wkevrow{max-width:420px;margin-top:12px}.wkcw{flex-direction:row;align-items:center;gap:8px}.wkcw input{width:70px}' +
      '.wkname{flex:1 1 320px;font-size:20px;font-weight:600;min-height:44px}.wkthead{gap:8px;flex-wrap:wrap;margin-bottom:4px}.wkneeds{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.wkchip{display:inline-flex;gap:6px;align-items:center;border:1px solid ' + RULE + ';border-radius:999px;padding:6px 12px;font-size:13px;min-height:32px}.wkchip.on{border-color:currentColor;font-weight:600}' +
      '.wkbars{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 16px}.wkbarcard{padding:16px 18px}.wkpb{height:8px;border-radius:99px;background:' + TINT + ';overflow:hidden;margin-top:8px}.wkpb span{display:block;height:100%;background:' + A + '}.wkpb.ev span{background:#c9a24a}' +
      '.wkgroups{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.wkgroup{margin:0}.wkitem{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 0;border-top:1px solid ' + RULE + ';font-size:14px;color:inherit;text-decoration:none;min-height:24px}.wkitem:hover{text-decoration:underline}.wknum{display:inline-block;min-width:26px;opacity:.6}' +
      '.wklv{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid currentColor;white-space:nowrap}.wkl0{color:' + BAD + '}.wkl1,.wkl2{color:#a2701e}.wkl3{color:#7a7a1e}.wkl4,.wkl5{color:' + OK + '}.wkl-n{opacity:.6}' +
      '.wkfeeds{display:flex;flex-wrap:wrap;gap:8px}.wkchip2{font-size:13px;padding:5px 10px;border-radius:99px;background:' + TINT + '}.wkgo{color:inherit;text-underline-offset:2px}' +
      '.wkkinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:0 0 14px}.wkkind{padding:14px 16px}.wkkind p{margin:6px 0 0}.wkli{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid ' + RULE + ';font-size:14px;line-height:1.45}.wkw{font-family:"DM Mono",monospace;min-width:44px;text-align:right}' +
      '.wktag{font-size:12px;padding:2px 8px;border-radius:99px;white-space:nowrap}.wktag.f{background:color-mix(in srgb,' + BAD + ' 15%,transparent);color:' + BAD + '}.wktag.c{background:color-mix(in srgb,#c9a24a 18%,transparent);color:#a2701e}' +
      '.wkscale{margin:0 0 14px;flex-wrap:wrap}.wktg{display:grid;gap:4px;min-width:820px;font-size:13px}.wkth{text-align:center;opacity:.65;font-size:12px;padding:4px 0}.wktn{display:flex;flex-direction:column;border:0;padding:6px 8px 6px 0;font-size:14px}' +
      '.wkc{min-height:40px;border-radius:5px;border:1px dashed ' + RULE + ';background:' + TINT + ';cursor:pointer;padding:0}.wkc.a1{background:color-mix(in srgb,' + A + ' 35%,transparent);border-style:solid;border-color:transparent}.wkc.a2{background:color-mix(in srgb,' + A + ' 75%,transparent);border-style:solid;border-color:transparent}.wkc.p1{background:color-mix(in srgb,' + OK + ' 65%,transparent);border-style:solid;border-color:transparent}.wkc.p2{background:color-mix(in srgb,' + OK + ' 28%,transparent);border-style:solid;border-color:transparent}' +
      '.wklegend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:12px 0 4px;align-items:center}.wksq{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:6px}.wksq.a0{border:1px dashed currentColor;opacity:.5}.wksq.a1{background:color-mix(in srgb,' + A + ' 35%,transparent)}.wksq.a2{background:color-mix(in srgb,' + A + ' 75%,transparent)}.wksq.p1{background:color-mix(in srgb,' + OK + ' 65%,transparent)}.wksq.p2{background:color-mix(in srgb,' + OK + ' 28%,transparent)}' +
      '.wkqs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.wkq{border-top:1px solid ' + RULE + ';padding-top:10px;font-size:14px}' +
      '.wkthr{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border-radius:10px;background:' + TINT + ';font-size:14px;margin-top:8px}' +
      '.wkmxtab{border-collapse:separate;border-spacing:4px;font-size:13px}.wkmxtab th{font-weight:500;font-size:12px;opacity:.75;padding:4px;text-align:center;white-space:nowrap}.wkmxtab th.wkmxt{text-align:left;opacity:1;font-size:14px;padding-right:14px;min-width:200px}.wkmx{width:52px;height:44px;border-radius:6px;border:1px dashed ' + RULE + ';background:' + TINT + ';color:inherit;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.wkmx.kD,.wkk.kD{background:' + A + ';border:1px solid ' + A + ';color:#140a04}.wkmx.kS,.wkk.kS{background:color-mix(in srgb,' + OK + ' 20%,transparent);border:1px solid ' + OK + ';color:' + OK + '}.wkmx.kA,.wkk.kA{background:color-mix(in srgb,#7b61c9 18%,transparent);border:1px solid #7b61c9;color:#7b61c9}.wkmxn{padding-left:10px;white-space:nowrap}.wkk{display:inline-block;width:24px;height:18px;line-height:18px;border-radius:4px;text-align:center;font-size:11px;font-weight:700;margin-right:6px;vertical-align:-3px}' +
      '.wkfinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:14px}.wkfind{background:color-mix(in srgb,' + BAD + ' 9%,transparent);border-radius:10px;padding:12px 14px;font-size:14px;display:flex;flex-direction:column;gap:4px}.wkfind b{color:' + BAD + '}' +
      '.wktwo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:14px;align-items:start}.wksw{display:inline-block;width:18px;height:3px;vertical-align:4px;margin-right:8px}.wkflow{min-width:900px}' +
      '.wkpro{display:grid;grid-template-columns:240px minmax(0,1fr);gap:20px;align-items:start}.wkside{display:flex;flex-direction:column;gap:6px}.wkst{display:flex;flex-direction:column;align-items:flex-start;text-align:left;white-space:normal;width:100%;box-sizing:border-box;gap:2px;font:inherit;font-size:14px;padding:10px 12px;border-radius:10px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;min-height:44px}.wkst.on{border-color:' + A + ';background:' + TINT + '}' +
      '.wksteps{display:flex;flex-direction:column;gap:6px}.wkstep{display:grid;grid-template-columns:28px minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 84px;gap:8px;align-items:center}.wkstep input{font:inherit;font-size:14px;min-height:40px;width:100%;box-sizing:border-box}.wksh{font-size:12px;opacity:.7}.wkno{text-align:center;opacity:.7}' +
      '.wksix{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:8px 0 14px}.wks6{padding:16px 18px}.wks6 h3{font-size:15px;margin:0 0 4px}.wks6 p{margin:0 0 10px}.wks6 input{font:inherit;font-size:14px;width:100%;min-height:40px;box-sizing:border-box}.wkrw{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}.wkrw select,.wkrw input{width:100%;min-width:0;box-sizing:border-box}.wkrate{width:160px!important;min-width:120px}.wkfeed{font-size:12px;opacity:.75;margin-top:8px}.wkfoot{display:flex;gap:12px;align-items:center;margin:4px 0 20px}' +
      '.wklanes{display:grid;min-width:760px;font-size:13px}.wkln{padding:12px 10px 12px 0;border-top:1px solid ' + RULE + ';opacity:.85}.wkln.gap{color:' + BAD + ';opacity:1}.wkcl{border-top:1px solid ' + RULE + ';padding:8px 6px;display:flex;align-items:center;min-height:40px}.wkbx{border:1px solid ' + A + ';border-radius:6px;padding:8px 10px;width:100%;box-sizing:border-box;background:' + TINT + '}.wkbx.out{border-color:' + OK + ';background:color-mix(in srgb,' + OK + ' 10%,transparent)}.wkbx.gap{border:1px dashed ' + BAD + ';color:' + BAD + ';background:color-mix(in srgb,' + BAD + ' 8%,transparent)}.wkflag{color:' + BAD + ';font-weight:600}' +
      '.wkstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:0 0 14px}.wkstat{padding:14px 16px}.wkstat b{display:block;font-size:28px;margin-bottom:2px}.wkstat span{font-size:13px;opacity:.8}' +
      '.wkbar{display:grid;grid-template-columns:120px minmax(0,1fr) 250px;gap:10px;align-items:center;margin:5px 0;font-size:14px}.wkbt{position:relative;height:18px;background:' + TINT + ';border-radius:3px}.wkband2{position:absolute;top:0;bottom:0;background:color-mix(in srgb,' + OK + ' 22%,transparent);border-left:1px solid ' + OK + ';border-right:1px solid ' + OK + '}.wkbl{position:absolute;left:0;top:4px;height:10px;border-radius:2px;background:var(--paper,#141414)}.wkbl.over{background:' + A + '}.wkbv{font-size:12px;opacity:.8}' +
      '.wkmo{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;height:120px;align-items:end}.wkmc{display:flex;flex-direction:column;justify-content:flex-end;height:100%;text-align:center;font-size:11px}.wkmf{background:var(--paper,#141414);display:block}.wkdeps th.wkvh{writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;max-height:180px;white-space:nowrap}.wkdot{text-align:center}' +
      '@media(max-width:820px){.wkgrid,.wkg3,.wkbars,.wktwo,.wkpro{grid-template-columns:1fr}.wkbar{grid-template-columns:1fr}.wkstep{grid-template-columns:24px 1fr}.wkstep input,.wkstep button{grid-column:2}.wksh{display:none}}';
    document.head.appendChild(s);
  }
  window.VTWork = { render: render, loads: loads };
})();
