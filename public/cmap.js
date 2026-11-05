// The connected map (Evaluate). One map of the service that unfolds over time, from decades to minutes
// across the six phases of an event (Buchanan and Denyer, 2012), zooms by Beer's recursions, and reveals
// layers on demand: the route of the event, the threshold and barriers, the twelve nots, the technical
// mechanisms, single points, flows by kind, what should happen, evidence, when last checked, and capitals.
// It reads the session's map (tile "cmap") and the shared steps (inventory). It draws; it does not edit.
(function () {
  'use strict';
  var X, el, NS = 'http://www.w3.org/2000/svg';
  var ST = { zoom: 'tf', scale: 'day', op: 'day', sel: null, cursor: null, playing: false, timer: null, tab: 'layers', notCell: null, lvl: null,
    L: { route: true, threshold: true, value: false, nots: false, mechs: false, spof: false, should: false, evidence: false, checked: false, caps: false, flows: { work: true, info: true, authority: true, money: false, people: false } } };
  var NOTN = { imagined: 'Not imagined', searched: 'Not searched for', noticed: 'Not noticed', told: 'Not told', integrated: 'Not integrated', understood: 'Not understood', owned: 'Not owned', willing: 'Not willing', able: 'Not able', acted: 'Not acted on', corrected: 'Not corrected', renewed: 'Not renewed' };
  var NOTK = Object.keys(NOTN);
  var LVN = { institutional: ['F', 'Field (institutional)'], organisational: ['O', 'Organisation'], interpersonal: ['T', 'Team and relationships (interpersonal)'], intrapersonal: ['P', 'Person (intrapersonal)'] };
  var MECHN = { buffer: 'Buffer', redundancy: 'Redundancy', flexibility: 'Flexibility', variety: 'Variety', options: 'Options', connectivity: 'Connectivity', centrality: 'Centrality', coupling: 'Coupling', modularity: 'Modularity', balancing: 'Balancing feedback', reinforcing: 'Reinforcing feedback', delay: 'Delay' };
  var CAPN = { human: ['H', 'Human'], financial: ['F', 'Financial'], manufactured: ['M', 'Manufactured'], information: ['I', 'Information'], social: ['S', 'Social and relationship'], natural: ['N', 'Natural'] };
  var FLOWSTYLE = { work: { c: '#e07030', w: 3.2, d: '' }, info: { c: '#5b8fd0', w: 1.6, d: '' }, authority: { c: '#a07ad0', w: 1.8, d: '7 3 2 3' }, money: { c: '#4fae7a', w: 1.8, d: '2 3' }, people: { c: '#c8a052', w: 1.8, d: '9 4' } };
  var KINDN = { part: 'Part of the service', actor: 'Who does the work', record: 'A record or rule', event: 'Something that happened', decision: 'A decision', condition: 'A condition', warning: 'A warning', impact: 'The harm', missing: 'Should exist, but nobody carries it', below: 'Happened, but stayed short of the threshold' };
  var CH = 0, BW = 158, BH = 50, BHB = 36, LW = 150, BEFW = 186, AFTW = 64, TOPH = 34, MAPW = 1100;

  function ms(t) { if (!t) return null; var s = String(t); if (/^\d{4}$/.test(s)) s += '-01-01'; else if (/^\d{4}-\d{2}$/.test(s)) s += '-01'; if (s.length === 10) s += 'T00:00'; return Date.parse(s + ':00Z'); }
  function svg(tag, attrs, parent, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function wrap(s, n, max) { var w = String(s).split(' '), L = [], c = ''; w.forEach(function (x) { if ((c + ' ' + x).trim().length > n) { if (c) L.push(c.trim()); c = x; } else c += ' ' + x; }); if (c.trim()) L.push(c.trim()); if (L.length > max) { L = L.slice(0, max); L[max - 1] = L[max - 1].replace(/.{0,2}$/, '…'); } return L; }
  function fmtT(v) { var d = new Date(v), sc = ST.scale; if (sc === 'minutes' || sc === 'day') return d.toISOString().slice(11, 16); if (sc === 'months') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); return String(d.getUTCFullYear()); }
  function css() {
    if (document.getElementById('cmapCss')) return;
    var s = document.createElement('style'); s.id = 'cmapCss';
    s.textContent = [
      'body.cm-wide main{max-width:none}',
      '.cm-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:4px 0 10px}',
      '.cm-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}.cm-seg button{background:none;border:0;padding:5px 11px;color:inherit;font:inherit;font-size:13px;cursor:pointer}.cm-seg button.on{background:rgba(var(--hi),.16);font-weight:600}',
      '.cm-crumb{display:flex;gap:6px;align-items:center;font-size:13px}.cm-crumb a{cursor:pointer;text-decoration:underline}.cm-crumb b{font-weight:600}',
      '.cm-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}@media(max-width:1100px){.cm-wrap{grid-template-columns:1fr}}',
      '.cm-mapbox{overflow:auto;border:1px solid var(--line);border-radius:12px;background:rgba(var(--hi),.02);max-height:78vh}',
      '.cm-side{border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13px;max-height:78vh;overflow:auto}',
      '.cm-side h4{margin:12px 0 6px;font-size:13px}.cm-side label{display:flex;gap:7px;align-items:flex-start;margin:4px 0;cursor:pointer}.cm-side .sw{display:inline-block;width:22px;height:0;border-top:3px solid;margin-top:8px;flex:none}',
      '.cm-tabs{display:flex;gap:6px;margin-bottom:8px}.cm-tabs button{flex:1;border:1px solid var(--line);background:none;color:inherit;border-radius:8px;padding:5px;cursor:pointer;font:inherit;font-size:13px}.cm-tabs button.on{background:rgba(var(--hi),.14);font-weight:600}',
      '.cm-svg text{font-family:inherit;fill:rgb(var(--tx))}.cm-svg .rowlab{font-size:12px;font-weight:600}.cm-svg .sm{font-size:10px}.cm-svg .xs{font-size:9px}',
      '.cm-svg .box rect.b{fill:var(--node);stroke:rgba(var(--hi),.45);stroke-width:1.3}.cm-svg .box{cursor:pointer}.cm-svg .box.dim{opacity:.22}.cm-svg .box.sel rect.b{stroke:var(--accent);stroke-width:2.6}',
      '.cm-svg .box.k-event rect.b{fill:rgba(var(--hi),.10)}.cm-svg .box.k-impact rect.b{stroke:#d9472b;stroke-width:2.4}.cm-svg .box.k-missing rect.b{fill:url(#cmHatch);stroke-dasharray:4 3}.cm-svg .box.absent rect.b{fill:none;stroke-dasharray:5 4}.cm-svg .box.future{opacity:.18}',
      '.cm-svg .ev-stated rect.b{stroke-dasharray:6 3}.cm-svg .ev-assumed rect.b{stroke-dasharray:2 3}',
      '.cm-svg .lane{fill:rgba(var(--hi),.025)}.cm-svg .lane.alt{fill:rgba(var(--hi),.055)}.cm-svg .grid{stroke:rgba(var(--hi),.10)}',
      '.cm-svg .phase{fill:rgba(var(--hi),.08);stroke:rgba(var(--hi),.18)}.cm-svg .phase.alt{fill:rgba(var(--hi),.15)}',
      '.cm-svg .route{fill:none;stroke:var(--accent);stroke-width:9;stroke-opacity:.30;stroke-linejoin:round;stroke-linecap:round}.cm-svg .vroute{fill:none;stroke:#4fae7a;stroke-width:7;stroke-opacity:.35;stroke-dasharray:10 6}',
      '.cm-svg .stop circle{fill:var(--accent)}.cm-svg .stop text{fill:#fff;font-size:10px;font-weight:700}',
      '.cm-svg .thr{stroke:#d9472b;stroke-width:4}.cm-svg .chip rect{fill:var(--accent)}.cm-svg .chip text{fill:#fff;font-size:9.5px;font-weight:600}.cm-svg .chip.c-spof rect{fill:#d9472b}.cm-svg .chip.c-mechs rect{fill:#6b5aa8}.cm-svg .chip.c-checked rect{fill:#7a6f63}',
      '.cm-svg .bar.failed{fill:rgb(var(--tx))}.cm-svg .bar.held{fill:none;stroke:rgb(var(--tx))}.cm-svg .bar.weak{fill:rgba(var(--hi),.5)}.cm-svg .bar.missing{fill:none;stroke:rgb(var(--tx));stroke-dasharray:2 2}',
      '.cm-svg .link.faint{opacity:.32}.cm-svg .link.faint.on{opacity:1}.cm-svg .cursor{stroke:var(--accent);stroke-width:2}.cm-svg .link.dim{opacity:.12}',
      '.cm-fact{border-top:1px solid var(--line);padding:8px 0}.cm-fact .tag{font-size:11px;opacity:.75}',
      '.cm-grid table{border-collapse:collapse;font-size:11.5px;width:100%}.cm-grid td,.cm-grid th{border:1px solid var(--line);padding:2px 4px;text-align:center}.cm-grid td.n{cursor:pointer}.cm-grid td.n.on{background:rgba(224,112,48,.35)}.cm-grid td:first-child,.cm-grid th:first-child{text-align:left}',
      '.cm-should{display:flex;gap:6px;overflow:auto;margin:0 0 10px}.cm-should div{min-width:150px;border:1px dashed var(--line);border-radius:8px;padding:6px 8px;font-size:11.5px}.cm-should b{display:block}',
      '.cm-time{display:flex;align-items:center;gap:10px;margin:0 0 8px;font-size:13px}.cm-time input{flex:1}',
      '.cm-ph{border-collapse:collapse;width:100%;min-width:1100px;font-size:12px}.cm-ph th,.cm-ph td{border:1px solid var(--line);padding:6px;vertical-align:top;text-align:left}.cm-ph thead th{font-size:12.5px}.cm-ph tbody th{width:130px;font-size:12.5px}.cm-ph td{width:15%}.cm-ph td.pat{outline:3px solid rgb(var(--tx));outline-offset:-3px}',
      '.ph-not,.ph-tech,.ph-box{display:block;border:1px solid rgba(var(--hi),.5);border-radius:6px;padding:4px 6px;margin:0 0 5px;line-height:1.3}.ph-tech{background:rgba(var(--hi),.16)}.ph-box{border-style:dashed;opacity:.85}.ph-key{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0}.ph-key span{display:inline-block;margin:0}',
      '@media print{.cm-side,.cm-bar,.cm-time{display:none}.cm-wrap{display:block}.cm-mapbox{max-height:none;overflow:visible;border:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------- reading the data ----------
  var M, byId, kids;
  function load() {
    var r = X.row('cmap'); M = r && r.content && r.content.map; if (!M) return false;
    byId = {}; M.items.forEach(function (x) { byId[x.id] = x; });
    if (!ST.zoomOk) { ST.zoom = (M.ZOOM[1] || M.ZOOM[0]).id; if (M.startScale && M.SCALES.some(function (x) { return x.id === M.startScale; })) { ST.scale = M.startScale; ST.op = M.startScale === 'day' || M.startScale === 'minutes' ? 'day' : 'usual'; } ST.zoomOk = true; }
    return true;
  }
  var zi = function (z) { return M.ZOOM.map(function (x) { return x.id; }).indexOf(z); };
  var scale = function () { return M.SCALES.filter(function (s) { return s.id === ST.scale; })[0] || M.SCALES[0]; };
  // The box that stands for an item at the current zoom (its container when the item sits deeper), or null.
  function visId(id) {
    var x = byId[id]; if (!x) return null;
    var guard = 0;
    while (x && zi(x.z) > zi(ST.zoom) && guard++ < 6) { var p = M.parent[x.z]; x = p ? byId[p] : null; }
    if (!x || x.z !== ST.zoom) return null;
    return placedPos[x.id] ? x.id : null;
  }
  function absent(x) { return (x.absentIn || []).indexOf(ST.op) >= 0; }
  function inside(boxId) { // every item that stands under this box at the current zoom (itself and deeper)
    var out = []; M.items.forEach(function (x) { var y = x, g = 0; while (y && g++ < 6) { if (y.id === boxId) { out.push(x.id); return; } if (zi(y.z) <= zi(ST.zoom)) return; var p = M.parent[y.z]; y = p ? byId[p] : null; } }); return out;
  }

  // ---------- layout ----------
  var placedPos = {}, layoutInfo;
  function layout() {
    var sc = scale(), from = ms(sc.from), to = ms(sc.to), W = Math.max(760, MAPW - LW - BEFW - AFTW - 4) * (sc.id === 'minutes' ? 1.25 : 1);
    var X0 = LW + BEFW, xOf = function (t) { return X0 + (Math.max(from, Math.min(to, t)) - from) / (to - from) * (W - BW) ; };
    var rows = {}, after = {}; M.ROWS.forEach(function (r) { rows[r[0]] = { before: [], placed: [] }; after[r[0]] = 0; });
    CH = (ST.L.nots || ST.L.mechs || ST.L.spof || ST.L.checked) ? 15 : 0;
    var vis = M.items.filter(function (x) { return x.z === ST.zoom; });
    vis.forEach(function (x) {
      var t = ms(x.t), t2 = x.t2 === null ? Infinity : ms(x.t2 || x.t);
      if (t > to) { after[x.row]++; return; }
      if (t < from) { if (t2 >= from) rows[x.row].before.push(x); return; }
      rows[x.row].placed.push(x);
    });
    placedPos = {}; var y = TOPH + 22, laneY = {};
    M.ROWS.forEach(function (r) {
      var R = rows[r[0]];
      // order stops that share a band by their sequence, spread evenly across the band
      var bands = {}; R.placed.forEach(function (x) { if (x.seq) { var k = x.t + '|' + x.t2; (bands[k] = bands[k] || []).push(x); } });
      R.placed.forEach(function (x) {
        var t = ms(x.t), b = x.seq ? bands[x.t + '|' + x.t2] : null;
        if (b) { var t2 = ms(x.t2), n = b.length, k = b.sort(function (a, c) { return a.seq - c.seq; }).indexOf(x); x._x = xOf(t + (t2 - t) * (k + .5) / (n + .5)) - 20; }
        else x._x = xOf(t);
      });
      R.placed.sort(function (a, b) { return a._x - b._x; });
      var lanes = [];
      R.placed.forEach(function (x) { var k = 0; while (lanes[k] != null && lanes[k] + 8 > x._x) k++; lanes[k] = x._x + BW + (CH ? 60 : 0); x._lane = k; });
      R.before.forEach(function (x, k) { x._lane = k; });
      var h = Math.max(Math.max(1, lanes.length) * (BH + 10 + CH), R.before.length * (BHB + 6 + CH)) + 14;
      laneY[r[0]] = { y: y, h: h };
      R.placed.forEach(function (x) { placedPos[x.id] = { x: x._x, y: y + 8 + x._lane * (BH + 10 + CH), item: x }; });
      R.before.forEach(function (x) { placedPos[x.id] = { x: LW + 14, y: y + 8 + x._lane * (BHB + 6 + CH), item: x, before: true }; });
      y += h;
    });
    layoutInfo = { from: from, to: to, W: W, X0: X0, xOf: xOf, laneY: laneY, H: y + 8, total: X0 + W + AFTW, after: after };
    return layoutInfo;
  }

  // ---------- drawing ----------
  function render(main, x, opts) {
    opts = opts || {}; X = x; el = x.el; css();
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: (opts.back || [])[1] || '#tools', text: (opts.back || [])[0] || '← Tools' }), el('button', { class: 'btn sm', text: 'Print', onclick: function () { window.print(); } })]));
    X.head(X.S.data.session.name || 'Model', opts.from === 'test' ? 'The connected map, in Test' : 'The connected map', 'One map of the service, unfolding over time from decades to minutes and opening level by level, with what lies behind it revealed one layer at a time.');
    if (!load()) {
      main.appendChild(el('div', { class: 'glass', style: 'padding:16px;margin-top:10px' }, [el('p', { text: 'This engagement has no connected map yet. The Friendly Fire worked case has one: load it from Frame (“Load the Friendly Fire worked case”), on a session of its own.' })]));
      return;
    }
    if (M.case === 'friendlyfire') main.appendChild(el('p', { class: 'meta', id: 'cmCase', text: 'Friendly Fire, as at 15 April 1994: a published case, built from public sources. Where the pack does not say which row, level or box something belongs on, the team has placed it, and says so.' }));
    var host = el('div', { id: 'cmHost' }); main.appendChild(host); draw(host);
  }
  function rerender() { var h = document.getElementById('cmHost'); if (h) { h.innerHTML = ''; draw(h); } }

  // ---------- the phases view: Beer's functions down the side, the six phases across ----------
  var KINDOF = { imagined: 'belief', searched: 'belief', noticed: 'belief', told: 'belief', integrated: 'belief', understood: 'belief', owned: 'desire and opportunity', willing: 'desire', able: 'opportunity', acted: 'action', corrected: 'updating', renewed: 'updating' };
  var PROWS = [['above', 'Level above', 'commands, the services at home, government'], ['policy', 'Policy', 'purpose and identity'], ['intel', 'Intelligence', 'outside and future'], ['control', 'Control', 'now and inside'], ['audit', 'Audit', 'checking reality'], ['coord', 'Coordination', 'avoiding collisions'], ['ops', 'Operations', 'the crews']];
  function viewSeg() { return el('div', { class: 'cm-seg', id: 'cmView', role: 'tablist', 'aria-label': 'View' }, [['map', 'The map'], ['phases', 'By phase']].map(function (v) { return el('button', { 'data-view': v[0], class: (ST.view || 'map') === v[0] ? 'on' : '', text: v[1], onclick: function () { stop(); ST.view = v[0]; rerender(); } }); })); }
  function phaseOf(t) { var P = M.PHASES, k = 0; if (t == null || isNaN(t)) return 0; for (var i = 0; i < P.length; i++) if (t >= ms(P[i][1])) k = i; return k; }
  function rowOfBox(b) { if (!b) return null; if (b.z === M.ZOOM[0].id) return b.row === 'env' ? null : 'above'; return PROWS.some(function (r) { return r[0] === b.row; }) ? b.row : null; }
  function phasesView(host) {
    var D = ST.depth || (ST.depth = { recognise: false });
    var dep = el('div', { class: 'cm-seg', id: 'cmDepth', 'aria-label': 'Depth' }, [
      el('button', { class: 'on', 'data-depth': 'see', title: 'The conditions in each function and phase', text: 'See' }),
      el('button', { class: D.recognise ? 'on' : '', 'data-depth': 'recognise', title: 'Outline where social and technical conditions line up', text: 'Recognise', onclick: function () { D.recognise = !D.recognise; rerender(); } }),
      el('button', { 'data-depth': 'explain', disabled: true, title: 'No theorised mechanisms are recorded for this case yet', text: 'Explain' })]);
    host.appendChild(el('div', { class: 'cm-bar no-print' }, [viewSeg(), dep]));
    var cells = {}; PROWS.forEach(function (r) { cells[r[0]] = M.PHASES.map(function () { return { soc: [], tech: [], box: [] }; }); });
    var put = function (row, k, kind, x) { if (row && cells[row]) cells[row][k][kind].push(x); };
    M.items.filter(function (x) { return x.z === M.ZOOM[0].id && x.row !== 'env' && x.row !== 'person'; }).forEach(function (x) { put('above', phaseOf(ms(x.t)), 'box', x); });
    (M.nots || []).forEach(function (n) { var b = byId[n.at]; put(n.fn || rowOfBox(b), phaseOf(b ? ms(b.t) : null), 'soc', n); });
    (M.mechs || []).forEach(function (m) { var bs = (m.at || []).map(function (a) { return byId[a]; }).filter(Boolean), b = bs.filter(function (x) { return rowOfBox(x); })[0] || bs[0], t = Math.min.apply(null, bs.map(function (x) { return ms(x.t); })); put(rowOfBox(b), phaseOf(t), 'tech', { n: (MECHN[m.mech] || m.mech) + ', too ' + m.dir + ': ' + m.n, src: m.src }); });
    (M.spof || []).forEach(function (sp) { var b = byId[sp.at]; put(rowOfBox(b), phaseOf(b ? ms(b.t) : null), 'tech', { n: 'Single point: ' + sp.n, src: '' }); });
    var t = el('table', { class: 'cm-ph', id: 'cmPhases' }), hr = el('tr', {}, [el('th', { text: 'Function' })].concat(M.PHASES.map(function (p, k) { return el('th', {}, [el('div', { text: (k + 1) + '. ' + p[0] }), el('div', { class: 'xs muted', text: (k === 0 ? 'and before, ' : '') + fmtSpan(p) })]); })));
    t.appendChild(el('thead', {}, [hr])); var tb = el('tbody'); t.appendChild(tb);
    var nPat = 0;
    PROWS.forEach(function (r) {
      tb.appendChild(el('tr', { 'data-row': r[0] }, [el('th', {}, [el('div', { text: r[1] }), el('div', { class: 'xs muted', text: r[2] })])].concat(cells[r[0]].map(function (c) {
        var pat = D.recognise && c.soc.length && c.tech.length; if (pat) nPat++;
        return el('td', { class: pat ? 'pat' : '' }, c.box.map(function (x) { return el('div', { class: 'ph-box', title: x.src || '', text: x.n }); })
          .concat(c.soc.map(function (n) { return el('div', { class: 'ph-not', title: n.src || '' }, [el('b', { text: NOTN[n.not] }), el('i', { text: ' (' + KINDOF[n.not] + ')' }), document.createTextNode(': ' + n.n)]); }))
          .concat(c.tech.map(function (m) { return el('div', { class: 'ph-tech', title: m.src || '', text: m.n }); })));
      }))));
    });
    host.appendChild(el('div', { class: 'cm-mapbox', style: 'max-height:none' }, [t]));
    host.appendChild(el('p', { class: 'meta', id: 'cmPhNote', text: 'Each not is placed in the function that should have caught it, and in the phase of the box it sits on. Technical conditions and single points sit in the function and phase of the boxes they concern. The level above holds what was in place above the Task Force. ' + (D.recognise ? 'Outlined: ' + nPat + ' cells where social and technical conditions line up.' : 'Press Recognise to outline where social and technical conditions line up.') + ' The placements are the team\u2019s proposed coding, to be checked.' }));
    host.appendChild(el('div', { class: 'ph-key sm' }, [el('span', { class: 'ph-not', text: 'Not ... (kind): social condition' }), el('span', { class: 'ph-tech', text: 'Technical condition' }), el('span', { class: 'ph-box', text: 'In place at the level above' })]));
  }
  function fmtSpan(p) { var f = function (s) { return new Date(ms(s)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); }, a = f(p[1]), b = f(p[2]); return a === b ? a : a + ' to ' + b; }

  function draw(host) {
    if (ST.view === 'phases') return phasesView(host);
    var sc = scale(), hw = host.clientWidth || 1200; MAPW = hw > 1100 ? hw - 356 : hw;
    // toolbar: where you are, the time scale, the operating state
    var crumbs = [];
    M.ZOOM.forEach(function (z, k) { if (k > zi(ST.zoom)) return; if (k) crumbs.push(el('span', { text: '›' })); crumbs.push(k === zi(ST.zoom) ? el('b', { text: z.n }) : el('a', { 'data-zoom': z.id, text: z.n, onclick: function () { ST.zoom = z.id; ST.sel = null; rerender(); } })); });
    if (zi(ST.zoom) > 0) crumbs.push(el('button', { class: 'btn sm', id: 'cmUp', style: 'margin-left:6px', text: 'Zoom out', onclick: function () { ST.zoom = M.ZOOM[zi(ST.zoom) - 1].id; ST.sel = null; rerender(); } }));
    var seg = el('div', { class: 'cm-seg', id: 'cmScales', role: 'tablist', 'aria-label': 'Time scale' }, M.SCALES.map(function (s) { return el('button', { 'data-scale': s.id, class: s.id === ST.scale ? 'on' : '', title: s.d, text: s.n, onclick: function () { stop(); ST.scale = s.id; ST.cursor = null; rerender(); } }); }));
    var op = el('select', { id: 'cmOp', 'aria-label': 'Operating state' }, M.STATES.map(function (s) { var o = el('option', { value: s.id, text: s.n }); if (s.id === ST.op) o.selected = true; return o; }));
    op.onchange = function () { ST.op = op.value; rerender(); };
    host.appendChild(el('div', { class: 'cm-bar no-print' }, [viewSeg(), el('div', { class: 'cm-crumb', id: 'cmCrumb' }, crumbs), seg, el('label', { class: 'sm' }, ['Operating state ', op])]));
    // the time strip: play, scrub
    var L = layout();
    var range = el('input', { type: 'range', id: 'cmScrub', min: String(L.from), max: String(L.to), step: String(Math.max(1, Math.round((L.to - L.from) / 400))), value: String(ST.cursor == null ? L.to : ST.cursor), 'aria-label': 'Move through time' });
    range.oninput = function () { stop(); ST.cursor = Number(range.value); paint(); };
    var play = el('button', { class: 'btn sm solid', id: 'cmPlay', text: ST.playing ? 'Pause' : 'Play', onclick: function () { ST.playing ? stop() : start(); } });
    var readout = el('span', { id: 'cmNow', style: 'min-width:120px', text: '' });
    host.appendChild(el('div', { class: 'cm-time no-print' }, [play, range, readout, el('button', { class: 'btn sm', text: 'Show all', onclick: function () { stop(); ST.cursor = null; rerender(); } })]));
    if (ST.L.should) host.appendChild(shouldStrip());
    var mapbox = el('div', { class: 'cm-mapbox', id: 'cmMapbox' });
    var side = el('div', { class: 'cm-side', id: 'cmSide' });
    host.appendChild(el('div', { class: 'cm-wrap' }, [mapbox, side]));
    var s = svg('svg', { class: 'cm-svg', id: 'cmSvg', width: L.total, height: L.H, viewBox: '0 0 ' + L.total + ' ' + L.H, role: 'img', 'aria-label': 'The connected map' }, null);
    mapbox.appendChild(s);
    var defs = svg('defs', {}, s), pat = svg('pattern', { id: 'cmHatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs); svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'rgba(160,152,144,.45)', 'stroke-width': 2 }, pat);
    Object.keys(FLOWSTYLE).forEach(function (f) { var mk = svg('marker', { id: 'cmA_' + f, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs); svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: FLOWSTYLE[f].c }, mk); });
    // rows, phases, ticks
    var g0 = svg('g', {}, s);
    M.ROWS.forEach(function (r, k) { var ly = L.laneY[r[0]]; svg('rect', { class: 'lane' + (k % 2 ? ' alt' : ''), x: 0, y: ly.y, width: L.total, height: ly.h }, g0); wrap(r[1], 18, 2).forEach(function (t, j) { svg('text', { class: 'rowlab', x: 10, y: ly.y + 20 + j * 14 }, g0, t); }); if (L.after[r[0]]) svg('text', { class: 'sm', x: L.X0 + L.W + 8, y: ly.y + 22 }, g0, 'Later: ' + L.after[r[0]]); });
    svg('text', { class: 'sm', x: LW + 14, y: TOPH + 14 }, g0, 'In place before ' + fmtT(L.from));
    svg('line', { class: 'grid', x1: L.X0 - 8, y1: TOPH, x2: L.X0 - 8, y2: L.H }, g0);
    M.PHASES.forEach(function (p, k) { var a = ms(p[1]), b = ms(p[2]); if (b < L.from || a > L.to) return; var x1 = L.xOf(a), x2 = Math.max(x1 + 2, L.xOf(b) + (b >= L.to ? BW : 0)); svg('rect', { class: 'phase' + (k % 2 ? ' alt' : ''), x: x1, y: 2, width: x2 - x1, height: 18, rx: 3 }, g0); if (x2 - x1 > 60) svg('text', { class: 'xs', x: x1 + 5, y: 14 }, g0, (k + 1) + '. ' + p[0]); });
    ticks(g0, L);
    var gL = svg('g', { id: 'cmLinks' }, s), gR = svg('g', { id: 'cmRoute' }, s), gB = svg('g', { id: 'cmBoxes' }, s), gT = svg('g', { id: 'cmTop' }, s);
    links(gL, L); boxes(gB, L); routes(gR, L); threshold(gT, L);
    svg('line', { class: 'cursor', id: 'cmCursor', x1: 0, y1: TOPH - 6, x2: 0, y2: L.H, style: 'display:none' }, gT);
    side.appendChild(sidePanel());
    paint();
  }

  function ticks(g, L) {
    var sc = ST.scale, from = L.from, to = L.to, list = [];
    var d = new Date(from);
    if (sc === 'decades') { for (var y = Math.ceil(d.getUTCFullYear() / 10) * 10; y <= 2000; y += 10) list.push([Date.UTC(y, 0, 1), String(y)]); }
    else if (sc === 'years') { for (var y2 = d.getUTCFullYear(); y2 <= 2000; y2++) list.push([Date.UTC(y2, 0, 1), String(y2)]); }
    else if (sc === 'months') { for (var m = 0; m < 30; m++) { var t = Date.UTC(1993, 6 + m, 1); if (t > to) break; if (m % 3 === 0) list.push([t, new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })]); } }
    else { var step = sc === 'day' ? 3600e3 : 120e3; for (var t2 = Math.ceil(from / step) * step; t2 <= to; t2 += step) list.push([t2, new Date(t2).toISOString().slice(11, 16)]); }
    list.forEach(function (k) { if (k[0] < from || k[0] > to) return; var x = L.xOf(k[0]); svg('line', { class: 'grid', x1: x, y1: TOPH, x2: x, y2: L.H }, g); svg('text', { class: 'xs', x: x + 3, y: TOPH - 2 }, g, k[1]); });
  }

  function boxes(g, L) {
    Object.keys(placedPos).forEach(function (id) {
      var p = placedPos[id], x = p.item, bh = p.before ? BHB : BH, cls = (p.before ? 'box before' : 'box') + ' k-' + x.kind + (absent(x) ? ' absent' : '') + (ST.L.evidence ? ' ev-' + (x.team && x.team.indexOf('dates') >= 0 ? 'assumed' : x.grade || 'stated') : '');
      var b = svg('g', { class: cls, 'data-id': id, transform: 'translate(' + p.x + ',' + p.y + ')' }, g);
      svg('title', {}, b, x.n + (x.tl ? ' (' + x.tl + ')' : '') + (absent(x) && x.absentWhy ? '. ' + x.absentWhy : ''));
      svg('rect', { class: 'b', width: BW, height: bh, rx: x.kind === 'event' || x.kind === 'impact' ? 14 : 6 }, b);
      if (x.kind === 'below') svg('path', { d: 'M8,' + (BH / 2) + ' l6,-6 l6,6 l-6,6 z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, style: 'stroke:rgb(var(--tx))' }, b);
      var lines = wrap(x.n, 28, p.before ? 2 : 3); lines.forEach(function (t, j) { svg('text', { class: 'sm', x: x.kind === 'below' ? 26 : 8, y: 14 + j * 12 }, b, t); });
      if (x.tl && !p.before && ST.scale !== 'decades') svg('text', { class: 'xs', x: BW - 6, y: bh - 4, 'text-anchor': 'end', style: 'opacity:.7' }, b, x.tl.length > 22 ? '' : x.tl);
      if (x.open && M.ZOOM.some(function (z) { return z.id === x.open; }) && zi(x.open) > zi(ST.zoom)) { var o = svg('g', { class: 'open', 'data-open': x.open, transform: 'translate(' + (BW - 18) + ',-8)' }, b); svg('rect', { width: 18, height: 18, rx: 9, style: 'fill:var(--accent)' }, o); svg('text', { x: 9, y: 13, 'text-anchor': 'middle', style: 'fill:#fff;font-weight:700;font-size:13px' }, o, '+'); o.addEventListener('click', function (e) { e.stopPropagation(); ST.zoom = x.open; ST.sel = null; rerender(); }); }
      if (x.gap) svg('text', { x: 4, y: bh - 4, style: 'font-weight:700;font-size:12px;fill:var(--accent)' }, b, '?');
      // layers drawn on the box
      var chips = [];
      var under = inside(id);
      if (ST.L.nots) { var ns = M.nots.filter(function (n) { return under.indexOf(n.at) >= 0 && (!ST.lvl || n.lvl === ST.lvl); }); if (ns.length) chips.push([ns.length + (ns.length === 1 ? ' not ' : ' nots ') + uniq(ns.map(function (n) { return LVN[n.lvl][0]; })).join(''), 'nots']); }
      if (ST.L.mechs) { var mm = M.mechs.filter(function (m) { return m.at.some(function (a) { return under.indexOf(a) >= 0; }); }); if (mm.length) chips.push([MECHN[mm[0].mech] + ': too ' + mm[0].dir + (mm.length > 1 ? ' +' + (mm.length - 1) : ''), 'mechs']); }
      if (ST.L.spof && M.spof.some(function (sp) { return under.indexOf(sp.at) >= 0; })) chips.push(['single point', 'spof']);
      if (ST.L.checked && x.checked) chips.push(['last checked: see panel', 'checked']);
      var cx = 0; chips.forEach(function (c) { var cg = svg('g', { class: 'chip c-' + c[1], transform: 'translate(' + cx + ',' + (bh + 1) + ')' }, b), r = svg('rect', { height: 13, rx: 6 }, cg), tx = svg('text', { x: 5, y: 10 }, cg, c[0]), w = (tx.getComputedTextLength ? tx.getComputedTextLength() : c[0].length * 6) + 10; r.setAttribute('width', w); cx += w + 3; });
      if (ST.L.caps && x.caps && x.caps.length) x.caps.forEach(function (c, k) { var cg = svg('g', { transform: 'translate(' + (BW - 14 - k * 13) + ',' + (bh - 26) + ')' }, b); svg('rect', { width: 12, height: 12, rx: 2, style: 'fill:none;stroke:rgb(var(--tx))' }, cg); svg('text', { x: 6, y: 9.5, 'text-anchor': 'middle', class: 'xs', style: 'font-weight:700' }, cg, CAPN[c][0]); });
      // barriers sit on the left edge of the stop they guard
      if (ST.L.threshold) { var bs = M.barriers.filter(function (br) { return under.indexOf(br.at) >= 0; }); bs.slice(0, 6).forEach(function (br, k) { svg('rect', { class: 'bar ' + br.state, x: -7, y: 3 + k * 8, width: 5, height: 6 }, b); }); if (bs.length > 6) svg('text', { class: 'xs', x: -9, y: bh + 9, 'text-anchor': 'end' }, b, '×' + bs.length); }
      b.addEventListener('click', function () { ST.sel = id; ST.tab = 'details'; paint(); var sd = document.getElementById('cmSide'); sd.innerHTML = ''; sd.appendChild(sidePanel()); });
    });
  }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function centre(id) { var p = placedPos[id]; return p ? [p.x + BW / 2, p.y + (p.before ? BHB : BH) / 2] : null; }

  function links(g, L) {
    var seen = {};
    M.links.forEach(function (k) {
      if (!ST.L.flows[k.flow]) return; if (k.value && !ST.L.value) return;
      var a = visId(k.a), b = visId(k.b); if (!a || !b || a === b) return;
      var ba = placedPos[a].before, bb = placedPos[b].before; if (ba && bb) return;
      var key = a + '>' + b + '>' + k.flow; if (seen[key]) { seen[key].n++; seen[key].lab.textContent = '×' + seen[key].n; return; }
      var p1 = centre(a), p2 = centre(b), st = FLOWSTYLE[k.flow];
      var x1 = p1[0] + (p2[0] > p1[0] ? BW / 2 : 0), x2 = p2[0] - (p2[0] > p1[0] ? BW / 2 : 0), mx = (x1 + x2) / 2;
      var d = 'M' + x1 + ',' + p1[1] + ' C' + mx + ',' + p1[1] + ' ' + mx + ',' + p2[1] + ' ' + x2 + ',' + p2[1];
      var lg = svg('g', { class: 'link' + (ba || bb ? ' faint' : ''), 'data-a': a, 'data-b': b, 'data-flow': k.flow, 'data-t': String(ms(byId[k.a].t) || 0) }, g);
      svg('title', {}, lg, k.n + (k.why ? ': ' + k.why : ''));
      svg('path', { d: d, fill: 'none', stroke: st.c, 'stroke-width': st.w, 'stroke-dasharray': st.d || null, 'marker-end': 'url(#cmA_' + k.flow + ')', opacity: .85 }, lg);
      var mid = [(x1 + x2) / 2, (p1[1] + p2[1]) / 2];
      if (k.state === 'failed') { svg('path', { d: 'M' + (mid[0] - 5) + ',' + (mid[1] - 5) + ' l10,10 m0,-10 l-10,10', stroke: 'rgb(var(--tx))', style: 'stroke:rgb(var(--tx))', 'stroke-width': 2.2 }, lg); }
      var lab = svg('text', { class: 'xs', x: mid[0] + 7, y: mid[1] - 4 }, lg, '');
      var dot = svg('circle', { r: 4, fill: st.c, class: 'mover', style: 'display:none' }, lg); var am = svg('animateMotion', { dur: '2.4s', repeatCount: 'indefinite', path: d }, dot);
      seen[key] = { n: 1, lab: lab };
    });
  }

  function routes(g, L) {
    function line(list, cls, numbered) {
      var pts = [], nums = [], last = null;
      list.forEach(function (id, k) { var v = visId(id); if (!v || v === last || placedPos[v].before) return; last = v; pts.push({ id: v, src: id, k: k }); });
      if (pts.length < 2) return;
      var d = pts.map(function (p, k) { var c = centre(p.id); return (k ? 'L' : 'M') + c[0] + ',' + c[1]; }).join(' ');
      svg('path', { class: cls, d: d, id: cls === 'route' ? 'cmRoutePath' : null }, g);
      if (numbered) pts.forEach(function (p, k) { var c = centre(p.id), sg = svg('g', { class: 'stop', 'data-stop': p.id, 'data-t': String(ms(byId[p.src].t) || 0), transform: 'translate(' + (c[0] - BW / 2 - 2) + ',' + (c[1] - BH / 2 - 2) + ')' }, g); svg('title', {}, sg, 'Stop ' + (k + 1) + ' on the route: ' + byId[p.src].n); svg('circle', { r: 9 }, sg); svg('text', { x: 0, y: 3.5, 'text-anchor': 'middle' }, sg, String(k + 1)); });
    }
    if (ST.L.value) line(M.valueRoute, 'vroute', false);
    if (ST.L.route) line(M.route, 'route', true);
  }

  function threshold(g, L) {
    if (!ST.L.threshold || !M.threshold) return;
    var v = visId(M.threshold.at); if (!v || v !== M.threshold.at) return;
    var p = placedPos[v]; if (p.before) return;
    var x = p.x - 12;
    svg('line', { class: 'thr', x1: x, y1: TOPH, x2: x, y2: L.H }, g);
    var t = svg('g', { transform: 'translate(' + (x - 4) + ',' + (TOPH + 12) + ')' }, g); svg('text', { class: 'sm', 'text-anchor': 'end', style: 'font-weight:700;fill:#d9472b' }, t, 'Intolerable threshold');
  }

  // Apply the cursor, the selection and the fading without redrawing.
  function paint() {
    var s = document.getElementById('cmSvg'); if (!s) return;
    var L = layoutInfo, cur = ST.cursor, now = document.getElementById('cmNow'), cl = document.getElementById('cmCursor');
    if (now) now.textContent = cur == null ? 'Everything in this window' : 'At ' + fmtT(cur);
    if (cl) { if (cur == null) cl.style.display = 'none'; else { var cx = L.xOf(cur); cl.style.display = ''; cl.setAttribute('x1', cx); cl.setAttribute('x2', cx); } }
    var related = null;
    if (ST.sel) { related = {}; related[ST.sel] = 1; s.querySelectorAll('.link').forEach(function (l) { if (l.dataset.a === ST.sel) related[l.dataset.b] = 1; if (l.dataset.b === ST.sel) related[l.dataset.a] = 1; }); }
    var cellBoxes = null;
    if (ST.notCell) { cellBoxes = {}; M.nots.filter(function (n) { return n.not === ST.notCell[0] && n.lvl === ST.notCell[1]; }).forEach(function (n) { var v = visId(n.at); if (v) cellBoxes[v] = 1; }); }
    s.querySelectorAll('.box').forEach(function (b) {
      var id = b.dataset.id, p = placedPos[id], fut = cur != null && !p.before && ms(p.item.t) > cur;
      b.classList.toggle('future', !!fut); b.classList.toggle('sel', id === ST.sel);
      b.classList.toggle('dim', !!((related && !related[id]) || (cellBoxes && !cellBoxes[id])));
    });
    s.querySelectorAll('.link').forEach(function (l) {
      var t = Number(l.dataset.t), fut = cur != null && t > cur;
      l.style.opacity = fut ? .1 : ''; l.classList.toggle('on', !!(ST.sel && (l.dataset.a === ST.sel || l.dataset.b === ST.sel))); l.classList.toggle('dim', !!(related && !(related[l.dataset.a] && related[l.dataset.b] && (l.dataset.a === ST.sel || l.dataset.b === ST.sel))));
      var m = l.querySelector('.mover'); if (m) m.style.display = ST.playing && !fut ? '' : 'none';
    });
    s.querySelectorAll('.stop').forEach(function (st) { st.style.display = cur != null && Number(st.dataset.t) > cur ? 'none' : ''; });
  }
  function start() {
    var L = layoutInfo; ST.playing = true; if (ST.cursor == null || ST.cursor >= L.to) ST.cursor = L.from;
    var b = document.getElementById('cmPlay'); if (b) b.textContent = 'Pause';
    var step = (L.to - L.from) / 240;
    ST.timer = setInterval(function () { ST.cursor = Math.min(L.to, ST.cursor + step); var r = document.getElementById('cmScrub'); if (r) r.value = String(ST.cursor); paint(); if (ST.cursor >= L.to) stop(); }, 50);
    paint();
  }
  function stop() { if (ST.timer) clearInterval(ST.timer); ST.timer = null; ST.playing = false; var b = document.getElementById('cmPlay'); if (b) b.textContent = 'Play'; paint(); }

  // ---------- the side panel ----------
  function sidePanel() {
    var wrapEl = el('div', {});
    var tabs = [['layers', 'Layers'], ['details', 'Details'], ['findings', 'Findings']];
    wrapEl.appendChild(el('div', { class: 'cm-tabs', role: 'tablist' }, tabs.map(function (t) { return el('button', { 'data-tab': t[0], class: ST.tab === t[0] ? 'on' : '', text: t[1], onclick: function () { ST.tab = t[0]; var sd = document.getElementById('cmSide'); sd.innerHTML = ''; sd.appendChild(sidePanel()); } }); })));
    if (ST.tab === 'layers') wrapEl.appendChild(layersPanel());
    else if (ST.tab === 'details') wrapEl.appendChild(detailsPanel());
    else wrapEl.appendChild(findingsPanel());
    return wrapEl;
  }
  function tick(key, label, help, sub) {
    var on = sub ? ST.L.flows[key] : ST.L[key];
    var i = el('input', { type: 'checkbox', 'data-layer': key }); i.checked = !!on;
    i.onchange = function () { if (sub) ST.L.flows[key] = i.checked; else ST.L[key] = i.checked; if (key !== 'nots') ST.notCell = ST.notCell; rerender(); };
    var sw = sub ? el('span', { class: 'sw', style: 'border-top-color:' + FLOWSTYLE[key].c + ';border-top-style:' + (FLOWSTYLE[key].d ? (key === 'money' ? 'dotted' : 'dashed') : 'solid') + ';border-top-width:' + Math.max(2, FLOWSTYLE[key].w) + 'px' }) : null;
    return el('label', {}, [i, sw, el('span', {}, [el('span', { text: label }), help ? el('div', { class: 'muted sm', text: help }) : null])]);
  }
  function layersPanel() {
    var d = el('div', {});
    d.appendChild(el('h4', { text: 'The event' }));
    d.appendChild(tick('route', 'The route of the event', 'Numbered stops in the order they happened'));
    d.appendChild(tick('threshold', 'The threshold and barriers', 'The threshold that must not be crossed; barriers on the stops they guard (filled: failed)'));
    d.appendChild(tick('value', 'What made it work', (M && M.valueNote) || 'The route to value: what made it work on ordinary days'));
    d.appendChild(el('h4', { text: 'Reveal' }));
    d.appendChild(tick('nots', 'The twelve nots', 'How viability was lost, at four social levels'));
    if (ST.L.nots) d.appendChild(notsGrid());
    d.appendChild(tick('mechs', 'Technical mechanisms', 'Too little or too much, by capital'));
    d.appendChild(tick('spof', 'Single points', 'Parts with no other route'));
    d.appendChild(el('h4', { text: 'Flows' }));
    M.FLOWS.forEach(function (f) { d.appendChild(tick(f[0], f[1], null, true)); });
    d.appendChild(el('div', { class: 'muted sm', text: 'A cross on a flow marks where it failed on the day. Press Play to see the flows move.' }));
    d.appendChild(el('h4', { text: 'Read' }));
    d.appendChild(tick('should', 'What should happen', 'The success journey above the map'));
    d.appendChild(tick('evidence', 'Evidence', 'Line texture: solid observed, dashed stated, dotted assumed or placed by the team; “?” where something is still to find'));
    d.appendChild(tick('checked', 'When last checked', 'Controls nobody looked at again'));
    d.appendChild(tick('caps', 'Capitals', 'What each part holds: H human, F financial, M manufactured, I information, S social and relationship, N natural'));
    d.appendChild(el('p', { class: 'muted sm', style: 'margin-top:10px', text: 'Reveal one or two layers at a time; the map stays readable that way.' }));
    return d;
  }
  function notsGrid() {
    var levels = Object.keys(LVN);
    var head = el('tr', {}, [el('th', { text: 'Social level' })].concat(levels.map(function (l) { return el('th', { title: LVN[l][1], text: LVN[l][0] }); })));
    var rows = NOTK.map(function (k) {
      return el('tr', {}, [el('td', { text: NOTN[k] })].concat(levels.map(function (l) {
        var n = M.nots.filter(function (x) { return x.not === k && x.lvl === l; }).length;
        var on = ST.notCell && ST.notCell[0] === k && ST.notCell[1] === l;
        return el('td', { class: n ? 'n' + (on ? ' on' : '') : '', 'data-cell': k + '|' + l, text: n ? String(n) : '', onclick: n ? function () { ST.notCell = on ? null : [k, l]; paint(); var sd = document.getElementById('cmSide'); sd.innerHTML = ''; sd.appendChild(sidePanel()); } : null });
      })));
    });
    var filt = el('div', { class: 'cm-seg', style: 'margin:6px 0' }, [['', 'All levels']].concat(levels.map(function (l) { return [l, LVN[l][0]]; })).map(function (o) { return el('button', { class: (ST.lvl || '') === o[0] ? 'on' : '', title: o[0] ? LVN[o[0]][1] : 'All four', text: o[1], onclick: function () { ST.lvl = o[0] || null; rerender(); } }); }));
    return el('div', { class: 'cm-grid' }, [filt, el('table', {}, [head].concat(rows)), el('div', { class: 'muted sm', style: 'margin-top:4px', text: 'F field, O organisation, T team and relationships, P person. Click a number to see where it sits on the map. Placed by the team from the pack.' })]);
  }
  function detailsPanel() {
    var d = el('div', {});
    if (!ST.sel) { d.appendChild(el('p', { class: 'muted', text: 'Click any box on the map to see what it is, where it came from, and everything that sits on it. The rest of the map fades.' })); return d; }
    var x = byId[ST.sel], under = inside(ST.sel);
    d.appendChild(el('h4', { style: 'margin-top:0;font-size:15px', text: x.n }));
    var facts = [['What it is', KINDN[x.kind] || x.kind], ['Row', (M.ROWS.filter(function (r) { return r[0] === x.row; })[0] || [0, ''])[1]], ['Level of the map', (M.ZOOM.filter(function (z) { return z.id === x.z; })[0] || {}).n], ['When', x.tl || ''], ['Source', x.src]];
    if (absent(x)) facts.push(['In this operating state', x.absentWhy || 'Not there']);
    if (x.docd) facts.push(['What should happen', x.docd]);
    if (x.checked) facts.push(['When last checked', x.checked]);
    if (x.gap) facts.push(['Still to find', x.gap]);
    if (x.caps && x.caps.length) facts.push(['Capitals it holds', x.caps.map(function (c) { return CAPN[c][1]; }).join(', ') + ' (placed by the team)']);
    if (x.team) facts.push(['Placed by the team', 'Which ' + x.team.map(function (t) { return { row: 'row', dates: 'dates', order: 'order inside the time band' }[t] || t; }).join(', ') + ': the pack does not say']);
    d.appendChild(el('dl', {}, facts.reduce(function (a, f) { return a.concat([el('dt', { class: 'muted sm', style: 'margin-top:6px', text: f[0] }), el('dd', { style: 'margin:0', text: f[1] })]); }, [])));
    if (x.open) d.appendChild(el('button', { class: 'btn sm', style: 'margin-top:8px', text: 'Open one level down', onclick: function () { ST.zoom = x.open; ST.sel = null; rerender(); } }));
    var ns = M.nots.filter(function (n) { return under.indexOf(n.at) >= 0; });
    if (ns.length) { d.appendChild(el('h4', { text: 'The nots here (' + ns.length + ')' })); d.appendChild(el('ul', { style: 'padding-left:18px;margin:0' }, ns.map(function (n) { return el('li', {}, [el('b', { text: NOTN[n.not] + ', ' + LVN[n.lvl][1] + ': ' }), document.createTextNode(n.n)]); }))); }
    var mm = M.mechs.filter(function (m) { return m.at.some(function (a) { return under.indexOf(a) >= 0; }); });
    if (mm.length) { d.appendChild(el('h4', { text: 'Technical mechanisms' })); mm.forEach(function (m) { d.appendChild(el('p', { style: 'margin:4px 0' }, [el('b', { text: MECHN[m.mech] + ', too ' + m.dir + ' (' + m.caps.map(function (c) { return CAPN[c][1].toLowerCase(); }).join(', ') + '): ' }), document.createTextNode(m.n)])); }); }
    var sp = M.spof.filter(function (s) { return under.indexOf(s.at) >= 0; });
    if (sp.length) { d.appendChild(el('h4', { text: 'Single points' })); sp.forEach(function (s) { d.appendChild(el('p', { style: 'margin:4px 0', text: s.n + '. Other route: ' + s.alt + '.' })); }); }
    var bs = M.barriers.filter(function (b) { return under.indexOf(b.at) >= 0; });
    if (bs.length) { d.appendChild(el('h4', { text: 'Barriers on this stop' })); d.appendChild(el('ul', { style: 'padding-left:18px;margin:0' }, bs.map(function (b) { return el('li', { text: b.n + ' (' + b.kind + '): ' + (b.state === 'failed' ? 'failed' : b.state) + '. ' + b.tested + '.' }); }))); }
    var ins = M.links.filter(function (k) { return under.indexOf(k.b) >= 0 && under.indexOf(k.a) < 0; }), outs = M.links.filter(function (k) { return under.indexOf(k.a) >= 0 && under.indexOf(k.b) < 0; });
    if (ins.length || outs.length) { d.appendChild(el('h4', { text: 'What flows in and out' })); d.appendChild(el('ul', { style: 'padding-left:18px;margin:0' }, ins.map(function (k) { return el('li', { text: 'In: ' + k.n + (k.why ? '. ' + k.why : '') }); }).concat(outs.map(function (k) { return el('li', { text: 'Out: ' + k.n + (k.why ? '. ' + k.why : '') }); })))); }
    var ri = M.route.indexOf(ST.sel); if (ri >= 0) d.appendChild(el('p', { class: 'muted sm', style: 'margin-top:8px', text: 'On the route of the event.' }));
    d.appendChild(el('button', { class: 'btn sm', style: 'margin-top:10px', text: 'Clear the selection', onclick: function () { ST.sel = null; paint(); var sd = document.getElementById('cmSide'); sd.innerHTML = ''; sd.appendChild(sidePanel()); } }));
    return d;
  }
  function fact(text, tag) { return el('div', { class: 'cm-fact' }, [el('div', { text: text }), el('div', { class: 'tag', text: tag })]); }
  function findingsPanel() {
    var d = el('div', { id: 'cmFindings' });
    var rb = M.barriers.filter(function (b) { return M.route.indexOf(b.at) >= 0 && b.kind !== 'recover'; });
    var failed = rb.filter(function (b) { return b.state === 'failed'; });
    d.appendChild(fact('The route of the event passes ' + M.route.length + ' stops and meets ' + rb.length + (rb.length === 1 ? ' barrier' : ' barriers') + ' before the harm. ' + (failed.length === rb.length ? (rb.length === 1 ? 'It failed.' : 'All ' + rb.length + ' failed.') + ' The route is a single chain, so had any one of them held, the route would have stopped there.' : failed.length + ' of ' + rb.length + ' failed; ' + (rb.length - failed.length) + ' held or were not tested.'), 'Computed from the map'));
    var sp = M.spof.filter(function (s) { return M.route.indexOf(s.at) >= 0; });
    d.appendChild(fact(sp.length + ' of the ' + M.spof.length + ' single points sit on the route: ' + sp.map(function (s) { return s.n.toLowerCase(); }).join('; ') + '.', 'Computed from the map and the dependencies'));
    var fl = {}; M.links.forEach(function (k) { if (k.state === 'failed') fl[k.flow] = (fl[k.flow] || 0) + 1; });
    d.appendChild(fact('Flows that failed: ' + M.FLOWS.filter(function (f) { return fl[f[0]]; }).map(function (f) { return fl[f[0]] + ' ' + f[1].split(':')[0].toLowerCase(); }).join(', ') + '.', 'Computed from the map'));
    var orgZ = M.ZOOM[1] || M.ZOOM[0], orgN = orgZ.n.replace(/^The /, 'the '), tf = M.items.filter(function (x) { return x.z === orgZ.id; }), CARRY = ['actor', 'part', 'record', 'decision'], miss = M.ROWS.filter(function (r) { return ['ops', 'coord', 'audit', 'control', 'intel', 'policy'].indexOf(r[0]) >= 0 && !tf.some(function (x) { return x.row === r[0] && CARRY.indexOf(x.kind) >= 0; }); });
    d.appendChild(fact(miss.length ? 'At ' + orgN + ', nobody carries ' + miss.map(function (r) { return r[1].toLowerCase(); }).join(' or ') + ': the row holds no person, part, record or decision.' : 'Every function has someone or something carrying it at ' + orgN + '.', 'Computed from the map (Beer’s functions)'));
    var byL = {}; M.nots.forEach(function (n) { byL[n.lvl] = (byL[n.lvl] || 0) + 1; });
    d.appendChild(fact('The nots, by social level: ' + Object.keys(LVN).map(function (l) { return (byL[l] || 0) + ' ' + LVN[l][1].toLowerCase(); }).join(', ') + '.', 'Counted; placed by the team from the pack'));
    var mis = M.nots.filter(function (n) { var it = byId[n.at]; return it && ((n.lvl === 'institutional' && it.z !== 'field') || (n.lvl === 'intrapersonal' && it.z === 'field')); });
    if (mis.length) d.appendChild(fact(mis.length + (mis.length === 1 ? ' not' : ' nots') + ' sit at a different level from the box they show up on: decided in one place, failing in another.', 'Counted; placed by the team'));
    var ab = M.items.filter(function (x) { return (x.absentIn || []).indexOf('day') >= 0; });
    if (ab.length) d.appendChild(fact('On the morning of 14 April, missing from the usual day: ' + ab.map(function (x) { return x.absentWhy ? x.absentWhy.toLowerCase() : x.n; }).join('; ') + '.', 'From the case pack'));
    var r1 = M.mechs.filter(function (m) { return m.mech === 'redundancy'; })[0];
    if (r1) d.appendChild(fact(r1.n + '.', 'From the case pack: redundancy, too much'));
    if (M.gaps && M.gaps.length) { d.appendChild(el('h4', { text: 'Still to find' })); d.appendChild(el('ul', { style: 'padding-left:18px;margin:0' }, M.gaps.map(function (g) { return el('li', { text: g }); }))); }
    return d;
  }
  function shouldStrip() {
    var inv = X.invData ? X.invData() : {}, ps = inv.processes || [];
    if (!ps.length) return el('p', { class: 'muted sm', text: 'No steps of what should happen are recorded yet.' });
    return el('div', { class: 'cm-should', id: 'cmShould' }, ps.map(function (p, k) { return el('div', { title: p.fails || '' }, [el('b', { text: (k + 1) + '. ' + p.n }), el('span', { class: 'muted', text: p.fails ? 'What happened: ' + p.fails : '' })]); }));
  }

  window.VTCMap = { render: render, state: ST };
})();
