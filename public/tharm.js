// More throughput, no intolerable harm (Evaluate). A flow model run hour by hour: work passes through
// stages in order, each with a capacity per hour; scenarios change capacity or demand for a while; candidate
// changes alter capacity, the commitment, or add a back-up team that steps in after a delay (a social
// condition, such as not noticed, entered as hours). Each change is run through every scenario and shown on
// one chart: gain in throughput in normal operation against worst harm as a share of the intolerable
// threshold. It shows possibility, not probability. Reads and saves the session's tile "tharm".
(function () {
  'use strict';
  var X, el, ST = { sel: null, tab: 'results', scen: null, dirty: false };

  // The illustrative service from the working note (section 10.7). Made-up numbers, to show the logic.
  var ILLUS = {
    name: 'An illustrative service (made-up numbers)', illustrative: true, hours: 48, threshold: 400, unit: 'cases', base: 95,
    stages: [
      { id: 'intake', n: 'Intake', teams: [{ id: 'intake', n: 'Intake', cap: 140 }] },
      { id: 'assess', n: 'Assessment', teams: [{ id: 'assess', n: 'Assessment', cap: 125 }] },
      { id: 'proc', n: 'Processing', teams: [{ id: 'p1', n: 'Processing team 1', cap: 60 }, { id: 'p2', n: 'Processing team 2', cap: 50 }] },
      { id: 'dispatch', n: 'Dispatch', teams: [{ id: 'dispatch', n: 'Dispatch', cap: 135 }] }],
    scenarios: [
      { id: 'outage', n: 'Processing team 1 out of action for eight hours', kind: 'down', target: 'p1', from: 6, to: 14 },
      { id: 'surge', n: 'A surge in demand of 30 per cent for six hours', kind: 'surge', factor: 1.3, from: 6, to: 12 },
      { id: 'absence', n: 'Loss of 40 per cent of assessment staff for twelve hours', kind: 'reduce', target: 'assess', factor: 0.6, from: 6, to: 18 }],
    options: [
      { id: 'o1', n: 'Today', commit: 95, caps: {} },
      { id: 'o2', n: 'Restrict the service', commit: 66, caps: {} },
      { id: 'o3', n: 'Stop the service', commit: 0, caps: {} },
      { id: 'o4', n: 'Run fuller', commit: 108, caps: {} },
      { id: 'o5', n: 'Capacity where it is not the constraint', commit: 95, caps: { intake: 170 } },
      { id: 'o6', n: 'Add capacity at the constraint', commit: 115, caps: { p2: 72 } },
      { id: 'o7', n: 'Back-up team, slow to notice', commit: 95, caps: {}, backup: { stage: 'proc', cap: 45, detect: 4 } },
      { id: 'o8', n: 'Back-up team, quick to notice', commit: 95, caps: {}, backup: { stage: 'proc', cap: 45, detect: 0 } },
      { id: 'o9', n: 'Capacity at the constraint, with back-up quick to notice', commit: 115, caps: { p2: 72 }, backup: { stage: 'proc', cap: 45, detect: 0 } },
      { id: 'o10', n: 'Capacity at both constraints, with back-up quick to notice', commit: 115, caps: { p2: 72, assess: 150 }, backup: { stage: 'proc', cap: 45, detect: 0 } }]
  };
  var REG = {
    invest: ['The investment case', 'More throughput, within tolerance in every scenario'],
    further: ['Only with further changes', 'More throughput, but beyond tolerance in at least one scenario'],
    protect: ['Protection', 'No gain in throughput, within tolerance'],
    restrict: ['Protection by restriction', 'Less throughput and less harm'],
    none: ['None of these', 'Beyond tolerance with no gain, or less throughput without less harm']
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function model() { var r = X.row('tharm'); return ST.m || (ST.m = r && r.content && r.content.model ? clone(r.content.model) : clone(ILLUS)); }

  // ---------- the engine ----------
  function teamCap(m, o, t) { return o.caps && o.caps[t.id] != null && o.caps[t.id] !== '' ? Number(o.caps[t.id]) : Number(t.cap); }
  function capacity(m, o) { return Math.min.apply(null, m.stages.map(function (s) { return s.teams.reduce(function (a, t) { return a + teamCap(m, o, t); }, 0); })); }
  function constraint(m, o) { var c = capacity(m, o); return m.stages.filter(function (s) { return s.teams.reduce(function (a, t) { return a + teamCap(m, o, t); }, 0) === c; }).map(function (s) { return s.n; }); }
  function run(m, o, sc) {
    var q = m.stages.map(function () { return 0; }), peak = 0, series = [], downSince = {};
    for (var h = 0; h < Number(m.hours); h++) {
      var on = sc && h >= Number(sc.from) && h < Number(sc.to), arr = Number(o.commit) * (on && sc.kind === 'surge' ? Number(sc.factor) : 1), inflow = arr;
      m.stages.forEach(function (s, i) {
        var down = false, cap = s.teams.reduce(function (a, t) {
          var c = teamCap(m, o, t);
          if (on && sc.kind === 'down' && sc.target === t.id) { c = 0; down = true; }
          if (on && sc.kind === 'reduce' && (sc.target === t.id || sc.target === s.id)) c = c * Number(sc.factor);
          return a + c;
        }, 0);
        var b = o.backup;
        if (b && b.stage === s.id && down) { if (downSince[s.id] == null) downSince[s.id] = h; if (h - downSince[s.id] >= Number(b.detect)) cap += Number(b.cap); }
        else if (!down) delete downSince[s.id];
        var avail = q[i] + inflow, out = Math.min(avail, cap); q[i] = avail - out; inflow = out;
      });
      var tot = q.reduce(function (a, x) { return a + x; }, 0); peak = Math.max(peak, tot); series.push(tot);
    }
    return { peak: peak, series: series };
  }
  function evaluate(m) {
    var base = Number(m.base) || 1;
    return m.options.map(function (o) {
      var cap = capacity(m, o), res = {}, worst = 0, worstSc = null;
      m.scenarios.forEach(function (sc) { var r = run(m, o, sc); res[sc.id] = r; if (r.peak > worst) { worst = r.peak; worstSc = sc.id; } });
      var gain = Math.round((Number(o.commit) / base - 1) * 100), pct = Math.round(worst / Number(m.threshold) * 100);
      var reg = gain > 0 ? (pct < 100 ? 'invest' : 'further') : gain === 0 ? (pct < 100 ? 'protect' : 'none') : 'restrict';
      if (reg === 'restrict' && pct >= 100) reg = 'none';
      return { o: o, cap: cap, over: Number(o.commit) > cap, head: cap ? Math.round((1 - Number(o.commit) / cap) * 100) : 0, gain: gain, worst: worst, pct: pct, worstSc: worstSc, res: res, reg: reg, con: constraint(m, o) };
    });
  }

  // Changes that only work together (1 November 2026): a change whose capacities include two other changes'
  // capacities, with the same commitment, is read as those two together. Said in a sentence when together they
  // stay within tolerance and neither does alone, or together they do clearly better than either.
  function sameCaps(a, b) { return Object.keys(a).every(function (k) { return b[k] != null && Number(b[k]) === Number(a[k]); }); }
  function partOf(a, c) { var ca = a.caps || {}, cc = c.caps || {}; if (!Object.keys(ca).length && !a.backup) return false; if (!sameCaps(ca, cc)) return false; if (a.backup && !(c.backup && c.backup.stage === a.backup.stage && Number(c.backup.cap) >= Number(a.backup.cap))) return false; return Number(a.commit) === Number(c.commit); }
  function interactions(m, rs) {
    rs = rs || evaluate(m); var out = [];
    rs.forEach(function (c, ci) {
      for (var i = 0; i < rs.length; i++) for (var j = i + 1; j < rs.length; j++) {
        if (i === ci || j === ci) continue; var a = rs[i], b = rs[j];
        if (!partOf(a.o, c.o) || !partOf(b.o, c.o)) continue;
        if (Object.keys(a.o.caps || {}).length + Object.keys(b.o.caps || {}).length < 1) continue;
        var both = c.pct < 100 && a.pct >= 100 && b.pct >= 100, better = c.pct + 20 <= Math.min(a.pct, b.pct);
        if (!both && !better) continue;
        out.push({ a: a, b: b, c: c, both: both, text: a.o.n + ' alone reaches ' + a.pct + ' per cent of the threshold, and ' + b.o.n.charAt(0).toLowerCase() + b.o.n.slice(1) + ' alone ' + b.pct + ' per cent. Together, as “' + c.o.n + '”, they reach ' + c.pct + ' per cent.' + (both ? ' Neither is enough without the other.' : ' Together they do clearly better than either on its own.') });
      }
    });
    return out;
  }
  // a mark for each region, in shape as well as fill, so it reads in greyscale and in print
  var MARK = { invest: ['circle', true], protect: ['circle', false], further: ['square', true], restrict: ['square', false], none: ['cross', false] };
  function mark(g, x, y, reg, cls) {
    var k = MARK[reg] || MARK.none, c = 'th-dot reg-' + reg + (cls ? ' ' + cls : '');
    if (k[0] === 'circle') return svg('circle', { cx: x, cy: y, r: 8, class: c }, g);
    if (k[0] === 'square') return svg('rect', { x: x - 7.5, y: y - 7.5, width: 15, height: 15, class: c }, g);
    return svg('path', { d: 'M' + (x - 7) + ' ' + (y - 7) + 'L' + (x + 7) + ' ' + (y + 7) + 'M' + (x + 7) + ' ' + (y - 7) + 'L' + (x - 7) + ' ' + (y + 7), class: c + ' x' }, g);
  }
  function markIcon(reg) { var s0 = svg('svg', { width: 18, height: 18, viewBox: '0 0 18 18', class: 'th-mk', 'aria-hidden': 'true' }); mark(s0, 9, 9, reg); return s0; }

  // ---------- drawing ----------
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, a, p, t) { var e = document.createElementNS(NS, tag); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; if (p) p.appendChild(e); return e; }
  function chart(rs, host) {
    var W = 1000, H = 470, L = 70, R = 330, T = 20, B = 50, xmin = -40, xmax = 50, ymax = Math.max(140, Math.ceil(Math.max.apply(null, rs.map(function (r) { return r.pct; })) / 20) * 20 + 20);
    var X0 = function (g) { return L + (Math.max(xmin, Math.min(xmax, g)) - xmin) / (xmax - xmin) * (W - L - R); }, Y0 = function (p) { return T + (1 - Math.min(p, ymax) / ymax) * (H - T - B); };
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'th-chart', id: 'thChart', role: 'img', 'aria-label': 'Gain in throughput against worst harm' });
    svg('rect', { x: L, y: Y0(ymax), width: W - L - R, height: Y0(100) - Y0(ymax), class: 'th-band' }, s);
    svg('rect', { x: L, y: Y0(100), width: W - L - R, height: Y0(0) - Y0(100), class: 'th-ok' }, s);
    svg('text', { x: L + 8, y: Y0(ymax) + 18, class: 'th-lab' }, s, 'Intolerable harm in at least one scenario');
    svg('text', { x: L + 8, y: Y0(0) - 10, class: 'th-lab' }, s, 'Within tolerance in every scenario tested');
    svg('line', { x1: L, x2: W - R, y1: Y0(100), y2: Y0(100), class: 'th-thr' }, s);
    svg('line', { x1: X0(0), x2: X0(0), y1: T, y2: H - B, class: 'th-axis0' }, s);
    svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'th-axis' }, s); svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'th-axis' }, s);
    for (var g = xmin; g <= xmax; g += 10) { svg('text', { x: X0(g), y: H - B + 16, 'text-anchor': 'middle', class: 'th-tick' }, s, (g > 0 ? '+' : '') + g); }
    var ystep = [20, 50, 100, 200, 500, 1000].filter(function (q) { return ymax / q <= 10; })[0] || 2000; for (var p = 0; p <= ymax; p += ystep) { svg('text', { x: L - 6, y: Y0(p) + 4, 'text-anchor': 'end', class: 'th-tick' }, s, p); }
    svg('text', { x: (L + W - R) / 2, y: H - 10, 'text-anchor': 'middle', class: 'th-ax' }, s, 'Gain in throughput in normal operation (per cent)');
    svg('text', { x: 16, y: (T + H - B) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + (T + H - B) / 2 + ')', class: 'th-ax' }, s, 'Worst harm (per cent of the threshold)');
    // group options that land on the same point
    var spots = {};
    rs.forEach(function (r, i) { var k = Math.round(X0(r.gain)) + ',' + Math.round(Y0(r.pct)); (spots[k] = spots[k] || []).push(i); });
    Object.keys(spots).forEach(function (k) {
      var ids = spots[k], r0 = rs[ids[0]], x = X0(r0.gain), y = Y0(r0.pct);
      var gp = svg('g', { class: 'th-pt' + (ids.indexOf(ST.sel) >= 0 ? ' sel' : ''), 'data-opt': ids.join(' ') }, s);
      mark(gp, x, y, r0.reg);
      var near = Object.keys(spots).filter(function (k2) { if (k2 === k) return false; var q = k2.split(','); return Math.abs(q[0] - x) < 60 && Math.abs(q[1] - y) < 18 && (Number(q[0]) < x || (Number(q[0]) === x && Number(q[1]) < y)); }).length;
      svg('text', { x: x + 12, y: y - 8 + near * 16, class: 'th-num-l' }, gp, ids.map(function (i) { return i + 1; }).join(', '));
      gp.addEventListener('click', function () { ST.sel = ids[0]; paint(); });
    });
    // the key: every change, by number, on the right
    var kx = W - R + 24, ky = T + 6;
    svg('text', { x: kx, y: ky, class: 'th-ax' }, s, 'Changes');
    rs.forEach(function (r, i) {
      var lines = [], w = String(i + 1) + '. ' + r.o.n + (r.gain < xmin ? ' (off the chart, left)' : ''), cur = '';
      w.split(' ').forEach(function (t) { if ((cur + ' ' + t).trim().length > 40) { lines.push(cur.trim()); cur = t; } else cur += ' ' + t; }); if (cur.trim()) lines.push(cur.trim());
      var g = svg('g', { class: 'th-key' + (ST.sel === i ? ' sel' : ''), 'data-opt': i }, s);
      lines.forEach(function (l, j) { ky += 15; svg('text', { x: kx + (j ? 14 : 0), y: ky, class: 'th-ptl' }, g, l); });
      ky += 3; g.addEventListener('click', function () { ST.sel = i; paint(); });
    });
    host.appendChild(s);
  }
  function series(m, r, host) {
    var W = 900, H = 230, L = 60, R = 20, T = 14, B = 34, hours = Number(m.hours), ymax = Math.max(Number(m.threshold) * 1.25, Math.max.apply(null, Object.keys(r.res).map(function (k) { return r.res[k].peak; })) * 1.1);
    var X0 = function (h) { return L + h / (hours - 1) * (W - L - R); }, Y0 = function (v) { return T + (1 - v / ymax) * (H - T - B); };
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'th-series', id: 'thSeries' });
    svg('line', { x1: L, x2: W - R, y1: Y0(Number(m.threshold)), y2: Y0(Number(m.threshold)), class: 'th-thr' }, s);
    svg('text', { x: W - R, y: Y0(Number(m.threshold)) - 5, 'text-anchor': 'end', class: 'th-tick' }, s, 'Intolerable: a backlog of ' + m.threshold + ' ' + m.unit);
    svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'th-axis' }, s); svg('line', { x1: L, x2: L, y1: T, y2: H - B, class: 'th-axis' }, s);
    for (var h = 0; h < hours; h += 6) svg('text', { x: X0(h), y: H - B + 15, 'text-anchor': 'middle', class: 'th-tick' }, s, h + 'h');
    var dash = ['', '6 4', '2 3', '10 3 2 3', '1 2'];
    m.scenarios.forEach(function (sc, i) {
      var pts = r.res[sc.id].series.map(function (v, h) { return X0(h).toFixed(1) + ',' + Y0(v).toFixed(1); }).join(' ');
      svg('polyline', { points: pts, class: 'th-line', 'stroke-dasharray': dash[i % dash.length] }, s);
    });
    host.appendChild(s);
    host.appendChild(el('div', { class: 'th-legend' }, m.scenarios.map(function (sc, i) { return el('span', {}, [svg('svg', { width: 34, height: 10 }), document.createTextNode(' ' + sc.n + ': peak ' + Math.round(r.res[sc.id].peak))]); })));
    host.querySelectorAll('.th-legend svg').forEach(function (g, i) { svg('line', { x1: 0, x2: 34, y1: 5, y2: 5, class: 'th-line', 'stroke-dasharray': dash[i % dash.length] }, g); });
  }

  // ---------- editing ----------
  function num(v, on) { var i = el('input', { type: 'number', value: v == null ? '' : v, class: 'th-num' }); i.addEventListener('change', function () { on(i.value === '' ? '' : Number(i.value)); ST.dirty = true; paint(); }); return i; }
  function txt(v, on) { var i = el('input', { type: 'text', value: v || '', class: 'th-txt' }); i.addEventListener('change', function () { on(i.value); ST.dirty = true; paint(); }); return i; }
  function teams(m) { var a = []; m.stages.forEach(function (s) { s.teams.forEach(function (t) { a.push([t, s]); }); }); return a; }
  function editService(m, host) {
    host.appendChild(el('p', { class: 'muted sm', text: 'Work passes through the stages in order. A stage with more than one team adds their capacities together. The stage with the least capacity is the constraint.' }));
    host.appendChild(el('div', { class: 'th-form' }, [
      el('label', {}, ['Normal commitment today (' + m.unit + ' an hour) ', num(m.base, function (v) { m.base = v; })]),
      el('label', {}, ['Intolerable threshold: a backlog of ', num(m.threshold, function (v) { m.threshold = v; }), ' ' + m.unit]),
      el('label', {}, ['Hours run ', num(m.hours, function (v) { m.hours = Math.max(6, Math.min(336, v || 48)); })])]));
    var t = el('table', { class: 'th-tab' }, [el('thead', {}, [el('tr', {}, ['Stage', 'Team', 'Capacity an hour'].map(function (h) { return el('th', { text: h }); }))])]), tb = el('tbody'); t.appendChild(tb);
    m.stages.forEach(function (s) { s.teams.forEach(function (tm, j) { tb.appendChild(el('tr', {}, [el('td', {}, j ? [] : [txt(s.n, function (v) { s.n = v; })]), el('td', {}, [txt(tm.n, function (v) { tm.n = v; })]), el('td', {}, [num(tm.cap, function (v) { tm.cap = v; })])])); }); });
    host.appendChild(t);
  }
  function editScen(m, host) {
    host.appendChild(el('p', { class: 'muted sm', text: 'Severe but plausible disruptions. A team out of action has no capacity; a reduction multiplies a team or stage by a factor; a surge multiplies demand. Hours count from the start of the run.' }));
    var t = el('table', { class: 'th-tab' }, [el('thead', {}, [el('tr', {}, ['Scenario', 'Kind', 'Team or stage', 'Factor', 'From hour', 'To hour'].map(function (h) { return el('th', { text: h }); }))])]), tb = el('tbody'); t.appendChild(tb);
    var targets = teams(m).map(function (x) { return [x[0].id, x[0].n]; }).concat(m.stages.filter(function (s) { return s.teams.length > 1; }).map(function (s) { return [s.id, s.n + ' (whole stage)']; }));
    m.scenarios.forEach(function (sc) {
      var kind = el('select', {}, [['down', 'Team out of action'], ['reduce', 'Capacity reduced'], ['surge', 'Surge in demand']].map(function (k) { return el('option', { value: k[0], text: k[1] }); })); kind.value = sc.kind; kind.addEventListener('change', function () { sc.kind = kind.value; ST.dirty = true; paint(); });
      var tg = el('select', {}, targets.map(function (k) { return el('option', { value: k[0], text: k[1] }); })); tg.value = sc.target || ''; tg.disabled = sc.kind === 'surge'; tg.addEventListener('change', function () { sc.target = tg.value; ST.dirty = true; paint(); });
      tb.appendChild(el('tr', {}, [el('td', {}, [txt(sc.n, function (v) { sc.n = v; })]), el('td', {}, [kind]), el('td', {}, [tg]), el('td', {}, sc.kind === 'down' ? [] : [num(sc.factor, function (v) { sc.factor = v; })]), el('td', {}, [num(sc.from, function (v) { sc.from = v; })]), el('td', {}, [num(sc.to, function (v) { sc.to = v; })])]));
    });
    host.appendChild(t);
    host.appendChild(el('button', { class: 'btn sm', id: 'thAddScen', text: 'Add a scenario', onclick: function () { m.scenarios.push({ id: 's' + Date.now(), n: 'New scenario', kind: 'surge', factor: 1.2, from: 6, to: 12 }); ST.dirty = true; paint(); } }));
  }
  function editOpts(m, host) {
    host.appendChild(el('p', { class: 'muted sm', text: 'Candidate changes, as the design propositions in Model will set them out. Leave a capacity blank to keep today’s. A back-up team steps in when a team in its stage is out of action, after the detection delay: this is where a social condition, such as not noticed, enters the numbers.' }));
    var tm = teams(m), t = el('table', { class: 'th-tab' }), hr = el('tr', {}, [el('th', { text: 'Change' }), el('th', { text: 'Commitment an hour' })].concat(tm.map(function (x) { return el('th', { text: x[0].n }); })).concat([el('th', { text: 'Back-up capacity' }), el('th', { text: 'Detection delay (hours)' }), el('th', { text: '' })]));
    t.appendChild(el('thead', {}, [hr])); var tb = el('tbody'); t.appendChild(tb);
    var multi = m.stages.filter(function (s) { return s.teams.length > 1; })[0] || m.stages[0];
    m.options.forEach(function (o, i) {
      o.caps = o.caps || {};
      tb.appendChild(el('tr', {}, [el('td', {}, [txt(o.n, function (v) { o.n = v; })]), el('td', {}, [num(o.commit, function (v) { o.commit = v; })])].concat(tm.map(function (x) { return el('td', {}, [num(o.caps[x[0].id], function (v) { if (v === '') delete o.caps[x[0].id]; else o.caps[x[0].id] = v; })]); })).concat([
        el('td', {}, [num(o.backup ? o.backup.cap : '', function (v) { if (v === '' || !v) delete o.backup; else o.backup = Object.assign(o.backup || { stage: multi.id, detect: 0 }, { cap: v }); })]),
        el('td', {}, [num(o.backup ? o.backup.detect : '', function (v) { if (o.backup) o.backup.detect = v || 0; })]),
        el('td', {}, i ? [el('button', { class: 'btn sm', text: 'Remove', onclick: function () { m.options.splice(i, 1); ST.sel = null; ST.dirty = true; paint(); } })] : [])])));
    });
    host.appendChild(t);
    host.appendChild(el('button', { class: 'btn sm', id: 'thAddOpt', text: 'Add a change', onclick: function () { m.options.push({ id: 'o' + Date.now(), n: 'New change', commit: Number(m.base), caps: {} }); ST.dirty = true; paint(); } }));
  }

  // ---------- page ----------
  var HOST;
  function paint() {
    var m = model(), rs = evaluate(m), host = HOST; host.innerHTML = '';
    if (ST.sel != null && ST.sel >= rs.length) ST.sel = null;
    host.appendChild(el('div', { class: 'th-head' }, [
      el('p', { class: 'lead', text: 'Which changes would give more throughput while ensuring no intolerable harm?' }),
      el('p', { class: 'muted sm', id: 'thWhat', text: (m.illustrative ? 'This is ' + m.name.toLowerCase() + ', from the working note. Change the stages, scenarios and options to model your own service. ' : m.name + '. ') + 'Each change is run hour by hour through every scenario. The results show which changes stay within tolerance in the scenarios tested; they do not give the odds of any scenario happening.' })]));
    var bar = el('div', { class: 'row th-bar' }, [el('div', { class: 'cm-tabs th-tabs' }, [['results', 'Results'], ['service', 'The service'], ['scen', 'Scenarios'], ['opts', 'Changes']].map(function (t) { return el('button', { 'data-tab': t[0], class: ST.tab === t[0] ? 'on' : '', text: t[1], onclick: function () { ST.tab = t[0]; paint(); } }); }))]);
    var save = el('button', { class: 'btn sm warm', id: 'thSave', text: ST.dirty ? 'Save changes' : 'Saved', disabled: !ST.dirty, onclick: async function () { save.disabled = true; save.textContent = 'Saving'; try { var mm = model(); if (mm.illustrative) { mm.illustrative = false; mm.name = 'A model started from the illustrative service and changed by the team'; } await X.saveRow('tharm', { model: mm }, 'partly'); ST.dirty = false; paint(); } catch (e) { alert(e.message); paint(); } } });
    var reset = el('button', { class: 'btn sm', id: 'thReset', text: 'Start again from the illustrative service', onclick: function () { if (!confirm('Replace this model with the illustrative service?')) return; ST.m = clone(ILLUS); ST.sel = null; ST.dirty = true; paint(); } });
    bar.appendChild(save); bar.appendChild(reset); host.appendChild(bar);
    if (ST.tab === 'service') return editService(m, host);
    if (ST.tab === 'scen') return editScen(m, host);
    if (ST.tab === 'opts') return editOpts(m, host);
    var wrap = el('div', { class: 'th-wrap' }); host.appendChild(wrap);
    var left = el('div', { class: 'th-left' }); wrap.appendChild(left); chart(rs, left);
    var t = el('table', { class: 'th-tab', id: 'thTable' }), hr = el('tr', {}, ['Change', 'Gain in throughput', 'Headroom at the constraint'].concat(m.scenarios.map(function (s) { return 'Peak backlog: ' + s.n.toLowerCase(); })).concat(['Worst, as share of the threshold', 'Region']).map(function (h) { return el('th', { text: h }); }));
    t.appendChild(el('thead', {}, [hr])); var tb = el('tbody'); t.appendChild(tb);
    rs.forEach(function (r, i) {
      var tr = el('tr', { class: (ST.sel === i ? 'sel ' : '') + (r.pct >= 100 ? 'over' : ''), 'data-opt': i }, [el('td', { text: (i + 1) + '. ' + r.o.n + (r.over ? ' (commitment above capacity)' : '') }), el('td', { text: (r.gain > 0 ? '+' : '') + r.gain + '%' }), el('td', { text: r.head + '%' })].concat(m.scenarios.map(function (s) { var p = Math.round(r.res[s.id].peak); return el('td', { class: p >= Number(m.threshold) ? 'b' : '', text: p }); })).concat([el('td', { class: r.pct >= 100 ? 'b' : '', text: r.pct + '%' }), el('td', { text: REG[r.reg][0] })]));
      tr.addEventListener('click', function () { ST.sel = i; paint(); }); tb.appendChild(tr);
    });
    left.appendChild(t);
    left.appendChild(el('p', { class: 'muted sm', id: 'thUnits', text: 'Backlogs are counted in ' + m.unit + '. The threshold is a backlog of ' + m.threshold + '.' }));
    var IX = interactions(m, rs);
    if (IX.length) left.appendChild(el('div', { class: 'th-ix', id: 'thTogether' }, [el('h4', { text: 'Changes that work together' })].concat(IX.map(function (x) { return el('p', { text: x.text }); }))));
    var side = el('div', { class: 'th-side', id: 'thSide' }); wrap.appendChild(side);
    if (ST.sel == null) {
      side.appendChild(el('h4', { text: 'Reading the chart' }));
      Object.keys(REG).forEach(function (k) { var n = rs.filter(function (r) { return r.reg === k; }).length; side.appendChild(el('p', { class: 'th-regp' }, [markIcon(k), el('b', { text: REG[k][0] + ': ' }), document.createTextNode(REG[k][1] + '. ' + (n ? n + (n === 1 ? ' change.' : ' changes.') : 'None.'))])); });
      side.appendChild(el('p', { class: 'muted sm', text: 'Select a change on the chart or in the table to see the backlog hour by hour in each scenario.' }));
    } else {
      var r = rs[ST.sel];
      side.appendChild(el('h4', { text: (ST.sel + 1) + '. ' + r.o.n }));
      side.appendChild(el('p', { text: REG[r.reg][0] + '. ' + REG[r.reg][1] + '.' }));
      side.appendChild(el('p', { text: 'Commitment ' + r.o.commit + ' ' + m.unit + ' an hour against a capacity of ' + r.cap + '. The constraint: ' + r.con.join(' and ') + '.' }));
      var ws = m.scenarios.filter(function (s) { return s.id === r.worstSc; })[0];
      side.appendChild(el('p', { text: ws && r.worst > 0 ? 'Worst scenario: ' + ws.n.toLowerCase() + ', with a backlog of ' + Math.round(r.worst) + ' (' + r.pct + ' per cent of the threshold).' : 'No backlog builds up in any scenario.' }));
      if (r.o.backup) side.appendChild(el('p', { text: 'A back-up team of ' + r.o.backup.cap + ' an hour steps in ' + (Number(r.o.backup.detect) ? Number(r.o.backup.detect) + ' hours after a team goes down (the time it takes to notice).' : 'as soon as a team goes down.') }));
      side.appendChild(el('button', { class: 'btn sm', text: 'Clear', onclick: function () { ST.sel = null; paint(); } }));
      var sh = el('div', { class: 'th-sh' }); left.insertBefore(sh, t); sh.appendChild(el('h4', { text: 'Backlog hour by hour: ' + r.o.n })); series(m, r, sh);
    }
  }
  function css() {
    if (document.getElementById('tharmCss')) return;
    var s = document.createElement('style'); s.id = 'tharmCss';
    s.textContent = [
      '.th-tabs{display:flex;gap:0;border:1px solid var(--line)}.th-tabs button{flex:1;border:0;border-right:1px solid var(--line);background:none;color:inherit;padding:7px 12px;cursor:pointer;font:inherit;font-size:14px}.th-tabs button:last-child{border-right:0}.th-tabs button.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0);font-weight:600}',
      '.th-ok{fill:rgba(var(--hi),.03)}.th-dot.reg-protect,.th-dot.reg-restrict{fill:var(--bg,#fff)}.th-dot.reg-further{fill:rgb(var(--tx))}.th-dot.x{stroke-width:3;fill:none}.th-regp{display:block}.th-regp .th-mk{display:inline-block;vertical-align:-4px;margin-right:6px}.th-mk .th-dot{stroke-width:2}',
      '.th-ix{border:1px solid var(--line);border-left:4px solid var(--accent,#e07030);padding:8px 12px;margin:10px 0}.th-ix h4{margin:0 0 4px}.th-ix p{margin:4px 0}',
      '.th-head .lead{font-size:17px;margin:4px 0 4px}.th-bar{gap:8px;align-items:center;margin:8px 0 12px;flex-wrap:wrap}.th-tabs{flex:0 0 auto;min-width:420px}',
      '.th-wrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}@media(max-width:1100px){.th-wrap{grid-template-columns:1fr}}',
      '.th-side{border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:13px}.th-side h4{margin:6px 0}',
      '.th-chart,.th-series{width:100%;height:auto;display:block}.th-chart text,.th-series text{fill:rgb(var(--tx));font-family:inherit}',
      '.th-band{fill:rgba(var(--hi),.10)}.th-thr{stroke:rgb(var(--tx));stroke-width:2}.th-axis{stroke:rgba(var(--hi),.6)}.th-axis0{stroke:rgba(var(--hi),.3)}',
      '.th-lab{font-size:13px}.th-tick{font-size:11px}.th-ax{font-size:12px}.th-ptl{font-size:12px;cursor:pointer}',
      '.th-num-l{font-size:12px;font-weight:600}.th-key{cursor:pointer}.th-key.sel text{font-weight:700}.th-pt{cursor:pointer}.th-dot{fill:var(--node,#fff);stroke:rgb(var(--tx));stroke-width:2.4}.th-dot.reg-invest{fill:rgb(var(--tx))}.th-pt.sel .th-dot{stroke:var(--accent);stroke-width:4}.th-pt.sel .th-ptl{font-weight:700}',
      '.th-line{fill:none;stroke:rgb(var(--tx));stroke-width:2}.th-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;margin:4px 0 10px}',
      '.th-tab{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}.th-tab th,.th-tab td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}.th-tab th{font-weight:600;font-size:12px}',
      '#thTable tbody tr{cursor:pointer}#thTable tr.sel td{background:rgba(var(--hi),.10)}#thTable td.b{font-weight:700}',
      '.th-num{width:80px}.th-txt{width:100%;min-width:160px}.th-form{display:flex;flex-wrap:wrap;gap:16px;margin:8px 0}.th-form label{display:flex;gap:6px;align-items:center}'].join('\n');
    document.head.appendChild(s);
  }
  function render(main, x) {
    X = x; el = x.el; css();
    var r = X.row('tharm'), saved = r && r.content && r.content.model ? JSON.stringify(r.content.model) : null;
    if (ST.savedSig !== saved && !ST.dirty) { ST.m = null; ST.savedSig = saved; }
    HOST = el('div', { id: 'thHost' }); main.appendChild(HOST); paint();
  }
  window.VTTharm = { render: render, evaluate: evaluate, interactions: interactions, markIcon: function (reg) { return markIcon(reg); }, REG: REG, ILLUS: ILLUS };
})();
