// The beta test (stage 3 of the four steps, 30 October 2026). Test › The beta test.
// The people who run the service try the design propositions marked ready to try in use, live, in this service,
// and report back with the project code at /try. For each proposition the team chooses what they see: the
// proposition only (so their report is not shaped by the model), or the proposition and what the model predicted
// (so they can say whether it matched). The team can add a record too. Each record: who tried it, when, what
// happened, what it delivered, whether harm stayed within tolerance, and Purpose, Awareness, Coordination and
// Engagement. Then Reflect (what worked, why, and what we now need to ask) and a decision: proven in operation,
// or sent back, to Model (redesign the proposition), to Diagnose (the formulation missed something) or to Frame
// (look again at the question and the assumptions behind it).
// Saved in the 'beta' tile: { props: { id: { show, result, to, worked, why, ask, learnt, by, at, log } }, reports: [...] }
(function () {
  'use strict';
  var X, el, U = {};
  var PACE = [['purpose', 'Purpose'], ['awareness', 'Awareness'], ['coordination', 'Coordination'], ['engagement', 'Engagement']];
  var PV = { better: 'Better', same: 'No change', worse: 'Worse', unknown: 'Can’t say' };
  var HARM = { within: 'Within tolerance', crossed: 'Went beyond what is tolerable', unknown: 'Can’t say' };
  var CMP = { as: 'As the model predicted', better: 'Better than predicted', worse: 'Worse than predicted', unsure: 'Can’t say' };
  var TO = [['model', 'Model', 'Redesign the proposition: the idea is right, the design is not'], ['diagnose', 'Diagnose', 'The formulation missed something about how the service works or fails'], ['frame', 'Frame', 'Look again at the question, and the assumptions behind it']];
  var RES = { trying: 'Trying in use', proven: 'Proven in operation', sentback: 'Sent back' };

  function data() { var r = X.row('beta'); return JSON.parse(JSON.stringify((r && r.content) || {})); }
  function props() { return window.VTProps ? window.VTProps.items() : []; }
  function label(p) { return window.VTProps ? window.VTProps.label(p) : p.id; }
  function me() { var u = window.VTAuth && window.VTAuth.user && window.VTAuth.user(); return (u && (u.name || u.email)) || (X.S.data.as === 'master' ? 'David (master)' : 'Facilitator'); }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  async function save(c, summary) {
    var r = X.row('beta');
    try {
      var d = await X.api({ action: 'p_save', tile_key: 'beta', status: 'partly', summary: summary || 'Trial in the organisation (beta)', base_version: r ? r.version : null, content: c });
      X.S.data.tiles = (X.S.data.tiles || []).filter(function (t) { return t.tile_key !== 'beta'; }); X.S.data.tiles.push(d.tile);
    } catch (e) {
      if (e.status === 409) throw new Error('A report has just come in from the service. Reload the page, then make your change again.');
      throw e;
    }
  }
  async function saveProps(fn) {
    var r = X.row('props'), c = JSON.parse(JSON.stringify((r && r.content) || { items: [] }));
    fn(c.items || []);
    var d = await X.api({ action: 'p_save', tile_key: 'props', status: r ? r.status : 'partly', summary: 'Design propositions: changed from Test', base_version: r ? r.version : null, content: c });
    X.S.data.tiles = (X.S.data.tiles || []).filter(function (t) { return t.tile_key !== 'props'; }); X.S.data.tiles.push(d.tile);
  }
  // which propositions are in the beta test: ready to try, or already with a result or reports
  function inTest() { var b = data(), bp = b.props || {}, rs = b.reports || []; return props().filter(function (p) { return p.status === 'ready' || (bp[p.id] && bp[p.id].result) || rs.some(function (r) { return r.prop === p.id; }); }); }
  function resultOf(p, b) { var x = (b.props || {})[p.id] || {}; if (x.result === 'sentback' && p.status === 'ready') return 'trying'; return x.result || (p.status === 'ready' ? 'trying' : ''); }

  // ---------- what Test shows, read from the records ----------
  function summary(b) {
    var rs = b.reports || [], ps = inTest(), box = el('div', { class: 'glass evbox btsum', id: 'btSummary' });
    box.appendChild(el('div', { class: 'spread', style: 'align-items:center' }, [el('div', { class: 'flab', text: 'What Test shows so far' }), el('button', { class: 'btn sm no-print', id: 'btRefresh', text: 'Check for new reports', onclick: function () { location.reload(); } })]));
    if (!rs.length) { box.appendChild(el('p', { class: 'meta', text: 'No reports yet. Purpose, Awareness, Coordination and Engagement, and the stakeholder outcomes, are read from the reports as they come in.' })); return box; }
    var n = function (f) { return rs.filter(f).length; };
    box.appendChild(el('div', { class: 'btgrid' }, [
      el('div', {}, [el('b', { text: 'Stakeholder outcomes' }), el('p', { class: 'sm', style: 'margin:4px 0 0', text: '+ Value delivered: ' + n(function (r) { return r.value; }) + (rs.length === 1 ? ' report says' : ' of ' + rs.length + ' reports say') + ' what it delivered.' }), el('p', { class: 'sm', style: 'margin:2px 0 0', id: 'btHarm', text: '− Harm: ' + n(function (r) { return r.harm === 'within'; }) + ' within tolerance, ' + n(function (r) { return r.harm === 'crossed'; }) + ' beyond it, ' + n(function (r) { return !r.harm || r.harm === 'unknown'; }) + ' can’t say.' })]),
      el('div', {}, [el('b', { text: 'Purpose, Awareness, Coordination and Engagement' }), el('table', { class: 'bttally', id: 'btPace' }, [el('tbody', {}, PACE.map(function (k) { return el('tr', {}, [el('td', { text: k[1] })].concat(['better', 'same', 'worse'].map(function (v) { var c = n(function (r) { return r.pace && r.pace[k[0]] === v; }); return el('td', { class: c ? 'has ' + v : '', text: PV[v] + ' ' + c }); }))); }))])]),
      el('div', {}, [el('b', { text: 'The propositions' }), el('ul', { class: 'tl sm', style: 'margin:4px 0 0' }, ps.map(function (p) { return el('li', { text: label(p) + ' ' + p.n + ': ' + (RES[resultOf(p, b)] || 'Not in the test') + (function (k) { return ' (' + k + (k === 1 ? ' report)' : ' reports)'); })(rs.filter(function (r) { return r.prop === p.id; }).length) }); }))])]));
    return box;
  }

  // ---------- the page ----------
  function render(main, x) {
    X = x; el = x.el;
    var S = X.S, ro = !!S.readonly, b = data(), ps = inTest();
    X.head(S.data.session.name || 'Test', 'Trial in the organisation (beta)', 'Do the changes work in use, for the people who run the service? The design propositions marked ready to try in use are tried live, in this service, by the people who run it. They report back on their own page with the project code. Each report is set against what the model predicted, then the team reflects and decides: proven in operation, or sent back.');
    var code = S.data.session && S.data.session.session_code;
    if (!ro && code) main.appendChild(el('div', { class: 'glass evbox', id: 'btLink', style: 'margin-top:14px' }, [el('div', { class: 'flab', text: 'How the people who run the service report back' }),
      el('p', { class: 'sm', style: 'margin:6px 0 0' }, [document.createTextNode('Send them this page: '), el('b', { id: 'btUrl', text: location.origin + '/try' }), document.createTextNode(', with the project code '), el('b', { text: code }), document.createTextNode('. Or send the link that carries the code: '), el('span', { class: 'mono', id: 'btUrlCode', text: location.origin + '/try#code=' + code })]),
      el('p', { class: 'muted sm', style: 'margin:6px 0 0', text: 'Each person gives their name and role. They see only the changes marked ready to try in use, never the team’s workings.' })]));
    main.appendChild(summary(b));
    if (!ps.length) { main.appendChild(el('p', { class: 'meta', id: 'btNone', style: 'margin-top:16px' }, [document.createTextNode('No design proposition is ready to try in use yet. Mark one ready in '), el('a', { href: '/model' + location.search + '#props', text: 'Model, under Design propositions' }), document.createTextNode('.')])); return; }
    ps.forEach(function (p) { main.appendChild(card(p, b, ro)); });
  }

  function card(p, b, ro) {
    var bp = (b.props || {})[p.id] || {}, rs = (b.reports || []).filter(function (r) { return r.prop === p.id; }), res = resultOf(p, b), al = p.alpha || {};
    var box = el('div', { class: 'glass evbox btcard', 'data-prop': p.id, 'data-result': res || 'none' });
    box.appendChild(el('div', { class: 'spread', style: 'align-items:flex-start' }, [el('div', {}, [el('span', { class: 'prid', text: label(p) }), el('b', { class: 'prn', text: ' ' + p.n })]), el('span', { class: 'pill ' + (res === 'proven' ? 'ok' : res === 'sentback' ? 'warn' : ''), text: (RES[res] || 'Not ready to try') + (res === 'sentback' && bp.to ? ' to ' + bp.to.replace(/^./, function (c) { return c.toUpperCase(); }) : '') })]));
    // option 1: what the people trying it see
    var show = bp.show === 'yes' ? 'yes' : 'no';
    var opt = function (v, t, d) { var r = el('input', { type: 'radio', name: 'show-' + p.id, value: v, 'data-show': p.id + ':' + v, disabled: ro }); r.checked = show === v; r.addEventListener('change', async function () { try { var c = data(); c.props = c.props || {}; c.props[p.id] = Object.assign({}, c.props[p.id] || {}, { show: v }); await save(c, 'Trial in the organisation (beta): ' + label(p) + (v === 'yes' ? ' shows' : ' does not show') + ' what the model predicted'); X.render(); } catch (e) { alert(e.message); X.render(); } }); return el('label', { class: 'btopt' + (show === v ? ' on' : '') }, [r, el('span', {}, [el('b', { text: t }), el('span', { class: 'muted sm', text: d })])]); };
    box.appendChild(el('div', { class: 'btshow' }, [el('div', { class: 'prk', text: 'What the people trying it see' }), el('div', { class: 'btopts' }, [
      opt('no', 'The proposition only', 'They report what happened without knowing what the model predicted, so their report is not shaped by it.'),
      opt('yes', 'The proposition and what the model predicted', 'They can say whether it went as predicted, better or worse.')])]));
    // the model's prediction, set beside what happened
    box.appendChild(el('div', { class: 'btvs' }, [
      el('div', {}, [el('div', { class: 'prk', text: 'What the model predicted' }), el('p', { class: 'sm', text: al.showed ? (al.scenario ? al.scenario + ': ' : '') + al.showed : 'Not recorded' }), al.holds ? el('p', { class: 'muted sm', text: 'Holds when: ' + al.holds }) : null]),
      el('div', {}, [el('div', { class: 'prk', text: 'What happened in use (' + rs.length + (rs.length === 1 ? ' report)' : ' reports)') }), rs.length ? el('div', { class: 'btreps' }, rs.map(function (r) {
        return el('div', { class: 'btrep', 'data-report': r.id }, [el('p', { class: 'sm', style: 'margin:0' }, [el('b', { text: r.name + (r.role ? ', ' + r.role : '') }), el('span', { class: 'muted', text: ' · ' + (r.when || day(r.at)) + (r.via === 'team' ? ' · recorded by the team' : ' · from the service') + (r.saw === 'prediction' ? ' · saw the prediction' : '') })]),
          el('p', { class: 'sm', style: 'margin:4px 0 0', text: r.what }), r.value ? el('p', { class: 'sm', style: 'margin:4px 0 0' }, [el('b', { text: '+ ' }), document.createTextNode(r.value)]) : null,
          el('p', { class: 'sm', style: 'margin:4px 0 0' }, [el('b', { text: '− ' }), document.createTextNode(HARM[r.harm || 'unknown'] + (r.harmText ? ': ' + r.harmText : ''))]),
          el('p', { class: 'muted sm', style: 'margin:4px 0 0', text: PACE.map(function (k) { return k[1] + ': ' + PV[(r.pace || {})[k[0]] || 'unknown'].toLowerCase(); }).join(' · ') + (r.compare ? ' · ' + CMP[r.compare] : '') })]);
      })) : el('p', { class: 'meta', text: 'No reports yet.' })])]));
    if (!ro) box.appendChild(U.add === p.id ? addForm(p) : el('p', { style: 'margin:8px 0 0' }, [el('button', { class: 'btn sm', 'data-add': p.id, text: 'Add a record yourself', onclick: function () { U.add = p.id; X.render(); } }), el('span', { class: 'muted sm', text: '  For example, from a conversation with someone who tried it.' })]));
    box.appendChild(reflect(p, bp, res, ro));
    return box;
  }

  function addForm(p) {
    var f = {}, P = {};
    var inp = function (k, l, rows) { var t = rows ? el('textarea', { id: 'bt_' + k, rows: rows }) : el('input', { type: 'text', id: 'bt_' + k }); t.addEventListener('input', function () { f[k] = t.value; }); return el('label', { class: 'prf' }, [el('span', { text: l }), t]); };
    var sel = function (k, l, opts) { var s = el('select', { id: 'bt_' + k }, Object.keys(opts).map(function (v) { return el('option', { value: v, text: opts[v] }); })); s.value = 'unknown'; f[k] = 'unknown'; s.addEventListener('change', function () { f[k] = s.value; }); return el('label', { class: 'prf' }, [el('span', { text: l }), s]); };
    var paceSel = PACE.map(function (k) { var s = el('select', { id: 'bt_pace_' + k[0] }, Object.keys(PV).map(function (v) { return el('option', { value: v, text: PV[v] }); })); s.value = 'unknown'; s.addEventListener('change', function () { P[k[0]] = s.value; }); return el('label', { class: 'prf' }, [el('span', { text: k[1] }), s]); });
    var msg = el('span', { class: 'msg' });
    return el('div', { class: 'predit btadd', 'data-adding': p.id }, [el('div', { class: 'flab', text: 'A record of trying ' + label(p) }),
      el('div', { class: 'prrow' }, [inp('name', 'Who tried it'), inp('role', 'Their role')]), inp('when', 'When'), inp('what', 'What happened', 3), inp('value', 'What it delivered for the people who depend on the service', 2),
      el('div', { class: 'prrow' }, [sel('harm', 'Harm', HARM), inp('harmText', 'If harm went beyond what is tolerable, or came close, what happened')]),
      el('div', { class: 'btpace' }, paceSel),
      el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn solid', id: 'btSaveRec', text: 'Save the record', onclick: async function () {
        if (!String(f.name || '').trim() || !String(f.what || '').trim()) { msg.className = 'msg bad'; msg.textContent = 'Say who tried it and what happened.'; return; }
        var c = data(), pace = {}; PACE.forEach(function (k) { pace[k[0]] = P[k[0]] || 'unknown'; });
        c.reports = (c.reports || []).concat([{ id: 'r' + Date.now().toString(36), prop: p.id, via: 'team', by: me(), name: f.name.trim(), role: (f.role || '').trim(), when: (f.when || '').trim(), what: f.what.trim(), value: (f.value || '').trim(), harm: f.harm || 'unknown', harmText: (f.harmText || '').trim(), pace: pace, saw: 'team', at: new Date().toISOString() }]);
        try { await save(c, 'Trial in the organisation (beta): a record on ' + label(p)); U.add = null; X.render(); } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
      } }), el('button', { class: 'btn', text: 'Cancel', onclick: function () { U.add = null; X.render(); } }), msg])]);
  }

  // Reflect, then decide: proven in operation, or sent back (to Model, Diagnose or Frame)
  function reflect(p, bp, res, ro) {
    var f = { worked: bp.worked || '', why: bp.why || '', ask: bp.ask || '', learnt: bp.learnt || '', to: bp.to || 'model' };
    var ta = function (k, l, ph) { var t = el('textarea', { id: 'btr_' + k + '_' + p.id, rows: 2, placeholder: ph || '', disabled: ro }); t.value = f[k]; t.addEventListener('input', function () { f[k] = t.value; }); return el('label', { class: 'prf' }, [el('span', { text: l }), t]); };
    var box = el('div', { class: 'btreflect' }, [el('div', { class: 'prk', style: 'margin-top:14px', text: 'Reflect' }), ta('worked', 'What worked', 'And what did not'), ta('why', 'Why', 'What made the difference, set against what the model predicted'), ta('ask', 'What we now need to ask', 'A new question, or a sharper version of the old one')]);
    if (bp.result && bp.at) box.appendChild(el('p', { class: 'muted sm', text: RES[bp.result] + (bp.result === 'sentback' && bp.to ? ' to ' + ({ model: 'Model', diagnose: 'Diagnose', frame: 'Frame' })[bp.to] : '') + ' by ' + (bp.by || 'the team') + ', ' + day(bp.at) + (res === 'trying' && bp.result === 'sentback' ? '. It has since been made ready to try again.' : '.') }));
    if (ro || res === 'sentback') { if (res === 'sentback') box.appendChild(el('p', { class: 'muted sm', text: 'It comes back into the trial in the organisation when it is marked ready to try in use again, in Model.' })); return box; }
    var msg = el('span', { class: 'msg' });
    var toPick = el('div', { class: 'btto', hidden: true }, [el('div', { class: 'prk', style: 'margin-top:10px', text: 'Send it back to' })].concat(TO.map(function (t) { var r = el('input', { type: 'radio', name: 'to-' + p.id, value: t[0], 'data-to': p.id + ':' + t[0] }); r.checked = f.to === t[0]; r.addEventListener('change', function () { f.to = t[0]; }); return el('label', { class: 'btopt' }, [r, el('span', {}, [el('b', { text: t[1] }), el('span', { class: 'muted sm', text: t[2] })])]); })).concat([ta('learnt', 'What was learnt', 'This goes with it, so the step it returns to knows why'),
      el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn solid', 'data-sendback': p.id, text: 'Send it back', onclick: function () { decide('sentback'); } }), el('button', { class: 'btn', text: 'Cancel', onclick: function () { toPick.hidden = true; } })])]));
    async function decide(result) {
      if (result === 'sentback' && !String(f.learnt || f.ask || '').trim()) { msg.className = 'msg bad'; msg.textContent = 'Say what was learnt before sending it back.'; return; }
      var c = data(), now = new Date().toISOString(); c.props = c.props || {};
      var cur = c.props[p.id] || {}, rec = Object.assign({}, cur, { worked: f.worked, why: f.why, ask: f.ask, learnt: f.learnt, result: result, to: result === 'sentback' ? f.to : null, by: me(), at: now });
      rec.log = (cur.log || []).concat([{ result: result, to: rec.to, at: now, by: rec.by }]).slice(-20);
      c.props[p.id] = rec;
      try {
        await save(c, 'Trial in the organisation (beta): ' + label(p) + ' ' + (result === 'proven' ? 'proven in operation' : result === 'sentback' ? 'sent back to ' + f.to : 'reflected on'));
        if (result === 'sentback') {
          await saveProps(function (items) { items.forEach(function (x) { if (x.id === p.id) { x.status = 'proposed'; x.back = { to: f.to, learnt: f.learnt, ask: f.ask, at: now, by: me() }; } }); });
          if (f.to === 'frame') { var q = await X.api({ action: 'p_question_add', tile_key: 'question', from_practice: 'test', text: (f.ask || f.learnt).slice(0, 1000), why: ('From Test, ' + label(p) + ' ' + p.n + ': ' + (f.learnt || '')).slice(0, 1000) }); X.S.data.questions = (X.S.data.questions || []).concat([q.question]); }
        }
        X.render();
      } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
    }
    box.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [
      el('button', { class: 'btn sm', 'data-savereflect': p.id, text: 'Save the reflection', onclick: function () { decide(res === 'proven' ? 'proven' : 'trying'); } }),
      res !== 'proven' ? el('button', { class: 'btn sm solid', 'data-proven': p.id, text: 'Proven in operation', onclick: function () { if (confirm(label(p) + ': mark it proven in operation? It leaves the list the service sees.')) decide('proven'); } }) : null,
      el('button', { class: 'btn sm', 'data-sendopen': p.id, text: 'Send it back', onclick: function () { toPick.hidden = false; } }), msg]));
    box.appendChild(toPick);
    return box;
  }

  // the decision, made from an experiment card in Test (31 October 2026); the same records as Reflect
  async function decideFor(pid, result, f) {
    var p = props().filter(function (x) { return x.id === pid; })[0]; if (!p) throw new Error('That proposition was not found');
    f = f || {}; var c = data(), now = new Date().toISOString(); c.props = c.props || {};
    var cur = c.props[p.id] || {}, rec = Object.assign({}, cur, { worked: f.worked || cur.worked || '', why: f.why || cur.why || '', ask: f.ask || cur.ask || '', learnt: f.learnt || cur.learnt || '', result: result, to: result === 'sentback' ? (f.to || 'model') : null, by: me(), at: now });
    rec.log = (cur.log || []).concat([{ result: result, to: rec.to, at: now, by: rec.by }]).slice(-20);
    c.props[p.id] = rec;
    await save(c, 'Trial in the organisation (beta): ' + label(p) + ' ' + (result === 'proven' ? 'proven in operation' : result === 'sentback' ? 'sent back to ' + rec.to : 'extended'));
    if (result === 'sentback') {
      await saveProps(function (items) { items.forEach(function (x) { if (x.id === p.id) { x.status = 'proposed'; x.back = { to: rec.to, learnt: rec.learnt, ask: rec.ask, at: now, by: me() }; } }); });
      if (rec.to === 'frame') { var q = await X.api({ action: 'p_question_add', tile_key: 'question', from_practice: 'test', text: (rec.ask || rec.learnt || 'Sent back from Test').slice(0, 1000), why: ('From Test, ' + label(p) + ' ' + p.n + ': ' + (rec.learnt || '')).slice(0, 1000) }); X.S.data.questions = (X.S.data.questions || []).concat([q.question]); }
    }
  }
  function reportsFor(pid) { return (data().reports || []).filter(function (r) { return r.prop === pid; }); }
  window.VTBeta = {
    decideFor: decideFor, reportsFor: reportsFor,
    init: function (x) { X = x; el = x.el; }, render: render,
    // for Test's part pages (31 October 2026): each proposition in the beta test, its result and reports, and the report tallies
    status: function () { if (!X) return []; var b = data(), rs = b.reports || []; return inTest().map(function (p) { var x = (b.props || {})[p.id] || {}; return { id: p.id, label: label(p), n: p.n, result: resultOf(p, b), to: x.to || '', reports: rs.filter(function (r) { return r.prop === p.id; }).length, learnt: x.learnt || x.worked || '' }; }); },
    tally: function () { if (!X) return { n: 0 }; var rs = data().reports || [], n = function (f) { return rs.filter(f).length; }, pace = {}; PACE.forEach(function (k) { pace[k[0]] = { better: n(function (r) { return r.pace && r.pace[k[0]] === 'better'; }), same: n(function (r) { return r.pace && r.pace[k[0]] === 'same'; }), worse: n(function (r) { return r.pace && r.pace[k[0]] === 'worse'; }) }; }); return { n: rs.length, value: n(function (r) { return r.value; }), within: n(function (r) { return r.harm === 'within'; }), crossed: n(function (r) { return r.harm === 'crossed'; }), pace: pace }; },
    counts: function () { if (!X) return { n: 0 }; var b = data(), ps = inTest(); return { n: ps.length, reports: (b.reports || []).length, proven: ps.filter(function (p) { return resultOf(p, b) === 'proven'; }).length, back: ps.filter(function (p) { return resultOf(p, b) === 'sentback'; }).length }; },
    rows: function () { var b = data(), all = props(); return (b.reports || []).map(function (r) { var p = all.filter(function (x) { return x.id === r.prop; })[0] || { id: r.prop, n: '' }; return [label(p) + ' ' + p.n, r.name + (r.role ? ', ' + r.role : ''), r.when || day(r.at), r.what, r.value || '', HARM[r.harm || 'unknown'] + (r.harmText ? ': ' + r.harmText : ''), PACE.map(function (k) { return k[1] + ' ' + PV[(r.pace || {})[k[0]] || 'unknown'].toLowerCase(); }).join('; '), r.compare ? CMP[r.compare] : '']; }); },
    decisions: function () { var b = data(); return props().filter(function (p) { return (b.props || {})[p.id] && b.props[p.id].result; }).map(function (p) { var x = b.props[p.id]; return [label(p) + ' ' + p.n, RES[resultOf(p, b)] + (x.result === 'sentback' && x.to ? ' to ' + x.to : ''), x.worked || '', x.why || '', x.ask || '', x.learnt || '']; }); }
  };
})();
