// Evidence (Evaluate): how far the evidence goes, as a maturity model. One scale of certainty, with five
// levels earned by set evidence (asserted, documented, verified, tested, proven in operation), marked down
// for named reasons. Rows are the claims about the service and the capitals held in reserve; each row opens
// its claim card (the claim, its grounds, the warrant, and when it would not hold). The conditions (the nots)
// are kept in their own table, not here. Decided 27 October 2026. Reads and saves the session's tile "evidence".
(function () {
  'use strict';
  var X, el, ST = { open: null, adding: false };

  // the two ladders agreed on 3 November 2026: 0 is no evidence; 1 to 5 as below
  var LEVELS = [
    ['Said', 'People say it exists, works or happened: in a call, a meeting, an interview or the room'],
    ['Written down', 'In a plan, procedure, record or contract that can be pointed to'],
    ['Done, or confirmed', 'People have actually done it, or a record confirms it happened'],
    ['Tested, or independently confirmed', 'Tested on its own and met the figure claimed, or confirmed by an independent source'],
    ['Tested end to end, or confirmed across sources', 'Met the figure in an end-to-end test or a live event, or confirmed across records, people and outside evidence']];
  // what each level looks like, by kind of claim
  var CELLS = {
    reserve: ['People believe it exists or works', 'Written down: a plan, procedure or record', 'People have done it, at least once', 'Tested on its own, and met the figure claimed', 'Tested end to end, or in a live event, and met the figure'],
    fact: ['Someone says so', 'Written down in a document or record', 'Confirmed by a record', 'Confirmed by an independent source', 'Confirmed across records, people and outside evidence']
  };
  CELLS.agreement = CELLS.fact;
  var KINDS = [['reserve', 'What it can do'], ['fact', 'What happened, or is the case'], ['agreement', 'What was agreed']];
  var MARKS = [['reach', 'The claim reaches beyond the evidence'], ['disagree', 'The sources disagree'], ['old', 'The evidence is old, or the service has changed since'], ['easier', 'The test was easier than the claim']];
  var CAPS = [['human', 'Human'], ['social', 'Social'], ['information', 'Information'], ['manufactured', 'Manufactured'], ['financial', 'Financial'], ['natural', 'Natural']];
  // the target that the planned depth sets (the protocol), unless a row sets its own
  var DEPTH_TARGET = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };   // the agreed depth is the level the key claims must reach

  var S = function () { return X.S; };
  var data = function () { var r = X.row('evidence'); return JSON.parse(JSON.stringify((r && r.content) || {})); };
  var readonly = function () { return !!S().readonly; };
  var answers = function () { var r = X.row('frame'); return (r && r.content && r.content.answers) || {}; };
  var F = function (a, k, f) { return String((a[k] && a[k].fields && a[k].fields[f]) || '').trim(); };
  var depth = function () { var d = X.row('depth'); return Number(d && d.content && d.content.level) || 3; };
  var slug = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); };

  // ---------- the rows: read from the framing, plus any the team adds ----------
  function seeds() {
    var a = answers(), R = (a.system && a.system.route) || {}, rows = [];
    var claim = function (id, name, kind, text) { if (text) rows.push({ id: id, group: 'claims', name: name, kind: kind, claim: text, seed: true }); };
    claim('c-purpose', 'What it is for', 'agreement', F(a, 'service', 'for'));
    claim('c-line', 'The threshold it must never cross', 'agreement', F(a, 'gap', 'mustnot'));
    claim('c-good', 'What working well looks like', 'agreement', F(a, 'good', 'good'));
    claim('c-demand', 'Demand', 'fact', F(a, 'good', 'needs'));
    var steps = (R.steps || []).map(function (s) { return s.n; }).filter(Boolean);
    claim('c-steps', 'The main steps, and who does each', 'fact', steps.length ? steps.join('; ') : F(a, 'requires', 'work'));
    claim('c-question', 'Who decides, and by when', 'fact', F(a, 'question', 'owner'));
    var runs = (a.requires && a.requires.runs) || [];
    CAPS.forEach(function (c) {
      runs.filter(function (x) { return x.cap === c[0]; }).forEach(function (x) {
        rows.push({ id: 'r-' + slug(x.t), group: 'capitals', cap: c[0], name: c[1] + ': ' + x.t, kind: 'reserve', claim: x.t + ' is there, and holds when it is needed.', seed: true });
      });
    });
    return rows;
  }
  function rows() {
    var d = data(), saved = d.rows || {}, list = seeds().map(function (s) { return Object.assign(s, saved[s.id] || {}); });
    (d.extra || []).forEach(function (x) { list.push(Object.assign({}, x, saved[x.id] || {})); });
    return list.filter(function (x) { return !(saved[x.id] && saved[x.id].hidden); });
  }
  var effective = function (r) { if (!r.level) return 0; return Math.max(1, r.level - (r.marks || []).length); };
  var target = function (r) { return r.target || DEPTH_TARGET[depth()] || 3; };

  async function patch(id, p, extra) {
    var d = data(); d.rows = d.rows || {}; d.rows[id] = Object.assign(d.rows[id] || {}, p);
    if (extra) extra(d);
    d.at = new Date().toISOString();
    await X.saveRow('evidence', d, 'partly'); X.render();
  }
  function safe(fn) { return function () { var a = arguments; Promise.resolve(fn.apply(null, a)).catch(function (e) { var m = document.getElementById('evMsg'); if (m) m.textContent = e.message; }); }; }

  // ---------- the page ----------
  function render(main, x) {
    X = x; el = x.el;
    var list = rows(), ro = readonly(), d = depth();
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: '#evaluate', text: '← Tools' }), el('button', { class: 'btn sm', text: 'Print', onclick: function () { window.print(); } })]));
    X.head(S().data.session.name || 'Test', 'How far the evidence goes', 'Each claim is judged by the evidence behind it, from 0 (no evidence) to 5 (tested end to end, or confirmed across sources). This measures the evidence, not the service. The target comes from the depth agreed in the protocol (depth ' + d + '). Open a row to see its claim card: the claim, its grounds, why they support it, and when it would not hold.');
    var met = list.filter(function (r) { return effective(r) >= target(r); }).length, judged = list.filter(function (r) { return r.level; }).length;
    main.appendChild(el('p', { class: 'meta', id: 'evSummary', text: list.length ? judged + ' of ' + list.length + ' judged · ' + met + ' at or above the target' : 'Nothing to judge yet. The rows come from Frame: what it is for, the thresholds, demand, the steps and what it runs on.' }));
    var wrap = el('div', { class: 'evm', id: 'evMatrix', role: 'table', 'aria-label': 'Evidence matrix' });
    wrap.appendChild(el('div', { class: 'evr evhead', role: 'row' }, [el('div', { role: 'columnheader' })].concat(LEVELS.map(function (l, i) { return el('div', { class: 'evh', role: 'columnheader' }, [el('b', { text: (i + 1) + '. ' + l[0] }), el('span', { text: l[1] })]); }))));
    [['claims', 'Claims about the service', 'facts and agreements from Frame and the model'], ['capitals', 'Capitals held in reserve', 'what the service runs on, and what it can fall back on']].forEach(function (g) {
      var gr = list.filter(function (r) { return r.group === g[0]; });
      wrap.appendChild(el('div', { class: 'evg', role: 'row' }, [el('b', { text: g[1] }), el('span', { text: ' ' + g[2] })]));
      if (!gr.length) wrap.appendChild(el('p', { class: 'meta evnone', text: g[0] === 'capitals' ? 'Nothing yet. What it runs on (box 6) fills this in.' : 'Nothing yet.' }));
      gr.forEach(function (r) { wrap.appendChild(rowEl(r, ro)); if (ST.open === r.id) wrap.appendChild(card(r, ro)); });
    });
    main.appendChild(wrap);
    if (!ro) main.appendChild(addRow());
    main.appendChild(el('div', { class: 'evkey' }, [el('span', { class: 'k now' }), 'Where the evidence is now', el('span', { class: 'k past' }), 'Levels already passed', el('span', { class: 'k tgt' }), 'The target', el('span', { class: 'k down' }), 'Before marking down']));
    main.appendChild(el('p', { class: 'meta', style: 'margin-top:14px' }, ['The conditions (the twelve nots, and the technical conditions) are kept in their own table, coded event by event: ', el('a', { href: '#nots', text: 'open the conditions' }), '.']));
    main.appendChild(el('p', { class: 'msg', id: 'evMsg', role: 'status' }));
  }
  function rowEl(r, ro) {
    var eff = effective(r), tg = target(r), cells = r.cells || CELLS[r.kind] || CELLS.fact;
    var lab = el('button', { class: 'evlab', 'aria-expanded': String(ST.open === r.id), 'data-row': r.id, onclick: function () { ST.open = ST.open === r.id ? null : r.id; X.render(); } }, [
      el('b', { text: r.name }), el('span', { text: (KINDS.filter(function (k) { return k[0] === r.kind; })[0] || ['', ''])[1] + (r.marks && r.marks.length && r.level ? ' · marked down from ' + LEVELS[r.level - 1][0].toLowerCase() : '') })]);
    return el('div', { class: 'evr', role: 'row', 'data-id': r.id }, [lab].concat(cells.map(function (t, i) {
      var lv = i + 1, cls = 'evc' + (lv === eff ? ' now' : lv < eff ? ' past' : '') + (lv === tg ? ' tgt' : '') + (r.level && lv === r.level && lv !== eff ? ' down' : '');
      var c = el(ro ? 'div' : 'button', { class: cls, role: 'cell', 'data-lv': String(lv), 'aria-label': r.name + ': ' + LEVELS[i][0] + (lv === eff ? ' (now)' : ''), onclick: ro ? null : safe(function () { return patch(r.id, { level: r.level === lv ? 0 : lv }); }) }, [t]);
      return c;
    })));
  }
  // ---------- the claim card ----------
  function card(r, ro) {
    var f = function (k, label, ph) {
      var t = el('textarea', { rows: '2', id: 'ev_' + k, 'data-f': k, placeholder: ph, readonly: ro ? true : null }); t.value = r[k] || '';
      t.addEventListener('change', safe(function () { var p = {}; p[k] = t.value.trim(); return patch(r.id, p); }));
      return el('label', { class: 'evf' }, [el('span', { text: label }), t]);
    };
    var marks = r.marks || [];
    var mk = MARKS.map(function (m) {
      var cb = el('input', { type: 'checkbox', 'data-mark': m[0], checked: marks.indexOf(m[0]) >= 0, disabled: ro ? true : null });
      cb.addEventListener('change', safe(function () { var n = marks.filter(function (x) { return x !== m[0]; }); if (cb.checked) n.push(m[0]); return patch(r.id, { marks: n }); }));
      return el('label', { class: 'evmk' }, [cb, ' ' + m[1]]);
    });
    var tsel = el('select', { id: 'evTarget', disabled: ro ? true : null, 'aria-label': 'Target for this row' }, [el('option', { value: '', text: 'Target from the depth (' + LEVELS[(DEPTH_TARGET[depth()] || 3) - 1][0] + ')' })].concat(LEVELS.map(function (l, i) { return el('option', { value: String(i + 1), text: 'Target: ' + l[0] }); })));
    tsel.value = r.target ? String(r.target) : ''; tsel.addEventListener('change', safe(function () { return patch(r.id, { target: Number(tsel.value) || 0 }); }));
    var ksel = el('select', { id: 'evKind', disabled: ro ? true : null, 'aria-label': 'Kind of claim' }, KINDS.map(function (k) { return el('option', { value: k[0], text: k[1] }); }));
    ksel.value = r.kind; ksel.addEventListener('change', safe(function () { return patch(r.id, { kind: ksel.value, cells: null }); }));
    var del = ro ? null : el('button', { class: 'link', id: 'evRemove', text: r.seed ? 'Leave this row out' : 'Remove this row', onclick: safe(function () { ST.open = null; return r.seed ? patch(r.id, { hidden: true }) : patch(r.id, { gone: true }, function (d) { d.extra = (d.extra || []).filter(function (x) { return x.id !== r.id; }); delete d.rows[r.id]; }); }) });
    return el('div', { class: 'evcard', id: 'evCard', role: 'region', 'aria-label': 'Claim card: ' + r.name }, [
      el('div', { class: 'evcols' }, [
        el('div', {}, [f('claim', 'The claim', 'What we are saying is true, agreed, held in reserve, or will work'), f('grounds', 'The grounds', 'The evidence we have, and where it is'), f('warrant', 'Why the grounds support the claim', 'For example: what held for nine days at last year’s volume will hold for two weeks, because the limit is staff hours')]),
        el('div', {}, [f('unless', 'Unless (when it would not hold)', 'For example: unless volume is higher than last time, or the trained staff are away'), f('tested', 'What was tested, and how real the conditions were', 'For example: the whole workaround, in a three-day desk exercise'),
          el('div', { class: 'evf' }, [el('span', { text: 'Mark down a level for each that applies' })].concat(mk)),
          el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-top:6px' }, [ksel, tsel, del])])])]);
  }
  function addRow() {
    if (!ST.adding) return el('button', { class: 'btn sm no-print', id: 'evAdd', style: 'margin-top:12px', text: 'Add a claim or a reserve', onclick: function () { ST.adding = true; X.render(); } });
    var name = el('input', { type: 'text', id: 'evNewName', placeholder: 'For example: the manual workaround, or reserve funds' });
    var g = el('select', { id: 'evNewGroup', 'aria-label': 'Where it goes' }, [el('option', { value: 'claims', text: 'A claim about the service' })].concat(CAPS.map(function (c) { return el('option', { value: 'cap:' + c[0], text: 'Held in reserve: ' + c[1] }); })));
    var k = el('select', { id: 'evNewKind', 'aria-label': 'Kind of claim' }, KINDS.map(function (x) { return el('option', { value: x[0], text: x[1] }); }));
    g.addEventListener('change', function () { if (g.value.indexOf('cap:') === 0) k.value = 'reserve'; });
    var save = safe(async function () {
      var n = name.value.trim(); if (!n) return;
      var cap = g.value.indexOf('cap:') === 0 ? g.value.slice(4) : null, capN = cap ? CAPS.filter(function (c) { return c[0] === cap; })[0][1] + ': ' : '';
      var id = 'x' + Date.now().toString(36);
      ST.adding = false; ST.open = id;
      await patch(id, {}, function (d) { d.extra = (d.extra || []).concat([{ id: id, group: cap ? 'capitals' : 'claims', cap: cap, name: capN + n, kind: k.value }]); });
    });
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    return el('div', { class: 'evadd no-print', id: 'evAddRow' }, [name, g, k, el('button', { class: 'btn sm solid', id: 'evAddSave', text: 'Add', onclick: save }), el('button', { class: 'link', text: 'Cancel', onclick: function () { ST.adding = false; X.render(); } })]);
  }

  window.VTEvidence = { render: render, LEVELS: LEVELS, rows: function (x) { X = x; el = x.el; return rows(); }, effective: effective, target: function (r) { return target(r); } };
})();
