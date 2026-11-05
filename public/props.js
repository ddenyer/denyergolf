// Design propositions (stage 2 of the four steps, 30 October 2026). Model › Design propositions.
// One card for each proposition: the context, the intervention, the mechanisms and the intended outcomes;
// whether it protects and strengthens what works or fixes what fails; and the entry in the formulation it
// answers. Each card keeps a record of its test in the model (the alpha test): the scenario it was tested
// against, what the model showed, the conditions under which it holds, and its status. "Hand on to Test"
// is the summary Model passes to Test.
// Saved in the 'props' tile: { items: [{ id, n, kind, answers: { sub, rec, text }, c, i, m, o,
//   alpha: { tool, scenario, showed, holds }, status, by, at }] }
(function () {
  'use strict';
  var X, el;
  var KIND = [['protect', 'Protects and strengthens what works'], ['fix', 'Fixes what fails'], ['nothing', 'Doing nothing, and watching (the baseline)']];
  // where a proposition acts (31 October 2026): six functions at four levels, and the three gates (Tool 16)
  var FUNCS = [['policy', 'Policy'], ['intel', 'Intelligence'], ['control', 'Control'], ['coord', 'Coordination'], ['exec', 'Execution'], ['learn', 'Learning and embedding']];
  var LEVELS = [['', 'Choose'], ['institution', 'Institution'], ['organisation', 'Organisation'], ['team', 'Team'], ['person', 'Person']];
  var GATE = [['', 'Not checked'], ['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not known']];
  var GATES = [['glevel', 'Right level?', 'Does it act at the level of the failure, not just the level the problem was written at?'], ['gcap', 'Can these people do it?', 'Could they do it if they had to? If not, it is a capability gap: pair it with a change that builds the capability.'], ['gload', 'Can they carry the extra load?', 'Against what they already carry, in the first six months.']];
  function gatesLine(p) { var g = GATES.map(function (x) { var v = p[x[0]]; return x[1].replace(/\?$/, '') + ': ' + (v === 'yes' ? 'yes' : v === 'no' ? 'no' : v === 'unknown' ? 'not known' : 'not checked'); }); return g.join(' · '); }
  var STATUS = [['proposed', 'Proposed'], ['tested', 'Tested in the model'], ['ready', 'Ready to try in use']];
  var TOOLS = [['', 'Choose one'], ['scentest', 'Scenario testing'], ['tharm', 'More throughput, no intolerable harm'], ['abm', 'Agent-based model'], ['cmap', 'The connected map'], ['bia', 'Impact analysis'], ['risk', 'Risk assessment'], ['other', 'Judgement, without a model']];
  var SUBS = [['protective', 'How it works · Protective'], ['predisposing', 'How it fails · Predisposing'], ['precipitating', 'How it fails · Precipitating'], ['perpetuating', 'How it fails · Perpetuating']];
  var lab = function (list, v) { var x = list.filter(function (y) { return y[0] === v; })[0]; return x ? x[1] : ''; };
  var U = {};   // what is open for editing: { edit: id or 'new', draft: {...} }

  function data() { var r = X.row('props'); return (r && r.content) || { items: [] }; }
  function items() { return (data().items || []).slice(); }
  function me() { var u = window.VTAuth && window.VTAuth.user && window.VTAuth.user(); return (u && (u.name || u.email)) || (X.S.data.as === 'master' ? 'David (master)' : 'Facilitator'); }
  function nextId(list) { var n = 0; list.forEach(function (x) { var k = Number(String(x.id || '').replace(/\D/g, '')) || 0; if (k > n) n = k; }); return 'p' + (n + 1); }
  function label(p) { return 'P' + String(p.id || '').replace(/\D/g, ''); }
  async function save(list, note) {
    var st = list.length ? (list.every(function (x) { return x.status === 'ready'; }) ? 'done' : 'partly') : 'none';
    var r = X.row('props'), ready = list.filter(function (x) { return x.status === 'ready'; }).length;
    var d = await X.api({ action: 'p_save', tile_key: 'props', status: st, summary: 'Design propositions: ' + list.length + (list.length ? ', ' + ready + ' ready to try in use' : ''), base_version: r ? r.version : null, content: { items: list, note: note || '' } });
    X.S.data.tiles = (X.S.data.tiles || []).filter(function (t) { return t.tile_key !== 'props'; }); X.S.data.tiles.push(d.tile);
  }

  // the formulation's entries, to choose which one a proposition answers
  function formulation() {
    var A = window.VTAnalyse, out = [];
    if (!A || !A.FORM || !A.formEntries) return out;
    A.FORM.forEach(function (f) {
      var sub = f[1].toLowerCase();
      f[3].forEach(function (spec) { A.formEntries(spec).forEach(function (e) { out.push({ sub: sub, rec: e.md.id, text: e.text, key: sub + '|' + e.md.id + '|' + e.text }); }); });
    });
    return out;
  }
  function keyOf(a) { return a ? (a.sub || '') + '|' + (a.rec || '') + '|' + (a.text || '') : ''; }
  // propositions that answer one entry of the formulation (for the formulation page)
  function forEntry(sub, rec, text) { var k = sub + '|' + rec + '|' + text; return items().filter(function (p) { return keyOf(p.answers) === k; }); }
  function stillThere(a, fm) { return !a || !a.text || fm.some(function (e) { return e.key === keyOf(a); }); }

  // ---------- the list of cards ----------
  function render(main, x, view) {
    X = x; el = x.el;
    if (view === 'handon') return renderHandOn(main);
    var S = X.S, ro = !!S.readonly, list = items(), fm = formulation();
    X.head(S.data.session.name || 'Model', 'Design propositions', 'What changes would make the service work better and fail better? Each proposition says that in this context, this intervention, working through these mechanisms, should produce these outcomes. Some protect and strengthen what works; others fix what fails. Each answers an entry in the formulation, and keeps a record of how it held up when tested in the model (alpha).');
    var n = function (s) { return list.filter(function (p) { return p.status === s; }).length; };
    main.appendChild(el('div', { class: 'row prcount', id: 'prCount', style: 'margin:14px 0 6px;gap:8px' }, STATUS.map(function (s) { return el('span', { class: 'pill' + (s[0] === 'ready' && n('ready') ? ' ok' : ''), 'data-status': s[0], text: s[1] + ': ' + n(s[0]) }); }).concat([
      el('a', { class: 'btn sm', href: '/diagnose' + location.search + '#formulation', text: 'The formulation' }),
      list.length ? el('a', { class: 'btn sm', href: '#handon', text: 'Hand on to Test' }) : null])));
    if (!fm.length && !list.length) main.appendChild(el('p', { class: 'meta', text: 'The formulation is empty so far. Propositions can still be written, but each should answer something in the formulation, so it is worth filling Diagnose first.' }));
    if (!ro && U.edit !== 'new') main.appendChild(el('p', { style: 'margin:12px 0' }, [el('button', { class: 'btn solid', id: 'prAdd', text: 'Add a design proposition', onclick: function () { U.edit = 'new'; U.draft = { n: '', kind: 'fix', answers: null, c: '', i: '', m: '', o: '', alpha: { tool: '', scenario: '', showed: '', holds: '' }, status: 'proposed' }; X.render(); } })]));
    if (U.edit === 'new' && !ro) main.appendChild(editor(null, fm));
    if (!list.length && U.edit !== 'new') main.appendChild(el('p', { class: 'meta', id: 'prNone', text: 'No design propositions yet.' }));
    var grid = el('div', { class: 'prlist' });
    list.forEach(function (p) { grid.appendChild(U.edit === p.id && !ro ? editor(p, fm) : card(p, fm, ro)); });
    main.appendChild(grid);
  }
  function cimo(p) {
    return el('div', { class: 'prcimo' }, [['c', 'Context', 'In this context'], ['i', 'Intervention', 'this intervention'], ['m', 'Mechanisms', 'working through these mechanisms'], ['o', 'Outcomes', 'should produce these outcomes']].map(function (k) {
      return el('div', { class: 'prq', 'data-q': k[0] }, [el('div', { class: 'prk', text: k[1] }), el('p', { class: p[k[0]] ? '' : 'muted', text: p[k[0]] || 'Not written yet' })]);
    }));
  }
  function card(p, fm, ro) {
    var a = p.answers || null, gone = a && a.text && !stillThere(a, fm), al = p.alpha || {};
    return el('div', { class: 'glass evbox prcard', 'data-prop': p.id, 'data-status': p.status || 'proposed' }, [
      el('div', { class: 'spread', style: 'align-items:flex-start' }, [
        el('div', {}, [el('span', { class: 'prid', text: label(p) }), el('b', { class: 'prn', text: ' ' + (p.n || 'Untitled proposition') }), el('div', { class: 'muted sm', text: lab(KIND, p.kind) })]),
        el('span', { class: 'pill prst ' + (p.status === 'ready' ? 'ok' : p.status === 'tested' ? 'warm' : ''), text: lab(STATUS, p.status || 'proposed') })]),
      p.back ? el('div', { class: 'prback', 'data-back': p.back.to }, [el('b', { text: 'Sent back from Test' + (p.back.to ? ' to ' + ({ model: 'Model', diagnose: 'Diagnose', frame: 'Frame' })[p.back.to] : '') + (p.back.at ? ', ' + new Date(p.back.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '') + (p.status === 'ready' ? ' (made ready to try again since)' : '') }), el('p', { class: 'sm', style: 'margin:4px 0 0', text: (p.back.learnt || '') + (p.back.ask ? ' We now need to ask: ' + p.back.ask : '') })]) : null,
      p.level || p.func || p.glevel || p.gcap || p.gload ? el('p', { class: 'sm prgates', 'data-gates': p.id }, [el('span', { class: 'muted', text: 'Acts ' + (p.func ? 'through ' + lab(FUNCS, p.func).toLowerCase() : '') + (p.level ? ' at ' + lab(LEVELS, p.level).toLowerCase() + ' level' : '') + '. Gates: ' }), document.createTextNode(gatesLine(p))]) : null,
      p.origin === 'suggested' ? el('p', { class: 'muted sm', text: 'Suggested from the model' + (p.from ? ': ' + p.from : '') }) : null,
      el('p', { class: 'sm prans' }, [el('span', { class: 'muted', text: 'Answers: ' }), a ? document.createTextNode((lab(SUBS, a.sub) || '') + (a.text ? ': ' + a.text : '')) : el('span', { class: 'fmnoev', text: 'No entry in the formulation chosen yet' }), gone ? el('span', { class: 'fmnoev', text: ' (this entry has since changed in Diagnose)' }) : null]),
      cimo(p),
      el('div', { class: 'pralpha' }, [el('div', { class: 'prk', text: 'Testing the model (alpha)' }),
        al.scenario || al.showed || al.holds ? el('dl', { class: 'prdl' }, [
          el('dt', { text: 'Tested with' }), el('dd', {}, [document.createTextNode(lab(TOOLS, al.tool) && al.tool ? lab(TOOLS, al.tool) : 'Not said'), X.alphaBasis ? (function (bs) { return el('span', { class: 'tbtag ' + bs.k, title: bs.why, style: 'margin-left:8px', text: bs.t }); })(X.alphaBasis(p)) : null]),
          el('dt', { text: 'Scenario' }), el('dd', { text: al.scenario || 'Not said' }),
          el('dt', { text: 'What the model showed' }), el('dd', { text: al.showed || 'Not said' }),
          el('dt', { text: 'Holds when' }), el('dd', { text: al.holds || 'Not said' })]) : el('p', { class: 'meta', style: 'margin:4px 0 0', text: 'Not tested in the model yet.' })]),
      el('div', { class: 'spread', style: 'margin-top:10px;align-items:center' }, [el('span', { class: 'muted sm', text: (p.by ? 'Last changed by ' + p.by : '') + (p.at ? ', ' + new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '') }),
        ro ? null : el('span', { class: 'row' }, [
          el('button', { class: 'btn sm', 'data-edit': p.id, text: 'Edit', onclick: function () { U.edit = p.id; U.draft = JSON.parse(JSON.stringify(p)); X.render(); } }),
          el('button', { class: 'link', 'data-remove': p.id, text: 'Remove', onclick: async function () { if (!confirm('Remove ' + label(p) + ' “' + (p.n || 'Untitled') + '”? The record of its test in the model (alpha) goes with it.')) return; try { await save(items().filter(function (y) { return y.id !== p.id; })); X.render(); } catch (e) { alert(e.message); } } })])])]);
  }

  // ---------- the editor ----------
  function editor(p, fm) {
    var d = U.draft, isNew = !p;
    var field = function (k, l, hint, rows) { var t = el('textarea', { id: 'pr_' + k, rows: rows || 3, placeholder: hint || '' }); t.value = d[k] || ''; t.addEventListener('input', function () { d[k] = t.value; }); return el('label', { class: 'prf' }, [el('span', { text: l }), t]); };
    var afield = function (k, l, hint) { var t = el('textarea', { id: 'pra_' + k, rows: 2, placeholder: hint || '' }); t.value = (d.alpha || {})[k] || ''; t.addEventListener('input', function () { d.alpha = d.alpha || {}; d.alpha[k] = t.value; }); return el('label', { class: 'prf' }, [el('span', { text: l }), t]); };
    var sel = function (id, opts, v, on) { var s = el('select', { id: id }, opts.map(function (o) { return el('option', { value: o[0], text: o[1] }); })); s.value = v || ''; s.addEventListener('change', function () { on(s.value); }); return s; };
    var nm = el('input', { type: 'text', id: 'pr_n', placeholder: 'A short name, for example: A named doctor for each patient at the weekend' }); nm.value = d.n || ''; nm.addEventListener('input', function () { d.n = nm.value; });
    // which entry of the formulation it answers, grouped by sub-heading
    var ans = el('select', { id: 'pr_answers' }, [el('option', { value: '', text: 'Choose the entry it answers' })].concat(SUBS.map(function (s) {
      var es = fm.filter(function (e) { return e.sub === s[0]; });
      return el('optgroup', { label: s[1] }, [el('option', { value: s[0] + '||', text: s[1] + ' (the heading as a whole)' })].concat(es.map(function (e) { return el('option', { value: e.key, text: e.text.length > 110 ? e.text.slice(0, 110) + '…' : e.text }); })));
    })));
    var cur = keyOf(d.answers); if (d.answers && d.answers.text && !fm.some(function (e) { return e.key === cur; })) ans.insertBefore(el('option', { value: cur, text: 'As chosen before: ' + d.answers.text }), ans.children[1]);
    ans.value = d.answers ? cur : '';
    ans.addEventListener('change', function () { var v = ans.value; if (!v) { d.answers = null; return; } var parts = v.split('|'); d.answers = { sub: parts[0], rec: parts[1] || '', text: parts.slice(2).join('|') }; if (parts[0] === 'protective' && d.kind !== 'protect') { d.kind = 'protect'; kindSel.value = 'protect'; } });
    var kindSel = sel('pr_kind', KIND, d.kind, function (v) { d.kind = v; });
    var msg = el('span', { class: 'msg', id: 'prMsg' });
    var box = el('div', { class: 'glass evbox predit', 'data-editing': isNew ? 'new' : p.id }, [
      el('div', { class: 'flab', text: isNew ? 'A new design proposition' : 'Editing ' + label(p) }),
      el('label', { class: 'prf' }, [el('span', { text: 'Name' }), nm]),
      el('div', { class: 'prrow' }, [el('label', { class: 'prf' }, [el('span', { text: 'It answers, in the formulation' }), ans]), el('label', { class: 'prf' }, [el('span', { text: 'What it does' }), kindSel])]),
      el('div', { class: 'prk', style: 'margin-top:12px', text: 'The proposition' }),
      el('div', { class: 'prcimo edit' }, [field('c', 'Context: in this context', 'Where and when it must work: the service, its people, its pressures'), field('i', 'Intervention: this intervention', 'What would be done, by whom, and what it would take'), field('m', 'Mechanisms: working through these mechanisms', 'Why it would work: what it sets off in the people and the systems'), field('o', 'Outcomes: should produce these outcomes', 'For the people who depend on the service, and inside the organisation')]),
      el('div', { class: 'prk', style: 'margin-top:12px', text: 'Where it acts, and the three gates' }),
      el('div', { class: 'prrow' }, [el('label', { class: 'prf' }, [el('span', { text: 'Acting through' }), sel('pr_func', [['', 'Choose']].concat(FUNCS), d.func, function (v) { d.func = v; })]), el('label', { class: 'prf' }, [el('span', { text: 'At which level' }), sel('pr_level', LEVELS, d.level, function (v) { d.level = v; })])]),
      el('div', { class: 'prrow' }, GATES.map(function (g) { return el('label', { class: 'prf', title: g[2] }, [el('span', { text: g[1] }), sel('pr_' + g[0], GATE, d[g[0]], function (v) { d[g[0]] = v; })]); })),
      el('p', { class: 'meta', style: 'margin:4px 0 0', text: 'When a change fails, the first three explanations are the wrong level, a missing capability and too much load; only then the wrong idea.' }),
      field('gnote', 'Notes on the gates', 'Which level the failure sits at; whose capability it assumes; what it asks of them, and what they already carry', 2),
      el('div', { class: 'prk', style: 'margin-top:12px', text: 'Testing the model (alpha)' }),
      el('div', { class: 'prrow' }, [el('label', { class: 'prf' }, [el('span', { text: 'Tested with' }), sel('pra_tool', TOOLS, (d.alpha || {}).tool, function (v) { d.alpha = d.alpha || {}; d.alpha.tool = v; })]), el('label', { class: 'prf' }, [el('span', { text: 'Status' }), sel('pr_status', STATUS, d.status, function (v) { d.status = v; })])]),
      afield('scenario', 'The scenario it was tested against', 'A severe but plausible scenario, for example a bank holiday with the registrar off sick'),
      afield('showed', 'What the model showed', 'Did the service stay within tolerance? What broke first?'),
      afield('holds', 'The conditions under which it holds', 'For example: holds while the on-call doctor answers within an hour'),
      el('div', { class: 'row', style: 'margin-top:12px' }, [
        el('button', { class: 'btn solid', id: 'prSave', text: 'Save', onclick: async function () {
          if (!String(d.n || '').trim()) { msg.className = 'msg bad'; msg.textContent = 'Give it a short name.'; return; }
          if (d.status === 'ready' && !String((d.alpha || {}).showed || '').trim()) { msg.className = 'msg bad'; msg.textContent = 'Say what the model showed before marking it ready to try in use.'; return; }
          var list = items(), rec = Object.assign({}, d, { n: d.n.trim(), by: me(), at: new Date().toISOString() });
          if (isNew) { rec.id = nextId(list); list.push(rec); } else list = list.map(function (y) { return y.id === p.id ? Object.assign(rec, { id: p.id }) : y; });
          try { await save(list); U.edit = null; U.draft = null; X.render(); } catch (e) { msg.className = 'msg bad'; msg.textContent = e.status === 409 ? 'Someone else changed the propositions. Reload the page and try again.' : e.message; }
        } }),
        el('button', { class: 'btn', id: 'prCancel', text: 'Cancel', onclick: function () { U.edit = null; U.draft = null; X.render(); } }), msg])]);
    return box;
  }

  // ---------- hand on to Test: the summary Model passes on ----------
  function renderHandOn(main) {
    var S = X.S, list = items(), fm = formulation();
    X.head(S.data.session.name || 'Model', 'Hand on to Test', 'The design propositions, as Model hands them to Test: what each one is, what it answers, how it held up in the model, and the conditions under which it holds. Those ready to try in use go to the people who run the service for the trial in the organisation (beta).');
    main.appendChild(el('div', { class: 'row no-print', style: 'margin:12px 0' }, [el('a', { class: 'btn sm', href: '#props', text: '← Design propositions' }), el('button', { class: 'btn sm', text: 'Print', onclick: function () { window.print(); } }), el('a', { class: 'btn sm', href: '/test' + location.search + '#beta', text: 'Trial in the organisation (beta)' })]));
    if (!list.length) { main.appendChild(el('p', { class: 'meta', text: 'No design propositions yet.' })); return; }
    STATUS.slice().reverse().forEach(function (s) {
      var xs = list.filter(function (p) { return (p.status || 'proposed') === s[0]; }); if (!xs.length) return;
      main.appendChild(el('h2', { class: 'fmhead', 'data-status': s[0], text: s[1] + ' (' + xs.length + ')' }));
      var tb = el('table', { class: 'itab prtab' });
      tb.appendChild(el('thead', {}, [el('tr', {}, ['', 'Proposition', 'Answers', 'In this context, this intervention, through these mechanisms, should produce', 'In the model', 'Holds when'].map(function (h) { return el('th', { text: h }); }))]));
      var b = el('tbody');
      xs.forEach(function (p) { var a = p.answers || {}, al = p.alpha || {};
        b.appendChild(el('tr', { 'data-prop': p.id }, [el('td', { text: label(p) }), el('td', {}, [el('b', { text: p.n }), el('div', { class: 'muted sm', text: lab(KIND, p.kind) })]), el('td', { class: 'sm', text: (lab(SUBS, a.sub) || 'Not chosen') + (a.text ? ': ' + a.text : '') + (a.text && !stillThere(a, fm) ? ' (since changed)' : '') }),
          el('td', { class: 'sm' }, [['c', 'Context'], ['i', 'Intervention'], ['m', 'Mechanisms'], ['o', 'Outcomes']].map(function (k) { return el('div', {}, [el('b', { text: k[1] + ': ' }), document.createTextNode(p[k[0]] || 'not written')]); })),
          el('td', { class: 'sm', text: al.showed ? (al.scenario ? al.scenario + ': ' : '') + al.showed : 'Not tested yet' }), el('td', { class: 'sm', text: al.holds || '' })]));
      });
      tb.appendChild(b); main.appendChild(el('div', { class: 'dscroll' }, [tb]));
    });
  }

  window.VTProps = {
    init: function (x) { X = x; el = x.el; },
    render: render, items: function () { return X ? items() : []; }, forEntry: forEntry, label: label, STATUS: STATUS, KIND: KIND, FUNCS: FUNCS,
    draft: function (d) { U.edit = 'new'; U.draft = Object.assign({ n: '', kind: 'fix', answers: null, c: '', i: '', m: '', o: '', alpha: { tool: '', scenario: '', showed: '', holds: '' }, status: 'proposed' }, d || {}); },
    counts: function () { var l = X ? items() : []; return { n: l.length, proposed: l.filter(function (p) { return (p.status || 'proposed') === 'proposed'; }).length, tested: l.filter(function (p) { return p.status === 'tested'; }).length, ready: l.filter(function (p) { return p.status === 'ready'; }).length }; },
    rows: function () { return items().map(function (p) { var a = p.answers || {}, al = p.alpha || {}; return [label(p), p.n, lab(KIND, p.kind), (lab(SUBS, a.sub) || '') + (a.text ? ': ' + a.text : ''), p.c || '', p.i || '', p.m || '', p.o || '', al.scenario || '', al.showed || '', al.holds || '', lab(STATUS, p.status || 'proposed')]; }); }
  };
})();
