// Step 2 of Frame: "What we are working on". Box 1's page is a guided route, taken from the
// Define tool (tools.changebefore.com/define), one decision at a time, with the system map beside it filling
// in as each answer is given. Task sheet 2026-10-26-problem-six-steps-define-route.md, part B.
// The route is kept in the frame tile, under answers.system.route; box 1's fields are written from it, so the
// rest of the Lab reads the system as before. With suggestions off, every list is typed in by the team.
(function () {
  'use strict';
  var X, el, S, HOST, B = { msg: null, err: null, busy: false, why: null, which: null, leave: null, tidy: null };
  var REGEN_MAX = 2;
  var CAPK = [['human', 'Human'], ['social', 'Social and relationship'], ['manufactured', 'Manufactured'], ['information', 'Information'], ['financial', 'Financial'], ['natural', 'Natural']];

  // ---------- the screens, in order ----------
  var SCREENS = [
    { id: 'describe', q: 'What do you want to work on?', test: 'Describe it in your own words: a service, a team, a process or a part of the business.', why: 'We need to agree what we are looking at before we look at what is wrong with it, or how it could be better.' },
    { id: 'clarify', q: 'Is the name clear enough?', ai: true },
    { id: 'name', q: 'So you’re working on:', why: 'A short, plain name we can all use for it.' },
    { id: 'within', q: 'What bigger organisation or system is it part of?', list: 'within', help: 'Choose all that apply.', why: 'It shows who can overrule it and whose rules it works within.' },
    { id: 'inside', q: 'What do people in {svc} control?', list: 'inside', test: 'What can they change without asking anyone else?', help: 'All ticked to start: untick anything they can’t change on their own.', why: 'This draws the edge of the service: what sits inside it, whoever you are in the organisation.' },
    { id: 'outside', q: 'What decisions are taken outside {svc} that affect it?', list: 'outside', test: 'Made by someone else: another department, a supplier, head office, a regulator. People in the service can only influence them.', help: 'All ticked to start: untick anything that isn’t true. Mark each one “decided elsewhere” or “we can influence”, and leave out anything you deliberately exclude.', why: 'Many problems start at the edge, where a decision made elsewhere lands on the service.' },
    { id: 'level', q: 'Is this the right level to work at?', test: 'Sometimes the real issue sits one level down, or one level up.', why: 'Working at the wrong level is the commonest way to solve the wrong problem.' },
    { id: 'inputs', q: 'What comes into {svc}?', list: 'inputs', test: 'What arrives and gets used or worked on.', help: 'Choose all that apply.', why: 'What comes in, and in what state, shapes everything the service can do with it.' },
    { id: 'work', q: 'What does {svc} do?', list: 'work', test: 'The main pieces of work, roughly in order.', help: 'Choose all that apply.', why: 'These become the steps on the picture, and where we look first for what goes wrong.' },
    { id: 'outputs', q: 'What comes out of {svc}?', list: 'outputs', test: 'What it produces, or what is different afterwards.', help: 'Choose all that apply.', why: 'What comes out is how anyone outside the service judges it.' },
    { id: 'how', q: 'Does this capture how it works?' },
    { id: 'shape', q: 'Does it run as steps, as parts, or both?', test: 'Steps happen in order. Parts are teams or units that each do their own piece. Many things are both.', why: 'It decides how the picture of the service is drawn, and how we trace a problem through it.' }];
  var LISTQ = { within: 'What bigger organisation or system is it part of?', inside: 'What do people in the service control?', outside: 'What decisions are taken outside the service that affect it?', inputs: 'What goes into it?', work: 'What does it do?', outputs: 'What does it produce or achieve?' };
  var DEFAULT_ON = { inside: true, outside: true };

  // ---------- data ----------
  function frameRow() { return X.row('frame'); }
  function answers() { var r = frameRow(); return (r && r.content && r.content.answers) || {}; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function R() { var a = answers(), y = a.system || {}; return y.route || seed(y); }
  // a session that had box 1 filled in before the route existed starts from its fields
  function seed(y) { var f = (y && y.fields) || {}; return f.what ? { at: 'name', desc: f.what, name: f.what, lists: {}, seeded: true } : { at: 'describe', lists: {} }; }
  function L(r, k) { return (r.lists && r.lists[k]) || []; }
  function on(r, k) { return L(r, k).filter(function (x) { return x.on; }).map(function (x) { return x.t; }); }
  function caretIn(e) { var fix = function () { var s = window.getSelection(); if (s && !e.contains(s.anchorNode)) { var g = document.createRange(); g.selectNodeContents(e); g.collapse(false); s.removeAllRanges(); s.addRange(g); } }; e.addEventListener('focus', function () { fix(); setTimeout(fix, 0); }); e.addEventListener('keydown', fix); return e; }
  function aiOn() { var r = X.row('aiset'); return !!(r && r.content && r.content.on); }
  function me() { return S.data.as === 'master' ? 'David (master)' : 'Facilitator'; }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function helpWords() { var h = answers().help; return (h && h.fields && h.fields.words) || ''; }
  function purposeFor() { var s = answers().service; return (s && s.fields && (s.fields.for || s.fields.provides)) || ''; }
  function joinlc(a) { return join(a.map(function (t, i) { return i ? lc(t) : t; })); }
  function join(a) { a = a.filter(Boolean); return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function svc(r) { var n = (r && r.name) || 'the service'; return lc(n); }
  function qOf(sc, r) { return String(sc.q || '').replace(/\{svc\}/g, svc(r)); }
  function lc(t) { t = String(t || ''); return t && !/^[A-Z]{2,}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }

  // box 1's fields, written from the route, so the rest of the Lab reads the system as before
  function fieldsFrom(r, f) {
    f = f || {};
    if (r.name) f.what = r.name;
    var ins = on(r, 'inside'), outs = L(r, 'outside').filter(function (x) { return x.on; });
    if (r.named) { f.boundary = ''; f.leftout = ''; }
    if (ins.length || outs.length) f.boundary = (ins.length ? 'Working on: ' + ins.join('; ') + '.' : '') + (outs.length ? (ins.length ? ' ' : '') + 'Kept in view: ' + outs.map(function (x) { return x.t + ' (' + (x.m === 'influence' ? 'we can influence' : 'set elsewhere') + ')'; }).join('; ') + '.' : '');
    var w = r.standalone ? 'It stands alone' : on(r, 'within').length ? 'Inside ' + join(on(r, 'within')) : '';
    if (w || r.time) f.level = [w, r.time].filter(Boolean).join('. ') + '.';
    if ((r.changing || []).length) f.changing = r.changing.join('; ') + '.';
    if (r.shape) f.shape = r.shape;
    if ((r.steps || []).length) f.steps = r.steps.map(function (s) { return s.n + (s.who ? ' (' + s.who + ')' : ''); }).join('; ') + '.';
    if ((r.parts || []).length) f.parts = r.parts.join('; ') + '.';
    if ((r.leftout || []).length) f.leftout = r.leftout.map(function (x) { return x.t + (x.why ? ': ' + x.why : ''); }).join('; ') + '.';
    return f;
  }
  // when the guided flow hosts these screens, its saves and these go one after another
  function save(mut, summary) { return GH && GH.run ? GH.run(function () { return save1(mut, summary); }) : save1(mut, summary); }
  async function save1(mut, summary) {
    var r0 = frameRow(), c = clone((r0 && r0.content) || {}); c.answers = c.answers || {};
    var y = c.answers.system = c.answers.system || {}; y.fields = y.fields || {};
    var r = y.route ? y.route : seed(y); r.lists = r.lists || {};
    var before = JSON.stringify(y.fields), atWas = r.at;
    mut(r, c.answers);
    if (GH && r.at !== atWas) GH.moved(r.at, atWas);
    y.route = r;
    var pf = clone(y.fields); fieldsFrom(r, y.fields);
    var now = new Date().toISOString();
    if (JSON.stringify(y.fields) !== before) { if (JSON.parse(before).what) { y.past = (y.past || []).slice(0); y.past.unshift({ fields: pf, by: y.by, at: y.at }); y.past = y.past.slice(0, 20); } y.from = (y.from || []).filter(function (x) { return x.way !== 'route'; }).concat([{ way: 'route' }]); }
    y.by = me(); y.at = now;
    var d = await X.api({ action: 'p_save', tile_key: 'frame', status: r0 ? r0.status : 'partly', summary: summary || 'Changed: What we are working on', content: c, base_version: r0 ? r0.version : null });
    S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'frame'; }); S.data.tiles.push(d.tile);
  }
  async function safe(fn) { try { B.busy = true; paint(); await fn(); B.err = null; } catch (e) { B.err = e.message; } B.busy = false; paint(); }
  function ai(stage, extra) {
    var r = R(), body = { action: 'ai_define', stage: stage, name: r.name || '', desc: r.desc || '', context: [r.useNotes !== false ? helpWords() : '', GH && GH.context ? GH.context() : ''].filter(Boolean).join('\n\n').slice(0, 4000), clarify: r.clarify || '' };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    return X.api(body);
  }
  // merge suggested options into a list, keeping what the team has ticked or added
  function merge(list, items, dflt) {
    list = (list || []).slice(0); var have = list.map(function (x) { return x.t.toLowerCase(); });
    (items || []).forEach(function (t) { if (have.indexOf(t.toLowerCase()) < 0) { list.push({ t: t, on: !!dflt, ai: true }); have.push(t.toLowerCase()); } });
    return list;
  }
  async function fetchOptions(r) {
    var o = await ai('options', { within: on(r, 'within').join('; ') });
    await save(function (x) {
      x.opts = o; x.lists = x.lists || {};
      ['within', 'inside', 'outside', 'inputs', 'work', 'outputs'].forEach(function (k) { x.lists[k] = merge(x.lists[k], o[k], DEFAULT_ON[k]); if (k === 'outside') x.lists[k].forEach(function (i) { i.m = i.m || 'elsewhere'; }); });
    }, 'Suggestions for what we are working on');
  }
  function go(at) { return save(function (r) { r.at = at; }); }
  function idx(id) { for (var i = 0; i < SCREENS.length; i++) if (SCREENS[i].id === id) return i; return 0; }
  function prevOf(r) { var i = idx(r.at) - 1; if (i >= 0 && SCREENS[i].id === 'clarify' && !needClarify(r)) i--; return i >= 0 ? SCREENS[i].id : null; }
  function needClarify(r) { return !!(r.check && (r.check.unclear || r.check.physical)); }

  // ---------- the page ----------
  function render(main, x) {
    X = x; el = x.el; S = x.S; if (window.VTBox && window.VTBox.css) window.VTBox.css(); css();
    document.body.classList.add('bx-on');
    HOST = el('div', { class: 'bx rt', id: 'rtHost' }); main.appendChild(HOST); paint();
  }
  var GH = null; // the guided flow, when it hosts these screens
  function paint() {
    if (GH) return GH.paint();
    if (!HOST) return;
    var r = R(), agreed = !!r.agreed, view = agreed && !B.redo ? 'done' : (r.at || 'describe');
    HOST.innerHTML = '';
    var sc = SCREENS[idx(view)], n = idx(view) + 1;
    HOST.appendChild(el('div', { class: 'bx-head' }, [
      el('div', { class: 'bx-hl' }, [el('button', { class: 'bx-back', id: 'bxBack', onclick: function () { X.go('canvas'); } }, ['‹ Canvas']), el('b', { class: 'bx-name', text: 'What we are working on' }), el('span', { class: 'bx-faint', text: 'Step 2 of ' + window.PROBLEM.frame.steps.length })]),
      el('div', { class: 'rt-prog', id: 'rtProg' }, [view === 'done' ? el('span', { text: 'Agreed ' + day(r.agreed.at) }) : el('span', { text: 'Question ' + n + ' of ' + SCREENS.length })]),
      el('div', { class: 'bx-hr' }, [el('span', { class: 'bx-svc', text: r.name || '' })])]));
    var grid = el('div', { class: 'rt-grid' + (view === 'done' || view === 'shape' ? ' wide' : '') }), centre = el('div', { class: 'rt-centre', id: 'rtCentre' }), right = el('div', { class: 'rt-right', id: 'rtMapHost' });
    grid.appendChild(centre); grid.appendChild(right); HOST.appendChild(grid);
    var s = view === 'done' ? doneScreen(r) : SCREEN[view](r, sc);
    if (view !== 'done') centre.appendChild(el('h1', { class: 'rt-q', id: 'rtQ', text: qOf(sc, r) }));
    if (sc && sc.test && view !== 'done') centre.appendChild(el('p', { class: 'rt-test', text: sc.test }));
    if (sc && sc.help && view !== 'done') centre.appendChild(el('p', { class: 'bx-faint rt-help', text: sc.help }));
    (s.body || []).forEach(function (k) { if (k) centre.appendChild(k); });
    right.appendChild(mapEl(r, { edit: view === 'shape' || view === 'done' }));
    var pv = view === 'done' ? null : prevOf(r);
    var foot = el('div', { class: 'bx-foot' }, [
      s.primary ? el('button', { class: 'bx-primary', id: 'bxPrimary', disabled: B.busy || s.primary.off ? true : null, onclick: s.primary.fn }, [B.busy ? 'Working…' : s.primary.text]) : null,
      el('div', { class: 'bx-hint' + (B.err ? ' bad' : ''), id: 'bxHint', text: B.err || B.msg || s.hint || '' }),
      el('div', { class: 'row', style: 'justify-content:center;gap:22px' }, [pv ? el('button', { class: 'bx-link sm', id: 'rtPrev', onclick: function () { B.which = null; B.why = null; safe(function () { return go(pv); }); } }, ['‹ Back']) : null].concat(s.links || []))]);
    HOST.appendChild(foot);
    B.msg = null;
    var f = HOST.querySelector('[data-autofocus]'); if (f && !B.busy) try { f.focus(); } catch (e) {}
  }

  // ---------- one list of options: ticked, added to, replaced ----------
  function plist(r, key, extra) {
    var list = L(r, key), host = el('div', { class: 'rt-list', 'data-list': key });
    list.forEach(function (it, i) {
      var cb = el('input', { type: 'checkbox', checked: it.on, 'data-item': it.t });
      cb.addEventListener('change', function () { safe(function () { return save(function (x) { x.lists[key][i].on = cb.checked; }); }); });
      host.appendChild(el('div', { class: 'rt-opt' + (it.on ? ' on' : '') }, [el('label', {}, [cb, el('span', { text: it.t })]), it.n ? el('span', { class: 'rt-note2', text: it.n }) : null, extra ? extra(it, i) : null]));
    });
    if (!list.length) host.appendChild(el('p', { class: 'bx-faint', text: aiOn() ? 'No options yet: add your own below.' : 'Add your own below, one at a time.' }));
    var add = el('input', { type: 'text', class: 'rt-add', id: 'rtAdd-' + key, placeholder: 'Add your own', 'aria-label': 'Add your own' });
    var doAdd = function () { var v = add.value.trim(); if (!v) return; safe(function () { return save(function (x) { x.lists[key] = (x.lists[key] || []).concat([{ t: v, on: true, own: true, m: key === 'outside' ? 'elsewhere' : undefined }]); }); }); };
    add.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    host.appendChild(el('div', { class: 'rt-addrow' }, [add, el('button', { class: 'bx-link sm', id: 'rtAddBtn-' + key, onclick: doAdd }, ['Add'])]));
    // "These don't fit": what is wrong, then replacements (at most twice per list)
    if (aiOn()) {
      var used = (r.regen && r.regen[key]) || 0;
      if (B.why === key) {
        var w = el('textarea', { class: 'rt-why', id: 'rtWhy', rows: 2, placeholder: 'What’s missing, or what is wrong with these?', 'data-autofocus': '' });
        host.appendChild(el('div', { class: 'bx-card rt-card' }, [w, el('div', { class: 'row', style: 'gap:16px;margin-top:8px' }, [el('button', { class: 'bx-link', id: 'rtWhyGo', onclick: function () { replace(key, w.value.trim()); } }, ['Suggest others']), el('button', { class: 'bx-link sm', onclick: function () { B.why = null; paint(); } }, ['Cancel'])])]));
      } else if (used < REGEN_MAX) host.appendChild(el('button', { class: 'bx-link sm', id: 'rtNoFit-' + key, onclick: function () { B.why = key; paint(); } }, ['Not quite right? Tell us what’s missing']));
      else host.appendChild(el('p', { class: 'bx-faint', text: 'Replaced twice already: add your own above.' }));
    }
    return host;
  }
  function replace(key, why) {
    safe(async function () {
      var r = R(), list = L(r, key);
      var o = await ai('replace', { question: LISTQ[key], original: list.filter(function (x) { return !x.own; }).map(function (x) { return x.t; }), why: why, own: list.filter(function (x) { return x.own; }).map(function (x) { return x.t; }), within: on(r, 'within').join('; ') });
      await save(function (x) {
        var keep = (x.lists[key] || []).filter(function (i) { return i.own || i.on; });
        x.lists[key] = merge(keep, o.options, DEFAULT_ON[key]); if (key === 'outside') x.lists[key].forEach(function (i) { i.m = i.m || 'elsewhere'; });
        x.regen = x.regen || {}; x.regen[key] = (x.regen[key] || 0) + 1;
      }, 'Replaced the options: ' + LISTQ[key]);
      B.why = null; B.msg = 'New options found';
    });
  }

  // ---------- the screens ----------
  var SCREEN = {
    describe: function (r) {
      var t = el('textarea', { class: 'rt-big', id: 'rtDesc', rows: 4, placeholder: 'Describe it in your own words.', 'data-autofocus': '', value: r.desc || '' });
      var lk = el('input', { type: 'url', class: 'rt-add', id: 'rtLink', placeholder: 'A link to a web page (optional)', value: r.link || '' });
      var hw = helpWords(), use = el('input', { type: 'checkbox', id: 'rtUseNotes', checked: r.useNotes !== false });
      var file = el('input', { type: 'file', id: 'rtDoc', accept: '.txt,.md,.docx,.pdf,.csv', style: 'display:none' });
      file.addEventListener('change', function () { var f = file.files[0]; if (!f) return; safe(async function () { var txt = X.readFileText ? await X.readFileText(f) : ''; await save(function (x) { x.doc = { name: f.name, text: String(txt || '').slice(0, 4000) }; }); B.msg = 'Added ' + f.name; }); });
      return { body: [t,
        el('div', { class: 'rt-opts' }, [hw ? el('label', { class: 'rt-chk' }, [use, el('span', { text: 'Use what they told us in the first call' })]) : null,
          lk, el('div', {}, [el('button', { class: 'bx-link sm', id: 'rtDocBtn', onclick: function () { file.click(); } }, [r.doc ? 'Document: ' + r.doc.name : 'Add a document (optional)']), file])])],
        primary: { text: 'Next', fn: function () {
          var d = t.value.trim(); if (!d) { B.err = 'Describe it in a line or two first.'; return paint(); }
          safe(async function () {
            await save(function (x) { x.desc = d; x.link = lk.value.trim() || null; x.useNotes = hw ? use.checked : false; if (!x.name || x.seeded) x.name = x.name || d.split(/[.\n]/)[0].slice(0, 80); });
            if (aiOn()) {
              var chk = await ai('check', { desc: d + (R().doc ? '\n' + R().doc.text : '') });
              await save(function (x) { x.check = chk; });
              if (chk.unclear || chk.physical) return go('clarify');
              var nm = await ai('name'); await save(function (x) { if (nm.name) { x.name = nm.name; x.suggested = nm.name; } x.at = 'name'; });
            } else await go('name');
          });
        } } };
    },
    clarify: function (r) {
      var c = r.check || {}, body = [];
      if (c.physical) {
        body.push(el('p', { class: 'rt-test', text: 'What job does it do for the people who use it?' }));
        body.push(el('div', { class: 'rt-list' }, (c.jobs || []).map(function (j) { return el('button', { class: 'rt-pick' + (r.clarify === j ? ' on' : ''), 'data-job': j, onclick: function () { safe(function () { return save(function (x) { x.clarify = j; }); }); } }, [j]); })));
      }
      if (c.unclear && c.question) body.push(el('p', { class: 'rt-test', id: 'rtClarQ', text: c.question }));
      var a = el('textarea', { class: 'rt-big', id: 'rtClarify', rows: 2, placeholder: 'Your answer', value: c.physical ? '' : r.clarify || '' });
      body.push(a);
      return { body: body, primary: { text: 'Next', fn: function () { safe(async function () { var v = a.value.trim(); await save(function (x) { if (v) x.clarify = v; }); var nm = await ai('name'); await save(function (x) { if (nm.name) { x.name = nm.name; x.suggested = nm.name; } x.at = 'name'; }); }); } } };
    },
    name: function (r) {
      var n = caretIn(el('div', { class: 'rt-name', id: 'rtName', contenteditable: 'true', role: 'textbox', 'aria-label': 'The name of the system', 'data-ph': 'Name it in under eight words', text: r.name || '' }));
      return { body: [n, el('p', { class: 'bx-faint', text: 'Under eight words, with no unexplained short forms. Tap it to correct it. The confirmed name becomes the map’s title.' })],
        primary: { text: 'Yes, that’s right', fn: function () {
          var v = n.innerText.trim(); if (!v) { B.err = 'Give it a name first.'; return paint(); }
          safe(async function () { await save(function (x) { x.name = v; x.named = true; x.seeded = false; x.at = 'within'; }, 'Named the system: ' + v); if (aiOn() && !R().opts) await fetchOptions(R()); });
        } } };
    },
    within: function (r) {
      var cb = el('input', { type: 'checkbox', id: 'rtAlone', checked: !!r.standalone });
      cb.addEventListener('change', function () { safe(function () { return save(function (x) { x.standalone = cb.checked; }); }); });
      return { body: [plist(r, 'within'), el('label', { class: 'rt-chk', style: 'margin-top:14px' }, [cb, el('span', { text: 'It stands alone: it doesn’t sit inside anything larger' })])], primary: next(r, 'inside') };
    },
    inside: function (r) { return { body: [plist(r, 'inside')], primary: next(r, 'outside') }; },
    outside: function (r) {
      var body = [plist(r, 'outside', function (it, i) {
        var mk = el('button', { class: 'rt-mark', 'data-mark': it.t, title: 'Switch the mark', onclick: function () { safe(function () { return save(function (x) { x.lists.outside[i].m = x.lists.outside[i].m === 'influence' ? 'elsewhere' : 'influence'; }); }); } }, [it.m === 'influence' ? 'we can influence' : 'decided elsewhere']);
        var lo = el('button', { class: 'bx-link sm', 'data-leave': it.t, onclick: function () { B.leave = it.t; paint(); } }, ['Leave out']);
        var row = el('span', { class: 'rt-mk' }, [mk, lo]);
        if (B.leave === it.t) {
          var why = el('input', { type: 'text', class: 'rt-add', id: 'rtLeaveWhy', placeholder: 'Why is it left out?', 'data-autofocus': '' });
          row = el('span', { class: 'rt-mk' }, [why, el('button', { class: 'bx-link sm', id: 'rtLeaveGo', onclick: function () { var w = why.value.trim(); if (!w) return; safe(async function () { await save(function (x) { x.lists.outside.splice(i, 1); x.leftout = (x.leftout || []).concat([{ t: it.t, why: w }]); }, 'Left out: ' + it.t); B.leave = null; }); } }, ['Leave out'])]);
        }
        return row;
      })];
      if ((r.leftout || []).length) body.push(el('div', { class: 'rt-left' }, [el('div', { class: 'bx-over' }, [el('span', { text: 'Left out' })])].concat(r.leftout.map(function (x, i) { return el('div', { class: 'rt-opt' }, [el('span', { text: x.t + (x.why ? ': ' + x.why : '') }), el('button', { class: 'bx-link sm', onclick: function () { safe(function () { return save(function (y) { var g = y.leftout.splice(i, 1)[0]; y.lists.outside = (y.lists.outside || []).concat([{ t: g.t, on: true, m: 'elsewhere' }]); }); }); } }, ['Bring back'])]); }))));
      return { body: body, primary: next(r, 'level') };
    },
    level: function (r) {
      var parent = r.standalone ? 'It stands alone' : join(on(r, 'within')) || 'Not said yet';
      var pan = function (id, title, sub, items, onlyCarry) {
        var open = B.which && B.which.side === id;
        var kids = [el('b', { text: title }), el('p', { class: 'bx-faint', text: sub })];
        if (!onlyCarry && items.length) kids.push(el('ul', {}, items.slice(0, 6).map(function (t) { return el('li', { text: t }); })));
        if (open) {
          kids.push(el('div', { class: 'rt-which' }, [el('p', { class: 'rt-test', text: 'Which one?' })].concat(items.map(function (t) { return el('label', { class: 'rt-chk' }, [el('input', { type: 'radio', name: 'rtWhich', value: t, checked: B.which.pick === t, onchange: function () { B.which.pick = t; paint(); } }), el('span', { text: t })]); }))));
          if (B.which.pick) {
            var why = el('input', { type: 'text', class: 'rt-add', id: 'rtLevelWhy', placeholder: 'In a line: why work at this level instead?', 'data-autofocus': '' });
            kids.push(why); kids.push(el('button', { class: 'bx-link', id: 'rtLevelGo', onclick: function () { var w = why.value.trim(); if (!w) { B.err = 'Say in a line why the level changed.'; return paint(); } changeLevel(B.which.pick, w); } }, ['Work at this level']));
          }
        }
        return el('div', { class: 'rt-panel' + (open ? ' open' : ''), 'data-panel': id, role: onlyCarry ? null : 'button', onclick: onlyCarry ? null : function (e) { if (e.target.closest('.rt-which,input,button')) return; B.which = open ? null : { side: id, pick: null }; paint(); } }, kids);
      };
      var carry = el('div', { class: 'rt-panel carry', 'data-panel': 'carry' }, [el('b', { text: 'Carry on with this' }), el('p', { class: 'rt-pname', text: r.name || '' }), el('p', { class: 'bx-faint', text: 'Part of: ' + parent })]);
      var body = [el('div', { class: 'rt-panels' }, [carry, pan('in', 'Something inside it', 'Work on one part of it instead', on(r, 'inside')), pan('out', 'Something it is part of', 'Work on something larger, or alongside it', on(r, 'within').concat(on(r, 'outside')))])];
      if ((r.history || []).length) body.push(el('div', { class: 'rt-hist', id: 'rtHist' }, [el('div', { class: 'bx-over' }, [el('span', { text: 'Earlier levels' })])].concat(r.history.map(function (h) { return el('p', { class: 'bx-faint', text: day(h.at) + ': ' + h.name + '. Changed because: ' + h.why }); }))));
      return { body: body, primary: { text: 'Carry on with this', fn: function () { B.which = null; safe(function () { return save(function (x) { x.level = { choice: 'carry', at: new Date().toISOString() }; x.at = 'inputs'; }); }); } } };
    },
    inputs: function (r) { return { body: [plist(r, 'inputs')], primary: next(r, 'work') }; },
    work: function (r) { return { body: [plist(r, 'work')], primary: next(r, 'outputs') }; },
    outputs: function (r) { return { body: [plist(r, 'outputs')], primary: next(r, 'how') }; },
    how: function (r) {
      var draft = r.how || composeHow(r);
      var t = caretIn(el('div', { class: 'rt-how', id: 'rtHow', contenteditable: 'true', role: 'textbox', 'aria-label': 'How it works', text: draft }));
      var links = [el('button', { class: 'bx-link sm', id: 'rtCorrect', onclick: function () { t.focus(); } }, ['Let me correct this'])];
      if (aiOn()) links.push(el('button', { class: 'bx-link sm', id: 'rtTidy', onclick: function () { var v = t.innerText.trim(); safe(async function () { var o = await ai('tidy', { text: v }); B.tidy = { mine: v, offer: o.text }; }); } }, ['Tidy this up']));
      var body = [t, el('div', { class: 'row', style: 'gap:22px;margin-top:10px' }, links)];
      // with suggestions off, the summary is written from the lists, so ask whom it serves
      var sv = null;
      if (!aiOn()) { sv = el('input', { type: 'text', class: 'rt-add', id: 'rtServes', placeholder: 'For example: customers who are owed money', value: r.serves || '' }); body.push(el('div', { class: 'rt-sub' }, [el('div', { class: 'bx-over' }, [el('span', { text: 'Serving whom?' })]), sv])); }
      if (B.tidy && B.tidy.offer) body.push(el('div', { class: 'bx-card rt-card', id: 'rtTidyCard' }, [el('p', { class: 'bx-faint', text: 'A tidier version, with all the content kept:' }), el('p', { class: 'rt-offer', text: B.tidy.offer }), el('div', { class: 'row', style: 'gap:18px' }, [
        el('button', { class: 'bx-link', id: 'rtUseTidy', onclick: function () { var v = B.tidy.offer; B.tidy = null; safe(function () { return save(function (x) { x.how = v; }); }); } }, ['Use this version']),
        el('button', { class: 'bx-link sm', id: 'rtKeepMine', onclick: function () { B.tidy = null; paint(); } }, ['Use my wording'])])]));
      return { body: body, primary: { text: 'Yes, that captures it', fn: function () { var v = t.innerText.trim(), w = sv ? sv.value.trim() : null; B.tidy = null; safe(function () { return save(function (x) { x.how = v; x.howOk = true; if (w != null) x.serves = w; x.at = 'shape'; seedShape(x); }); }); } } };
    },
    shape: function (r) {
      var seg = el('div', { class: 'rt-seg', role: 'group', 'aria-label': 'Its shape' }, [['steps', 'Steps'], ['parts', 'Parts'], ['both', 'Both']].map(function (o) { return el('button', { class: r.shape === o[0] ? 'on' : '', 'data-shape': o[0], 'aria-pressed': String(r.shape === o[0]), onclick: function () { safe(function () { return save(function (x) { x.shape = o[0]; seedShape(x); }); }); } }, [o[1]]); }));
      var body = [el('p', { class: 'rt-test', text: 'A sequence of steps, a set of parts, or both (parts, with steps running across them)?' }), seg];
      if (r.shape === 'steps' || r.shape === 'both') body.push(editList(r, 'steps', 'The main steps, in order', true));
      if (r.shape === 'parts' || r.shape === 'both') body.push(editList(r, 'parts', 'The main parts'));
      if (r.shape === 'both') body.push(el('p', { class: 'bx-faint', text: 'On the map, tap a cell to mark which part does the work at each step. Tap again for “inside on paper, unclear in practice: to test”.' }));
      body.push(chipsEdit(r));
      var tm = el('input', { type: 'text', class: 'rt-add', id: 'rtTime', placeholder: 'Normal running to recovery, as at …, or a date range', value: r.time || '' });
      tm.addEventListener('change', function () { var v = tm.value.trim(); safe(function () { return save(function (x) { x.time = v; }); }); });
      body.push(el('div', { class: 'rt-sub' }, [el('div', { class: 'bx-over' }, [el('span', { text: 'Time frame' })]), tm]));
      return { body: body, primary: { text: 'Agree the system', off: !r.shape, fn: agree }, hint: r.shape ? 'Next: what it is for, and what it runs on.' : 'Choose its shape first.' };
    }
  };
  function next(r, to) { return { text: 'Next', fn: function () { B.why = null; B.leave = null; safe(function () { return go(to); }); } }; }
  function composeHow(r) {
    var i = on(r, 'inputs'), w = on(r, 'work'), o = on(r, 'outputs'), s = [];
    if (i.length) s.push('It takes in ' + lc(joinlc(i)) + '.');
    if (w.length) s.push('Its main work: ' + lc(joinlc(w)) + '.');
    if (o.length) s.push('It produces ' + lc(joinlc(o)) + '.');
    return s.join(' ');
  }
  // suggest the steps from the work and the parts from the inside items
  function seedShape(x) {
    if ((x.shape === 'steps' || x.shape === 'both') && !(x.steps || []).length) x.steps = ((x.opts && x.opts.steps && x.opts.steps.length ? x.opts.steps : on(x, 'work')) || []).slice(0, 8).map(function (t) { return { n: t, who: '' }; });
    if ((x.shape === 'parts' || x.shape === 'both') && !(x.parts || []).length) x.parts = ((x.opts && x.opts.parts && x.opts.parts.length ? x.opts.parts : on(x, 'inside')) || []).slice(0, 6);
  }
  function editList(r, key, title, who) {
    var items = r[key] || [], host = el('div', { class: 'rt-sub', 'data-edit': key }, [el('div', { class: 'bx-over' }, [el('span', { text: title })])]);
    items.forEach(function (it, i) {
      var nm = el('input', { type: 'text', class: 'rt-add', 'data-k': key + i, value: who ? it.n : it, 'aria-label': title + ' ' + (i + 1) });
      nm.addEventListener('change', function () { var v = nm.value.trim(); safe(function () { return save(function (x) { if (who) x[key][i].n = v; else x[key][i] = v; }); }); });
      var kids = [el('span', { class: 'rt-num', text: String(i + 1) }), nm];
      if (who) { var wh = el('input', { type: 'text', class: 'rt-add who', 'data-w': i, value: it.who || '', placeholder: 'Who does it' }); wh.addEventListener('change', function () { var v = wh.value.trim(); safe(function () { return save(function (x) { x[key][i].who = v; }); }); }); kids.push(wh); }
      var sug = who && !it.who ? whoSuggest(r, i) : '';
      kids.push(el('button', { class: 'bx-link sm', title: 'Remove', 'aria-label': 'Remove', onclick: function () { safe(function () { return save(function (x) { x[key].splice(i, 1); }); }); } }, ['×']));
      host.appendChild(el('div', { class: 'rt-erow' }, kids));
      if (sug) host.appendChild(el('div', { class: 'rt-whosug' }, [el('span', { class: 'bx-faint', text: 'Suggested' + (whoFromMap(r, i) ? ' from the map' : '') + ': ' }), el('button', { class: 'bx-link sm', 'data-whosug': i, onclick: function () { safe(function () { return save(function (x) { x.steps[i].who = sug; }); }); } }, ['Use “' + sug + '”'])]));
    });
    if (who && aiOn() && items.some(function (x) { return !x.who; })) host.appendChild(el('button', { class: 'bx-link sm', id: 'rtWhoAi', onclick: function () { safe(async function () { var r2 = R(); var o = await ai('who', { steps: (r2.steps || []).map(function (x) { return x.n; }), parts: (r2.parts || []).concat(on(r2, 'inside')) }); B.whoAi = o.who || []; }); } }, ['Suggest who does each step']));
    host.appendChild(el('button', { class: 'bx-link sm', id: 'rtAdd' + key, onclick: function () { safe(function () { return save(function (x) { x[key] = (x[key] || []).concat([who ? { n: 'A new step', who: '' } : 'A new part']); }); }); } }, [who ? 'Add a step' : 'Add a part']));
    return host;
  }
  // who does a step: from the map's cells (the parts that do the work there), else a suggestion when suggestions are on
  function whoFromMap(r, i) {
    var c = r.cells || {}, d = [], t = [];
    (r.parts || []).forEach(function (p, pi) { if (c[pi + '|' + i] === 'do') d.push(p); else if (c[pi + '|' + i] === 'test') t.push(p); });
    return d.join(', ') + (t.length ? (d.length ? '; ' : '') + 'unclear in practice: ' + t.join(', ') : '');
  }
  function whoSuggest(r, i) { return whoFromMap(r, i) || (B.whoAi && B.whoAi[i]) || ''; }
  function chipsEdit(r) {
    var add = el('input', { type: 'text', class: 'rt-add', id: 'rtChange', placeholder: 'What is changing around it? Press Enter to add' });
    add.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = add.value.trim(); if (v) safe(function () { return save(function (x) { x.changing = (x.changing || []).concat([v]); }); }); } });
    return el('div', { class: 'rt-sub' }, [el('div', { class: 'bx-over' }, [el('span', { text: 'Changing around it' })]), el('div', { class: 'rt-chips' }, (r.changing || []).map(function (c, i) { return el('span', { class: 'rt-chip' }, [c, el('button', { class: 'rt-x', 'aria-label': 'Remove', onclick: function () { safe(function () { return save(function (x) { x.changing.splice(i, 1); }); }); } }, ['×'])]); })), add]);
  }
  function changeLevel(pick, why) {
    safe(async function () {
      var r0 = R();
      await save(function (x) {
        x.history = (x.history || []).concat([{ at: new Date().toISOString(), by: me(), name: x.name, within: on(x, 'within'), inside: on(x, 'inside'), outside: on(x, 'outside'), to: pick, why: why }]);
        x.name = pick; x.named = false; x.lists = {}; x.opts = null; x.regen = {}; x.leftout = []; x.standalone = false; x.steps = []; x.parts = []; x.cells = {}; x.shape = null; x.how = null; x.at = 'name';
      }, 'Changed the level: from ' + r0.name + ' to ' + pick + ' (' + why + ')');
      B.which = null;
      if (aiOn()) { var nm = await ai('name', { level: pick }); await save(function (x) { if (nm.name) { x.name = nm.name; x.suggested = nm.name; } }); }
    });
  }
  function agree() {
    safe(async function () {
      var r = R(), sum = '';
      if (aiOn()) { try { sum = (await ai('summary', { within: r.standalone ? 'It stands alone' : on(r, 'within').join('; '), how: r.how || composeHow(r) })).text || ''; } catch (e) { sum = ''; } }
      await save(function (x) { x.agreed = { at: new Date().toISOString(), by: me() }; x.summary = sum || plainSummary(x); x.at = 'shape'; }, 'Agreed the system: ' + r.name);
      B.redo = false;
    });
  }
  function plainSummary(r) {
    // two sentences, as the Define tool writes them: what it is, serving whom; what it sits within
    var i = on(r, 'inputs'), o = on(r, 'outputs'), w = r.standalone ? 'It stands alone.' : on(r, 'within').length ? 'It sits within ' + lc(join(on(r, 'within'))) + '.' : '';
    var what = [i.length ? 'takes in ' + lc(joinlc(i.slice(0, 3))) : '', o.length ? 'produces ' + lc(joinlc(o.slice(0, 3))) : ''].filter(Boolean).join(' and ');
    return (r.name || 'The system') + (what ? ' ' + what : ' is the system we are working on') + (r.serves ? ', serving ' + lc(r.serves) : '') + '.' + (w ? ' ' + w : '');
  }
  function doneScreen(r) {
    return { body: [el('p', { class: 'rt-sum', id: 'rtSummary', text: r.summary || plainSummary(r) }),
      el('p', { class: 'bx-faint', text: 'Agreed by ' + (r.agreed.by || 'the team') + ' on ' + day(r.agreed.at) + '. The map is on the right: tap a cell to change it, or drag a card in or out of the edge.' })],
      primary: { text: 'Next: what it is for', fn: function () { X.go('box=service'); } },
      links: [el('button', { class: 'bx-link sm', id: 'rtAgain', onclick: function () { B.redo = true; safe(function () { return save(function (x) { x.agreed = null; x.at = 'describe'; }, 'Went through the questions again'); }); } }, ['Go through the questions again']),
        el('button', { class: 'bx-link sm', id: 'rtAllFields', onclick: function () { X.go('fields=system'); } }, ['All the fields for this box'])] };
  }

  // ---------- the map ----------
  function mapEl(r, opt) {
    opt = opt || {};
    var mini = !!opt.mini, ins = on(r, 'inside'), outs = L(r, 'outside').filter(function (x) { return x.on; });
    var within = r.standalone ? 'It stands alone' : on(r, 'within').length ? 'Inside: ' + join(on(r, 'within')) : '';
    var m = el('div', { class: 'rt-map' + (mini ? ' mini' : ''), id: mini ? null : 'rtMap', 'aria-label': 'The system map' });
    if (!r.name && !ins.length && !mini) { m.appendChild(el('p', { class: 'bx-faint rt-empty', text: 'The map fills in as you answer.' })); return m; }
    if (!mini) { m.appendChild(el('div', { class: 'rt-mt', id: 'rtMapTitle', text: r.name || '' })); if (purposeFor()) m.appendChild(el('div', { class: 'rt-mfor', text: 'For: ' + lc(purposeFor()) })); }
    var outer = el('div', { class: 'rt-outer' }, [within ? el('span', { class: 'rt-olab', text: within }) : null]);
    var kv = el('div', { class: 'rt-kv' }, [el('div', { class: 'rt-ml', text: 'Decided elsewhere' })]);
    var dz = !mini && !!r.named && !S.readonly;
    var chips = el('div', { class: 'rt-kvc' }, outs.map(function (x) { return drag(el('span', { class: 'rt-card2', 'data-kv': x.t }, [el('b', { text: x.t }), el('span', { text: x.n || (x.m === 'influence' ? 'we can influence' : 'decided elsewhere') })]), dz, 'outside', x.t); }));
    kv.appendChild(chips);
    var wo = el('div', { class: 'rt-wo', id: mini ? null : 'rtWorking' }, [el('div', { class: 'rt-ml', text: 'Working on' })]);
    wo.appendChild(working(r, ins, Object.assign({ dz: dz }, opt)));
    if (dz && r.shape && ins.length) wo.appendChild(el('div', { class: 'rt-also' }, [el('span', { class: 'rt-ml', text: 'Inside the edge' })].concat(ins.map(function (t) { return drag(el('span', { class: 'rt-inchip', 'data-in': t, text: t }), true, 'inside', t); }))));
    if (dz) { zone(wo, 'inside'); zone(kv, 'outside', wo); }
    kv.appendChild(wo); outer.appendChild(kv); m.appendChild(outer);
    if (((r.leftout || []).length || dz) && !mini) {
      var lo = el('div', { class: 'rt-lo', id: 'rtLeftOut' }, [el('div', { class: 'rt-ml', text: 'Left out' })].concat((r.leftout || []).map(function (x) { return drag(el('span', { class: 'rt-lochip' + (x.why ? '' : ' ask'), role: x.why ? null : 'button', tabindex: x.why ? null : '0', onkeydown: function (e) { if (!x.why && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); B.ask = x.t; paint(); } }, 'data-lo': x.t, title: x.why || 'No reason given yet: tap to give one', text: x.t + (x.why ? ' · ' + x.why : ' · reason?'), onclick: function () { if (!x.why) { B.ask = x.t; paint(); } } }), dz, 'leftout', x.t); })));
      if (dz && !(r.leftout || []).length) lo.appendChild(el('span', { class: 'bx-faint rt-dropme', text: 'Drag a card here to leave it out' }));
      if (dz && B.ask) { var aw = el('input', { type: 'text', class: 'rt-add', id: 'rtAskWhy', placeholder: 'Why is “' + B.ask + '” left out?', 'data-autofocus': '' }); var go1 = function () { var v = aw.value.trim(); if (!v) return; var t0 = B.ask; B.ask = null; safe(function () { return save(function (x) { (x.leftout || []).forEach(function (y) { if (y.t === t0) y.why = v; }); }, 'Left out: ' + t0 + ' (' + v + ')'); }); }; aw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go1(); } }); lo.appendChild(el('div', { class: 'rt-askrow' }, [aw, el('button', { class: 'bx-link sm', id: 'rtAskGo', onclick: go1 }, ['Keep this reason'])])); }
      if (dz) zone(lo, 'leftout');
      m.appendChild(lo);
    }
    if (!mini && ((r.changing || []).length || r.time)) m.appendChild(el('div', { class: 'rt-chg' }, [el('span', { class: 'rt-ml', text: 'Changing around it' })].concat((r.changing || []).map(function (c) { return el('span', { class: 'rt-chip', text: c }); })).concat([r.time ? el('span', { class: 'rt-time', text: r.time }) : null])));
    return m;
  }
  function working(r, ins, opt) {
    var editable = opt.edit && !opt.mini && !S.readonly;
    if (r.shape === 'steps' && (r.steps || []).length) return el('div', { class: 'rt-steps' }, r.steps.map(function (s, i) { return el('div', { class: 'rt-step' }, [el('i', { text: String(i + 1) }), el('b', { text: s.n }), s.who ? el('span', { text: s.who }) : null]); }).concat(r.note ? [el('div', { class: 'rt-note', text: r.note })] : []));
    if (r.shape === 'parts' && (r.parts || []).length) return el('div', { class: 'rt-parts' }, r.parts.map(function (p) { return el('div', { class: 'rt-part', text: p }); }));
    if (r.shape === 'both' && (r.parts || []).length && (r.steps || []).length) {
      var cells = r.cells || {}, bands = r.bands || {}, cols = r.steps.length;
      var g = el('div', { class: 'rt-both', style: 'grid-template-columns:minmax(90px,1.2fr) repeat(' + cols + ',minmax(0,1fr))' }, [el('span')].concat(r.steps.map(function (s) { return el('b', { class: 'rt-col', text: s.n }); })));
      r.parts.forEach(function (p, pi) {
        g.appendChild(el('span', { class: 'rt-row', text: p }));
        if (bands[pi]) { g.appendChild(el('div', { class: 'rt-band', style: 'grid-column:span ' + cols, text: bands[pi] })); return; }
        r.steps.forEach(function (s, si) {
          var k = pi + '|' + si, v = cells[k] || '';
          g.appendChild(el(editable ? 'button' : 'span', { class: 'rt-cell ' + v, 'data-cell': k, title: v === 'do' ? 'Does the work at this step' : v === 'test' ? 'Inside on paper, unclear in practice: to test' : 'Not involved', 'aria-label': p + ', ' + s.n + ': ' + (v === 'do' ? 'does the work' : v === 'test' ? 'to test' : 'not involved'),
            onclick: editable ? function () { safe(function () { return save(function (x) { x.cells = x.cells || {}; var c = x.cells[k] || ''; x.cells[k] = c === '' ? 'do' : c === 'do' ? 'test' : ''; if (!x.cells[k]) delete x.cells[k]; }); }); } : null }));
        });
      });
      var wrap = el('div', {}, [g]);
      if (!opt.mini) wrap.appendChild(el('div', { class: 'rt-key' }, [el('span', {}, [el('i', { class: 'rt-cell do' }), 'Does the work at this step']), el('span', {}, [el('i', { class: 'rt-cell test' }), 'Inside on paper, unclear in practice: to test']), r.note ? el('span', { class: 'rt-kn', text: r.note }) : null]));
      return wrap;
    }
    return el('div', { class: 'rt-parts' }, ins.length ? ins.map(function (t) { return drag(el('div', { class: 'rt-part light', 'data-in': t, text: t }), opt.dz, 'inside', t); }) : [el('span', { class: 'bx-faint', text: 'What it owns or controls goes here.' })]);
  }
  // dragging: a card can be dragged into the edge (working on), to kept in view, or to left out (which asks why)
  function drag(e, on1, from, t) {
    if (!on1) return e;
    e.setAttribute('draggable', 'true'); e.classList.add('rt-drag');
    e.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', JSON.stringify({ from: from, t: t })); ev.dataTransfer.effectAllowed = 'move'; ev.stopPropagation(); });
    return e;
  }
  function zone(e, to, inner) {
    e.setAttribute('data-zone', to);
    e.addEventListener('dragover', function (ev) { if (inner && inner.contains(ev.target)) return; ev.preventDefault(); e.classList.add('rt-over'); });
    e.addEventListener('dragleave', function (ev) { if (!e.contains(ev.relatedTarget)) e.classList.remove('rt-over'); });
    e.addEventListener('drop', function (ev) {
      if (inner && inner.contains(ev.target)) return;
      ev.preventDefault(); ev.stopPropagation(); e.classList.remove('rt-over');
      var d; try { d = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (x) { return; }
      if (!d || d.from === to) return;
      move(d.from, d.t, to);
    });
  }
  function move(from, t, to) {
    if (to === 'leftout') B.ask = t;
    safe(function () {
      return save(function (x) {
        x.lists = x.lists || {}; var lo = x.leftout = x.leftout || [], was = null;
        if (from === 'leftout') { lo.forEach(function (y) { if (y.t === t) was = y; }); x.leftout = lo.filter(function (y) { return y.t !== t; }); }
        else { (x.lists[from] || []).forEach(function (y) { if (y.t === t) was = y; }); x.lists[from] = (x.lists[from] || []).filter(function (y) { return y.t !== t; }); }
        if (to === 'leftout') { x.leftout.push({ t: t, why: '', from: from }); return; }
        var list = x.lists[to] = x.lists[to] || [], hit = list.filter(function (y) { return y.t === t; })[0];
        if (hit) hit.on = true; else list.push(to === 'outside' ? { t: t, on: true, m: (was && was.m) || 'elsewhere' } : { t: t, on: true });
      }, 'Moved “' + t + '” to ' + (to === 'leftout' ? 'left out' : to === 'outside' ? 'decided elsewhere' : 'working on'));
    });
  }
  // the card on the canvas (B11): two sentences and a small picture of the map
  function card(y) {
    var r = y && y.route; if (!r || !r.agreed) return null;
    return el('div', { class: 'rt-cardsum' }, [el('p', { class: 'rt-cs', text: r.summary || plainSummary(r) }), el('div', { class: 'rt-minihost' }, [mapEl(r, { mini: true })])]);
  }
  function agreed() { var y = answers().system; return !!(y && y.route && y.route.agreed); }
  function leave() { HOST = null; B = { msg: null, err: null, busy: false }; }

  function css() {
    if (document.getElementById('rtCss')) return;
    var s = document.createElement('style'); s.id = 'rtCss';
    s.textContent = [
      '.rt-prog{text-align:center;color:var(--t2);font-size:14px}',
      '.rt-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:48px;padding:24px 48px 0;max-width:1500px;margin:0 auto}.rt-grid.wide{grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr)}',
      '@media (max-width:1000px){.rt-grid,.rt-grid.wide{grid-template-columns:1fr;padding:16px}}',
      '.rt-q{font-family:Newsreader,Georgia,serif;font-weight:400;font-size:34px;line-height:1.2;margin:8px 0 14px;color:#141414}',
      '.rt-test{font-size:16px;line-height:1.5;color:#2A2A28;margin:0 0 10px}.rt-help{margin:0 0 18px}',
      '.rt-big{width:100%;box-sizing:border-box;font-family:Newsreader,Georgia,serif;font-size:22px;line-height:1.4;border:0;border-bottom:1px solid #D5D3CE;background:transparent;padding:8px 0;resize:vertical;outline:none;color:#141414}.rt-big:focus{border-bottom-color:#141414}',
      '.rt-opts{display:flex;flex-direction:column;gap:12px;margin-top:22px}.rt-chk{display:flex;gap:10px;align-items:flex-start;font-size:15px;cursor:pointer}',
      '.rt-add{font:inherit;font-size:15px;padding:8px 10px;border:1px solid #D5D3CE;border-radius:8px;background:#fff;min-width:0;flex:1;box-sizing:border-box}.rt-add.who{flex:.7}',
      '.rt-name{font-family:Newsreader,Georgia,serif;font-size:36px;line-height:1.2;padding:6px 8px;margin:0 -8px 12px;border-radius:8px;outline:none}.rt-name:hover{background:rgba(0,0,0,.03)}.rt-name:focus{background:#fff;box-shadow:0 0 0 2px #D5D3CE}.rt-name:empty::before{content:attr(data-ph);color:var(--fa)}',
      '.rt-list{display:flex;flex-direction:column;gap:2px}.rt-opt{display:flex;align-items:center;gap:14px;justify-content:space-between;padding:11px 14px;border-radius:12px;background:transparent;border:0}.rt-opt:hover{background:#F1EFEA}.rt-note2{margin-left:auto;font-size:12.5px;color:#8A8F97}.rt-opt.on{}.rt-opt label{display:flex;gap:14px;align-items:center;font-size:15.5px;line-height:1.4;cursor:pointer;flex:1}'+'.rt input[type=checkbox],.gd input[type=checkbox]{-webkit-appearance:none;appearance:none;flex:none;width:22px;height:22px;margin:0;border-radius:7px;background:#E9E6DF;border:0;cursor:pointer;display:inline-grid;place-content:center}.rt input[type=checkbox]:checked,.gd input[type=checkbox]:checked{background:#15171A}.rt input[type=checkbox]:checked::after,.gd input[type=checkbox]:checked::after{content:"";width:10px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translate(1px,-1px)}.rt input[type=checkbox]:focus-visible,.gd input[type=checkbox]:focus-visible{outline:2px solid #15171A;outline-offset:2px}.rt input[type=radio],.gd input[type=radio]{accent-color:#15171A}',
      '.rt-addrow{display:flex;gap:14px;align-items:center;margin:2px 0 6px;padding:6px 14px}.rt-addrow::before{content:"";flex:none;width:20px;height:20px;border-radius:7px;border:1.5px dashed #8A8F97}.rt-addrow .rt-add{border:0;background:transparent;padding:6px 0;font-size:15.5px}.rt-addrow .rt-add:focus{outline:none;border-bottom:1px solid #15171A}.rt-mk{display:flex;gap:10px;align-items:center;flex-shrink:0}.rt-mark{font:inherit;font-size:12px;border:0;background:#F1EFEA;border-radius:999px;padding:3px 10px;cursor:pointer;color:#55534E}',
      '.rt-card{margin-top:10px}.rt-why{width:100%;box-sizing:border-box;font:inherit;font-size:15px;border:1px solid #D5D3CE;border-radius:8px;padding:8px}',
      '.rt-pick{display:block;text-align:left;font:inherit;font-size:15px;padding:10px 12px;border:1px solid #ECEAE6;border-radius:8px;background:#fff;cursor:pointer}.rt-pick.on{border-color:#141414}',
      '.rt-panels{display:grid;grid-template-columns:1fr;gap:12px}.rt-panel{border:0;background:#F1EFEA;border-radius:14px;padding:16px 18px;cursor:pointer}.rt-panel:hover{background:#E9E6DF}.rt-panel.carry{cursor:default;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.07)}.rt-panel.open{background:#fff;box-shadow:0 0 0 2px #15171A}.rt-panel ul{margin:6px 0 0 18px;padding:0;font-size:14px;color:#55534E}.rt-pname{font-family:Newsreader,Georgia,serif;font-size:20px;margin:4px 0}.rt-which{margin-top:10px;display:flex;flex-direction:column;gap:6px}',
      '.rt-hist{margin-top:20px}',
      '.rt-how{font-family:Newsreader,Georgia,serif;font-size:21px;line-height:1.5;padding:8px 10px;margin:0 -10px;border-radius:8px;outline:none}.rt-how:focus{background:#fff;box-shadow:0 0 0 2px #D5D3CE}.rt-offer{font-family:Newsreader,Georgia,serif;font-size:18px;line-height:1.5}',
      '.rt-seg{display:inline-flex;background:#ECEAE6;border-radius:999px;padding:3px;margin:4px 0 16px}.rt-seg button{font:inherit;font-size:14px;border:0;background:transparent;padding:7px 16px;border-radius:999px;cursor:pointer;color:#55534E}.rt-seg button.on{background:#fff;color:#141414;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}',
      '.rt-sub{margin-top:22px}.rt-sub .bx-over{margin-bottom:8px}.rt-erow{display:flex;gap:8px;align-items:center;margin-bottom:6px}.rt-num{width:20px;color:var(--mu);font-size:13px}',
      '.rt-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.rt-chip{display:inline-flex;gap:6px;align-items:center;font-size:13px;background:#fff;border:1px solid #ECEAE6;border-radius:999px;padding:4px 10px}.rt-x{border:0;background:none;cursor:pointer;color:#8A877F;font-size:14px;padding:0}',
      '.rt-sum{font-family:Newsreader,Georgia,serif;font-size:24px;line-height:1.45;margin:8px 0 14px}',
      // the map
      '.rt-map{position:relative}.rt-empty{padding:60px 0;text-align:center}.rt-mt{font-family:Newsreader,Georgia,serif;font-size:26px;line-height:1.2;margin-bottom:4px}.rt-mfor{color:#55534E;font-size:14px;margin-bottom:10px}',
      '.rt-outer{position:relative;border:1px dashed #C9C6BF;border-radius:22px;padding:24px 18px 18px;margin-top:14px}.rt-olab{position:absolute;top:-9px;left:22px;background:#FAF9F7;padding:0 8px;font-size:12px;color:#8A877F}',
      '.rt-kv{background:#EDECE8;border-radius:18px;padding:14px}.rt-ml{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.4px;color:#55534E;margin-bottom:8px}.rt-kvc{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}',
      '.rt-card2{display:flex;flex-direction:column;background:#fff;border-radius:8px;padding:6px 10px;box-shadow:0 1px 2px rgba(0,0,0,.06);font-size:13px}.rt-card2 span{font-size:11px;color:#8A877F}',
      '.rt-wo{background:#fff;border:1.5px dashed #141414;border-radius:16px;padding:14px}',
      '.rt-steps{display:flex;gap:8px;flex-wrap:wrap;align-items:stretch}.rt-step{background:#16171A;color:#fff;border-radius:8px;padding:8px 10px;min-width:84px;flex:1;display:flex;flex-direction:column;gap:2px}.rt-step i{font-style:normal;font-size:11px;color:#9a9a9a}.rt-step b{font-size:14px}.rt-step span{font-size:11px;color:#bbb}.rt-note{width:100%;font-size:12px;color:#55534E;margin-top:6px}',
      '.rt-parts{display:flex;flex-wrap:wrap;gap:8px}.rt-part{background:#16171A;color:#fff;border-radius:8px;padding:10px 12px;font-size:14px}.rt-part.light{background:#F4F3F0;color:#141414}',
      '.rt-both{display:grid;gap:5px;align-items:stretch}.rt-col{font-size:12px;line-height:1.25;border-bottom:1.5px solid #141414;padding-bottom:4px;align-self:end}.rt-row{font-size:12px;font-weight:600;line-height:1.25;align-self:center}',
      '.rt-cell{display:block;min-height:30px;border-radius:6px;background:#EFEDE9;border:1.5px solid transparent;cursor:default;padding:0}button.rt-cell{cursor:pointer}.rt-cell.do{background:#16171A}.rt-cell.test{background:#fff;border:1.5px dashed #15171A}',
      '.rt-band{background:#5D636C;color:#fff;border-radius:6px;font-size:12px;padding:8px 10px}',
      '.rt-key{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#55534E;align-items:center}.rt-key span{display:inline-flex;gap:6px;align-items:center}.rt-key i.rt-cell{display:inline-block;width:12px;min-height:12px;height:12px}.rt-kn{margin-left:auto}',
      '.rt-lo{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}.rt-lo .rt-ml{margin:0 8px 0 0}.rt-lochip{font-size:12px;border:1px dashed #C9C6BF;border-radius:8px;padding:4px 8px;color:#55534E}.rt-lochip.ask{border-color:#15171A;color:#15171A}',
      '.rt-drag{cursor:grab}.rt-over{outline:2px dashed #15171A;outline-offset:3px}.rt-also{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:12px}.rt-also .rt-ml{margin:0 6px 0 0}.rt-inchip{font-size:12px;background:#F4F3F0;border-radius:6px;padding:4px 8px}.rt-lochip.ask{cursor:pointer}.rt-dropme{font-size:12px}.rt-askrow{display:flex;gap:8px;width:100%;margin-top:6px}.rt-whosug{margin:-2px 0 8px 28px;font-size:13px}',
      '.rt-chg{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}.rt-chg .rt-ml{margin:0 8px 0 0}.rt-time{margin-left:auto;font-size:13px;color:#55534E}',
      // the small map on the canvas card
      '.rt-cardsum{margin-top:6px}.rt-cs{font-size:13px;line-height:1.45;margin:0 0 8px}.rt-minihost{height:150px;overflow:hidden;position:relative;border-radius:8px}.rt-map.mini{transform:scale(.5);transform-origin:top left;width:200%;pointer-events:none}',
      '@media print{.rt-minihost{height:auto}.rt-map.mini{transform:none;width:auto}}'].join('');
    document.head.appendChild(s);
  }
  function init(x) { X = x; el = x.el; S = x.S; css(); }
  // The guided flow (guided.js) hosts these same screens: one route, two ways in. It takes over painting,
  // and is told when a screen moves the route on, so it can go to its own next screen.
  function hostIn(hooks) { GH = hooks; if (hooks) css(); }
  function screen(id) {
    var r = R(), sc = SCREENS[idx(id)], s = SCREEN[id](r, sc);
    return { id: id, q: qOf(sc, r), test: sc.test || '', help: sc.help || '', why: sc.why || '', body: s.body || [], primary: s.primary || null, hint: s.hint || '', links: s.links || [] };
  }
  window.VTRoute = { init: init, render: render, leave: leave, card: card, agreed: agreed, map: mapEl, fieldsFrom: fieldsFrom, CAPK: CAPK,
    hostIn: hostIn, screen: screen, R: function () { return R(); }, on: on, L: L, save: save, composeHow: composeHow, plainSummary: plainSummary, svc: function () { return svc(R()); },
    state: function () { return B; }, needClarify: needClarify, ai: ai };
})();
