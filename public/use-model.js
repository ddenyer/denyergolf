// Use: the views that are drawn here rather than borrowed from Build (5 November 2026).
//   Model › Inputs › "Try it: the numbers": the few numbers that drive the model, as sliders with units.
//   Model › Results › "Try it": the result, worked out as the numbers move, with a sentence saying what it shows.
//   Test › Inputs › "Questions and changes to try": the named scenarios and what each switches off.
//   Test › Results › "Each against the baseline": every scenario beside the way things are now.
// Two kinds of case are handled: load against a band (people, packages and drivers in The work, as in SAS),
// and work flowing through processes hour by hour (the agent-based model, as in Maylands). A case may have both.
// Every change saves to the record; a figure typed over a worked-out one is kept beside it, never in place of it.
(function () {
  'use strict';
  var X, el;
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var fmt = function (x) { return Math.round(x).toLocaleString('en-GB'); };
  var num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var ro = function () { return !!X.S.readonly; };
  var q = Promise.resolve();
  function save(fn) { var run = q.then(async function () { var v = X.invData(); fn(v); await X.saveInv(v); }); q = run.catch(function () {}); return run.then(function () { X.render(); }, function (e) { alert(e.message || e); }); }

  // ---------- what kind of case this is ----------
  function hasLoad(v) { var w = v.work || {}; return (w.packages || []).length > 0 && (w.drivers || []).length > 0; }
  function hasFlow(v) { return ((v.abm || {}).procs || []).length > 0; }
  function people(v) { return (v.resources || []).filter(function (r) { return r.t === 'people'; }); }
  function tryOf(v) { v.work = v.work || {}; v.work.try = v.work.try || {}; var t = v.work.try; t.f = t.f || {}; t.over = t.over || {}; return t; }

  // load per person with the "try" settings applied: drivers scaled, the band top changed, work pooled
  function tryLoads(v) {
    var w = v.work || {}, t = (w.try) || {}, f = t.f || {}, drv = {}, out = {};
    (w.drivers || []).forEach(function (d) { drv[d.id] = d; });
    (w.packages || []).forEach(function (p) {
      var s = 0; Object.keys(p.counts || {}).forEach(function (k) { if (drv[k]) s += num(p.counts[k]) * (f[k] == null ? 1 : num(f[k])) * num(drv[k].w == null ? 1 : drv[k].w); });
      s += num(p.comp) * num(w.cw == null ? 1 : w.cw);
      if (p.owner) out[p.owner] = (out[p.owner] || 0) + s;
    });
    var ppl = people(v), total = Object.keys(out).reduce(function (a, k) { return a + out[k]; }, 0);
    var n = t.n ? Number(t.n) : ppl.filter(function (r) { return out[r.id] != null; }).length;
    if (t.pool && n) { var each = total / n; ppl.forEach(function (r) { if (out[r.id] != null) out[r.id] = each; }); }
    return { per: out, total: total, n: n };
  }
  function driverTotal(w, d) { var s = 0; (w.packages || []).forEach(function (p) { s += num((p.counts || {})[d.id]); }); return s; }
  var bandTop = function (v, r) { var t = (v.work || {}).try || {}; return t.top ? Number(t.top) : num(r.bandHi); };

  // ---------- small controls ----------
  function slider(label, val, min, max, step, unit, lv, on, id) {
    var r = el('input', { type: 'range', min: String(min), max: String(max), step: String(step || 1), value: String(val), disabled: ro(), id: id, 'aria-label': label });
    var box = el('input', { type: 'number', class: 'um-num', value: String(val), disabled: ro(), 'aria-label': label + ', exact figure' });
    r.addEventListener('input', function () { box.value = r.value; });
    r.addEventListener('change', function () { on(Number(r.value)); });
    box.addEventListener('change', function () { on(Number(box.value)); });
    return el('div', { class: 'um-row' }, [el('label', { for: id, text: label }), r, box, el('span', { class: 'um-unit', text: unit }), lv == null || lv === '' ? el('span') : el('span', { class: 'um-lv l' + lv, text: lv + ' ' + ['No evidence', 'Said', 'Written down', 'Done', 'Tested', 'End to end'][Number(lv)] })]);
  }
  function toggle(label, onv, on) { return el('div', { class: 'um-tg' }, [el('button', { type: 'button', class: 'um-sl' + (onv ? ' on' : ''), disabled: ro(), 'aria-pressed': String(!!onv), 'aria-label': label, onclick: function () { on(!onv); } }), el('span', { text: label })]); }
  function card(title, kids, id) { return el('section', { class: 'um-card', id: id || null }, [title ? el('h2', { text: title }) : null].concat(kids)); }

  // ---------- Model › Inputs: the numbers ----------
  function tryIn(host) {
    var v = X.invData(), any = false;
    if (hasLoad(v)) {
      any = true;
      var w = v.work, t = w.try || {}, ppl = people(v), L = tryLoads(v), withLoad = ppl.filter(function (r) { return L.per[r.id] != null; });
      var top0 = withLoad.length ? num(withLoad[0].bandHi) : 0;
      host.appendChild(card('The people', [
        slider('Number of people sharing the work', t.n || withLoad.length, 1, Math.max(30, withLoad.length * 2), 1, 'people', null, function (x) { save(function (vv) { tryOf(vv).n = x === withLoad.length ? null : x; }); }, 'umN'),
        top0 ? slider('Top of the manageable band', t.top || top0, Math.round(top0 / 2), Math.round(top0 * 2), 5, 'points a year', withLoad[0].lv, function (x) { save(function (vv) { tryOf(vv).top = x === top0 ? null : x; }); }, 'umTop') : null,
        toggle('Share the work out evenly, instead of by package as now', !!t.pool, function (x) { save(function (vv) { tryOf(vv).pool = x; }); })], 'umPeople'));
      host.appendChild(card('The work coming in', w.drivers.map(function (d) {
        var base = driverTotal(w, d), fac = (t.f || {})[d.id] == null ? 1 : num(t.f[d.id]), cur = Math.round(base * fac);
        return slider(d.n || 'Unnamed', cur, 0, Math.max(10, Math.round(base * 2.5)), base > 200 ? 5 : 1, 'a year', d.lv, function (x) { save(function (vv) { var tt = tryOf(vv); tt.f[d.id] = base ? x / base : 1; if (Math.abs(tt.f[d.id] - 1) < 1e-9) delete tt.f[d.id]; }); }, 'umD' + d.id);
      }).concat([el('p', { class: 'um-note', text: 'Moving a count scales every package in proportion. The figures as recorded are kept; these are the numbers being tried.' })]), 'umWork'));
    }
    if (hasFlow(v)) {
      any = true;
      var m = v.abm, P = (v.processes || []);
      host.appendChild(card('Work flowing through, hour by hour', (m.procs || []).map(function (c, i) {
        var p = P.filter(function (x) { return x.id === c.p; })[0] || {};
        var kids = [];
        if (i === 0) kids.push(slider('Arrivals a day', num(c.arrive), 0, Math.max(20, num(c.arrive) * 3), 1, 'a day', null, function (x) { save(function (vv) { var cc = (vv.abm.procs || [])[i]; if (cc) cc.arrive = x; }); }, 'umA' + i));
        kids.push(slider((p.n || 'A process') + ': items it can handle', num(c.cap), 0, Math.max(6, num(c.cap) * 3), 0.5, 'an hour', null, function (x) { save(function (vv) { var cc = (vv.abm.procs || [])[i]; if (cc) cc.cap = x; }); }, 'umC' + i));
        return el('div', {}, kids);
      }).concat([el('p', { class: 'um-note', text: 'These are the model’s own numbers: changing them changes the model for everyone.' })]), 'umFlow'));
    }
    if (!any) host.appendChild(empty());
    if (any) host.appendChild(el('div', { class: 'um-go' }, [el('a', { class: 'btn solid', href: '#use=out.tryout', text: 'See the results' })]));
  }
  function empty() { return el('p', { class: 'um-note', text: 'This case has no numbers to try yet. In Build, add them under The work (drivers, people and packages) or the agent-based model (volumes and capacity).' }); }

  // ---------- Model › Results: try it ----------
  function tryOut(host) {
    var v = X.invData(), any = false;
    if (hasLoad(v)) { any = true; loadResults(host, v); }
    if (hasFlow(v)) { any = true; flowResults(host, v); }
    if (!any) host.appendChild(empty());
  }
  function loadResults(host, v) {
    var t = (v.work || {}).try || {}, L = tryLoads(v), ppl = people(v).filter(function (r) { return L.per[r.id] != null; });
    var over = ppl.filter(function (r) { var o = (t.over || {})[r.id]; var val = o ? num(o.v) : L.per[r.id]; return bandTop(v, r) && val > bandTop(v, r); });
    var top = ppl.slice().sort(function (a, b) { return L.per[b.id] / (bandTop(v, b) || 1) - L.per[a.id] / (bandTop(v, a) || 1); })[0];
    var cap = ppl.reduce(function (a, r) { return a + bandTop(v, r); }, 0) * (t.n && ppl.length ? t.n / ppl.length : 1);
    var low = ppl.filter(function (r) { return L.per[r.id] < 0.1 * (num(r.bandLo) || bandTop(v, r)); }).length, cover = ppl.filter(function (r) { return String(r.cover || '').trim(); }).length;
    var changed = Object.keys(t.f || {}).length || t.n || t.top || t.pool;
    host.appendChild(el('div', { class: 'um-strip' }, [el('span', { class: 'um-k', text: changed ? 'Trying changed numbers' : 'As things are now' }), changed && !ro() ? el('button', { type: 'button', class: 'btn sm', text: 'Back to as things are now', onclick: function () { save(function (vv) { var tt = tryOf(vv); tt.f = {}; tt.n = null; tt.top = null; tt.pool = false; }); } }) : null, el('a', { href: '#use=in.tryin', text: 'Change the numbers' })]));
    host.appendChild(el('div', { class: 'um-stats' }, [[over.length + ' of ' + ppl.length, 'people above the top of their band'], [top && L.per[top.id] > bandTop(v, top) ? (Math.round(L.per[top.id] / bandTop(v, top) * 10) / 10) + ' times' : 'None', top && L.per[top.id] > bandTop(v, top) ? 'the top of the band: the heaviest load' : 'above the band'], [String(low), 'people with almost no load'], [String(cover), 'people with named cover']].map(function (s) { return el('div', { class: 'um-stat' }, [el('b', { text: s[0] }), el('span', { text: s[1] })]); })));
    var say = over.length ? over.length + (over.length === 1 ? ' person is' : ' people are') + ' above the top of the band.' : 'Everyone is within or below the band.';
    if (top && L.per[top.id] > bandTop(v, top)) say += ' The heaviest load is ' + (top.n || 'one person') + '’s, at ' + fmt(L.per[top.id]) + ' points.';
    if (cap) say += L.total > cap ? ' Together the work comes to ' + fmt(L.total) + ' points, more than ' + (t.n || ppl.length) + ' people at the top of the band could carry (' + fmt(cap) + '), so sharing it out evenly would still leave everyone over.' : ' Together the work comes to ' + fmt(L.total) + ' points, within what ' + (t.n || ppl.length) + ' people at the top of the band could carry (' + fmt(cap) + '), so it is how the work is shared out, not the total, that overloads people.';
    var maxV = Math.max.apply(null, [1].concat(ppl.map(function (r) { return Math.max(L.per[r.id], bandTop(v, r)); })));
    var bars = card('Load against the band', [el('p', { class: 'um-say', id: 'umSay', text: say })]);
    var lvs = ppl.map(function (r) { return r.lv == null || r.lv === '' ? 0 : Number(r.lv); }), weak = Math.max.apply(null, [0].concat(lvs)) <= 1;
    ppl.forEach(function (r) {
      var val = L.per[r.id], hi = bandTop(v, r), lo = num(r.bandLo), pc = function (x) { return (100 * x / maxV).toFixed(2) + '%'; }, o = (t.over || {})[r.id];
      var rangeW = weak ? Math.min(30, 100 * val * 0.2 / maxV) : 0;
      bars.appendChild(el('div', { class: 'um-bar', 'data-person': r.id }, [el('span', { text: r.n || 'Unnamed' }),
        el('span', { class: 'um-tr' }, [hi ? el('span', { class: 'um-band', style: 'left:' + pc(lo) + ';width:' + pc(Math.max(0, hi - lo)) }) : null, el('span', { class: 'um-fill' + (hi && val > hi ? ' over' : ''), style: 'width:' + pc(val) }), rangeW ? el('span', { class: 'um-rng', style: 'left:' + (100 * val / maxV - rangeW / 2).toFixed(2) + '%;width:' + rangeW.toFixed(2) + '%' }) : null]),
        el('span', { class: 'um-v' + (hi && val > hi ? ' over' : '') }, [document.createTextNode(fmt(val)), o ? el('span', { class: 'um-ov', title: (o.why || '') + (o.by ? ' (' + o.by + ')' : ''), text: ' · typed: ' + fmt(num(o.v)) }) : null,
          ro() ? null : el('button', { type: 'button', class: 'um-ovb', text: o ? 'Change' : 'Override', 'aria-label': 'Override ' + (r.n || 'this figure'), onclick: function () {
            var nv = window.prompt('The figure you think is right for ' + (r.n || 'this person') + ' (leave blank to remove your figure):', o ? String(o.v) : ''); if (nv === null) return;
            var why = nv.trim() ? (window.prompt('Why? (kept with the figure)', o ? o.why || '' : '') || '') : '';
            save(function (vv) { var tt = tryOf(vv); if (!nv.trim()) delete tt.over[r.id]; else tt.over[r.id] = { v: num(nv), why: why, by: (X.me && X.me()) || '', at: new Date().toISOString() }; });
          } })])]));
    });
    bars.appendChild(el('p', { class: 'um-note', text: 'Green: the band. ' + (weak ? 'Dashed: a range of a fifth either way, because the figures behind it are only said. ' : '') + 'A typed figure is kept beside the worked-out one, with who typed it and why.' }));
    host.appendChild(bars);
  }
  function flowResults(host, v) {
    var M = window.VTModel; if (!M || !M.many) return;
    var m = v.abm, tol = M.tolOf(v), rs = M.many(v, m, '');
    var n = rs.length, br = rs.filter(function (r) { return r.breaches > 0; }).length;
    var items = rs.reduce(function (a, r) { return a + r.items; }, 0), late = rs.reduce(function (a, r) { return a + (r.lateDone || 0); }, 0), open = rs.reduce(function (a, r) { return a + (r.open || 0); }, 0);
    var onTime = Math.max(0, items - late), ws = rs.map(function (r) { return r.worst; }).sort(function (a, b) { return a - b; });
    var pct = function (x) { return items ? Math.round(100 * x / items) : 0; };
    var c = card('Work flowing through, over ' + (Number(m.horizon) || 168) / 24 + ' days', [
      el('p', { class: 'um-say', text: 'In ' + br + ' of ' + n + ' replays at least one item waits longer than the line (' + tol + ' hours). The typical longest wait is ' + ws[Math.floor(n / 2)].toFixed(1) + ' hours; one replay in ten is worse than ' + ws[Math.floor(n * 0.9)].toFixed(1) + ' hours.' }),
      el('div', { class: 'um-split' }, [['Done on time', pct(onTime - open)], ['Done late', pct(late)], ['Carried forward', pct(open)]].map(function (s, i) { return el('div', { class: 'um-sp s' + i }, [el('b', { text: s[1] + ' in 100' }), el('span', { text: s[0] })]); })),
      el('p', { class: 'um-note', text: 'Shares of all the items in ' + n + ' replays of the week. Carried forward: still waiting at the end of the week. Most numbers behind this may be assumed: read it as what could happen, not a forecast.' })], 'umFlowOut');
    host.appendChild(c);
  }

  // ---------- Test › Inputs: questions and changes to try ----------
  function scen(host) {
    var v = X.invData();
    if (!hasFlow(v)) { host.appendChild(el('p', { class: 'um-note', text: 'Scenarios are tried on the model of work flowing through, hour by hour. This case does not have one yet: in Build, add volumes and capacity to the agent-based model.' })); return; }
    var m = v.abm, R = (v.resources || []).filter(function (r) { return r.dir !== 'relied on by'; });
    (v.scenarios || []).forEach(function (s) {
      var sh = (m.shocks || []).filter(function (x) { return x.s === s.id; });
      var nm = el('input', { type: 'text', class: 'um-in', value: s.n || '', disabled: ro(), 'aria-label': 'Name of the scenario' }); nm.addEventListener('change', function () { save(function (vv) { var x = (vv.scenarios || []).filter(function (y) { return y.id === s.id; })[0]; if (x) x.n = nm.value.trim(); }); });
      var rows = sh.map(function (x) {
        var idx = (m.shocks || []).indexOf(x);
        var set = function (k) { return function (val) { save(function (vv) { var y = (vv.abm.shocks || [])[idx]; if (y) y[k] = val; }); }; };
        var rs = el('select', { class: 'um-in', disabled: ro(), 'aria-label': 'What is switched off' }, R.map(function (r) { return el('option', { value: r.id, text: r.n }); })); rs.value = x.r; rs.addEventListener('change', function () { set('r')(rs.value); });
        var f = el('input', { type: 'number', class: 'um-in sm', value: String(x.from || 0), disabled: ro(), 'aria-label': 'From hour' }); f.addEventListener('change', function () { set('from')(Number(f.value)); });
        var h = el('input', { type: 'number', class: 'um-in sm', value: String(x.hours || 0), disabled: ro(), 'aria-label': 'For how many hours' }); h.addEventListener('change', function () { set('hours')(Number(h.value)); });
        var lv = el('select', { class: 'um-in', disabled: ro(), 'aria-label': 'How much of it still works' }, [['0', 'switched off'], ['0.1', 'working at a tenth'], ['0.3', 'working at a third'], ['0.5', 'working at half'], ['0.7', 'working at two thirds']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
        lv.value = String(Number(x.level) || 0); if (lv.value !== String(Number(x.level) || 0)) { var oo = el('option', { value: String(x.level), text: 'working at ' + Math.round(Number(x.level) * 100) + ' in 100' }); lv.appendChild(oo); lv.value = String(x.level); }
        lv.addEventListener('change', function () { set('level')(Number(lv.value)); });
        return el('div', { class: 'um-shock' }, [rs, lv, el('span', { text: 'from hour' }), f, el('span', { text: 'for' }), h, el('span', { text: 'hours' })]);
      });
      host.appendChild(card(null, [nm].concat(rows).concat(ro() ? [] : [el('button', { type: 'button', class: 'btn sm', text: 'Switch something else off too', onclick: function () { save(function (vv) { vv.abm.shocks = vv.abm.shocks || []; vv.abm.shocks.push({ s: s.id, r: R[0] ? R[0].id : '', from: 24, hours: 24, level: 0 }); }); } })]), 'umScen' + s.id));
    });
    if (!ro()) host.appendChild(el('button', { type: 'button', class: 'btn solid', id: 'umAddScen', text: 'Ask a new question', onclick: function () { save(function (vv) { vv.scenarios = vv.scenarios || []; var id = X.nid('s', vv.scenarios); vv.scenarios.push({ id: id, n: 'A new question' }); vv.abm.shocks = vv.abm.shocks || []; vv.abm.shocks.push({ s: id, r: R[0] ? R[0].id : '', from: 24, hours: 24, level: 0 }); }); } }));
  }

  // ---------- Test › Results: each against the baseline ----------
  function firstOver(r, tol, start) { for (var h = 0; h < r.oldest.length; h++) if (r.oldest[h] > tol) { var d = Math.floor((start * 24 + h) / 24) % 7, hr = (h % 24); return DAYS[d] + ' at ' + (hr < 10 ? '0' : '') + hr + ':00'; } return null; }
  function compare(host) {
    var v = X.invData(), M = window.VTModel;
    if (!hasFlow(v) || !M) { host.appendChild(el('p', { class: 'um-note', text: 'Nothing to compare yet: the scenarios are run on the model of work flowing through, hour by hour.' })); return; }
    var m = v.abm, tol = M.tolOf(v), start = Number(m.start) || 0, R = v.resources || [];
    var list = [{ id: '', n: 'As things are now' }].concat((v.scenarios || []).filter(function (s) { return (m.shocks || []).some(function (x) { return x.s === s.id; }); }));
    var res = list.map(function (s) { var rs = M.many(v, m, s.id), ws = rs.map(function (r) { return r.worst; }).sort(function (a, b) { return a - b; }); return { s: s, pb: rs.filter(function (r) { return r.breaches > 0; }).length / rs.length, med: ws[Math.floor(ws.length / 2)], p90: ws[Math.floor(ws.length * 0.9)], first: firstOver(rs[0], tol, start), runs: rs.length }; });
    var base = res[0], maxH = Math.max.apply(null, [tol * 1.5].concat(res.map(function (r) { return r.p90; }))) * 1.05;
    var worst = res.slice(1).filter(function (r) { return r.pb >= 0.95; }).map(function (r) { return r.s.n; }), mild = res.slice(1).filter(function (r) { return Math.abs(r.pb - base.pb) <= 0.05; }).map(function (r) { return r.s.n; });
    var say = 'As things are now, the line is crossed in about ' + Math.round(base.pb * 100) + ' replays in 100.' + (worst.length ? ' ' + worst.join(' and ') + (worst.length === 1 ? ' crosses' : ' cross') + ' it almost every time.' : '') + (mild.length ? ' ' + mild.join(' and ') + (mild.length === 1 ? ' barely changes' : ' barely change') + ' it.' : '');
    host.appendChild(el('p', { class: 'um-lead', text: say }));
    var pc = function (h) { return (100 * h / maxH).toFixed(2) + '%'; };
    var chart = card('The longest wait in the week', res.map(function (r, i) {
      return el('div', { class: 'um-ax', 'data-scen': r.s.id || 'base' }, [el('span', { class: 'um-axn' }, [el('b', { text: r.s.n }), i === 0 ? el('span', { text: 'The baseline' }) : null]),
        el('span', { class: 'um-tr tall' }, [el('span', { class: 'um-line', style: 'left:' + pc(tol) }), el('span', { class: 'um-rgb' + (i ? '' : ' base'), style: 'left:' + pc(r.med) + ';width:' + pc(Math.max(0.2, r.p90 - r.med)) }), el('span', { class: 'um-md', style: 'left:' + pc(r.med) })]),
        el('span', { class: 'um-pb' + (r.pb > base.pb + 0.1 ? ' over' : ''), text: Math.round(r.pb * 100) + ' in 100' })]);
    }).concat([el('p', { class: 'um-note', text: 'White mark: the typical longest wait. Bar: up to the wait one replay in ten is worse than. Red dashed line: ' + tol + ' hours, the line that must not be crossed. Right: replays in 100 that cross it.' })]), 'umCompare');
    host.appendChild(chart);
    var cards = el('div', { class: 'um-cards' });
    res.slice(1).forEach(function (r) {
      var sh = (m.shocks || []).filter(function (x) { return x.s === r.s.id; }).map(function (x) { var rr = R.filter(function (y) { return y.id === x.r; })[0]; return (rr ? rr.n : 'Something') + ': ' + (Number(x.level) ? 'down to ' + Math.round(Number(x.level) * 100) + ' in 100' : 'off') + ' from hour ' + x.from + ' for ' + x.hours + (Number(x.hours) === 1 ? ' hour' : ' hours'); });
      cards.appendChild(card(r.s.n, [el('div', { class: 'um-chg' }, [el('span', { class: 'um-k', text: 'Changed from the baseline' }), el('div', { text: sh.join('; ') + '. Nothing else.' })]),
        el('div', { text: 'The typical longest wait goes from ' + base.med.toFixed(1) + ' to ' + r.med.toFixed(1) + ' hours, and the line is crossed in ' + Math.round(r.pb * 100) + ' replays in 100 (now ' + Math.round(base.pb * 100) + ').' + (r.first ? ' In the first replay it is first crossed on ' + r.first + '.' : ' In the first replay it is not crossed.') })]));
    });
    host.appendChild(cards);
  }

  function css() {
    if (document.getElementById('umCss')) return;
    var s = document.createElement('style'); s.id = 'umCss';
    s.textContent = '.um-card{border:1px solid var(--line,rgba(127,127,127,.3));border-radius:16px;padding:16px 18px;margin:0 0 14px;background:rgba(127,127,127,.05)}.um-card h2{font-family:Outfit,"DM Sans",sans-serif;font-weight:400;font-size:20px;margin:0 0 10px}' +
      '.um-row{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(140px,2fr) 100px 120px 130px;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--line,rgba(127,127,127,.15));font-size:14px}@media(max-width:820px){.um-row{grid-template-columns:1fr 1fr}}.um-row input[type=range]{width:100%;accent-color:var(--accent,#e07030)}.um-num{width:100%;box-sizing:border-box;text-align:right;font:inherit;padding:8px;min-height:38px}.um-unit{font-size:13px;opacity:.75}' +
      '.um-lv{font-size:12px;padding:2px 9px;border-radius:99px;border:1px solid currentColor;justify-self:start;white-space:nowrap}.um-lv.l0{color:#c4502c}.um-lv.l1,.um-lv.l2{color:#a2701e}.um-lv.l3{color:#7a7a1e}.um-lv.l4,.um-lv.l5{color:#2f7d52}' +
      '.um-tg{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line,rgba(127,127,127,.15));font-size:14px}.um-sl{width:46px;height:26px;border-radius:99px;background:rgba(127,127,127,.35);position:relative;border:0;flex:none;cursor:pointer}.um-sl::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff}.um-sl.on{background:var(--accent,#e07030)}.um-sl.on::after{left:23px}' +
      '.um-note{font-size:13px;opacity:.75;margin:10px 0 0;line-height:1.5}.um-go{margin-top:8px}.um-strip{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 12px;font-size:14px}.um-k{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}' +
      '.um-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px}@media(max-width:820px){.um-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}.um-stat{border:1px solid var(--line,rgba(127,127,127,.3));border-radius:14px;padding:14px 16px}.um-stat b{display:block;font-family:Outfit,"DM Sans",sans-serif;font-weight:400;font-size:30px}.um-stat span{font-size:13px;opacity:.8}' +
      '.um-say,.um-lead{font-size:16px;line-height:1.5;margin:0 0 12px}.um-lead{font-size:20px;font-family:Outfit,"DM Sans",sans-serif;font-weight:300}' +
      '.um-bar{display:grid;grid-template-columns:110px minmax(0,1fr) 230px;gap:10px;align-items:center;font-size:13px;margin:5px 0}.um-tr{position:relative;height:18px;background:rgba(127,127,127,.12);border-radius:3px;display:block}.um-tr.tall{height:26px}.um-band{position:absolute;top:0;bottom:0;background:rgba(47,125,82,.25);border-left:1px solid #2f7d52;border-right:1px solid #2f7d52}.um-fill{position:absolute;left:0;top:4px;bottom:4px;border-radius:2px;background:currentColor;opacity:.55}.um-fill.over{background:var(--accent,#e07030);opacity:1}.um-rng{position:absolute;top:1px;bottom:1px;border:1px dashed var(--accent,#e07030);border-radius:3px}' +
      '.um-v{font-variant-numeric:tabular-nums;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.um-v.over{font-weight:700;color:#c4502c}.um-ov{font-weight:400;color:var(--accent,#e07030)}.um-ovb{font:inherit;font-size:11px;padding:2px 8px;border-radius:99px;border:1px solid rgba(127,127,127,.5);background:none;color:inherit;cursor:pointer}' +
      '.um-split{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.um-sp{border:1px solid var(--line,rgba(127,127,127,.3));border-radius:12px;padding:12px 14px}.um-sp b{display:block;font-size:24px;font-weight:400;font-family:Outfit,"DM Sans",sans-serif}.um-sp.s1 b{color:var(--accent,#e07030)}.um-sp span{font-size:13px;opacity:.8}' +
      '.um-ax{display:grid;grid-template-columns:260px minmax(240px,1fr) 110px;gap:12px;align-items:center;font-size:13px;margin:10px 0}.um-axn b{display:block}.um-axn span{font-size:12px;opacity:.7}.um-line{position:absolute;top:-5px;bottom:-5px;border-left:2px dashed #c4502c}.um-rgb{position:absolute;top:7px;height:12px;border-radius:6px;background:rgba(224,112,48,.5)}.um-rgb.base{background:rgba(127,127,127,.45)}.um-md{position:absolute;top:3px;width:4px;height:20px;border-radius:2px;background:currentColor}.um-pb{font-variant-numeric:tabular-nums}.um-pb.over{color:#c4502c;font-weight:700}' +
      '.um-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:820px){.um-cards{grid-template-columns:1fr}}.um-chg{background:rgba(224,112,48,.09);border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:8px}' +
      '.um-in{font:inherit;font-size:14px;padding:8px 10px;min-height:40px;box-sizing:border-box}.um-in.sm{width:80px}.um-card>.um-in{width:100%;font-size:17px;margin-bottom:8px}.um-shock{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px;margin:6px 0}';
    document.head.appendChild(s);
  }

  function boot() {
    var U = window.VTUse; if (!U) return;
    var wrap = function (f) { return function (host) { X = window.VTUse.X || X; css(); f(host); }; };
    U.OWN.tryin = wrap(tryIn); U.OWN.tryout = wrap(tryOut); U.OWN.scen = wrap(scen); U.OWN.compare = wrap(compare);
  }
  window.VTUseModel = { attach: function (x) { X = x; el = x.el; boot(); } };
})();
