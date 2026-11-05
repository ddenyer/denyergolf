// What this engagement shows (26 October 2026: nothing is switched off). A facilitator shows or hides
// practices, views, tools and models for a client (Project › What's shown). Everything keeps running in
// the background on the shared map; anything hidden can be revealed, already populated, with the date and
// reason recorded. Conditions and capitals are never hidden. Anything hidden disappears from the tabs, the hub,
// tool lists, reports and the evidence request; nothing is deleted. Saved in the 'scope' tile:
//   { set: id of the starting set used, on: { id: true|false }, why: { toolkit id: reason }, sets: [{ id, name, on }] }
// With no scope saved, everything is on (and the optional framing tools follow the older "Tools chosen").
(function () {
  'use strict';
  var row = null, legacy = {}, queue = Promise.resolve();
  // Internal ids are kept so saved choices still apply (29 October 2026): problem is Frame, analyse is Diagnose,
  // evaluate is Model, test is Test (new: until it is set, it follows what was saved for Evaluate), model is the maps of the system.
  var AN = { outside: 1, disagree: 1, evframe: 1, dependants: 1, horizon: 1, rca: 1, 't.howsaid': 1, 't.isnot': 1, goright: 1, nots: 1, techmech: 1, rivals: 1, people: 1, futures: 1, combos: 1 };
  var EV = { tharm: 1, cmap: 1, abm: 1, bia: 1, risk: 1, scentest: 1 };
  var TE = { plans: 1, exlog: 1, selfassess: 1, forcefield: 1, pace: 1, mvc: 1, bcp: 1, dr: 1, steer: 1 };
  var PRACTICES = ['problem', 'analyse', 'evaluate', 'test', 'model'];
  var STEPS = ['problem', 'analyse', 'evaluate', 'test'];
  // conditions and capitals are never hidden from the record
  var LOCKED = { 'v.capitals': 1, nots: 1, techmech: 1 };
  var locked = function (id) { return !!LOCKED[id]; };
  function practiceOf(id) {
    if (PRACTICES.indexOf(id) >= 0) return null;
    if (/^(p|tk)\./.test(id)) return 'problem';
    if (/^v\./.test(id) || AN[id]) return 'analyse';
    if (EV[id]) return 'evaluate';
    if (TE[id]) return 'test';
    return 'model';
  }
  var active = function () { return !!(row && row.content && row.content.on); };
  function raw(id) {
    if (!active()) return /^tk\./.test(id) ? !!legacy[id.slice(3)] : true;
    var on = row.content.on;
    if (id === 'test' && !Object.prototype.hasOwnProperty.call(on, 'test')) return raw('evaluate');
    return Object.prototype.hasOwnProperty.call(on, id) ? !!on[id] : !/^tk\./.test(id);
  }
  function on(id) { if (LOCKED[id]) return true; var p = practiceOf(id); return raw(id) && (!p || raw(p)); }
  // Show or hide one part, with the reason and the date kept in the log. Works from anywhere (the protocol, Project).
  async function change(X, id, onv, why) {
    if (LOCKED[id] && !onv) throw new Error('Conditions and capitals are never hidden from the record');
    var ids = []; catalogue().forEach(function (g) { ids.push(g.id); g.items.forEach(function (x) { ids.push(x.id); }); });
    var cur = (row && row.content) || {}, nc = JSON.parse(JSON.stringify(cur));
    if (!nc.on) { nc.on = {}; ids.forEach(function (k) { nc.on[k] = raw(k); }); nc.why = {}; Object.keys(legacy).forEach(function (k) { nc.why[k] = legacy[k].why || ''; }); }
    nc.on[id] = !!onv; nc.changed = true; nc.why = nc.why || {}; if (why) nc.why[id] = why;
    nc.log = (nc.log || []).concat([{ id: id, shown: !!onv, why: why || '', at: new Date().toISOString(), by: X.S.data.as === 'master' ? 'David (master)' : 'Facilitator' }]).slice(-200);
    var d = await X.api({ action: 'p_save', tile_key: 'scope', status: 'done', summary: (onv ? 'Revealed: ' : 'Hidden: ') + id + (why ? ' (' + why + ')' : ''), base_version: row ? row.version : null, content: nc });
    X.S.data.tiles = (X.S.data.tiles || []).filter(function (t) { return t.tile_key !== 'scope'; }); X.S.data.tiles.push(d.tile); row = d.tile;
    if (window.VTNav && window.VTNav.redraw) window.VTNav.redraw();
    return d.tile;
  }

  // ---------- the catalogue of what can be switched, built from the other modules ----------
  var VDESC = { analyse: 'The four forms of evidence, at a glance', sources: 'Everything gathered, tagged and read', levels: 'What has been found at each level, from the sector to the person', capitals: 'What has been found for each of the six capitals', outside: 'Inquiries, inquests, regulators’ reports and research', models: 'How far the evidence supports each model', outcomes: 'Is the evidence enough? The eleven outcomes', request: 'The evidence asked for, and what has come back' };
  function catalogue() {
    var D = window.PROBLEM || {}, A = window.VTAnalyse || {}, M = window.VTModel || {}, G = [];
    var prob = [{ id: 'p.canvas', n: 'The canvas', d: 'Every box of the frame on one screen, for agreeing it and signing' },
      { id: 'p.board', n: 'Workshop board', d: 'The frame as coloured lanes of notes, for a big screen in the room' },
      { id: 'p.views', n: 'Differing views', d: 'Questions put to the room, each person answering alone' },
      { id: 'p.tools', n: 'All tools', d: 'The earlier, fuller tools behind the frame (reasons, the service, stakeholders)' }];
    (D.toolkit || []).forEach(function (t) { prob.push({ id: 'tk.' + t.id, n: t.name, d: (t.by ? t.by + '. ' : '') + (t.prompt || ''), sub: 'Optional framing tools' }); });
    G.push({ id: 'problem', name: 'Frame', d: 'What are we working on, and what is the question? The guided framing, the canvas, how we might help, the question and testing the frame. Frame produces the system.', items: prob });
    var col = (A.VIEWS || []).filter(function (v) { return v[2] === 'c'; }).map(function (v) { return { id: v[0] === 'outside' ? 'outside' : 'v.' + v[0], n: v[1], d: VDESC[v[0]] || '', sub: 'Data collection' }; });
    var tools = [];
    (A.TOOLS || []).forEach(function (g) { g[1].forEach(function (t) { if (t.href || t.view) return; var mid = (A.TOOLIDS || {})[t.id]; tools.push({ id: mid || 't.' + t.id, n: t.n, d: t.does, sub: 'Data analysis: ' + g[0].toLowerCase() }); }); });
    G.push({ id: 'analyse', name: 'Diagnose', d: 'How does this system work and fail now, and why? Collecting the evidence, and the analysis under the two headings of the formulation.', items: col.concat(tools) });
    var ev = []; (A.MTOOLS || []).forEach(function (g) { g[1].forEach(function (t) { ev.push({ id: t.id, n: t.n, d: t.does, sub: g[0] }); }); });
    G.push({ id: 'evaluate', name: 'Model', d: 'What changes would make it work better and fail better, and do they hold up under pressure? The model, run forward, and the design propositions tested in it.', items: ev });
    var te = []; (A.TTOOLS || []).forEach(function (g) { g[1].forEach(function (t) { te.push({ id: t.id, n: t.n, d: t.does, sub: g[0] }); }); });
    G.push({ id: 'test', name: 'Test', d: 'Do the changes work in use, for the people who run the service? The trial in the organisation (beta), the plans and exercises, and what the change leaves behind.', items: te });
    G.push({ id: 'model', name: 'Diagnose: maps of the system', d: 'The kinds of map drawn from the evidence, under Data analysis in Diagnose.', items: (M.models || []).filter(function (x) { return !x.hidden; }).map(function (x) { return { id: x.id, n: x.name, d: x.about ? (function (t) { var i = t.indexOf('. '); return i > 0 ? t.slice(0, i + 1) : t; })(String(x.about)) : '' }; }) });
    var ORD = ['problem', 'analyse', 'model', 'evaluate', 'test']; G.sort(function (a, b) { return ORD.indexOf(a.id) - ORD.indexOf(b.id); });
    return G;
  }
  // ---------- starting sets ----------
  var SETS = [
    { id: 'frame', name: 'Frame the problem only', d: 'Frame only: the canvas and the board. No evidence work yet.',
      make: function (all) { var o = all(true); ['analyse', 'evaluate', 'test', 'model', 'p.tools'].forEach(function (k) { o[k] = false; }); return o; } },
    { id: 'ibs', name: 'One important business service', d: 'Map one service: the frame, the important business service and its processes, the evidence for them, impact and risk.',
      make: function (all) { var o = all(false); ['problem', 'analyse', 'evaluate', 'test', 'model', 'p.canvas', 'v.analyse', 'v.sources', 'v.request', 'dependants', 'bia', 'risk', 'scentest', 'plans', 'ibs', 'process'].forEach(function (k) { o[k] = true; }); return o; } },
    { id: 'opres', name: 'Operational resilience', d: 'The frame, all the evidence, the service models and the full risk and continuity set.',
      make: function (all) { var o = all(false); ['problem', 'analyse', 'evaluate', 'test', 'model', 'p.canvas', 'p.board', 'p.views', 'v.analyse', 'v.sources', 'v.levels', 'v.capitals', 'outside', 'v.models', 'v.outcomes', 'v.request', 'disagree', 'evframe', 'dependants', 'horizon', 'rca', 'bia', 'risk', 'scentest', 'plans', 'exlog', 'selfassess', 'ibs', 'process', 'journey', 'blueprint', 'timeline', 'bowtie', 'faulttree'].forEach(function (k) { o[k] = true; }); return o; } },
    { id: 'full', name: 'The full method', d: 'Everything on. Switch off what this piece of work does not need.',
      make: function (all) { return all(true); } }];

  // ---------- the page: Project › What's included, laid out like the report index ----------
  function render(main, X) {
    var el = X.el, S = X.S, U = S.scopeUi = S.scopeUi || {}, groups = catalogue();
    var ids = [];
    groups.forEach(function (g) { ids.push(g.id); g.items.forEach(function (x) { ids.push(x.id); }); });
    if (!U.open) { U.open = {}; groups.forEach(function (g) { U.open[g.id] = true; }); }
    var c = (row && row.content) || {};
    // Ticks are saved one after another, each on top of the last. If the saved copy has moved on
    // (another tab, or another facilitator), the latest is fetched and the tick applied to it.
    var save = function (patch, label) {
      queue = queue.then(function () { return saveNow(patch, label, true); });
      return queue;
    };
    var saveNow = async function (patch, label, retry) {
      var cur = (row && row.content) || {}, nc = JSON.parse(JSON.stringify(cur));
      if (!nc.on) { nc.on = {}; ids.forEach(function (k) { nc.on[k] = raw(k); }); nc.why = {}; Object.keys(legacy).forEach(function (k) { nc.why[k] = legacy[k].why || ''; }); }
      patch(nc);
      try {
        var d = await X.api({ action: 'p_save', tile_key: 'scope', status: 'done', summary: label || 'Changed what is included', base_version: row ? row.version : null, content: nc });
        S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'scope'; }); S.data.tiles.push(d.tile); row = d.tile;
        X.render();
        if (window.VTNav && window.VTNav.redraw) window.VTNav.redraw();
      } catch (e) {
        if (e.status === 409 && retry) {
          try { var fresh = await X.api({ action: 'p_load' }); row = (fresh.tiles || []).filter(function (t) { return t.tile_key === 'scope'; })[0] || null; } catch (e2) { alert(e2.message); return; }
          return saveNow(patch, label, false);
        }
        alert(e.message); X.render();
      }
    };
    var allMap = function () { return function (val) { var o = {}; ids.forEach(function (k) { o[k] = /^tk\./.test(k) ? raw(k) : val; }); return o; }; };
    var items = []; groups.forEach(function (g) { g.items.forEach(function (x) { items.push(x); }); });
    var nP = STEPS.filter(function (p) { return raw(p); }).length, nI = items.filter(function (x) { return on(x.id); }).length;
    var setName = function (id) { var s = SETS.filter(function (y) { return y.id === id; })[0] || (c.sets || []).filter(function (y) { return y.id === id; })[0]; return s ? s.name : id; };
    X.head(S.data.session.name || 'Project', 'Used, shown and reported', 'One list of everything in the method. For each part: whether this engagement uses it, whether the client sees it in Confirm, and whether it goes in the report. Something not used cannot be shown or reported. Nothing is deleted: a part that is not used keeps running in the background on the shared map.');
    // the named selections: one set for what the client sees, one for the report
    var shSets = c.showSets || [], rpSets = c.repSets || [];
    var pick = function (list, cur, label, idA, apply) { var sl = el('select', { id: idA, 'aria-label': label }, [el('option', { value: '', text: cur ? 'Changed since chosen' : 'As set below' })].concat(list.map(function (x) { return el('option', { value: x.id, text: x.name }); }))); sl.value = cur || ''; sl.addEventListener('change', function () { var x = list.filter(function (y) { return y.id === sl.value; })[0]; if (x) apply(x); }); return el('label', { class: 'scpick' }, [el('span', { class: 'sm muted', text: label }), sl]); };
    main.appendChild(el('div', { class: 'glass evbox scsel', id: 'scSel', style: 'margin:12px 0' }, [
      pick(shSets, c.showSet, 'Shown to the client', 'scShowSet', function (x) { save(function (nc) { nc.show = Object.assign({}, x.show); nc.showSet = x.id; }, 'Shown to the client: ' + x.name); }),
      pick(rpSets, c.repSet, 'In the report', 'scRepSet', function (x) { save(function (nc) { nc.rep = Object.assign({}, x.rep); nc.repSet = x.id; }, 'In the report: ' + x.name); }),
      S.readonly ? null : el('button', { class: 'btn sm', id: 'scSaveSel', text: 'Save as a new selection', onclick: function () { var n = window.prompt('A name for this selection, for example: Board briefing', ''); if (!n || !n.trim()) return; var id = 'x' + Date.now().toString(36); save(function (nc) { nc.showSets = (nc.showSets || []).concat([{ id: id, name: n.trim(), show: Object.assign({}, nc.show || {}) }]); nc.repSets = (nc.repSets || []).concat([{ id: id, name: n.trim(), rep: Object.assign({}, nc.rep || {}) }]); nc.showSet = id; nc.repSet = id; }, 'Saved a selection: ' + n.trim()); } }),
      el('span', { class: 'sm muted', text: 'A selection sets the shown and report columns; “used” follows the protocol.' })]));
    // suggestions while framing: off until the data protection points are settled with this client
    var ar = X.row('aiset'), ac = (ar && ar.content) || {}, agree = el('input', { type: 'checkbox', id: 'aiAgree' });
    var setAi = async function (onv) {
      if (onv && !agree.checked) return alert('Tick that the organisation has agreed first.');
      try { var d = await X.api({ action: 'p_save', tile_key: 'aiset', status: 'done', summary: onv ? 'Suggestions switched on' : 'Suggestions switched off', base_version: ar ? ar.version : null, content: { on: !!onv, agreed: onv ? true : !!ac.agreed, by: S.data.as === 'master' ? 'David (master)' : 'Facilitator', at: new Date().toISOString() } });
        S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'aiset'; }); S.data.tiles.push(d.tile); X.render(); } catch (e) { alert(e.message); }
    };
    main.appendChild(el('div', { class: 'glass evbox', id: 'aiBox', style: 'margin:16px 0' }, [el('div', { class: 'spread', style: 'align-items:center' }, [el('b', { text: 'Suggestions while framing' }), el('span', { class: 'pill ' + (ac.on ? 'ok' : ''), id: 'aiState', text: ac.on ? 'On' : 'Off' })]),
      el('p', { class: 'sm muted', style: 'margin:6px 0', text: 'When this is on, the Lab reads the words and the sources added to a box, and offers a check of understanding and details that belong in other boxes. It can also read photos of handwritten notes. Nothing is placed until someone accepts it. Leave it off until the data protection points are settled with the organisation.' }),
      ac.on ? el('button', { class: 'btn sm', id: 'aiOff', text: 'Switch off', onclick: function () { setAi(false); } }) : el('div', { class: 'row' }, [el('label', { class: 'sm' }, [agree, ' The organisation has agreed to its notes and words being read in this way']), el('button', { class: 'btn sm solid', id: 'aiOn', text: 'Switch on', onclick: function () { setAi(true); } })])]));
    var lay = el('div', { class: 'replay' });
    // the index: search, then each group with its tick boxes
    var idx = el('div', { class: 'repidx' }), q = (U.q || '').trim().toLowerCase();
    var search = el('input', { type: 'search', id: 'scopeSearch', placeholder: 'Search, for example: blueprint, risk, sources', value: U.q || '', 'aria-label': 'Search what can be switched' });
    search.addEventListener('input', function () { U.q = search.value; var pos = search.selectionStart; X.render(); var s2 = document.getElementById('scopeSearch'); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} } });
    idx.appendChild(el('div', { class: 'row repsearch no-print' }, [search,
      el('button', { class: 'btn sm', text: 'Open all', onclick: function () { groups.forEach(function (g) { U.open[g.id] = true; }); X.render(); } }),
      el('button', { class: 'btn sm', text: 'Fold all', onclick: function () { U.open = {}; X.render(); } })]));
    var flip = function (id, v) {
      var why = window.prompt(v ? 'Why reveal it for this engagement? It opens already up to date.' : 'Why hide it for this engagement? It keeps running in the background.', '') || '';
      save(function (nc) { nc.on[id] = v; nc.changed = true; nc.why = nc.why || {}; if (why) nc.why[id] = why; nc.log = (nc.log || []).concat([{ id: id, shown: v, why: why, at: new Date().toISOString(), by: S.data.as === 'master' ? 'David (master)' : 'Facilitator' }]).slice(-200); }, (v ? 'Revealed: ' : 'Hidden: ') + id + (why ? ' (' + why + ')' : ''));
    };
    // Used, shown and reported (5 November 2026): beside "used", whether the client sees it in Confirm, and whether it goes in the report
    var U2 = window.VTUse, show = c.show || {}, rep = c.rep || {};
    var useViewFor = function (id) { return U2 ? U2.VIEWS.filter(function (v) { return v.scope === id; })[0] : null; };
    var setShow = function (vid, v) { save(function (nc) { nc.show = Object.assign({}, nc.show || {}); nc.show[vid] = v; nc.showSet = null; nc.log = (nc.log || []).concat([{ id: vid, shown_to_client: v, at: new Date().toISOString(), by: S.data.as === 'master' ? 'David (master)' : 'Facilitator' }]).slice(-200); }, (v ? 'Shown to the client: ' : 'Not shown to the client: ') + vid); };
    var setRep = function (id, v) { save(function (nc) { nc.rep = Object.assign({}, nc.rep || {}); nc.rep[id] = v; nc.repSet = null; }, (v ? 'In the report: ' : 'Left out of the report: ') + id); };
    var move = function (uv, d) { save(function (nc) { var key = uv.step + ':' + uv.side, cur = U2.VIEWS.filter(function (v) { return v.step === uv.step && v.side === uv.side; }); var o = ((nc.order || {})[key] || []).filter(function (id) { return cur.some(function (v) { return v.id === id; }); }); cur.forEach(function (v) { if (o.indexOf(v.id) < 0) o.push(v.id); }); var i = o.indexOf(uv.id), j = i + d; if (j < 0 || j >= o.length) return; o.splice(i, 1); o.splice(j, 0, uv.id); nc.order = Object.assign({}, nc.order || {}); nc.order[key] = o; }, 'Changed the order in Confirm'); };
    function cols(id, usedNow, uv) {
      var shCell, rpCell;
      if (uv) {
        var isShown = show[uv.id] == null ? uv.def : !!show[uv.id], sc = el('input', { type: 'checkbox', 'data-show': uv.id, disabled: !usedNow, 'aria-label': 'Shown to the client: ' + uv.n }); sc.checked = usedNow && isShown;
        sc.addEventListener('change', function () { setShow(uv.id, sc.checked); });
        var first = usedNow && isShown && U2.views(uv.step, uv.side)[0] === uv;
        shCell = el('span', { class: 'sccol' }, [sc, el('span', { class: 'sm muted', text: (uv.side === 'in' ? 'Inputs' : 'Results') + (first ? ', opens first' : '') }), el('span', { class: 'scmv' }, [el('button', { type: 'button', class: 'link', 'aria-label': 'Earlier in Confirm', disabled: !usedNow || !isShown, text: '↑', onclick: function () { move(uv, -1); } }), el('button', { type: 'button', class: 'link', 'aria-label': 'Later in Confirm', disabled: !usedNow || !isShown, text: '↓', onclick: function () { move(uv, 1); } })])]);
      } else shCell = el('span', { class: 'sccol sm muted', text: '–' });
      if (id) { var rc = el('input', { type: 'checkbox', 'data-rep': id, disabled: !usedNow, 'aria-label': 'In the report: ' + id }); rc.checked = usedNow && rep[id] !== false; rc.addEventListener('change', function () { setRep(id, rc.checked); }); rpCell = el('span', { class: 'sccol' }, [rc]); }
      else rpCell = el('span', { class: 'sccol sm muted', text: '–' });
      return [shCell, rpCell];
    }
    // the views in Use that are not a separate part above (the frame's views, the formulation, Try it, the comparison)
    var STEPG = { problem: 'frame', analyse: 'diagnose', evaluate: 'model', test: 'test' };
    function extraUse(g, box, pOn) {
      if (!U2 || !STEPG[g.id]) return;
      var ids = {}; g.items.forEach(function (x) { ids[x.id] = 1; });
      var xs = U2.VIEWS.filter(function (v) { return v.step === STEPG[g.id] && (!v.scope || !ids[v.scope]); });
      if (!xs.length) return;
      box.appendChild(el('div', { class: 'scsub', text: 'In Confirm, for this step' }));
      xs.forEach(function (uv) { box.appendChild(el('div', { class: 'scrow' }, [el('span', { class: 'repitem scitem' + (pOn ? '' : ' off') }, [el('span', { class: 'scn' }, [el('b', { text: uv.n }), el('span', { class: 'sm muted', text: 'Used whenever ' + g.name + ' is used' })])])].concat(cols(null, pOn && U2.used(uv), uv)))); });
    }
    var hits = 0;
    groups.forEach(function (g) {
      var match = function (x) { return !q || (g.name + ' ' + x.n + ' ' + (x.d || '') + ' ' + (x.sub || '')).toLowerCase().indexOf(q) >= 0; };
      var list = g.items.filter(match); if (q && !list.length) return; hits += list.length;
      var pOn = raw(g.id), nOn = g.items.filter(function (x) { return raw(x.id); }).length, open = !!q || !!U.open[g.id];
      var box = el('div', { class: 'glass evbox repgrp scgrp' + (open ? ' open' : '') + (pOn ? '' : ' poff'), 'data-group': g.id });
      var sw = el('input', { type: 'checkbox', class: 'scsw', 'data-practice': g.id, 'aria-label': g.name + ' on or off' }); sw.checked = pOn;
      sw.addEventListener('change', function () { flip(g.id, sw.checked); });
      var allOn = g.items.every(function (x) { return raw(x.id) || /^tk\./.test(x.id); });
      box.appendChild(el('div', { class: 'spread', style: 'align-items:center' }, [
        el('button', { class: 'repfold', 'aria-expanded': String(open), 'data-fold': g.id, onclick: function () { if (q) return; U.open[g.id] = !U.open[g.id]; X.render(); } }, [
          el('span', { class: 'chev', text: open ? '▾' : '▸' }), el('span', { class: 'flab', style: 'margin:0', text: g.name }),
          el('span', { class: 'muted sm', text: pOn ? nOn + ' of ' + g.items.length + ' used' : 'Whole step not used (still running)' })]),
        el('span', { class: 'row' }, [open && pOn ? el('button', { class: 'btn sm', 'data-all': g.id, text: allOn ? 'Untick all' : 'Tick all', onclick: function () { save(function (nc) { g.items.forEach(function (x) { if (!allOn && /^tk\./.test(x.id)) return; nc.on[x.id] = !allOn; }); nc.changed = true; }, (allOn ? 'Unticked all in ' : 'Ticked all in ') + g.name); } }) : null,
          el('label', { class: 'scswl', title: 'Use the whole step, or not' }, [sw, el('span', { text: pOn ? 'Used' : 'Not used' })])])]));
      if (open) {
        if (!pOn) box.appendChild(el('p', { class: 'sm muted', style: 'margin:8px 0 0', text: g.name + ' is not used, so nothing in it is used, shown or reported. It keeps running. Use it to choose within it.' }));
        box.appendChild(el('div', { class: 'scrow schead' }, [el('span', { text: 'Used in this engagement' }), el('span', { class: 'sccol', text: 'Shown to the client' }), el('span', { class: 'sccol', text: 'In the report' })]));
        var lastSub = null;
        list.forEach(function (x) {
          if (x.sub && x.sub !== lastSub) { box.appendChild(el('div', { class: 'scsub', text: x.sub })); lastSub = x.sub; }
          var cb = el('input', { type: 'checkbox', 'data-item': x.id, disabled: !pOn || locked(x.id) }); cb.checked = locked(x.id) || raw(x.id);
          cb.addEventListener('change', function () { flip(x.id, cb.checked); });
          var lab0 = el('label', { class: 'repitem scitem' + (pOn ? '' : ' off') + (raw(x.id) ? '' : ' unticked') }, [cb, el('span', { class: 'scn' }, [el('b', { text: x.n }), x.d ? el('span', { class: 'sm muted', text: x.d }) : null, locked(x.id) ? el('span', { class: 'sm muted', text: 'Always used: conditions and capitals are never hidden from the record.' }) : !raw(x.id) && c.why && c.why[x.id] ? el('span', { class: 'sm muted', text: 'Not used: ' + c.why[x.id] }) : null])]);
          box.appendChild(el('div', { class: 'scrow' }, [lab0].concat(cols(x.id, pOn && on(x.id), useViewFor(x.id)))));
        });
        extraUse(g, box, pOn);
      }
      idx.appendChild(box);
    });
    if (q && !hits) idx.appendChild(el('p', { class: 'meta', text: 'Nothing matches “' + U.q + '”.' }));
    // the side panel: what is on, the starting sets, saving a set
    var side = el('div', { class: 'glass evbox repside' });
    side.appendChild(el('h4', { style: 'margin:0 0 6px', text: 'This engagement' }));
    side.appendChild(el('p', { class: 'meta', id: 'scopeSum', style: 'margin:0', text: nP + ' of ' + STEPS.length + ' steps used · ' + nI + ' of ' + items.length + ' views, tools and models used' + (c.set ? ' · started from “' + setName(c.set) + '”' + (c.changed ? ', then changed' : '') : '') }));
    side.appendChild(el('h4', { style: 'margin:18px 0 6px', text: 'Start from a set' }));
    side.appendChild(el('p', { class: 'sm muted', style: 'margin:0 0 8px', text: 'A set ticks a ready-made selection. Then untick or tick to adjust.' }));
    var sg = el('div', { class: 'scsets' });
    SETS.concat((c.sets || []).map(function (s) { return { id: s.id, name: s.name, d: 'Saved in this engagement.', saved: s }; })).forEach(function (s) {
      var cur = c.set === s.id && !c.changed;
      sg.appendChild(el('div', { class: 'scset' + (cur ? ' on' : ''), 'data-set': s.id }, [el('div', {}, [el('b', { text: s.name }), el('div', { class: 'sm muted', text: s.d })]),
        el('div', { class: 'row', style: 'flex-wrap:nowrap' }, [el('button', { class: 'btn sm' + (cur ? '' : ' solid'), disabled: cur, 'data-use-set': s.id, text: cur ? 'In use' : 'Use', onclick: function () {
          if (!confirm('Use “' + s.name + '”? This replaces the current ticks. Nothing already entered is deleted.')) return;
          save(function (nc) { nc.on = s.saved ? Object.assign({}, nc.on, s.saved.on) : s.make(allMap()); nc.set = s.id; nc.changed = false; }, 'Used the set: ' + s.name);
        } }), s.saved ? el('button', { class: 'link', text: 'Remove', onclick: function () { if (confirm('Remove the saved set “' + s.name + '”?')) save(function (nc) { nc.sets = (nc.sets || []).filter(function (y) { return y.id !== s.id; }); }, 'Removed a saved set'); } }) : null])]));
    });
    side.appendChild(sg);
    side.appendChild(el('h4', { style: 'margin:18px 0 6px', text: 'Save these ticks as a set' }));
    var nm = el('input', { type: 'text', id: 'scopeName', placeholder: 'For example: Board pack only' });
    side.appendChild(nm);
    side.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn sm', id: 'scopeSaveSet', text: 'Save as a set', onclick: function () {
      if (!nm.value.trim()) { nm.focus(); return; }
      save(function (nc) { var id = 's' + Date.now().toString(36); nc.sets = (nc.sets || []).concat([{ id: id, name: nm.value.trim(), on: Object.assign({}, nc.on) }]); nc.set = id; nc.changed = false; }, 'Saved a set');
    } })]));
    side.appendChild(el('p', { class: 'sm muted', style: 'margin:14px 0 0', text: 'Each tick saves at once. Saved sets belong to this engagement.' }));
    lay.appendChild(idx); lay.appendChild(side); main.appendChild(lay);
  }

  window.VTScope = {
    set: function (r) { row = r || null; },
    setLegacy: function (chosen) { legacy = chosen || {}; },
    row: function () { return row; },
    active: active, on: on, raw: raw, practiceOf: practiceOf, catalogue: catalogue, SETS: SETS, render: render, change: change, locked: locked,
    inReport: function (id) { var r = row && row.content && row.content.rep; return !r || r[id] !== false; },
    why: function (id) { return (row && row.content && row.content.why && row.content.why[id]) || ''; }
  };
})();
