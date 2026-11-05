// The Problem practice in the Viability Thinking Lab.
// Views: the tiles (#tiles), one tile (#tile=key), the problem sheet (#sheet),
// the frame page (#frame) and differing views (#views).
(function () {
  'use strict';
  var D = window.PROBLEM, TILES = D.tiles, GROUPS = D.groups;
  // Problem shows the five parts of framing; the sixth (running the project) lives under Project.
  var PG = GROUPS.filter(function (g) { return g.id !== 'e'; });
  var main = document.getElementById('main'), who = document.getElementById('who');
  var saveBar = document.getElementById('save'), saveMsg = document.getElementById('saveMsg'), saveBtn = document.getElementById('saveBtn');
  var veil = document.getElementById('veil'), pop = document.getElementById('pop');
  var S = { view: 'canvas', key: null, arr: 'group', data: null, draft: null, dirty: false, base: null, busy: false };
  var creds = null; try { creds = JSON.parse(sessionStorage.getItem('vt_fac') || 'null'); } catch (e) {}

  var WORDS = { none: 'Not started', partly: 'Partly done', done: 'Done', skip: 'Not used', reopened: 'Reopened by a later practice' };
  var WHO = { sponsor: ['The sponsor', 'Worked with the person who asked the question'], core: ['The core team', 'Worked by the team running the engagement'], room: ['The whole room', 'Each person writes alone, then the answers are revealed'], dependants: ['The people it is for', 'Drawn by those who depend on the service, first'] };
  var QSTATE = { open: 'Open', answered: 'Answered', new_version: 'Turned into a new version', kept_open: 'Kept open' };
  var SEEDS = {
    question: [['q', 'The question, or the decision']], decision: [['q', 'The question, or the decision']],
    problem: [['q', 'The question, or the decision'], ['now', 'Where things stand now'], ['hold', 'Restraining forces']],
    guesses: [['hold', 'Restraining forces'], ['drive', 'Driving forces'], ['bright', 'Bright spot']],
    jobs: [['jg', 'Jobs to gain, increase, improve'], ['jp', 'Jobs to protect, prevent, maintain']],
    who: [['val', 'Stakeholders: the value side'], ['exp', 'Stakeholders: the exposure side'], ['absent', 'Affected but absent']],
    give: [['val', 'Stakeholders: the value side'], ['pos', 'What working looks like']],
    threshold: [['exp', 'Stakeholders: the exposure side'], ['neg', 'What must not happen']]
  };
  var SHEET_EMPTY = { q: '', val: [], exp: [], absent: '', jg: [], jp: [], now: '', drive: [], hold: [], bright: '', pos: [], neg: [] };

  // ---------- helpers ----------
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o == null ? null : o)); };
  function el(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 600) + 'px'; }
  function ta(v, on, ph, rows) {
    var t = el('textarea', { rows: rows || 2, placeholder: ph || '', value: v || '' });
    t.addEventListener('input', function () { on(t.value); grow(t); dirty(); });
    setTimeout(function () { grow(t); }, 0);
    return t;
  }
  function inp(v, on, ph) { var i = el('input', { type: 'text', value: v || '', placeholder: ph || '' }); i.addEventListener('input', function () { on(i.value); dirty(); }); return i; }
  function chip(st) { return el('span', { class: 'st ' + st, text: WORDS[st] || WORDS.none }); }
  var when = function (d) { return d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; };
  var tileDef = function (k) { return TILES.filter(function (t) { return t.id === k; })[0]; };
  var groupDef = function (g) { return GROUPS.filter(function (x) { return x.id === g; })[0]; };
  var row = function (k) { return (S.data.tiles || []).filter(function (t) { return t.tile_key === k; })[0] || null; };
  var stateOf = function (k) { var t = tileDef(k); if (t && t.fields) return fieldState(t); if (t && t.inv) return invState(); var r = row(k); return r ? r.status : 'none'; };
  // Toolkit tiles show only once chosen for this engagement.
  var chosenTools = function () {
    var r = row('toolkit'), legacy = (r && r.content && r.content.chosen) || {};
    if (!window.VTScope || !window.VTScope.active()) return legacy;
    var out = {}; (D.toolkit || []).forEach(function (x) { if (window.VTScope.on('tk.' + x.id)) out[x.id] = { why: window.VTScope.why(x.id) || (legacy[x.id] && legacy[x.id].why) || '' }; });
    return out;
  };
  var tileOn = function (t) { return !t.toolkit || !!chosenTools()[t.toolkit]; };
  var VIS = function () { return TILES.filter(tileOn); };
  var PVIS = function () { return VIS().filter(function (t) { return t.g !== 'e'; }); };
  var props = function (tile, field, st) { return (S.data.proposals || []).filter(function (p) { return (!tile || p.tile_key === tile) && (!field || p.field === field) && (!st || p.status === st); }); };
  var srcById = function (id) { return (S.data.sources || []).filter(function (x) { return x.id === id; })[0]; };
  function fieldState(t) {
    var core = t.fields.filter(function (f) { return f.core; }), acc = props(t.id, null, 'accepted');
    if (!acc.length) return 'none';
    return core.every(function (f) { return acc.some(function (p) { return p.field === f.id; }); }) ? 'done' : 'partly';
  }
  var openQs = function (k) { return (S.data.questions || []).filter(function (q) { return (!k || q.tile_key === k) && (q.status === 'open' || q.status === 'kept_open'); }); };
  var notUsed = function (r) { return 'Not used: ' + String((r && (r.skip_reason || r.summary)) || '').replace(/^Not used:\s*/i, ''); };
  var coreText = function (t) { return t.core === true ? 'Core tile' : t.core ? 'Core tile (' + t.core + ')' : ''; };
  function dirty() { if (!S.dirty) { S.dirty = true; saveMsg.className = 'msg dirty'; saveMsg.textContent = 'Unsaved changes'; } }
  function clean(text) { S.dirty = false; saveMsg.className = 'msg good'; saveMsg.textContent = text || ''; }

  // an example opened read-only (?example=key): nothing is written, the engagement's own work is never touched
  var EXAMPLE = (function () { try { return new URLSearchParams(location.search).get('example'); } catch (e) { return null; } })();
  var READS = ['p_load', 'p_example_view', 'p_history', 'p_version', 'ex_index', 'p_current'];
  async function api(body) {
    if (EXAMPLE && READS.indexOf(body.action) < 0) { var ro = new Error('This is an example, so it is read-only. Your own work is not changed.'); ro.status = 409; throw ro; }
    if (EXAMPLE && body.action === 'p_load') body = { action: 'p_example_view', case: EXAMPLE };
    // a worked example opens with no code at all (27 October 2026)
    var headers = { 'Content-Type': 'application/json' }, b = creds && creds.session_code ? { session_code: creds.session_code } : {};
    var signed = !!(creds && creds.session_code && (creds.master || creds.member));   // signed in by email (or the master): a token, not a code
    if (!creds || !creds.session_code) {} else if (signed) { var hh = window.VTAuth ? await window.VTAuth.header() : null; if (hh) headers.Authorization = hh; }
    else b.fac_code = creds.fac_code;
    if (!b.session_code && !(EXAMPLE && (body.action === 'p_example_view' || body.action === 'ex_index'))) { var no = new Error('You are not signed in to a project.'); no.status = 401; throw no; }
    for (var k in body) b[k] = body[k];
    // Run is for watching and trying: nothing is written to the project from it (5 November 2026)
    if (window.VTUse && window.VTUse.isRun && window.VTUse.isRun() && READS.concat(['p_changes', 'p_uselog', 'p_run_answer', 'p_run_record']).indexOf(b.action) < 0) { var rn = new Error('Run is for watching and trying things out, so nothing is saved here. Switch to Confirm or Build to change the project.'); rn.status = 409; throw rn; }
    if (b.action === 'p_save' && window.VTUse && window.VTUse.isUse()) { b.via = 'use'; b.use_step = window.VTUse.stepNow(); b.use_view = window.VTUse.viewNow(); }
    var r = await fetch('/api/problem', { method: 'POST', headers: headers, body: JSON.stringify(b) });
    if (r.status === 401 && signed && window.VTAuth && await window.VTAuth.refreshNow()) { headers.Authorization = await window.VTAuth.header(); r = await fetch('/api/problem', { method: 'POST', headers: headers, body: JSON.stringify(b) }); }
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || 'Something went wrong'); e.status = r.status; throw e; }
    return d;
  }
  function out(msg) {
    document.documentElement.classList.remove('gd-boot');
    main.innerHTML = '<div class="center"><p>' + esc(msg) + '</p><p><a href="/hub">Go to Home, to open a project</a></p></div>';
    who.innerHTML = ''; saveBar.hidden = true;
  }

  // ---------- loading and routing ----------
  async function load() {
    if ((!creds || !creds.session_code) && !EXAMPLE) return out('You are not signed in to a project.');
    try { S.data = await api({ action: 'p_load' }); }
    catch (e) { return out(e.status === 401 || e.status === 403 ? 'That session or facilitator code is no longer recognised.' : e.message); }
    var s = S.data.session;
    S.readonly = !!EXAMPLE;
    // a brand-new project opens on its project home too (30 October 2026); the Frame button there starts the guided framing
    // what was last open on this device, for Home's "Last open" bar: its name and when it changed, never its codes
    try {
      var lfr = (S.data.tiles || []).filter(function (t) { return t.tile_key === 'frame'; })[0], lfc = (lfr && lfr.content) || {};
      var lat = (S.data.tiles || []).reduce(function (m, t) { return t.updated_at && (!m || t.updated_at > m) ? t.updated_at : m; }, null);
      if (EXAMPLE) localStorage.setItem('vt_last', JSON.stringify({ name: (S.data.example && S.data.example.name) || s.name || 'An example', kind: 'example', href: '/frame?example=' + encodeURIComponent(EXAMPLE) }));
      else if (lfc.caseKey) localStorage.setItem('vt_last', JSON.stringify({ name: String(lfc.caseLabel || '').split(/:|, as at| \(as at/)[0].trim() || s.name || 'An example', kind: 'example', at: lat }));
      else localStorage.setItem('vt_last', JSON.stringify({ name: s.name || 'Your project', at: lat }));
    } catch (e) {}
    if (EXAMPLE) exampleBand();
    if (S.data.as === 'public') who.innerHTML = '<a class="link" href="/hub">Home</a>';
    else {
      var me = creds && creds.member && window.VTAuth ? (window.VTAuth.user() || {}) : {};
      who.innerHTML = '<span class="chip" title="Participants join with this code">' + esc(s.session_code) + '</span><span>' + (S.data.as === 'master' ? 'Master' : esc(me.name || me.email || 'Facilitator')) + '</span><button class="link" id="signout">Sign out</button>';
      document.getElementById('signout').onclick = function () { try { sessionStorage.removeItem('vt_fac'); localStorage.removeItem('vt_last'); } catch (e) {} if (creds && creds.member && window.VTAuth) window.VTAuth.clear(); location.href = S.data.as === 'master' ? '/admin' : '/hub'; };
    }
    // the shared header: which page this is, and the depth, kept in step with this page's data
    if (window.VTScope) { var tkr = row('toolkit'); window.VTScope.setLegacy(tkr && tkr.content && tkr.content.chosen); window.VTScope.set(row('scope')); buildSubtabs(); }
    if (window.VTNav) window.VTNav.init({ active: ON_HOME ? 'hub' : ON_ANALYSE ? 'diagnose' : ON_PROJECT ? 'project' : STEP === 'test' ? 'test' : ON_EVALUATE ? 'model' : 'frame', depthRow: row('depth'), example: EXAMPLE, readonly: !!EXAMPLE, onDepth: function (t) { S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'depth'; }); S.data.tiles.push(t); render(); } });
    if (window.VTUse) window.VTUse.init(VTX);
    route();
  }
  function exampleBand() {
    if (document.getElementById('exBand')) return;
    var ex = S.data.example || {}, b = el('div', { class: 'exband', id: 'exBand', role: 'status' }, [
      el('span', {}, [el('b', { text: 'You are looking at an example: ' + (ex.name || '') + '.' }), document.createTextNode(' Read-only: nothing here changes your own engagement.')]),
      el('span', { class: 'row' }, [el('a', { href: '/examples', text: 'All examples' }), el('a', { href: '/hub', class: 'exback', text: creds && creds.session_code ? '‹ Back to your own work' : '‹ Back to Home' })])]);
    document.body.insertBefore(b, document.body.firstChild);
    document.body.classList.add('ex-on');
  }
  // a new engagement opens on the guided framing; once the team has worked on the canvas, or the framing has been sent, on the canvas
  function teamStarted() { var f = row('frame'), a = (f && f.content && f.content.answers) || {}, g = (f && f.content && f.content.guide) || {}; if (g.at) return false; return Object.keys(a).some(function (k) { var x = a[k]; return x && x.fields && Object.keys(x.fields).some(function (z) { return String(x.fields[z] || '').trim(); }); }); }
  // The model has its own address (/model) and its own top bar; it uses the same session data.
  if (location.pathname === '/report') location.replace('/project#reports');
  // The four steps (29 October 2026): Frame (/frame), Diagnose (/diagnose), Model (/model), Test (/test).
  // Internally Diagnose is still "analyse" and Model and Test share the old Evaluate engine, so saved data keeps its ids.
  // The old addresses (/problem, /analyse, /evaluate) are moved to the new ones by a script at the top of problem.html.
  var STEP = location.pathname === '/test' ? 'test' : location.pathname === '/model' ? 'model' : null;
  var ON_HOME = location.pathname === '/home';
  var ON_MODEL = false, ON_ANALYSE = location.pathname === '/diagnose' || location.pathname === '/analyse', ON_PROJECT = location.pathname === '/project', ON_EVALUATE = !!STEP || location.pathname === '/evaluate';
  if (ON_HOME) document.title = (S.data && S.data.session ? '' : '') + 'Project home · Viability Thinking Lab';
  else if (ON_MODEL || ON_ANALYSE || ON_PROJECT || ON_EVALUATE) document.title = (ON_MODEL ? 'The model' : ON_PROJECT ? 'Project' : STEP === 'test' ? 'Test' : ON_EVALUATE ? 'Model' : 'Diagnose') + ' · Viability Thinking Lab';
  // The page's own tabs, under the shared header
  var sub = document.getElementById('subtabs');
  // what this engagement uses (Project › What's included); everything is on when nothing is saved
  var inScope = function (id) { return !window.VTScope || window.VTScope.on(id); };
  var PSUB = [['poster', 'The canvas', 'p.canvas'], ['board', 'Workshop board', 'p.board'], ['tiles', 'All tools', 'p.tools'], ['views', 'Differing views', 'p.views']];
  // the tab rows, numbered from the task tree (3 November 2026)
  var PARTN = { frame: [['question', '1.1', 'The question'], ['system', '1.2', 'The system'], ['line', '1.3', 'Thresholds']],
    diagnose: [['dgather', '2.1', 'The evidence'], ['dvuln', '2.2', 'What goes right, and what makes it vulnerable'], ['dtrig', '2.3', 'What triggers failure, and what keeps it going'], ['dexpl', '2.4', 'Other explanations'], ['dform', '2.5', 'The formulation']],
    model: [['mmaps', '3.1', 'Maps of the service'], ['mpeople', '3.2', 'Maps of people, time and failure'], ['mrun', '3.3', 'Models that run'], ['mworks', '3.4', 'How it works'], ['mfails', '3.5', 'How it fails'], ['mdesign', '3.6', 'Design propositions']],
    test: [['talpha', '4.1', 'Testing the model (alpha)'], ['tplans', '4.2', 'Disruption and plans'], ['tbeta', '4.3', 'Trial in the organisation (beta)'], ['tout', '4.4', 'Outcomes']] };
  function tabRow(step, attr, home, homeName, canvas, canvasName) {
    var b = function (v, t) { return '<button role="tab" data-v="' + v + '" ' + attr + '="' + v + '" aria-selected="false">' + t + '</button>'; };
    return b(home, '‹ ' + homeName) + PARTN[step].map(function (p) { return b(p[0], p[1] + ' ' + p[2]); }).join('') + b(canvas, canvasName);
  }
  function buildSubtabs() {
    if (!sub) return;
    sub.innerHTML = ON_MODEL || ON_HOME ? '' : ON_EVALUATE ? (STEP === 'test' ? tabRow('test', 'data-tp', 'thome', '4 Test', 'tcanvas', 'Test Canvas') : tabRow('model', 'data-mp', 'mhome', '3 Model', 'mcanvas', 'Model Canvas')) : ON_PROJECT ? '<button role="tab" data-v="where" aria-selected="true">Where we are</button><button role="tab" data-v="scope" aria-selected="false">Used, shown and reported</button><button role="tab" data-v="reports" aria-selected="false">Reports</button>' : ON_ANALYSE ? tabRow('diagnose', 'data-dp', 'dhome', '2 Diagnose', 'dcanvas', 'Diagnose Canvas') :
      tabRow('frame', 'data-fp', 'fhome', '1 Frame', 'fcanvas', 'Frame Canvas');
    Array.prototype.forEach.call(sub.querySelectorAll('button'), function (b) { b.addEventListener('click', function () { go(b.dataset.v); }); });
  }
  buildSubtabs();
  function toModel() { if (ON_EVALUATE && STEP !== 'test') go('mworks'); else location.href = '/model' + (EXAMPLE ? location.search : '') + '#mworks'; }
  function route() {
    var h = location.hash.replace(/^#/, ''); S.plain = false;
    // Use or Build (5 November 2026): in Use, every page of a project is drawn by use.js
    if (window.VTUse && window.VTUse.isUse() ) { S.view = 'use'; S.key = h; S.dirty = false; saveMsg.textContent = ''; document.body.classList.add('use-mode'); render(); window.scrollTo(0, 0); return; }
    document.body.classList.remove('use-mode'); document.body.classList.remove('run-mode'); document.body.classList.remove('views-home'); if (window.VTRun) window.VTRun.stop();
    if (ON_HOME) { S.view = 'phome'; S.key = null; S.dirty = false; saveMsg.textContent = ''; render(); window.scrollTo(0, 0); return; }
    if (parseHash(h) === false) return;
    after();
  }
  // what a hash means on this page, without drawing it (so Use can draw any view inside its own panel)
  function parseHash(h) {
    var m = /^tile=([a-z]+)$/.exec(h), g = /^summary=([a-z])$/.exec(h);
    if (m && tileDef(m[1])) { S.view = 'tile'; S.key = m[1]; }
    else if (g && groupDef(g[1])) { S.view = g[1] === 'r' ? 'rsummary' : 'summary'; S.key = g[1]; }
    else if (/^part=r$/.test(h)) { S.view = 'analysis'; S.key = 'r'; S.part = 'r'; }
    else if (!ON_ANALYSE && /^sources=[a-z]$/.test(h)) { location.replace('/diagnose#' + h); return false; }
    else if (/^(sources|analysis|tools)=[a-z]$/.test(h) && groupDef(h.slice(-1))) { S.view = h.split('=')[0]; S.key = h.slice(-1); S.part = S.key; }
    else if (/^source=[0-9a-f-]{36}$/.test(h)) { S.view = 'source'; S.key = h.slice(7); }
    else if (h === 'review' || h === 'toolkit' || h === 'guide=r') { S.view = h === 'guide=r' ? 'guide' : h; S.key = null; }
    else if (h === 'sheet' || h === 'views' || h === 'tiles') { S.view = h; S.key = null; }
    else if (h === 'model' || (!h && ON_MODEL)) { S.view = 'model'; S.key = null; }
    else if (ON_ANALYSE && (!h || /^(dhome|dgather|dwork|dvuln|dtrig|dexpl|dform|dcanvas)$/.test(h))) { S.view = h === 'dwork' ? 'dvuln' : h || 'dhome'; S.key = null; }
    else if (ON_ANALYSE && (h === 'tools' || h === 'formulation')) { S.view = h === 'tools' ? 'dvuln' : 'dform'; S.key = null; }
    else if (ON_ANALYSE && h === 'present=d') { S.view = 'present'; S.key = 'd'; }
    else if (h === 'analyse') { S.view = 'analyse'; S.key = null; }
    else if (ON_ANALYSE && /^(request|sources|levels|capitals|models|disagree|dependants|outside|frame|outcomes|tools|rca|horizon|goright|nots|techmech|formulation|rivals|people|futures|combos)$/.test(h)) { S.view = h; S.key = null; }
    else if (ON_ANALYSE && /^(bia|risk|scentest|abm|tharm|cmap)$/.test(h)) { location.replace('/model' + location.search + '#' + h); return false; }
    else if (ON_ANALYSE && /^(plans|exlog|selfassess|forcefield|pace|evidence|mvc|bcp|dr|steer)$/.test(h)) { location.replace('/test' + location.search + '#' + h); return false; }
    else if (ON_ANALYSE && /^sources=[a-z]$/.test(h)) { S.view = 'sources'; S.key = h.slice(-1); }
    else if (h === 'request') { S.view = 'request'; S.key = null; }
    else if (/^evidence=(context|stake|judge|external)$/.test(h)) { S.view = 'evidence'; S.key = h.slice(9); }
    else if (ON_EVALUATE && STEP === 'test' && (!h || /^(thome|tmap|talpha|tplans|tbeta|tout|tcanvas)$/.test(h))) { S.view = h || 'thome'; S.key = null; }
    else if (ON_EVALUATE && STEP === 'test' && h === 'tools') { S.view = 'talpha'; S.key = null; }
    else if (ON_EVALUATE && STEP === 'test' && /^exp=[a-z0-9]+$/.test(h)) { S.view = 'texp'; S.key = h.slice(4); }
    else if (ON_EVALUATE && STEP === 'test' && h === 'present=t') { S.view = 'present'; S.key = 't'; }
    else if (ON_EVALUATE && STEP !== 'test' && (!h || /^(mhome|mmaps|mpeople|mrun|mworks|mfails|mdesign|mcanvas)$/.test(h))) { S.view = h || 'mhome'; S.key = null; }
    else if (ON_EVALUATE && STEP !== 'test' && h === 'tools') { S.view = 'mworks'; S.key = null; }
    else if (ON_EVALUATE && STEP !== 'test' && h === 'present=m') { S.view = 'present'; S.key = 'm'; }
    else if (ON_ANALYSE && /^(model|model=[a-z]+)$/.test(h)) { location.replace('/model' + location.search + '#' + (h === 'model' ? 'mworks' : h)); return false; }
    else if (/^model=[a-z]+$/.test(h)) { S.view = 'model'; S.key = null; S.mtab = h.slice(6); }
    else if (/^medit=[a-z]+$/.test(h)) { S.view = 'medit'; S.key = h.slice(6); }
    else if (ON_PROJECT) { S.view = h === 'reports' ? 'reports' : h === 'scope' ? 'scope' : 'where'; S.key = null; }   // "Running the project" (#run) now lives in Where we are (28 October 2026)
    else if (ON_EVALUATE) { S.view = 'evaluate'; S.key = (STEP === 'test' && (h === 'evidence' || h === 'beta')) || (STEP !== 'test' && (h === 'props' || h === 'handon')) ? h : window.VTAnalyse && window.VTAnalyse.EIDS[h] ? h : 'tools'; }
    else if ((h === 'guided' || /^guided=[a-z0-9]+$/.test(h)) && window.VTGuide && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'guided'; S.key = h.slice(7) || null; }
    else if (h === 'fields=system' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'box'; S.key = 'system'; S.plain = true; }
    else if (/^box=[a-z0-9]+$/.test(h) && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'box'; S.key = h.slice(4); }
    else if (/^part=[a-z]+$/.test(h) && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'part'; S.key = h.slice(5); }
    else if (/^system(=picture|=canvas)?$/.test(h) && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'system'; S.key = null; FX.sview = h.split('=')[1] || 'questions'; }
    else if (h === 'line' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'line'; S.key = null; }
    else if ((h === 'stake' || h === 'exposure') && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = h; S.key = null; }
    else if (h === 'work' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'work'; S.key = null; }
    else if (h === 'question' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'question'; S.key = null; }
    else if (h === 'thework' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'thework'; S.key = null; }
    else if (h === 'fcanvas' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'fcanvas'; S.key = null; }
    else if (h === 'onepage' && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'onepage'; S.key = null; }
    else if (/^present=[qsyl]$/.test(h) && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'present'; S.key = h.slice(8); }
    else if ((h === 'fhome' || !h) && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = 'fhome'; S.key = null; }
    else if ((h === 'poster' || h === 'board' || h === 'mdl') && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE) { S.view = h; S.key = null; }
    else if (!h && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE && window.VTGuide && !S.readonly && !window.VTGuide.finished() && !teamStarted()) { S.view = 'guided'; S.key = null; }
    else { S.view = 'canvas'; S.key = null; }
    return true;
  }
  function after() {
    var FPART = S.view === 'stake' || S.view === 'exposure' ? 'line' : S.view === 'fhome' || S.view === 'question' || S.view === 'system' || S.view === 'line' || S.view === 'fcanvas' ? S.view : S.view === 'mdl' ? 'system' : 'canvas', P2 = FPART === 'canvas' && S.view !== 'guided';
    var fsa = document.getElementById('fShowAs'); if (fsa) fsa.hidden = !P2;
    Array.prototype.forEach.call(document.querySelectorAll('#subtabs button'), function (b) { if (b.dataset.g || b.dataset.in) return; if (b.dataset.fp) return b.setAttribute('aria-selected', String(b.dataset.fp === FPART)); if (b.dataset.sa) return b.setAttribute('aria-selected', String(b.dataset.v === S.view || (b.dataset.v === 'canvas' && ['canvas', 'box', 'part', 'tile', 'summary', 'rsummary', 'analysis', 'tools', 'source', 'review', 'toolkit', 'guide', 'sheet'].indexOf(S.view) >= 0))); if (ON_EVALUATE) return b.setAttribute('aria-selected', String(b.dataset.v === S.key || (b.dataset.v === 'evaluate' && ['evidence', 'beta', 'props', 'handon'].indexOf(S.key) < 0))); b.setAttribute('aria-selected', String(b.dataset.v === S.view || (['box', 'part', 'tile', 'summary', 'rsummary', 'analysis', 'tools', 'source', 'review', 'toolkit', 'guide', 'sheet'].indexOf(S.view) >= 0 && b.dataset.v === (ON_PROJECT ? 'run' : 'canvas')))); });
    S.dirty = false; saveMsg.textContent = '';
    if (drawer) { drawer.remove(); drawer = null; }
    if (S.view !== 'medit') S.medit = null;
    render();
    window.scrollTo(0, 0);
  }
  // draw the view a hash names into another element (Use draws chosen views inside its own panel)
  function renderHash(host, h) {
    var keep = { view: S.view, key: S.key, mtab: S.mtab, part: S.part, plain: S.plain, sview: FX.sview }, m0 = main;
    if (parseHash(h) === false) return false;
    main = host;
    try { renderView(); } catch (e) { if (window.console) console.warn('use view', h, e); host.appendChild(el('p', { class: 'meta', text: 'This view could not be drawn here.' })); }
    finally { main = m0; S.view = keep.view; S.key = keep.key; S.mtab = keep.mtab; S.part = keep.part; S.plain = keep.plain; FX.sview = keep.sview; }
    return true;
  }
  function go(hash) {
    if (S.dirty && !confirm('You have unsaved changes on this page. Leave without saving?')) return;
    S.dirty = false;
    if (location.hash === '#' + hash) route(); else location.hash = hash;
  }
  window.addEventListener('hashchange', function () { route(); });
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  function render() { renderView(); try { decorate(); } catch (e) { if (window.console) console.warn('decorate', e); } }
  function renderView() {
    // leaving the presenting view or the history (31 October 2026)
    var pv = document.getElementById('fxPresentView'); if (pv && S.view !== 'present') { pv.remove(); if (FX.presKey) document.removeEventListener('keydown', FX.presKey); }
    var hv = document.getElementById('fxHist'); if (hv && ['question', 'work', 'canvas', 'system', 'line', 'stake', 'exposure', 'dgather', 'dvuln', 'dtrig', 'dexpl', 'dform', 'mmaps', 'mpeople', 'mrun', 'mworks', 'mfails', 'mdesign', 'talpha', 'tplans', 'tbeta', 'tout', 'texp'].indexOf(S.view) < 0) hv.remove();
    if (sub && !ON_PROJECT && !ON_EVALUATE && !ON_MODEL && !ON_ANALYSE && !ON_HOME) sub.hidden = ['question', 'work', 'canvas', 'system', 'line', 'stake', 'exposure', 'onepage', 'present'].indexOf(S.view) >= 0;
    if (sub && ON_EVALUATE && STEP === 'test') {
      sub.hidden = ['talpha', 'tplans', 'tbeta', 'tout', 'present', 'texp'].indexOf(S.view) >= 0;
      var TV = { scentest: 'talpha', bia: 'talpha', risk: 'talpha', tmap: 'talpha', beta: 'tbeta', mvc: 'tplans', bcp: 'tplans', dr: 'tplans', plans: 'tplans', exlog: 'tplans', selfassess: 'tplans', pace: 'tout', steer: 'tout', forcefield: 'tout', evidence: 'tout' }, TP = ['thome', 'tcanvas'].indexOf(S.view) >= 0 ? S.view : TV[S.key] || TV[S.view] || 'thome';
      Array.prototype.forEach.call(sub.querySelectorAll('button[data-tp]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.tp === TP)); });
    }
    if (sub && ON_EVALUATE && STEP !== 'test') {
      sub.hidden = ['mmaps', 'mpeople', 'mrun', 'mworks', 'mfails', 'mdesign', 'present'].indexOf(S.view) >= 0;
      var MV = { tharm: 'mrun', cmap: 'mrun', abm: 'mrun', props: 'mdesign', handon: 'mdesign' }, MGRP = { journey: 'mmaps', blueprint: 'mmaps', process: 'mmaps', ibs: 'mmaps', systems: 'mmaps', vsm: 'mmaps', sna: 'mpeople', fram: 'mpeople', timeline: 'mpeople', bowtie: 'mpeople', faulttree: 'mpeople', accimap: 'mpeople' }, MP = ['mhome', 'mcanvas'].indexOf(S.view) >= 0 ? S.view : MV[S.view] || (S.view === 'model' && MGRP[S.key]) || MV[S.key] || 'mmaps';
      Array.prototype.forEach.call(sub.querySelectorAll('button[data-mp]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.mp === MP)); });
    }
    if (sub && ON_ANALYSE) {
      sub.hidden = ['dgather', 'dvuln', 'dtrig', 'dexpl', 'dform', 'present'].indexOf(S.view) >= 0;
      var GV = ['analyse', 'sources', 'source', 'levels', 'capitals', 'models', 'outcomes', 'request', 'outside', 'evidence'], DGRP = { goright: 'dvuln', nots: 'dvuln', capitals: 'dvuln', levels: 'dvuln', dependants: 'dvuln', horizon: 'dtrig', outside: 'dtrig', isnot: 'dtrig', rca: 'dtrig', techmech: 'dtrig', people: 'dtrig', disagree: 'dexpl', howsaid: 'dexpl', rivals: 'dexpl', futures: 'dexpl', frame: 'dexpl', combos: 'dexpl' }, DP = S.view === 'dhome' || S.view === 'dcanvas' ? S.view : S.view === 'formulation' ? 'dform' : DGRP[S.view] || (GV.indexOf(S.view) >= 0 ? 'dgather' : 'dvuln');
      Array.prototype.forEach.call(sub.querySelectorAll('button[data-dp]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.dp === DP)); });
    }
    main.innerHTML = '';
    if (S.view === 'use' && window.VTUse) { saveBar.hidden = true; if (sub) sub.hidden = true; return window.VTUse.render(main, VTX, S.key); }
    var onRoute = S.view === 'box' && S.key === 'system' && !S.plain && window.VTRoute;
    if (window.VTBox && !(S.view === 'box' && (S.key === 'help' || S.key === 'question'))) window.VTBox.leave();
    if (window.VTRoute && !onRoute) window.VTRoute.leave();
    document.documentElement.classList.remove('gd-boot');   // set in problem.html while a project opens
    if (window.VTGuide && S.view !== 'guided') window.VTGuide.leave();
    if (S.view === 'guided' && window.VTGuide) { saveBar.hidden = true; return window.VTGuide.render(main, VTX, S.key); }
    // a practice switched off for this engagement
    var prac = ON_HOME ? null : ON_ANALYSE ? 'analyse' : STEP === 'test' ? 'test' : ON_EVALUATE ? 'evaluate' : ON_MODEL ? 'model' : ON_PROJECT ? null : 'problem';
    if (prac && !inScope(prac)) { saveBar.hidden = true; head(S.data.session.name || 'Viability Thinking Lab', 'Hidden for this engagement', 'This part of the method is hidden for this engagement, to keep the screens simple. It keeps running in the background, so nothing is lost and it is up to date. To reveal it, go to Project, under What’s shown.'); main.appendChild(el('p', { style: 'margin-top:16px' }, [el('a', { class: 'btn solid', href: '/project#scope', text: 'What’s shown' })])); return; }
    var PV = { poster: 'p.canvas', board: 'p.board', tiles: 'p.tools', views: 'p.views' };
    if (!ON_ANALYSE && !ON_EVALUATE && !ON_MODEL && !ON_PROJECT && PV[S.view] && !inScope(PV[S.view])) S.view = 'canvas';
    if (S.view === 'scope' && window.VTScope) { saveBar.hidden = true; return window.VTScope.render(main, VTX); }
    saveBar.hidden = !(S.view === 'tile' || S.view === 'sheet');
    if (S.view === 'tile') { var td = tileDef(S.key); if (td && td.fields) { saveBar.hidden = true; return renderFieldTile(td); } if (td && td.inv) { saveBar.hidden = true; return renderInventoryEditor(); } return renderTile(); }
    if (ON_ANALYSE && S.view === 'dhome') { renderDHome(); return main.appendChild(evqSummary('diagnose')); }
    if (ON_ANALYSE && S.view === 'dgather') { renderDGather(); return main.appendChild(evqBar('d:gather', 'Diagnose: the evidence gathered', 'diagnose')); }
    if (ON_ANALYSE && (S.view === 'dvuln' || S.view === 'dtrig' || S.view === 'dexpl')) { renderDWork(S.view); return main.appendChild(evqBar('d:work', 'Diagnose: how it works and fails', 'diagnose')); }
    if (ON_ANALYSE && S.view === 'dform') { renderDForm(); return main.appendChild(evqBar('d:form', 'Diagnose: the formulation', 'diagnose')); }
    if (ON_ANALYSE && S.view === 'dcanvas') return renderDCanvas();
    if (ON_ANALYSE && S.view === 'present') return renderPresent('d');
    if (ON_EVALUATE && STEP === 'test') {
      if (S.view === 'thome') { renderTHome(); return main.appendChild(evqSummary('test')); }
      if (S.view === 'tmap') { renderTMap(); return; }
      if (S.view === 'tplans') { renderToolPart('test', 'tplans'); return; }
      if (S.view === 'talpha') { renderTAlpha(); return main.appendChild(evqBar('t:alpha', 'Test: testing the model (alpha)', 'test')); }
      if (S.view === 'tbeta') { renderTBeta(); return main.appendChild(evqBar('t:beta', 'Test: trial in the organisation (beta)', 'test')); }
      if (S.view === 'tout') { renderTOut(); return main.appendChild(evqBar('t:out', 'Test: outcomes', 'test')); }
      if (S.view === 'texp') { renderTExp(S.key); return main.appendChild(evqBar('x:' + S.key, 'Test: the experiment for ' + S.key.toUpperCase(), 'test')); }
      if (S.view === 'tcanvas') return renderTCanvas();
      if (S.view === 'present') return renderPresent('t');
    }
    if (ON_EVALUATE && STEP !== 'test') {
      if (S.view === 'mhome') { renderMHome(); return main.appendChild(evqSummary('model')); }
      if (S.view === 'mmaps' || S.view === 'mpeople' || S.view === 'mrun') { renderToolPart('model', S.view); return; }
      if (S.view === 'mworks') { renderMLens('works'); return main.appendChild(evqBar('m:works', 'Model: how it works', 'model')); }
      if (S.view === 'mfails') { renderMLens('fails'); return main.appendChild(evqBar('m:fails', 'Model: how it fails', 'model')); }
      if (S.view === 'mdesign') { renderMDesign(); return main.appendChild(evqBar('m:design', 'Model: design propositions', 'model')); }
      if (S.view === 'mcanvas') return renderMCanvas();
      if (S.view === 'present') return renderPresent('m');
      if (S.view === 'model') { var lp = lensPanel(S.mtab); if (lp) main.appendChild(lp); return renderModel(); }
    }
    if (S.view === 'model' && ON_ANALYSE && window.VTAnalyse) return window.VTAnalyse.render(main, 'model');
    if (S.view === 'model') return renderModel();
    if (S.view === 'reports' && window.VTReport) return window.VTReport.render(main);
    if (S.view === 'where' || S.view === 'phome') { renderWhere(); if (window.VTUse && S.view === 'phome') { var cb = window.VTUse.crumb('build'); cb.style.margin = '0 0 12px'; cb.style.maxWidth = 'none'; main.insertBefore(cb, main.firstChild); if (!S.readonly) main.appendChild(window.VTUse.changesCard()); } return S.view === 'where' ? main.appendChild(evqSummary(null)) : null; }
    if (S.view === 'system') return FX.sview === 'picture' ? renderSysPicture() : FX.sview === 'canvas' ? renderSysCanvas() : renderSystem();
    if (S.view === 'line') { renderLine(); return main.appendChild(evqBar('f:line', 'Frame: thresholds', 'frame')); }
    if ((S.view === 'stake' || S.view === 'exposure') && window.VTStake) return window.VTStake.render(main, VTX, S.view === 'stake' ? 'who' : 'how');
    if (S.view === 'fhome') { renderFrameHome(); return main.appendChild(evqSummary('frame')); }
    if (S.view === 'question') return renderQuestion();
    if (S.view === 'onepage') return renderOnePage();
    if (S.view === 'fcanvas') return renderFrameCanvas();
    if (S.view === 'thework') { if (window.VTWork) return window.VTWork.render(main, VTX); }
    if (S.view === 'present') return renderPresent(S.key);
    if (S.view === 'evaluate' && window.VTAnalyse) return window.VTAnalyse.renderEvaluate(main, S.key, STEP || 'model');
    if (ON_ANALYSE && window.VTAnalyse && (S.view === 'source' || S.view === 'medit')) window.VTAnalyse.tabs(S.view === 'source' ? 'sources' : S.key === 'outside' ? 'outside' : window.VTModel && window.VTModel.models.some(function (x) { return x.id === S.key && !x.hidden && !x.practice; }) ? 'model' : 'tools');
    if (ON_ANALYSE && window.VTAnalyse && S.view !== 'source' && S.view !== 'medit') return window.VTAnalyse.render(main, S.view, S.key);
    if (S.view === 'analyse') return window.VTNeeds.renderAnalyse(main);
    if (S.view === 'request') return window.VTNeeds.renderRequest(main);
    if (S.view === 'evidence') return window.VTNeeds.renderEvidence(main, S.key);
    if (S.view === 'medit') return window.VTModel ? window.VTModel.renderEdit(main, S.key) : renderModel();
    if (S.view === 'analysis') return renderAnalysis(S.key);
    if (S.view === 'sources') return renderPartSources(S.key);
    if (S.view === 'tools') return renderToolkit(S.key);
    if (S.view === 'source') return renderSource();
    if (S.view === 'review') return renderReview();
    if (S.view === 'rsummary') return renderReasonsSummary();
    if (S.view === 'guide') return renderGuide();
    if (S.view === 'toolkit') return renderToolkit();
    if (S.view === 'sheet') return renderSheet();
    if (S.view === 'canvas' || S.view === 'work') return renderWork();
    if (S.view === 'mdl') return renderCanvas();
    if (S.view === 'box') return renderBox(S.key);
    if (S.view === 'part') return renderPart(S.key);
    if (S.view === 'poster') return renderPoster();
    if (S.view === 'board') return renderWBoard();
    if (S.view === 'views') return renderViews();
    if (S.view === 'summary') return renderSummary();
    return renderBoard();
  }
  function head(kick, title, lead) {
    main.appendChild(el('p', { class: 'kick', text: kick }));
    main.appendChild(el('h1', { class: 'wide', text: title }));
    if (lead) main.appendChild(el('p', { class: 'lead', text: lead }));
  }

  // ---------- Where we are: how client detail is handled, and finishing the project (28 October 2026) ----------
  var canLeadHere = function () { var me = S.data.me || {}; return S.data.as === 'master' || me.via === 'code' || me.role === 'lead' || (!me.via && !(creds && creds.member)); };
  function dataTask() {
    var r = row('datamode'), c = (r && r.content) || {}, m = c.mode;
    var box = el('div', { class: 'ww-ti', id: 'wwData' });
    var st = m ? 'done' : 'todo';
    var tickEl = st === 'done' ? el('span', { class: 'ww-tick on', 'aria-hidden': 'true', html: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M5 12l5 5 9-10"/></svg>' }) : el('span', { class: 'ww-tick no', 'aria-hidden': 'true' });
    var line = m === 'live' ? 'Live: the organisation has agreed to our confidentiality and security terms' + (c.by ? ' (' + c.by + (c.at ? ', ' + new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '') + ')' : '') + '.' : m === 'anon' ? 'Anonymised: no names or identifying detail from the organisation go into this project.' : 'Live or anonymised? Decide before any detail about the organisation goes in.';
    var choose = function (mode) { return async function () { try { await saveRow('datamode', { mode: mode, at: new Date().toISOString(), by: (window.VTAuth && window.VTAuth.user && (window.VTAuth.user() || {}).name) || (S.data.as === 'master' ? 'David (master)' : 'Facilitator') }, 'done'); render(); } catch (e) { alert(e.message); } }; };
    var btns = S.readonly ? null : el('div', { class: 'ww-choice', role: 'group', 'aria-label': 'Organisation data' }, [
      el('button', { type: 'button', id: 'wwLive', class: m === 'live' ? 'on' : '', 'aria-pressed': String(m === 'live'), onclick: choose('live'), text: 'Live (the organisation has agreed)' }),
      el('button', { type: 'button', id: 'wwAnon', class: m === 'anon' ? 'on' : '', 'aria-pressed': String(m === 'anon'), onclick: choose('anon'), text: 'Anonymised' })]);
    box.appendChild(tickEl);
    box.appendChild(el('div', { class: 'n' }, [el('b', { text: 'Organisation data' }), el('span', { text: line }), btns, el('span', { class: 'ww-team', text: 'Team only' })]));
    box.appendChild(el('span', { class: 'ww-tag ' + (st === 'done' ? 'done' : 'not'), text: st === 'done' ? 'Completed' : 'Not started' }));
    return box;
  }
  function finishSect() {
    var pr = row('publish'), p = (pr && pr.content) || {}, m = ((row('datamode') || {}).content || {}).mode, lead = canLeadHere(), master = S.data.as === 'master';
    var wrap = el('div', { class: 'ww-sect', id: 'wwFinish' }, [el('h3', { text: 'Finishing the project' })]);
    var card = el('div', { class: 'ww-tl ww-fin' }); wrap.appendChild(card);
    var when = function (x) { return x && x.at ? new Date(x.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
    var call = function (body, ask) { return async function () { if (ask && !window.confirm(ask)) return; try { var d = await api(body); S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'publish'; }); S.data.tiles.push(d.tile); if (body.action === 'p_finish' || body.action === 'p_unfinish') S.data.session.status = body.action === 'p_finish' ? 'closed' : 'open'; render(); } catch (e) { alert(e.message); } }; };
    var btn = function (id, text, fn, ghost) { return el('button', { type: 'button', id: id, class: 'ww-btn' + (ghost ? ' ghost' : ''), onclick: fn, text: text }); };
    if (S.readonly) { card.appendChild(el('p', { text: 'An example: read-only.' })); return wrap; }
    if (p.published) {
      card.appendChild(el('p', {}, [el('b', { text: 'Published as an example' }), document.createTextNode(' on ' + when(p.published) + (p.published.version === 'anonymised' ? ', as an anonymised copy. ' : '. ')), el('a', { href: '/frame?example=' + encodeURIComponent(p.published.key), id: 'wwPublished', text: 'Open the example' })]));
      card.appendChild(el('p', { class: 'ww-muted', text: 'The example is a separate copy. This project stays as it is.' }));
      return wrap;
    }
    if (!p.finished) {
      card.appendChild(el('p', { text: 'When the work is done, close the project. It stays in your projects, read and changed as before, and closes to new participants. Once it is closed you can ask for it to be added to the worked examples.' }));
      if (lead) card.appendChild(el('div', { class: 'ww-row' }, [btn('wwClose', 'Close the project', call({ action: 'p_finish' }, 'Close this project? It closes to new participants. You can reopen it.'))]));
      else card.appendChild(el('p', { class: 'ww-muted', text: 'The project lead can close the project.' }));
      return wrap;
    }
    card.appendChild(el('p', {}, [el('b', { text: 'Closed' }), document.createTextNode(' on ' + when(p.finished) + (p.finished.by ? ' by ' + p.finished.by : '') + '.')]));
    if (p.declined) card.appendChild(el('p', { class: 'ww-note', text: 'Not added to the examples (' + when(p.declined) + ')' + (p.declined.note ? ': ' + p.declined.note : '.') }));
    if (p.request) {
      var rq = p.request;
      card.appendChild(el('p', { id: 'wwRequested' }, [el('b', { text: 'Waiting for David to approve' }), document.createTextNode(': "' + rq.label + '", ' + (rq.version === 'as_is' ? 'as it is' : 'as an anonymised copy, with ' + rq.replacements.length + (rq.replacements.length === 1 ? ' replacement' : ' replacements')) + '. Asked by ' + rq.by + ', ' + when(rq) + '.')]));
      if (rq.version !== 'as_is' && rq.replacements.length) card.appendChild(el('ul', { class: 'ww-reps' }, rq.replacements.map(function (x) { return el('li', { text: '"' + x[0] + '" becomes "' + (x[1] || '(removed)') + '"' }); })));
      var row2 = el('div', { class: 'ww-row' });
      if (master) { row2.appendChild(btn('wwApprove', 'Approve and publish', call({ action: 'p_publish_approve' }, 'Publish a read-only copy of this project as a worked example, open to everyone?'))); row2.appendChild(btn('wwDecline', 'Decline', async function () { var n = window.prompt('Why not? (this is shown to the project lead)', ''); if (n === null) return; try { var d = await api({ action: 'p_publish_decline', note: n }); S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'publish'; }); S.data.tiles.push(d.tile); render(); } catch (e) { alert(e.message); } }, true)); }
      if (lead) row2.appendChild(btn('wwWithdraw', 'Withdraw the request', call({ action: 'p_publish_cancel' }), true));
      card.appendChild(row2);
      return wrap;
    }
    if (!lead) { card.appendChild(el('p', { class: 'ww-muted', text: 'The project lead can ask for it to be added to the worked examples.' })); return wrap; }
    card.appendChild(el('div', { class: 'ww-row' }, [btn('wwReopen', 'Reopen the project', call({ action: 'p_unfinish' }), true)]));
    // ask for it to become a worked example
    var f = el('form', { class: 'ww-pubform', id: 'wwPubForm', novalidate: true });
    f.appendChild(el('h4', { text: 'Add it to the worked examples' }));
    f.appendChild(el('p', { class: 'ww-muted', text: 'Examples are open to everyone, signed in or not. David approves each one before it appears. The example is a copy: this project is not changed. Engagement terms and who answered each question are never copied.' }));
    var asIs = m === 'anon';
    var v = el('div', { class: 'ww-choice', role: 'radiogroup', 'aria-label': 'Which version' });
    var pick = asIs ? 'as_is' : 'anonymised';
    var setV = function (x) { pick = x; Array.prototype.forEach.call(v.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.v === x); b.setAttribute('aria-checked', String(b.dataset.v === x)); }); repsBox.hidden = x !== 'anonymised'; };
    v.appendChild(el('button', { type: 'button', 'data-v': 'as_is', role: 'radio', disabled: asIs ? null : true, title: asIs ? '' : 'Only a project kept anonymised can go as it is', onclick: function () { setV('as_is'); }, text: 'As it is' }));
    v.appendChild(el('button', { type: 'button', 'data-v': 'anonymised', role: 'radio', onclick: function () { setV('anonymised'); }, text: 'As an anonymised copy' }));
    f.appendChild(v);
    if (!asIs) f.appendChild(el('p', { class: 'ww-muted', text: m === 'live' ? 'This project holds live data from the organisation, so it can only go as an anonymised copy.' : 'Organisation data has not been marked as anonymised (under Set-up), so it can only go as an anonymised copy.' }));
    var fld = function (id, label, val, ph) { return el('label', { class: 'ww-fl', for: id }, [label, el('input', { id: id, type: 'text', value: val || '', placeholder: ph || '' })]); };
    f.appendChild(fld('pubLabel', 'Name of the example', S.data.session.name, 'For example: Customer refunds at a car finance company'));
    f.appendChild(fld('pubSector', 'Sector', '', 'For example: Financial services'));
    f.appendChild(fld('pubWhy', 'What it shows, in one line', '', 'For example: a refund process that must keep paying customers after a cyber attack'));
    var repsBox = el('div', { class: 'ww-reps-edit', id: 'pubReps' }, [el('p', { class: 'ww-fl', text: 'Names and details to replace, everywhere in the copy' })]);
    var tbl = el('div', { class: 'ww-repl' }); repsBox.appendChild(tbl);
    var addRep = function (a, b) { tbl.appendChild(el('div', { class: 'ww-rep' }, [el('input', { type: 'text', class: 'rf', placeholder: 'Find, for example the organisation’s name', value: a || '', 'aria-label': 'Find' }), el('span', { text: '→' }), el('input', { type: 'text', class: 'rt', placeholder: 'Replace with, for example a car finance company', value: b || '', 'aria-label': 'Replace with' })])); };
    addRep(S.data.session.client && S.data.session.client !== 'none' ? S.data.session.client : '', 'the organisation'); addRep(); addRep();
    repsBox.appendChild(el('button', { type: 'button', class: 'ww-link', onclick: function () { addRep(); }, text: '+ Another' }));
    repsBox.appendChild(el('p', { class: 'ww-muted', text: 'Include the organisation, people’s names, places, products and anything else that would identify the organisation. David checks the copy before it is published.' }));
    f.appendChild(repsBox);
    f.appendChild(el('label', { class: 'ww-fl', for: 'pubNote' }, ['A note for David (optional)', el('textarea', { id: 'pubNote', rows: 2 })]));
    var err = el('p', { class: 'ww-err', role: 'alert' });
    f.appendChild(el('div', { class: 'ww-row' }, [el('button', { type: 'submit', class: 'ww-btn', id: 'wwAsk', text: 'Ask David to add it' })]));
    f.appendChild(err);
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); err.textContent = '';
      var reps = Array.prototype.map.call(tbl.querySelectorAll('.ww-rep'), function (r) { return [r.querySelector('.rf').value.trim(), r.querySelector('.rt').value.trim()]; }).filter(function (r) { return r[0]; });
      if (pick === 'anonymised' && !reps.length) { err.textContent = 'List at least one name or detail to replace.'; return; }
      try { var d = await api({ action: 'p_publish_request', version: pick, label: f.querySelector('#pubLabel').value, sector: f.querySelector('#pubSector').value, why: f.querySelector('#pubWhy').value, note: f.querySelector('#pubNote').value, replacements: reps }); S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'publish'; }); S.data.tiles.push(d.tile); render(); }
      catch (e2) { err.textContent = e2.message; }
    });
    card.appendChild(f);
    setV(pick);
    return wrap;
  }
  // the five steps of Frame on the canvas, for a project the team has worked there
  function canvasSteps() {
    var fr = row('frame'), a = (fr && fr.content && fr.content.answers) || {}, sys = a.system || {}, R = sys.route || null, ex = EXAMPLE ? '?example=' + encodeURIComponent(EXAMPLE) : '';
    var has = function (k) { var x = a[k]; return !!(x && x.fields && Object.keys(x.fields).some(function (f) { return String(x.fields[f] || '').trim(); })); };
    var VAL = ['value', 'good', 'exposure', 'gap'], BAND = ['kind5', 'guesses', 'assume', 'alt', 'root', 'stmt', 'guarantor', 'qs', 'agree'];
    var st = function (done, some) { return done ? 'done' : some ? 'progress' : 'todo'; };
    var steps = [
      { name: 'Why they have come', status: st(!!(a.help && a.help.fields && String(a.help.fields.words || '').trim()), has('help')), box: 'help', line: 'The words used in the first call, the kind of reason, and why now.' },
      { name: 'What we are working on', status: st(!!(R ? R.agreed : (sys.fields && sys.fields.what && sys.fields.boundary)), has('system') || !!(R && R.desc)), box: 'system', line: 'Its name, its edge, what goes in and what comes out, and the map.' },
      { name: 'The question, and who owns it', status: st(!!(a.question && a.question.fields && String(a.question.fields.question || '').trim()), has('question')), box: 'question', line: 'Sharpen the question against the system, and say who owns it.' },
      { name: 'Value and exposure', status: st(VAL.every(has), VAL.some(has)), box: VAL.filter(function (k) { return !has(k); })[0] || 'value', line: 'Who gains and who is exposed, what good looks like, and the threshold it must never cross.' },
      { name: 'Testing the frame', status: st(!!(a.agree && a.agree.fields && String(a.agree.fields.text || '').trim()), BAND.some(has)), box: BAND.filter(function (k) { return !has(k); })[0] || 'agree', line: 'First guesses, assumptions, other framings, and agreement.' }];
    steps.forEach(function (x, i) { x.n = i + 1; x.href = '/frame' + ex + '#box=' + x.box; });
    var done = steps.filter(function (x) { return x.status === 'done'; }).length;
    return { steps: steps, done: done, all: done === steps.length };
  }
  // ---------- Where we are (28 October 2026, mocks/where-we-are.html version 1): every task, its status, and the next one ----------

  // ---------- three views of one part (mock-up on 1.2 The system, 3 November 2026) ----------
  // Questions, Picture and Canvas show the same answers. A change in any view is a change to the answer itself.
  function viewSwitch(part, cur) {
    var V = [['questions', 'Questions', 'Every question, in full'], ['picture', 'Picture', 'The answers drawn as the system'], ['canvas', 'Canvas', 'The one-page version']];
    return el('nav', { class: 'vsw no-print', 'aria-label': 'Three views of the same answers', id: 'vSwitch' }, [el('span', { class: 'vswl', text: 'View' })].concat(V.map(function (v) {
      return el('a', { class: 'vswb' + (v[0] === cur ? ' on' : ''), href: '#' + part + (v[0] === 'questions' ? '' : '=' + v[0]), 'aria-current': v[0] === cur ? 'page' : null, 'data-view': v[0] }, [el('b', { text: v[1] }), el('span', { text: v[2] })]);
    })).concat([el('span', { class: 'vswn' }, [document.createTextNode('All three show the same answers. Change one, and the others change with it. The full record: '), workLink()])]));
  }
  function vswCss() {
    if (document.getElementById('vswCss')) return;
    var st = document.createElement('style'); st.id = 'vswCss';
    st.textContent = '.vsw{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin:4px 0 18px;border:1px solid var(--w-rule,#ccc);width:fit-content;max-width:100%}.vswl{font-family:"DM Mono",monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:10px 12px;display:flex;align-items:center;opacity:.7}.vswb{display:flex;flex-direction:column;padding:8px 18px;border-left:1px solid var(--w-rule,#ccc);text-decoration:none;color:inherit;min-width:150px}.vswb b{font-size:16px}.vswb span{font-size:12px;opacity:.7}.vswb.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0)}.vswb:hover:not(.on){background:color-mix(in srgb,var(--accent,#e07030) 8%,transparent)}.vswn{flex-basis:100%;font-size:12px;opacity:.7;padding:6px 12px;border-top:1px solid var(--w-rule,#ccc)}' +
      '.svc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:2px solid currentColor;background:var(--bg,#fff);margin:0 0 18px}.svc .svh{grid-column:1/-1;display:flex;gap:16px;align-items:baseline;justify-content:space-between;padding:12px 16px;border-bottom:2px solid currentColor}.svc .svh h2{margin:0;font-size:20px}.svcc{border-right:1px solid var(--w-rule,#ccc);border-bottom:1px solid var(--w-rule,#ccc);padding:12px 14px;min-height:150px}.svcc:nth-child(3n+1){border-right:0}.svcc h3{margin:0 0 2px;font-size:15px;display:flex;gap:8px;align-items:center}.svcc h3 .n{font-family:"DM Mono",monospace;font-size:11px;border:1px solid currentColor;padding:1px 5px}.svcc .p{font-size:12px;opacity:.65;font-style:italic;margin:0 0 8px}.svi{margin:0 0 8px}.svi b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.75}.sved{display:block;width:100%;text-align:left;background:transparent;border:1px dashed transparent;padding:3px 4px;margin:0 -4px;font:inherit;font-size:14px;color:inherit;cursor:text;line-height:1.4}.sved:hover{border-color:var(--w-rule,#aaa)}.sved.e{opacity:.5;font-style:italic}.svi textarea{width:100%;font:inherit;font-size:14px;min-height:56px}.svlink{font-size:12px}.svc .svf{grid-column:1/-1;padding:12px 16px;border-top:2px solid currentColor;font-size:14px}@media(max-width:860px){.svc{grid-template-columns:1fr}.svcc{border-right:0}}';
    document.head.appendChild(st);
  }

  // Questions: only the questions that build the picture and the canvas, grouped by task (3 November 2026)
  function renderSystem() {
    vswCss(); qCss();
    var RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, a = frameAns(), ro = !!S.readonly;
    var svcN = (r.name || fv('system', 'what') || 'the service');
    var wrap = el('div', { class: 'fx', id: 'fxSystem' }); main.appendChild(wrap);
    var part = treePart('frame', 'system'), cnt = countOf(part.tasks);
    wrap.appendChild(fxPath('system', cnt.done + ' of ' + cnt.n)); wrap.appendChild(viewSwitch('system', 'questions'));
    wrap.appendChild(el('h1', { class: 'fxh1', text: '1.2 The system: the questions' }));
    wrap.appendChild(el('p', { class: 'fxlede', text: 'The questions that build the picture and the canvas. Answer them in any order; rough notes are fine. Each answer appears on the picture and the canvas as soon as it is saved.' }));
    var routeSave = function (mut, what) { return RT.save(mut, 'Changed: ' + what).then(function () { fxSave('ok'); }, function () { fxSave('bad'); }); };
    var help = function (t) { return t ? el('p', { class: 'qhelp', text: t }) : null; };
    // one question: label, help, and an editor that saves on leaving it
    var Q = {
      text: function (l, box, k, eg) { var t = el('textarea', { rows: 2, disabled: ro, 'data-field': box + '.' + k, 'aria-label': l, placeholder: eg ? 'For example: ' + eg : '' }); t.value = fv(box, k); t.addEventListener('change', function () { saveFrameField(box, k, t.value.trim()).catch(function () {}); }); return el('div', { class: 'qq' }, [el('label', { class: 'ql', text: l }), t]); },
      name: function (l, h) { var t = el('input', { type: 'text', disabled: ro, 'aria-label': l, value: r.name || '' }); t.addEventListener('change', function () { var v = t.value.trim(); routeSave(function (x) { x.name = v; }, 'its name'); }); return el('div', { class: 'qq' }, [el('label', { class: 'ql', text: l }), help(h), t]); },
      list: function (l, key, h) { var t = el('textarea', { rows: Math.max(3, RT.on(r, key).length + 1), disabled: ro, 'data-list': key, 'aria-label': l, placeholder: 'One per line' }); t.value = RT.on(r, key).join('\n');
        t.addEventListener('change', function () { var lines = t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); routeSave(function (x) { x.lists = x.lists || {}; var old = x.lists[key] || []; x.lists[key] = lines.map(function (v) { var o = old.filter(function (y) { return y.t === v; })[0]; return Object.assign({}, o || {}, { t: v, on: true }); }).concat(old.filter(function (y) { return !y.on && lines.indexOf(y.t) < 0; })); }, l); });
        return el('div', { class: 'qq' }, [el('label', { class: 'ql', text: l }), help(h), t, el('span', { class: 'qnote', text: 'One per line.' })]); },
      choice: function (l, h, opts, cur, set) { var sl = el('select', { disabled: ro, 'aria-label': l }, [el('option', { value: '', text: 'Not said yet' })].concat(opts.map(function (o) { return el('option', { value: o[0], text: o[1] }); }))); sl.value = cur || ''; sl.addEventListener('change', function () { set(sl.value); }); return el('div', { class: 'qq' }, [el('label', { class: 'ql', text: l }), help(h), sl]); },
      check: function (l, id) { var cb = el('input', { type: 'checkbox', disabled: ro, 'data-stop': id }); cb.checked = !!((((row('frame') || {}).content || {}).stopTests || {})[id]); cb.addEventListener('change', function () { saveFrameContent(function (c) { c.stopTests = c.stopTests || {}; c.stopTests[id] = cb.checked; }, 'Check: ' + id).catch(function () { cb.checked = !cb.checked; }); }); return el('label', { class: 'qq qcheck' }, [cb, el('span', { text: l })]); }
    };
    // who does each step
    var whoQ = function () {
      var steps = RT.on(r, 'work'), box = el('div', { class: 'qq' }, [el('label', { class: 'ql', text: 'Who does each step?' }), help('The team, role or part of the organisation that carries out each step. This is how the service is delivered.')]);
      if (!steps.length) { box.appendChild(el('p', { class: 'qnote', text: 'Name the main steps first, above.' })); return box; }
      steps.forEach(function (n, k) { var t = el('input', { type: 'text', disabled: ro, 'aria-label': 'Who does: ' + n, value: (((r.steps || [])[k]) || {}).who || '' }); t.addEventListener('change', function () { var v = t.value.trim(); routeSave(function (x) { x.steps = x.steps || []; while (x.steps.length <= k) x.steps.push({}); x.steps[k] = Object.assign({}, x.steps[k] || {}, { who: v }); }, 'who does step ' + (k + 1)); });
        box.appendChild(el('div', { class: 'qrow' }, [el('span', { class: 'qstep', text: (k + 1) + '. ' + n }), t])); });
      return box;
    };
    // what it runs on, capital by capital
    var capsQ = function () {
      var runs = (a.requires && a.requires.runs) || [], out = [];
      Object.keys(CAPNAME).forEach(function (cap) {
        var mine = runs.filter(function (x) { return x.cap === cap; }), t = el('textarea', { rows: Math.max(2, mine.length + 1), disabled: ro, 'data-cap': cap, 'aria-label': 'What it relies on: ' + CAPNAME[cap][0], placeholder: 'One per line' });
        t.value = mine.map(function (x) { return x.t; }).join('\n');
        t.addEventListener('change', function () { var lines = t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); saveFrameContent(function (c) { c.answers = c.answers || {}; var rq = c.answers.requires = c.answers.requires || {}; var all = rq.runs || []; var others = all.filter(function (x) { return x.cap !== cap; }), old = all.filter(function (x) { return x.cap === cap; }); rq.runs = others.concat(lines.map(function (v) { var o = old.filter(function (y) { return y.t === v; })[0]; return Object.assign({ own: 'ours' }, o || {}, { t: v, cap: cap }); })); }, 'What it runs on: ' + CAPNAME[cap][0]).catch(function () {}); });
        out.push(el('div', { class: 'qq qcap' }, [el('label', { class: 'ql', text: CAPNAME[cap][0] }), el('span', { class: 'qnote', text: CAPNAME[cap][1] }), t]));
      });
      return el('div', { class: 'qcaps' }, out);
    };
    var T = function (n, title, kids) { var tk = part.tasks.filter(function (t) { return t.n === n; })[0] || { st: 'none' }; return el('section', { class: 'fxcard qtask', id: 'q-' + n.replace(/\./g, '-'), 'data-task': n }, [el('div', { class: 'qhead' }, [el('span', { class: 'qn', text: n }), el('h2', { text: title }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag ' + (tk.st === 'done' ? 'ok' : ''), text: ST_N[tk.st] })])].concat(kids)); };
    var sv = svcN.toLowerCase();
    wrap.appendChild(T('1.2.1', 'What it is, and what it is for', [
      Q.name('What is it called?', 'A short, plain name everyone can use for it.'),
      Q.text('What is it for?', 'service', 'for', 'abnormal results reach a doctor who can act in time, every day of the year.'),
      Q.text('What must never change?', 'service', 'never', 'patients are as safe at the weekend as on a weekday.')]));
    wrap.appendChild(T('1.2.2', 'Its boundaries, and how it works', [
      Q.list('What bigger organisation or system is it part of?', 'within', 'Who can overrule it, and whose rules it works within.'),
      Q.list('What do the people in the service control?', 'inside', 'What they can change without asking anyone else. This draws the edge of the service.'),
      Q.list('What decisions are taken outside it that affect it?', 'outside', 'Made by someone else: another department, a supplier, head office, a regulator.'),
      Q.list('What comes in?', 'inputs', 'What arrives and gets used or worked on: requests, people, materials, information.'),
      Q.list('What are the main steps, in order?', 'work', 'These become the steps on the picture, and where to look first for what goes wrong.'),
      Q.list('What comes out?', 'outputs', 'What it produces, or what is different afterwards.'),
      whoQ(),
      Q.choice('Does it run as steps, as parts, or both?', 'Steps happen in order. Parts are teams or units that each do their own piece. Many services are both.', [['steps', 'As steps, in order'], ['parts', 'As parts, each doing its own piece'], ['both', 'Both']], r.shape, function (v) { routeSave(function (x) { x.shape = v; }, 'how it runs'); })]));
    wrap.appendChild(T('1.2.3', 'What it runs on', [help('What every step relies on but does not use up: where dependencies and single points of failure come from. List them under each of the six capitals.'), capsQ()]));
    wrap.appendChild(T('1.2.4', 'Who it matters to', [
      Q.text('When it works, who gains?', 'value', 'gains'), Q.text('If it fails, who is hurt?', 'exposure', 'exposed'), Q.text('Who is affected but not asked?', 'exposure', 'absent')]));
    wrap.appendChild(T('1.2.5', 'What can be changed, and how the model will be judged', [
      Q.text('What can the organisation actually change, by whom, and within what range?', 'question', 'levers'),
      Q.text('How has the problem behaved over time?', 'system', 'overtime'),
      Q.text('Which patterns must the model reproduce before it is trusted?', 'ppatterns', 'text'),
      Q.text('In one sentence: a system to do what, by what means, to achieve what?', 'root', 'text'),
      Q.text('Who gives assurance on the work?', 'passure', 'text')]));
    wrap.appendChild(T('1.2.6', 'The frame statement', [
      Q.text('What is being left out, and why?', 'system', 'leftout', 'GP practices, because the trust cannot change how they work.'),
      Q.text('When should this frame be looked at again?', 'system', 'expires', 'after the March board, or if the rota changes.'),
      Q.check('The boundary is plain enough for someone to disagree with', 'arguable'),
      Q.check('At least three ways our picture of the problem could be wrong are written down', 'wrong'),
      Q.check('At least one person who is affected but not asked is named', 'cost'),
      el('p', { class: 'qnote' }, [document.createTextNode('The starting point is written from these answers and agreed on the '), el('a', { href: '#system=canvas', text: 'canvas' }), document.createTextNode('.')])]));
    var tm = workSecs('system').filter(function (x) { return x.id === 'protocol'; })[0];
    if (tm && !ro) wrap.appendChild(el('p', { class: 'fxmuted sm' }, [document.createTextNode('Team only: how the team will work is set under '), el('a', { href: '#work', text: 'All the questions' }), document.createTextNode('.')]));
    wrap.appendChild(fxFoot(['1.1 The question', '#question'], ['Next: 1.3 Thresholds', '#line'], 'Answers save as you leave each one.'));
  }
  function qCss() {
    if (document.getElementById('qCss')) return;
    var st = document.createElement('style'); st.id = 'qCss';
    st.textContent = '.qtask{margin:0 0 16px}.qhead{display:flex;gap:10px;align-items:center;margin-bottom:6px}.qhead h2{margin:0;font-size:20px}.qn{font-family:"DM Mono",monospace;font-size:12px;border:1px solid currentColor;padding:2px 6px}.qq{display:block;margin:14px 0}.ql{display:block;font-weight:600;font-size:16px;margin-bottom:3px}.qhelp{margin:0 0 6px;font-size:13px;opacity:.75}.qq textarea,.qq input[type=text],.qq select{width:100%;font:inherit;font-size:15px}.qnote{font-size:12px;opacity:.65}.qrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:center;margin:4px 0}.qstep{font-size:14px}.qcaps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 16px}.qcap{margin:8px 0}.qcap .ql{margin:0}.qcheck{display:flex;gap:10px;align-items:flex-start;font-size:15px}@media(max-width:800px){.qcaps,.qrow{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }
  // Picture: the answers drawn as the system (the flow, from purpose to outcomes, with what it runs on)
  function renderSysPicture() {
    vswCss();
    var top = el('div', { class: 'fx' }, [fxPath('system', 'picture'), viewSwitch('system', 'picture'),
      el('h1', { class: 'fxh1', text: '1.2 The system: the picture' }),
      el('p', { class: 'fxlede', text: 'The same answers as the questions, drawn as the system: what it is for, what comes in, the work, what goes out, the question, and who gains or is harmed. Click any part to change it. The band underneath is what every step runs on.' })]);
    main.appendChild(top);
    var keep = main.children.length; S.mview = null;
    renderCanvas();
    // keep only the drawing itself
    var nodes = Array.prototype.slice.call(main.children, keep), flow = document.getElementById('mFlow');
    nodes.forEach(function (n) { if (n !== flow && !(n.querySelector && n.querySelector('#mFlow')) && n.id !== 'drawer') n.remove(); });
    if (flow) top.appendChild(flow);
    top.appendChild(fxFoot(['Questions', '#system'], ['Canvas', '#system=canvas'], 'The same answers in three views.'));
  }
  // Canvas: the one-page version of this part, edited in place (short answers); lists are changed on the picture
  function renderSysCanvas() {
    vswCss();
    var ro = !!S.readonly, RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; }, a = frameAns();
    var outs = RT ? RT.L(r, 'outside').filter(function (x) { return x.on; }).map(function (x) { return x.t; }) : [];
    var runs = (a.requires && a.requires.runs) || [], st = statementState();
    var wrap = el('div', { class: 'fx', id: 'sysCanvas' }); main.appendChild(wrap);
    wrap.appendChild(fxPath('system', 'canvas')); wrap.appendChild(viewSwitch('system', 'canvas'));
    wrap.appendChild(el('h1', { class: 'fxh1', text: '1.2 The system: the canvas' }));
    wrap.appendChild(el('p', { class: 'fxlede', text: 'The one-page version. Click any short answer to change it here; the same answer changes in the questions and on the picture. Lists of parts, steps and capitals are changed in the questions or on the picture. The starting point is agreed at the foot of the page.' }));
    var ed = function (box, k, label, ph) {
      var v = fv(box, k), holder = el('div', { class: 'svi', 'data-cell': box + '.' + k }, [el('b', { text: label })]);
      var show = function () { holder.innerHTML = ''; holder.appendChild(el('b', { text: label })); var cur = fv(box, k); holder.appendChild(el('button', { type: 'button', class: 'sved' + (cur ? '' : ' e'), disabled: ro, text: cur || (ro ? 'Not yet answered' : ph || 'Not yet answered: click to add'), onclick: function () { if (ro) return; var t = el('textarea', { 'aria-label': label }); t.value = fv(box, k); holder.replaceChild(t, holder.lastChild); t.focus(); t.addEventListener('blur', async function () { var nv = t.value.trim(); try { await saveFrameField(box, k, nv); } catch (e) {} show(); }); } })); };
      show(); return holder;
    };
    var ls = function (label, xs) { return el('div', { class: 'svi' }, [el('b', { text: label }), el('div', { style: 'font-size:14px', text: xs.length ? xs.join('; ') : 'None yet' })]); };
    var pic = el('a', { class: 'svlink', href: '#system', text: 'Change in the questions ›' });
    var cell = function (n, h, p, kids) { return el('section', { class: 'svcc' }, [el('h3', {}, [el('span', { class: 'n', text: n }), document.createTextNode(h)]), el('p', { class: 'p', text: p })].concat(kids)); };
    var caps = Object.keys(CAPNAME).map(function (k) { var xs = runs.filter(function (x) { return x.cap === k; }).map(function (x) { return x.t; }); return xs.length ? CAPNAME[k][0] + ': ' + xs.join(', ') : null; }).filter(Boolean);
    var grid = el('article', { class: 'svc', 'aria-label': 'The system, on one page' }, [
      el('div', { class: 'svh' }, [el('h2', { text: (r.name || fv('system', 'what') || 'The system') }), el('span', { class: 'fxmuted sm', text: S.data.session.name || '' })]),
      cell('1.2.1', 'What it is, and what it is for', 'What is it for? What must never change?', [ed('service', 'for', 'What it is for'), ed('service', 'never', 'What must never change')]),
      cell('1.2.2', 'Boundaries and function', 'What is inside, what is decided elsewhere, and what flows through?', [ls('Part of', r.standalone ? ['It stands alone'] : on('within')), ls('Inside', on('inside')), ls('Decided elsewhere', outs), ls('Comes in, the work, goes out', [on('inputs').length + ' in', on('work').length + ' steps', on('outputs').length + ' out']), pic]),
      cell('1.2.3', 'What it runs on', 'The six capitals', [caps.length ? el('ul', { style: 'margin:0;padding-left:18px;font-size:14px' }, caps.map(function (c) { return el('li', { text: c }); })) : el('p', { class: 'fxmuted', text: 'None yet' }), pic]),
      cell('1.2.4', 'Who it matters to', 'Who gains, who is hurt, and who is not asked?', [ed('value', 'gains', 'Who gains'), ed('exposure', 'exposed', 'Who is hurt if it fails'), ed('exposure', 'absent', 'Affected but not asked')]),
      cell('1.2.5', 'What can be changed, and how the model will be judged', 'The levers, how it has behaved over time, and the patterns the model must reproduce', [ed('question', 'levers', 'What can actually be changed, by whom'), ed('system', 'overtime', 'How it has behaved over time'), ed('ppatterns', 'text', 'Patterns the model must reproduce')]),
      cell('1.2.6', 'The frame statement', 'What was left out, and when to look again', [ed('system', 'leftout', 'Left out, and why'), ed('system', 'expires', 'Look at it again when')]),
      ]);
    wrap.appendChild(grid);
    // the starting point, written from the answers and agreed here
    var scratch = el('div'), keepMain = main; main = scratch; try { renderSystemOld(); } finally { main = keepMain; }
    var stc = scratch.querySelector('#sysStatement'); if (stc) { stc.style.marginTop = '0'; wrap.appendChild(stc); }
    wrap.appendChild(el('p', { class: 'fxmuted sm', text: 'Mock-up of the three views on one part. If it works, every part gets the same switch; parts without a natural picture show the questions and the canvas only.' }));
    wrap.appendChild(fxFoot(['Picture', '#system=picture'], ['Questions', '#system'], ''));
  }
  // ---------- the task tree (3 November 2026): four steps, up to six parts each, up to six tasks in each part ----------
  // Every page and tool has one place. A task is done when everything in it is done; a part when all its tasks are done.
  // Tasks that are hidden for this project, or models not chosen, are "not used" and do not count.
  var stOf = function (bs) { bs = bs.filter(function (b) { return b !== null && b !== undefined; }); if (!bs.length) return 'skip'; var n = bs.filter(Boolean).length; return n === bs.length ? 'done' : n ? 'going' : 'none'; };
  var rollUp = function (kids) { var c = kids.filter(function (k) { return k.st !== 'skip'; }); if (!c.length) return 'skip'; return c.every(function (k) { return k.st === 'done'; }) ? 'done' : c.some(function (k) { return k.st !== 'none'; }) ? 'going' : 'none'; };
  function TREE() {
    var ex = EXAMPLE ? '?example=' + encodeURIComponent(EXAMPLE) : '', FP = frameParts(), secs = {};
    workSecs().forEach(function (x) { secs[x.id] = x.done; });
    var sk = (row('stake') || {}).content || {}, ok = function (m) { return !!(m && m[0]); };
    var T = function (n, name, bs, href, open) { return { n: n, name: name, st: stOf(bs), href: href, open: open || null }; };
    var P = function (n, id, name, line, href, tasks) { return { n: n, id: id, name: name, line: line, href: href, tasks: tasks, st: rollUp(tasks) }; };
    var fq = '/frame' + ex, F = [
      P('1.1', 'question', 'The question', 'What the problem is, how to see it, and the question it becomes', fq + '#question', [
        T('1.1.1', 'Before we start', [secs.start], fq + '#question', 'start'),
        T('1.1.2', 'What is prompting this', [secs.prompting, ok(FP.question[0])], fq + '#question', 'prompting'),
        T('1.1.3', 'How to see the problem', [secs.framing], fq + '#question', 'framing'),
        T('1.1.4', 'First guesses, and what we take for granted', [secs.guesses, secs.assume], fq + '#question', 'guesses'),
        T('1.1.5', 'What we compare against', [secs.compare], fq + '#question', 'compare'),
        T('1.1.6', 'The question', FP.question.slice(1).map(ok), fq + '#question')]),
      P('1.2', 'system', 'The system', 'What it is, where its edges are, what it runs on and who it matters to', fq + '#system', [
        T('1.2.1', 'What it is, and what it is for', [secs.working], fq + '#system', 'working'),
        T('1.2.2', 'Its boundaries and its function', [ok(FP.system[0]), ok(FP.system[1])], fq + '#box=system'),
        T('1.2.3', 'What it runs on: the six capitals', [ok(FP.system[2])], fq + '#box=requires'),
        T('1.2.4', 'Who it matters to', [secs.matters], fq + '#system', 'matters'),
        T('1.2.5', 'What can be changed, and how the model will be judged', [secs.standards], fq + '#system', 'standards'),
        T('1.2.6', 'The frame statement', [ok(FP.system[3]), ok(FP.system[4]), ok(FP.system[5]), stopTests().filter(function (t) { return t.id !== 'arguable'; }).every(function (t) { return t.ok; })], fq + '#system')]),
      P('1.3', 'line', 'Thresholds', 'Who is exposed, how exposed they are, and where harm becomes intolerable', fq + '#line', [
        T('1.3.1', 'Who is exposed', [(sk.parties || []).some(function (p) { return p.n; })], fq + '#stake'),
        T('1.3.2', 'How exposed they are', [(sk.cards || []).some(function (k) { return k.n; })], fq + '#exposure'),
        T('1.3.3', 'What must never happen', [ok(FP.line[0])], fq + '#line'),
        T('1.3.4', 'Thresholds by holder', [ok(FP.line[1]), ok(FP.line[2]), ok(FP.line[3])], fq + '#line'),
        T('1.3.5', 'A threshold for every capital, or a reason', [ok(FP.line[4])], fq + '#line'),
        T('1.3.6', 'Thresholds agreed', [ok(FP.line[5])], fq + '#line')])];
    // Diagnose
    var dq = '/diagnose' + ex, A = window.VTAnalyse, tools = {}, Ng = window.VTNeeds;
    (A && A.analysisGroups ? A.analysisGroups() : []).forEach(function (g) { g.tools.forEach(function (t) { tools[t.id] = t; }); });
    var tl = function (n, id, name) { var t = tools[id]; return T(n, name || (t ? t.n : id), [t ? (t.built ? t.used : null) : null], t ? dq + t.href : dq + '#' + id); };
    var cv = A && A.coverage ? A.coverage() : { n: 0, levels: [], caps: [] }, forms = {};
    (S.data.sources || []).forEach(function (s) { try { forms[Ng && Ng.formOf ? Ng.formOf(s) : 'context'] = 1; } catch (e) {} });
    var as = dAssume(), dst = dState();
    var nform = function (sub) { if (!A || !A.FORM) return 0; var t = 0; A.FORM.filter(function (f) { return f[1].toLowerCase() === sub; }).forEach(function (f) { f[3].forEach(function (sp) { try { t += A.formEntries(sp).length; } catch (e) {} }); }); return t; };
    var D = [
      P('2.1', 'dgather', 'The evidence', 'What is known, where it came from, and whether it is enough', dq + '#dgather', [
        T('2.1.1', 'Sources and the evidence request', [cv.n > 0], dq + '#sources'),
        T('2.1.2', 'Context', [!!forms.context], dq + '#evidence=context'),
        T('2.1.3', 'Stakeholders’ views and values', [!!forms.stake], dq + '#evidence=stake'),
        T('2.1.4', 'Practitioner experience and judgement', [!!forms.judge], dq + '#evidence=judge'),
        T('2.1.5', 'Evaluated external evidence', [!!forms.external], dq + '#evidence=external'),
        T('2.1.6', 'Is it good enough?', [cv.levels.length >= 4, cv.caps.length >= 6, as.un.length === 0], dq + '#dgather')]),
      P('2.2', 'dvuln', 'What goes right, and what makes it vulnerable', 'How it works every day, and the conditions that leave it exposed', dq + '#dvuln', [
        tl('2.2.1', 'goright'), tl('2.2.2', 'nots', 'The twelve nots'), tl('2.2.3', 'capitals'), tl('2.2.4', 'levels'), tl('2.2.5', 'dependants')]),
      P('2.3', 'dtrig', 'What triggers failure, and what keeps it going', 'What sets it off, and what keeps the problem going', dq + '#dtrig', [
        tl('2.3.1', 'horizon'), tl('2.3.2', 'outside'), tl('2.3.3', 'isnot'), tl('2.3.4', 'rca'), tl('2.3.5', 'techmech'), tl('2.3.6', 'people')]),
      P('2.4', 'dexpl', 'Other explanations', 'Other accounts, other explanations, and the frame tested against the evidence', dq + '#dexpl', [
        tl('2.4.1', 'disagree'), tl('2.4.2', 'howsaid'), tl('2.4.3', 'rivals'), tl('2.4.4', 'futures', 'Futures letters'), tl('2.4.5', 'frame', 'The frame, tested against the evidence'), tl('2.4.6', 'combos', 'Combinations across cases')]),
      P('2.5', 'dform', 'The formulation', 'How it works and how it fails, and why, in one agreed statement', dq + '#dform', [
        T('2.5.1', 'Protective: what goes right', [nform('protective') > 0], dq + '#dform'),
        T('2.5.2', 'Predisposing: what made it vulnerable', [nform('predisposing') > 0], dq + '#dform'),
        T('2.5.3', 'Precipitating: what triggers failure', [nform('precipitating') > 0], dq + '#dform'),
        T('2.5.4', 'Perpetuating: what keeps it going', [nform('perpetuating') > 0], dq + '#dform'),
        T('2.5.5', 'The formulation agreed', [!!(dst.at && !dst.changed)], dq + '#dform')])];
    // Model
    var mq = '/model' + ex, chosen = mRow().chosen || [], anyChosen = chosen.length > 0;
    var MG = [['3.1', 'mmaps', 'Maps of the service', 'What the service is and how the work flows through it', ['journey', 'blueprint', 'process', 'ibs', 'systems', 'vsm']], ['3.2', 'mpeople', 'Maps of people, time and failure', 'Who holds it together, how it has unfolded, and how it fails', ['sna', 'fram', 'timeline', 'bowtie', 'faulttree', 'accimap']], ['3.3', 'mrun', 'Models that run', 'The map played over time, and the service run hour by hour', ['cmap', 'tharm', 'abm']]];
    var mt = function (n, id) { var m = MCAT.filter(function (x) { return x.id === id; })[0] || { n: id, href: '#' + id }, on = chosen.indexOf(id) >= 0, b = toolBuilt(id); var t = T(n, m.n, [on || b ? b : null], mq + m.href); if (!on && !b) t.st = anyChosen ? 'skip' : 'none'; t.model = id; return t; };
    var lensT = function (n, g, lens) { var ids = g[4].filter(function (id) { return chosen.indexOf(id) >= 0; }); return T(n, g[2], ids.length ? ids.map(function (id) { return mFind(id, lens).length > 0; }) : [anyChosen ? null : false], mq + '#' + (lens === 'works' ? 'mworks' : 'mfails')); };
    var MPp = mParts();
    var M = MG.map(function (g) { return P(g[0], g[1], g[2], g[3], mq + '#' + g[1], g[4].map(function (id, i) { return mt(g[0] + '.' + (i + 1), id); })); }).concat([
      P('3.4', 'mworks', 'How it works', 'What each model shows about what goes right', mq + '#mworks', MG.map(function (g, i) { return lensT('3.4.' + (i + 1), g, 'works'); })),
      P('3.5', 'mfails', 'How it fails', 'What each model shows about where it breaks', mq + '#mfails', MG.map(function (g, i) { return lensT('3.5.' + (i + 1), g, 'fails'); })),
      P('3.6', 'mdesign', 'Design propositions', 'What could change, agreed and handed to Test', mq + '#mdesign', [
        T('3.6.1', 'What the models showed', [chosen.some(function (id) { return mFind(id, 'works').length || mFind(id, 'fails').length; })], mq + '#mdesign'),
        T('3.6.2', 'The propositions', [MPp.props.length > 0], mq + '#props'),
        T('3.6.3', 'Every heading of the formulation answered', [MPp.covered.length === 4], mq + '#mdesign'),
        T('3.6.4', 'The sentence for Test', [MPp.blanks === 0], mq + '#mdesign'),
        T('3.6.5', 'Agreed and handed to Test', [!!(MPp.st.at && !MPp.st.changed)], mq + '#mdesign')])]);
    // Test
    var tq = '/test' + ex, TP = tParts(), tt = TP.tools, out = (tRow().out) || {}, c = tRow();
    var tu = function (n, id, name) { var t = tt[id]; return T(n, name || (t ? t.n : id), [t ? !!t.used : null], tq + '#' + id); };
    var props = TP.props, held = TP.held;
    var Tt = [
      P('4.1', 'talpha', 'Testing the model (alpha)', 'Each proposition tried in the model, against doing nothing, under severe but plausible scenarios', tq + '#talpha', [
        T('4.1.1', 'On the connected map', [toolBuilt('cmap')], tq + '#tmap'),
        T('4.1.2', 'Run in the flow and agent-based models', [toolBuilt('tharm') || toolBuilt('abm')], tq + '#talpha'),
        tu('4.1.3', 'scentest'), tu('4.1.4', 'bia', 'Impact analysis'), tu('4.1.5', 'risk'),
        T('4.1.6', 'The result for each proposition', props.length ? props.map(function (p) { return !!alphaOf(p); }) : [false], tq + '#talpha')]),
      P('4.2', 'tplans', 'Disruption and plans', 'How the service carries on through disruption, and whether the plans and exercises hold', tq + '#tplans', [
        tu('4.2.1', 'mvc'), tu('4.2.2', 'bcp'), tu('4.2.3', 'dr'), tu('4.2.4', 'plans'), tu('4.2.5', 'exlog'), tu('4.2.6', 'selfassess')]),
      P('4.3', 'tbeta', 'Trial in the organisation (beta)', 'The propositions that held, tried in use, with reports from the people who run the service', tq + '#tbeta',
        held.length ? held.slice(0, 6).map(function (p, i) { var r = TP.bres(p), xd = (((c.exp || {})[p.id] || {}).decision || {}).d; return T('4.3.' + (i + 1), (window.VTProps ? window.VTProps.label(p) + ' ' : '') + (p.n || 'Untitled'), [r === 'proven' || r === 'sentback' || xd === 'proven' || xd === 'sentback'], tq + '#exp=' + p.id); }) : [T('4.3.1', 'A proposition that holds in the model', [false], tq + '#talpha')]),
      P('4.4', 'tout', 'Outcomes', 'What the change leaves behind, for the people the service is for and for the organisation', tq + '#tout', [
        T('4.4.1', 'What changed for each group', [!!(out.gains && out.exposed && out.absent)], tq + '#tout'),
        T('4.4.2', 'The measure and the threshold checked', [!!c.measure && !!c.line], tq + '#tout'),
        tu('4.4.3', 'pace'), tu('4.4.4', 'steer'),
        T('4.4.5', 'Force field, and how far the evidence goes', [tt.forcefield ? !!tt.forcefield.used : null, tt.evidence ? !!tt.evidence.used : null], tq + '#forcefield'),
        T('4.4.6', 'The outcome agreed', [!!(TP.st.at && !TP.st.changed)], tq + '#tout')])];
    var S4 = [['1', 'frame', 'Frame', 'What are we working on, and what is the question?', fq, F], ['2', 'diagnose', 'Diagnose', 'How does it work and fail now, and why?', dq, D], ['3', 'model', 'Model', 'What would make it work better and fail better?', mq, M], ['4', 'test', 'Test', 'Do the changes work in use?', tq, Tt]];
    return S4.map(function (s) { return { n: s[0], id: s[1], name: s[2], q: s[3], href: s[4], parts: s[5], st: rollUp(s[5]) }; });
  }
  var ST_N = { done: 'Done', going: 'In progress', none: 'Not started', skip: 'Not used' };
  var ST_I = { done: '✓', going: '◐', none: '○', skip: '–' };
  function treeStep(id) { return TREE().filter(function (s) { return s.id === id; })[0]; }
  function treePart(stepId, partId) { var s = treeStep(stepId); return s ? s.parts.filter(function (p) { return p.id === partId; })[0] : null; }
  function countOf(list) { var c = list.filter(function (x) { return x.st !== 'skip'; }); return { done: c.filter(function (x) { return x.st === 'done'; }).length, n: c.length }; }
  function treeNext(list) { return list.filter(function (x) { return x.st === 'going'; })[0] || list.filter(function (x) { return x.st === 'none'; })[0] || null; }

  // ---------- evidence depth, read from the grades (3 November 2026) ----------
  // Each section and tool is graded 0 to 5. A part's depth is its weakest grade; a step's is its weakest part.
  var EVMAP = { f: { start: 'question', prompting: 'question', framing: 'question', guesses: 'question', assume: 'question', compare: 'question', question: 'question', working: 'system', how: 'system', matters: 'system', standards: 'system', protocol: null, system: 'system', line: 'line', stake: 'line', exposure: 'line' },
    d: { gather: 'dgather', form: 'dform' }, m: { works: 'mworks', fails: 'mfails', design: 'mdesign' }, t: { alpha: 'talpha', beta: 'tbeta', out: 'tout' } };
  var EVTOOL = { goright: 'dvuln', nots: 'dvuln', capitals: 'dvuln', levels: 'dvuln', dependants: 'dvuln', horizon: 'dtrig', outside: 'dtrig', isnot: 'dtrig', rca: 'dtrig', techmech: 'dtrig', people: 'dtrig', disagree: 'dexpl', howsaid: 'dexpl', rivals: 'dexpl', futures: 'dexpl', frame: 'dexpl', evframe: 'dexpl', combos: 'dexpl',
    journey: 'mmaps', blueprint: 'mmaps', process: 'mmaps', ibs: 'mmaps', systems: 'mmaps', vsm: 'mmaps', sna: 'mpeople', fram: 'mpeople', timeline: 'mpeople', bowtie: 'mpeople', faulttree: 'mpeople', accimap: 'mpeople', cmap: 'mrun', tharm: 'mrun', abm: 'mrun', interrogate: 'mfails',
    scentest: 'talpha', bia: 'talpha', risk: 'talpha', mvc: 'tplans', bcp: 'tplans', dr: 'tplans', plans: 'tplans', exlog: 'tplans', selfassess: 'tplans', pace: 'tout', steer: 'tout', forcefield: 'tout', evidence: 'tout' };
  var PSTEP = { question: 'frame', system: 'frame', line: 'frame', dgather: 'diagnose', dvuln: 'diagnose', dtrig: 'diagnose', dexpl: 'diagnose', dform: 'diagnose', mmaps: 'model', mpeople: 'model', mrun: 'model', mworks: 'model', mfails: 'model', mdesign: 'model', talpha: 'test', tplans: 'test', tbeta: 'test', tout: 'test' };
  function evPartOf(key) { var m = /^([fdmt]):(.+)$/.exec(key); if (m) return EVMAP[m[1]] ? EVMAP[m[1]][m[2]] || null : null; if (/^x:/.test(key)) return 'tbeta'; return EVTOOL[key] || null; }
  function evParts() {
    var all = evqAll(), out = {};
    Object.keys(all).forEach(function (k) { var lv = lvOf(all[k]), p = evPartOf(k); if (lv == null || !p) return; var o = out[p] = out[p] || { lv: 6, n: 0, weakest: null }; o.n++; if (lv < o.lv) { o.lv = lv; o.weakest = { key: k, label: all[k].label || k, lv: lv }; } });
    return out;
  }
  function evStepOf(stepId, EP) { EP = EP || evParts(); var s = treeStep(stepId), best = null, n = 0; s.parts.forEach(function (p) { var e = EP[p.id]; if (!e) return; n += e.n; if (!best || e.lv < best.lv) best = { lv: e.lv, part: p, weakest: e.weakest }; }); return best ? Object.assign(best, { n: n }) : null; }
  function evTarget() { var d = row('depth'); return d && d.content && d.content.level ? Number(d.content.level) : null; }
  // the second bar: evidence depth, 0 to 5, with the agreed depth marked
  function evBar(e, where) {
    var tg = evTarget(), lv = e ? e.lv : null;
    var cells = el('span', { class: 'ev-bar', role: 'img', 'aria-label': 'Evidence depth: ' + (lv == null ? 'not graded yet' : 'level ' + lv + ' of 5') }, [1, 2, 3, 4, 5].map(function (i) { return el('span', { class: 'ev-c' + (lv != null && i <= lv ? ' on q-' + qOfLv(lv) : '') + '' }); }));
    var txt = lv == null ? 'Evidence: not graded yet' : 'Evidence: level ' + lv + ' of 5, ' + EVL[lv][1].toLowerCase();
    var sub = '';
    return el('span', { class: 'ev-wrap' }, [cells, el('span', { class: 'ev-t', text: txt }), sub ? el('span', { class: 'ev-s', text: sub }) : null]);
  }
  // a task's link: frame tasks that open a section set it first
  function taskGo(t) { return function (e) { if (t.open) { FX.open = t.open; } var u = new URL(t.href, location.href); if (u.pathname === location.pathname) { e.preventDefault(); if (location.hash === u.hash) { render(); } else location.hash = u.hash; setTimeout(function () { if (t.open) { var x = document.getElementById('wk-' + t.open); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 120); } }; }
  // on a tool's own page: where it sits in the tree, and the other tasks in its part
  function decorate() {
    if (!main || main.querySelector('.tkbar') || ON_HOME || S.view === 'use') return;
    var here = location.pathname + location.hash; if (!location.hash) return;
    var hit = null; TREE().forEach(function (s) { s.parts.forEach(function (p) { p.tasks.forEach(function (t) { var u = new URL(t.href, location.href); if (!hit && u.pathname + u.hash === here) hit = { s: s, p: p, t: t }; }); }); });
    if (!hit) return;
    var crumb = el('nav', { class: 'tkcrumb no-print', 'aria-label': 'Where this is' }, [el('a', { href: hit.s.href, text: hit.s.n + ' ' + hit.s.name }), el('span', { text: '›' }), el('a', { href: hit.p.href, text: hit.p.n + ' ' + hit.p.name }), el('span', { text: '›' }), el('b', { text: hit.t.n + ' ' + hit.t.name })]);
    var wrap = el('div', { class: 'tkdeco' }, [crumb, taskBar(hit.s.id, hit.p.id, hit.t.n)]);
    main.insertBefore(wrap, main.firstChild);
  }
  // the row of tasks for one part, shown under the path at the top of the part's page
  function taskBar(stepId, partId, curN) {
    var p = treePart(stepId, partId); if (!p) return null;
    var c = countOf(p.tasks);
    if (!curN) { var here = location.pathname + location.hash, m = p.tasks.filter(function (t) { var u = new URL(t.href, location.href); return u.pathname + u.hash === here; }); if (m.length === 1) curN = m[0].n; }
    var ev = evParts()[partId];
    return el('nav', { class: 'tkbar no-print', 'aria-label': p.n + ' ' + p.name + ': its tasks', 'data-part': p.n }, [el('span', { class: 'tkhead' }, [el('b', { text: p.n + ' ' + p.name }), el('span', { text: c.done + ' of ' + c.n + ' done' }), el('span', { class: 'tkev', text: ev ? 'Evidence: level ' + ev.lv + ' of 5' : 'Evidence: not graded' })])].concat(p.tasks.map(function (t) {
      return el('a', { class: 'tk ' + t.st + (curN === t.n ? ' here' : ''), href: t.href, 'aria-current': curN === t.n ? 'page' : null, 'data-task': t.n, title: ST_N[t.st], onclick: taskGo(t) }, [el('span', { class: 'tki', 'aria-hidden': 'true', text: ST_I[t.st] }), el('span', { class: 'tkn', text: t.n }), el('span', { class: 'tkt', text: t.name }), el('span', { class: 'sr-only', text: ' (' + ST_N[t.st] + ')' })]);
    })));
  }
  // the parts of a step, as cards with progress: the step's own home page
  function partCards(stepId) {
    var EP = evParts(), s = treeStep(stepId), grid = el('div', { class: 'ph-steps ' + (s.parts.length === 4 ? 'four' : 'three'), id: { frame: 'fParts', diagnose: 'dParts', model: 'mParts', test: 'tParts' }[stepId], role: 'list' });
    s.parts.forEach(function (p) {
      var c = countOf(p.tasks), pct = c.n ? Math.round(100 * c.done / c.n) : 0, nx = treeNext(p.tasks);
      grid.appendChild(el('a', { class: 'ph-step' + (p.st === 'done' ? ' done' : p.st === 'going' ? ' going' : p.st === 'skip' ? ' off' : ''), href: p.href, role: 'listitem', 'data-part': p.id, 'data-pct': String(pct) }, [
        el('span', { class: 'ph-n', text: p.n }), el('span', { class: 'ph-name', text: p.name }), el('span', { class: 'ph-q', text: p.line }),
        el('span', { class: 'ph-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': p.name + ': ' + pct + ' per cent' }, [el('span', { class: 'ph-fill', style: 'width:' + pct + '%' })]),
        el('span', { class: 'ph-count', text: p.st === 'skip' ? 'Not used in this project' : c.done + ' of ' + c.n + ' · ' + (p.st === 'done' ? 'Complete' : p.st === 'going' ? 'In progress' : 'Not started') }),
        evBar(EP[p.id], 'part'),
        el('span', { class: 'ph-next', text: nx ? 'Next: ' + nx.n + ' ' + nx.name : 'Open ' + p.n + ' ' + p.name })]));
    });
    return grid;
  }
  // ---------- the four steps, as the project home shows them ----------
  // Each step's progress is a short list of milestones, read from the work itself. Nothing is ticked by hand.
  function stepProgress(c) {
    var ex = c.ex, out = {}, has = function (x) { return !!x; };
    // Frame: its three parts together: the question, the questions of part 2, and the system (30 October 2026)
    var FP = frameParts();
    // grouped into five, so the card reads like the other steps; each group is done when everything in it is done,
    // and "Next" names the group and the first thing still open in it (3 November 2026)
    var sk = (row('stake') || {}).content || {}, grp = function (name, items, href) { var open = items.filter(function (m) { return !m[0]; })[0]; return [items.length > 0 && !open, name + (open ? ': ' + open[1] : ''), open && open[2] && open[2].charAt(0) === '#' ? '/frame' + ex + open[2] : href, items.length]; };
    out.frame = [
      grp('The question', FP.question, '/frame' + ex + '#question'),
      grp('The question, in depth', FP.question2, '/frame' + ex + '#question'),
      grp('The system', FP.system.concat(FP.system2), '/frame' + ex + '#system'),
      grp('Who is exposed, and how', [[(sk.parties || []).filter(function (p) { return p.n; }).length > 0, 'Who is exposed', '#stake'], [(sk.cards || []).filter(function (k) { return k.n; }).length > 0, 'How exposed they are', '#exposure']], '/frame' + ex + '#stake'),
      grp('Thresholds', FP.line, '/frame' + ex + '#line')];
    // Diagnose: the evidence, then each heading of the formulation
    var A = window.VTAnalyse, n = function (sub) { if (!A || !A.FORM) return 0; var t = 0; A.FORM.filter(function (f) { return f[1].toLowerCase() === sub; }).forEach(function (f) { f[3].forEach(function (sp) { try { t += A.formEntries(sp).length; } catch (e) {} }); }); return t; };
    out.diagnose = [[(S.data.sources || []).length > 0, 'Gather the evidence', '/diagnose' + ex + '#sources'], [n('protective') > 0, 'How it works: what goes right, and why', '/diagnose' + ex + '#goright'], [n('predisposing') > 0, 'How it fails: what made it vulnerable', '/diagnose' + ex + '#tools'], [n('precipitating') > 0, 'How it fails: what triggers failure', '/diagnose' + ex + '#tools'], [n('perpetuating') > 0, 'How it fails: what keeps it going', '/diagnose' + ex + '#formulation']];
    // Model: the model run forward, then the design propositions, tested and ready
    var P = window.VTProps ? window.VTProps.counts() : { n: 0, tested: 0, ready: 0 };
    out.model = [[c.tools.some(function (t) { return t.practice === 'model' && t.used; }), 'Build and run the model', '/model' + ex], [P.n > 0, 'Write the design propositions', '/model' + ex + '#props'], [P.n > 0 && P.tested + P.ready === P.n, 'Test each one in the model', '/model' + ex + '#props'], [P.n > 0 && P.ready === P.n, 'Each ready to try in use', '/model' + ex + '#handon']];
    // Test: reports from the service, then a decision on each proposition
    var b = (row('beta') || {}).content || {}, rs = b.reports || [], bp = b.props || {}, inT = window.VTProps ? window.VTProps.items().filter(function (p) { return p.status === 'ready' || (bp[p.id] && bp[p.id].result); }) : [];
    var res = function (p) { var x = bp[p.id] || {}; return x.result === 'sentback' && p.status === 'ready' ? 'trying' : x.result || 'trying'; };
    out.test = [[rs.length > 0, 'Reports from the people who run the service', '/test' + ex + '#beta'], [inT.length > 0 && inT.every(function (p) { return rs.some(function (r) { return r.prop === p.id; }); }), 'A report on every proposition', '/test' + ex + '#beta'], [inT.length > 0 && inT.every(function (p) { return res(p) !== 'trying'; }), 'Reflect and decide on each', '/test' + ex + '#beta'], [inT.length > 0 && inT.every(function (p) { return res(p) === 'proven'; }), 'Each proven in operation', '/test' + ex + '#beta']];
    out.testWaits = !inT.length;
    return out;
  }
  function stepCards(c) {
    var pr = stepProgress(c), ex = c.ex;
    var STEPS = [['frame', 'Frame', 'What are we working on, and what is the question?', 'problem', '/frame'], ['diagnose', 'Diagnose', 'How does it work and fail now, and why?', 'analyse', '/diagnose'], ['model', 'Model', 'What would make it work better and fail better?', 'evaluate', '/model'], ['test', 'Test', 'Do the changes work in use?', 'test', '/test']];
    var grid = el('div', { class: 'ph-steps', id: 'phSteps', role: 'list' });
    var TR = TREE(), EPS = evParts();
    STEPS.forEach(function (st, i) {
      var ts = TR[i], cnt = countOf(ts.parts), done = cnt.done, pct = cnt.n ? Math.round(100 * done / cnt.n) : 0, off = !inScope(st[3]);
      var np = treeNext(ts.parts), nt = np ? treeNext(np.tasks) : null, ms = { length: cnt.n }, wait = st[0] === 'test' && pr.testWaits;
      var nx = np ? [false, np.n + ' ' + np.name + (nt ? ' › ' + nt.n + ' ' + nt.name : ''), nt ? nt.href : np.href] : null;
      var state = off ? 'Hidden for this project' : done === ms.length ? 'Complete' : wait ? 'Waits for Model' : done ? 'In progress' : 'Not started';
      var href = off ? '/project' + ex + '#scope' : st[0] === 'frame' ? '/frame' + ex : (nx && !wait ? nx[2] : st[4] + ex);
      grid.appendChild(el('a', { class: 'ph-step' + (done === ms.length ? ' done' : done ? ' going' : '') + (off ? ' off' : ''), href: href, role: 'listitem', 'data-step': st[0], 'data-pct': String(pct) }, [
        el('span', { class: 'ph-plate', 'aria-hidden': 'true' }, [el('img', { class: 'pl-l', src: '/icons/on-light/step-' + st[0] + '.svg', alt: '' }), el('img', { class: 'pl-d', src: '/icons/on-dark/step-' + st[0] + '.svg', alt: '' })]),
        el('span', { class: 'ph-n', text: 'Step 0' + (i + 1) }),
        el('span', { class: 'ph-name', text: st[1] }),
        el('span', { class: 'ph-q', text: st[2] }),
        el('span', { class: 'ph-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': st[1] + ': ' + pct + ' per cent' }, [el('span', { class: 'ph-fill', style: 'width:' + pct + '%' })]),
        el('span', { class: 'ph-count', text: off ? state : done + ' of ' + ms.length + ' · ' + state }),
        off ? null : evBar(evStepOf(st[0], EPS), 'step'),
        el('span', { class: 'ph-next', text: off ? 'Use it under Used, shown and reported' : nx && !wait ? 'Next: ' + nx[1] : wait ? 'Starts once a proposition is ready to try' : 'Open ' + st[1] })]));
    });
    return grid;
  }
  function renderWhere() {
    var s = S.data.session, ex = EXAMPLE ? '?example=' + encodeURIComponent(EXAMPLE) : '';
    var gp = window.VTGuide && window.VTGuide.progress ? window.VTGuide.progress() : null;
    var day = function (iso) { if (!iso) return ''; var d = new Date(iso), now = new Date(); return d.toDateString() === now.toDateString() ? 'today at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }); };
    var TAG = { done: ['done', 'Completed'], progress: ['prog', 'In progress'], todo: ['not', 'Not started'], wait: ['wait', 'Cannot start yet'] };
    var tick = function (st) { return st === 'done' ? el('span', { class: 'ww-tick on', 'aria-hidden': 'true', html: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M5 12l5 5 9-10"/></svg>' }) : el('span', { class: 'ww-tick ' + (st === 'progress' ? 'half' : 'no'), 'aria-hidden': 'true' }); };
    var item = function (st, name, href, line) {
      return el('div', { class: 'ww-ti' + (st === 'wait' ? ' off' : '') }, [tick(st), el('div', { class: 'n' }, [href && st !== 'wait' ? el('a', { href: href, text: name }) : el('b', { text: name }), line ? el('span', { text: line }) : null]), el('span', { class: 'ww-tag ' + TAG[st][0], text: TAG[st][1] })]);
    };
    var sect = function (title, count, items, after) { return el('div', { class: 'ww-sect' }, [el('h3', {}, [document.createTextNode(title + ' '), count ? el('small', { text: count }) : null]), el('div', { class: 'ww-tl' }, items)].concat(after || [])); };
    var wrap = el('div', { class: 'ww', id: 'whereWeAre' });
    // the project home (30 October 2026): the four steps as large buttons, each with how far it has got; the detail below
    // two pages share this (30 October 2026): the project home (/home, the header's Home inside a project), with only
    // the four steps; and Project › Where we are, with the detail
    var HOME = S.view === 'phome', cl = s.client && !/^(worked example|none|-)$/i.test(String(s.client).trim()) ? s.client : '';
    wrap.appendChild(el('p', { class: 'ww-kick', text: HOME ? ['Project home', cl].filter(Boolean).join(' · ') : [s.name, cl].filter(Boolean).join(' · ') }));
    wrap.appendChild(el('h1', { class: 'ww-h', id: HOME ? 'phName' : 'wwTitle', text: HOME ? (s.name || 'Your project') : 'Where we are' }));
    // the tasks, and the next one
    var gs = gp ? gp.parts : [], sent = !!(gp && gp.sent), nDone = gs.filter(function (x) { return x.status === 'done'; }).length;
    // a project the team has worked on the canvas, and never on the guided screens: show the canvas's five steps instead
    var CV = gp && !gp.at && !sent && teamStarted() ? canvasSteps() : null;
    var framed = sent || !!(CV && CV.all), framedWord = sent ? 'the framing is sent' : 'the frame is agreed';
    var next = null;
    if (CV) { var cn = CV.steps.filter(function (x) { return x.status !== 'done'; })[0]; if (cn) next = { title: 'Step ' + cn.n + ' of 5: ' + cn.name, line: cn.line, href: cn.href }; }
    else if (gp && !sent) { var np = gs.filter(function (x) { return x.status !== 'done'; })[0]; next = np ? { title: 'Part ' + np.part + ' of 6: ' + np.name, line: (gp.stopped && gp.part === np.part ? 'You stopped at ' + gp.stopped + '. ' : '') + 'About ' + gp.minutes + ' minutes left in the guided framing.', href: '/frame' + ex + '#guided' } : { title: 'Your framing, ready to send', line: 'Every part is answered. Read it through on one page, then send it.', href: '/frame' + ex + '#guided=framing' }; }
    var tools = window.VTAnalyse && window.VTAnalyse.status ? window.VTAnalyse.status() : [];
    var ev = null; try { if (window.VTEvidence && inScope('test')) { var er = window.VTEvidence.rows(VTX); ev = { n: er.length, at: er.filter(function (r) { return window.VTEvidence.effective(r) >= window.VTEvidence.target(r); }).length, any: er.some(function (r) { return r.level; }) }; } } catch (e) { ev = null; }
    if (!next && framed) {
      var firstA = tools.filter(function (t) { return t.practice === 'analyse' && !t.used; })[0];
      next = firstA ? { title: 'Diagnose: ' + firstA.name, line: (sent ? 'The framing has been sent.' : 'The frame is agreed on the canvas.') + ' Diagnose gathers the evidence of how the service really runs.', href: firstA.href + (ex ? '' : '') } : ev && ev.n && ev.at < ev.n ? { title: 'Test: how far the evidence goes', line: ev.at + ' of ' + ev.n + ' claims are at their target level.', href: '/test' + ex + '#evidence' } : null;
    }
    var lead = !gp ? '' : CV ? 'Frame is being worked on the canvas: ' + CV.done + ' of the 5 steps ' + (CV.done === 1 ? 'is' : 'are') + ' done.' : sent ? 'The framing was sent' + (gp.sent.by ? ' by ' + gp.sent.by : '') + (gp.sent.at ? ', ' + day(gp.sent.at) : '') + '.' : nDone || gp.at ? 'Frame is under way: ' + nDone + ' of the 6 guided parts ' + (nDone === 1 ? 'is' : 'are') + ' complete.' : 'Nothing has been answered yet.';
    var lastT = (S.data.tiles || []).filter(function (t) { return t.updated_at; }).sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); })[0];
    if (lastT) lead += ' Last change' + (lastT.updated_by ? ' by ' + lastT.updated_by : '') + ', ' + day(lastT.updated_at) + '.';
    wrap.appendChild(el('p', { class: 'ww-lede', text: lead }));
    var dmode = ((row('datamode') || {}).content || {}).mode;
    if (dmode) wrap.insertBefore(el('span', { class: 'ww-mode', id: 'wwMode', text: dmode === 'anon' ? 'Anonymised project: no names or identifying detail from the organisation' : 'Live organisation data: the organisation has agreed to our confidentiality and security terms' }), wrap.querySelector('.ww-lede'));
    if (HOME) {
      wrap.appendChild(stepCards({ gp: gp, CV: CV, sent: sent, nDone: nDone, tools: tools, ex: ex }));
      // the Lab's front door, from inside a project
      wrap.appendChild(el('div', { class: 'ph-more', id: 'phMore' }, [el('a', { href: '/project' + ex, id: 'phWhere', text: 'Where we are, in detail' }),
        EXAMPLE ? null : el('a', { href: '/hub#start', id: 'phNew', text: 'Start a new project' }), EXAMPLE ? null : el('a', { href: '/hub#open', id: 'phOpen', text: 'Open another project' }), el('a', { href: '/learn', id: 'phLearn', text: 'Learn how it works' })]));
      main.appendChild(wrap); return;
    }
    if (false && next) wrap.appendChild(el('div', { class: 'ww-next', id: 'wwNext' }, [el('div', {}, [el('span', { class: 'k', text: 'Next' }), el('b', { text: next.title }), el('span', { class: 'd', text: next.line })]), el('a', { class: 'go', id: 'wwCarry', href: next.href, text: 'Carry on →' })]));
    var col = el('div', {}), cols = el('div', { class: 'ww-cols' }, [col]);
    // the team's own tasks, from the old "Running the project" page: engagement terms, and when to stop
    var teamTask = function (id, name, waitLine) {
      if (!tileDef(id)) return null;
      var st = stateOf(id), r = row(id), m = { done: 'done', skip: 'done', partly: 'progress', reopened: 'progress' }[st] || (waitLine ? 'wait' : 'todo');
      var it = item(m, name, '/project' + ex + '#tile=' + id, r && r.summary ? r.summary : m === 'wait' ? waitLine : (tileDef(id).q || ''));
      it.querySelector('.n').appendChild(el('span', { class: 'ww-team', text: 'Team only' }));
      return it;
    };
    var setup = teamTask('engage', 'Engagement terms');
    col.appendChild(sect('Set-up', '', [dataTask(), setup]));
    // Frame
    if (CV) {
      var citems = CV.steps.map(function (x) { return item(x.status, x.n + '. ' + x.name, x.href, x.status === 'done' ? '' : x.line); });
      var cstop = teamTask('stop', 'When to stop: is the frame good enough to move on?', CV.all ? null : 'Once the frame is agreed'); if (cstop) citems.push(cstop);
      var cused = PVIS().filter(function (t) { return stateOf(t.id) !== 'skip'; }), cbd = cused.filter(function (t) { return stateOf(t.id) === 'done'; });
      col.appendChild(sect('Frame', CV.done + (cstop && /ww-tag done/.test(cstop.innerHTML) ? 1 : 0) + ' of ' + citems.length + ' complete', citems, [el('p', { class: 'ww-muted' }, ['On the canvas: ' + cbd.length + ' of ' + cused.length + ' boxes done. ', el('a', { href: '/frame' + ex + '#canvas', id: 'wwCanvas', text: 'Open the canvas' })])]));
    }
    else if (gp) {
      var items = gs.map(function (x) {
        return item(x.status, x.part + '. ' + x.name, '/frame' + ex + '#guided=' + x.step, x.status === 'todo' ? '' : [x.by ? x.by + (x.at ? ', ' + day(x.at) : '') : '', x.notsure ? x.notsure + (x.notsure === 1 ? ' answer' : ' answers') + ' marked "not sure"' : ''].filter(Boolean).join(' · '));
      });
      items.push(item(sent ? 'done' : nDone === 6 ? 'todo' : 'wait', 'Send the framing', '/frame' + ex + '#guided=framing', sent ? '' : nDone === 6 ? 'Read it on one page, then send it' : 'Once every part is answered'));
      var stop = teamTask('stop', 'When to stop: is the frame good enough to move on?', sent ? null : 'Once the framing is sent'); if (stop) items.push(stop);
      var used = PVIS().filter(function (t) { return stateOf(t.id) !== 'skip'; }), bd = used.filter(function (t) { return stateOf(t.id) === 'done'; });
      col.appendChild(sect('Frame', (nDone + (sent ? 1 : 0) + (stop && /ww-tag done/.test(stop.innerHTML) ? 1 : 0)) + ' of ' + items.length + ' complete', items, [el('p', { class: 'ww-muted' }, ["The team's canvas: " + bd.length + ' of ' + used.length + ' boxes done. ', el('a', { href: '/frame' + ex + '#canvas', id: 'wwCanvas', text: 'Open the canvas' })])]));
    }
    // Diagnose, Model and Test: the tools switched on for this project
    var PATH = { analyse: '/diagnose', model: '/model', test: '/test' };
    var tl = function (pr, title) {
      var all = tools.filter(function (t) { return t.practice === pr; }), used = all.filter(function (t) { return t.used; }), rest = all.filter(function (t) { return !t.used; });
      var list = used.map(function (t) { return item('progress', t.name, t.href + ex, 'Work saved in it'); });
      if (pr === 'model' && window.VTProps) { var pc = window.VTProps.counts(); list.unshift(item(pc.n && pc.ready === pc.n ? 'done' : pc.n ? 'progress' : 'todo', 'Design propositions', '/model' + ex + '#props', pc.n ? pc.n + (pc.n === 1 ? ' proposition: ' : ' propositions: ') + pc.tested + ' tested in the model, ' + pc.ready + ' ready to try in use' : 'Each answers an entry in the formulation, and is tested in the model')); }
      if (pr === 'test' && window.VTBeta) { var bc = window.VTBeta.counts(); if (bc.n) list.unshift(item(bc.n && bc.proven === bc.n ? 'done' : bc.reports ? 'progress' : 'todo', 'Trial in the organisation (beta)', '/test' + ex + '#beta', bc.n + (bc.n === 1 ? ' proposition' : ' propositions') + ' in use, ' + bc.reports + (bc.reports === 1 ? ' report' : ' reports') + ', ' + bc.proven + ' proven in operation' + (bc.back ? ', ' + bc.back + ' sent back' : ''))); }
      if (pr === 'test' && ev) list.unshift(item(ev.n && ev.at === ev.n ? 'done' : ev.any ? 'progress' : 'todo', 'How far the evidence goes', '/test' + ex + '#evidence', ev.n ? ev.at + ' of ' + ev.n + ' claims at their target level' : 'The claims come from the framing answers'));
      var waiting = pr === 'analyse' && !framed && !used.length;
      if (waiting) list = [item('wait', title + ' starts once ' + framedWord, null, rest.length + (rest.length === 1 ? ' tool' : ' tools') + ' switched on for this project')];
      if (!list.length && !rest.length) return;
      var after = !waiting && rest.length ? [el('p', { class: 'ww-muted' }, [(list.length ? rest.length + ' more' : rest.length) + (rest.length === 1 ? ' tool' : ' tools') + ' switched on, not started: ' + rest.slice(0, 4).map(function (t) { return t.name; }).join(', ') + (rest.length > 4 ? ' and ' + (rest.length - 4) + ' more' : '') + '. ', el('a', { href: PATH[pr] + ex, text: 'Open ' + title })])] : [];
      if (!list.length) { col.appendChild(el('div', { class: 'ww-sect' }, [el('h3', {}, [document.createTextNode(title + ' '), el('small', { text: 'not started' })])].concat(after))); return; }
      col.appendChild(sect(title, waiting ? 'not started yet' : used.length + (pr === 'test' && ev && ev.any ? 1 : 0) + (pr === 'model' && window.VTProps && window.VTProps.counts().n ? 1 : 0) + ' in progress', list, after));
    };
    if (inScope('analyse')) tl('analyse', 'Diagnose');
    if (inScope('evaluate')) tl('model', 'Model');
    if (inScope('test')) tl('test', 'Test');
    col.appendChild(finishSect());
    var left = [['analyse', 'Diagnose'], ['evaluate', 'Model'], ['test', 'Test'], ['model', 'the maps of the system']].filter(function (x) { return !inScope(x[0]); }).map(function (x) { return x[1]; });
    if (left.length) col.appendChild(el('p', { class: 'ww-muted', text: 'Left out of this project (under What’s included): ' + left.join(', ') + '.' }));
    // the side: recent changes, to follow up, people
    var side = el('div', { class: 'ww-side' });
    var recent = (S.data.tiles || []).filter(function (t) { return t.updated_at && t.tile_key !== 'depth'; }).sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); }).slice(0, 5);
    if (recent.length) side.appendChild(el('div', { class: 'ww-card' }, [el('h4', { text: 'Recent changes' }), el('div', { class: 'ww-feed' }, recent.map(function (t) { return el('div', {}, [el('span', { text: (t.updated_by ? t.updated_by + ': ' : '') + String(t.summary || ({ publish: 'Finishing the project', datamode: 'Organisation data', depth: 'Depth', scope: 'What’s included', evidence: 'The evidence', frame: 'Frame', toolkit: 'Tools', cmap: 'The connected map', inventory: 'The model' })[t.tile_key] || (tileDef(t.tile_key) || {}).name || t.tile_key).replace(/^Guided framing: ([a-z0-9]+)$/, function (m, id) { return 'Guided framing, ' + (window.VTGuide ? window.VTGuide.label(id) : id); }) }), el('time', { text: day(t.updated_at) })]); }))]));
    var fol = [];
    if (gp && gp.notsure) fol.push(gp.notsure + (gp.notsure === 1 ? ' answer' : ' answers') + ' marked "not sure" in the guided framing');
    var tq = openQs().filter(function (q) { return q.from_practice === 'test'; }).length, oq = openQs().length - tq;
    if (tq) fol.push(tq + (tq === 1 ? ' question' : ' questions') + ' sent back from Test to look at again in Frame');
    if (oq) fol.push(oq + (oq === 1 ? ' question' : ' questions') + ' put to colleagues, still open');
    side.appendChild(el('div', { class: 'ww-card' }, [el('h4', { text: 'To follow up' }), fol.length ? el('ul', {}, fol.map(function (t) { return el('li', { text: t }); })) : el('p', { class: 'ww-muted', text: 'Nothing waiting.' })]));
    if (!EXAMPLE && (creds && (creds.member || creds.master))) side.appendChild(el('div', { class: 'ww-card' }, [el('h4', { text: 'People' }), el('a', { href: '/hub#people', id: 'wwPeople', text: 'People on this project' })]));
    cols.appendChild(side);
    wrap.appendChild(cols);
    main.appendChild(wrap);
  }

  // ---------- the board ----------
  function renderBoard() {
    var s = S.data.session;
    var used = PVIS().filter(function (t) { return stateOf(t.id) !== 'skip'; }), done = used.filter(function (t) { return stateOf(t.id) === 'done'; });
    var nq = openQs().length;
    // one quiet line: where things stand, and how the tiles are arranged
    var seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Arrange the tiles by' });
    [['group', 'Six parts'], ['who', 'Who takes part'], ['state', 'State']].forEach(function (a) {
      seg.appendChild(el('button', { text: a[1], 'aria-pressed': String(S.arr === a[0]), onclick: function () { S.arr = a[0]; render(); } }));
    });
    main.appendChild(el('div', { class: 'btop' }, [
      el('div', {}, [el('p', { class: 'kick', text: s.name || 'Frame' }), el('h1', { class: 'wide', text: 'Frame' })]),
      el('div', { class: 'bside' }, [el('span', { class: 'prog', text: done.length + ' of ' + used.length + ' done' + (nq ? '  ·  ' + nq + (nq === 1 ? ' question open' : ' questions open') : '') }), seg])
    ]));
    if (!(S.data.tiles || []).length) {
      main.appendChild(el('div', { class: 'start' }, [
        el('p', { text: 'Nothing has been worked yet. Open any tile to start, or load a worked case to see one filled in: Maylands, or Friendly Fire (a published case, built from public sources).' }),
        el('button', { class: 'btn warm', text: 'Load the Maylands worked case', onclick: function () { loadExample('maylands'); } }),
        ffButton('btn warm'), moreCases('btn warm')
      ]));
    }
    var cols;
    if (S.arr === 'who') cols = Object.keys(WHO).map(function (k) { return { name: WHO[k][0], d: WHO[k][1], list: PVIS().filter(function (t) { return t.who === k; }) }; });
    else if (S.arr === 'state') cols = [['done', 'Done'], ['partly', 'Partly done, or reopened'], ['none', 'Not started'], ['skip', 'Not used']].map(function (x) { return { name: x[1], d: '', list: PVIS().filter(function (t) { var st = stateOf(t.id); return x[0] === 'partly' ? (st === 'partly' || st === 'reopened') : st === x[0]; }) }; });
    else cols = PG.map(function (g) { return { id: g.id, sn: g.sn, name: g.name, d: g.d, group: true, list: VIS().filter(function (t) { return t.g === g.id; }) }; });
    var wrap = el('div', { class: 'cols' + (S.arr === 'group' ? ' six' : '') });
    cols.forEach(function (c, ci) {
      var stEl = null;
      if (c.group) {
        var inUse = c.list.filter(function (t) { return stateOf(t.id) !== 'skip'; });
        var started = inUse.filter(function (t) { return stateOf(t.id) !== 'none'; }).length, agreed = inUse.length && inUse.every(function (t) { return stateOf(t.id) === 'done'; });
        var word = agreed ? 'Agreed for now' : started ? 'In progress' : 'Not started';
        stEl = el('i', { class: 'dot ' + (agreed ? 'done' : started ? 'partly' : 'none'), title: word });
      }
      var dsc = c.d ? el('div', { class: 'd', hidden: true, text: c.d }) : null;
      var dtog = c.d ? el('button', { class: 'plus', 'aria-expanded': 'false', 'aria-label': 'What this part covers', text: '+', onclick: function () {
        var open = dsc.hidden; dsc.hidden = !open; dtog.textContent = open ? '\u2212' : '+'; dtog.setAttribute('aria-expanded', String(open)); } }) : null;
      var col = el('div', { class: 'col' }, [
        el('div', { class: 'chead' }, [el('span', { class: 'num', text: '0' + (ci + 1) }), stEl]),
        el('div', { class: 'ctitle' }, [el('h3', { class: 'wide', text: c.name.replace(/^\d\.\s*/, '') }), dtog]), dsc,
        c.group ? el('div', { class: 'pv4' }, [
          el('button', { class: 'sumtab', 'data-pv': 'summary', 'data-summary': c.id, text: 'Summary', onclick: function () { go('summary=' + c.id); } }),
          el('button', { class: 'sumtab', 'data-pv': 'tools', text: 'Tools', onclick: function () { go('tools=' + c.id); } }),
          el('button', { class: 'sumtab', 'data-pv': 'analysis', text: 'Analysis', onclick: function () { go('analysis=' + c.id); } })]) : null]);
      c.list.forEach(function (t) { col.appendChild(tileCard(t)); });
      wrap.appendChild(col);
    });
    main.appendChild(wrap);
    // the rest, kept quiet
    var foot = el('div', { class: 'bfoot' }, [
      (S.data.tiles || []).length ? el('button', { class: 'quiet', text: 'Load the Maylands worked case', onclick: function () { loadExample('maylands'); } }) : null,
      (S.data.tiles || []).length ? ffButton('quiet') : null,
      (S.data.tiles || []).length ? moreCases('quiet') : null,

      el('span', { style: 'flex:1' })
    ]);
    ['done', 'partly', 'none', 'reopened', 'skip'].forEach(function (k) { foot.appendChild(el('span', { class: 'kk' }, [el('i', { class: 'dot ' + k }), document.createTextNode(WORDS[k])])); });
    main.appendChild(foot);
  }
  // ---------- one subsection's summary page ----------
  function renderSummary() {
    var g = groupDef(S.key), list = VIS().filter(function (t) { return t.g === g.id; });
    main.appendChild(partTabs(g.id, 'summary')); main.appendChild(el('div', { class: 'row no-print', style: 'justify-content:flex-end;margin:-6px 0 8px' }, [el('button', { class: 'btn sm', text: 'Print this page', onclick: function () { window.print(); } })]));
    head(S.data.session.name || 'Frame', g.sn + ' summary', g.d);
    var box = el('div', { class: 'panel sumlist' }), tbox = null;
    list.forEach(function (t) {
      var host = box;
      if (t.team) { if (!tbox) { tbox = el('div', { class: 'panel sumlist teamside' }, [el('div', { class: 'label', text: 'Team only: not shown to the organisation' })]); } host = tbox; }
      var r = row(t.id), st = stateOf(t.id), nq = openQs(t.id).length;
      host.appendChild(el('div', { class: 'srow' }, [
        el('div', { class: 'sh' }, [el('a', { href: '#tile=' + t.id, class: 'sn', text: t.name }), el('span', { class: 'row', style: 'gap:10px;flex-wrap:nowrap' }, [nq ? el('span', { class: 'badge', title: 'Questions open', text: String(nq) }) : null, chip(st)])]),
        el('p', { class: r && r.summary ? 'sv' : 'sv empty', text: r ? (st === 'skip' ? notUsed(r) : (r.summary || 'Worked, but no summary written yet.')) : 'Not started. ' + t.q })
      ]));
    });
    main.appendChild(box); if (tbox) main.appendChild(tbox);
    var last = (S.data.tiles || []).filter(function (x) { return list.some(function (t) { return t.id === x.tile_key; }); }).map(function (x) { return x.updated_at; }).sort().pop();
    main.appendChild(el('p', { class: 'meta', style: 'margin-top:12px', text: last ? 'Last changed ' + when(last) + '. Work in progress: later practices can send questions back.' : 'Nothing written yet.' }));
  }
  function tileCard(t) {
    var r = row(t.id), st = stateOf(t.id), nq = openQs(t.id).length;
    var sum = r ? (st === 'skip' ? notUsed(r) : r.summary) : '';
    var more = el('div', { class: 'more', hidden: true }, [el('div', { text: t.q }), sum ? el('div', { class: 'now', text: sum }) : null]);
    var tog = el('button', { class: 'plus', 'aria-expanded': 'false', 'aria-label': 'More about ' + t.name, text: '+', onclick: function (ev) {
      ev.stopPropagation(); var open = more.hidden; more.hidden = !open; tog.textContent = open ? '−' : '+'; tog.setAttribute('aria-expanded', String(open));
    } });
    var card = el('div', { class: 'tile' + (st === 'skip' ? ' skip' : ''), 'data-tile': t.id, role: 'button', tabindex: '0', onclick: function () { go('tile=' + t.id); } }, [
      el('div', { class: 'nm' }, [el('span', { class: 'tn' }, [document.createTextNode(t.name), t.team ? el('span', { class: 'team', text: 'Team only' }) : null]), el('span', { class: 'tr' }, [nq ? el('span', { class: 'badge', title: 'Questions open on this tile', text: String(nq) }) : null, el('i', { class: 'dot ' + st, title: WORDS[st] }), tog])]),
      more
    ]);
    card.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); go('tile=' + t.id); } });
    return card;
  }
  function ffButton(cls) { return el('button', { class: cls + ' ffcase', text: 'Load the Friendly Fire worked case', title: 'A published case, built from public sources', onclick: function () { loadExample('friendlyfire'); } }); }
  // the further worked cases: names only here; their content is kept on the server. The private example shows only to David (master).
  function moreCases(cls) {
    var list = (D.cases || []).filter(function (c) { return ['maylands', 'friendlyfire'].indexOf(c.key) < 0 && (!c.masterOnly || S.data.as === 'master'); });
    return el('span', { class: 'row morecases' }, list.map(function (c) { return el('button', { class: cls + (c.masterOnly ? ' teamonly' : ''), 'data-case': c.key, text: 'Load ' + c.name, title: c.label, onclick: function () { loadExample(c.key); } }); }));
  }
  var CASES = { maylands: 'the Maylands worked case', friendlyfire: 'the Friendly Fire worked case (a published case, built from public sources)' };
  (D.cases || []).forEach(function (c) { if (!CASES[c.key]) CASES[c.key] = 'the worked case ' + c.name; });
  async function loadExample(which) {
    var key = CASES[which] ? which : 'maylands';
    var replace = (S.data.tiles || []).length > 0;
    if (replace && !confirm('This replaces what is in the tiles now with ' + CASES[key] + '. The current wording stays in each tile’s versions. Carry on?')) return;
    // reload in full, so the header's depth and what is shown follow the case
    try { await api({ action: 'p_example', case: key, replace: replace }); await load(); }
    catch (e) { alert(e.message); }
  }

  // ---------- one tile ----------
  // Problem keeps what is declared; the evidence that tests it is gathered in Diagnose.
  var SPLIT = { who: ['dependants', 'Profiling each group from the evidence (what they would do, whether the loss can be put back, shared roots, the worst-off) is in Diagnose.'], purpose: ['frame', 'Purpose as it actually works, from what people do, is checked in Diagnose.'], jobs: ['frame', 'Counting the demand behind the jobs, and the demand the service’s own failures cause, is in Diagnose.'], ibs: ['frame', 'Reading the organisation’s own register of important business services is in Diagnose.'], threshold: ['frame', 'The thresholds revealed by what has been tolerated are found in Diagnose.'], firstview: ['frame', 'The type of challenge is revised in Diagnose once the evidence is in.'], how: ['frame', 'What already works unusually well is gathered in Diagnose.'], problem: ['outside', 'Searching for the same problem elsewhere (inquiries, regulators, research) is in Diagnose.'] };
  function splitNote(t) { var x = SPLIT[t.id]; if (!x) return null; return el('div', { class: 'glass splitnote no-print', 'data-split': x[0] }, [el('span', { text: 'Here: what is declared. ' + x[1] }), el('a', { class: 'btn sm', href: '/diagnose#' + x[0], text: 'Open in Diagnose' })]); }
  function renderTile() {
    var t = tileDef(S.key), g = groupDef(t.g), r = row(t.id);
    S.base = r ? r.version : null;
    S.draft = { status: r ? r.status : 'none', summary: r ? (r.summary || '') : '', skip_reason: r ? (r.skip_reason || '') : '', blocks: clone(r && r.content && r.content.blocks && r.content.blocks.length ? r.content.blocks : D.template[t.id]) };
    main.appendChild(el('div', { class: 'spread no-print' }, [t.g === 'e' ? el('button', { class: 'btn sm', text: '← Where we are', onclick: function () { if (ON_PROJECT) go('where'); else location.href = '/project'; } }) : el('button', { class: 'btn sm', text: '← The frame', onclick: function () { go('canvas'); } }), navNext(t)]));
    main.appendChild(el('p', { class: 'crumb', style: 'margin-top:22px', text: 'Problem  ›  ' + g.name.replace(/^\d\.\s*/, '') }));
    main.appendChild(el('h1', { class: 'wide tname' }, [document.createTextNode(t.name), t.team ? el('span', { class: 'team', text: 'Team only' }) : null]));
    main.appendChild(el('div', { class: 'tq', text: t.q }));
    var sn0 = splitNote(t); if (sn0) main.appendChild(sn0);
    var lay = el('div', { class: 'tlay' }), L = el('div', { class: 'tmain' }), SD = el('aside', { class: 'tside' });
    lay.appendChild(L); lay.appendChild(SD);
    main.appendChild(el('div', { class: 'meta', text: 'Tool: ' + t.tool + '.  Who takes part: ' + WHO[t.who][0].toLowerCase() + '.' + (coreText(t) ? '  ' + coreText(t) + '.' : '') }));

    // state and summary
    var reason = el('div', { hidden: S.draft.status !== 'skip' }, [inp(S.draft.skip_reason, function (v) { S.draft.skip_reason = v; }, 'Why this tile is not used in this engagement')]);
    var sel = el('select', { 'aria-label': 'State of this tile' });
    Object.keys(WORDS).forEach(function (k) { sel.appendChild(el('option', { value: k, text: WORDS[k] })); });
    sel.value = S.draft.status;
    sel.addEventListener('change', function () { S.draft.status = sel.value; reason.hidden = sel.value !== 'skip'; dirty(); });
    main.appendChild(lay);
    SD.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'grid2' }, [
      el('span', { class: 'label', text: 'State' }), el('div', { class: 'row' }, [sel, reason]),
      el('span', { class: 'label', text: 'For the frame page' }), ta(S.draft.summary, function (v) { S.draft.summary = v; }, 'One or two lines: what this tile now says', 2)
    ])]));

    var room = el('div', { id: 'room' }); SD.appendChild(room); roomPanel(t, room);
    var qhost = el('div', { id: 'qs' }); SD.appendChild(qhost); questionsPanel(t, qhost);
    seedPanel(t, SD);

    var body = el('div', { id: 'blocks' });
    S.draft.blocks.forEach(function (b, i) { body.appendChild(blockView(b, i, true, t.id)); });
    L.appendChild(body);
    L.appendChild(el('div', { class: 'row no-print', style: 'margin-top:18px' }, [el('button', { class: 'btn sm', text: 'Add a note', onclick: function () { S.draft.blocks.push({ type: 'note', text: '' }); dirty(); body.appendChild(blockView(S.draft.blocks[S.draft.blocks.length - 1], S.draft.blocks.length - 1, true, t.id)); } })]));
    saveMsg.className = 'msg'; saveMsg.textContent = r ? 'Version ' + r.version + ', saved ' + when(r.updated_at) + ' by ' + (r.updated_by || 'the facilitator') : 'Not saved yet';
    saveBtn.onclick = saveTile;
    document.getElementById('hist').hidden = false;
    document.getElementById('hist').onclick = function () { history(t); };
  }
  function navNext(t) {
    var V = VIS().filter(function (x) { return (x.g === 'e') === (t.g === 'e'); }), i = V.indexOf(t), p = V[i - 1], n = V[i + 1];
    return el('div', { class: 'row' }, [
      p ? el('button', { class: 'btn sm', text: '‹ ' + p.name, onclick: function () { go('tile=' + p.id); } }) : null,
      n ? el('button', { class: 'btn sm', text: n.name + ' ›', onclick: function () { go('tile=' + n.id); } }) : null
    ]);
  }
  async function saveTile() {
    if (S.busy) return;
    if (S.draft.status === 'skip' && !String(S.draft.skip_reason || '').trim()) { saveMsg.className = 'msg bad'; saveMsg.textContent = 'Say why this tile is not used before saving.'; return; }
    S.busy = true; saveBtn.disabled = true;
    try {
      var d = await api({ action: 'p_save', tile_key: S.key, status: S.draft.status, summary: S.draft.summary, skip_reason: S.draft.skip_reason, base_version: S.base, content: { blocks: S.draft.blocks } });
      var list = S.data.tiles.filter(function (x) { return x.tile_key !== S.key; }); list.push(d.tile); S.data.tiles = list;
      S.base = d.tile.version;
      clean('Saved as version ' + d.tile.version + ' at ' + when(d.tile.updated_at));
    } catch (e) {
      saveMsg.className = 'msg bad'; saveMsg.textContent = e.message;
      if (e.status === 409 && /Someone else/.test(e.message)) {
        var b = el('button', { class: 'btn sm', text: 'Reload this tile', onclick: async function () { S.dirty = false; S.data = await api({ action: 'p_load' }); route(); } });
        saveMsg.appendChild(document.createTextNode(' ')); saveMsg.appendChild(b);
      }
    }
    S.busy = false; saveBtn.disabled = false;
  }

  function questionsPanel(t, host) {
    host.innerHTML = '';
    var qs = (S.data.questions || []).filter(function (q) { return q.tile_key === t.id; });
    var box = el('div', { class: 'panel sent' }, [el('h4', { text: qs.length ? 'Questions on this tile' : 'Questions on this tile: none yet' })]);
    qs.forEach(function (q) {
      var stSel = el('select', {}); Object.keys(QSTATE).forEach(function (k) { stSel.appendChild(el('option', { value: k, text: QSTATE[k] })); }); stSel.value = q.status;
      var ans = el('input', { type: 'text', value: q.answer || '', placeholder: 'How it was dealt with' });
      var m = el('span', { class: 'msg' });
      box.appendChild(el('div', { style: 'padding:10px 0;border-top:1px solid rgba(var(--hi),.08)' }, [
        el('div', { style: 'font-weight:700;line-height:1.4', text: (q.from_practice && q.from_practice !== 'problem' ? 'Sent back from ' + q.from_practice.charAt(0).toUpperCase() + q.from_practice.slice(1) + ': ' : 'Raised here: ') + q.text }),
        q.why ? el('div', { class: 'meta', style: 'margin:4px 0 8px', text: q.why }) : null,
        el('div', { class: 'row' }, [stSel, el('div', { style: 'flex:1;min-width:220px' }, [ans]), el('button', { class: 'btn sm', text: 'Save', onclick: async function () {
          try { await api({ action: 'p_question_set', id: q.id, status: stSel.value, answer: ans.value }); q.status = stSel.value; q.answer = ans.value; m.className = 'msg good'; m.textContent = 'Saved'; }
          catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
        } }), m])
      ]));
    });
    var nq = el('input', { type: 'text', placeholder: 'Raise a question on this tile' }), mm = el('span', { class: 'msg' });
    box.appendChild(el('div', { class: 'row no-print', style: 'margin-top:10px' }, [el('div', { style: 'flex:1;min-width:240px' }, [nq]), el('button', { class: 'btn sm', text: 'Add', onclick: async function () {
      if (!nq.value.trim()) return;
      try { var d = await api({ action: 'p_question_add', tile_key: t.id, text: nq.value }); S.data.questions.push(d.question); questionsPanel(t, host); }
      catch (e) { mm.className = 'msg bad'; mm.textContent = e.message; }
    } }), mm]));
    host.appendChild(box);
  }
  function seedPanel(t, host) {
    var map = SEEDS[t.id], sr = row('sheet'), sh = sr && sr.content && sr.content.sheet;
    if (!map || !sh) return;
    var box = el('div', { class: 'panel seed' }, [el('h4', { text: 'From the problem summary' })]);
    map.forEach(function (m) {
      var v = sh[m[0]]; if (!v || (Array.isArray(v) && !v.length)) return;
      var txt = Array.isArray(v) ? v.map(function (x) { return Array.isArray(x) ? x[0] + ' (' + x[1] + ')' : x; }).join('; ') : v;
      box.appendChild(el('div', { style: 'padding:4px 0;line-height:1.45' }, [el('span', { class: 'label', text: m[1] + ':  ' }), document.createTextNode(txt)]));
    });
    host.appendChild(box);
  }

  // ---------- differing views on a tile ----------
  function roundFor(k) { return (S.data.rounds || []).filter(function (r) { return r.tile_key === k && r.status !== 'closed'; })[0]; }
  function roomPanel(t, host) {
    host.innerHTML = '';
    var r = roundFor(t.id), box = el('div', { class: 'room no-print' });
    var m = el('span', { class: 'msg' });
    if (!r) {
      var p = el('textarea', { rows: 2, value: t.q, 'aria-label': 'The question for the room' });
      box.appendChild(el('h4', { style: 'margin:0 0 6px', text: 'Ask the room' }));
      box.appendChild(el('p', { class: 'meta', style: 'margin:0 0 10px', text: 'Each person writes alone on their phone. Nobody sees anyone else’s answer until you reveal them, so the differences show. ' + S.data.joined + ' joined.' }));
      box.appendChild(p);
      box.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn warm', text: 'Put this to the room', onclick: async function () {
        try { await api({ action: 'p_round_open', tile_key: t.id, prompt: p.value }); await refreshRounds(); roomPanel(t, host); poll(); }
        catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
      } }), m]));
    } else {
      box.appendChild(el('h4', { style: 'margin:0 0 6px', text: r.status === 'open' ? 'Put to the room: people are writing' : 'Put to the room: revealed' }));
      box.appendChild(el('p', { style: 'margin:0 0 8px;font-weight:700', text: r.prompt }));
      box.appendChild(el('p', { class: 'meta', style: 'margin:0', text: r.count + ' of ' + S.data.joined + ' have written.' }));
      if (r.status === 'revealed') {
        var ul = el('ul', { class: 'ans' });
        r.answers.forEach(function (a) {
          ul.appendChild(el('li', {}, [el('span', { text: a }), el('button', { class: 'btn sm', text: 'Add to the tile', onclick: function () { addNote('From the room: ' + a); } })]));
        });
        if (!r.answers.length) ul.appendChild(el('li', { text: 'Nobody wrote an answer.' }));
        box.appendChild(ul);
      }
      box.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [
        r.status === 'open' ? el('button', { class: 'btn warm', text: 'Reveal the answers', onclick: async function () { await api({ action: 'p_round_reveal', round_id: r.id }); await refreshRounds(); roomPanel(t, host); } }) : null,
        el('button', { class: 'btn', text: r.status === 'open' ? 'Stop without revealing' : 'Close this question', onclick: async function () { await api({ action: 'p_round_close', round_id: r.id }); await refreshRounds(); roomPanel(t, host); } }),
        r.status === 'open' ? el('button', { class: 'btn', text: 'Refresh', onclick: async function () { await refreshRounds(); roomPanel(t, host); } }) : null
      ]));
    }
    host.appendChild(box);
  }
  function addNote(text) {
    S.draft.blocks.push({ type: 'note', text: text }); dirty();
    var body = document.getElementById('blocks');
    if (body) body.appendChild(blockView(S.draft.blocks[S.draft.blocks.length - 1], S.draft.blocks.length - 1, true, S.key));
  }
  async function refreshRounds() { try { var d = await api({ action: 'p_load' }); S.data.rounds = d.rounds; S.data.joined = d.joined; } catch (e) {} }
  var pollT = 0;
  function poll() {
    clearTimeout(pollT);
    pollT = setTimeout(async function () {
      var open = (S.data.rounds || []).some(function (r) { return r.status === 'open'; });
      if (!open) return;
      await refreshRounds();
      var host = document.getElementById('room');
      if (S.view === 'tile' && host) roomPanel(tileDef(S.key), host);
      if (S.view === 'views') render();
      poll();
    }, 5000);
  }

  // ---------- blocks ----------
  function blockView(b, i, edit, tileId) {
    var wrap = el('div', { class: 'blk ' + b.type + (b.unknown ? ' unknown' : '') });
    var bodyEl = el('div', { class: 'body' });
    wrap.appendChild(bodyEl);
    var fill = {
      guide: function () {
        if (b.h) bodyEl.appendChild(el('h3', { text: b.h })); if (b.s) bodyEl.appendChild(el('p', { text: b.s }));
        if (b.more) {
          var mp = el('p', { class: 'gmore', hidden: true, text: b.more });
          var mt = el('button', { class: 'gplus no-print', 'aria-expanded': 'false', text: '+ Examples', onclick: function () { var o = mp.hidden; mp.hidden = !o; mt.textContent = o ? '\u2212 Examples' : '+ Examples'; mt.setAttribute('aria-expanded', String(o)); } });
          bodyEl.appendChild(mt); bodyEl.appendChild(mp);
        }
      },
      note: function () { bodyEl.appendChild(edit ? ta(b.text, function (v) { b.text = v; }, 'Note', 2) : el('p', { style: 'line-height:1.5', text: b.text })); },
      quote: function () { quoteView(b, bodyEl, edit, tileId, wrap, i); },
      cards: function () { cardsView(b, bodyEl, edit); },
      grid: function () { gridView(b, bodyEl, edit, tileId); },
      quad: function () { quadView(b, bodyEl, edit); },
      bars: function () { barsView(b, bodyEl, edit); }
    }[b.type];
    if (fill) fill();
    if (b.type !== 'guide') {
      if (edit) {
        var who2 = el('input', { type: 'text', value: (b.unknown && b.unknown.by) || '', placeholder: 'Who said it is not known' });
        var cb = el('input', { type: 'checkbox', checked: !!b.unknown });
        cb.addEventListener('change', function () { b.unknown = cb.checked ? { by: who2.value } : null; wrap.classList.toggle('unknown', cb.checked); who2.hidden = !cb.checked; dirty(); });
        who2.addEventListener('input', function () { if (b.unknown) b.unknown.by = who2.value; dirty(); });
        who2.hidden = !b.unknown;
        wrap.appendChild(el('label', { class: 'unk no-print' }, [cb, document.createTextNode('Not known'), who2]));
      } else if (b.unknown) wrap.appendChild(el('div', { class: 'unk', text: 'Not known' + (b.unknown.by ? ', said by ' + b.unknown.by : '') }));
    }
    return wrap;
  }
  function quoteView(b, host, edit, tileId, wrap, i) {
    if (b.locked || !edit) {
      host.appendChild(el('div', { class: 'locked', text: b.text || 'Not written yet' }));
      host.appendChild(el('div', { class: 'meta', style: 'margin-top:6px', text: (b.by ? b.by : '') + (b.locked ? (b.by ? '.  ' : '') + 'Locked as said: these words cannot be changed.' : '') }));
      return;
    }
    host.appendChild(ta(b.text, function (v) { b.text = v; }, tileId === 'question' ? 'The sponsor’s words, exactly as said' : 'The words, exactly as said', 3));
    host.appendChild(el('div', { style: 'margin-top:8px' }, [inp(b.by, function (v) { b.by = v; }, 'Who said it, and when')]));
    if (tileId === 'question') host.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn sm warm', text: 'Lock as said', onclick: function () {
      if (!String(b.text || '').trim()) return alert('Write the words first.');
      if (!confirm('Once saved, these words can never be changed. Lock them?')) return;
      b.locked = true; dirty(); var nw = blockView(b, i, true, tileId); wrap.replaceWith(nw);
    } }), el('span', { class: 'meta', text: 'Locks the words when you next save.' })]));
  }
  function cardsView(b, host, edit) {
    var n = Math.min(b.cols || 3, 4); if (b.items.length > 4 && n < 3) n = 3; if ((b.cols || 0) > 4) n = 3;
    var g = el('div', { class: 'cards', style: 'grid-template-columns:repeat(' + n + ',minmax(0,1fr))' });
    function draw() {
      g.innerHTML = '';
      b.items.forEach(function (c, j) {
        if (!edit) {
          g.appendChild(el('div', { class: 'card' + (c.on ? ' on' : '') }, [el('b', { text: c.t }), c.d ? el('div', { style: 'white-space:pre-line;line-height:1.45;color:rgba(var(--tx),.85)', text: c.d }) : null, c.tag ? el('span', { class: 'meta', text: c.tag }) : null]));
          return;
        }
        var on = el('input', { type: 'checkbox', checked: !!c.on });
        var card = el('div', { class: 'card' + (c.on ? ' on' : '') });
        on.addEventListener('change', function () { c.on = on.checked; card.classList.toggle('on', on.checked); dirty(); });
        var t = inp(c.t, function (v) { c.t = v; }, 'Heading'); t.className = 't';
        card.appendChild(el('div', { class: 'row', style: 'flex-wrap:nowrap' }, [el('div', { style: 'flex:1' }, [t]), el('button', { class: 'xb no-print', title: 'Remove', text: '×', onclick: function () { b.items.splice(j, 1); dirty(); draw(); } })]));
        card.appendChild(ta(c.d, function (v) { c.d = v; }, '', 3));
        card.appendChild(el('div', { class: 'cf' }, [el('div', { style: 'flex:1' }, [inp(c.tag, function (v) { c.tag = v; }, 'Tag, such as Chosen, Met or Signed')]), el('label', { class: 'row', style: 'gap:6px' }, [on, document.createTextNode('Chosen')])]));
        g.appendChild(card);
      });
    }
    draw();
    host.appendChild(g);
    if (edit) host.appendChild(el('div', { class: 'row no-print', style: 'margin-top:8px' }, [el('button', { class: 'btn sm', text: 'Add a card', onclick: function () { b.items.push({ t: '', d: '', tag: '', on: false }); dirty(); draw(); } })]));
  }
  function gridView(b, host, edit, tileId) {
    var wrapT = el('div', { class: 'tw' }), tbl = el('table', { class: 'g' });
    wrapT.appendChild(tbl);
    var w = b.w || b.cols.map(function () { return 1; }), tot = w.reduce(function (a, c) { return a + c; }, 0);
    function draw() {
      tbl.innerHTML = '';
      var tr = el('tr');
      b.cols.forEach(function (c, j) {
        var th = el('th', { style: 'width:' + Math.round(100 * w[j] / tot) + '%' });
        if (edit && tileId === 'boundary' && b.cols[0] === 'Rule' && j > 0) th.appendChild(inp(c, function (v) { b.cols[j] = v; }, 'Candidate'));
        else th.textContent = c;
        tr.appendChild(th);
      });
      if (edit && !b.labelCol) tr.appendChild(el('th', { class: 'x' }));
      tbl.appendChild(el('thead', {}, [tr]));
      var tb = el('tbody');
      b.rows.forEach(function (rw, ri) {
        var r2 = el('tr');
        b.cols.forEach(function (c, j) {
          if (j === 0 && b.labelCol) { r2.appendChild(el('td', { class: 'lab', text: rw[0] })); return; }
          if (!edit) { r2.appendChild(el('td', { class: 'lab', style: 'white-space:pre-line', text: rw[j] || '' })); return; }
          r2.appendChild(el('td', {}, [ta(rw[j], function (v) { rw[j] = v; }, '', 1)]));
        });
        if (edit && !b.labelCol) r2.appendChild(el('td', { class: 'x' }, [el('button', { class: 'xb no-print', title: 'Remove this row', text: '×', onclick: function () { b.rows.splice(ri, 1); dirty(); draw(); } })]));
        tb.appendChild(r2);
      });
      tbl.appendChild(tb);
    }
    draw();
    host.appendChild(wrapT);
    if (edit && !b.labelCol) host.appendChild(el('div', { class: 'row no-print', style: 'margin-top:8px' }, [el('button', { class: 'btn sm', text: 'Add a row', onclick: function () { b.rows.push(b.cols.map(function () { return ''; })); dirty(); draw(); } })]));
    if (edit) host.appendChild(el('div', { style: 'margin-top:8px' }, [ta(b.note, function (v) { b.note = v; }, 'Note under the table', 1)]));
    else if (b.note) host.appendChild(el('p', { class: 'meta', style: 'margin:8px 0 0;line-height:1.45', text: b.note }));
  }
  function quadView(b, host, edit) {
    var box = el('div', { class: 'quadw' }), left = el('div'), right = el('div');
    box.appendChild(left); box.appendChild(right); host.appendChild(box);
    function plot() {
      var W = 400, H = 300, pad = 34, s = '<svg class="qsvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dependency map">';
      s += '<rect x="' + (pad + (W - pad - 10) / 2) + '" y="10" width="' + ((W - pad - 10) / 2) + '" height="' + ((H - pad - 10) / 2) + '" fill="rgba(224,112,48,.10)"/>';
      s += '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - 10) + '" y2="' + (H - pad) + '" style="stroke:rgba(var(--hi),.4)"/><line x1="' + pad + '" y1="10" x2="' + pad + '" y2="' + (H - pad) + '" style="stroke:rgba(var(--hi),.4)"/>';
      s += '<text x="' + (W / 2) + '" y="' + (H - 10) + '" style="fill:var(--muted)" font-size="11" text-anchor="middle">How much they depend on it</text>';
      s += '<text x="12" y="' + (H / 2) + '" style="fill:var(--muted)" font-size="11" text-anchor="middle" transform="rotate(-90 12 ' + (H / 2) + ')">How hard to get elsewhere</text>';
      b.items.forEach(function (q) {
        var x = pad + (Number(q.d) || 0) / 10 * (W - pad - 10), y = H - pad - (Number(q.s) || 0) / 10 * (H - pad - 10);
        s += '<circle cx="' + x + '" cy="' + y + '" r="6" style="fill:' + (q.absent ? 'none' : 'var(--paper)') + ';stroke:var(--paper)" stroke-width="2"' + (q.absent ? ' stroke-dasharray="3 2"' : '') + '/>';
        s += '<text x="' + (x + 9) + '" y="' + (y + 4) + '" style="fill:var(--paper)" font-size="10.5">' + esc(q.t) + '</text>';
      });
      left.innerHTML = s + '</svg><div class="meta" style="margin-top:6px">Top right: the most exposed. A dashed circle: not in the room.</div>';
    }
    function table() {
      right.innerHTML = '';
      var tbl = el('table', { class: 'g' });
      tbl.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: 'Group' }), el('th', { text: 'Depends (0 to 10)' }), el('th', { text: 'Hard to replace (0 to 10)' }), el('th', { text: 'Not in the room' }), edit ? el('th', { class: 'x' }) : null])]));
      var tb = el('tbody');
      b.items.forEach(function (q, j) {
        if (!edit) { tb.appendChild(el('tr', {}, [el('td', { class: 'lab', text: q.t }), el('td', { class: 'lab', text: String(q.d) }), el('td', { class: 'lab', text: String(q.s) }), el('td', { class: 'lab', text: q.absent ? 'Yes' : '' })])); return; }
        var num = function (k) { var n = el('input', { type: 'number', min: 0, max: 10, step: 0.1, value: q[k] }); n.addEventListener('input', function () { q[k] = Math.max(0, Math.min(10, Number(n.value) || 0)); dirty(); plot(); }); return n; };
        var ab = el('input', { type: 'checkbox', checked: !!q.absent }); ab.addEventListener('change', function () { q.absent = ab.checked; dirty(); plot(); });
        var nm = inp(q.t, function (v) { q.t = v; plot(); }, 'Group');
        tb.appendChild(el('tr', {}, [el('td', {}, [nm]), el('td', {}, [num('d')]), el('td', {}, [num('s')]), el('td', { style: 'text-align:center' }, [ab]), el('td', { class: 'x' }, [el('button', { class: 'xb', text: '×', title: 'Remove', onclick: function () { b.items.splice(j, 1); dirty(); plot(); table(); } })])]));
      });
      tbl.appendChild(tb); right.appendChild(tbl);
      if (edit) right.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn sm', text: 'Add a group', onclick: function () { b.items.push({ t: '', d: 5, s: 5, absent: false }); dirty(); plot(); table(); } })]));
      (b.side || []).forEach(function (sd) {
        right.appendChild(el('h4', { style: 'margin:16px 0 6px', text: sd.h }));
        if (edit) right.appendChild(ta(sd.rows.join('\n'), function (v) { sd.rows = v.split('\n').filter(function (x) { return x.trim(); }); }, 'One per line', 3));
        else sd.rows.forEach(function (x) { right.appendChild(el('div', { style: 'line-height:1.45;padding:2px 0', text: '• ' + x })); });
      });
    }
    plot(); table();
  }
  function barsView(b, host, edit) {
    b.items.forEach(function (x) {
      var tr = el('div', { class: 'track' });
      function dots() { tr.innerHTML = ''; (x.v || []).forEach(function (v, k) { tr.appendChild(el('i', { style: 'left:' + Math.max(0, Math.min(100, v)) + '%' + (k === 0 ? ';background:var(--accent)' : '') })); }); }
      dots();
      var row2 = el('div', { class: 'trk' }, [el('span', { text: x.l }), tr, el('span', { class: 'r', text: x.r })]);
      host.appendChild(row2);
      if (edit) {
        var pos = el('input', { type: 'text', value: (x.v || []).join(', '), placeholder: 'Each person’s setting, 0 to 100, separated by commas; the sponsor first' });
        pos.addEventListener('input', function () { x.v = pos.value.split(',').map(function (z) { return Number(z.trim()); }).filter(function (z) { return !isNaN(z) && String(z) !== ''; }); dirty(); dots(); });
        host.appendChild(el('div', { class: 'two', style: 'margin:0 0 12px' }, [pos, inp(x.n, function (v) { x.n = v; }, 'What the spread suggests')]));
      } else if (x.n) host.appendChild(el('div', { class: 'meta', style: 'margin:0 0 10px', text: x.n }));
    });
    if (edit) host.appendChild(ta(b.note, function (v) { b.note = v; }, 'Note', 1));
    else if (b.note) host.appendChild(el('p', { class: 'meta', text: b.note }));
  }

  // ---------- versions ----------
  function modal(nodes) { pop.innerHTML = ''; nodes.forEach(function (n) { if (n) pop.appendChild(n); }); veil.hidden = false; }
  function closeModal() { veil.hidden = true; pop.innerHTML = ''; }
  veil.addEventListener('click', function (e) { if (e.target === veil) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !veil.hidden) closeModal(); });
  async function history(t) {
    var key = t ? t.id : 'sheet', d;
    try { d = await api({ action: 'p_history', tile_key: key }); } catch (e) { return alert(e.message); }
    var ul = el('ul', { class: 'vers' });
    if (!d.history.length) ul.appendChild(el('li', { text: 'Not saved yet.' }));
    d.history.forEach(function (h) {
      ul.appendChild(el('li', {}, [el('span', { text: 'Version ' + h.version + ', ' + when(h.saved_at) + ', ' + (h.saved_by || '') + '.  ' + (WORDS[h.status] || '') }), el('button', { class: 'btn sm', text: 'Look at it', onclick: async function () {
        var v = (await api({ action: 'p_version', tile_key: key, version: h.version })).version;
        var body = el('div');
        if (key === 'sheet') body.appendChild(el('pre', { style: 'white-space:pre-wrap', text: JSON.stringify(v.content.sheet, null, 1) }));
        else (v.content.blocks || []).forEach(function (b, i) { body.appendChild(blockView(clone(b), i, false, key)); });
        modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: (t ? t.name : 'The problem summary') + ': version ' + v.version }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })]),
          el('p', { class: 'meta', text: 'Saved ' + when(v.saved_at) + ' by ' + (v.saved_by || '') + '. ' + (v.summary || '') }),
          body,
          el('div', { class: 'row', style: 'margin-top:18px' }, [el('button', { class: 'btn warm', text: 'Copy this version into the page', onclick: function () {
            closeModal();
            if (key === 'sheet') { S.sheet = clone(v.content.sheet); dirty(); renderSheetBody(); return; }
            var prev = S.draft.blocks || [], next = clone(v.content.blocks) || [];
            prev.forEach(function (b, i) { if (b.type === 'quote' && b.locked) next[i] = b; });
            S.draft.blocks = next; S.draft.summary = v.summary || ''; S.draft.status = v.status;
            var bodyEl = document.getElementById('blocks'); bodyEl.innerHTML = ''; S.draft.blocks.forEach(function (b, i) { bodyEl.appendChild(blockView(b, i, true, key)); });
            dirty(); saveMsg.textContent = 'Version ' + v.version + ' copied in. Save to make it the newest version.';
          } })])]);
      } })]));
    });
    modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'Versions of ' + (t ? t.name : 'the problem summary') }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })]), el('p', { class: 'meta', text: 'Every save is kept. Nothing is overwritten.' }), ul]);
  }

  // ---------- the problem sheet ----------
  function renderSheet() {
    var r = row('sheet');
    S.base = r ? r.version : null;
    S.sheet = Object.assign(clone(SHEET_EMPTY), clone(r && r.content && r.content.sheet) || {});
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: '← Reasons: tools', onclick: function () { go('tools=r'); } })]));
    head(S.data.session.name || 'Frame', 'The first-session sheet', 'One page for the room to fill together, before the other tools. Each box seeds a tool: what is written here appears there, to be worked properly.');
    main.appendChild(el('div', { id: 'sheetBody' }));
    renderSheetBody();
    saveMsg.className = 'msg'; saveMsg.textContent = r ? 'Version ' + r.version + ', saved ' + when(r.updated_at) : 'Not saved yet';
    saveBtn.onclick = saveSheet;
    document.getElementById('hist').onclick = function () { history(null); };
  }
  function listBox(k, title, sub, seeds, cls) {
    var sh = S.sheet;
    return el('div', { class: 'sbox ' + (cls || '') }, [el('h4', { text: title }), sub ? el('div', { class: 'sub', text: sub }) : null,
      ta((sh[k] || []).join('\n'), function (v) { sh[k] = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }, 'One per line', 4),
      el('div', { class: 'seeds', text: 'Seeds: ' + seeds })]);
  }
  function lineBox(k, title, sub, seeds, cls) {
    var sh = S.sheet;
    return el('div', { class: 'sbox ' + (cls || '') }, [el('h4', { text: title }), sub ? el('div', { class: 'sub', text: sub }) : null, ta(sh[k], function (v) { sh[k] = v; }, '', 2), seeds ? el('div', { class: 'seeds', text: 'Seeds: ' + seeds }) : null]);
  }
  function forces(k, title, cls) {
    var sh = S.sheet, box = el('div', { class: 'sbox ' + (cls || '') }, [el('h4', { text: title })]), list = el('div');
    function draw() {
      list.innerHTML = '';
      sh[k].forEach(function (f, j) {
        var sc = el('select', { 'aria-label': 'Strength, 1 to 5' }); [1, 2, 3, 4, 5].forEach(function (n) { sc.appendChild(el('option', { value: n, text: String(n) })); }); sc.value = f[1] || 3;
        var bar = el('div', { class: 'fbar ' + (k === 'drive' ? 'd' : 'h'), style: 'width:' + ((f[1] || 3) * 20) + '%' });
        sc.addEventListener('change', function () { f[1] = Number(sc.value); bar.style.width = (f[1] * 20) + '%'; dirty(); });
        list.appendChild(el('div', { class: 'frow' }, [inp(f[0], function (v) { f[0] = v; }, 'A force'), sc, el('button', { class: 'xb', text: '×', title: 'Remove', onclick: function () { sh[k].splice(j, 1); dirty(); draw(); } })]));
        list.appendChild(bar);
      });
    }
    draw();
    box.appendChild(list);
    box.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn sm', text: 'Add a force', onclick: function () { sh[k].push(['', 3]); dirty(); draw(); } }), el('span', { class: 'seeds', text: 'Seeds: the problem to solve; first guesses' })]));
    return box;
  }
  function renderSheetBody() {
    var host = document.getElementById('sheetBody'); host.innerHTML = '';
    var g = el('div', { class: 'sheet' });
    var q = lineBox('q', 'The question, or the decision', '', 'the question; the decision or the problem'); q.classList.add('full'); g.appendChild(q);
    var two = el('div', { class: 'two full' }, [listBox('val', 'Stakeholders: the value side', 'Who relies on it, and what they gain when it works', 'who it is for; what it must give'), el('div', { class: 'sbox exp' }, [
      el('h4', { text: 'Stakeholders: the exposure side' }), el('div', { class: 'sub', text: 'Who could be harmed, or carries a cost, when it fails' }),
      ta((S.sheet.exp || []).join('\n'), function (v) { S.sheet.exp = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }, 'One per line', 4),
      el('span', { class: 'label', text: 'Affected but absent' }), ta(S.sheet.absent, function (v) { S.sheet.absent = v; }, 'Who is affected but not in the room', 1),
      el('div', { class: 'seeds', text: 'Seeds: who it is for; the intolerable threshold' })])]);
    g.appendChild(two);
    g.appendChild(el('div', { style: 'display:grid;gap:14px;align-content:start' }, [listBox('jg', 'Jobs to gain, increase, improve', 'What are they trying to get more of, or make better?', 'jobs it does'), listBox('jp', 'Jobs to protect, prevent, maintain', 'What are they trying to keep safe, stop, or keep going?', 'jobs it does', 'exp')]));
    var cur = el('div', { class: 'sbox' }, [el('h4', { text: 'Current reality' }),
      el('span', { class: 'label', text: 'Where things stand now' }), ta(S.sheet.now, function (v) { S.sheet.now = v; }, '', 1),
      el('p', { class: 'meta', text: 'The force field (what drives change and what holds things as they are) is now a tool in Test.' }), el('a', { class: 'btn sm', href: '/test#forcefield', text: 'Open the force field' }),
      el('span', { class: 'label', text: 'Bright spot: where it already works' }), ta(S.sheet.bright, function (v) { S.sheet.bright = v; }, '', 1)]);
    g.appendChild(cur);
    g.appendChild(el('div', { style: 'display:grid;gap:14px;align-content:start' }, [listBox('pos', 'Outcomes: what working looks like', 'And how it would be measured', 'the value line, on What it must give'), listBox('neg', 'Outcomes: what must not happen', 'To whom, how bad, how long', 'the intolerable threshold', 'exp')]));
    host.appendChild(g);
  }
  async function saveSheet() {
    if (S.busy) return; S.busy = true; saveBtn.disabled = true;
    try {
      var filled = S.sheet.q || S.sheet.val.length || S.sheet.exp.length;
      var d = await api({ action: 'p_save', tile_key: 'sheet', status: filled ? 'done' : 'none', base_version: S.base, content: { sheet: S.sheet } });
      var list = S.data.tiles.filter(function (x) { return x.tile_key !== 'sheet'; }); list.push(d.tile); S.data.tiles = list; S.base = d.tile.version;
      clean('Saved as version ' + d.tile.version + ' at ' + when(d.tile.updated_at));
    } catch (e) { saveMsg.className = 'msg bad'; saveMsg.textContent = e.message; }
    S.busy = false; saveBtn.disabled = false;
  }

  // ---------- the frame page ----------
  function boundaryTested() {
    var r = row('boundary'), g = r && r.content && (r.content.blocks || []).filter(function (x) { return x.type === 'grid' && x.cols && x.cols[0] === 'Rule'; })[0];
    if (!g) return 0;
    var full = 0;
    for (var c = 1; c < g.cols.length; c++) if (g.rows.length >= 6 && g.rows.every(function (rw) { return String(rw[c] || '').trim(); })) full++;
    return full;
  }
  // =====================================================================
  // The frame (notes 17 to 22). The Problem home is the model, populated with the ten boxes.
  // Click a part of the model and it opens up: the strip with the boxes in columns beneath.
  // Two other views of the same answers: the canvas (one screen) and the workshop board.
  // Click any box to answer it: a drawer over the page, or the full page.
  // =====================================================================
  var FR = D.frame, FB = FR.boxes, MAINB = FB.filter(function (b) { return !b.band && !b.retired; }), BANDB = FB.filter(function (b) { return b.band === true; }), PROTB = FB.filter(function (b) { return b.band === 'protocol'; });
  // the order of work: the six steps (26 October 2026)
  var ORDER = ['help', 'system', 'service', 'requires', 'question', 'value', 'good', 'exposure', 'gap'].concat(BANDB.map(function (b) { return b.id; })).concat(PROTB.map(function (b) { return b.id; }));
  var stepOf = function (id) { var b = boxDef(id); return FR.steps.filter(function (st) { return st.band ? b && b.band === st.band : st.boxes.indexOf(id) >= 0; })[0]; };
  var stepBoxes = function (st) { return st.band ? FB.filter(function (b) { return b.band === st.band; }) : st.boxes.map(boxDef); };
  var boxDef = function (id) { return FB.filter(function (b) { return b.id === id; })[0]; };
  var grp = function (g) { return FR.groups.filter(function (x) { return x.id === g; })[0]; };
  var partDef = function (id) { return FR.parts.filter(function (p) { return p.id === id; })[0]; };
  var partOfBox = function (id) { return FR.parts.filter(function (p) { return p.boxes.indexOf(id) >= 0; })[0]; };
  // the face of a box (on the canvas) and its page (behind it)
  var vis = function (b) { return b.fields.filter(function (f) { return !f.hidden && !f.page; }); };
  var pageF = function (b) { return b.fields.filter(function (f) { return !f.hidden && f.page; }); };
  var WAYS = { options: 'Select from options', write: 'Write it', extract: 'Extract it', workshop: 'Workshop it', tool: 'An older tool' };
  var ICON = {
    options: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2"/><circle cx="5" cy="18" r="1.2"/></svg>',
    write: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
    extract: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/></svg>',
    workshop: '<svg class="ic" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c0-3 2.5-5 5-5s5 2 5 5M11 19c0-3 2.5-5 5-5s5 2 5 5"/></svg>' };
  var frameAnswers = function (rows) { var r = (rows || S.data.tiles || []).filter(function (t) { return t.tile_key === 'frame'; })[0]; return (r && r.content && r.content.answers) || {}; };
  var words = function (s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; };
  // One field's value: what was written here, or what stands in for it until it is (an answer saved
  // under the earlier 28-box frame, or an older tool's summary), marked as such.
  function fieldVal(b, f, rows) {
    rows = rows || S.data.tiles || [];
    var A = frameAnswers(rows), a = A[b.id];
    if (a && a.fields && String(a.fields[f.id] || '').trim()) return { text: a.fields[f.id] };
    for (var i = 0; i < (f.old || []).length; i++) { var o = A[f.old[i]]; if (o && !o.fields && String(o.text || '').trim()) return { text: o.text, standin: 'the earlier frame' }; }
    // box 6's inputs, work and outputs stand in from step 2's route until answered here
    if (f.route) { var sr = A.system && A.system.route, rl = ((sr && sr.lists && sr.lists[f.route]) || []).filter(function (x) { return x.on; }).map(function (x) { return x.t; }); if (rl.length) return { text: rl.join('\n'), standin: 'step 2, what we are working on' }; }
    // what it runs on: the items, each with its capital and ours or someone else's
    if (f.runs && a && (a.runs || []).length) return { text: a.runs.map(function (x) { return x.t + ' (' + ((CAPS[x.cap] || [])[0] || 'capital not said') + ', ' + (x.own === 'ours' ? 'ours' : x.own === 'theirs' ? 'someone else’s' : 'not said') + ')'; }).join('\n') };
    for (var k = 0; k < (f.oldf || []).length; k++) { var of = A[f.oldf[k][0]]; if (of && of.fields && String(of.fields[f.oldf[k][1]] || '').trim() && !(f.oldf[k][0] === b.id && f.oldf[k][1] === f.id)) { var ob = boxDef(f.oldf[k][0]); return { text: of.fields[f.oldf[k][1]], standin: f.oldf[k][0] === b.id ? 'this box’s page' : (ob && ob.retired ? 'the earlier box “How it operates, how it fails”' : '“' + (ob ? ob.name : f.oldf[k][0]) + '”') }; } }
    for (var j = 0; j < (f.from || []).length; j++) {
      var r = rows.filter(function (t) { return t.tile_key === f.from[j]; })[0], td = tileDef(f.from[j]);
      if (r && r.summary && r.status !== 'none' && r.status !== 'skip') return { text: r.summary.replace(/\s*\(illustrative\)\s*$/, ''), standin: 'the tool “' + (td ? td.name : f.from[j]) + '”' };
    }
    return null;
  }
  function boxState(b, rows) {
    var fs = vis(b), vals = fs.map(function (f) { return fieldVal(b, f, rows); });
    var real = vals.filter(function (v) { return v && !v.standin; }).length, any = vals.filter(Boolean).length;
    return real === fs.length ? 'done' : real ? 'part' : any ? 'standin' : 'empty';
  }
  var answered = function (b, rows) { var s = boxState(b, rows); return s === 'done' || s === 'part'; };
  var myName = function () { return S.data.as === 'master' ? 'David (master)' : 'Facilitator'; };
  var shortDay = function (d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  function fromLine(a) {
    if (!a || !a.fields) return '';
    var f = (a.from || []).map(function (x) { return x.way === 'tool' ? 'carried over' : WAYS[x.way] || x.way; });
    return 'From: ' + (f.length ? f.join(', then ') : 'Write it') + (a.by ? ' · ' + a.by : '') + (a.at ? ' · ' + shortDay(a.at) : '');
  }
  function progress() {
    var n = MAINB.filter(function (b) { return answered(b); }).length, t = BANDB.filter(function (b) { return answered(b); }).length, pr = PROTB.filter(function (b) { return answered(b); }).length;
    var nx = ORDER.map(boxDef).filter(function (b) { return b && boxState(b) !== 'done'; })[0];
    return { n: n, t: t, pr: pr, next: nx };
  }

  // ---------- the header shared by the three views ----------
  function frameHead(title) {
    var s = S.data.session, pg = progress();
    var nx = pg.next ? el('button', { class: 'link', id: 'fnextbox', text: pg.next.name, onclick: function () { openBox(pg.next.id); } }) : null;
    main.appendChild(el('div', { class: 'btop' }, [
      el('div', {}, [el('p', { class: 'kick', text: s.name || 'Frame' }), el('h1', { class: 'wide', text: title }),
        el('p', { class: 'meta', id: 'canvasProg', style: 'margin-top:8px' }, [document.createTextNode(pg.n + ' of ' + MAINB.length + ' boxes answered · testing the frame ' + pg.t + ' of ' + BANDB.length + ' · the protocol ' + pg.pr + ' of ' + PROTB.length + (pg.next ? ' · next: ' : '')), nx])]),
      el('div', { class: 'row no-print' }, [S.readonly ? null : el('a', { class: 'btn sm', id: 'fguided', href: '#guided', text: 'Guided framing' }), el('button', { class: 'btn sm', id: 'fhist', text: 'History', onclick: showHistory }), el('button', { class: 'btn sm', text: 'Print', onclick: function () { window.print(); } })])]));
    var frow = row('frame');
    var gd = frow && frow.content && frow.content.guide;
    // the guided framing has been sent: say so, with what was marked "not sure", for the team to follow up
    if (gd && gd.sent && !S.readonly) {
      var NS = gd.notsure || {}, nsk = Object.keys(NS);
      main.appendChild(el('div', { class: 'gsent no-print', id: 'guidedSent', role: 'status' }, [el('p', {}, [el('b', { text: 'The guided framing was sent' }), ' by ' + (gd.sent.by || 'the organisation') + ' on ' + when(gd.sent.at) + (gd.changedSince ? ', and has been changed since.' : '.')]),
        nsk.length ? el('p', { class: 'meta', text: 'Marked “not sure”: ' + nsk.map(function (k) { return (window.VTGuide && VTGuide.label ? VTGuide.label(k) : k); }).join('; ') + '.' }) : el('p', { class: 'meta', text: 'Nothing was marked “not sure”.' })]));
    }
    var clab = frow && frow.content && frow.content.caseLabel;
    if (clab) main.appendChild(el('p', { class: 'meta', id: 'caseLabel', text: clab }));
    else if (frow && /published case/i.test(frow.summary || '')) main.appendChild(el('p', { class: 'meta', id: 'caseLabel', text: 'Friendly Fire, as at 15 April 1994: a published case, built from public sources. Real names are used.' }));
    if (!(S.data.tiles || []).length) main.appendChild(el('div', { class: 'start no-print' }, [el('p', { text: 'Nothing has been worked yet. Start with How we might help, or load a worked case to see the frame filled in: Maylands, or Friendly Fire (a published case, built from public sources).' }), el('div', { class: 'row' }, [el('button', { class: 'btn solid', text: 'Start with How we might help', onclick: function () { openBox('help'); } }), el('button', { class: 'btn warm', text: 'Load the Maylands worked case', onclick: function () { loadExample('maylands'); } }), ffButton('btn warm'), moreCases('btn warm')])]));
  }
  function frameFoot() {
    var fr = S.data.frames || [], last = fr[0];
    main.appendChild(el('p', { class: 'meta', style: 'margin-top:12px', text: last ? 'Signed version ' + last.version + ', ' + when(last.signed_at) + ', by ' + last.signed_by + '. To sign a new version, open Agreement and signing.' : 'Not signed yet. To sign the frame, open Agreement and signing.' }));
    if ((S.data.tiles || []).length) main.appendChild(el('div', { class: 'bfoot no-print' }, [el('button', { class: 'quiet', text: 'Load the Maylands worked case', onclick: function () { loadExample('maylands'); } }), ffButton('quiet'), moreCases('quiet')]));
  }
  // the six steps that test the frame, as a band
  function bandEl(rows, readonly) {
    var n = BANDB.filter(function (b) { return answered(b, rows); }).length;
    return el('div', { class: 'tband' }, [el('div', { class: 'tbl' }, [el('b', { text: 'Testing the frame' }), el('span', { class: 'meta', text: n + ' of ' + BANDB.length })])].concat(BANDB.map(function (b, i) {
      var st = boxState(b, rows), v = fieldVal(b, b.fields[0], rows);
      return el(readonly ? 'div' : 'button', { class: 'tstep ' + st, 'data-box': b.id, title: b.q, onclick: readonly ? null : function () { openBox(b.id); } }, [el('span', { class: 'tn', text: String(i + 1) }), el('span', {}, [el('b', { text: b.name }), v ? el('span', { class: 'tx', text: v.text }) : null])]);
    })));
  }
  // one box as a card: its fields, each with a label; empty fields show their question
  function boxCard(b, rows, opt) {
    opt = opt || {};
    var g = grp(b.g), st = boxState(b, rows);
    var kids = [el('div', { class: 'bch', style: 'color:' + g.c, text: b.name })];
    // box 1, once the system is agreed: two sentences and a small picture of the map (tapping reopens the map)
    var rc = b.id === 'system' && !rows && window.VTRoute ? window.VTRoute.card(frameAnswers(S.data.tiles || []).system) : null;
    if (rc) { kids.push(rc); return el(opt.readonly ? 'div' : 'button', { class: 'bcard ' + st + ' rtcard' + (opt.cls ? ' ' + opt.cls : ''), 'data-box': b.id, style: 'border-top-color:' + g.c + (opt.style ? ';' + opt.style : ''), onclick: opt.readonly ? null : function () { openBox(b.id); } }, kids); }
    vis(b).forEach(function (f) {
      var v = fieldVal(b, f, rows);
      kids.push(el('div', { class: 'bcf' + (v ? (v.standin ? ' si' : '') : ' e') }, [el('b', { text: f.label }), el('span', { text: v ? v.text : f.q })]));
    });
    if (vis(b).some(function (f) { var v = fieldVal(b, f, rows); return v && v.standin; })) kids.push(el('div', { class: 'bcsi', text: 'Dashed: carried over until answered here' }));
    return el(opt.readonly ? 'div' : 'button', { class: 'bcard ' + st + (opt.cls ? ' ' + opt.cls : ''), 'data-box': b.id, style: 'border-top-color:' + g.c + (opt.style ? ';' + opt.style : ''), onclick: opt.readonly ? null : function () { openBox(b.id); } }, kids);
  }

  // ---------- 0. the six steps: the home of Frame ----------
  function renderSteps() {
    frameHead('Frame');
    var host = el('div', { class: 'steps5' });
    FR.steps.forEach(function (st) {
      var bx = stepBoxes(st), n = bx.filter(function (b) { return answered(b); }).length;
      var sec = el('section', { class: 'step5' + (st.team ? ' teamonly' : ''), 'data-step': st.id }, [el('div', { class: 'step5h' }, [el('span', { class: 'step5n', text: 'Step ' + st.n + ' of ' + FR.steps.length }), el('h2', { text: st.name }), st.team ? el('span', { class: 'team', text: 'Team only' }) : null, el('span', { class: 'meta', text: n + ' of ' + bx.length + ' answered' })]), el('p', { class: 'meta step5q', text: st.q })]);
      if (st.band) sec.appendChild(el('div', { class: 'step5chips' }, bx.map(function (b, i) { var v = fieldVal(b, b.fields[0]); return el('button', { class: 'tstep ' + boxState(b), 'data-box': b.id, title: b.q, onclick: function () { openBox(b.id); } }, [el('span', { class: 'tn', text: String(i + 1) }), el('span', {}, [el('b', { text: b.name }), v ? el('span', { class: 'tx', text: v.text }) : null])]); })));
      else sec.appendChild(el('div', { class: 'step5boxes' }, bx.map(function (b) { return boxCard(b); })));
      host.appendChild(sec);
    });
    main.appendChild(host);
    frameFoot();
  }
  // the protocol, as a band (team only)
  function protocolEl(rows, readonly) {
    var n = PROTB.filter(function (b) { return answered(b, rows); }).length;
    return el('div', { class: 'tband prot teamonly' }, [el('div', { class: 'tbl' }, [el('b', { text: 'The protocol' }), el('span', { class: 'team', text: 'Team only' }), el('span', { class: 'meta', text: n + ' of ' + PROTB.length })])].concat(PROTB.map(function (b, i) {
      var st = boxState(b, rows), v = fieldVal(b, b.fields[0], rows);
      return el(readonly ? 'div' : 'button', { class: 'tstep ' + st, 'data-box': b.id, title: b.q, onclick: readonly ? null : function () { openBox(b.id); } }, [el('span', { class: 'tn', text: String(i + 1) }), el('span', {}, [el('b', { text: b.name }), v ? el('span', { class: 'tx', text: v.text }) : null])]);
    })));
  }

  // ---------- 1. the model, populated ----------
  function renderCanvas() {
    frameHead('The picture');
    var di = S.mview === 'di';
    main.appendChild(el('div', { class: 'spread no-print', style: 'align-items:center;margin-bottom:6px' }, [
      el('p', { class: 'meta', style: 'margin:0', text: di ? 'Demand and impact, beside the question.' : 'The same answers as the six steps, drawn as the system: what flows through it, and what it runs on.' }),
      el('div', { class: 'mtog', role: 'group', 'aria-label': 'Which view of the picture' }, [['flow', 'The flow'], ['di', 'Demand and impact']].map(function (o) { var on = (o[0] === 'di') === di; return el('button', { class: on ? 'on' : '', 'data-mv': o[0], 'aria-pressed': String(on), onclick: function () { S.mview = o[0]; render(); } }, [o[1]]); }))]));
    var rows = null, V = function (box, fid) { var b = boxDef(box), f = b.fields.filter(function (x) { return x.id === fid; })[0], v = fieldVal(b, f, rows); return v ? '<span' + (v.standin ? ' class="si"' : '') + '>' + esc(String(v.text).replace(/\n+/g, '; ')) + '</span>' : '<span class="e">' + esc(f.q) + '</span>'; };
    if (di) return renderDemandImpact(V);
    var A = frameAnswers(), R0 = (A.system && A.system.route) || {}, sf = (A.system && A.system.fields) || {};
    var name = R0.name || sf.what || '', within = R0.standalone ? 'it stands alone' : routeList('within').join('; ');
    var stepNames = (R0.steps || []).length ? R0.steps.map(function (x) { return x.n; }) : String(sf.steps || '').split(/;\s*|\n/).map(function (x) { return x.replace(/\.$/, '').trim(); }).filter(Boolean);
    var req = A.requires || {}, runs = (req.runs || []).length ? req.runs : runsFromText((req.fields || {}).requires || '');
    var cy = 330, R = 70, W = 1366;
    var ln = function (a, b) { return '<line class="mln" x1="' + a + '" y1="' + cy + '" x2="' + b + '" y2="' + cy + '" marker-end="url(#mah)"/>'; };
    var circ = function (x, lines, q, small) { var s = '<circle class="mc' + (q ? ' q' : '') + '" cx="' + x + '" cy="' + cy + '" r="' + R + '"/>'; lines.forEach(function (l, i) { s += '<text class="mct" x="' + x + '" y="' + (cy - (lines.length - 1) * 10 + i * 20 + 5) + '" style="font-size:' + (small && i === 0 ? 10 : 14) + 'px">' + l + '</text>'; }); return s; };
    var fo = function (x, y, w, h, html, cls) { return '<foreignObject x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"><div xmlns="http://www.w3.org/1999/xhtml" class="mfo ' + (cls || '') + '">' + html + '</div></foreignObject>'; };
    var part = function (id, inner) { return '<g class="mpart" data-part="' + id + '" tabindex="0" role="button" aria-label="Open ' + esc(partDef(id).name) + '">' + inner + '</g>'; };
    var lab = function (n, v) { return '<div><b>' + n + '</b> ' + v + '</div>'; };
    var cols = 3, rowsN = Math.max(1, Math.ceil(runs.length / cols)), bandH = 64 + rowsN * 66, BY = 660, H = BY + bandH + 40;
    var s = '<svg class="msvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The model: purpose, in, the work, out, the question and stakeholder outcomes, with what it runs on beneath"><defs><marker id="mah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="mahp"/></marker></defs>';
    s += part('system', '<rect class="mbound" x="30" y="70" width="1306" height="' + (H - 90) + '"/>' + fo(30, 0, 1306, 64, '<div class="mh">External environment</div>' + V('system', 'changing')) +
      fo(46, 76, 1100, 40, '<div class="msys"><b>The system:</b> ' + esc(name || 'not yet agreed') + (within ? ' · inside: ' + esc(within) : '') + '</div>'));
    s += part('service', circ(150, ['PURPOSE']) + fo(36, 410, 230, 130, '<div class="mh">What it is for</div>' + V('service', 'for'), 'ctr'));
    s += ln(220, 268);
    var inner = '<rect class="mio" x="270" y="' + (cy - 25) + '" width="110" height="50" rx="10"/><text class="mct" x="325" y="' + (cy + 5) + '" style="font-size:13px">IN</text>' +
      fo(262, 150, 150, 148, '<div class="mh">Inputs</div>' + V('requires', 'inputs'), 'bot') + ln(380, 408);
    var n = Math.max(1, Math.min(stepNames.length || 5, 9)), gap = 6, bw = (360 - gap * (n - 1)) / n;
    for (var k = 0; k < n; k++) inner += '<rect class="mstep' + (S.mstep === k ? ' on' : '') + '" data-step="' + k + '" tabindex="0" role="button" aria-label="Step ' + (k + 1) + ': ' + esc(stepNames[k] || '') + '. Show who does it" x="' + (410 + k * (bw + gap)) + '" y="' + (cy - 38) + '" width="' + bw + '" height="76" rx="8"><title>' + esc(stepNames[k] || '') + '</title></rect>';
    var sel = S.mstep != null && S.mstep < n ? S.mstep : null, wd = sel != null ? stepWho(R0, sel) : null;
    inner += fo(410, 150, 360, 148, '<div class="mh">Work: the main steps</div><div class="mmu">Tap a step to see who does it.</div>', 'bot') +
      fo(410, cy + 44, 360, 90, sel != null ? '<div class="mstepd" id="mStepWho"><b>Step ' + (sel + 1) + ': ' + esc(stepNames[sel] || '') + '.</b> Who does it: ' + (wd.text ? esc(wd.text) + (wd.from ? ' <span class="si">(suggested from the map: ' + wd.from + ')</span>' : '') : '<span class="e">not said yet</span>') + '</div>' : '<div class="mstepn">' + (stepNames.length ? esc(stepNames.join(' · ')) : V('system', 'steps')) + '</div>') + ln(770, 798) +
      '<rect class="mio" x="800" y="' + (cy - 25) + '" width="110" height="50" rx="10"/><text class="mct" x="855" y="' + (cy + 5) + '" style="font-size:13px">OUT</text>' +
      fo(792, 150, 190, 148, '<div class="mh">Outputs</div>' + V('requires', 'outputs'), 'bot');
    // what it runs on: a band under the line
    var cards = runs.map(function (x) { return '<div class="mrun' + (x.flag === 'input' ? ' fl' : '') + '"><b>' + esc(x.t) + '</b><span>' + esc((CAPS[x.cap] ? CAPS[x.cap][0] : 'Capital not said') + ' · ' + (x.own === 'ours' ? 'ours' : x.own === 'theirs' ? 'someone else’s' : 'whose not said')) + (x.flag === 'input' ? ' · looks like an input' : '') + '</span></div>'; }).join('');
    inner += fo(46, BY, 210, 120, '<div class="mmu">Steps above use the inputs; the band below is what every step relies on.</div>') +
      fo(270, BY, 1050, bandH, '<div class="mband2" id="mRuns"><div class="mbh"><b>What it runs on</b> <span>not used up by the work; where dependencies and single points of failure come from</span></div><div class="mruns">' + (cards || '<span class="e">What the work relies on and does not use up: people, kit, systems, data, relationships, money</span>') + '</div></div>');
    s += part('how', inner);
    s += ln(910, 1060 - R - 2);
    s += part('question', circ(1060, ['QUESTION', 'OR', 'DECISION'], true) +
      fo(925, 410, 225, 236, '<div class="mh">The question</div>' + V('question', 'question') + '<div style="margin-top:4px">' + lab('Owner:', V('question', 'owner')) + '</div>', 'ctr'));
    s += ln(1130, 1250 - R - 2);
    s += part('outcomes', circ(1250, ['STAKEHOLDER', 'OUTCOMES', '+ / −'], false) +
      fo(1162, 410, 174, 236, '<div class="mh">Who gains, who is harmed</div>' + V('value', 'gains') + '<div style="margin-top:4px">' + V('exposure', 'exposed') + '</div>', 'ctr'));
    s += '</svg>';
    var wrap = el('div', { class: 'mwrap', id: 'mFlow', html: s });
    // a step opens to show who does it, without leaving the model
    Array.prototype.forEach.call(wrap.querySelectorAll('.mstep[data-step]'), function (r) {
      var pick = function (e) { e.stopPropagation(); var k = +r.getAttribute('data-step'); S.mstep = S.mstep === k ? null : k; render(); };
      r.addEventListener('click', pick); r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.mpart'), function (g) {
      var open = function () { go('part=' + g.getAttribute('data-part')); };
      g.addEventListener('click', open); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    main.appendChild(el('p', { class: 'meta no-print', style: 'margin:6px 0 0', text: 'Click any part of the model to open it up. Demand and impact are on the second view.' }));
    main.appendChild(wrap);
    main.appendChild(bandEl());
    main.appendChild(protocolEl());
    frameFoot();
  }
  // who does a step: as written on the map, or suggested from the map's cells (the parts that do the work there)
  function stepWho(R0, k) {
    var st = (R0.steps || [])[k];
    if (st && st.who) return { text: st.who };
    var c = R0.cells || {}, d = [], t = [];
    (R0.parts || []).forEach(function (p, pi) { if (c[pi + '|' + k] === 'do') d.push(p); else if (c[pi + '|' + k] === 'test') t.push(p); });
    var txt = d.join(', ') + (t.length ? (d.length ? '; ' : '') + 'unclear in practice: ' + t.join(', ') : '');
    return { text: txt, from: txt ? 'which parts do the work at this step' : '' };
  }
  // the second view of the model: demand and impact, beside the question
  function renderDemandImpact(V) {
    var card = function (box, title, cls, lines) { return el('button', { class: 'mdi ' + cls, 'data-box': box, onclick: function () { openBox(box); } }, [el('div', { class: 'mh', text: title })].concat(lines.map(function (l) { return el('div', { html: '<b>' + l[0] + '</b> ' + l[1] }); }))); };
    main.appendChild(el('div', { class: 'mdiq', html: '<div class="mh">The question</div>' + V('question', 'question') }));
    main.appendChild(el('div', { class: 'mdig', id: 'mDI' }, [
      card('good', '+ Demand: what good looks like', 'val', [['What the business needs (declared):', V('good', 'needs')], ['Measure:', V('good', 'measure')]]),
      card('gap', '− Impact: the gap, and what must not happen', 'exp', [['The gap:', V('gap', 'gap')], ['Must not happen (declared):', V('gap', 'mustnot')]]),
      card('value', '+ Value side', 'val', [['Who gains:', V('value', 'gains')], ['How each sees it:', V('value', 'sees')]]),
      card('exposure', '− Exposure side', 'exp', [['Who is exposed:', V('exposure', 'exposed')], ['Absent:', V('exposure', 'absent')]])]));
    main.appendChild(bandEl());
    main.appendChild(protocolEl());
    frameFoot();
  }

  // ---------- 2. one part opened up: the strip, with the boxes in columns beneath ----------
  function renderPart(pid) {
    var P = partDef(pid) || FR.parts[0];
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:10px;align-items:center' }, [
      el('button', { class: 'btn sm', text: '‹ The model', onclick: function () { go('mdl'); } }),
      el('span', { class: 'meta', text: 'Click a circle to move along; click a box to answer it.' })]));
    main.appendChild(el('h1', { class: 'wide', style: 'font-size:clamp(22px,2.6vw,30px)', text: P.name }));
    main.appendChild(boxCard(boxDef('system'), null, { cls: 'sysbar' + (pid === 'system' ? ' on' : ''), style: '' }));
    var cy = 58, R = 46, xs = [330, 400, 470, 540, 610];
    var circ = function (id, x, lines, q) { var s = '<g class="spart' + (pid === id ? ' on' : '') + '" data-part="' + id + '" tabindex="0" role="button"><circle class="mc' + (q ? ' q' : '') + '" cx="' + x + '" cy="' + cy + '" r="' + R + '"/>'; lines.forEach(function (l, i) { s += '<text class="mct" x="' + x + '" y="' + (cy - (lines.length - 1) * 8 + i * 16 + 4) + '" style="font-size:11.5px">' + l + '</text>'; }); return s + '</g>'; };
    var ln = function (a, b) { return '<line class="mln" x1="' + a + '" y1="' + cy + '" x2="' + b + '" y2="' + cy + '" marker-end="url(#sah)"/>'; };
    var s = '<svg class="ssvg" viewBox="0 0 1286 118"><defs><marker id="sah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="mahp"/></marker></defs>' + circ('service', 140, ['SERVICE']) + ln(186, xs[0]);
    s += '<g class="spart' + (pid === 'how' ? ' on' : '') + '" data-part="how" tabindex="0" role="button">'; xs.forEach(function (x) { s += '<rect class="mstep" x="' + x + '" y="' + (cy - 15) + '" width="50" height="30" rx="7"/>'; }); s += '<rect x="320" y="10" width="350" height="96" fill="transparent"/></g>';
    xs.forEach(function (x, i) { s += ln(x + 50, i < 4 ? xs[i + 1] : 860 - R); });
    s += circ('question', 860, ['QUESTION', 'OR', 'DECISION'], true) + ln(906, 1140 - R) + circ('outcomes', 1140, ['OUTCOMES', '+/-']) + '</svg>';
    var strip = el('div', { class: 'swrap', html: s });
    Array.prototype.forEach.call(strip.querySelectorAll('.spart'), function (g) { var open = function () { go('part=' + g.getAttribute('data-part')); }; g.addEventListener('click', open); g.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); }); });
    main.appendChild(strip);
    var col = function (id, ids) { return el('div', { class: 'pcol' + (pid === id ? ' on' : ''), 'data-col': id }, ids.map(function (b) { return boxCard(boxDef(b)); })); };
    main.appendChild(el('div', { class: 'pcols' }, [col('service', ['service']), col('how', ['requires']), col('question', ['help', 'question']), col('outcomes', ['value', 'exposure', 'good', 'gap'])]));
    main.appendChild(bandEl());
  }

  // ---------- 3. the canvas: every box on one screen ----------
  function posterGrid(rows, readonly) {
    var C = function (id) { return boxCard(boxDef(id), rows, { readonly: readonly }); };
    var V = function (box, fid) { var b = boxDef(box), f = b.fields.filter(function (x) { return x.id === fid; })[0], v = fieldVal(b, f, rows); return v ? v.text : f.q; };
    var qb = boxDef('question');
    var hero = el(readonly ? 'div' : 'button', { class: 'heroq', 'data-box': 'question', onclick: readonly ? null : function () { openBox('question'); } }, [
      el('div', { class: 'k', text: qb.name }), el('div', { class: 'q wide', text: V('question', 'question') }),
      el('div', { class: 'hs' }, [el('div', {}, [el('b', { text: 'Who owns it' }), document.createTextNode(V('question', 'owner'))]), el('div', {}, [el('b', { text: 'Why now' }), document.createTextNode(V('help', 'why'))])])]);
    var help = el(readonly ? 'div' : 'button', { class: 'herohelp', 'data-box': 'help', onclick: readonly ? null : function (e) { e.stopPropagation(); openBox('help'); } }, [el('b', { text: 'How we might help' }), document.createTextNode(V('help', 'words'))]);
    return el('div', { class: 'poster' }, [
      boxCard(boxDef('system'), rows, { readonly: readonly, cls: 'sysbar' }),
      el('div', { class: 'prow' }, [el('div', { class: 'pstack' }, [C('value'), C('exposure')]), el('div', { class: 'pstack' }, [hero, help]), el('div', { class: 'pstack' }, [C('good'), C('gap')])]),
      el('div', { class: 'prow' }, [C('service'), C('requires')]),
      bandEl(rows, readonly), readonly ? null : protocolEl(rows, readonly)]);
  }
  function renderPoster() {
    frameHead('The canvas');
    main.appendChild(posterGrid(null, false));
    frameFoot();
  }

  // ---------- 4. the workshop board: a lane for each theme, a note for each line ----------
  function renderWBoard() {
    frameHead('Workshop board');
    main.appendChild(el('div', { class: 'row no-print', style: 'margin:4px 0 12px' }, [el('button', { class: 'btn sm', 'aria-pressed': String(!!S.big), text: S.big ? 'Normal text' : 'Larger text for the room', onclick: function () { S.big = !S.big; render(); } })]));
    var lanes = el('div', { class: 'lanes' + (S.big ? ' big' : '') });
    ['s', 'p', 'h', 'q', 'o'].forEach(function (gid) {
      var g = grp(gid), lane = el('div', { class: 'lane', style: 'background:' + g.t + '22' }, [el('div', { class: 'lh', style: 'background:' + g.c, text: g.name })]);
      MAINB.filter(function (b) { return b.g === gid; }).sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); }).forEach(function (b) {
        lane.appendChild(el('div', { class: 'nh', text: b.name.replace(/^[^:]*: /, '') }));
        vis(b).forEach(function (f) { var v = fieldVal(b, f); lane.appendChild(el('button', { class: 'note' + (v ? (v.standin ? ' si' : '') : ' e'), 'data-box': b.id, onclick: function () { openBox(b.id); } }, [el('span', { class: 't', text: f.label }), el('span', { text: v ? v.text : '+ ' + f.q })])); });
      });
      lanes.appendChild(lane);
    });
    main.appendChild(lanes);
    main.appendChild(bandEl());
  }

  // ---------- answering a box: the editor shared by the drawer and the full page ----------
  // the Define route's lists (step 2), as ticked
  function routeList(k) { var y = frameAnswers().system, r = y && y.route; return ((r && r.lists && r.lists[k]) || []).filter(function (x) { return x.on; }).map(function (x) { return x.t; }); }
  function lcf(t) { t = String(t || ''); return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  // ---------- box 6: what it runs on, each item with its capital and ours or someone else's ----------
  var CAPORDER = ['human', 'social', 'manufactured', 'information', 'financial', 'natural'];
  var INPUTISH = /\b(schedules?|codes?|plans?|orders?|requests?|tasking|applications?|claims?|referrals?|samples?|calls?|bookings?)\b/i;
  function capGuess(t) {
    t = String(t || '').toLowerCase();
    if (/\b(money|fund|funds|funding|budget|investment|finance|cash)\b/.test(t)) return 'financial';
    if (/\b(data|information|records|forecast\w*|intelligence)\b/.test(t)) return 'information';
    if (/\b(relationship\w*|link|partner\w*|bank|supplier\w*|as one|accounts|trust)\b/.test(t)) return 'social';
    if (/\b(staff|people|crews?|teams?|engineers?|doctors?|pharmacists?|nurses?|trainers?|installers?|pilots?|controllers?|skills?|units)\b/.test(t)) return 'human';
    if (/\b(system\w*|plane|radios?|kit|machines?|equipment|buildings?|vehicles?|stock|parts|aircraft|laborator\w*)\b/.test(t)) return 'manufactured';
    if (/\b(water|land|energy|weather)\b/.test(t)) return 'natural';
    return '';
  }
  // the earlier "What it requires" wording, as items: nothing is moved; anything that looks like an input is flagged for the team
  function runsFromText(t) { return String(t || '').split(/\n|;\s*/).map(function (x) { return x.replace(/\.$/, '').trim(); }).filter(Boolean).map(function (x) { var c = capGuess(x); return { t: x.charAt(0).toUpperCase() + x.slice(1), cap: c, own: '', flag: INPUTISH.test(x) ? 'input' : null, from: 'earlier wording' }; }); }
  function runsEditor(a, getRuns, setRuns, V, wrap) {
    var host = el('div', { class: 'runs', id: 'runsEd' });
    function paintR() {
      host.innerHTML = '';
      var R6 = getRuns(), order = R6.map(function (x, i) { return i; }).sort(function (i, j) { var ci = CAPORDER.indexOf(R6[i].cap), cj = CAPORDER.indexOf(R6[j].cap); return (ci < 0 ? 9 : ci) - (cj < 0 ? 9 : cj) || i - j; });
      host.appendChild(el('div', { class: 'runsh' }, [el('b', { text: 'What it runs on' }), el('span', { class: 'meta', text: ' not used up by the work; where dependencies and single points of failure come from' })]));
      order.forEach(function (i) {
        var x = R6[i], t = el('input', { type: 'text', class: 'runt', value: x.t || '', 'aria-label': 'Item' });
        t.addEventListener('input', function () { R6[i].t = t.value; sync(); });
        var cap = el('select', { class: 'runc', 'aria-label': 'Capital' }, [el('option', { value: '', text: 'Capital?' })].concat(CAPORDER.map(function (k) { return el('option', { value: k, text: CAPS[k][0] }); })));
        cap.value = x.cap || ''; cap.addEventListener('change', function () { R6[i].cap = cap.value; sync(); paintR(); });
        var own = el('select', { class: 'runo', 'aria-label': 'Ours or someone else’s' }, [el('option', { value: '', text: 'Whose?' }), el('option', { value: 'ours', text: 'Ours' }), el('option', { value: 'theirs', text: 'Someone else’s' })]);
        own.value = x.own || ''; own.addEventListener('change', function () { R6[i].own = own.value; sync(); });
        var rowk = [el('i', { class: 'capdot', style: 'background:' + (CAPS[x.cap] ? CAPS[x.cap][1] : 'transparent') }), t, cap, own, el('button', { class: 'link', title: 'Remove', 'aria-label': 'Remove', onclick: function () { R6.splice(i, 1); sync(); paintR(); } }, ['×'])];
        var row = el('div', { class: 'runrow', 'data-run': x.t }, rowk);
        host.appendChild(row);
        if (x.flag === 'input') host.appendChild(el('div', { class: 'runflag', 'data-flag': x.t }, [el('span', { text: 'This looks like an input (it flows through and is used by the work). Move it?' }),
          el('button', { class: 'link', 'data-move': x.t, onclick: function () { var tf = wrap.querySelector('[data-field="inputs"]'); V.inputs = (String(V.inputs || '').trim() ? V.inputs.trim() + '\n' : '') + x.t; if (tf) { tf.value = V.inputs; grow(tf); } R6.splice(i, 1); sync(); paintR(); } }, ['Move to inputs']),
          el('button', { class: 'link', 'data-keep': x.t, onclick: function () { R6[i].flag = null; sync(); paintR(); } }, ['Keep it here'])]));
      });
      host.appendChild(el('button', { class: 'btn sm', id: 'runAdd', text: 'Add an item', onclick: function () { R6.push({ t: '', cap: '', own: '' }); sync(); paintR(); var ins = host.querySelectorAll('.runt'); if (ins.length) ins[ins.length - 1].focus(); } }));
      // suggested from step 2: the inside items and parts (ours), the kept-in-view items (someone else's)
      var have = R6.map(function (x) { return String(x.t || '').toLowerCase(); }), sug = [];
      routeList('inside').concat(((frameAnswers().system || {}).route || {}).parts || []).forEach(function (t) { if (have.indexOf(t.toLowerCase()) < 0 && !sug.some(function (z) { return z.t === t; })) sug.push({ t: t, own: 'ours' }); });
      routeList('outside').forEach(function (t) { if (have.indexOf(t.toLowerCase()) < 0) sug.push({ t: t, own: 'theirs' }); });
      if (sug.length) host.appendChild(el('div', { class: 'rsug', id: 'runsSug' }, [el('span', { class: 'meta', text: 'Suggested from step 2 (inside items and parts are ours; kept in view is someone else’s). Tap to add:' })].concat(sug.map(function (z) { return el('button', { class: 'chip', 'data-sug': z.t, onclick: function () { R6.push({ t: z.t, cap: capGuess(z.t), own: z.own }); sync(); paintR(); } }, [z.t + (z.own === 'ours' ? ' · ours' : ' · someone else’s')]); }))));
    }
    function sync() { var R6 = getRuns(); V.runs = R6.filter(function (x) { return String(x.t || '').trim(); }).map(function (x) { return x.t; }).join('\n'); setRuns(R6); dirty(); }
    paintR();
    return host;
  }
  function boxEditor(b, onSaved, compact) {
    var RUNS = null;
    var a = frameAnswers()[b.id] || {}, V = {}, msg = el('div', { class: 'msg', id: 'fmsg' }), helpDone = answered(boxDef('help'));
    b.fields.forEach(function (f) { var v = fieldVal(b, f); V[f.id] = v ? v.text : ''; });
    var carried = b.fields.filter(function (f) { var v = fieldVal(b, f); return v && v.standin; }).map(function (f) { return f.id; });
    var wrap = el('div', { class: 'fed' });
    var fieldEl = function (f) {
      if (f.runs) {
        RUNS = (a.runs || []).length ? JSON.parse(JSON.stringify(a.runs)) : runsFromText((a.fields || {}).requires || '');
        return el('div', { class: 'fld', 'data-who': f.who || 'both' }, [runsEditor(a, function () { return RUNS; }, function (r) { RUNS = r; }, V, wrap)]);
      }
      var v = fieldVal(b, f), cnt = f.max ? el('span', { class: 'meta wc' }) : null, t;
      if (f.choice) {
        t = el('select', {}, [el('option', { value: '', text: 'Not chosen yet' })].concat(f.choice.map(function (c) { return el('option', { value: c[0], text: c[1] }); })));
        t.value = V[f.id] || ''; t.addEventListener('change', function () { V[f.id] = t.value; dirty(); });
      } else t = ta(V[f.id], function (x) { V[f.id] = x; if (cnt) setCnt(); }, f.q, f.max ? 4 : 2);
      t.setAttribute('data-field', f.id); t.setAttribute('aria-label', f.label);
      var setCnt = function () { var n = words(V[f.id]); cnt.textContent = n + ' of ' + f.max + ' words'; cnt.className = 'meta wc' + (n > f.max ? ' over' : ''); };
      if (cnt) setCnt();
      var tags = [f.who === 'team' && !b.team ? el('span', { class: 'team', text: 'Team only' }) : null, f.who === 'client' ? el('span', { class: 'ftag', text: 'Organisation' }) : null, f.declared ? el('span', { class: 'ftag decl', title: 'Stated by the organisation; tested in Analysis', text: 'declared' }) : null];
      return el('label', { class: 'fld' + (f.who === 'team' ? ' teamonly' : ''), 'data-who': f.who || 'both' }, [el('span', { class: 'fl2' }, [el('b', { text: f.label })].concat(tags).concat([cnt])), t, v && v.standin ? el('span', { class: 'meta sim', text: 'Carried over from ' + v.standin + '. Save to keep it, or change it.' }) : null]);
    };
    if (b.note) wrap.appendChild(el('p', { class: 'meta bnote', id: 'boxNote', text: b.note }));
    vis(b).forEach(function (f) { wrap.appendChild(fieldEl(f)); });
    // Purpose, after step 2's route: what it is for, suggested from what the system produces (accept or edit)
    if (b.id === 'service') { var outs = routeList('outputs'); if (outs.length) { var tf = wrap.querySelector('[data-field="for"]'); wrap.insertBefore(el('div', { class: 'rsug', id: 'purposeSug' }, [el('span', { class: 'meta', text: 'Suggested from what it produces (step 2). Tap to use:' })].concat(outs.map(function (o) { return el('button', { class: 'chip', 'data-sug': o, onclick: function () { var cur = String(V['for'] || '').trim(); V['for'] = cur ? cur.replace(/\.?$/, '; ') + lcf(o) + '.' : o + '.'; tf.value = V['for']; grow(tf); dirty(); } }, [o]); }))), wrap.firstChild); } }
    var pf = pageF(b);
    if (pf.length) {
      var filled = pf.filter(function (f) { return String(V[f.id] || '').trim(); }).length;
      var det = el('details', { class: 'fpage', open: compact ? null : true }, [el('summary', { text: 'On its page · ' + filled + ' of ' + pf.length + ' answered' })]);
      pf.forEach(function (f) { det.appendChild(fieldEl(f)); });
      wrap.appendChild(det);
    }
    if (b.depth) wrap.appendChild(depthControl());
    if (b.tool) wrap.appendChild(toolLists());
    if (b.checked) wrap.appendChild(el('p', { class: 'meta checked', 'data-checked': b.id, text: 'Checked in Analysis against: ' + b.checked }));
    var save = async function () {
      var over = b.fields.filter(function (f) { return f.max && words(V[f.id]) > f.max; })[0];
      if (over) { msg.className = 'msg bad'; msg.textContent = over.label + ' is over ' + over.max + ' words. Please shorten it.'; return false; }
      if (!b.fields.some(function (f) { return !f.hidden && String(V[f.id] || '').trim(); })) { msg.className = 'msg bad'; msg.textContent = 'Write at least one line before saving.'; return false; }
      try {
        msg.className = 'msg'; msg.textContent = 'Saving…';
        var r = row('frame'), c = clone((r && r.content) || {}); c.answers = c.answers || {};
        var p = c.answers[b.id] && c.answers[b.id].fields ? c.answers[b.id] : {}, pf = p.fields || {}, now = new Date().toISOString();
        var nf = {}; b.fields.forEach(function (f) { nf[f.id] = String(V[f.id] || '').trim(); });
        var changed = b.fields.some(function (f) { return (pf[f.id] || '') !== nf[f.id]; });
        if (!changed && p.fields) { S.dirty = false; msg.className = 'msg good'; msg.textContent = 'No changes to save.'; return true; }
        var onlyCarried = !p.fields && vis(b).every(function (f) { return !nf[f.id] || carried.indexOf(f.id) >= 0; });
        var way = onlyCarried ? { way: 'tool' } : { way: 'write' };
        var from = (p.from || []).filter(function (x) { return x.way !== way.way; }).concat([way]);
        var past = (p.past || []).slice(0); if (changed && p.fields) past.unshift({ fields: pf, by: p.by, at: p.at });
        c.answers[b.id] = Object.assign({}, c.answers[b.id] || {}, { fields: nf, from: changed ? from : (p.from || from), by: changed ? myName() : (p.by || myName()), at: changed ? now : (p.at || now), past: past.slice(0, 20) });
        if (b.id === 'requires' && RUNS) c.answers.requires.runs = RUNS.filter(function (x) { return String(x.t || '').trim(); });
        var all = MAINB.every(function (y) { var x = c.answers[y.id]; return x && x.fields && vis(y).every(function (f) { return String(x.fields[f.id] || '').trim(); }); });
        var d = await api({ action: 'p_save', tile_key: 'frame', status: all ? 'done' : 'partly', summary: 'Changed: ' + b.name, content: c, base_version: r ? r.version : null });
        S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'frame'; }); S.data.tiles.push(d.tile);
        S.dirty = false; msg.className = 'msg good'; msg.textContent = 'Saved. It now shows on the model and the canvas.';
        source.textContent = fromLine(c.answers[b.id]);
        return true;
      } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; return false; }
    };
    var past = a.past || [];
    var pbox = el('div', { class: 'fpast', hidden: true }, past.map(function (p) { return el('div', { class: 'fl' }, [el('span', { text: vis(b).map(function (f) { return p.fields && p.fields[f.id]; }).filter(Boolean).join(' · ') }), el('span', { class: 'meta', text: (p.by || '') + (p.at ? ', ' + when(p.at) : '') })]); }));
    var source = el('span', { class: 'meta', id: 'ffrom', text: a.fields ? fromLine(a) : carried.length ? 'Partly carried over; not yet saved here.' : 'Not answered yet.' });
    return { fields: wrap, msg: msg, save: save, source: source, past: past.length ? el('button', { class: 'link', text: 'Earlier wordings (' + past.length + ')', onclick: function () { pbox.hidden = !pbox.hidden; } }) : null, pbox: pbox, V: V, helpDone: helpDone };
  }
  function waysEl(b, compact, helpDone) {
    var why = { options: b.listen ? 'Opens once we have heard how we might help.' : !helpDone ? 'Opens once How we might help is answered.' : 'Questions, a check, then options. Coming next.',
      write: b.listen ? 'Note what they say, in their words.' : 'Type it yourself.', extract: 'From a document or notes. Coming next.', workshop: 'Everyone answers on phones. Coming next.' };
    return el('div', { class: 'ways' + (compact ? ' compact' : ''), role: 'group', 'aria-label': 'Ways to answer' }, ['options', 'write', 'extract', 'workshop'].map(function (w) {
      var on = w === 'write';
      return el('button', { class: 'way' + (on ? ' on' : ' off'), 'data-way': w, 'aria-pressed': String(on), disabled: !on, title: on ? '' : 'Not available yet' }, [el('span', { class: 'ico', html: ICON[w] }), el('span', { class: 'wt' }, [el('b', { text: WAYS[w] }), compact ? null : el('span', { text: why[w] })])]);
    }));
  }
  // The protocol's depth: the same setting the header shows, set here (Project shows it).
  function depthControl() {
    var dr = row('depth'), lvl = dr && dr.content && dr.content.level ? Number(dr.content.level) : 3;
    var sel = el('select', { id: 'pDepth', 'aria-label': 'Agreed depth of evidence for this engagement' }, [1, 2, 3, 4, 5].map(function (i) { return el('option', { value: String(i), text: 'Level ' + i + ': ' + EVL[i][1].toLowerCase() }); }));
    sel.value = String(lvl);
    sel.addEventListener('change', async function () {
      try { var d = await api({ action: 'p_save', tile_key: 'depth', status: 'done', summary: 'Depth ' + sel.value + ' (set in the protocol)', base_version: dr ? dr.version : null, content: { level: Number(sel.value), set_at: new Date().toISOString(), from: 'protocol' } });
        S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'depth'; }); S.data.tiles.push(d.tile); dr = d.tile; if (window.VTNav) window.VTNav.init({ active: 'problem', depthRow: d.tile, onDepth: function (t) { S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'depth'; }); S.data.tiles.push(t); render(); } });
      } catch (e) { alert(e.message); }
    });
    return el('div', { class: 'fld' }, [el('span', { class: 'fl2' }, [el('b', { text: 'Agreed depth of evidence' })]), sel, el('span', { class: 'meta', text: 'The level the evidence behind the key statements should reach by the end, from 1 (said) to 5 (tested end to end, or confirmed across sources). Each step and part shows the level reached against this.' })]);
  }
  // The tool for this engagement: two lists, shown and hidden, each with its reason and a control.
  function toolLists() {
    var SC = window.VTScope; if (!SC) return null;
    var items = []; SC.catalogue().forEach(function (g) { g.items.forEach(function (x) { items.push(x); }); });
    var hid = items.filter(function (x) { return !SC.on(x.id); }), shown = items.filter(function (x) { return SC.on(x.id); });
    var row1 = function (x, isShown) { return el('div', { class: 'tlrow', 'data-tl': x.id }, [el('span', {}, [el('b', { text: x.n }), SC.why(x.id) ? el('span', { class: 'meta', text: ' · ' + SC.why(x.id) }) : null]), SC.locked && SC.locked(x.id) ? el('span', { class: 'meta', text: 'Always shown' }) : el('button', { class: 'btn sm', 'data-reveal': isShown ? null : x.id, 'data-hide': isShown ? x.id : null, text: isShown ? 'Hide' : 'Reveal', onclick: async function () {
      var why = prompt(isShown ? 'Why hide “' + x.n + '” for this engagement? It keeps running in the background.' : 'Why reveal “' + x.n + '”? It opens already up to date.', '') || '';
      try { await SC.change(VTX, x.id, !isShown, why); render(); } catch (e) { alert(e.message); }
    } })]); };
    return el('div', { class: 'toollists' }, [el('p', { class: 'meta', text: 'Nothing is switched off. Hidden parts keep running in the background on the shared map, so they are up to date the moment they are revealed. Reveal them here or in Project, under What’s shown. Conditions and capitals are never hidden from the record.' }),
      el('details', { open: true }, [el('summary', { text: 'Hidden for this engagement (' + hid.length + ')' })].concat(hid.length ? hid.map(function (x) { return row1(x, false); }) : [el('p', { class: 'meta', text: 'Nothing is hidden.' })])),
      el('details', {}, [el('summary', { text: 'Shown (' + shown.length + ')' })].concat(shown.map(function (x) { return row1(x, true); })))]);
  }
  // Box 7 shows the kind of reason chosen in How we might help, beside the question.
  function whyLine(b) { if (b.id !== 'question' || !window.VTBox) return null; var t = window.VTBox.kindLine(); return t ? el('p', { class: 'meta whyline', id: 'whyLine' }, [el('b', { text: 'Why they came: ' }), t]) : null; }
  // Passages sent here from another box, each with its source, for the team to use or leave.
  function inboxEl(b) {
    var a = frameAnswers()[b.id], ib = (a && a.inbox) || []; if (!ib.length) return null;
    return el('div', { class: 'panel inbox', 'data-inbox': b.id }, [el('b', { text: 'Sent here from How we might help' })].concat(ib.map(function (x) { var src = srcById(x.src); return el('div', { class: 'fl' }, [el('span', { text: '“' + x.text + '”' }), el('span', { class: 'meta', text: (src ? src.title : 'a source') + (x.by ? ' · ' + x.by : '') })]); })));
  }
  var boxNo = function (b) { var st = stepOf(b.id); return st ? 'Step ' + st.n + ' of ' + FR.steps.length + ': ' + st.name : ''; };
  var nextOf = function (b) { return boxDef(ORDER[ORDER.indexOf(b.id) + 1]); };
  var prevOf = function (b) { return boxDef(ORDER[ORDER.indexOf(b.id) - 1]); };

  // ---------- the drawer: a box over the page, which stays in view ----------
  var drawer = null;
  function closeDrawer(force) {
    if (!drawer) return true;
    if (!force && S.dirty && !confirm('You have unsaved changes in this box. Close without saving?')) return false;
    S.dirty = false; drawer.remove(); drawer = null;
    Array.prototype.forEach.call(document.querySelectorAll('.boxon'), function (x) { x.classList.remove('boxon'); });
    return true;
  }
  function openBox(id) {
    var b = boxDef(id); if (!b) return;
    if (b.sign) return go('box=' + id); // signing needs the full page
    if (((id === 'help' || id === 'question') && window.VTBox) || (id === 'system' && window.VTRoute)) { closeDrawer(true); return go('box=' + id); } // step 1 runs on the box page template (boxes 8 and 7)
    if (!closeDrawer()) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-box="' + id + '"]'), function (x) { x.classList.add('boxon'); });
    var E = boxEditor(b, null, true), g = grp(b.g), nx = nextOf(b), pv = prevOf(b);
    var panel = el('aside', { class: 'fdrawer', role: 'dialog', 'aria-label': b.name }, [
      el('div', { class: 'spread', style: 'align-items:center' }, [el('span', { class: 'meta' }, [el('b', { style: 'color:' + g.c, text: g.name }), document.createTextNode(' · ' + boxNo(b))]),
        el('span', { class: 'row' }, [pv ? el('button', { class: 'link', 'data-nav': 'prev', text: '‹ previous', onclick: function () { openBox(pv.id); } }) : null, nx ? el('button', { class: 'link', 'data-nav': 'next', text: 'next ›', onclick: function () { openBox(nx.id); } }) : null, el('button', { class: 'link', id: 'dclose', 'aria-label': 'Close', text: '✕', onclick: function () { closeDrawer(); } })])]),
      el('h2', { class: 'wide', text: b.name }), el('p', { class: 'meta dq', text: b.q }), whyLine(b), inboxEl(b),
      waysEl(b, true, E.helpDone), el('div', { class: 'panel', style: 'margin-top:12px' }, [E.fields,
        el('div', { class: 'spread', style: 'margin-top:10px;align-items:center' }, [E.source, el('span', { class: 'row' }, [E.past,
          el('button', { class: 'btn sm', id: 'dsave', text: 'Save', onclick: async function () { if (await E.save()) refreshBehind(); } }),
          el('button', { class: 'btn sm solid', id: 'dnext', text: nx ? 'Save and next ›' : 'Save and close', onclick: async function () { if (await E.save()) { refreshBehind(); if (nx) openBox(nx.id); else closeDrawer(true); } } })])]), E.msg, E.pbox]),
      el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'link', id: 'dfull', text: 'Open the full page ›', onclick: function () { if (closeDrawer()) go('box=' + b.id); } })])]);
    drawer = el('div', { class: 'fdim', onclick: function (e) { if (e.target === drawer) closeDrawer(); } }, [panel]);
    document.body.appendChild(drawer);
    var t = panel.querySelector('textarea'); if (t) t.focus();
  }
  // redraw the page behind the drawer, keeping the drawer open
  function refreshBehind() { var d = drawer; drawer = null; render(); drawer = d; if (d) document.body.appendChild(d); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer && veil.hidden) closeDrawer(); });

  // ---------- the full page for a box ----------
  function renderBox(id) {
    var b = boxDef(id); if (!b) return renderCanvas();
    if ((id === 'help' || id === 'question') && window.VTBox) return window.VTBox.render(main, VTX, id);
    if (id === 'system' && window.VTRoute && !S.plain) return window.VTRoute.render(main, VTX); // step 2: the Define route and the map
    var g = grp(b.g), nx = nextOf(b), pv = prevOf(b), E = boxEditor(b);
    var rib = el('div', { class: 'ribbon', 'aria-hidden': 'true' }, ORDER.map(function (k) { var x = boxDef(k); return el('i', { class: k === id ? 'c' : answered(x) ? 'd' : '', title: x.name }); }));
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:8px;align-items:center' }, [
      el('span', { class: 'row' }, [el('button', { class: 'btn sm', text: '‹ The six steps', onclick: function () { go('canvas'); } }), el('span', { class: 'meta' }, [el('b', { style: 'color:' + g.c, text: g.name }), document.createTextNode(' · ' + boxNo(b))])]),
      el('span', { class: 'row' }, [pv ? el('button', { class: 'link', 'data-nav': 'prev', text: '‹ ' + pv.name, onclick: function () { go('box=' + pv.id); } }) : null, nx ? el('button', { class: 'link', 'data-nav': 'next', text: nx.name + ' ›', onclick: function () { go('box=' + nx.id); } }) : null])]));
    main.appendChild(rib);
    // the small canvas, for jumping
    var mini = el('nav', { class: 'mini no-print', 'aria-label': 'Jump to a box' }, [el('div', { class: 'meta', style: 'font-weight:700;margin-bottom:6px', text: 'Jump to a box' })]);
    var cell = function (k, full) { var x = boxDef(k); return el('button', { class: 'mcell' + (full ? ' full' : '') + (k === id ? ' c' : answered(x) ? ' d' : ''), title: x.name, 'aria-label': x.name, onclick: function () { go('box=' + k); } }); };
    var mg = el('div', { class: 'mgrid' }, [cell('system', true), cell('service', true), cell('value'), cell('exposure'), cell('requires', true), cell('question'), cell('help'), cell('good'), cell('gap')]);
    mini.appendChild(mg); mini.appendChild(el('div', { class: 'mband' }, BANDB.map(function (x) { return cell(x.id); }))); mini.appendChild(el('div', { class: 'mband prot' }, PROTB.map(function (x) { return cell(x.id); })));
    var draws = el('aside', { class: 'panel ctx' }, [el('b', { text: 'What this box draws on' }), el('div', { class: 'meta', text: 'Already on the frame' })]);
    (b.draws || []).forEach(function (k) { var x = boxDef(k), v = fieldVal(x, vis(x)[0]); draws.appendChild(el('div', { class: 'ci' }, [el('b', { text: x.name }), el('span', { text: v ? v.text : 'Not answered yet.' })])); });
    var centre = el('div', { class: 'bcentre' }, [el('h1', { class: 'wide', style: 'font-size:clamp(24px,2.8vw,32px)', text: b.name }), el('p', { class: 'lead bq', text: b.q }), whyLine(b), inboxEl(b),
      b.team ? el('p', { class: 'meta', text: 'Team only: not shown to the organisation, and left out of reports for the organisation.' }) : null,
      waysEl(b, false, E.helpDone)]);
    if (b.listen) {
      var notesF = b.fields.filter(function (f) { return f.id === 'notes'; })[0];
      var nt = ta(E.V.notes, function (x) { E.V.notes = x; }, notesF.q, 5); nt.setAttribute('data-field', 'notes');
      centre.appendChild(el('div', { class: 'two2' }, [el('div', { class: 'panel' }, [el('h4', { text: 'Notes as they talk' }), nt]), el('div', { class: 'panel' }, [el('h4', { text: 'Questions to ask' }), el('p', { class: 'meta', text: 'Ask these only if they have not already said it.' }), el('ul', { class: 'lq' }, FR.listen.map(function (q) { return el('li', { text: q }); }))])]));
    }
    centre.appendChild(el('div', { class: 'panel fans' }, [el('div', { class: 'spread' }, [el('h4', { style: 'margin:0', text: 'On the model and the canvas' }), E.source]), E.fields, E.msg, E.past ? el('div', { style: 'margin-top:8px' }, [E.past]) : null, E.pbox]));
    main.appendChild(el('div', { class: 'bpage' }, [mini, centre, b.band || !(b.draws || []).length ? null : draws]));
    if (b.sign) agreementTail();
    main.appendChild(el('div', { class: 'stickysave no-print' }, [el('span', { class: 'meta', id: 'fdirty', text: '' }),
      el('span', { class: 'row' }, [el('button', { class: 'btn', id: 'fsave', text: 'Save', onclick: async function () { if (await E.save()) { render(); } } }),
        el('button', { class: 'btn solid', id: 'fnext', text: nx ? 'Save and next: ' + nx.name + ' ›' : 'Save and back to the six steps', onclick: async function () { if (await E.save()) { if (nx) go('box=' + nx.id); else go('canvas'); } } })])]));
  }

  // ---------- Agreement and signing: questions sent back, signed versions, and signing ----------
  function agreementTail() {
    var fr = S.data.frames || [], last = fr[0];
    var two = el('div', { class: 'fp' });
    var qbox = el('div', { class: 'panel' }, [el('h4', { text: 'Questions sent back' })]);
    var qs = S.data.questions || [];
    if (!qs.length) qbox.appendChild(el('p', { class: 'meta', text: 'None.' }));
    qs.forEach(function (q) { var t = tileDef(q.tile_key); qbox.appendChild(el('div', { class: 'fl' }, [el('b', { text: t ? t.name : q.tile_key }), el('span', { text: q.text + (q.answer ? ' Answer: ' + q.answer : '') }), el('span', { class: 'meta', text: QSTATE[q.status] })])); });
    two.appendChild(qbox);
    var vbox = el('div', { class: 'panel' }, [el('h4', { text: 'Signed versions' })]), ul = el('ul', { class: 'vers' });
    if (!fr.length) ul.appendChild(el('li', { text: 'None yet.' }));
    fr.forEach(function (f) { ul.appendChild(el('li', {}, [el('span', { text: 'Version ' + f.version + ', ' + when(f.signed_at) + ', signed by ' + f.signed_by + (f.note ? '. ' + f.note : '') }), el('button', { class: 'btn sm', text: 'Look at it', onclick: function () { viewFrame(f.version); } })])); });
    vbox.appendChild(ul); two.appendChild(vbox);
    main.appendChild(two);
    var nb = boundaryTested();
    var C = [['specific', 'Each box is specific: it names this service, these people and these dates, not services in general.'], ['consistent', 'The boxes are consistent with each other: the boundary, the stakeholders and what must not happen describe the same thing.'], ['complete', 'Every box is answered, or says why not, and every question sent back is answered, turned into a new version, or kept open on purpose.'], ['recognisable', 'Frontline staff would recognise the wording.']];
    var checks = {}, sbox = el('div', { class: 'panel no-print' }, [el('h4', { text: 'Sign the frame as a new version' })]), list = el('div', { class: 'checks' });
    C.forEach(function (c) { var cb = el('input', { type: 'checkbox' }); cb.addEventListener('change', function () { checks[c[0]] = cb.checked; }); list.appendChild(el('label', {}, [cb, el('span', { text: c[1] })])); });
    sbox.appendChild(list);
    sbox.appendChild(el('p', { class: nb >= 2 ? 'ok' : 'no', style: 'margin:10px 0', text: nb >= 2 ? 'The boundary has been tested against the six rules for ' + nb + ' candidates.' : 'Signing is refused until the chosen boundary has been tested against all six rules and against at least one other candidate, in the Boundary tool (All tools).' }));
    var by = el('input', { type: 'text', placeholder: 'Signed by (name and role)' }), note = el('input', { type: 'text', placeholder: 'Note for this version (optional)' }), m = el('div', { class: 'msg' });
    sbox.appendChild(el('div', { class: 'two' }, [by, note]));
    sbox.appendChild(el('div', { class: 'row', style: 'margin-top:12px' }, [el('button', { class: 'btn solid', text: 'Sign version ' + ((last ? last.version : 0) + 1), onclick: async function () {
      try { var d = await api({ action: 'p_sign', checks: checks, signed_by: by.value, note: note.value }); S.data.frames.unshift(d.frame); render(); }
      catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
    } })]));
    sbox.appendChild(m);
    main.appendChild(sbox);
  }
  // ---------- History: every saved change, and the signed versions ----------
  async function showHistory() {
    var body = el('div'), fr = S.data.frames || [];
    modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'History of the frame' }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })]), body]);
    body.appendChild(el('h4', { style: 'margin:16px 0 6px', text: 'Signed versions' }));
    if (!fr.length) body.appendChild(el('p', { class: 'meta', text: 'None yet. The frame is signed from Agreement and signing.' }));
    fr.forEach(function (f) { body.appendChild(el('div', { class: 'fl' }, [el('b', { text: 'Version ' + f.version }), el('span', { text: when(f.signed_at) + ', signed by ' + f.signed_by + (f.note ? '. ' + f.note : '') }), el('button', { class: 'btn sm', text: 'Look at it', onclick: function () { viewFrame(f.version); } })])); });
    body.appendChild(el('h4', { style: 'margin:18px 0 6px', text: 'Every saved change' }));
    var hb = el('div', { class: 'hlist' }, [el('p', { class: 'meta', text: 'Loading…' })]); body.appendChild(hb);
    var h = []; try { h = (await api({ action: 'p_history', tile_key: 'frame' })).history || []; } catch (e) { hb.innerHTML = ''; hb.appendChild(el('p', { class: 'meta', text: e.message })); return; }
    hb.innerHTML = '';
    if (!h.length) hb.appendChild(el('p', { class: 'meta', text: 'Nothing saved on the frame yet.' }));
    h.forEach(function (v) { hb.appendChild(el('div', { class: 'fl' }, [el('b', { text: 'Save ' + v.version }), el('span', { text: (v.summary || '') + ' · ' + (v.saved_by || '') + ', ' + when(v.saved_at) }), el('button', { class: 'btn sm', text: 'Look at it', onclick: function () { viewSaved(v.version); } })])); });
  }
  async function viewSaved(v) {
    var x; try { x = (await api({ action: 'p_version', tile_key: 'frame', version: v })).version; } catch (e) { return alert(e.message); }
    modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'The frame at save ' + v }), el('span', { class: 'row' }, [el('button', { class: 'btn sm', text: '‹ History', onclick: showHistory }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })])]),
      el('p', { class: 'meta', text: (x.summary || '') + '. Saved ' + when(x.saved_at) + ' by ' + x.saved_by + '. A copy: it cannot be edited here.' }),
      posterGrid([{ tile_key: 'frame', content: x.content }], true)]);
  }
  async function viewFrame(v) {
    var f; try { f = (await api({ action: 'p_frame', version: v })).frame; } catch (e) { return alert(e.message); }
    modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'The frame, signed version ' + f.version }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })]),
      el('p', { class: 'meta', text: 'Signed ' + when(f.signed_at) + ' by ' + f.signed_by + '. Locked: this copy cannot be edited.' + (f.note ? ' ' + f.note : '') }),
      posterGrid((f.snapshot && f.snapshot.tiles) || [], true)]);
  }

  // ---------- differing views ----------
  function renderViews() {
    head(S.data.session.name || 'Frame', 'Differing views', 'Every question put to the room, with what people wrote. Each person writes alone; nobody sees the others until the answers are revealed. Differences are kept, not merged. To put a new question, open a tile and use “Ask the room”.');
    var R = S.data.rounds || [];
    if (!R.length) { main.appendChild(el('p', { class: 'meta', style: 'margin-top:16px', text: 'No questions have been put to the room yet.' })); return; }
    R.forEach(function (r) {
      var t = tileDef(r.tile_key);
      var box = el('div', { class: 'panel' }, [el('div', { class: 'spread' }, [el('span', { class: 'label', text: t ? t.name : r.tile_key }), el('span', { class: 'meta', text: { open: 'People are writing', revealed: 'Revealed', closed: 'Closed' }[r.status] + ', ' + r.count + ' answers, ' + when(r.opened_at) })]), el('p', { style: 'font-weight:700;margin:8px 0', text: r.prompt })]);
      if (r.status === 'open') box.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn warm sm', text: 'Reveal the answers', onclick: async function () { await api({ action: 'p_round_reveal', round_id: r.id }); await refreshRounds(); render(); } }), el('button', { class: 'btn sm', text: 'Open the tile', onclick: function () { go('tile=' + r.tile_key); } })]));
      else { var ul = el('ul', { class: 'ans' }); r.answers.forEach(function (a) { ul.appendChild(el('li', { text: a })); }); box.appendChild(ul); }
      main.appendChild(box);
    });
    poll();
  }

  // =====================================================================
  // Reasons: sources, what is found in them, review, the four tiles,
  // the first-call guide, the summary, and the toolkit.
  // Nothing is typed into these tiles: entries come from sources and are
  // accepted by a consultant. Every accepted entry shows where it came from.
  // =====================================================================
  var cap = function (x) { x = String(x || ''); return x.charAt(0).toUpperCase() + x.slice(1); };
  var KINDS = { transcript: 'Transcript', document: 'Document', notes: 'Team notes', recording: 'Recording', image: 'Photo' };
  function paras(body) {
    var p = String(body || '').split(/\n\s*\n/);
    if (p.length < 3) p = String(body || '').split(/\n/);
    return p.map(function (x) { return x.trim(); }).filter(Boolean);
  }
  var fieldOf = function (tile, id) { var t = tileDef(tile); return t && (t.fields || []).filter(function (f) { return f.id === id; })[0]; };
  var shortWho = function (src) { return src ? (src.speaker || src.title).replace(/^The trust’s /, '') : 'typed in the Lab'; };
  var rTiles = function () { return VIS().filter(function (t) { return t.g === 'r' && t.fields; }); };
  function srcChip(p) {
    var src = p.source_id ? srcById(p.source_id) : null;
    if (!src) return el('span', { class: 'srcchip typed', text: 'Consultant, typed' });
    return el('a', { class: 'srcchip k-' + src.kind, href: '#source=' + src.id, title: p.excerpt || '', onclick: function (e) { e.preventDefault(); S.focus = p.id; go('source=' + src.id); },
      text: KINDS[src.kind] + ' · ' + shortWho(src) + (p.para != null ? ' · ¶' + (p.para + 1) : '') });
  }
  function valueEl(p, f) {
    if (f && f.type === 'quote') return el('div', { class: 'qv', text: '“' + p.value.replace(/^[“"]|[”"]$/g, '') + '”' });
    return el('div', { class: 'tv' }, [p.choice ? el('b', { text: cap(p.choice.replace(/^(Wanted|Harm), [^:]+: /, '')) + (p.value && p.value !== p.choice ? '. ' : '') }) : null, p.value && p.value !== p.choice ? document.createTextNode(p.value) : null]);
  }
  async function decide(p, status, value, choice) {
    try {
      var body = { action: 'pr_decide', id: p.id, status: status };
      if (value != null) body.value = value; if (choice !== undefined) body.choice = choice;
      var d = await api(body);
      S.data.proposals = S.data.proposals.map(function (x) { return x.id === p.id ? d.proposal : x; });
      render();
    } catch (e) { alert(e.message); }
  }
  // One entry: what it says, where it came from, and what can be done with it.
  function propCard(p, opts) {
    opts = opts || {};
    var t = tileDef(p.tile_key), f = fieldOf(p.tile_key, p.field);
    var card = el('div', { class: 'prop ' + p.status, 'data-prop': p.id });
    if (opts.label !== false) card.appendChild(el('div', { class: 'ptag', text: (t ? t.name : p.tile_key) + '  ·  ' + (f ? f.label : p.field) }));
    card.appendChild(valueEl(p, f));
    card.appendChild(el('div', { class: 'row pmeta' }, [srcChip(p), p.confidence ? el('span', { class: 'muted sm', text: 'confidence: ' + p.confidence }) : null,
      p.status === 'accepted' ? el('span', { class: 'pill ok', text: 'Accepted' }) : p.status === 'unknown' ? el('span', { class: 'pill', text: 'Not yet known' }) : p.status === 'rejected' ? el('span', { class: 'pill', text: 'Rejected' }) : el('span', { class: 'pill wait', text: 'Waiting' })]));
    if (p.status === 'waiting' || p.status === 'unknown') {
      var edit = el('div', { class: 'pedit', hidden: true });
      var vin = f && f.type !== 'quote' ? el('textarea', { rows: 2 }) : null; if (vin) vin.value = p.value;
      var cin = f && f.type === 'choice' ? el('select', {}) : null;
      if (cin) { cin.appendChild(el('option', { value: '', text: 'Choose…' })); f.options.forEach(function (o) { cin.appendChild(el('option', { value: o, text: o })); }); cin.value = p.choice || ''; }
      if (cin) edit.appendChild(cin); if (vin) edit.appendChild(vin);
      edit.appendChild(el('button', { class: 'btn sm solid', text: 'Accept as edited', onclick: function () { decide(p, 'accepted', vin ? vin.value : null, cin ? cin.value : undefined); } }));
      card.appendChild(edit);
      card.appendChild(el('div', { class: 'row pbtn no-print' }, [
        el('button', { class: 'btn sm ok', 'data-act': 'accept', text: 'Accept', onclick: function () { decide(p, 'accepted'); } }),
        f && f.type !== 'quote' ? el('button', { class: 'btn sm', text: 'Edit', onclick: function () { edit.hidden = !edit.hidden; } }) : null,
        el('button', { class: 'btn sm', 'data-act': 'reject', text: 'Reject', onclick: function () { decide(p, 'rejected'); } }),
        p.status !== 'unknown' ? el('button', { class: 'btn sm', text: 'Not yet known', onclick: function () { decide(p, 'unknown'); } }) : null]));
    } else if (p.status === 'accepted' && opts.undo) {
      card.appendChild(el('div', { class: 'row pbtn no-print' }, [el('button', { class: 'btn sm', text: 'Take out of the tile', onclick: function () { if (confirm('Take this entry out of the tile? It stays in the record as rejected.')) decide(p, 'rejected'); } })]));
    }
    return card;
  }
  var partOf = function () { return S.part && groupDef(S.part) ? S.part : 'r'; };
  // The four views of each part, as tabs under its title.
  function partTabs(g, on) {
    var gd = groupDef(g);
    return el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: '← The frame', onclick: function () { go('canvas'); } }),
      el('div', { class: 'seg ptabs' }, [['summary', 'Summary'], ['tools', 'Tools'], ['analysis', 'Analysis']].map(function (x) {
        return el('button', { 'aria-pressed': String(on === x[0]), 'data-pt': x[0], text: x[1], onclick: function () { S.part = g; if (x[0] === 'sources') { location.href = '/diagnose#sources=' + g; return; } go(x[0] + '=' + g); } }); }))]);
  }
  function backRow(extra) { if (ON_ANALYSE) return el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: '← Sources', onclick: function () { go('sources'); } }), el('div', { class: 'row' }, extra || [])]); var g = partOf(); return el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: '← ' + groupDef(g).sn, onclick: function () { go('analysis=' + g); } }), el('div', { class: 'row' }, extra || [])]); }

  // ---------- a part's Analysis: what has been found and accepted, tile by tile ----------
  function renderAnalysis(g) {
    var gd = groupDef(g);
    main.appendChild(partTabs(g, 'analysis'));
    head(S.data.session.name || 'Frame', gd.sn + ': analysis', g === 'r' ? 'What has been found in the sources and accepted, tile by tile, with where each entry came from. Nothing is typed into these tiles.' : gd.d);
    var waiting = props(null, null, 'waiting').filter(function (p) { var t = tileDef(p.tile_key); return t && t.g === g && tileOn(t); });
    if (waiting.length) main.appendChild(el('div', { class: 'row', style: 'margin-top:14px' }, [el('button', { class: 'btn sm warm', id: 'toReview', text: 'Review ' + waiting.length + (waiting.length === 1 ? ' entry' : ' entries'), onclick: function () { go('review'); } })]));
    if (g === 's') main.appendChild(el('div', { class: 'glass invlink', style: 'margin-top:16px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' }, [el('span', { text: 'What the service depends on, and where it would break, is mapped in the models, under Diagnose.' }), el('a', { class: 'btn sm', id: 'toModel', href: '/diagnose#model', text: 'Open the models' })]));
    var ft = VIS().filter(function (t) { return t.g === g && t.fields; }), ot = VIS().filter(function (t) { return t.g === g && !t.fields && !t.inv; });
    if (ft.length) { var grid = el('div', { class: 'rtiles' }); ft.forEach(function (t) { grid.appendChild(fieldTileCard(t)); }); main.appendChild(grid); }
    if (ot.length) {
      if (!ft.length) main.appendChild(el('p', { class: 'meta', style: 'margin-top:14px', text: 'These tiles are still filled in by hand. Taking entries from sources comes when this part is worked through, as Reasons has been.' }));
      var box = el('div', { class: 'col', style: 'margin-top:18px;max-width:640px' }); ot.forEach(function (t) { box.appendChild(tileCard(t)); }); main.appendChild(box);
    }
  }
  // ---------- a part's Sources: shared by all six parts ----------
  function renderPartSources(g) {
    var gd = groupDef(g);
    main.appendChild(partTabs(g, 'sources'));
    head(S.data.session.name || 'Frame', gd.sn + ': sources', 'What comes back from collection: transcripts, documents and consultant notes. Sources belong to the whole engagement: anything added here can be used in every part of Frame, and later in Diagnose, Model and Test. Open one to take words from it into a tile.');
    var waiting = props(null, null, 'waiting').filter(function (p) { var t = tileDef(p.tile_key); return t && tileOn(t); });
    main.appendChild(el('div', { class: 'row', style: 'margin-top:14px' }, [
      gd.guide ? el('button', { class: 'btn sm', text: 'First-call guide', onclick: function () { go('guide=' + g); } }) : null,
      el('button', { class: 'btn sm' + (waiting.length ? ' warm' : ''), id: 'toReview', text: waiting.length ? 'Review ' + waiting.length + (waiting.length === 1 ? ' entry' : ' entries') : 'Nothing to review', onclick: function () { go('review'); } })]));
    main.appendChild(sourcesBox());
    if (g !== 's' && !VIS().some(function (t) { return t.g === g && t.fields; })) main.appendChild(el('p', { class: 'meta', style: 'margin-top:12px', text: 'Taking words from sources into ' + gd.sn.toLowerCase() + ' comes when its tiles are set up for it. For now, sources can be read and used in Reasons.' }));
  }
  function sourcesBox(noList) {
    var box = el('div', { class: 'drop', id: 'drop' });
    var file = el('input', { type: 'file', id: 'srcfile', accept: '.txt,.md,.vtt,.srt,.docx,.pdf,.jpg,.jpeg,.png,.heic,.m4a,.mp3,.wav', hidden: true });
    file.addEventListener('change', function () { if (file.files[0]) readFile(file.files[0]); file.value = ''; });
    box.appendChild(el('div', { class: 'spread' }, [el('div', {}, [el('b', { text: 'Sources' }), el('span', { class: 'muted sm', text: '  ·  a transcript, a document, or consultant notes. Drop a file here, or:' })]),
      el('div', { class: 'row' }, [file, el('button', { class: 'btn sm warm', id: 'upload', text: 'Upload a file', onclick: function () { file.click(); } }), el('button', { class: 'btn sm', id: 'pasteSrc', text: 'Paste text or type notes', onclick: function () { sourceForm({ kind: 'notes', title: '', body: '' }); } })])]));
    box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', function () { box.classList.remove('over'); });
    box.addEventListener('drop', function (e) { e.preventDefault(); box.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
    if (noList) return box;
    var list = el('div', { class: 'srcs' });
    var S2 = S.data.sources || [];
    if (!S2.length) list.appendChild(el('p', { class: 'muted sm', style: 'margin:6px 0 0', text: 'No sources yet. After the first call, add the transcript or your notes, and any letter or brief that started this.' }));
    S2.forEach(function (x) {
      var mine = props(null, null, null).filter(function (p) { return p.source_id === x.id; });
      var acc = mine.filter(function (p) { return p.status === 'accepted'; }).length, wt = mine.filter(function (p) { return p.status === 'waiting'; }).length;
      list.appendChild(el('a', { class: 'srcc', href: '#source=' + x.id, 'data-source': x.id }, [el('span', { class: 'srcchip k-' + x.kind, text: KINDS[x.kind] }), el('div', { class: 'stt', text: x.title }),
        el('div', { class: 'muted sm', text: [x.speaker, x.source_date ? new Date(x.source_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '', x.consent].filter(Boolean).join(' · ') }),
        el('div', { class: 'sm', style: 'margin-top:6px', text: mine.length ? 'Found: ' + mine.length + ' · ' + acc + ' accepted' + (wt ? ', ' + wt + ' waiting' : '') : 'Nothing taken from it yet' })]));
    });
    box.appendChild(list);
    return box;
  }
  function loadScript(src) { return new Promise(function (ok, no) { var s2 = document.createElement('script'); s2.src = src; s2.onload = ok; s2.onerror = function () { no(new Error('Could not load the reader for this kind of file')); }; document.head.appendChild(s2); }); }
  async function readFile(fl) {
    var name = fl.name, ext = (name.split('.').pop() || '').toLowerCase(), body = '';
    var title = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    try {
      if (['txt', 'md', 'vtt', 'srt'].indexOf(ext) >= 0) body = await fl.text();
      else if (ext === 'docx') {
        if (!window.mammoth) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        body = (await window.mammoth.extractRawText({ arrayBuffer: await fl.arrayBuffer() })).value;
      } else if (ext === 'pdf') {
        if (!window.pdfjsLib) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }
        var pdf = await window.pdfjsLib.getDocument({ data: await fl.arrayBuffer() }).promise, out2 = [];
        for (var i = 1; i <= pdf.numPages; i++) { var pg = await pdf.getPage(i); var tc = await pg.getTextContent(); out2.push(tc.items.map(function (it) { return it.str; }).join(' ')); }
        body = out2.join('\n\n');
      } else {
        return alert('Recordings and photos of handwritten notes will be read once automatic reading is connected. For now, add the transcript from Teams or Zoom, or type the notes up.');
      }
    } catch (e) { return alert(e.message); }
    if (ext === 'vtt' || ext === 'srt') body = body.replace(/^WEBVTT.*$/m, '').replace(/^\d+\s*$/gm, '').replace(/^[\d:.,]+ --> [\d:.,]+.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    sourceForm({ kind: ext === 'pdf' || ext === 'docx' ? 'document' : 'transcript', title: title, body: body, file_name: name });
  }
  async function readFileText(fl) {
    var ext = (fl.name.split('.').pop() || '').toLowerCase(), body = '';
    if (['txt', 'md', 'vtt', 'srt', 'eml', 'csv'].indexOf(ext) >= 0) body = await fl.text();
    else if (ext === 'html' || ext === 'htm') { var dv = document.createElement('div'); dv.innerHTML = await fl.text(); body = dv.textContent; }
    else if (ext === 'docx') { if (!window.mammoth) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'); body = (await window.mammoth.extractRawText({ arrayBuffer: await fl.arrayBuffer() })).value; }
    else if (ext === 'pdf') {
      if (!window.pdfjsLib) { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }
      var pdf = await window.pdfjsLib.getDocument({ data: await fl.arrayBuffer() }).promise, out2 = [];
      for (var i = 1; i <= pdf.numPages; i++) { var pg = await pdf.getPage(i); var tc = await pg.getTextContent(); out2.push(tc.items.map(function (it) { return it.str; }).join(' ')); }
      body = out2.join('\n\n');
    } else throw new Error('This kind of file cannot be read here. Word, PDF and text files can; for anything else, paste the words in.');
    if (ext === 'vtt' || ext === 'srt') body = body.replace(/^WEBVTT.*$/m, '').replace(/^\d+\s*$/gm, '').replace(/^[\d:.,]+ --> [\d:.,]+.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!body.trim()) throw new Error('No words were found in this file.');
    return body;
  }
  function sourceForm(x) {
    var kind = el('select', { id: 'sKind' }); ['transcript', 'document', 'notes'].forEach(function (k) { kind.appendChild(el('option', { value: k, text: KINDS[k] })); }); kind.value = x.kind;
    var title = el('input', { type: 'text', id: 'sTitle', value: x.title || '', placeholder: 'Title, for example: First call, medical director' });
    var spk = el('input', { type: 'text', id: 'sSpeaker', placeholder: 'Who said or wrote it' }), role = el('input', { type: 'text', id: 'sRole', placeholder: 'Their role' });
    var dt = el('input', { type: 'date', id: 'sDate' }), cons = el('input', { type: 'text', id: 'sConsent', placeholder: 'Consent, for example: recorded with consent' });
    var body = el('textarea', { id: 'sBody', rows: 10, placeholder: 'The text of the source' }); body.value = x.body || '';
    var m = el('div', { class: 'msg' });
    modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'Add a source' }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })]),
      el('p', { class: 'meta', text: 'A source is kept as it is and never edited. Check the details, then add it.' }),
      el('div', { class: 'two' }, [kind, title]), el('div', { class: 'two', style: 'margin-top:8px' }, [spk, role]), el('div', { class: 'two', style: 'margin-top:8px' }, [dt, cons]),
      el('div', { style: 'margin-top:8px' }, [body]),
      el('div', { class: 'row', style: 'margin-top:12px' }, [el('button', { class: 'btn solid', id: 'sAdd', text: 'Add the source', onclick: async function () {
        try {
          var d = await api({ action: 's_add', kind: kind.value, title: title.value, speaker: spk.value, role: role.value, source_date: dt.value, consent: cons.value, file_name: x.file_name || '', body: body.value });
          S.data.sources.push(d.source); closeModal(); go('source=' + d.source.id);
        } catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
      } })]), m]);
  }

  // ---------- one tile, as a card on the Reasons page ----------
  function fieldTileCard(t) {
    var st = stateOf(t.id), acc = props(t.id, null, 'accepted'), wt = props(t.id, null, 'waiting');
    var core = t.fields.filter(function (f) { return f.core; }), have = core.filter(function (f) { return acc.some(function (p) { return p.field === f.id; }); }).length;
    var card = el('div', { class: 'glass rtile' + (t.team ? ' teamcard' : ''), 'data-rtile': t.id }, [el('div', { class: 'spread' }, [
      el('a', { class: 'rtn', href: '#tile=' + t.id, text: t.name }), el('span', { class: 'row', style: 'gap:8px' }, [t.team ? el('span', { class: 'team', text: 'Team only' }) : null,
        el('span', { class: 'pill ' + (st === 'done' ? 'ok' : st === 'partly' ? 'part' : ''), text: st === 'done' ? 'Done' : st === 'partly' ? have + ' of ' + core.length : 'Not started' })])])]);
    var gaps = [];
    t.fields.forEach(function (f) {
      var ps = acc.filter(function (p) { return p.field === f.id; });
      if (!ps.length) { if (f.core || f.ask) gaps.push(f); return; }
      var fl = el('div', { class: 'fld' }, [el('div', { class: 'flab', text: f.label })]);
      ps.forEach(function (p) { fl.appendChild(valueEl(p, f)); fl.appendChild(el('div', { class: 'row', style: 'margin:4px 0 6px' }, [srcChip(p)])); });
      card.appendChild(fl);
    });
    if (gaps.length) {
      var gp = el('div', { class: 'fld gaps' }, [el('div', { class: 'flab', text: 'Not found yet' })]);
      gaps.slice(0, t.id === 'firstview' ? 3 : 4).forEach(function (f) { gp.appendChild(el('div', { class: 'gap' }, [el('span', { text: f.label }), f.ask ? el('div', { class: 'ask' }, [el('span', { class: 'muted', text: 'Ask next: ' }), document.createTextNode(f.ask)]) : null])); });
      if (gaps.length > (t.id === 'firstview' ? 3 : 4)) gp.appendChild(el('div', { class: 'muted sm', text: 'and ' + (gaps.length - (t.id === 'firstview' ? 3 : 4)) + ' more' }));
      card.appendChild(gp);
    }
    if (wt.length) card.appendChild(el('a', { class: 'waitln', href: '#review', text: wt.length + (wt.length === 1 ? ' entry' : ' entries') + ' waiting for review' }));
    return card;
  }

  // ---------- one tile, opened ----------
  function renderFieldTile(t) {
    main.appendChild(backRow([navNext(t)]));
    main.appendChild(el('p', { class: 'crumb', text: 'Problem  ›  Reasons' }));
    main.appendChild(el('h1', { class: 'wide tname' }, [document.createTextNode(t.name), t.team ? el('span', { class: 'team', text: 'Team only' }) : null]));
    main.appendChild(el('div', { class: 'tq', text: t.q }));
    var sn1 = splitNote(t); if (sn1) main.appendChild(sn1);
    if (t.id === 'kind' || t.id === 'markers') {
      var ex = t.id === 'kind' ? 'Prompts from the clinic. Reaching something wanted: going on a diet (improve now); thinking of taking up running (an opportunity); a marathon next year (a goal with a date). Avoiding harm: chest pain (gone wrong); a yearly PSA test, or a family history (worried it might go wrong); jabs before a trip (a known pressure coming).'
        : 'Routine or triggered: a yearly check or a symptom; an annual review or an incident. Whose idea: booked it themselves, or referred by the GP; the sponsor chose to come, or the regulator sent them. How far: none yet (“what should I do about my knee?”); chosen, not started (a diet: check with your GP first); under way (six weeks in and feeling dizzy). Whose choice: their own, or told to (the surgeon says lose two stone first; headquarters ordered the restructure).';
      var mp = el('p', { class: 'gmore', hidden: true, text: ex });
      var mt = el('button', { class: 'gplus no-print', 'aria-expanded': 'false', text: '+ Examples', onclick: function () { var o = mp.hidden; mp.hidden = !o; mt.textContent = o ? '− Examples' : '+ Examples'; } });
      main.appendChild(el('div', { style: 'margin-top:10px' }, [mt, mp]));
    }
    if (t.id === 'kind') main.appendChild(sixGrid());
    t.fields.forEach(function (f) {
      var box = el('div', { class: 'panel ffield', 'data-field': f.id }, [el('div', { class: 'spread' }, [el('h3', { text: f.label }), f.core ? el('span', { class: 'muted sm', text: 'Needed' }) : null]), f.look ? el('p', { class: 'meta', text: f.look }) : null]);
      var ps = props(t.id, f.id).filter(function (p) { return p.status !== 'rejected'; });
      ps.sort(function (a, b) { return (a.status === 'accepted' ? 0 : 1) - (b.status === 'accepted' ? 0 : 1); });
      ps.forEach(function (p) { box.appendChild(propCard(p, { label: false, undo: true })); });
      if (!ps.some(function (p) { return p.status === 'accepted'; })) box.appendChild(el('div', { class: 'gap' }, [el('span', { text: 'Not found yet' }), f.ask ? el('div', { class: 'ask' }, [el('span', { class: 'muted', text: 'Ask next: ' }), document.createTextNode(f.ask)]) : null]));
      if (f.type !== 'quote') box.appendChild(writeIn(t, f));
      else box.appendChild(el('p', { class: 'muted sm no-print', text: 'Words quoted as said come only from a source: open a source and select the words.' }));
      main.appendChild(box);
    });
  }
  function sixGrid() {
    var acc = props('kind', null, 'accepted'), opts = fieldOf('kind', 'main').options;
    var mark = function (i) { var m = acc.filter(function (p) { return p.choice === opts[i]; })[0]; return m ? (m.field === 'main' ? 'on' : 'on2') : ''; };
    var cell = function (i) { var m = acc.filter(function (p) { return p.choice === opts[i]; })[0]; return el('div', { class: 'c ' + mark(i), text: m ? (m.field === 'main' ? 'Main' : 'Second') : '' }); };
    return el('div', { class: 'sixgrid' }, [el('div', { class: 'h' }), el('div', { class: 'h', text: 'Reaching something wanted' }), el('div', { class: 'h', text: 'Avoiding harm' }),
      el('div', { class: 'h', text: 'Already here' }), cell(0), cell(3), el('div', { class: 'h', text: 'Might happen' }), cell(1), cell(4), el('div', { class: 'h', text: 'Coming, with a date' }), cell(2), cell(5)]);
  }
  function writeIn(t, f) {
    var wrap = el('div', { class: 'writein no-print' });
    var open = el('button', { class: 'quiet', text: 'Write one in (said in passing, not in a source)' });
    var form = el('div', { hidden: true, class: 'row', style: 'margin-top:8px;align-items:flex-start' });
    var cin = f.type === 'choice' ? el('select', {}) : null;
    if (cin) { cin.appendChild(el('option', { value: '', text: 'Choose…' })); f.options.forEach(function (o) { cin.appendChild(el('option', { value: o, text: o })); }); form.appendChild(cin); }
    var vin = el('input', { type: 'text', placeholder: cin ? 'A line to explain (optional)' : 'What was said or seen', style: 'flex:1;min-width:220px' });
    form.appendChild(vin);
    form.appendChild(el('button', { class: 'btn sm solid', text: 'Add', onclick: async function () {
      try { var d = await api({ action: 'pr_add', tile_key: t.id, field: f.id, value: vin.value, choice: cin ? cin.value : null, status: 'accepted', found_by: 'consultant, typed' }); S.data.proposals.push(d.proposal); render(); }
      catch (e) { alert(e.message); }
    } }));
    open.onclick = function () { form.hidden = !form.hidden; };
    wrap.appendChild(open); wrap.appendChild(form);
    return wrap;
  }

  // ---------- a source: read it, select words, take them into a tile ----------
  function renderSource() {
    var src = srcById(S.key);
    if (!src) { main.appendChild(el('p', { class: 'meta', text: 'That source was not found.' })); return; }
    main.appendChild(backRow([el('button', { class: 'btn sm', text: 'Review all waiting', onclick: function () { go('review'); } })]));
    main.appendChild(el('p', { class: 'kick', text: KINDS[src.kind] + (src.file_name ? '  ·  ' + src.file_name : '') }));
    main.appendChild(el('h1', { class: 'wide', text: src.title }));
    main.appendChild(el('p', { class: 'lead', text: [src.speaker, src.role, src.source_date ? new Date(src.source_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '', src.consent].filter(Boolean).join('  ·  ') }));
    var mine = props().filter(function (p) { return p.source_id === src.id && p.status !== 'rejected'; });
    var lay = el('div', { class: 'srclay' }), L = el('div', { class: 'glass srctext', id: 'srctext' }), R = el('div', { class: 'srcside' });
    var isImg = src.kind === 'image' && /^data:image\//.test(src.body || ''), rdg = row('readings'), rdt = isImg ? (((rdg && rdg.content && rdg.content.map) || {})[src.id] || {}).text || '' : null;
    if (isImg) L.appendChild(el('img', { src: src.body, alt: 'The page as uploaded', style: 'max-width:100%;border-radius:8px;margin-bottom:12px' }));
    if (isImg && !rdt) L.appendChild(el('p', { class: 'meta', text: 'No reading of this page yet. Add one from How we might help.' }));
    paras(isImg ? rdt : src.body).forEach(function (txt, i) {
      var pe = el('p', { 'data-para': String(i) }, [el('span', { class: 'pn', text: '¶' + (i + 1) })]);
      var marks = mine.filter(function (p) { return p.para === i && p.excerpt; }).map(function (p) {
        var at = txt.indexOf(p.excerpt); if (at < 0) at = txt.toLowerCase().indexOf(p.excerpt.toLowerCase()); return { at: at, len: p.excerpt.length, p: p };
      }).filter(function (m) { return m.at >= 0; }).sort(function (a, b) { return a.at - b.at; });
      var pos = 0;
      marks.forEach(function (m) { if (m.at < pos) return; pe.appendChild(document.createTextNode(txt.slice(pos, m.at))); pe.appendChild(el('mark', { class: m.p.status, 'data-mark': m.p.id, title: (tileDef(m.p.tile_key) || {}).name + ': ' + (fieldOf(m.p.tile_key, m.p.field) || {}).label, text: txt.substr(m.at, m.len) })); pos = m.at + m.len; });
      pe.appendChild(document.createTextNode(txt.slice(pos)));
      L.appendChild(pe);
    });
    var take = takeBar(src);
    L.addEventListener('mouseup', function () { setTimeout(function () { take.update(); }, 0); });
    L.addEventListener('keyup', function () { take.update(); });
    R.appendChild(take.el);
    var w = mine.filter(function (p) { return p.status !== 'accepted'; }), a = mine.filter(function (p) { return p.status === 'accepted'; });
    R.appendChild(el('h4', { class: 'label', style: 'margin:18px 0 8px', text: w.length ? 'Waiting for review (' + w.length + ')' : 'Nothing waiting' }));
    w.forEach(function (p) { R.appendChild(propCard(p)); });
    if (a.length) { R.appendChild(el('h4', { class: 'label', style: 'margin:18px 0 8px', text: 'Taken into the tiles (' + a.length + ')' })); a.forEach(function (p) { R.appendChild(propCard(p, { undo: true })); }); }
    lay.appendChild(L); lay.appendChild(R); main.appendChild(lay);
    if (S.focus) { var mk = main.querySelector('[data-mark="' + S.focus + '"]'); S.focus = null; if (mk) setTimeout(function () { mk.scrollIntoView({ block: 'center' }); mk.classList.add('flash'); }, 50); }
  }
  function takeBar(src) {
    var sel = { text: '', para: null };
    var preview = el('div', { class: 'tkprev', text: 'Select words in the source to take them into a tile.' });
    var fsel = el('select', { id: 'takeField' });
    fsel.appendChild(el('option', { value: '', text: 'Use these words as…' }));
    rTiles().forEach(function (t) { var og = el('optgroup', { label: t.name }); t.fields.forEach(function (f) { og.appendChild(el('option', { value: t.id + '.' + f.id, text: f.label })); }); fsel.appendChild(og); });
    var ig = el('optgroup', { label: 'The model: dependencies' });
    [['inv.process', 'A new process'], ['inv.fails', 'How the last process fails'], ['inv.people', 'A resource: people'], ['inv.tech', 'A resource: technology'], ['inv.fac', 'A resource: facilities'], ['inv.info', 'A resource: information'], ['inv.third', 'A resource: third party']].forEach(function (x) { ig.appendChild(el('option', { value: x[0], text: x[1] })); });
    fsel.appendChild(ig);
    var csel = el('select', { id: 'takeChoice', hidden: true });
    fsel.addEventListener('change', function () {
      var k = fsel.value.split('.'), f = k[1] ? fieldOf(k[0], k[1]) : null; csel.innerHTML = ''; csel.hidden = !(f && f.type === 'choice');
      if (f && f.type === 'choice') { csel.appendChild(el('option', { value: '', text: 'Which one?' })); f.options.forEach(function (o) { csel.appendChild(el('option', { value: o, text: o })); }); }
    });
    var m = el('div', { class: 'msg' });
    var btn = el('button', { class: 'btn sm solid', id: 'takeAdd', text: 'Take into the tile', disabled: true, onclick: async function () {
      var k = fsel.value.split('.'); if (!k[1]) { m.className = 'msg bad'; m.textContent = 'Choose where these words go.'; return; }
      if (k[0] === 'inv') { try { await takeIntoInventory(k[1], sel.text, src, sel.para); m.className = 'msg good'; m.textContent = 'Added to the dependency inventory. Add its details there.'; try { window.getSelection().removeAllRanges(); } catch (e) {} } catch (e) { m.className = 'msg bad'; m.textContent = e.message; } return; }
      var f = fieldOf(k[0], k[1]);
      if (f.type === 'choice' && !csel.value) { m.className = 'msg bad'; m.textContent = 'Choose which one it is.'; return; }
      try {
        var d = await api({ action: 'pr_add', source_id: src.id, tile_key: k[0], field: k[1], value: sel.text, excerpt: sel.text, choice: f.type === 'choice' ? csel.value : null, para: sel.para, status: 'accepted', found_by: 'consultant' });
        S.data.proposals.push(d.proposal); try { window.getSelection().removeAllRanges(); } catch (e) {} render();
      } catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
    } });
    var box = el('div', { class: 'glass takebar' }, [el('div', { class: 'label', text: 'Take from the source' }), preview, el('div', { class: 'row', style: 'margin-top:10px' }, [fsel, csel, btn]), m]);
    return { el: box, update: function () {
      var s2 = window.getSelection(), txt = s2 ? String(s2).replace(/\s+/g, ' ').trim() : '';
      var n = s2 && s2.anchorNode; var pe = n && (n.nodeType === 1 ? n : n.parentElement); pe = pe && pe.closest ? pe.closest('[data-para]') : null;
      if (!txt || !pe) return;
      txt = txt.replace(/^¶\d+\s*/, '');
      sel = { text: txt, para: Number(pe.dataset.para) };
      preview.textContent = '“' + txt + '”  (¶' + (sel.para + 1) + ')'; preview.classList.add('on'); btn.disabled = false; m.textContent = '';
    } };
  }

  // ---------- review: everything waiting, in one place ----------
  function renderReview() {
    main.appendChild(backRow());
    head(S.data.session.name || 'Frame', 'Review', 'Entries found in the sources, waiting to be accepted, edited or rejected. Nothing reaches a tile until it is accepted.');
    var W = props(null, null, 'waiting').concat(props(null, null, 'unknown')).filter(function (p) { var t = tileDef(p.tile_key); return t && tileOn(t); });
    if (!W.length) { main.appendChild(el('p', { class: 'meta', style: 'margin-top:16px', text: 'Nothing is waiting. Add a source, or open one and select words to take into a tile.' })); return; }
    var bySrc = {};
    W.forEach(function (p) { (bySrc[p.source_id || 'typed'] = bySrc[p.source_id || 'typed'] || []).push(p); });
    Object.keys(bySrc).forEach(function (k) {
      var src = srcById(k), list = bySrc[k], P2 = src ? paras(src.body) : [];
      main.appendChild(el('h3', { style: 'margin:26px 0 10px', text: src ? src.title : 'Typed in the Lab' }));
      list.forEach(function (p) {
        var ctx = src && p.para != null && P2[p.para] ? P2[p.para] : '';
        var row2 = el('div', { class: 'revrow' }, [el('div', { class: 'glass ctx' }, [el('div', { class: 'label', text: src ? '¶' + (p.para + 1) : '' }), ctxEl(ctx, p.excerpt)]), propCard(p)]);
        main.appendChild(row2);
      });
    });
  }
  function ctxEl(ctx, ex) {
    var d = el('p', {}); if (!ctx) return d;
    var at = ex ? ctx.indexOf(ex) : -1;
    if (at < 0) { d.textContent = ctx; return d; }
    d.appendChild(document.createTextNode(ctx.slice(0, at))); d.appendChild(el('mark', { class: 'waiting', text: ex })); d.appendChild(document.createTextNode(ctx.slice(at + ex.length)));
    return d;
  }

  // ---------- the first-call guide (a collection tool: printed, not filled in here) ----------
  function renderGuide() {
    var g = groupDef('r');
    main.appendChild(backRow([el('button', { class: 'btn sm', text: 'Print', onclick: function () { window.print(); } })]));
    main.appendChild(el('div', { class: 'cguide' }, [el('div', { class: 'gk', text: 'First-call guide  ·  Reasons  ·  ' + (S.data.session.name || '') }), el('h2', { text: 'Why they have come' }),
      el('ol', {}, (g.guide || []).map(function (q2) { return el('li', {}, [el('span', { text: q2 }), el('div', { class: 'lines' })]); })),
      el('p', { class: 'gfoot', text: 'Ask for: ' + (g.ask_for || '') })]));
  }

  // ---------- the Reasons summary (the one-page output) ----------
  // ---------- The Frame page (30 October 2026): its three parts, each with how far it has got ----------
  function frameParts() {
    var a = (row('frame') && row('frame').content && row('frame').content.answers) || {}, q = a.question || {}, f = q.fields || {}, hf = (a.help && a.help.fields) || {};
    var gp = window.VTGuide && window.VTGuide.progress ? window.VTGuide.progress() : null, sent = !!(gp && gp.sent);
    var CV = gp && !gp.at && !sent && teamStarted() ? canvasSteps() : null;
    var ex = EXAMPLE ? '?example=' + encodeURIComponent(EXAMPLE) : '';
    var work = [];
    if (CV) CV.steps.forEach(function (x) { work.push([x.status === 'done', 'Step ' + x.n + ': ' + x.name, x.href]); });
    else { (gp ? gp.parts : []).forEach(function (x) { work.push([x.status === 'done', 'Part ' + x.part + ': ' + x.name, '/frame' + ex + '#guided=' + x.step]); }); work.push([sent, 'Send the framing', '/frame' + ex + '#guided=framing']); }
    var RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; };
    var runs = (a.requires && a.requires.runs) || [];
    return {
      question: [[!!(f.first || hf.first || hf.words), 'The problem as they put it', '#box=help'], [!!f.question, 'The question', '#question'], [!!(f.whose || f.owner), 'Whose problem it is', '#question'], [!!f.want, 'Do we really want to solve it?', '#question'], [!!f.sothat, 'We are doing X so that Y, because Z', '#question'], [!!f.decision, 'The decision it informs', '#box=question']],
      question2: workSecs('question').map(function (x) { return [x.done, x.n, '#question']; }),
      system2: workSecs('system').map(function (x) { return [x.done, x.n, '#system']; }).concat([[stopTests().filter(function (t) { return t.id !== 'arguable'; }).every(function (t) { return t.ok; }), 'Before you move on', '#system']]),
      line: [[!!fv('gap', 'mustnot'), 'What must never happen, in one sentence', '#line'], [LCAPS.some(function (c) { return hasLine(lineOf(c[0], 'people')); }), 'The people it is for: their threshold', '#line'], [LCAPS.some(function (c) { return hasLine(lineOf(c[0], 'org')); }), 'The organisation’s threshold', '#line'], [LCAPS.some(function (c) { return hasLine(lineOf(c[0], 'reg')) || lineOf(c[0], 'reg').none; }), 'The regulator’s threshold', '#line'], [LCAPS.every(function (c) { return govern(c[0]) || LHOLD.some(function (h) { return lineOf(c[0], h[0]).none; }); }), 'Every capital has a threshold, or a reason', '#line'], [!!(lineState().at && !lineState().changed), 'The thresholds agreed', '#line']],
      system: [[!!(r.standalone || on('within').length || on('inside').length || on('outside').length), 'Its boundaries', '#box=system'], [!!(on('inputs').length && on('work').length && on('outputs').length), 'Its function: in, the work, out', '#box=system'], [runs.length > 0, 'What it runs on: the six capitals', '#box=requires'], [!!fv('system', 'leftout'), 'What was left out, and why', '#system'], [!!fv('system', 'expires'), 'When the frame expires', '#system'], [!!(((row('frame') || {}).content || {}).statement || {}).at, 'The frame statement, declared', '#system']],
      guidedFirst: window.VTGuide && !S.readonly && !window.VTGuide.finished() && !teamStarted()
    };
  }
  var workLink = function () { return el('a', { href: '/frame' + (EXAMPLE ? location.search : '') + '#thework', class: 'wklink', text: 'The work: stocks, processes and flows' }); };
  function renderFrameHome() {
    var P = frameParts(), s = S.data.session;
    var wrap = el('div', { class: 'ww', id: 'frameHome' });
    wrap.appendChild(stepPlate('frame', 'ww-plate'));
    wrap.appendChild(el('p', { class: 'ww-kick', text: 'Step 1 of 4 · ' + (s.name || '') }));
    wrap.appendChild(el('h1', { class: 'ww-h', text: 'Frame' }));
    wrap.appendChild(el('p', { class: 'ww-lede', text: 'What are we working on, and what is the question? Frame starts from the problem, challenge or decision the organisation brings, turns it into the question, and produces the system that Diagnose works on.' }));
    var grid = partCards('frame');
    if (P.guidedFirst) { var q1 = grid.querySelector('[data-part="question"]'); if (q1) { q1.href = '#guided'; var nx1 = q1.querySelector('.ph-next'); if (nx1) nx1.textContent = 'Start the guided framing'; } }
    wrap.appendChild(grid);
    // a worked case loaded into this project (1 November 2026): the loader lived on the old canvas, which is no longer reached
    if (!S.readonly && !EXAMPLE) {
      var wc = el('details', { class: 'fxcard fxtoolcard', id: 'fCases', style: 'margin-top:18px', open: !(S.data.tiles || []).length ? true : null }, [el('summary', {}, [el('span', { class: 'fxsech', text: 'Start this project from a worked case' })]),
        el('p', { class: 'fxmuted', text: (S.data.tiles || []).length ? 'This replaces what is in this project now with the worked case. The current wording stays in each part’s history.' : 'Load a worked case to work on it as your own project. The published examples stay as they are.' }),
        el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, [el('button', { class: 'btn', type: 'button', 'data-loadcase': 'maylands', text: 'Maylands', onclick: function () { loadExample('maylands'); } })].concat((D.cases || []).filter(function (c) { return c.key !== 'maylands' && (!c.masterOnly || S.data.as === 'master'); }).map(function (c) { return el('button', { class: 'btn', type: 'button', 'data-loadcase': c.key, title: c.label, text: c.name, onclick: function () { loadExample(c.key); } }); })))]);
      wrap.appendChild(wc);
    }
    wrap.appendChild(el('div', { class: 'ph-more' }, [workLink(), S.readonly ? null : el('a', { href: '#guided', id: 'fGuidedLink', text: 'The guided framing (for the organisation to answer)' }), el('a', { href: '#work', text: 'All the questions on one page (for the team)' }), el('a', { href: '/diagnose' + (EXAMPLE ? location.search : ''), text: 'On to Diagnose' })]));
    main.appendChild(wrap);
  }
  // ---------- Frame, part 2 (30 October 2026): one set of questions, two ways of answering ----------
  // The same questions, in the guided framing's order, for the client (one at a time, in the guided framing) and
  // for the team (all on one page, here). Both read and write the same answers. The question is in part 1 and the
  // system, with its picture, in part 3, so neither is repeated here. Headings use the client's words, with the
  // method's term underneath.
  function frameAns() { return (row('frame') && row('frame').content && row('frame').content.answers) || {}; }
  function fv(box, k) { var a = frameAns(); return String((a[box] && a[box].fields && a[box].fields[k]) || '').trim(); }
  // ---------- Frame, the three parts, version 2 (31 October 2026, after six design reviews) ----------
  // The question, The situation and The system share one look: a path across the top, one line saying what
  // to do next, one main button at the foot, an example above every box, who wrote each answer, a history,
  // a one-page summary and a presenting view. Orange marks only the thing to do now.
  var FX = { open: null, edit: null };
  function meName() { return S.data.as === 'master' ? 'David (master)' : ((window.VTAuth && window.VTAuth.user && (window.VTAuth.user() || {}).name) || (S.data.me && S.data.me.name) || 'Facilitator'); }
  function fxSave(state) { var s = document.getElementById('fxSave'); if (!s) return; s.className = 'fxsave ' + state; s.textContent = state === 'busy' ? 'Saving…' : state === 'bad' ? 'Not saved' : '✓ All changes saved'; }
  var saveErr = function (e) { return e.status === 409 ? 'Someone else has just saved. Reload the page to see their change.' : e.message; };
  function rowDone(rw) { return rw.ok !== undefined ? !!rw.ok : rw.box ? !!fv(rw.box, rw.k) : rw.chips ? rw.chips.length > 0 : !!rw.show; }
  var dshort = function (iso) { try { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; } catch (e) { return ''; } };
  var dlong = function (iso) { try { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; } catch (e) { return ''; } };
  // who wrote an answer: kept per question since 31 October 2026; before that, per box
  function whoOf(box, k) { var b = frameAns()[box]; if (!b) return null; var w = b.who && b.who[k]; if (w) return w; return b.by && fv(box, k) ? { by: b.by, at: b.at } : null; }
  function initials(n) { var w = String(n || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean); return !w.length ? '?' : w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : w[0].slice(0, 2).toUpperCase(); }
  function avatar(n) { var h = 0; String(n || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 5; }); return el('span', { class: 'fxav c' + h, 'aria-hidden': 'true', text: initials(n) }); }
  function byLine(w, extra) { if (!w || !w.by) return extra ? el('div', { class: 'fxby' }, [extra]) : null; return el('div', { class: 'fxby' }, [avatar(w.by), el('span', { text: w.by.replace(/ \(master\)$/, '') + (w.at ? ', ' + dshort(w.at) : '') }), extra || null]); }

  // why each question is asked: one plain sentence, opened on request
  var WHY = {
    'question.question': 'Everything that follows is judged against this question. A clear one stops the work drifting.',
    'question.whose': 'The people who own a problem, feel it and have to act are often different. Each needs a voice.',
    'question.want': 'Some problems are worth keeping, or cost more to solve than to live with. Better to know now.',
    'question.sothat': 'It ties the work to what it should make possible, and to why that matters.',
    'question.decision': 'Work that informs no decision is easily ignored. Naming the decision keeps it useful.',
    'question.advance': 'If you could write the answer down now, it is not really a question. It may be a tension to manage instead.',
    'service.for': 'Its purpose is what every later judgement of better or worse is measured against.',
    'service.never': 'What must not change sets the limits on any proposal.',
    'help.why': 'Why now tells you about the pressure, the deadlines and what people expect.',
    'question.before': 'Knowing what was tried before, and what happened, saves repeating it.',
    'value.gains': 'This is what must keep flowing when things go wrong.',
    'exposure.exposed': 'Who is harmed shows where failure matters most.',
    'gap.mustnot': 'The threshold that must never be crossed is the test every change has to pass.',
    'exposure.absent': 'People who are affected but not in the room are the easiest to forget.',
    'question.nothing': 'Doing nothing is always an option. Every change is compared with it.',
    'good.primary': 'Choosing the measure before anything is tested stops it being picked to suit the result.',
    'guesses.text': 'Writing first guesses down lets you see later whether the evidence changed your mind.',
    'alt.text': 'A second way of seeing the problem guards against settling on the first one.',
    'system.leftout': 'Every boundary leaves something out. Saying what, and why, lets others challenge it.',
    'system.expires': 'A frame is right for a time. Saying when to look again stops it going stale unnoticed.'
  };
  function whyBits(key) {
    if (!WHY[key]) return { btn: null, txt: null };
    var txt = el('p', { class: 'fxwhyt', hidden: true, text: WHY[key] });
    var btn = el('button', { class: 'fxwhy', type: 'button', 'aria-expanded': 'false', text: 'Why we ask this', onclick: function () { txt.hidden = !txt.hidden; btn.setAttribute('aria-expanded', String(!txt.hidden)); } });
    return { btn: btn, txt: txt };
  }
  function grow(t) { var f = function () { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 3) + 'px'; }; t.addEventListener('input', f); setTimeout(f, 0); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(f, 0); }); }
  // one question: label, why, example, box, who wrote it
  function qCard(d, opts) {
    opts = opts || {};
    var ro = !!S.readonly, has = !!fv(d.box, d.k), key = d.box + '.' + d.k, w = whyBits(key);
    var tag = opts.tags ? el('span', { class: 'fxtag ' + (has ? 'ok' : opts.next ? 'now' : ''), text: has ? '✓ Done' : opts.next ? 'Next' : '' }) : null;
    var card = el('div', { class: 'fxq' + (opts.card ? ' fxcheck' : '') + (opts.next && !has ? ' now' : ''), 'data-q': key, id: opts.id || null });
    if (opts.num) card.appendChild(el('span', { class: 'fxnum', text: opts.num }));
    card.appendChild(el('div', { class: 'fxqhead' }, [el('label', { class: 'fxql', for: 'fx-' + d.box + '-' + d.k }, [document.createTextNode(d.l + (d.opt ? ' (optional)' : ''))]), w.btn, el('span', { class: 'fxgrow' }), tag && tag.textContent ? tag : null]));
    if (w.txt) card.appendChild(w.txt);
    if (d.eg) card.appendChild(el('p', { class: 'fxeg' }, [el('span', { text: 'For example: ' }), el('i', { text: d.eg })]));
    var val = fv(d.box, d.k) || d.fallback || '';
    var t = el('textarea', { id: 'fx-' + d.box + '-' + d.k, rows: d.rows || 2, 'data-field': key, disabled: ro, placeholder: d.ph || (ro ? 'Not answered yet' : 'Write here') }); t.value = val; grow(t);
    card.appendChild(t);
    var who = byLine(whoOf(d.box, d.k)); var whoHost = el('div', {}, [who]); card.appendChild(whoHost);
    t.addEventListener('blur', async function () {
      var v = t.value.trim(); if (v === fv(d.box, d.k) && !(d.fallback && !fv(d.box, d.k) && v)) return;
      try { await saveFrameField(d.box, d.k, v); whoHost.innerHTML = ''; var nb = byLine(whoOf(d.box, d.k)); if (nb) whoHost.appendChild(nb); if (tag) { tag.className = 'fxtag ' + (v ? 'ok' : ''); tag.textContent = v ? '✓ Done' : ''; } card.classList.remove('now'); if (opts.after) opts.after(); }
      catch (e) { whoHost.innerHTML = ''; whoHost.appendChild(el('div', { class: 'fxby bad', text: saveErr(e) })); }
    });
    return card;
  }

  // ---------- the parts of every part page ----------
  function partDone() {
    var q = ['question', 'whose', 'want', 'sothat', 'decision'].every(function (k) { return fv('question', k) || (k === 'whose' && fv('question', 'owner')); });
    var st = statementState(), ls = lineState();
    return { question: q && workSecs('question').every(function (x) { return x.done; }), system: !!(st.at && !st.changed) && workSecs('system').every(function (x) { return x.done; }), line: !!(ls.at && !ls.changed) };
  }
  function fxPath(cur, note, PP) { return treePath(PP && PP.step ? PP.step : 'frame', cur, note); }
  // the path at the top of a part's page: the step's parts, numbered, then this part's tasks (3 November 2026)
  var PSHORT = { dvuln: 'What goes right', dtrig: 'What triggers failure', mpeople: 'People, time and failure', talpha: 'Testing the model', tbeta: 'Trial in the organisation' };
  function treePath(stepId, cur, note) {
    var s = treeStep(stepId);
    var nav = el('nav', { class: 'fxpath', 'aria-label': 'The parts of ' + s.name });
    s.parts.forEach(function (p, i) {
      if (i) nav.appendChild(el('span', { class: 'fxpline', 'aria-hidden': 'true' }));
      var here = p.id === cur, done = p.st === 'done' && !here;
      nav.appendChild(el('a', { class: 'fxpstep' + (here ? ' here' : '') + (done ? ' done' : ''), href: p.href, 'aria-current': here ? 'step' : null, 'data-part': p.id, title: p.n + ' ' + p.name + ': ' + ST_N[p.st] }, [el('span', { class: 'fxdot', text: done ? '✓' : p.n }), el('span', { class: 'fxpname', text: PSHORT[p.id] || p.name }), here && note ? el('small', { text: note }) : null]));
    });
    var top = el('div', { class: 'fxtop' }, [el('a', { class: 'fxback', href: s.href, text: '‹ ' + s.n + ' ' + s.name }), nav, el('span', { class: 'fxsave ok', id: 'fxSave', role: 'status', text: '✓ All changes saved' })]);
    var tb = cur ? taskBar(stepId, cur) : null;
    return tb ? el('div', { class: 'fxtopwrap' }, [top, tb]) : top;
  }
  // each step's plate from the family kit (31 October 2026), drawn for the ground it sits on
  function stepPlate(step, cls) { return el('span', { class: 'ph-plate ' + (cls || ''), 'aria-hidden': 'true', 'data-plate': step }, [el('img', { class: 'pl-l', src: '/icons/on-light/step-' + step + '.svg', alt: '' }), el('img', { class: 'pl-d', src: '/icons/on-dark/step-' + step + '.svg', alt: '' })]); }
  function fxTitle(title, lede, status, part, opt) {
    opt = opt || {};
    var tools = el('div', { class: 'fxtools no-print' }, [
      el('button', { class: 'fxtool', type: 'button', id: 'fxHistBtn', onclick: function () { openHistory(part, opt.tile); } }, [el('span', { 'aria-hidden': 'true', text: '⟲ ' }), document.createTextNode('History')]),
      el('a', { class: 'fxtool', href: opt.one ? opt.one[1] : '#onepage', id: 'fxOnePage' }, [el('span', { 'aria-hidden': 'true', text: '⎙ ' }), document.createTextNode(opt.one ? opt.one[0] : 'One-page summary')]),
      el('a', { class: 'fxtool', href: opt.present || ('#present=' + part), id: 'fxPresent' }, [el('span', { 'aria-hidden': 'true', text: '▶ ' }), document.createTextNode('Present')])]);
    return el('div', { class: 'fxtitle' }, [el('div', {}, [stepPlate(String(opt.step || 'Frame').toLowerCase(), 'fx-plate'), el('p', { class: 'fxkick', text: (opt.step || 'Frame') + ' · ' + (S.data.session.name || '') }), el('h1', { class: 'fxh1', text: title }), el('p', { class: 'fxlede', text: lede }), el('div', { class: 'fxstatus', id: 'fxStatus' }, status)]), tools]);
  }
  function nextLink(text, target) { return el('a', { class: 'fxnext', href: '#', onclick: function (e) { e.preventDefault(); var t = typeof target === 'function' ? target() : document.querySelector(target); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); var f = t.querySelector('textarea,input'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); } } }, [document.createTextNode(text + ' '), el('span', { 'aria-hidden': 'true', text: '↓' })]); }
  function fxFoot(back, next, note) { return el('nav', { class: 'fxfoot no-print', 'aria-label': 'Back and next' }, [el('a', { class: 'btn', href: back[1], id: 'fpBack', text: '‹ ' + back[0] }), el('span', { class: 'fxfootnote', text: note || '' }), el('a', { class: 'btn fxmain', href: next[1], id: 'fpNext', text: next[0] + ' ›' })]); }

  // ---------- part 1: The question ----------
  var CHECKS = [
    { box: 'question', k: 'whose', l: 'Whose problem is it?', eg: 'the board owns it; the weekend teams feel it.', ph: 'Who owns it, who feels it, who has to act' },
    { box: 'question', k: 'want', l: 'Do we really want to solve it?', eg: 'yes, because living with it costs more than fixing it.', ph: 'Yes, because … or Not yet, because …' },
    { box: 'question', k: 'sothat', l: 'What will it make possible?', eg: 'we are doing this so that results reach a doctor in time, because delay can kill.', ph: 'We are doing this so that …, because …' },
    { box: 'question', k: 'decision', l: 'What decision will the answer inform?', eg: 'which recommendations the board funds, at its March meeting.', ph: 'The decision, who takes it, and when' }];
  async function saveQuestion(v) {
    await saveFrameContent(function (c) {
      var q = c.answers.question = c.answers.question || {}; q.fields = q.fields || {};
      var old = String(q.fields.question || '').trim();
      if (old && old !== v) q.past = [{ fields: { question: old }, at: q.at, by: q.by }].concat(q.past || []).slice(0, 30);
      q.fields.question = v; q.by = meName(); q.at = new Date().toISOString(); q.who = q.who || {}; q.who.question = { by: q.by, at: q.at };
    }, 'Changed: question (question)');
  }
  function renderQuestion() {
    var a = frameAns(), q = a.question || {}, f = q.fields || {}, hf = (a.help && a.help.fields) || {}, ro = !!S.readonly;
    var main0 = el('div', { class: 'fx', id: 'fxQuestion' }); main.appendChild(main0);
    var put = function (n) { main0.appendChild(n); return n; };
    var done = function () { return CHECKS.filter(function (c) { return fv(c.box, c.k) || (c.k === 'whose' && f.owner); }).length; };
    var firstOpen = function () { return CHECKS.filter(function (c) { return !(fv(c.box, c.k) || (c.k === 'whose' && f.owner)); })[0]; };
    var statusNodes = function () { var n = done(), nx = firstOpen(); return [el('span', { text: 'About 10 minutes' }), el('span', { class: 'fxsep', text: '·' }), el('b', { text: (f.question ? '' : 'Start by writing the question. ') + n + ' of 4 checks done.' }), nx && f.question ? nextLink('Next: ' + nx.l, '[data-q="question.' + nx.k + '"]') : null]; };
    var refresh = function () { var s = document.getElementById('fxStatus'); if (s) { s.innerHTML = ''; statusNodes().forEach(function (x) { if (x) s.appendChild(x); }); } var p = main0.querySelector('.fxpstep.here small'); if (p) p.textContent = done() + ' of 4 checks'; };
    put(fxPath('question', done() + ' of 4 checks'));
    put(fxTitle('The question', 'Produce one clear question. You can change it later: questions get sharper as the work goes on.', statusNodes(), 'q'));
    // sent back from Test, still open: shown first, because it may change the question
    var fromTest = (S.data.questions || []).filter(function (x) { return x.tile_key === 'question' && (x.from_practice === 'test' || x.from_practice === 'diagnose') && (!x.status || x.status === 'open' || x.status === 'kept_open'); });
    if (fromTest.length) put(el('div', { class: 'fxcard fxwarn', id: 'qFromTest' }, [el('b', { text: (fromTest.every(function (x) { return x.from_practice === 'diagnose'; }) ? 'Diagnose has' : fromTest.some(function (x) { return x.from_practice === 'diagnose'; }) ? 'Diagnose and Test have' : 'Test has') + ' sent something back that may change the question' }), el('ul', {}, fromTest.map(function (x) { return el('li', { text: x.text + (x.why ? ' (' + x.why + ')' : '') }); }))]));
    // the client's words
    var presented = (f.first || hf.first || hf.words || '').replace(/^[“"]|[”"]$/g, '');
    if (presented) {
      put(el('blockquote', { class: 'fxsaid', id: 'qPresented' }, [el('p', { text: '“' + presented + '”' })]));
      var hw = (a.help && a.help.by) ? { by: a.help.by, at: a.help.at } : null;
      put(byLine(hw, el('span', { class: 'fxmuted', text: ' · the words as first put, kept as they said them' })) || el('p', { class: 'fxby', text: 'The words as first put, kept as they said them.' }));
      put(el('div', { class: 'fxbecomes', text: 'becomes' }));
    } else put(el('p', { class: 'fxmuted', style: 'margin:0 0 12px' }, [document.createTextNode('The words as first put are not recorded yet. '), ro ? null : el('a', { href: '#box=help', text: 'Add them' })]));
    // the question
    var w = whyBits('question.question'), qcard = put(el('div', { class: 'fxcard fxhero', id: 'qHero' }));
    qcard.appendChild(el('div', { class: 'fxqhead' }, [el('label', { class: 'fxql', for: 'qText', text: 'Your question' }), w.btn]));
    if (w.txt) qcard.appendChild(w.txt);
    var qt = el('textarea', { class: 'fxbig', id: 'qText', 'data-field': 'question.question', rows: 1, disabled: ro, placeholder: 'For example: How can we make weekend care as safe as weekday care for patients on high-risk medicines?', 'aria-label': 'The question we are working on' }); qt.value = f.question || ''; grow(qt);
    qcard.appendChild(qt);
    var vers = (q.past || []).filter(function (x) { return x.fields && x.fields.question; }).length;
    var qwho = el('div', {}, [byLine(f.question ? { by: q.by, at: q.at } : null, vers ? el('span', {}, [document.createTextNode(' · version ' + (vers + 1) + ' · '), el('button', { class: 'fxlink', type: 'button', id: 'qVersions', text: 'see earlier versions', onclick: function () { openHistory('q'); } })]) : null)]);
    qcard.appendChild(qwho);
    qcard.appendChild(el('p', { class: 'fxgood', text: 'A good question is one sentence, says who it is for, and does not assume the answer.' }));
    qt.addEventListener('blur', async function () { var v = qt.value.trim(); if (v === fv('question', 'question')) return; try { await saveQuestion(v); render(); } catch (e) { qwho.innerHTML = ''; qwho.appendChild(el('div', { class: 'fxby bad', text: saveErr(e) })); } });
    // the four checks
    put(el('h2', { class: 'fxh2', text: 'Is it the right question?' }));
    put(el('p', { class: 'fxsub', text: 'Four quick checks. A few words each is enough.' }));
    var grid = put(el('div', { class: 'fxchecks', id: 'qTest' })), nx = f.question ? firstOpen() : null;
    CHECKS.forEach(function (c, i) { grid.appendChild(qCard(Object.assign({ fallback: c.k === 'whose' ? (f.owner || '') : '' }, c), { card: true, tags: true, num: 'Check ' + (i + 1), next: nx === c, after: refresh })); });
    // the optional fifth
    var adv = !!fv('question', 'advance'), advBox = qCard({ box: 'question', k: 'advance', l: 'Could you write the answer down in advance?', opt: true, eg: 'if the honest answer is “both, in turn” (central and local, stability and change), it may be a tension to manage, not a problem to solve. The polarity map is in the optional framing tools.', ph: 'Yes, it would be … or No, because …' }, { card: true });
    advBox.hidden = !adv; advBox.style.marginTop = '16px';
    put(el('p', { class: 'fxmuted', style: 'margin:16px 0 0' }, [document.createTextNode('Not sure it is a problem at all? '), el('button', { class: 'fxlink', type: 'button', id: 'qAdvance', text: 'Could you write the answer down in advance?', onclick: function () { advBox.hidden = false; advBox.querySelector('textarea').focus(); } })]));
    put(advBox);
    put(el('h2', { class: 'fxh2', id: 'qAround', text: 'Around the question' }));
    put(el('p', { class: 'fxsub', text: 'What is prompting it, how to see it, first guesses, what we take for granted, and what we compare against. Rough notes are fine.' }));
    renderWork('question', main0);
    put(fxFoot(['1 Frame', '#fhome'], ['Next: 1.2 The system', '#system'], 'You can move on now and come back to the checks later.'));
  }

  // ---------- part 2: The situation ----------
  function workSections() {
    var a = frameAns(), RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; };
    var runs = (a.requires && a.requires.runs) || [], svc = (RT && RT.svc && RT.svc()) || fv('system', 'what');
    var outs = RT ? RT.L(r, 'outside').filter(function (x) { return x.on; }).map(function (x) { return x.t; }) : [];
    var pr = (D.frame.boxes || []).filter(function (b) { return b.band === 'protocol' && !b.retired; }), prn = pr.filter(function (b) { return fv(b.id, 'text'); }).length;
    var S0 = [
      { id: 'working', n: 'What you’re working on', min: 4, line: 'The service, what it is part of, and what it is for', rows: [
        { l: 'What is it called, and what is it part of?', show: [svc, r.standalone ? 'It stands alone' : on('within').length ? 'Part of ' + on('within').join(', ') : ''].filter(Boolean).join('. '), change: '#box=system' },
        { l: 'What do the people in it run, and what is decided elsewhere?', show: [on('inside').length ? 'They run: ' + on('inside').join(', ') : '', outs.length ? 'Decided elsewhere: ' + outs.join(', ') : ''].filter(Boolean).join('. '), change: '#box=system' },
        { l: 'What is it for?', box: 'service', k: 'for', eg: 'abnormal results reach a doctor who can act in time, every day of the year.' },
        { l: 'What must never change?', box: 'service', k: 'never', eg: 'patients are as safe at the weekend as on a weekday.' }] },
      { id: 'prompting', n: 'What’s prompting this', min: 4, line: 'Why they have come, and why now', agreed: !!(a.help && a.help.check && a.help.check.agreed), rows: [
        { l: 'In their own words, what has brought the organisation to this work?', show: fv('help', 'words'), client: true, change: '#box=help' },
        { l: 'Why now?', box: 'help', k: 'why', eg: 'the inquiry has reported and the regulator wants a plan by spring.' },
        { l: 'Has this happened before, or been tried before?', box: 'question', k: 'before', eg: 'it was fixed in 2003 and slipped back within a year.' }] },
      { id: 'how', n: 'How it works', min: 5, line: 'What comes in, the work, what goes out, and what it runs on', rows: [
        { l: 'What comes in, what is the work, what goes out?', chips: on('inputs').map(function (x) { return 'In: ' + x; }).concat(on('work')).concat(on('outputs').map(function (x) { return 'Out: ' + x; })), change: '#box=system' },
        { l: 'What does it run on?', chips: runs.map(function (x) { return x.t + (x.own === 'ours' ? ' (yours)' : x.own === 'theirs' ? ' (someone else’s)' : x.own ? ' (shared)' : ''); }), change: '#box=requires' }] },
      { id: 'matters', n: 'Who it matters to', min: 4, line: 'Who gains, who is hurt, and who is not asked', rows: [
        { l: 'When it works, who gains?', box: 'value', k: 'gains', eg: 'patients and their families: safe doses. The board: assurance it can show the regulator.' },
        { l: 'If it fails, who is hurt?', box: 'exposure', k: 'exposed', eg: 'patients whose results wait over a weekend; staff who carry the blame.' },
        { l: 'Who is affected but not asked?', box: 'exposure', k: 'absent', eg: 'night and weekend staff; GPs who share care of these patients.' }] },
      { id: 'standards', n: 'What can be changed, and how we will judge the model', min: 6, line: 'The levers, how it has behaved over time, and who gives assurance', rows: [
        { l: 'What can the organisation actually change, by whom, and within what range?', box: 'question', k: 'levers', eg: 'the rota and who holds the bleep, yes; consultant contracts, no; up to two extra posts.' },
        { l: 'How has the problem behaved over time?', box: 'system', k: 'overtime', eg: 'three incidents in 2019, none in 2021, two last winter: worse each winter since the rota changed.' },
        { l: 'Which patterns must the model reproduce before we trust it?', box: 'ppatterns', k: 'text', eg: 'longer waits at weekends than on weekdays; the peak on Sunday evening; the dip after the 2021 change.' },
        { l: 'In one sentence: a system to do what, by what means, to achieve what?', box: 'root', k: 'text', eg: 'a system to get every dangerous result to a doctor who can act, by naming one doctor for each patient, so that weekend care is as safe as weekday care.' },
        { l: 'Who gives assurance on the work?', box: 'passure', k: 'text', eg: 'the medical director, with the regulator’s inspection team reading the final report.' }] },
      { id: 'start', n: 'Before we start', min: 2, line: 'Anything live, and anything already decided', rows: [
        { l: 'Is any of this the subject of a live claim, inquiry or investigation?', box: 'question', k: 'live', eg: 'no. If yes: stop, and agree with the organisation’s lawyers what can be discussed before going further.' },
        { l: 'What is already decided and cannot be reopened?', box: 'question', k: 'decided', eg: 'the merger of the two pathology services goes ahead in April.' }] },
      { id: 'framing', n: 'How to see the problem', min: 8, line: 'The event and the condition, the kind of problem, the level and how far ahead', rows: [
        { g: 'The event and the condition', l: 'What has happened: the event that brought them?', box: 'question', k: 'acute', eg: 'two patients harmed in one winter by results nobody acted on at the weekend.' },
        { g: 'The event and the condition', l: 'What lies under it: the condition that keeps producing such events?', box: 'question', k: 'under', eg: 'nobody owns a patient’s results between Friday evening and Monday morning.' },
        { g: 'The event and the condition', l: 'Are we treating the event, or the condition?', box: 'question', k: 'treat', eg: 'the condition: the event was the third of its kind.' },
        { g: 'What kind of problem', l: 'Technical or adaptive? A problem to solve or a balance to manage?', box: 'question', k: 'kindview', eg: 'adaptive: the fix needs people to work differently, not a new system.' },
        { g: 'The problem at each level', l: 'For the sector and its rules', box: 'question', k: 'lvinst', eg: 'national guidance says results must be acted on, but not by whom at weekends.' },
        { g: 'The problem at each level', l: 'For the organisation', box: 'question', k: 'lvorg', eg: 'the trust funds weekday cover only.' },
        { g: 'The problem at each level', l: 'For the team', box: 'question', k: 'lvteam', eg: 'the hand-over on Friday does not name who holds the results.' },
        { g: 'The problem at each level', l: 'For the person', box: 'question', k: 'lvperson', eg: 'the weekend doctor does not know the patient and cannot see the history.' },
        { g: 'The problem at each level', l: 'Which level will we work at, and why?', box: 'question', k: 'lvchosen', eg: 'the team, because that is where the hand-over fails; we will check the organisation’s part.' },
        { g: 'How far ahead', l: 'How far ahead are we looking, and as at when?', box: 'system', k: 'time', eg: 'the next two winters, as at October 2026.' }] },
      { id: 'compare', n: 'What we compare against', min: 2, line: 'Doing nothing, named as an option', rows: [
        { l: 'What happens if we do nothing?', box: 'question', k: 'nothing', eg: 'another serious incident within a year.' }] },
      { id: 'assume', n: 'What we take for granted', min: 5, line: 'The beliefs behind the question', list: true, rows: [] },
      { id: 'guesses', n: 'First guesses', min: 5, line: 'What you think is going on, and how else it could be seen', rows: [
        { l: 'What do you think is going on?', box: 'guesses', k: 'text', eg: 'most say pharmacy cover; three say nobody owns the patient at weekends.' },
        { l: 'How else could it be seen?', box: 'alt', k: 'text', eg: 'as a fight over budgets between two directorates, not a staffing gap.' }] },
      { id: 'protocol', n: 'How the team will work', min: 5, line: 'Team only: how you will run the work', team: true, rows: [
        { l: 'The protocol', show: prn + ' of ' + pr.length + ' answered', ok: pr.length > 0 && prn === pr.length, change: '#box=' + (pr[0] ? pr[0].id : 'pcase') }] }];
    S0.forEach(function (x) { x.total = x.rows.length + (x.list ? 1 : 0); x.got = x.rows.filter(rowDone).length + (x.list && assumptions().length ? 1 : 0); x.done = x.got === x.total; });
    return S0;
  }
  function secSummary(x) {
    if (x.list) { var as = assumptions(); return as.length ? as.length + ' written: ' + as.map(function (y) { return y.t; }).join('; ') : ''; }
    var bits = x.rows.map(function (rw) { return rw.box ? fv(rw.box, rw.k) : rw.chips ? rw.chips.join(', ') : rw.show; }).filter(Boolean);
    var s = bits.join(' · '); return s.length > 170 ? s.slice(0, 167).replace(/\s+\S*$/, '') + '…' : s;
  }
  // parts 1 and 2 of Frame (31 October 2026): The situation was split between The question and The system, and
  // its place taken by The line. The same sections still show together on one page for the team (#work).
  var WPART = { question: ['start', 'prompting', 'framing', 'guesses', 'assume', 'compare'], system: ['working', 'matters', 'standards', 'protocol'] };
  function workSecs(part) { var all = workSections(); return part ? WPART[part].map(function (id) { return all.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean) : all; }
  function renderWork(part, host) {
    var secs = workSecs(part), ndone = secs.filter(function (x) { return x.done; }).length, ro = !!S.readonly, notes = ((row('frame') || {}).content || {}).teamNotes || {};
    var firstOpen = secs.filter(function (x) { return !x.done; })[0];
    var openId = FX.open && secs.some(function (x) { return x.id === FX.open; }) ? FX.open : firstOpen ? firstOpen.id : null;
    var wrap = host || el('div', { class: 'fx', id: 'fxSituation' }); if (!host) main.appendChild(wrap);
    var mins = secs.filter(function (x) { return !x.done; }).reduce(function (t, x) { return t + x.min; }, 0);
    if (!host) {
      wrap.appendChild(fxPath(null, ''));
      wrap.appendChild(fxTitle('All the questions', 'Every question from parts 1 and 2 of Frame on one page, for the team. Rough notes are fine.', [el('span', { text: mins ? 'About ' + mins + ' minutes left' : 'All sections answered' }), el('span', { class: 'fxsep', text: '·' }), el('b', { text: ndone + ' of ' + secs.length + ' done.' }), firstOpen ? nextLink('Next: ' + firstOpen.n, '#wk-' + firstOpen.id) : null], 's'));
    }
    var lay = el('div', { class: 'fxtwo' }), rail = el('nav', { class: 'fxrail', 'aria-label': 'Sections' }), ol = el('ol'), body = el('div', { class: 'fxbody' });
    var openSec = function (id) { FX.open = id; render(); setTimeout(function () { var t = document.getElementById('wk-' + id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); };
    secs.forEach(function (x, i) {
      ol.appendChild(el('li', { class: (x.id === openId ? 'here' : '') + (x.done ? ' done' : '') }, [el('button', { type: 'button', 'data-sec': x.id, onclick: function () { openSec(x.id); } }, [x.done ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring', text: String(i + 1) }), el('span', {}, [document.createTextNode(x.n), x.id === openId && !x.done ? el('small', { text: x.got + ' of ' + x.total + ' answered' }) : null])])]));
    });
    var tests = stopTests().filter(function (t) { return t.id !== 'arguable'; }), passed = tests.filter(function (t) { return t.ok; }).length;
    rail.appendChild(ol);
    lay.appendChild(rail); lay.appendChild(body); wrap.appendChild(lay);
    // the client can answer the same questions
    if (!ro && !host) {
      var how = el('div', { class: 'fxsendhow', hidden: true }, [el('p', { text: 'Share the project code shown at the top right of the page. People from the organisation join on the Lab’s front page and answer these same questions one at a time, without section 7 or the team notes. Their answers appear here, with their names.' }), el('a', { class: 'btn sm', href: '#guided', text: 'See what they will see' })]);
      body.appendChild(el('div', { class: 'fxsend team-only', id: 'wkSend' }, [el('div', { class: 'fxsendrow' }, [el('span', {}, [el('b', { text: 'The organisation can answer these too. ' }), document.createTextNode('They get the same questions one at a time.')]), el('button', { class: 'btn sm', type: 'button', id: 'wkClient', onclick: function () { how.hidden = !how.hidden; } , text: 'Send to the organisation' })]), how]));
    }
    secs.forEach(function (x, i) {
      var isOpen = x.id === openId;
      var sec = el('section', { class: 'fxsec' + (isOpen ? ' open' : '') + (x.done ? ' done' : '') + (x.team ? ' team-only' : ''), id: 'wk-' + x.id, 'data-sec': x.id, 'aria-label': x.n });
      var mark = x.done ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring' + (isOpen ? ' now' : ''), text: String(i + 1) });
      var sum = x.done || (x.got && !isOpen) ? secSummary(x) : '';
      var right = isOpen ? el('span', { class: 'fxtag now', text: 'You are here' }) : x.done ? el('button', { class: 'btn sm', type: 'button', 'data-edit': x.id, text: 'Edit', onclick: function () { openSec(x.id); } }) : el('span', { class: 'fxtag', text: x.got ? x.got + ' of ' + x.total : (x.team ? 'Team only' : 'Not started') });
      var bar = el('div', { class: 'fxbar', onclick: isOpen ? null : function (e) { if (!e.target.closest('button')) openSec(x.id); } }, [mark, el('div', { class: 'fxbart' }, [el('h2', { class: 'fxsech', text: x.n }), el('div', { class: 'fxsum', text: isOpen ? 'About ' + x.min + ' minutes · ' + x.got + ' of ' + x.total + ' answered' : (sum || x.line + ' · about ' + x.min + ' minutes') })]), right]);
      sec.appendChild(bar);
      if (isOpen) {
        var b = el('div', { class: 'fxsecbody' }), lastG = null, qs = null;
        var nextQ = x.rows.filter(function (rw) { return rw.box && !fv(rw.box, rw.k); })[0];
        x.rows.forEach(function (rw) {
          if (rw.g !== lastG || !qs) { lastG = rw.g; if (rw.g) b.appendChild(el('p', { class: 'fxgh', text: rw.g })); qs = el('div', { class: 'fxqs' }); b.appendChild(qs); }
          if (rw.box) return qs.appendChild(qCard(rw, { next: rw === nextQ }));
          // answered elsewhere: shown as text, with Edit saying where
          var cell = el('div', { class: 'fxq' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: rw.l }), el('span', { class: 'fxgrow' }), rw.change && !ro ? el('a', { class: 'btn sm', href: rw.change, text: rowDone(rw) ? 'Edit' : 'Add' }) : null])]);
          if (rw.chips) cell.appendChild(rw.chips.length ? el('div', { class: 'fxchips' }, rw.chips.map(function (c) { return el('span', { text: c }); })) : el('p', { class: 'fxmuted', text: 'Not answered yet.' }));
          else cell.appendChild(rw.show ? el('p', { class: 'fxshow' + (rw.client ? ' client' : ''), text: rw.client ? '“' + rw.show.replace(/^[“"]|[”"]$/g, '') + '”' : rw.show }) : el('p', { class: 'fxmuted', text: 'Not answered yet.' }));
          qs.appendChild(cell);
        });
        if (x.list) b.appendChild(assumeList(ro));
        var idx = secs.indexOf(x), nxt = secs.slice(idx + 1).filter(function (y) { return !y.done; })[0] || secs[idx + 1];
        var foot = el('div', { class: 'fxsecfoot' });
        if (!ro || notes[x.id]) {
          var tn = el('textarea', { class: 'fxnote', rows: 2, placeholder: 'Team note (not shown to the organisation)', disabled: ro, 'data-note': x.id }); tn.value = notes[x.id] || ''; grow(tn);
          var nw = el('div', { class: 'fxnotewrap team-only' }, [tn]);
          tn.addEventListener('blur', async function () { if (tn.value.trim() === (notes[x.id] || '')) return; try { await saveFrameField(x.id, null, tn.value.trim(), true); notes[x.id] = tn.value.trim(); } catch (e) { nw.appendChild(el('div', { class: 'fxby bad', text: saveErr(e) })); } });
          if (!notes[x.id] && !ro) { nw.hidden = true; var add = el('button', { class: 'fxaddnote team-only', type: 'button', 'data-addnote': x.id, text: '+ Add a team note', onclick: function () { nw.hidden = false; add.remove(); tn.focus(); } }); foot.appendChild(add); } else foot.appendChild(el('span'));
          b.appendChild(nw);
        } else foot.appendChild(el('span'));
        foot.appendChild(nxt ? el('button', { class: 'btn fxmain', type: 'button', 'data-nextsec': nxt.id, text: 'Next: ' + nxt.n + ' ›', onclick: function () { openSec(nxt.id); } }) : el('a', { class: 'btn fxmain', href: part === 'question' ? '#system' : '#line', text: part === 'question' ? 'Next: The system ›' : 'Next: Thresholds ›' }));
        b.appendChild(foot);
        b.appendChild(evqBar('f:' + x.id, 'Frame: ' + x.n, 'frame'));
        sec.appendChild(b);
      }
      body.appendChild(sec);
    });
    // before you move on: two of the book's three tests (the third, about the boundary, is on The system)
    if (host && part !== 'system') return;
    var before = el('div', { class: 'fxcard fxbefore', id: 'wkStop' }, [el('p', { class: 'fxql', text: 'Before you move on' }), el('p', { class: 'fxmuted', text: 'Two things worth being able to say. You can move on without them and come back.' })]);
    tests.forEach(function (t) {
      var cb = el('input', { type: 'checkbox', 'data-stop': t.id, disabled: ro || !!t.needs }); cb.checked = t.ok;
      cb.addEventListener('change', async function () { try { await saveFrameContent(function (c) { c.stopTests = c.stopTests || {}; c.stopTests[t.id] = cb.checked; }, 'Before moving on: ' + t.id + (cb.checked ? ' ticked' : ' unticked')); } catch (e) { cb.checked = !cb.checked; } });
      before.appendChild(el('label', { class: 'fxcheckrow' }, [cb, el('span', {}, [document.createTextNode(t.l), t.needs ? el('span', { class: 'fxmuted', text: ' (' + t.needs + ')' }) : null])]));
    });
    body.appendChild(before);
    if (!host) body.appendChild(fxFoot(['1 Frame', '#fhome'], ['1.3 Thresholds', '#line'], passed < tests.length ? 'You can move on now and come back.' : ''));
  }

  // the assumptions: three states, how we know, who wrote it
  var MARKS = [['unchecked', 'Not tested yet', 'n'], ['holds', 'Holds', 'y'], ['nothold', 'Does not hold', 'x']];
  function markOf(x) { return x.mark === 'sound' ? 'holds' : x.mark === 'holds' || x.mark === 'nothold' ? x.mark : 'unchecked'; }
  function assumeList(ro, opts) {
    opts = opts || {};
    var box = el('div', { class: 'fxassume', id: opts.test ? 'dAssumeList' : 'wkAssume' }, [el('p', { class: 'fxlead', html: opts.test ? 'For each one, look for evidence. Mark it <b>Holds</b> or <b>Does not hold</b>, and say how we know. The answer shows in Frame too.' : 'Write down what everyone treats as true. If you have not tested it, leave it as <b>Not tested yet</b> and Diagnose will test it.' })]);
    var list = assumptions(), msg = el('div', { class: 'fxby bad', hidden: true });
    var cur = function () { return assumptions().map(function (x, i) { return { id: x.old ? 'a' + Date.now().toString(36) + i : x.id, t: x.t, mark: markOf(x), how: x.how || '', by: x.by, at: x.at }; }); };
    var save = async function (items, why) { try { await saveFrameContent(function (c) { var b = c.answers.assume = c.answers.assume || {}; b.fields = b.fields || {}; b.items = items; }, why); render(); } catch (e) { msg.hidden = false; msg.textContent = saveErr(e); } };
    var ul = el('ul', { class: 'fxalist' });
    list.forEach(function (x, i) {
      var m = markOf(x), editing = FX.edit === x.id;
      var txt = editing ? el('input', { type: 'text', class: 'fxaedit', value: x.t, 'aria-label': 'Edit the assumption' }) : el('span', { class: 'fxat' }, [el('em', { text: 'We are assuming that ' }), document.createTextNode(x.t.replace(/^we are assuming that\s*/i, ''))]);
      if (editing) { txt.addEventListener('keydown', function (e) { if (e.key === 'Enter') txt.blur(); if (e.key === 'Escape') { FX.edit = null; render(); } }); txt.addEventListener('blur', function () { var it = cur(); FX.edit = null; var v = txt.value.trim().replace(/^we are assuming that\s*/i, ''); if (v && v !== x.t) { it[i].t = v; save(it, 'Changed an assumption'); } else render(); }); setTimeout(function () { txt.focus(); }, 0); }
      var seg = el('span', { class: 'fxthree', role: 'group', 'aria-label': 'Has it been tested?' }, MARKS.map(function (o) { return el('button', { type: 'button', class: (m === o[0] ? 'on ' + o[2] : ''), 'aria-pressed': String(m === o[0]), 'data-mark': x.id, 'data-v': o[0], disabled: ro, text: o[1], onclick: function () { if (m === o[0]) return; var it = cur(); it[i].mark = o[0]; save(it, 'Assumption marked: ' + o[1]); } }); }));
      var li = el('li', { class: 'fxaitem', 'data-assume': x.id }, [el('div', { class: 'fxarow' }, [txt, seg, ro ? null : el('button', { class: 'fxico', type: 'button', title: 'Edit', 'aria-label': 'Edit this assumption', 'data-aedit': x.id, text: '✎', onclick: function () { FX.edit = x.id; render(); } }), ro ? null : el('button', { class: 'fxico', type: 'button', title: 'Remove', 'aria-label': 'Remove this assumption', 'data-adel': x.id, text: '×', onclick: function () { var it = cur(); it.splice(i, 1); save(it, 'Removed an assumption'); } })])]);
      if (m !== 'unchecked') {
        var hw = el('input', { type: 'text', 'data-how': x.id, value: x.how || '', placeholder: 'For example: the finance director confirmed it at the October board', disabled: ro, 'aria-label': 'How do we know?' });
        hw.addEventListener('blur', function () { var v = hw.value.trim(); if (v === (x.how || '')) return; var it = cur(); it[i].how = v; save(it, 'How we know: ' + x.t); });
        li.appendChild(el('div', { class: 'fxhow' }, [el('b', { text: 'How do we know?' }), hw]));
      }
      li.appendChild(byLine(x.by ? { by: x.by, at: x.at } : null, m === 'unchecked' ? el('span', { text: ' · goes to Diagnose to be tested' }) : null) || el('div', { class: 'fxby', text: m === 'unchecked' ? 'Goes to Diagnose to be tested' : '' }));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    if (!ro && !opts.test) {
      var inp = el('input', { type: 'text', id: 'wkAddA', placeholder: 'finish the sentence', 'aria-label': 'We are assuming that' });
      var add = function () { var t = inp.value.trim().replace(/^we are assuming that\s*/i, ''); if (!t) return inp.focus(); var it = cur(); it.push({ id: 'a' + Date.now().toString(36), t: t, mark: 'unchecked', by: meName(), at: new Date().toISOString() }); save(it, 'Added an assumption'); };
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
      box.appendChild(el('div', { class: 'fxamb' }, [el('span', { class: 'fxpre', text: 'We are assuming that' }), inp, el('button', { class: 'btn sm fxmain', type: 'button', id: 'wkAddABtn', text: 'Add', onclick: add })]));
      box.appendChild(el('p', { class: 'fxmuted', style: 'margin:14px 0 6px', text: 'Stuck? Start from one of these:' }));
      box.appendChild(el('div', { class: 'fxprompts' }, ['This team takes for granted that ', 'People picture the organisation as ', 'Proof here means ', 'Nobody questions that ', 'Everyone in this sector assumes that '].map(function (p) { return el('button', { type: 'button', class: 'fxprompt', text: p + '…', onclick: function () { inp.value = p; inp.focus(); } }); })));
    }
    box.appendChild(msg);
    return box;
  }

  // ---------- part 3: The system ----------
  var CAPNAME = { human: ['People', 'skills, time, people'], social: ['Relationships', 'trust, partners, goodwill'], manufactured: ['Buildings and kit', 'buildings, equipment, systems'], information: ['Information', 'data, records, know-how'], financial: ['Money', 'budgets, funding'], natural: ['Land, water, energy', 'natural resources'] };
  function statementState() {
    var st = ((row('frame') || {}).content || {}).statement || {};
    var body = stBody(), old = String(st.text || '').replace(/^(Declared|Agreed) on [^.]*\.\s*/, '');
    return { at: st.at, by: st.by, text: st.text, changed: !!st.at && old !== body, past: st.past || [] };
  }
  function stParts() {
    var RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; };
    var svc = (RT && RT.svc && RT.svc()) || fv('system', 'what'), ins = on('inside').slice(0, 5), lo = fv('system', 'leftout'), xp = fv('system', 'expires'), qn = fv('question', 'question');
    return [['t', 'We are looking at '], svc ? ['f', svc] : ['g', 'the service', '/frame' + (EXAMPLE ? location.search : '') + '#box=system'], ins.length ? ['t', ', including '] : null, ins.length ? ['f', ins.join(', ').replace(/, ([^,]*)$/, ' and $1')] : null, ['t', '. We are leaving out '],
      ['b', lo.replace(/\.$/, ''), 'leftout', 'what, and why?'], ['t', '. It is to answer: '], qn ? ['f', qn.replace(/\.?$/, qn.trim().slice(-1) === '?' ? '' : '.')] : ['g', 'the question', '#question'], ['t', ' We will look at it again '], ['b', xp.replace(/\.$/, ''), 'expires', 'when?'], ['t', '.']].filter(Boolean);
  }
  function stBody() { return stParts().map(function (p) { return p[0] === 'b' ? (p[1] || 'not yet said') : p[1]; }).join(''); }
  function drawSystem() {
    var RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; }, a = frameAns();
    var svc = (RT && RT.svc && RT.svc()) || fv('system', 'what') || 'the service';
    var steps = on('work').slice(0, 7), ins = on('inputs'), outs = on('outputs'), outside = RT ? RT.L(r, 'outside').filter(function (x) { return x.on; }).map(function (x) { return x.t; }) : [];
    var runs = (a.requires && a.requires.runs) || [], purpose = fv('service', 'for');
    var W = 1060, bx2 = outside.length ? 836 : 1052, left = 176, right = bx2 - 22, items = [];
    items.push(ins.length ? { t: ins.slice(0, 2).join(', '), k: 'io', head: 'In' } : { t: 'Comes in', k: 'opt', sub: 'optional' });
    (steps.length ? steps : ['Add the main steps']).forEach(function (s) { items.push({ t: s, k: steps.length ? 'step' : 'opt' }); });
    items.push(outs.length ? { t: outs.slice(0, 2).join(', '), k: 'io', head: 'Out' } : { t: 'Goes out', k: 'opt', sub: 'optional' });
    var gap = 10, iw = Math.min(150, (right - left - gap * (items.length - 1)) / items.length), cy = 150;
    var wrapT = function (s, w, n) { n = n || 2; var max = Math.max(6, Math.floor(w / 8.2)), words = String(s).split(/\s+/), lines = [''], i; for (i = 0; i < words.length; i++) { var t = (lines[lines.length - 1] + ' ' + words[i]).trim(); if (t.length > max && lines[lines.length - 1]) { if (lines.length === n) { lines[n - 1] = (lines[n - 1] + '…'); break; } lines.push(words[i]); } else lines[lines.length - 1] = t; } return lines.slice(0, n); };
    var T = function (x, y, s, cls, anchor) { return '<text x="' + x + '" y="' + y + '" class="' + cls + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(s) + '</text>'; };
    var s = '<svg class="fxsys" viewBox="0 0 ' + W + ' 340" role="img" aria-label="' + esc('The system: ' + svc + '. ' + (steps.length ? 'The work: ' + steps.join(', ') + '. ' : '') + (outside.length ? 'Outside: ' + outside.join(', ') + '.' : '')) + '">';
    s += '<rect x="4" y="18" width="' + (bx2 - 4) + '" height="312" rx="20" class="fxs-bound"/>' + T(26, 46, 'INSIDE: ' + wrapT(svc, 900)[0], 'fxs-h');
    s += '<circle cx="96" cy="' + cy + '" r="62" class="fxs-purpose"/>' + T(96, cy - 20, 'Purpose', 'fxs-b', 'middle');
    wrapT(purpose || 'not said yet', 118, 3).forEach(function (l, i) { s += T(96, cy + 0 + i * 15, l, 'fxs-s', 'middle'); });
    s += '<path d="M160 ' + cy + ' H' + (left - 6) + '" class="fxs-arrow"/>';
    items.forEach(function (it, i) {
      var x = left + i * (iw + gap), h = 64, y = cy - h / 2;
      s += '<rect x="' + x + '" y="' + y + '" width="' + iw + '" height="' + h + '" rx="12" class="fxs-' + it.k + '"/>';
      var ls = wrapT(it.t, iw - 12); if (it.head) ls = [it.head + ': ' + ls[0]].concat(ls.slice(1));
      var lines = it.sub ? [ls[0], it.sub] : ls;
      lines.forEach(function (l, j) { s += T(x + iw / 2, cy + 5 - (lines.length - 1) * 9 + j * 18, l, it.k === 'opt' ? 'fxs-s' : 'fxs-t', 'middle'); });
    });
    // what it runs on
    var groups = {}; runs.forEach(function (x) { (groups[x.cap] = groups[x.cap] || []).push(x.t); });
    var gl = Object.keys(groups).map(function (k) { return (CAPNAME[k] ? CAPNAME[k][0] : 'Other') + ': ' + groups[k].join(', '); });
    s += '<rect x="24" y="232" width="' + (bx2 - 44) + '" height="84" rx="14" class="fxs-band"/>' + T(42, 256, 'WHAT IT RUNS ON', 'fxs-h');
    if (!gl.length) s += T(42, 282, 'Nothing recorded yet', 'fxs-s');
    var colW = (bx2 - 80) / 2;
    gl.slice(0, 4).forEach(function (g, i) { s += T(42 + (i % 2) * colW, 280 + Math.floor(i / 2) * 22, wrapT(g, colW - 10)[0], 'fxs-t2'); });
    if (outside.length) {
      s += '<rect x="868" y="' + (cy - 46) + '" width="186" height="92" rx="14" class="fxs-out"/>' + T(961, cy - 22, 'OUTSIDE', 'fxs-h', 'middle');
      (outside.length === 1 ? wrapT(outside[0], 160) : outside.slice(0, 2).map(function (o) { return wrapT(o, 160)[0]; })).forEach(function (o, i) { s += T(961, cy + 2 + i * 20, o, 'fxs-t', 'middle'); });
      s += '<path d="M864 ' + cy + ' H' + (left + items.length * (iw + gap) - gap + 4) + '" class="fxs-dash"/>';
    }
    return s + '</svg>';
  }
  function renderSystemOld() {
    var RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, a = frameAns(), ro = !!S.readonly, ex = EXAMPLE ? location.search : '';
    var on = function (k) { return RT ? RT.on(r, k) : []; };
    var st = statementState(), blanks = function () { return stParts().filter(function (p) { return p[0] === 'b' && !p[1]; }).length; };
    var wrap = el('div', { class: 'fx', id: 'fxSystem' }); main.appendChild(wrap);
    var statusTxt = function () { var n = blanks(), s2 = statementState(); return s2.at && !s2.changed ? 'Agreed on ' + dlong(s2.at) + (s2.by ? ' by ' + s2.by.replace(/ \(master\)$/, '') : '') + '.' : s2.changed ? 'Changed since it was agreed: agree it again.' : n ? n + (n === 1 ? ' blank' : ' blanks') + ' to fill, then agree it.' : 'Ready to agree.'; };
    wrap.appendChild(fxPath('system', st.at && !st.changed ? 'agreed' : blanks() ? blanks() + (blanks() === 1 ? ' blank' : ' blanks') : 'ready to agree'));
    wrap.appendChild(fxTitle('The system', 'Say exactly what you are looking at and what you are leaving out, in one sentence the whole team agrees.', [el('span', { text: 'About 10 minutes' }), el('span', { class: 'fxsep', text: '·' }), el('b', { id: 'sysStatusTxt', text: statusTxt() })], 'y'));
    // the sentence, with its blanks filled in place
    var sent = el('p', { class: 'fxsentence', id: 'sysSentence' });
    var tests = stopTests(), arg = tests.filter(function (t) { return t.id === 'arguable'; })[0];
    var agreeBtn = ro ? null : el('button', { class: 'btn fxmain', type: 'button', id: 'sysDeclare' });
    var agreeNote = el('span', { class: 'fxmuted', id: 'sysAgreeNote' });
    var pill = el('span', { class: 'fxtag' });
    var paint = function () {
      sent.innerHTML = '';
      stParts().forEach(function (p) {
        if (p[0] === 't') return sent.appendChild(document.createTextNode(p[1]));
        if (p[0] === 'f') return sent.appendChild(el('span', { class: 'fxfill', text: p[1] }));
        if (p[0] === 'g') return sent.appendChild(el('a', { class: 'fxblank', href: p[2], text: p[1] + ' ✎' }));
        var k = p[2];
        if (FX.edit === 'st-' + k && !ro) {
          var inp = el('input', { type: 'text', 'data-field': 'system.' + k, value: p[1], placeholder: k === 'leftout' ? 'GP practices, because the trust cannot change how they work' : 'after the March board, or if the rota changes', 'aria-label': k === 'leftout' ? 'What we are leaving out, and why' : 'When we will look at it again' });
          var done = async function () { var v = inp.value.trim(); FX.edit = null; try { if (v !== fv('system', k)) await saveFrameField('system', k, v); } catch (e) { agreeNote.textContent = saveErr(e); } paint(); };
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') { FX.edit = null; paint(); } });
          sent.appendChild(el('span', { class: 'fxinline' }, [inp, el('button', { class: 'btn sm fxmain', type: 'button', 'data-done': k, text: 'Done', onmousedown: function (e) { e.preventDefault(); }, onclick: done })]));
          setTimeout(function () { inp.focus(); }, 0);
        } else if (p[1]) sent.appendChild(el('button', { class: 'fxfill fxeditable', type: 'button', 'data-blank': k, title: 'Change this', text: p[1], disabled: ro, onclick: function () { FX.edit = 'st-' + k; paint(); } }));
        else sent.appendChild(el('button', { class: 'fxblank', type: 'button', 'data-blank': k, text: p[3] + ' ✎', disabled: ro, onclick: function () { FX.edit = 'st-' + k; paint(); } }));
      });
      var s2 = statementState(), n = blanks(), argOk = !!(((row('frame') || {}).content || {}).stopTests || {}).arguable;
      pill.className = 'fxtag ' + (s2.at && !s2.changed ? 'ok' : ''); pill.textContent = s2.at ? (s2.changed ? 'Changed since agreed' : 'Agreed ' + dshort(s2.at)) : 'Draft';
      if (agreeBtn) { agreeBtn.disabled = !!n || !!(s2.at && !s2.changed); agreeBtn.textContent = s2.at ? (s2.changed ? 'Agree it again' : 'Agreed') : 'Agree this as our starting point'; }
      agreeNote.textContent = n ? 'Fill the ' + (n === 1 ? 'last blank' : n + ' blanks') + ' to agree it.' : s2.at && !s2.changed ? 'Agreed by ' + (s2.by || '').replace(/ \(master\)$/, '') + '. It can still be changed.' : !argOk ? 'Tick the box if someone could disagree with it.' : '';
      var stx = document.getElementById('sysStatusTxt'); if (stx) stx.textContent = statusTxt();
    };
    if (agreeBtn) agreeBtn.addEventListener('click', async function () {
      var now = new Date().toISOString(), txt = 'Agreed on ' + dlong(now) + '. ' + stBody();
      try { await saveFrameContent(function (c) { var past = (c.statement && c.statement.at) ? [c.statement].concat(c.statement.past || []).map(function (x) { return { at: x.at, text: x.text, by: x.by }; }).slice(0, 10) : []; c.statement = { at: now, text: txt, by: meName(), past: past }; }, 'The frame agreed as our starting point'); render(); } catch (e) { agreeNote.textContent = saveErr(e); }
    });
    var argCb = el('input', { type: 'checkbox', 'data-stop': 'arguable', disabled: ro }); argCb.checked = !!(arg && arg.ok);
    argCb.addEventListener('change', async function () { try { await saveFrameContent(function (c) { c.stopTests = c.stopTests || {}; c.stopTests.arguable = argCb.checked; }, 'The boundary test ' + (argCb.checked ? 'ticked' : 'unticked')); paint(); } catch (e) { argCb.checked = !argCb.checked; } });
    var w1 = whyBits('system.leftout');
    wrap.appendChild(el('div', { class: 'fxcard fxhero', id: 'sysStatement', 'data-sys': 'statement' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'Our starting point, in one sentence' }), w1.btn, el('span', { class: 'fxgrow' }), pill]), w1.txt, sent,
      el('div', { class: 'fxagree' }, [el('label', { class: 'fxcheckrow' }, [argCb, el('span', { text: 'The boundary is plain enough for someone to disagree with' })]), el('span', { class: 'fxgrow' }), agreeNote, agreeBtn])]));
    paint();
    // the picture
    wrap.appendChild(el('div', { class: 'fxcard fxpic', id: 'sysPictureBox', 'data-sys': 'picture' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'The picture' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#mdl', id: 'sysPicture', text: 'Open full size' })]), el('div', { class: 'fxpicbody', html: drawSystem() })]));
    // what it is made of
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'What it is made of' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'Change any of it with Edit.' }));
    var hS = '/frame' + ex + '#box=system', hR = '/frame' + ex + '#box=requires';
    var li = function (b, v) { return el('li', {}, [el('b', { text: b + ': ' }), document.createTextNode(v)]); };
    var outs = RT ? RT.L(r, 'outside').filter(function (x) { return x.on; }).map(function (x) { return x.t; }) : [];
    var card = function (id, h, href, kids) { return el('div', { class: 'fxcard fxpart', 'data-sys': id }, [el('div', { class: 'fxqhead' }, [el('h3', { class: 'fxsech', text: h }), el('span', { class: 'fxgrow' }), ro ? null : el('a', { class: 'btn sm', href: href, text: 'Edit' })])].concat(kids)); };
    var opt = function (t, href) { return ro ? null : el('a', { class: 'fxopt', href: href }, [document.createTextNode('+ ' + t + ' '), el('small', { text: '(optional)' })]); };
    var runs = (a.requires && a.requires.runs) || [];
    wrap.appendChild(el('div', { class: 'fxparts' }, [
      card('bounds', 'Boundaries', hS, [el('ul', {}, [li('Part of', r.standalone ? 'it stands alone' : on('within').join(', ') || 'not said yet'), li('Inside, run by the team', on('inside').join(', ') || 'not said yet'), li('Outside, decided elsewhere', outs.join(', ') || 'not said yet')])]),
      card('function', 'How it works', hS, [el('ul', {}, [on('inputs').length ? li('Comes in', on('inputs').join(', ')) : null, li('The work', on('work').join(', ') || 'not said yet'), on('outputs').length ? li('Goes out', on('outputs').join(', ')) : null]), on('inputs').length ? null : opt('What comes in', hS), on('outputs').length ? null : el('br'), on('outputs').length ? null : opt('What goes out', hS)]),
      card('capitals', 'What it runs on', hR, [el('div', { class: 'fxcaps' }, Object.keys(CAPNAME).map(function (k) { var xs = runs.filter(function (x) { return x.cap === k; }); return xs.length ? el('div', { class: 'fxcap', 'data-cap': k, title: CAPNAME[k][1] }, [el('b', { text: CAPNAME[k][0] }), document.createTextNode(xs.map(function (x) { return x.t; }).join(', '))]) : el('a', { class: 'fxcap gap', 'data-cap': k, href: hR, title: CAPNAME[k][1] }, [el('b', { text: CAPNAME[k][0] }), el('span', { text: 'optional' })]); }))])]));
    wrap.appendChild(el('h2', { class: 'fxh2', id: 'sysAround', text: 'What it is for, who it matters to, and what can be changed' }));
    renderWork('system', wrap);
    wrap.appendChild(fxFoot(['1.1 The question', '#question'], ['Next: 1.3 Thresholds', '#line'], 'You can go on before agreeing the sentence, and come back.'));
  }

  // ---------- history: every saved change to this part, who made it and when ----------
  var PART_OF = { question: 'q', help: 'q', service: 'y', value: 'y', exposure: 'y', gap: 'l', good: 'l', guesses: 'q', alt: 'q', assume: 'q', system: 'y', root: 'y', ppatterns: 'y', passure: 'y' };
  var LABELS = { 'question.question': 'the question', 'question.whose': 'whose problem it is', 'question.want': 'whether we want to solve it', 'question.sothat': 'what it will make possible', 'question.decision': 'the decision it informs', 'question.advance': 'whether the answer could be written in advance', 'question.nothing': 'what happens if we do nothing', 'question.before': 'what was tried before', 'service.for': 'what it is for', 'service.never': 'what must never change', 'help.why': 'why now', 'value.gains': 'who gains', 'exposure.exposed': 'who is hurt', 'exposure.absent': 'who is affected but not asked', 'gap.mustnot': 'what must never happen', 'good.primary': 'the measure that matters most', 'guesses.text': 'first guesses', 'alt.text': 'how else it could be seen', 'system.leftout': 'what we are leaving out', 'system.expires': 'when we will look at it again' };
  function histItem(v) {
    var m = /^Changed: (\w+) \((\w+)\)$/.exec(v.summary || ''), part = null, label = v.summary || 'A change';
    if (m) { var key = m[1] + '.' + m[2]; part = m[1] === 'question' ? (m[2] === 'levers' ? 'y' : 'q') : PART_OF[m[1]]; label = 'changed ' + (LABELS[key] || m[1]); return { part: part, label: label, box: m[1], k: m[2] }; }
    var s = (v.summary || '').toLowerCase();
    part = /^the line/.test(s) ? 'l' : /assumption|how we know/.test(s) ? 'q' : /before moving on|team note/.test(s) ? 'y' : /frame (declared|agreed)|boundary test/.test(s) ? 'y' : /question/.test(s) ? 'q' : null;
    return { part: part, label: (v.summary || 'A change').replace(/^Changed: /, 'changed ') };
  }
  async function openHistory(part, tileKey) {
    tileKey = tileKey || 'frame';
    var old = document.getElementById('fxHist'); if (old) old.remove();
    var list = el('ol', { class: 'fxhist' }, [el('li', { class: 'fxmuted', text: 'Loading…' })]);
    var close = function () { panel.remove(); document.removeEventListener('keydown', esc1); };
    var esc1 = function (e) { if (e.key === 'Escape') close(); };
    var panel = el('aside', { class: 'fx fxdrawer', id: 'fxHist', role: 'dialog', 'aria-label': 'History' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'History of this page' }), el('span', { class: 'fxgrow' }), el('button', { class: 'fxico', type: 'button', 'aria-label': 'Close', text: '×', onclick: close })]), el('p', { class: 'fxmuted', text: 'Every change, who made it and when. Open one to see what changed.' }), list]);
    document.body.appendChild(panel); document.addEventListener('keydown', esc1);
    var h = []; try { h = (await api({ action: 'p_history', tile_key: tileKey })).history || []; } catch (e) { list.innerHTML = ''; list.appendChild(el('li', { text: saveErr(e) })); return; }
    var items = h.map(function (v) { return Object.assign({ v: v }, tileKey === 'frame' ? histItem(v) : { part: part, label: (v.summary || 'a change').replace(/^./, function (c) { return c.toLowerCase(); }) }); }).filter(function (x) { return x.part === part; });
    list.innerHTML = '';
    if (!items.length) list.appendChild(el('li', { class: 'fxmuted', text: 'No changes on this page yet.' }));
    items.slice(0, 60).forEach(function (x) {
      var who = x.v.saved_by || 'Someone', detail = el('div', { class: 'fxhwas', hidden: true });
      var li = el('li', {}, [el('div', { class: 'fxhwho' }, [avatar(who), el('span', {}, [el('b', { text: who.replace(/ \(master\)$/, '') + ' ' + x.label }), el('span', { class: 'fxmuted', text: ' · ' + dshort(x.v.saved_at) + ', ' + new Date(x.v.saved_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })])])]);
      if (x.box) {
        var btn = el('button', { class: 'fxlink', type: 'button', text: 'Show what changed', onclick: async function () {
          if (!detail.hidden) { detail.hidden = true; btn.textContent = 'Show what changed'; return; }
          detail.hidden = false; btn.textContent = 'Hide'; detail.textContent = 'Loading…';
          try {
            var now = (await api({ action: 'p_version', tile_key: 'frame', version: x.v.version })).version, prev = null;
            try { prev = (await api({ action: 'p_version', tile_key: 'frame', version: x.v.version - 1 })).version; } catch (e) {}
            var g = function (ver) { var c = ver && ver.content && ver.content.answers; return String((c && c[x.box] && c[x.box].fields && c[x.box].fields[x.k]) || ''); };
            var before = g(prev), after = g(now);
            detail.innerHTML = '';
            if (before) detail.appendChild(el('del', { text: before }));
            detail.appendChild(el('div', { text: after || '(cleared)' }));
            if (before && !S.readonly && before !== fv(x.box, x.k)) detail.appendChild(el('button', { class: 'fxlink', type: 'button', text: 'Put back the earlier wording', onclick: async function () { try { if (x.box === 'question' && x.k === 'question') await saveQuestion(before); else await saveFrameField(x.box, x.k, before); close(); render(); } catch (e) { detail.appendChild(el('div', { class: 'fxby bad', text: saveErr(e) })); } } }));
          } catch (e) { detail.textContent = saveErr(e); }
        } });
        li.appendChild(btn); li.appendChild(detail);
      }
      list.appendChild(li);
    });
  }

  // ---------- Frame, part 3: The line (31 October 2026) ----------
  // Where harm becomes intolerable, declared before any modelling. Three holders draw their own line for each
  // capital: the people the service is for (first), the organisation and the regulator. The lines are never
  // merged; the strictest governs, dimension by dimension (how bad, to how many, for how long), as in the old
  // Lab's Move 12. Each line has five parts: the line, the measure, how long, what triggers action, who responds.
  // Four tools help draw it: the letters, what has been tolerated, lines kept only for show, the comfort edge.
  var LCAPS = [
    ['human', 'People', 'health, safety and wellbeing', 'the family', ['distress', 'harm needing treatment', 'lasting harm', 'death']],
    ['financial', 'Money', 'money, costs and income', 'the funders or shareholders', ['a cost absorbed', 'a loss that hurts', 'a loss that cannot be recovered', 'the organisation fails']],
    ['manufactured', 'Buildings and kit', 'the things people rely on', 'the people who rely on them, with the notice closing it', ['out of use briefly', 'out of use for a long time', 'destroyed', 'destroyed and dangerous']],
    ['social', 'Relationships and trust', 'being listened to, treated fairly, able to trust', 'the person who raised it and was ignored', ['upset', 'trust damaged', 'trust broken', 'the relationship ends']],
    ['natural', 'Land, water, energy', 'air, water, land', 'the community downstream', ['noticed', 'damaged, recovers', 'lasting damage', 'lost for good']],
    ['information', 'Information', 'records kept, correct, private and there when needed', 'the people whose records are gone', ['delayed', 'wrong', 'lost', 'disclosed']]];
  var LHOLD = [['people', 'The people it is for', 'They set theirs first, before they see anyone else’s threshold'], ['org', 'The organisation', 'The board or the accountable person'], ['reg', 'The regulator', 'From what the regulator has published or said']];
  var LSCALE = ['one person', 'a few people', 'many people', 'a whole group or place'];
  var LDUR = ['hours', 'days', 'weeks', 'months', 'for good'];
  var lineQ = Promise.resolve();
  function lineData() { return ((row('frame') || {}).content || {}).line || {}; }
  function saveLine(fn, summary) { var run = lineQ.then(function () { return saveFrameContent(function (c) { c.line = c.line || {}; fn(c.line, c); }, 'Thresholds: ' + summary); }); lineQ = run.catch(function () {}); return run; }
  function capOf(k) { return LCAPS.filter(function (c) { return c[0] === k; })[0]; }
  function lineOf(cap, h) { return (((lineData().lines || {})[cap]) || {})[h] || {}; }
  var isNum = function (v) { return v !== '' && v != null && !isNaN(Number(v)); };
  function hasLine(l) { return !l.none && isNum(l.sev) && isNum(l.scale) && isNum(l.dur); }
  function bandText(cap, l) { var c = capOf(cap); return c[4][Number(l.sev)] + ', to ' + LSCALE[Number(l.scale)] + ', lasting ' + LDUR[Number(l.dur)]; }
  // the strictest line, dimension by dimension, and whose it is
  function govern(cap) {
    var out = {}, any = false;
    ['sev', 'scale', 'dur'].forEach(function (k) {
      var best = null, who = [];
      LHOLD.forEach(function (h) { var l = lineOf(cap, h[0]); if (!hasLine(l)) return; any = true; var v = Number(l[k]); if (best === null || v < best) { best = v; who = [h[0]]; } else if (v === best) who.push(h[0]); });
      out[k] = { v: best, who: who };
    });
    return any ? out : null;
  }
  function govText(cap) { var g = govern(cap); return g ? bandText(cap, { sev: g.sev.v, scale: g.scale.v, dur: g.dur.v }) : ''; }
  function govWho(cap) { var g = govern(cap); if (!g) return []; var o = {}; ['sev', 'scale', 'dur'].forEach(function (k) { g[k].who.forEach(function (w) { o[w] = 1; }); }); return LHOLD.filter(function (h) { return o[h[0]]; }).map(function (h) { return h[1]; }); }
  // the line in words, for the rest of the Lab: the sentence if written, else the strictest line for people
  function lineText() {
    var m = fv('gap', 'mustnot'); if (m) return m;
    var first = LCAPS.filter(function (c) { return govern(c[0]); })[0];
    return first ? first[1] + ': ' + govText(first[0]) : '';
  }
  function lineGoverning() { return LCAPS.filter(function (c) { return govern(c[0]); }).map(function (c) { return { cap: c[0], name: c[1], text: govText(c[0]), who: govWho(c[0]) }; }); }
  // what the lines show: each a finding, never smoothed over
  function lineFindings() {
    var L = lineData(), out = [];
    var worse = function (a, b) { var w = []; if (Number(a.sev) > Number(b.sev)) w.push('worse harm'); if (Number(a.scale) > Number(b.scale)) w.push('harm to more people'); if (Number(a.dur) > Number(b.dur)) w.push('harm that lasts longer'); return w; };
    LCAPS.forEach(function (c) {
      var ls = {}; LHOLD.forEach(function (h) { ls[h[0]] = lineOf(c[0], h[0]); });
      var drawn = LHOLD.filter(function (h) { return hasLine(ls[h[0]]); });
      if (!drawn.length) out.push({ k: 'gap', cap: c[0], t: 'No threshold has been set for ' + c[1].toLowerCase() + '. A capital nobody can set a threshold for is a finding in itself.' });
      LHOLD.forEach(function (h) { if (ls[h[0]].none) out.push({ k: 'none', cap: c[0], t: h[1] + ' could not set a threshold for ' + c[1].toLowerCase() + (ls[h[0]].why ? ': ' + ls[h[0]].why : '.') }); });
      if (drawn.length && !hasLine(ls.people) && !ls.people.none) out.push({ k: 'people', cap: c[0], t: 'The people the service is for have not set their threshold for ' + c[1].toLowerCase() + ' yet.' });
      if (hasLine(ls.org) && hasLine(ls.people)) { var w = worse(ls.org, ls.people); if (w.length) out.push({ k: 'differ', cap: c[0], t: c[1] + ': the organisation’s threshold allows ' + w.join(', ') + ' than the people it is for would accept.' }); }
      if (hasLine(ls.org) && hasLine(ls.reg)) { var w2 = worse(ls.org, ls.reg); if (w2.length) out.push({ k: 'differ', cap: c[0], t: c[1] + ': the organisation’s threshold allows ' + w2.join(', ') + ' than the regulator’s.' }); }
      drawn.forEach(function (h) { var l = ls[h[0]]; var miss = [!String(l.measure || '').trim() ? 'no measure' : null, !String(l.trigger || '').trim() ? 'nothing that triggers action' : null, !String(l.responder || '').trim() ? 'no one named to respond' : null].filter(Boolean); if (miss.length) out.push({ k: 'parts', cap: c[0], t: c[1] + ', ' + h[1].toLowerCase() + '’s threshold: ' + miss.join(', ') + '.' }); });
    });
    (L.tolerated || []).forEach(function (x) { var g = govern(x.cap); if (!g || !isNum(x.sev)) return; var past = Number(x.sev) >= g.sev.v && (!isNum(x.scale) || Number(x.scale) >= g.scale.v) && (!isNum(x.dur) || Number(x.dur) >= g.dur.v); if (past) out.push({ k: 'tolerated', cap: x.cap, t: 'Has happened and was lived with: ' + (x.what || 'an event') + (x.when ? ' (' + x.when + ')' : '') + '. It is at or past the threshold for ' + (capOf(x.cap) || [0, 'this capital'])[1].toLowerCase() + ', so the threshold actually lived by is looser than the one declared.' }); });
    (L.show || []).forEach(function (x) { if (x.triggered === 'never') out.push({ k: 'show', t: 'Kept only for show: “' + (x.line || 'a threshold') + '”' + (x.where ? ' (' + x.where + ')' : '') + ' has never triggered action.' }); });
    (L.comfort || []).forEach(function (x) { if (x.decided && x.decided !== 'yes' && x.stopped) out.push({ k: 'comfort', t: 'Stopped without anyone deciding: ' + x.stopped + '.' }); });
    return out;
  }
  function lineBody() { var g = lineGoverning(); return g.length ? g.map(function (x) { return x.name + ': ' + x.text; }).join('. ') + '.' : ''; }
  function lineState() { var ag = lineData().agreed || {}; return { at: ag.at, by: ag.by, text: ag.text, changed: !!ag.at && String(ag.text || '').replace(/^Agreed on [^.]*\.\s*/, '') !== lineBody() }; }

  // a small list editor, saved on change: [{ k, l, t: 'text' | 'sel' | 'long', o: [[v, label]], w }]
  function fxList(o) {
    var ro = !!S.readonly, list = (lineData()[o.k] || []).slice(), msg = el('div', { class: 'fxby bad', hidden: true });
    var save = function (l, why) { saveLine(function (L) { L[o.k] = l; }, why).then(render, function (e) { msg.hidden = false; msg.textContent = saveErr(e); }); };
    var box = el('div', { class: 'fxlist', 'data-list': o.k });
    if (list.length) {
      var tb = el('table', { class: 'fxtable' }, [el('thead', {}, [el('tr', {}, o.fields.map(function (f) { return el('th', { text: f.l }); }).concat([el('th', { text: '' })]))])]), body = el('tbody');
      list.forEach(function (x, i) {
        body.appendChild(el('tr', { 'data-row': String(i) }, o.fields.map(function (f) {
          var inp;
          if (f.t === 'sel') { var opts = typeof f.o === 'function' ? f.o(x) : f.o; inp = el('select', { disabled: ro, 'data-f': f.k }, [el('option', { value: '', text: '' })].concat(opts.map(function (p) { return el('option', { value: String(p[0]), text: p[1] }); }))); inp.value = x[f.k] == null ? '' : String(x[f.k]); inp.addEventListener('change', function () { var l = list.slice(); l[i] = Object.assign({}, l[i]); l[i][f.k] = inp.value; if (f.reset) f.reset.forEach(function (r) { l[i][r] = ''; }); save(l, o.title.toLowerCase()); }); }
          else { inp = el(f.t === 'long' ? 'textarea' : 'input', { type: 'text', rows: 1, disabled: ro, 'data-f': f.k, placeholder: f.ph || '' }); inp.value = x[f.k] || ''; if (f.t === 'long') grow(inp); inp.addEventListener('blur', function () { if (inp.value.trim() === (x[f.k] || '')) return; var l = list.slice(); l[i] = Object.assign({}, l[i]); l[i][f.k] = inp.value.trim(); save(l, o.title.toLowerCase()); }); }
          return el('td', { style: f.w ? 'width:' + f.w : null }, [inp]);
        }).concat([el('td', {}, [ro ? null : el('button', { class: 'fxico', type: 'button', 'aria-label': 'Remove', text: '×', onclick: function () { var l = list.slice(); l.splice(i, 1); save(l, 'removed from ' + o.title.toLowerCase()); } })])])));
      });
      tb.appendChild(body); box.appendChild(el('div', { class: 'fxscrollx' }, [tb]));
    } else box.appendChild(el('p', { class: 'fxmuted', text: o.empty || 'Nothing yet.' }));
    if (!ro) box.appendChild(el('button', { class: 'btn sm', type: 'button', 'data-addrow': o.k, text: '+ ' + (o.add || 'Add one'), onclick: function () { var l = list.slice(); l.push(Object.assign({ id: 'x' + Date.now().toString(36), by: meName(), at: new Date().toISOString() }, o.blank || {})); save(l, 'added to ' + o.title.toLowerCase()); } }));
    box.appendChild(msg);
    return box;
  }

  function renderLine() {
    var ro = !!S.readonly, L = lineData(), ex = EXAMPLE ? location.search : '';
    var wrap = el('div', { class: 'fx', id: 'fxLine' }); main.appendChild(wrap);
    var gov = lineGoverning(), st = lineState(), F = lineFindings();
    var drawnN = 0; LCAPS.forEach(function (c) { LHOLD.forEach(function (h) { if (hasLine(lineOf(c[0], h[0])) || lineOf(c[0], h[0]).none) drawnN++; }); });
    wrap.appendChild(fxPath('line', gov.length + ' of 6 capitals'));
    if (window.VTStake) wrap.appendChild(window.VTStake.strip(VTX, 'line'));
    wrap.appendChild(fxTitle('Thresholds', 'Where harm becomes intolerable, declared before any modelling. The people the service is for set their threshold first, then the organisation, then the regulator. The thresholds are never merged: the strictest governs.', [el('span', { text: drawnN + ' of 18 thresholds set' }), el('span', { class: 'fxsep', text: '·' }), el('b', { text: st.at && !st.changed ? 'Agreed on ' + dlong(st.at) + '.' : st.changed ? 'Changed since it was agreed.' : gov.length ? 'Not agreed yet.' : 'Start with the people the service is for.' })], 'l'));
    // in one sentence, and the one measure
    wrap.appendChild(el('div', { class: 'fxqs two', id: 'lnTop' }, [qCard({ box: 'gap', k: 'mustnot', l: 'In one sentence: what must never happen?', eg: 'a dangerous result left more than 12 hours without a doctor seeing it.' }, { card: true }), qCard({ box: 'good', k: 'primary', l: 'Which one measure matters most?', eg: 'hours from result to a doctor who can act. Pick it now, before anything is tested.' }, { card: true })]));
    // the lines, capital by capital
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'The thresholds, capital by capital' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'For each capital, the point where harm becomes intolerable: how bad, to how many, for how long. Choose a cell to set a threshold. If a threshold cannot be set, say so: that is a finding.' }));
    var grid = el('table', { class: 'fxtable fxlines', id: 'lnGrid' }), head = el('tr', {}, [el('th', { text: 'Capital' })].concat(LHOLD.map(function (h, i) { var me = !i && window.VTStake ? window.VTStake.mostExposed(VTX, 3) : []; return el('th', {}, [el('b', { text: (i + 1) + '. ' + h[1] }), el('div', { class: 'fxmuted', text: h[2] }), me.length ? el('div', { class: 'fxmuted sm', id: 'lnMostExposed', text: 'Most exposed: ' + me.join('; ') }) : null]); })).concat([el('th', { text: 'The threshold that governs' })]));
    grid.appendChild(el('thead', {}, [head]));
    var gb = el('tbody');
    LCAPS.forEach(function (c) {
      var g = govern(c[0]);
      gb.appendChild(el('tr', { 'data-cap': c[0] }, [el('th', { scope: 'row' }, [el('b', { text: c[1] }), el('div', { class: 'fxmuted', text: c[2] })])].concat(LHOLD.map(function (h) {
        var l = lineOf(c[0], h[0]), open = FX.lineEdit === c[0] + '.' + h[0], gw = g && ['sev', 'scale', 'dur'].some(function (k) { return g[k].who.indexOf(h[0]) >= 0; });
        var txt = hasLine(l) ? bandText(c[0], l) : l.none ? 'No threshold can be set' : '';
        return el('td', { class: (open ? 'on ' : '') + (gw ? 'gov' : '') }, [el('button', { class: 'fxcell' + (txt ? '' : ' empty'), type: 'button', 'data-line': c[0] + '.' + h[0], disabled: ro && !txt, onclick: function () { FX.lineEdit = open ? null : c[0] + '.' + h[0]; render(); setTimeout(function () { var e = document.getElementById('lnEdit'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 30); } }, [document.createTextNode(txt || (ro ? '' : 'Set the threshold')), l.words ? el('small', { text: '“' + cutT(l.words, 70) + '”' }) : null])]);
      })).concat([el('td', { class: 'fxgov', 'data-gov': c[0] }, g ? [el('b', { text: govText(c[0]) }), el('div', { class: 'fxmuted', text: 'From ' + govWho(c[0]).join(' and ').toLowerCase() })] : [el('span', { class: 'fxmuted', text: 'No threshold yet' })])])));
    });
    grid.appendChild(gb);
    wrap.appendChild(el('div', { class: 'fxscrollx' }, [grid]));
    // one line, open for drawing: the five parts
    if (FX.lineEdit) {
      var pr = FX.lineEdit.split('.'), cap = capOf(pr[0]), hold = LHOLD.filter(function (h) { return h[0] === pr[1]; })[0];
      if (cap && hold) {
        var l0 = lineOf(cap[0], hold[0]), d = Object.assign({}, l0), msg = el('span', { class: 'fxmuted' });
        var sel = function (k, opts, lab) { var s = el('select', { 'data-ln': k, disabled: ro }, [el('option', { value: '', text: 'Choose' })].concat(opts.map(function (o, i) { return el('option', { value: String(i), text: o }); }))); s.value = isNum(d[k]) ? String(d[k]) : ''; s.addEventListener('change', function () { d[k] = s.value; }); return el('label', { class: 'fxq' }, [el('span', { class: 'fxql', text: lab }), s]); };
        var txt = function (k, lab, ph, eg) { var t = el('textarea', { rows: 1, 'data-ln': k, disabled: ro, placeholder: ph || '' }); t.value = d[k] || ''; grow(t); t.addEventListener('input', function () { d[k] = t.value; }); return el('label', { class: 'fxq' }, [el('span', { class: 'fxql', text: lab }), eg ? el('p', { class: 'fxeg' }, [el('span', { text: 'For example: ' }), el('i', { text: eg })]) : null, t]); };
        var none = el('input', { type: 'checkbox', 'data-ln': 'none', disabled: ro }); none.checked = !!d.none; none.addEventListener('change', function () { d.none = none.checked; });
        var letters = ((L.letters || {})[cap[0]]) || {};
        wrap.appendChild(el('section', { class: 'fxcard fxmcard now', id: 'lnEdit' }, [
          el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: cap[1] + ': ' + hold[1].toLowerCase() + '’s threshold' }), el('span', { class: 'fxgrow' }), el('button', { class: 'fxico', type: 'button', 'aria-label': 'Close', text: '×', onclick: function () { FX.lineEdit = null; render(); } })]),
          el('p', { class: 'fxmuted', text: hold[0] === 'people' ? 'Ask the people the service is for before they see anyone else’s threshold. Their threshold is kept apart and never merged.' : hold[0] === 'reg' ? 'Take this from what the regulator has published or said, and say where.' : 'The threshold the board or the accountable person would sign.' }),
          letters.could || letters.couldnot ? el('p', { class: 'fxeg' }, [el('span', { text: 'From the letters: ' }), el('i', { text: (letters.could ? 'could send “' + cutT(letters.could, 90) + '”' : '') + (letters.could && letters.couldnot ? '; ' : '') + (letters.couldnot ? 'could not send “' + cutT(letters.couldnot, 90) + '”' : '') })]) : null,
          el('h3', { class: 'fxsub3', text: '1 The threshold' }),
          el('div', { class: 'fxqs three' }, [sel('sev', cap[4], 'How bad'), sel('scale', LSCALE, 'To how many'), sel('dur', LDUR, 'For how long')]),
          txt('words', 'The threshold in words', 'In the words of whoever drew it', 'no one waits more than 12 hours for a doctor to see a dangerous result'),
          el('div', { class: 'fxqs two' }, [txt('measure', '2 The measure', 'How we would know it had been reached', 'hours from result to a doctor who can act, from the laboratory system'), txt('howlong', '3 How long it can last', 'The exact time, if there is one', '12 hours')]),
          el('div', { class: 'fxqs two' }, [txt('trigger', '4 What triggers action', 'The sign that sets off a response, before the threshold is reached', 'any dangerous result unseen after 6 hours'), txt('responder', '5 Who responds', 'A named role, who knows it is theirs', 'the on-call medical registrar')]),
          el('label', { class: 'fxcheckrow' }, [none, el('span', { text: 'No threshold can be set here' })]),
          txt('why', 'Why not, or where it comes from', 'For the regulator: the document and date', ''),
          ro ? null : el('div', { class: 'fxagree' }, [msg, el('span', { class: 'fxgrow' }), el('button', { class: 'btn fxmain', type: 'button', id: 'lnSave', text: 'Save this threshold', onclick: function () {
            if (!d.none && !(isNum(d.sev) && isNum(d.scale) && isNum(d.dur))) { msg.textContent = 'Choose how bad, to how many and for how long, or tick that no threshold can be set.'; return; }
            saveLine(function (Lx) { Lx.lines = Lx.lines || {}; Lx.lines[cap[0]] = Lx.lines[cap[0]] || {}; Lx.lines[cap[0]][hold[0]] = Object.assign({}, d, { by: meName(), at: new Date().toISOString() }); }, cap[1] + ', ' + hold[1].toLowerCase()).then(function () { FX.lineEdit = null; render(); }, function (e) { msg.textContent = saveErr(e); });
          } })])]));
      }
    }
    // the tools that help draw it
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'Tools to help set the threshold' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'People find it hard to say where the threshold is. These four ways in make it easier, and each can show that the threshold lived by is not the one declared.' }));
    var tool = function (id, h, lede, body) { return el('details', { class: 'fxcard fxtoolcard', id: id, open: FX['open_' + id] ? true : null, ontoggle: function (e) { FX['open_' + id] = e.target.open; } }, [el('summary', {}, [el('span', { class: 'fxsech', text: h })]), el('p', { class: 'fxmuted', text: lede }), body]); };
    var lt = el('div', { class: 'fxletters' });
    LCAPS.forEach(function (c) {
      var lv = ((L.letters || {})[c[0]]) || {};
      var mk = function (k, lab, ph) { var t = el('textarea', { rows: 2, 'data-letter': c[0] + '.' + k, disabled: ro, placeholder: ph }); t.value = lv[k] || ''; grow(t); t.addEventListener('blur', function () { if (t.value.trim() === (lv[k] || '')) return; saveLine(function (Lx) { Lx.letters = Lx.letters || {}; Lx.letters[c[0]] = Object.assign({}, Lx.letters[c[0]] || {}); Lx.letters[c[0]][k] = t.value.trim(); }, 'a letter, ' + c[1].toLowerCase()).catch(function () {}); }); return el('label', { class: 'fxq' }, [el('span', { class: 'fxql', text: lab }), t]); };
      lt.appendChild(el('div', { class: 'fxletter', 'data-cap': c[0] }, [el('b', { text: c[1] + ': writing to ' + c[3] }), el('div', { class: 'fxqs two' }, [mk('could', 'A letter we could still send', 'We are sorry: it caused …'), mk('couldnot', 'A letter we could not send', 'We are writing to tell you that …')])]));
    });
    wrap.appendChild(tool('lnLetters', 'The letters: what we could and could not send', 'For each capital, imagine writing to the people harmed. The threshold falls between the letter you could still send and the one you could not.', lt));
    var capOpts = LCAPS.map(function (c) { return [c[0], c[1]]; });
    wrap.appendChild(tool('lnTolerated', 'What has been tolerated before', 'Times harm happened and the organisation lived with it. If it is at or past the declared threshold, the threshold actually lived by is looser.', fxList({ k: 'tolerated', title: 'What has been tolerated', add: 'Add an event', empty: 'No events recorded yet.', blank: { what: '', when: '', cap: 'human' }, fields: [
      { k: 'what', l: 'What happened', ph: 'A result unseen for 30 hours' }, { k: 'when', l: 'When', ph: 'March 2025', w: '9em' }, { k: 'cap', l: 'Capital', t: 'sel', o: capOpts, reset: ['sev'] },
      { k: 'sev', l: 'How bad', t: 'sel', o: function (x) { var c = capOf(x.cap) || LCAPS[0]; return c[4].map(function (b, i) { return [i, b]; }); } }, { k: 'scale', l: 'To how many', t: 'sel', o: LSCALE.map(function (b, i) { return [i, b]; }) }, { k: 'dur', l: 'How long', t: 'sel', o: LDUR.map(function (b, i) { return [i, b]; }) }, { k: 'done', l: 'What was done', ph: 'Nothing changed' }] })));
    wrap.appendChild(tool('lnShow', 'Thresholds kept only for show', 'Thresholds written in policies, plans or contracts. A threshold that has never triggered action may be there only for show.', fxList({ k: 'show', title: 'Thresholds kept for show', add: 'Add a written threshold', empty: 'No written thresholds checked yet.', blank: { triggered: '' }, fields: [
      { k: 'line', l: 'The threshold as written', ph: 'Critical results acted on within one hour' }, { k: 'where', l: 'Where it is written', ph: 'Pathology policy, 2022' }, { k: 'triggered', l: 'Has it ever triggered action?', t: 'sel', o: [['often', 'Often'], ['once', 'Once or twice'], ['never', 'Never'], ['unknown', 'Not known']] }, { k: 'note', l: 'How we know' }] })));
    wrap.appendChild(tool('lnComfort', 'The comfort edge', 'What have we stopped doing, and did anyone decide? Things that slip without a decision show where the organisation is drifting towards the threshold.', fxList({ k: 'comfort', title: 'The comfort edge', add: 'Add something we stopped', empty: 'Nothing recorded yet.', blank: { decided: '' }, fields: [
      { k: 'stopped', l: 'What we have stopped doing', ph: 'Calling the GP on Friday afternoons' }, { k: 'when', l: 'Since when', w: '9em' }, { k: 'decided', l: 'Did anyone decide?', t: 'sel', o: [['yes', 'Yes, it was decided'], ['no', 'No, it slipped'], ['unknown', 'Not known']] }, { k: 'note', l: 'Who, or how we know' }] })));
    // what the lines show
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'What the thresholds show' }));
    wrap.appendChild(el('section', { class: 'fxcard', id: 'lnFindings' }, F.length ? [el('ul', { class: 'fxfindlist' }, F.map(function (f) { return el('li', { 'data-finding': f.k }, [el('span', { class: 'fxat', text: f.t })]); }))] : [el('p', { class: 'fxmuted', text: gov.length ? 'No gaps, disagreements or thresholds kept for show found so far.' : 'Findings appear here as the thresholds are set.' })]));
    // agree the lines
    var agree = ro ? null : el('button', { class: 'btn fxmain', type: 'button', id: 'lnAgree', disabled: !gov.length || !!(st.at && !st.changed), text: st.at ? (st.changed ? 'Agree the thresholds again' : 'Agreed') : 'Agree the thresholds', onclick: function () { var now = new Date().toISOString(); saveLine(function (Lx) { var past = Lx.agreed && Lx.agreed.at ? [Lx.agreed].concat(Lx.agreed.past || []).map(function (x) { return { at: x.at, by: x.by, text: x.text }; }).slice(0, 10) : []; Lx.agreed = { at: now, by: meName(), text: 'Agreed on ' + dlong(now) + '. ' + lineBody(), past: past }; }, 'agreed').then(render, function () {}); } });
    wrap.appendChild(el('div', { class: 'fxcard fxhero', id: 'lnStatement' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'The thresholds that govern' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag ' + (st.at && !st.changed ? 'ok' : ''), text: st.at ? (st.changed ? 'Changed since agreed' : 'Agreed ' + dshort(st.at)) : 'Draft' })]),
      gov.length ? el('ul', { class: 'fxgovlist' }, gov.map(function (x) { return el('li', {}, [el('b', { text: x.name + ': ' }), document.createTextNode(x.text), el('span', { class: 'fxmuted', text: ' (' + x.who.join(' and ').toLowerCase() + ')' })]); })) : el('p', { class: 'fxmuted', text: 'No thresholds set yet.' }),
      el('div', { class: 'fxagree' }, [el('span', { class: 'fxmuted', text: st.at && !st.changed ? 'Agreed by ' + String(st.by || '').replace(/ \(master\)$/, '') + '. Model, Test and the minimum viable company are judged against these thresholds.' : 'Once agreed, Model, Test and the minimum viable company are judged against these thresholds.' }), el('span', { class: 'fxgrow' }), agree])]));
    wrap.appendChild(fxFoot(['1.2 The system', '#system'], ['On to 2 Diagnose', '/diagnose' + ex], 'You can go on to Diagnose and come back to the thresholds.'));
  }

  // ---------- the Frame Canvas (31 October 2026): the frame on one A4 landscape page, in greyscale ----------
  // Laid out like the business model canvas: the boundary on the left, how it works and what it runs on next,
  // the purpose in the centre, what is prompting it and first guesses next, who it matters to on the right;
  // what we take for granted and what we compare against along the bottom; the starting point beneath.
  // "Blank" prints the same canvas with only the prompts, for a workshop.
  function renderFrameCanvas() {
    var a = frameAns(), f = (a.question && a.question.fields) || {}, hf = (a.help && a.help.fields) || {}, RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; };
    var blank = !!FX.blankCanvas, st = statementState();
    var cut = function (t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
    var val = function (t, n) { return blank || !t ? el('span', { class: 'fce' }, [document.createTextNode(blank ? '' : 'Not yet answered')]) : document.createTextNode(cut(t, n || 240)); };
    var item = function (label, t, n) { return el('div', { class: 'fci' }, [el('b', { text: label }), el('div', {}, [val(t, n)])]); };
    var list = function (label, xs, n) { return el('div', { class: 'fci' }, [el('b', { text: label }), blank || !xs.length ? el('div', {}, [val('', n)]) : el('div', { text: cut(xs.join('; '), n || 200) })]); };
    var cell = function (cls, n, h, prompt, kids) { return el('section', { class: 'fcc ' + cls }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn', text: String(n) }), el('h3', { text: h })]), el('p', { class: 'fcp', text: prompt })].concat(kids)); };
    var outs = RT ? RT.L(r, 'outside').filter(function (x) { return x.on; }).map(function (x) { return x.t; }) : [];
    var runs = (a.requires && a.requires.runs) || [];
    var caps = Object.keys(CAPNAME).map(function (k) { var xs = runs.filter(function (x) { return x.cap === k; }).map(function (x) { return x.t; }); return xs.length ? CAPNAME[k][0] + ': ' + xs.join(', ') : null; }).filter(Boolean);
    var presented = (f.first || hf.first || hf.words || '').replace(/^[“"]|[”"]$/g, '');
    var as = assumptions();
    var canvas = el('article', { class: 'fcanvas' + (blank ? ' blank' : ''), id: 'fcCanvas', 'aria-label': 'Frame Canvas' }, [
      el('div', { class: 'fchead' }, [
        el('div', { class: 'fctitle' }, [el('div', { class: 'fcbrand', text: 'Frame Canvas' }), el('div', { class: 'fcmeta', text: (S.data.session.name || '') }), el('div', { class: 'fcmeta', text: blank ? 'Date:' : dlong(new Date().toISOString()) + ' · ' + (st.at && !st.changed ? 'Agreed ' + dlong(st.at) : 'Draft') })]),
        el('div', { class: 'fcq' }, [el('span', { class: 'fcql', text: 'The question we are working on' }), el('div', { class: 'fcqt' }, [val(f.question, 200)]), !blank && presented ? el('div', { class: 'fcqs', text: 'From the words as first put: “' + cut(presented, 170) + '”' }) : null]),
        el('div', { class: 'fcwho' }, [item('Whose problem is it?', fv('question', 'whose') || f.owner, 110), item('The decision it informs', fv('question', 'decision'), 110)])]),
      el('div', { class: 'fcgrid' }, [
        cell('c1', 1, 'Boundaries', 'What is it part of? What is inside, and what is decided elsewhere? What is left out?', [
          item('Part of', r.standalone ? 'It stands alone' : on('within').join(', '), 100), list('Inside, run by the team', on('inside'), 140), list('Outside, decided elsewhere', outs, 140), item('Left out, and why', fv('system', 'leftout'), 160), item('Look at it again', fv('system', 'expires'), 90)]),
        cell('c2a', 2, 'How it works', 'What comes in, what is the work, what goes out?', [list('Comes in', on('inputs'), 90), list('The work', on('work'), 160), list('Goes out', on('outputs'), 90)]),
        cell('c2b', 3, 'What it runs on', 'People, relationships, buildings and kit, information, money, land, water and energy', [blank || !caps.length ? el('div', {}, [val('', 1)]) : el('ul', {}, caps.map(function (c) { return el('li', { text: cut(c, 90) }); }))]),
        cell('c3', 4, 'Purpose', 'What is it for? What must never change? What will the work make possible?', [el('div', { class: 'fcbig' }, [val(fv('service', 'for'), 180)]), item('What must never change', fv('service', 'never'), 160), item('What it will make possible', fv('question', 'sothat'), 200)]),
        cell('c4a', 5, 'What’s prompting this', 'Why have they come, and why now? Has it been tried before?', [item('Why now', fv('help', 'why'), 170), item('Tried before', fv('question', 'before'), 120)]),
        cell('c4b', 6, 'First guesses', 'What do we think is going on? How else could it be seen?', [item('What is going on', fv('guesses', 'text'), 150), item('How else it could be seen', fv('alt', 'text'), 130)]),
        cell('c5', 7, 'Who it matters to', 'Who gains, who is hurt, where is the threshold, and who is not asked?', [item('Who gains', fv('value', 'gains'), 170), item('Who is hurt if it fails', fv('exposure', 'exposed'), 170), item('What must never happen', fv('gap', 'mustnot'), 140), item('Affected but not asked', fv('exposure', 'absent'), 130)]),
        cell('c6', 8, 'What we take for granted', 'We are assuming that … Has it been tested? Does it hold?', [blank || !as.length ? el('div', {}, [val('', 1)]) : el('ul', { class: 'fcas' }, as.slice(0, 7).map(function (x) { var m = markOf(x); return el('li', {}, [el('span', { class: 'fcmark', text: m === 'holds' ? 'Holds' : m === 'nothold' ? 'Does not hold' : 'Not tested' }), document.createTextNode(cut(x.t, 110))]); }))]),
        cell('c7', 9, 'Thresholds, and what we compare against', 'Where does harm become intolerable, for each capital? The strictest threshold governs. What if we do nothing?', [blank || !lineGoverning().length ? item('The thresholds that govern', '', 1) : el('div', { class: 'fci' }, [el('b', { text: 'The thresholds that govern' }), el('ul', { class: 'fcas' }, lineGoverning().slice(0, 6).map(function (x) { return el('li', { text: x.name + ': ' + cut(x.text, 70) }); }))]), item('If we do nothing', fv('question', 'nothing'), 100), item('The measure that matters most', fv('good', 'primary'), 90)])]),
      el('div', { class: 'fcfoot' }, [el('span', { class: 'fcql', text: 'Our starting point' }), el('span', { class: 'fcst' }, [blank ? el('span', { class: 'fce', text: 'We are looking at … including … We are leaving out … It is to answer … We will look at it again …' }) : document.createTextNode(cut(st.at && !st.changed ? String(st.text).replace(/^(Declared|Agreed) on [^.]*\.\s*/, '') : stParts().map(function (p) { return p[0] === 'b' ? (p[1] || '__________') : p[1]; }).join(''), 420))]), el('span', { class: 'fcsrc', text: 'Viability Thinking Lab · Frame' })])]);
    var bar = el('div', { class: 'fx fcbar no-print' }, [el('a', { class: 'btn sm', href: '#fhome', text: '‹ Back to Frame' }), el('span', { class: 'fxgrow' }),
      el('label', { class: 'fxcheckrow', style: 'font-size:14px;padding:0;margin-right:6px' }, [el('input', { type: 'checkbox', id: 'fcBlank', checked: blank, onchange: function (e) { FX.blankCanvas = e.target.checked; render(); } }), el('span', { text: 'Blank, for a workshop' })]),
      el('button', { class: 'btn sm', type: 'button', text: 'Save as PDF', title: 'Choose “Save as PDF” in the print window', onclick: function () { window.print(); } }), el('button', { class: 'btn sm fxmain', type: 'button', id: 'fcPrint', text: 'Print', onclick: function () { window.print(); } })]);
    main.appendChild(el('div', { class: 'fcwrap' }, [bar, el('p', { class: 'fx fxmuted no-print', style: 'margin:0 0 12px', text: 'One A4 page, landscape, in black and grey. Long answers are shortened to fit; the full answers are on the three parts of Frame.' }), el('div', { class: 'fcscroll' }, [canvas])]));
  }

  // ---------- Diagnose, in three parts (31 October 2026): The evidence, How it works and fails, The formulation ----------
  // The same shape as Frame: a page with three cards, then each part with a path across the top, one status
  // line, one main button, history and presenting, and a one-page Diagnose Canvas. The tools and the views of
  // the evidence keep their own screens; the part pages bring them together and say what to do next.
  var DSTEP = { label: 'The three parts of Diagnose', back: ['Diagnose', '#dhome'] };
  function dRow() { return ((row('diagnose') || {}).content) || {}; }
  function dv(k) { return String((dRow().sentence || {})[k] || '').trim(); }
  async function saveDiag(fn, summary) {
    fxSave('busy');
    try {
      var r = row('diagnose'), c = JSON.parse(JSON.stringify((r && r.content) || {})); fn(c);
      var d = await api({ action: 'p_save', tile_key: 'diagnose', status: (r && r.status) || 'partly', summary: summary, base_version: r ? r.version : null, content: c });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'diagnose'; }); S.data.tiles.push(d.tile); fxSave('ok');
    } catch (e) { fxSave('bad'); throw e; }
  }
  var DSENT = [['works', 'It works because ', 'what keeps it working?', 'experienced pharmacists adjust the weekend rota by phone and catch most results by hand'], ['sets', '. It fails when ', 'what sets it off?', 'a dangerous result arrives late on a Friday'], ['likely', ', made more likely by ', 'what makes it more likely?', 'nobody owning the patient at weekends'], ['going', ', and kept going by ', 'what keeps it going?', 'incident reviews that blame individuals'], ['strong', '. The evidence is strongest on ', 'where?', 'the weekend rota'], ['weak', ' and weakest on ', 'where?', 'what GPs see'], [null, '.']];
  function dBody() { return DSENT.map(function (p) { return p[0] ? (dv(p[0]) || '__________') : p[1]; }).join('').replace(/^__________/, '__________'); }
  function dBodyFull() { return DSENT.map(function (p) { return p[0] ? p[1] + (dv(p[0]) || '__________') : p[1]; }).join(''); }
  function dState() { var ag = dRow().agreed || {}, body = dBodyFull(); return { at: ag.at, by: ag.by, text: ag.text, changed: !!ag.at && String(ag.text || '').replace(/^Agreed on [^.]*\.\s*/, '') !== body }; }
  function dAssume() { var as = assumptions(); return { all: as, un: as.filter(function (x) { return markOf(x) === 'unchecked'; }), yes: as.filter(function (x) { return markOf(x) === 'holds'; }), no: as.filter(function (x) { return markOf(x) === 'nothold'; }) }; }
  function dParts() {
    var A = window.VTAnalyse, cv = A && A.coverage ? A.coverage() : { n: 0, levels: [], caps: [] }, as = dAssume();
    var groups = A && A.analysisGroups ? A.analysisGroups().filter(function (g) { return g.key !== 'check'; }) : [];
    var built = [].concat.apply([], groups.map(function (g) { return g.tools.filter(function (t) { return t.built; }); }));
    var st = dState(), blanks = DSENT.filter(function (p) { return p[0] && !dv(p[0]); }).length;
    return {
      gather: [[cv.n > 0, 'Sources gathered', '#dgather'], [cv.levels.length >= 4, 'Evidence at every level', '#dgather'], [cv.caps.length >= 6, 'Evidence on every capital', '#dgather'], [as.un.length === 0, 'Frame’s assumptions tested', '#dgather']],
      work: built.map(function (t) { return [t.used, t.n, '#dwork']; }),
      form: [[blanks === 0, 'The sentence written', '#dform'], [!!(st.at && !st.changed), 'The formulation agreed', '#dform']],
      cv: cv, as: as, groups: groups, built: built, blanks: blanks, st: st
    };
  }
  function dPath(cur, note) { return treePath('diagnose', cur, note); }

  function dTitle(title, lede, status, part) { return fxTitle(title, lede, status, part, { step: 'Diagnose', tile: 'diagnose', one: ['Diagnose Canvas', '#dcanvas'], present: '#present=d' }); }

  // the Diagnose page: three cards with progress
  function renderDHome() {
    var P = dParts(), s = S.data.session;
    var wrap = el('div', { class: 'ww', id: 'diagHome' });
    wrap.appendChild(stepPlate('diagnose', 'ww-plate'));
    wrap.appendChild(el('p', { class: 'ww-kick', text: 'Step 2 of 4 · ' + (s.name || '') }));
    wrap.appendChild(el('h1', { class: 'ww-h', text: 'Diagnose' }));
    wrap.appendChild(el('p', { class: 'ww-lede', text: 'How does this system work, and how does it fail? Diagnose gathers the evidence, analyses it, and hands Model a formulation: how it works and how it fails, and why.' }));
    var grid = partCards('diagnose');
    wrap.appendChild(grid);
    wrap.appendChild(el('div', { class: 'ph-more' }, [workLink(), el('a', { href: '#analyse', text: 'All the evidence' }), el('a', { href: '/frame' + (EXAMPLE ? location.search : ''), text: '‹ Back to Frame' }), el('a', { href: '/model' + (EXAMPLE ? location.search : ''), text: 'On to Model' })]));
    main.appendChild(wrap);
  }

  // a link card for a view or tool kept on its own screen
  function dLink(href, name, line, tag, opts) {
    opts = opts || {};
    return el('a', { class: 'fxlinkcard' + (opts.now ? ' now' : '') + (opts.off ? ' off' : ''), href: opts.off ? null : href, 'data-link': href }, [el('div', { class: 'fxlct' }, [el('b', { text: name }), line ? el('span', { text: line }) : null]), tag ? el('span', { class: 'fxtag ' + (tag[1] || ''), text: tag[0] }) : null, opts.off ? null : el('span', { class: 'fxgo', 'aria-hidden': 'true', text: '›' })]);
  }

  // part 1: The evidence
  function renderDGather() {
    var P = dParts(), cv = P.cv, as = P.as, ro = !!S.readonly;
    var wrap = el('div', { class: 'fx', id: 'fxGather' }); main.appendChild(wrap);
    var done = P.gather.filter(function (m) { return m[0]; }).length, nx = P.gather.filter(function (m) { return !m[0]; })[0];
    wrap.appendChild(dPath('dgather', done + ' of 4'));
    wrap.appendChild(dTitle('The evidence', 'What we know, where it came from, and whether it is enough. Gather it here; analyse it in 2.2 to 2.4.', [el('span', { text: cv.n + (cv.n === 1 ? ' source' : ' sources') }), el('span', { class: 'fxsep', text: '·' }), el('span', { text: cv.levels.length + ' of 4 levels' }), el('span', { class: 'fxsep', text: '·' }), el('span', { text: cv.caps.length + ' of 6 capitals' }), el('span', { class: 'fxsep', text: '·' }), el('b', { text: as.un.length ? as.un.length + ' assumption' + (as.un.length === 1 ? '' : 's') + ' to test.' : 'No assumptions left to test.' }), as.un.length ? nextLink('Next: test them', '#dAssume') : null], 'g'));
    // the assumptions from Frame
    var asBox = el('section', { class: 'fxcard', id: 'dAssume' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Test what Frame took for granted' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag' + (as.un.length ? ' now' : as.all.length ? ' ok' : ''), text: as.all.length ? (as.all.length - as.un.length) + ' of ' + as.all.length + ' tested' : 'None written' })])]);
    if (!as.all.length) asBox.appendChild(el('p', { class: 'fxmuted' }, [document.createTextNode('Frame has no assumptions written yet. '), el('a', { href: '/frame' + (EXAMPLE ? location.search : '') + '#question', text: 'Write them in Frame, under What we take for granted' })]));
    else asBox.appendChild(assumeList(ro, { test: true }));
    wrap.appendChild(asBox);
    // where the evidence comes from
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'Where the evidence comes from' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'Each opens on its own page. Come back here with the path at the top.' }));
    wrap.appendChild(el('div', { class: 'fxlinks', id: 'dSources' }, [
      dLink('#sources', 'Sources', 'Documents, interviews, data and observations, each tagged', [cv.n + ' recorded', cv.n ? 'ok' : '']),
      dLink('#request', 'The evidence request', 'The evidence asked for, and what has come back', null),
      dLink('#outside', 'The outside view', 'Inquiries, regulators’ reports and research from elsewhere', null),
      dLink('#analyse', 'All the evidence', 'The four forms of evidence, side by side', null)]));
    // is it enough?
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'Is it enough?' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'Evidence all at one level, or on one capital, usually means the others were not looked at.' }));
    var chips = function (all, have, names) { return el('div', { class: 'fxcover' }, all.map(function (k, i) { var on = have.indexOf(k) >= 0; return el('span', { class: 'fxcov' + (on ? ' on' : ''), 'data-cov': k }, [el('span', { 'aria-hidden': 'true', text: on ? '✓ ' : '' }), document.createTextNode(names[i])]); })); };
    var CAPN = { financial: 'Money', manufactured: 'Buildings and kit', human: 'People', social: 'Relationships', natural: 'Land, water, energy', information: 'Information' };
    wrap.appendChild(el('div', { class: 'fxparts two' }, [
      el('div', { class: 'fxcard fxpart', id: 'dLevels' }, [el('div', { class: 'fxqhead' }, [el('h3', { class: 'fxsech', text: 'By level' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#levels', text: 'Open' })]), el('p', { class: 'fxmuted', text: cv.levels.length + ' of 4 levels have evidence' }), chips(cv.L4.map(function (l) { return l[0]; }), cv.levels, cv.L4.map(function (l) { return l[1]; }))]),
      el('div', { class: 'fxcard fxpart', id: 'dCaps' }, [el('div', { class: 'fxqhead' }, [el('h3', { class: 'fxsech', text: 'By capital' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#capitals', text: 'Open' })]), el('p', { class: 'fxmuted', text: cv.caps.length + ' of 6 capitals have evidence' }), chips(cv.CAPK, cv.caps, cv.CAPK.map(function (k) { return CAPN[k]; }))])]));
    wrap.appendChild(el('div', { class: 'fxlinks', style: 'margin-top:14px' }, [dLink('#models', 'By model', 'How deep the evidence goes for each model, against the depth of the engagement', null), dLink('#outcomes', 'Is it good enough?', 'The eleven outcomes of Diagnose, each met or not', null)]));
    wrap.appendChild(fxFoot(['2 Diagnose', '#dhome'], ['Next: 2.2 What goes right, and what makes it vulnerable', '#dvuln'], 'You can start the analysis before the evidence is complete.'));
  }

  // part 2: How it works and how it fails
  var DIDS = { dvuln: ['goright', 'nots', 'capitals', 'levels', 'dependants'], dtrig: ['horizon', 'outside', 'isnot', 'rca', 'techmech', 'people'], dexpl: ['disagree', 'howsaid', 'rivals', 'futures', 'frame', 'combos'] };
  var DLEDE = { dvuln: 'How the system works every day, and the conditions that leave it exposed. Start with what goes right.', dtrig: 'What sets failure off, and what keeps the problem going once it has started.', dexpl: 'Other accounts and other explanations, and what Frame declared tested against the evidence.' };
  function renderDWork(view) {
    view = DIDS[view] ? view : 'dvuln';
    var P = dParts(), ids = DIDS[view], groups = P.groups.map(function (g) { return Object.assign({}, g, { tools: g.tools.filter(function (t) { return ids.indexOf(t.id) >= 0; }) }); }).filter(function (g) { return g.tools.length; });
    var built = [].concat.apply([], groups.map(function (g) { return g.tools.filter(function (t) { return t.built; }); })), used = built.filter(function (t) { return t.used; }).length;
    var next = built.filter(function (t) { return !t.used; })[0], pn = PARTN.diagnose.filter(function (p) { return p[0] === view; })[0];
    var wrap = el('div', { class: 'fx', id: 'fxDWork', 'data-part': view }); main.appendChild(wrap);
    wrap.appendChild(dPath(view, used + ' of ' + built.length + ' tools'));
    wrap.appendChild(dTitle(pn[1] + ' ' + pn[2], DLEDE[view], [el('b', { text: used + ' of ' + built.length + ' tools used.' }), next ? nextLink('Next: ' + next.n, '[data-tool="' + next.id + '"]') : null], 'w'));
    var lay = el('div', { class: 'fxtwo' }), ol = el('ol'), body = el('div', { class: 'fxbody' });
    var lastHead = null;
    groups.forEach(function (g, i) {
      var any = g.tools.some(function (t) { return t.used; });
      ol.appendChild(el('li', { class: any ? 'done' : '' }, [el('button', { type: 'button', 'data-sec': g.key, onclick: function () { var t = document.getElementById('dw-' + g.key); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, [any ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring', text: String(i + 1) }), el('span', {}, [document.createTextNode(g.name === 'Protective' ? 'What goes right' : g.name), el('small', { text: g.tools.filter(function (t) { return t.used; }).length + ' of ' + g.tools.filter(function (t) { return t.built; }).length + ' used' })])])]));
      if (g.heading !== lastHead) { body.appendChild(el('h2', { class: 'fxh2 fxgap', 'data-heading': g.heading, text: g.heading })); lastHead = g.heading; }
      var sec = el('section', { class: 'fxsec open-all', id: 'dw-' + g.key, 'data-sec': g.key }, [el('div', { class: 'fxbar' }, [any ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring', text: String(i + 1) }), el('div', { class: 'fxbart' }, [el('h3', { class: 'fxsech', text: g.name }), el('div', { class: 'fxsum', text: g.line.charAt(0).toUpperCase() + g.line.slice(1) })])])]);
      var list = el('div', { class: 'fxtools-list' });
      g.tools.forEach(function (t) {
        var isNext = next && t.id === next.id;
        list.appendChild(el('div', { class: 'fxtoolrow' + (isNext ? ' now' : '') + (t.built ? '' : ' soon'), 'data-tool': t.id }, [el('div', { class: 'fxtrt' }, [el('b', { text: t.n }), el('span', { class: 'fxmuted', text: t.by }), el('p', { text: String(t.does).split(/(?<=\.)\s/)[0] })]),
          el('div', { class: 'fxtra' }, [t.built ? el('span', { class: 'fxtag ' + (t.used ? 'ok' : isNext ? 'now' : ''), text: t.used ? '✓ In use' : isNext ? 'Next' : 'Not started' }) : el('span', { class: 'fxtag', text: 'Use in a session' }), t.built ? el('a', { class: 'btn sm' + (isNext ? ' fxmain' : ''), href: t.href, text: t.used ? 'Open' : 'Start' }) : null])]));
      });
      sec.appendChild(list); body.appendChild(sec);
    });
    lay.appendChild(el('nav', { class: 'fxrail', 'aria-label': 'Groups of tools' }, [ol])); lay.appendChild(body); wrap.appendChild(lay);
    var PI = PARTN.diagnose.map(function (p) { return p[0]; }).indexOf(view), pv = PARTN.diagnose[PI - 1], nx2 = PARTN.diagnose[PI + 1];
    body.appendChild(fxFoot([pv[1] + ' ' + pv[2], '#' + pv[0]], ['Next: ' + nx2[1] + ' ' + nx2[2], '#' + nx2[0]], 'The formulation fills as the tools are used.'));
  }

  // part 3: The formulation
  function renderDForm() {
    var P = dParts(), ro = !!S.readonly, A = window.VTAnalyse;
    var wrap = el('div', { class: 'fx', id: 'fxDForm' }); main.appendChild(wrap);
    var statusTxt = function () { var n = DSENT.filter(function (p) { return p[0] && !dv(p[0]); }).length, s2 = dState(); return s2.at && !s2.changed ? 'Agreed on ' + dlong(s2.at) + (s2.by ? ' by ' + s2.by.replace(/ \(master\)$/, '') : '') + '.' : s2.changed ? 'Changed since it was agreed: agree it again.' : n ? n + (n === 1 ? ' blank' : ' blanks') + ' to fill, then agree it.' : 'Ready to agree.'; };
    wrap.appendChild(dPath('dform', P.st.at && !P.st.changed ? 'agreed' : P.blanks ? P.blanks + ' blanks' : 'ready to agree'));
    wrap.appendChild(dTitle('The formulation', 'How this system works and how it fails, and why, in one sentence the team agrees. It is what Diagnose hands on to Model.', [el('b', { id: 'dStatusTxt', text: statusTxt() })], 'f'));
    // the sentence, with its blanks filled in place
    var sent = el('p', { class: 'fxsentence', id: 'dSentence' }), pill = el('span', { class: 'fxtag' }), note = el('span', { class: 'fxmuted' });
    var agree = ro ? null : el('button', { class: 'btn fxmain', type: 'button', id: 'dAgree' });
    var paint = function () {
      sent.innerHTML = '';
      DSENT.forEach(function (p) {
        sent.appendChild(document.createTextNode(p[1]));
        if (!p[0]) return;
        var k = p[0], v = dv(k);
        if (FX.edit === 'd-' + k && !ro) {
          var inp = el('input', { type: 'text', 'data-field': 'diagnose.' + k, value: v, placeholder: 'For example: ' + p[3], 'aria-label': p[2] });
          var done = async function () { var nv = inp.value.trim(); FX.edit = null; try { if (nv !== dv(k)) await saveDiag(function (c) { c.sentence = c.sentence || {}; c.sentence[k] = nv; c.who = c.who || {}; c.who[k] = { by: meName(), at: new Date().toISOString() }; }, 'Changed the formulation: ' + p[2].replace(/\?$/, '')); } catch (e) { note.textContent = saveErr(e); } paint(); };
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') { FX.edit = null; paint(); } });
          sent.appendChild(el('span', { class: 'fxinline' }, [inp, el('button', { class: 'btn sm fxmain', type: 'button', 'data-done': k, text: 'Done', onmousedown: function (e) { e.preventDefault(); }, onclick: done })]));
          setTimeout(function () { inp.focus(); }, 0);
        } else if (v) sent.appendChild(el('button', { class: 'fxfill fxeditable', type: 'button', 'data-blank': k, title: 'Change this', text: v, disabled: ro, onclick: function () { FX.edit = 'd-' + k; paint(); } }));
        else sent.appendChild(el('button', { class: 'fxblank', type: 'button', 'data-blank': k, text: p[2] + ' ✎', disabled: ro, onclick: function () { FX.edit = 'd-' + k; paint(); } }));
      });
      var s2 = dState(), n = DSENT.filter(function (p) { return p[0] && !dv(p[0]); }).length;
      pill.className = 'fxtag ' + (s2.at && !s2.changed ? 'ok' : ''); pill.textContent = s2.at ? (s2.changed ? 'Changed since agreed' : 'Agreed ' + dshort(s2.at)) : 'Draft';
      if (agree) { agree.disabled = !!n || !!(s2.at && !s2.changed); agree.textContent = s2.at ? (s2.changed ? 'Agree it again' : 'Agreed') : 'Agree the formulation'; }
      note.textContent = n ? 'Fill the ' + (n === 1 ? 'last blank' : n + ' blanks') + ' to agree it. The four headings below are there to draw on.' : s2.at && !s2.changed ? 'Agreed by ' + String(s2.by || '').replace(/ \(master\)$/, '') + '. It can still be changed.' : '';
      var stx = document.getElementById('dStatusTxt'); if (stx) stx.textContent = statusTxt();
    };
    if (agree) agree.addEventListener('click', async function () { var now = new Date().toISOString(), txt = 'Agreed on ' + dlong(now) + '. ' + dBodyFull(); try { await saveDiag(function (c) { var past = c.agreed && c.agreed.at ? [c.agreed].concat(c.agreed.past || []).map(function (x) { return { at: x.at, text: x.text, by: x.by }; }).slice(0, 10) : []; c.agreed = { at: now, text: txt, by: meName(), past: past }; }, 'The formulation agreed'); render(); } catch (e) { note.textContent = saveErr(e); } });
    wrap.appendChild(el('div', { class: 'fxcard fxhero', id: 'dStatement' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'The formulation, in one sentence' }), el('span', { class: 'fxgrow' }), pill]), sent, el('div', { class: 'fxagree' }, [note, el('span', { class: 'fxgrow' }), agree])]));
    paint();
    // the four headings, read from the tools
    var RV = ((invData().rivals || {}).items || []).slice(), RO = { most: 0, much: 1, some: 2, little: 3 }; RV.sort(function (a, b) { return (a.status === 'ruled') - (b.status === 'ruled') || (RO[a.share] || 0) - (RO[b.share] || 0); });
    wrap.appendChild(el('section', { class: 'fxcard', id: 'dRivals', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Rival explanations' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#rivals', text: RV.length ? 'Open' : 'Add them' })]),
      el('p', { class: 'fxmuted', text: 'What else could explain it, ranked by how much of the evidence each explains. The one that would be serious if missed stays open beside the formulation.' }),
      RV.length ? el('ol', { class: 'fxgovlist' }, RV.map(function (x) { return el('li', { 'data-rival': x.id }, [document.createTextNode(x.n + ' '), el('span', { class: 'fxmuted', text: '(' + ({ most: 'explains most of the evidence', much: 'explains much of it', some: 'explains some of it', little: 'explains little of it' })[x.share] + (x.status === 'ruled' ? '; ruled out' : '') + (x.keep ? '; kept open' + (x.holder ? ' by ' + x.holder : '') : '') + ')' })]); })) : el('p', { class: 'fxmuted', text: 'None written yet. A formulation with no rivals has not been tested against anything.' })]));
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'The four headings' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'Read from the tools in 2.2 to 2.4, each with its evidence. Change an entry in the tool it came from.' }));
    var host = el('div', { class: 'fxform' }), keep = main, tmp = el('div');
    if (A && A.renderFormulation) { main = tmp; try { A.renderFormulation(host); } catch (e) {} main = keep; }
    var fa = host.querySelector('#fmAssume'); if (fa) fa.remove();
    wrap.appendChild(host);
    // checking the frame against the evidence
    var as = P.as, chk = el('section', { class: 'fxcard', id: 'dCheck', style: 'margin-top:20px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Checking the frame against the evidence' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#frame', text: 'Testing the frame' })]), el('p', { class: 'fxmuted', text: 'Does the question still stand? What did the evidence show about what Frame took for granted?' })]);
    var line = function (label, xs, cls) { return xs.length ? el('div', { class: 'fxchk' }, [el('b', { text: label + ' (' + xs.length + ')' }), el('ul', { id: cls || null }, xs.map(function (x) { return el('li', { text: 'We are assuming that ' + x.t + (x.how ? ' · ' + x.how : '') }); }))]) : null; };
    [line('Does not hold', as.no), line('Not tested yet', as.un, 'fmAssume'), line('Holds', as.yes)].forEach(function (n) { if (n) chk.appendChild(n); });
    if (!as.all.length) chk.appendChild(el('p', { class: 'fxmuted', text: 'Frame has no assumptions written.' }));
    if (!ro) {
      var q = el('textarea', { rows: 2, id: 'dBackText', placeholder: 'For example: the evidence says the problem is ownership at weekends, not staffing. Should the question change?' }); grow(q);
      var msg = el('span', { class: 'fxmuted' });
      chk.appendChild(el('div', { class: 'fxsendback' }, [el('label', { class: 'fxql', for: 'dBackText', text: 'Send a question back to Frame' }), q, el('div', { class: 'fxagree', style: 'border:0;padding-top:8px' }, [msg, el('span', { class: 'fxgrow' }), el('button', { class: 'btn sm', type: 'button', id: 'dBackSend', text: 'Send to Frame', onclick: async function () { var t = q.value.trim(); if (!t) return q.focus(); try { await api({ action: 'p_question_add', tile_key: 'question', from_practice: 'diagnose', text: t, why: 'From Diagnose: checking the frame against the evidence' }); q.value = ''; msg.textContent = 'Sent. It shows at the top of The question in Frame.'; try { var d = await api({ action: 'p_load' }); if (d && d.questions) S.data.questions = d.questions; } catch (e) {} } catch (e) { msg.textContent = saveErr(e); } } })])]));
    }
    wrap.appendChild(chk);
    wrap.appendChild(fxFoot(['2.4 Other explanations', '#dexpl'], ['On to 3 Model', '/model' + (EXAMPLE ? location.search : '')], 'You can go on to Model before agreeing the sentence, and come back.'));
  }

  // the Diagnose Canvas: one A4 landscape page, greyscale
  function renderDCanvas() {
    var A = window.VTAnalyse, F = A && A.formAll ? A.formAll() : {}, P = dParts(), blank = !!FX.blankCanvas, f = (frameAns().question || {}).fields || {}, st = statementState();
    var cut = function (t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
    var none = function () { return el('div', {}, [el('span', { class: 'fce', text: blank ? '' : 'Nothing recorded yet' })]); };
    var entries = function (k, n, len) { var es = (F[k] && F[k].entries) || []; return blank || !es.length ? none() : el('ul', {}, es.slice(0, n).map(function (e) { return el('li', { text: cut(e.text, len) }); }).concat(es.length > n ? [el('li', { class: 'fce', text: '… and ' + (es.length - n) + ' more' })] : [])); };
    var cell = function (cls, n, h, prompt, kids) { return el('section', { class: 'fcc ' + cls }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn', text: String(n) }), el('h3', { text: h })]), el('p', { class: 'fcp', text: prompt })].concat(kids)); };
    var as = P.as, cv = P.cv, ds = dState();
    var asList = blank || !as.all.length ? none() : el('ul', { class: 'fcas' }, as.all.slice(0, 7).map(function (x) { var m = markOf(x); return el('li', {}, [el('span', { class: 'fcmark', text: m === 'holds' ? 'Holds' : m === 'nothold' ? 'Does not hold' : 'Not tested' }), document.createTextNode(cut(x.t, 90))]); }));
    var CAPN = { financial: 'Money', manufactured: 'Buildings and kit', human: 'People', social: 'Relationships', natural: 'Land, water, energy', information: 'Information' };
    var fromHere = (S.data.questions || []).filter(function (x) { return x.tile_key === 'question' && x.from_practice === 'diagnose'; });
    var canvas = el('article', { class: 'fcanvas dcanvas' + (blank ? ' blank' : ''), id: 'dcCanvas', 'aria-label': 'Diagnose Canvas' }, [
      el('div', { class: 'fchead' }, [
        el('div', { class: 'fctitle' }, [el('div', { class: 'fcbrand', text: 'Diagnose Canvas' }), el('div', { class: 'fcmeta', text: S.data.session.name || '' }), el('div', { class: 'fcmeta', text: blank ? 'Date:' : dlong(new Date().toISOString()) + ' · ' + (ds.at && !ds.changed ? 'Agreed ' + dlong(ds.at) : 'Draft') })]),
        el('div', { class: 'fcq' }, [el('span', { class: 'fcql', text: 'The question' }), el('div', { class: 'fcqt' }, [blank ? el('span') : document.createTextNode(cut(f.question || '', 200))]), !blank && st.at ? el('div', { class: 'fcqs', text: 'Our starting point: ' + cut(String(st.text || '').replace(/^(Declared|Agreed) on [^.]*\.\s*/, ''), 230) }) : null]),
        el('div', { class: 'fcwho' }, [el('div', { class: 'fci' }, [el('b', { text: 'The evidence' }), el('div', { text: blank ? '' : cv.n + ' sources · ' + cv.levels.length + ' of 4 levels · ' + cv.caps.length + ' of 6 capitals' })]), el('div', { class: 'fci' }, [el('b', { text: 'Strongest on / weakest on' }), el('div', { text: blank ? '' : (dv('strong') || '…') + ' / ' + (dv('weak') || '…') })])])]),
      el('div', { class: 'fcgrid dgrid' }, [
        cell('d1', 1, 'How it works: protective', 'What goes right every day, and why? What makes it work despite everything?', [entries('protective', 9, 120)]),
        cell('d2', 2, 'Predisposing', 'What made it vulnerable? The conditions, the capitals, the levels, the dependants', [entries('predisposing', 6, 95)]),
        cell('d3', 3, 'Precipitating', 'What sets failure off? Changes from outside, what happened elsewhere, incidents', [entries('precipitating', 6, 95)]),
        cell('d4', 4, 'Perpetuating', 'What keeps the problem going? Causes, mechanisms, differing accounts', [entries('perpetuating', 7, 95)]),
        cell('d5', 5, 'What Frame took for granted', 'We are assuming that … Has it been tested? Does it hold?', [asList]),
        cell('d6', 6, 'What it means for the frame', 'Does the question still stand? What goes back to Frame?', [blank || !fromHere.length ? none() : el('ul', {}, fromHere.slice(0, 5).map(function (x) { return el('li', { text: cut(x.text, 120) }); }))])]),
      el('div', { class: 'fcfoot' }, [el('span', { class: 'fcql', text: 'The formulation' }), el('span', { class: 'fcst' }, [blank ? el('span', { class: 'fce', text: 'It works because … It fails when … made more likely by … and kept going by … The evidence is strongest on … and weakest on …' }) : document.createTextNode(cut(dBodyFull(), 420))]), el('span', { class: 'fcsrc', text: 'Viability Thinking Lab · Diagnose' })])]);
    var bar = el('div', { class: 'fx fcbar no-print' }, [el('a', { class: 'btn sm', href: '#dhome', text: '‹ Back to Diagnose' }), el('span', { class: 'fxgrow' }),
      el('label', { class: 'fxcheckrow', style: 'font-size:14px;padding:0;margin-right:6px' }, [el('input', { type: 'checkbox', id: 'dcBlank', checked: blank, onchange: function (e) { FX.blankCanvas = e.target.checked; render(); } }), el('span', { text: 'Blank, for a workshop' })]),
      el('button', { class: 'btn sm', type: 'button', text: 'Save as PDF', title: 'Choose “Save as PDF” in the print window', onclick: function () { window.print(); } }), el('button', { class: 'btn sm fxmain', type: 'button', id: 'dcPrint', text: 'Print', onclick: function () { window.print(); } })]);
    main.appendChild(el('div', { class: 'fcwrap' }, [bar, el('p', { class: 'fx fxmuted no-print', style: 'margin:0 0 12px', text: 'One A4 page, landscape, in black and grey. Long lists are shortened to fit; everything is on the three parts of Diagnose.' }), el('div', { class: 'fcscroll' }, [canvas])]));
  }

  // ---------- Model, in three parts (31 October 2026): How it works, How it fails, Design propositions ----------
  // Model takes the formulation and builds the models. The team chooses the models for the question; each is
  // built once and looked at twice: for success in part 1, for failure in part 2. Findings are short lines,
  // kept against each model ("It works because ..." and "It fails because ..."). Part 3 turns them into
  // design propositions and one agreed sentence for Test. Testing, offline and in use, is all in Test.
  // Saved in the 'modelstep' tile: { chosen: [ids], findings: { id: { works: [{ t, by, at }], fails: [...] } },
  //   sentence: { what, where, why, measure, line }, agreed: { at, by, text, past } }
  var MCAT = [
    { id: 'journey', n: 'Customer journey', href: '#model=journey', w: 'Where does it go right for the people it serves?', f: 'Where does it let them down, or lose them?' },
    { id: 'blueprint', n: 'Service blueprint', href: '#model=blueprint', w: 'What backstage work and everyday adjustments make it work?', f: 'Which hand-offs break?' },
    { id: 'process', n: 'Process map', href: '#model=process', w: 'Which steps and workarounds get it done?', f: 'Where are the bottlenecks, waits and single points of failure?' },
    { id: 'ibs', n: 'Important business service', href: '#model=ibs', w: 'Which resources does it depend on, and which hold?', f: 'Where are the single points of failure, and where is the tolerance crossed?' },
    { id: 'systems', n: 'Systems diagram', href: '#model=systems', w: 'Which balancing loops keep it stable?', f: 'Which loops drive the drift?' },
    { id: 'vsm', n: 'Viable system model', href: '#model=vsm', w: 'Which functions are present and working, at each level?', f: 'Which functions are missing or overloaded?' },
    { id: 'sna', n: 'Social network analysis', href: '#model=sna', w: 'Who holds it together, and who bridges the gaps?', f: 'Who is isolated, overloaded, or the only link?' },
    { id: 'fram', n: 'Functional resonance (FRAM)', href: '#model=fram', w: 'How is everyday variation absorbed?', f: 'How do variations combine into failure?' },
    { id: 'timeline', n: 'Timeline', href: '#model=timeline', w: 'When has it gone right?', f: 'What was the build-up to the incident?' },
    { id: 'bowtie', n: 'Bow tie', href: '#model=bowtie', w: 'Which barriers and recovery measures hold?', f: 'Which threats get through, which barriers fail, and how does it escalate?' },
    { id: 'faulttree', n: 'Fault tree', href: '#model=faulttree', w: 'Which safeguards stop the event?', f: 'Which combinations cause it?' },
    { id: 'accimap', n: 'AcciMap', href: '#model=accimap', w: 'What, at each level, makes it go right?', f: 'What, at each level, contributed to failure?' },
    { id: 'tharm', n: 'The flow model', href: '#tharm', w: 'How does a normal week run, within tolerance?', f: 'Where do queues build, and where does harm cross the threshold?' },
    { id: 'abm', n: 'Agent-based model', href: '#abm', w: 'How does it run and recover normally?', f: 'How often is the tolerance breached, and how does failure spread?' },
    { id: 'cmap', n: 'The connected map', href: '#cmap', w: 'How is an event handled well, over time and by level?', f: 'How does a failure unfold over time and by level?' }];
  var MSTEP = { label: 'The three parts of Model', back: ['Model', '#mhome'] };
  var LENS = { works: ['How it works', 'It works because', 'mworks'], fails: ['How it fails', 'It fails because', 'mfails'] };
  function mRow() { return ((row('modelstep') || {}).content) || {}; }
  function mChosen() { var c = mRow().chosen || []; return MCAT.filter(function (m) { return c.indexOf(m.id) >= 0; }); }
  function mFind(id, lens) { return (((mRow().findings || {})[id] || {})[lens]) || []; }
  function mv(k) { return String((mRow().sentence || {})[k] || '').trim(); }
  var MFALL = { measure: function () { return fv('good', 'primary'); }, line: function () { return lineText(); } };
  function mval(k) { return String(mv(k) || (MFALL[k] ? MFALL[k]() : '')).replace(/\.\s*$/, ''); }
  async function saveModelStep(fn, summary) {
    fxSave('busy');
    try {
      var r = row('modelstep'), c = JSON.parse(JSON.stringify((r && r.content) || {})); fn(c);
      var d = await api({ action: 'p_save', tile_key: 'modelstep', status: (r && r.status) || 'partly', summary: summary, base_version: r ? r.version : null, content: c });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'modelstep'; }); S.data.tiles.push(d.tile); fxSave('ok');
    } catch (e) { fxSave('bad'); throw e; }
  }
  var MSENT = [['what', 'We will try ', 'which changes?', 'a named doctor for each patient at the weekend'], ['where', ', in ', 'where?', 'two wards for six weekends'], ['why', ', because the models show ', 'what did the models show?', 'most delay comes from not knowing which doctor to call'], ['measure', '. We will know it is working when ', 'which measure?', 'hours from result to a doctor who can act'], ['line', ' improves, without crossing this threshold: ', 'the threshold that must not be crossed', 'no dangerous result left more than 12 hours'], [null, '.']];
  function mBodyFull() { return MSENT.map(function (p) { return p[0] ? p[1] + (mval(p[0]) || '__________') : p[1]; }).join(''); }
  function mState() { var ag = mRow().agreed || {}; return { at: ag.at, by: ag.by, text: ag.text, changed: !!ag.at && String(ag.text || '').replace(/^Agreed on [^.]*\.\s*/, '') !== mBodyFull() }; }
  function mProps() { return window.VTProps ? window.VTProps.items() : []; }
  function mParts() {
    var ch = mChosen(), ps = mProps(), st = mState(), subs = ['protective', 'predisposing', 'precipitating', 'perpetuating'];
    var covered = subs.filter(function (k) { return ps.some(function (p) { return p.answers && p.answers.sub === k; }); });
    var blanks = MSENT.filter(function (p) { return p[0] && !mval(p[0]); }).length;
    var lensMs = function (lens) { return [[ch.length > 0, 'Choose the models', '#mworks']].concat(ch.map(function (m) { return [mFind(m.id, lens).length > 0, m.n, '#' + LENS[lens][2]]; })); };
    return { works: lensMs('works'), fails: lensMs('fails'),
      design: [[ps.length > 0, 'Propositions written', '#mdesign'], [covered.length === 4, 'Every heading of the formulation answered', '#mdesign'], [blanks === 0, 'The sentence for Test written', '#mdesign'], [!!(st.at && !st.changed), 'Agreed and handed to Test', '#mdesign']],
      chosen: ch, props: ps, covered: covered, subs: subs, blanks: blanks, st: st };
  }
  function mPath(cur, note) { return treePath('model', cur, note); }

  function mTitle(title, lede, status, part) { return fxTitle(title, lede, status, part, { step: 'Model', tile: 'modelstep', one: ['Model Canvas', '#mcanvas'], present: '#present=m' }); }

  // the Model page: three cards with progress
  function renderMHome() {
    var P = mParts(), s = S.data.session;
    var wrap = el('div', { class: 'ww', id: 'modelHome' });
    wrap.appendChild(stepPlate('model', 'ww-plate'));
    wrap.appendChild(el('p', { class: 'ww-kick', text: 'Step 3 of 4 · ' + (s.name || '') }));
    wrap.appendChild(el('h1', { class: 'ww-h', text: 'Model' }));
    wrap.appendChild(el('p', { class: 'evdrift', text: 'No organisation should discover how it could drift into a crisis by having one.' }));
    wrap.appendChild(el('p', { class: 'ww-lede', text: 'Take the formulation and build the models. Choose the models that suit the question, look at each for how the system works, then for how it fails, and design the changes. Test tries them.' }));
    var grid = partCards('model');
    wrap.appendChild(grid);
    wrap.appendChild(el('div', { class: 'ph-more' }, [workLink(), el('a', { href: '/diagnose' + (EXAMPLE ? location.search : '') + '#dform', text: '‹ The formulation, in Diagnose' }), el('a', { href: '/test' + (EXAMPLE ? location.search : ''), text: 'On to Test' })]));
    main.appendChild(wrap);
  }

  // findings: short lines kept against a model, for one lens
  function findingsBox(m, lens, opts) {
    opts = opts || {}; var ro = !!S.readonly, list = mFind(m.id, lens), msg = el('div', { class: 'fxby bad', hidden: true });
    var save = async function (fn, why) { try { await saveModelStep(function (c) { c.findings = c.findings || {}; c.findings[m.id] = c.findings[m.id] || { works: [], fails: [] }; c.findings[m.id][lens] = fn((c.findings[m.id][lens] || []).slice()); }, why); render(); } catch (e) { msg.hidden = false; msg.textContent = saveErr(e); } };
    var box = el('div', { class: 'fxfind', 'data-find': m.id + '.' + lens });
    if (list.length) box.appendChild(el('ul', { class: 'fxfindlist' }, list.map(function (x, i) { return el('li', {}, [el('span', { class: 'fxat' }, [el('em', { text: LENS[lens][1] + ' ' }), document.createTextNode(x.t)]), byLine(x.by ? { by: x.by, at: x.at } : null), ro ? null : el('button', { class: 'fxico', type: 'button', 'aria-label': 'Remove this finding', title: 'Remove', text: '×', onclick: function () { save(function (l) { l.splice(i, 1); return l; }, 'Removed a finding: ' + m.n); } })]); })));
    if (!ro) {
      var inp = el('input', { type: 'text', 'data-add': m.id + '.' + lens, placeholder: 'finish the sentence', 'aria-label': LENS[lens][1] });
      var add = function () { var t = inp.value.trim().replace(new RegExp('^' + LENS[lens][1] + '\\s*', 'i'), ''); if (!t) return inp.focus(); save(function (l) { l.push({ t: t, by: meName(), at: new Date().toISOString() }); return l; }, (lens === 'works' ? 'How it works: ' : 'How it fails: ') + m.n); };
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
      box.appendChild(el('div', { class: 'fxamb' }, [el('span', { class: 'fxpre', text: LENS[lens][1] }), inp, el('button', { class: 'btn sm fxmain', type: 'button', 'data-addbtn': m.id + '.' + lens, text: 'Add', onclick: add })]));
    }
    box.appendChild(msg);
    return box;
  }
  // choosing the models for this question
  function chooser(open) {
    var ro = !!S.readonly, ch = (mRow().chosen || []).slice();
    var det = el('details', { class: 'fxcard fxchoose', id: 'mChoose', open: open || FX.chooseOpen ? true : null, ontoggle: function () { FX.chooseOpen = det.open; } }, [el('summary', {}, [el('span', { class: 'fxsech', text: open || !ch.length ? 'Choose the models for this question' : 'Change the models (' + ch.length + ' chosen)' })]), el('p', { class: 'fxmuted', text: 'Three to five is usual. Each chosen model is looked at twice: for how it works in 3.4, and for how it fails in 3.5.' })]);
    det.appendChild(el('div', { class: 'fxchoices' }, MCAT.map(function (m) {
      var cb = el('input', { type: 'checkbox', 'data-choose': m.id, disabled: ro }); cb.checked = ch.indexOf(m.id) >= 0;
      cb.addEventListener('change', async function () { FX.chooseOpen = true; try { await saveModelStep(function (c) { var l = (c.chosen || []).filter(function (x) { return x !== m.id; }); if (cb.checked) l.push(m.id); c.chosen = MCAT.map(function (y) { return y.id; }).filter(function (y) { return l.indexOf(y) >= 0; }); }, (cb.checked ? 'Chose ' : 'Set aside ') + m.n); render(); } catch (e) { cb.checked = !cb.checked; } });
      return el('label', { class: 'fxchoice' + (cb.checked ? ' on' : '') }, [cb, el('span', {}, [el('b', { text: m.n }), el('span', { text: m.w })])]);
    })));
    return det;
  }
  // a part that is a set of models or tools (3.1, 3.2, 3.3 and 4.2): each one, its state, and a way in
  var PLEDE = { mmaps: 'Maps of what the service is and how the work flows through it. Choose the ones that suit the question, then build them.', mpeople: 'Maps of who holds the service together, how events have unfolded over time, and how it fails. Choose the ones that suit the question, then build them.', mrun: 'The map played forward over time, and the service run hour by hour. These are what Test uses to try each change.', tplans: 'How the service carries on through disruption, and whether the existing plans and exercises would hold. Use the ones that apply.' };
  function renderToolPart(step, partId) {
    var p = treePart(step, partId), ro = !!S.readonly, ch = mRow().chosen || [], cnt = countOf(p.tasks);
    var wrap = el('div', { class: 'fx', id: 'fxPart-' + partId, 'data-part': partId }); main.appendChild(wrap);
    wrap.appendChild(treePath(step, partId, cnt.done + ' of ' + cnt.n));
    var titleFn = step === 'model' ? mTitle : tTitle, nx = treeNext(p.tasks);
    wrap.appendChild(titleFn(p.n + ' ' + p.name, PLEDE[partId] || p.line, [el('b', { text: cnt.n ? cnt.done + ' of ' + cnt.n + ' done.' : 'None chosen yet.' }), nx ? el('a', { class: 'fxnext', href: nx.href, text: 'Next: ' + nx.n + ' ' + nx.name }) : null], partId));
    var list = el('div', { class: 'fxtools-list', id: 'tpList' });
    p.tasks.forEach(function (t) {
      var m = t.model ? MCAT.filter(function (x) { return x.id === t.model; })[0] : null, on = t.model ? ch.indexOf(t.model) >= 0 : true;
      var tool = !t.model && window.VTAnalyse ? [].concat.apply([], window.VTAnalyse.stepGroups(step).map(function (g) { return g.tools; })).filter(function (x) { return '#' + x.id === new URL(t.href, location.href).hash; })[0] : null;
      var pick = null;
      if (t.model && !ro) { pick = el('input', { type: 'checkbox', 'data-choose': t.model, 'aria-label': 'Use ' + t.name + ' for this question' }); pick.checked = on; pick.addEventListener('change', async function () { try { await saveModelStep(function (c) { var l = (c.chosen || []).filter(function (x) { return x !== t.model; }); if (pick.checked) l.push(t.model); c.chosen = MCAT.map(function (y) { return y.id; }).filter(function (y) { return l.indexOf(y) >= 0; }); }, 'Models chosen'); render(); } catch (e) { pick.checked = !pick.checked; } }); }
      list.appendChild(el('div', { class: 'fxtoolrow' + (t === nx ? ' now' : '') + (t.st === 'skip' ? ' soon' : ''), 'data-task': t.n }, [
        el('div', { class: 'fxtrt' }, [el('b', { text: t.n + ' ' + t.name }), m ? el('span', { class: 'fxmuted', text: 'Works: ' + m.w }) : tool ? el('span', { class: 'fxmuted', text: tool.by || '' }) : null, m ? el('span', { class: 'fxmuted', text: 'Fails: ' + m.f }) : tool && tool.does ? el('p', { text: String(tool.does).split(/(?<=\.)\s/)[0] }) : null]),
        el('div', { class: 'fxtra' }, [pick ? el('label', { class: 'tpuse' }, [pick, el('span', { text: 'Use for this question' })]) : null, el('span', { class: 'fxtag ' + (t.st === 'done' ? 'ok' : t === nx ? 'now' : ''), text: t.st === 'done' ? '✓ Built' : t.st === 'skip' ? 'Not used' : ST_N[t.st] }), el('a', { class: 'btn sm' + (t === nx ? ' fxmain' : ''), href: t.href, text: t.st === 'done' ? 'Open' : 'Build' })])]));
    });
    wrap.appendChild(list);
    var PL = PARTN[step], PI = PL.map(function (x) { return x[0]; }).indexOf(partId), pv = PL[PI - 1], nx2 = PL[PI + 1], home = step === 'model' ? ['3 Model', '#mhome'] : ['4 Test', '#thome'];
    wrap.appendChild(fxFoot(pv ? [pv[1] + ' ' + pv[2], '#' + pv[0]] : home, nx2 ? ['Next: ' + nx2[1] + ' ' + nx2[2], '#' + nx2[0]] : home, ''));
  }
  // part 1 and part 2 share one page, with the lens
  function renderMLens(lens) {
    var P = mParts(), ch = P.chosen, other = lens === 'works' ? 'fails' : 'works';
    var wrap = el('div', { class: 'fx', id: lens === 'works' ? 'fxMWorks' : 'fxMFails' }); main.appendChild(wrap);
    var withF = ch.filter(function (m) { return mFind(m.id, lens).length; }).length, nx = ch.filter(function (m) { return !mFind(m.id, lens).length; })[0];
    wrap.appendChild(mPath(LENS[lens][2], ch.length ? withF + ' of ' + ch.length + ' models' : 'choose the models'));
    var lede = lens === 'works' ? 'Choose the models that suit the question and build them. Look at each for what goes right every day, and why. What you find here is what the changes must protect.' : 'The same models, looked at again: where it breaks, what sets it off, and what keeps it going. What you find here is what the changes must fix.';
    wrap.appendChild(mTitle(LENS[lens][0], lede, [el('b', { text: ch.length ? withF + ' of ' + ch.length + ' models have findings.' : 'Start by choosing the models.' }), nx ? nextLink('Next: ' + nx.n, '[data-mcard="' + nx.id + '"]') : null], lens === 'works' ? 'w' : 'f'));
    // what Diagnose found, for this lens
    var F = window.VTAnalyse && window.VTAnalyse.formAll ? window.VTAnalyse.formAll() : {}, ks = lens === 'works' ? ['protective'] : ['predisposing', 'precipitating', 'perpetuating'];
    var n = ks.reduce(function (t, k) { return t + (((F[k] || {}).entries || []).length); }, 0);
    wrap.appendChild(el('p', { class: 'fxmuted', id: 'mFromDiag' }, [document.createTextNode('From Diagnose: ' + n + (lens === 'works' ? ' entries under how it works (protective). ' : ' entries under how it fails (predisposing, precipitating and perpetuating). ')), el('a', { href: '/diagnose' + (EXAMPLE ? location.search : '') + '#dform', text: 'Read the formulation' })]));
    if (lens === 'works') wrap.appendChild(chooser(!ch.length));
    else if (!ch.length) wrap.appendChild(el('div', { class: 'fxcard' }, [el('p', {}, [document.createTextNode('No models chosen yet. '), el('a', { href: '#mmaps', text: 'Choose them in 3.1 to 3.3' })])]));
    ch.forEach(function (m, i) {
      var has = mFind(m.id, lens).length, isNext = nx && nx.id === m.id, cnt = mFind(m.id, other).length;
      wrap.appendChild(el('section', { class: 'fxcard fxmcard' + (isNext ? ' now' : ''), 'data-mcard': m.id }, [
        el('div', { class: 'fxqhead' }, [has ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring' + (isNext ? ' now' : ''), text: String(i + 1) }), el('h2', { class: 'fxsech', text: m.n }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag ' + (has ? 'ok' : isNext ? 'now' : ''), text: has ? has + (has === 1 ? ' finding' : ' findings') : isNext ? 'Next' : 'No findings yet' }), el('a', { class: 'btn sm', href: m.href, text: 'Open the model' })]),
        el('p', { class: 'fxlens' }, [el('b', { text: m[lens === 'works' ? 'w' : 'f'] })]),
        findingsBox(m, lens),
        cnt ? el('p', { class: 'fxmuted', style: 'margin:8px 0 0' }, [document.createTextNode(cnt + (cnt === 1 ? ' finding' : ' findings') + ' on ' + LENS[other][0].toLowerCase() + ' · '), el('a', { href: '#' + LENS[other][2], text: 'see them' })]) : null]));
    });
    if (lens === 'fails') {
      var IQ = (invData().interrogate || {}).items || [], UQ = IQ.filter(function (x) { return x.state !== 'yes' || x.report === 'no' || !String(x.notice || '').trim() || x.ever === 'unknown'; });
      wrap.appendChild(el('section', { class: 'fxcard fxmcard', id: 'mInterrogate', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [IQ.length ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring', text: '?' }), el('h2', { class: 'fxsech', text: 'Questions for every part of the map' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag', text: IQ.length ? IQ.length + ' parts questioned · ' + UQ.length + ' unchecked' : 'Not started' }), el('a', { class: 'btn sm', href: '#interrogate', text: IQ.length ? 'Open' : 'Start' })]),
        el('p', { class: 'fxlens' }, [el('b', { text: 'Beside the twelve nots and the twelve technical mechanisms: for every step, link and resource in the chosen models, has it ever not happened, how often, how might it not, who would notice, would they report it, and can its actual state be established?' })]),
        el('p', { class: 'fxmuted', text: 'What nobody can confirm becomes a list of unchecked conditions, which goes to Test.' })]));
    }
    wrap.appendChild(lens === 'works' ? fxFoot(['3.3 Models that run', '#mrun'], ['Next: 3.5 How it fails', '#mfails'], 'Look for what works before looking for what fails.') : fxFoot(['3.4 How it works', '#mworks'], ['Next: 3.6 Design propositions', '#mdesign'], ''));
  }
  // on a model's own page: the same findings, with the lens switch
  function lensPanel(id) {
    var m = MCAT.filter(function (x) { return x.id === id; })[0]; if (!m || (mRow().chosen || []).indexOf(id) < 0) return null;
    var lens = FX.mlens || 'works';
    return el('div', { class: 'fx fxlenspanel no-print', id: 'mLensPanel' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'Looking at this model for' }),
      el('span', { class: 'fxthree', role: 'group', 'aria-label': 'Lens' }, ['works', 'fails'].map(function (k) { return el('button', { type: 'button', 'data-lens': k, class: lens === k ? 'on ' + (k === 'works' ? 'y' : 'x') : '', 'aria-pressed': String(lens === k), text: LENS[k][0], onclick: function () { FX.mlens = k; render(); } }); })),
      el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '/model' + (EXAMPLE ? location.search : '') + '#' + LENS[lens][2], text: '‹ Back to ' + LENS[lens][0] })]),
      el('p', { class: 'fxlens' }, [el('b', { text: m[lens === 'works' ? 'w' : 'f'] })]), findingsBox(m, lens)]);
  }

  // part 3: Design propositions
  function renderMDesign() {
    var P = mParts(), ro = !!S.readonly, ps = P.props, PR = window.VTProps, ex = EXAMPLE ? location.search : '';
    var wrap = el('div', { class: 'fx', id: 'fxMDesign' }); main.appendChild(wrap);
    var statusTxt = function () { var n = MSENT.filter(function (p) { return p[0] && !mval(p[0]); }).length, s2 = mState(); return s2.at && !s2.changed ? 'Agreed on ' + dlong(s2.at) + (s2.by ? ' by ' + s2.by.replace(/ \(master\)$/, '') : '') + ' and handed to Test.' : s2.changed ? 'Changed since it was agreed: agree it again.' : n ? n + (n === 1 ? ' blank' : ' blanks') + ' to fill, then agree it.' : 'Ready to agree.'; };
    wrap.appendChild(mPath('mdesign', ps.length + (ps.length === 1 ? ' proposition' : ' propositions')));
    wrap.appendChild(mTitle('Design propositions', 'What could change. Protect what the models show works; fix what they show fails. Agree what goes to Test in one sentence.', [el('span', { text: ps.length + (ps.length === 1 ? ' proposition' : ' propositions') }), el('span', { class: 'fxsep', text: '·' }), el('span', { text: P.covered.length + ' of 4 headings answered' }), el('span', { class: 'fxsep', text: '·' }), el('b', { id: 'mStatusTxt', text: statusTxt() })], 'd'));
    // what the models showed
    var col = function (lens) { var items = []; P.chosen.forEach(function (m) { mFind(m.id, lens).forEach(function (x) { items.push([m.n, x.t]); }); }); return el('div', { class: 'fxcard fxpart', 'data-lens': lens }, [el('div', { class: 'fxqhead' }, [el('h3', { class: 'fxsech', text: lens === 'works' ? 'Protect: how it works' : 'Fix: how it fails' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#' + LENS[lens][2], text: 'Open' })]), items.length ? el('ul', {}, items.slice(0, 12).map(function (x) { return el('li', {}, [el('b', { text: x[0] + ': ' }), document.createTextNode(x[1])]); })) : el('p', { class: 'fxmuted', text: 'No findings yet.' })]); };
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'What the models showed' }));
    wrap.appendChild(el('div', { class: 'fxparts two', id: 'mShowed' }, [col('works'), col('fails')]));
    // which parts of the formulation are answered
    var SUBN = { protective: 'How it works: protective', predisposing: 'Predisposing', precipitating: 'Precipitating', perpetuating: 'Perpetuating' };
    var grid = el('div', { class: 'fxheads', id: 'mHeads' });
    P.subs.forEach(function (k) { var mine = ps.filter(function (p) { return p.answers && p.answers.sub === k; }); grid.appendChild(el('div', { class: 'fxhead' + (mine.length ? '' : ' gap'), 'data-sub': k }, [el('b', { text: SUBN[k] }), mine.length ? el('ul', {}, mine.map(function (p) { return el('li', { text: (PR ? PR.label(p) + ' ' : '') + (p.n || 'Untitled') }); })) : el('span', { class: 'fxmuted', text: 'Nothing answers this yet' })])); });
    // suggested from the model (31 October 2026): doing nothing first, then the smallest sets of fixes that block
    // every combination in the fault tree, the failures found in part 2, and the unchecked conditions.
    var SG = mSuggest(), FUNCS = window.VTProps ? window.VTProps.FUNCS : [], LEV = window.VTAnalyse ? window.VTAnalyse.L4 : [];
    var sbox = el('details', { class: 'fxcard fxtoolcard', id: 'mSuggest', open: FX.open_mSuggest || !ps.length ? true : null, ontoggle: function (e) { FX.open_mSuggest = e.target.open; } }, [el('summary', {}, [el('span', { class: 'fxsech', text: 'Suggest from the model (' + SG.length + ')' })]), el('p', { class: 'fxmuted', text: 'Drafts drawn from what the models showed. Doing nothing always comes first. Choose one to make it a proposition; each then passes three gates: the right level, a capability these people have, and a load they can carry.' })]);
    if (SG.cut) sbox.appendChild(el('p', { class: 'fxeg', id: 'mCutSet' }, [el('span', { text: 'From the fault tree: ' }), el('i', { text: SG.cut })]));
    sbox.appendChild(el('ul', { class: 'fxsuggest' }, SG.map(function (g, i) { return el('li', { 'data-suggest': String(i) }, [el('span', {}, [el('b', { text: g.n }), el('span', { class: 'fxmuted', text: ' · ' + g.from })]), ro ? null : el('button', { class: 'btn sm', type: 'button', 'data-usesuggest': String(i), text: 'Make it a proposition', onclick: function () { if (window.VTProps) window.VTProps.draft({ n: g.n, kind: g.kind, i: g.i || '', c: g.c || '', from: g.from, origin: 'suggested' }); location.hash = 'props'; } })]); })));
    wrap.appendChild(sbox);
    // the lever table: six functions by four levels, with the propositions in each cell
    if (FUNCS.length && LEV.length) {
      var lt = el('table', { class: 'fxtable fxlever', id: 'mLever' }, [el('thead', {}, [el('tr', {}, [el('th', { text: 'Acting through' })].concat(LEV.map(function (l) { return el('th', { text: l[1] }); })))])]), lb = el('tbody');
      FUNCS.forEach(function (f) { lb.appendChild(el('tr', {}, [el('th', { scope: 'row', text: f[1] })].concat(LEV.map(function (l) { var xs = ps.filter(function (p) { return p.func === f[0] && p.level === l[0]; }); return el('td', { class: xs.length ? 'on' : '', 'data-cell': f[0] + '.' + l[0] }, xs.length ? xs.map(function (p) { return el('div', { text: (PR ? PR.label(p) + ' ' : '') + cutT(p.n || '', 40) }); }) : [el('span', { class: 'fxmuted', text: '·' })]); })))); });
      lt.appendChild(lb);
      wrap.appendChild(el('details', { class: 'fxcard fxtoolcard', id: 'mLeverBox', open: FX.open_mLever ? true : null, ontoggle: function (e) { FX.open_mLever = e.target.open; } }, [el('summary', {}, [el('span', { class: 'fxsech', text: 'The lever table: six functions at four levels' })]), el('p', { class: 'fxmuted', text: 'Where each proposition acts. Most inquiries recommend at one cell; the empty cells are the ways in nobody has written. A change at the wrong level for the failure is the first reason changes fail.' }), el('div', { class: 'fxscrollx' }, [lt])]));
    }
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'The propositions' }));
    wrap.appendChild(el('section', { class: 'fxcard', id: 'mCover' }, [el('div', { class: 'fxqhead' }, [el('h3', { class: 'fxsech', text: 'Which parts of the formulation are answered' }), el('span', { class: 'fxgrow' }), ro ? null : el('a', { class: 'btn sm fxmain', href: '#props', id: 'mAddProp', text: ps.length ? 'Open the propositions' : 'Write the first proposition' })]), el('p', { class: 'fxmuted', text: 'Each proposition is written as: in this situation, this change, working through this mechanism, should produce this outcome. A heading with nothing against it is a gap.' }), grid]));
    if (ps.length) wrap.appendChild(el('div', { class: 'fxprops', id: 'mProps' }, ps.map(function (p) {
      var c = function (k, l) { return p[k] ? el('div', {}, [el('b', { text: l }), el('span', { text: p[k] })]) : null; };
      return el('a', { class: 'fxpropcard', href: '#props', 'data-prop': p.id }, [el('div', { class: 'fxqhead' }, [el('b', { text: (PR ? PR.label(p) + ' ' : '') + (p.n || 'Untitled proposition') }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag' + (p.status === 'ready' ? ' ok' : ''), text: p.status === 'ready' ? 'Ready for Test' : p.status === 'tested' ? 'Tested' : 'Proposed' })]), el('div', { class: 'fxcimo' }, [c('c', 'In this situation'), c('i', 'this change'), c('m', 'working through'), c('o', 'should produce')])]);
    })));
    // the sentence for Test
    var sent = el('p', { class: 'fxsentence', id: 'mSentence' }), pill = el('span', { class: 'fxtag' }), note = el('span', { class: 'fxmuted' });
    var agree = ro ? null : el('button', { class: 'btn fxmain', type: 'button', id: 'mAgree' });
    var paint = function () {
      sent.innerHTML = '';
      MSENT.forEach(function (p) {
        sent.appendChild(document.createTextNode(p[1]));
        if (!p[0]) return;
        var k = p[0], v = mval(k), fromFrame = !mv(k) && v;
        if (FX.edit === 'm-' + k && !ro) {
          var inp = el('input', { type: 'text', 'data-field': 'modelstep.' + k, value: v, placeholder: 'For example: ' + p[3], 'aria-label': p[2] });
          var done = async function () { var nv = inp.value.trim(); FX.edit = null; try { if (nv !== mv(k)) await saveModelStep(function (c) { c.sentence = c.sentence || {}; c.sentence[k] = nv; c.who = c.who || {}; c.who[k] = { by: meName(), at: new Date().toISOString() }; }, 'Changed the sentence for Test: ' + p[2].replace(/\?$/, '')); } catch (e) { note.textContent = saveErr(e); } paint(); };
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') { FX.edit = null; paint(); } });
          sent.appendChild(el('span', { class: 'fxinline' }, [inp, el('button', { class: 'btn sm fxmain', type: 'button', 'data-done': k, text: 'Done', onmousedown: function (e) { e.preventDefault(); }, onclick: done })]));
          setTimeout(function () { inp.focus(); }, 0);
        } else if (v) sent.appendChild(el('button', { class: 'fxfill fxeditable', type: 'button', 'data-blank': k, title: fromFrame ? 'From Frame. Change it here if it should differ.' : 'Change this', text: v, disabled: ro, onclick: function () { FX.edit = 'm-' + k; paint(); } }));
        else sent.appendChild(el('button', { class: 'fxblank', type: 'button', 'data-blank': k, text: p[2] + ' ✎', disabled: ro, onclick: function () { FX.edit = 'm-' + k; paint(); } }));
      });
      var s2 = mState(), n = MSENT.filter(function (p) { return p[0] && !mval(p[0]); }).length;
      pill.className = 'fxtag ' + (s2.at && !s2.changed ? 'ok' : ''); pill.textContent = s2.at ? (s2.changed ? 'Changed since agreed' : 'Agreed ' + dshort(s2.at)) : 'Draft';
      if (agree) { agree.disabled = !!n || !!(s2.at && !s2.changed); agree.textContent = s2.at ? (s2.changed ? 'Agree it again' : 'Agreed') : 'Agree and hand to Test'; }
      note.textContent = n ? 'Fill the ' + (n === 1 ? 'last blank' : n + ' blanks') + ' to agree it. The measure and the threshold come from Frame unless you change them.' : s2.at && !s2.changed ? 'Agreed by ' + String(s2.by || '').replace(/ \(master\)$/, '') + '. Test starts from this.' : '';
      var stx = document.getElementById('mStatusTxt'); if (stx) stx.textContent = statusTxt();
    };
    if (agree) agree.addEventListener('click', async function () { var now = new Date().toISOString(), txt = 'Agreed on ' + dlong(now) + '. ' + mBodyFull(); try { await saveModelStep(function (c) { var past = c.agreed && c.agreed.at ? [c.agreed].concat(c.agreed.past || []).map(function (x) { return { at: x.at, text: x.text, by: x.by }; }).slice(0, 10) : []; c.agreed = { at: now, text: txt, by: meName(), past: past }; }, 'Agreed and handed to Test'); render(); } catch (e) { note.textContent = saveErr(e); } });
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'What goes to Test' }));
    wrap.appendChild(el('div', { class: 'fxcard fxhero', id: 'mStatement' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'What we will try, in one sentence' }), el('span', { class: 'fxgrow' }), pill]), sent, el('div', { class: 'fxagree' }, [note, el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '#handon', text: 'The full hand-on to Test' }), agree])]));
    paint();
    wrap.appendChild(fxFoot(['3.5 How it fails', '#mfails'], ['On to 4 Test', '/test' + ex], 'Test tries the changes, first in the model, then in use.'));
  }

  function mSuggest() {
    var out = [], ps = mProps(), v = invData();
    if (!ps.some(function (p) { return p.kind === 'nothing'; })) out.push({ n: 'Do nothing, and watch', kind: 'nothing', from: 'always the first option', i: 'Keep things as they are, and watch the measure that matters most.' });
    var ft = v.faulttree || {}, nodes = ft.nodes || [], cs = window.VTModel && window.VTModel._cuts && nodes.length ? window.VTModel._cuts(ft) : [];
    var nm = function (id) { var n = nodes.filter(function (x) { return x.id === id; })[0]; return n ? n.n : id; };
    if (cs.length) {
      var ids = []; cs.forEach(function (c) { c.ids.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
      var hits = function (set) { return cs.every(function (c) { return c.ids.some(function (id) { return set.indexOf(id) >= 0; }); }); }, best = null;
      for (var k = 1; k <= Math.min(4, ids.length) && !best; k++) { (function comb(start, cur) { if (best) return; if (cur.length === k) { if (hits(cur)) best = cur.slice(); return; } for (var i = start; i < ids.length; i++) { cur.push(ids[i]); comb(i + 1, cur); cur.pop(); } })(0, []); }
      if (best) { out.cut = 'the smallest set of fixes that blocks all ' + cs.length + (cs.length === 1 ? ' combination' : ' combinations') + ' is ' + best.map(nm).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.'; best.forEach(function (id) { out.push({ n: 'Guard against: ' + nm(id), kind: 'fix', from: 'fault tree, in the smallest set of fixes' }); }); }
    }
    mChosen().forEach(function (m) { mFind(m.id, 'fails').forEach(function (x) { out.push({ n: 'Fix: ' + x.t, kind: 'fix', from: m.n + ', how it fails' }); }); mFind(m.id, 'works').slice(0, 2).forEach(function (x) { out.push({ n: 'Protect: ' + x.t, kind: 'protect', from: m.n + ', how it works' }); }); });
    ((v.interrogate || {}).items || []).filter(function (x) { return x.state !== 'yes' || !String(x.notice || '').trim(); }).slice(0, 4).forEach(function (x) { out.push({ n: 'Make it visible: ' + (x.n || (v.processes || []).filter(function (p) { return p.id === x.proc; }).map(function (p) { return p.n; })[0] || 'an unchecked part of the map'), kind: 'fix', from: 'questions for every part of the map' }); });
    var have = ps.map(function (p) { return String(p.n || '').toLowerCase(); });
    var res = out.filter(function (g) { return have.indexOf(g.n.toLowerCase()) < 0; }); res.cut = out.cut; return res;
  }
  // the Model Canvas: one A4 landscape page, greyscale
  function renderMCanvas() {
    var P = mParts(), blank = !!FX.blankCanvas, f = (frameAns().question || {}).fields || {}, ms = mState(), PR = window.VTProps, ds = dState();
    var cut = function (t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
    var none = function () { return el('span', { class: 'fce', text: blank ? '' : 'Nothing recorded yet' }); };
    var item = function (label, t, n) { return el('div', { class: 'fci' }, [el('b', { text: label }), el('div', {}, [blank || !t ? none() : document.createTextNode(cut(t, n || 160))])]); };
    var rows = blank ? [{ n: '' }, { n: '' }, { n: '' }, { n: '' }, { n: '' }] : P.chosen.slice(0, 6);
    var mt = el('table', { class: 'fctab fcmt' }, [el('thead', {}, [el('tr', {}, [el('th', { text: 'Model' }), el('th', { text: '1 How it works: it works because …' }), el('th', { text: '2 How it fails: it fails because …' })])]),
      el('tbody', {}, rows.length ? rows.map(function (m) { var w = m.id ? mFind(m.id, 'works').map(function (x) { return x.t; }) : [], fl = m.id ? mFind(m.id, 'fails').map(function (x) { return x.t; }) : []; return el('tr', {}, [el('td', {}, [el('b', { text: m.n })]), el('td', { text: cut(w.join('; '), 170) }), el('td', { text: cut(fl.join('; '), 170) })]); }) : [el('tr', {}, [el('td', { colspan: '3' }, [none()])])])]);
    var ps = P.props;
    var pt = el('table', { class: 'fctab' }, [el('thead', {}, [el('tr', {}, ['', 'In this situation', 'this change', 'working through', 'should produce', 'Answers'].map(function (h) { return el('th', { text: h }); }))]),
      el('tbody', {}, (blank ? [1, 2, 3] : ps.slice(0, 4)).map(function (p) { return blank ? el('tr', {}, [el('td', { text: 'P' + p }), el('td'), el('td'), el('td'), el('td'), el('td')]) : el('tr', {}, [el('td', {}, [el('b', { text: PR ? PR.label(p) : '' })]), el('td', { text: cut(p.c, 60) }), el('td', { text: cut(p.i || p.n, 60) }), el('td', { text: cut(p.m, 60) }), el('td', { text: cut(p.o, 60) }), el('td', { text: p.answers && p.answers.sub ? p.answers.sub.charAt(0).toUpperCase() + p.answers.sub.slice(1) : '' })]); }))]);
    if (!blank && !ps.length) pt = none();
    var canvas = el('article', { class: 'fcanvas mcanvas' + (blank ? ' blank' : ''), id: 'mcCanvas', 'aria-label': 'Model Canvas' }, [
      el('div', { class: 'fchead' }, [
        el('div', { class: 'fctitle' }, [el('div', { class: 'fcbrand', text: 'Model Canvas' }), el('div', { class: 'fcmeta', text: S.data.session.name || '' }), el('div', { class: 'fcmeta', text: blank ? 'Date:' : dlong(new Date().toISOString()) + ' · ' + (ms.at && !ms.changed ? 'Agreed ' + dlong(ms.at) : 'Draft') })]),
        el('div', { class: 'fcq' }, [el('span', { class: 'fcql', text: 'The question' }), el('div', { class: 'fcqt' }, [blank ? el('span') : document.createTextNode(cut(f.question || '', 200))]), !blank && ds.at ? el('div', { class: 'fcqs', text: 'The formulation: ' + cut(String(ds.text || '').replace(/^Agreed on [^.]*\.\s*/, ''), 230) }) : null]),
        el('div', { class: 'fcwho' }, [item('If we do nothing', fv('question', 'nothing'), 90), item('The threshold that must not be crossed', lineText(), 90)])]),
      el('div', { class: 'fcgrid mgrid' }, [
        el('section', { class: 'fcc m1' }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn wide', text: '1, 2' }), el('h3', { text: 'The models: how it works, and how it fails' })]), el('p', { class: 'fcp', text: 'Each model built once and looked at twice: what goes right and why, then where it breaks and why' }), mt]),
        el('section', { class: 'fcc m2' }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn', text: '3' }), el('h3', { text: 'Design propositions' })]), el('p', { class: 'fcp', text: 'In this situation, this change, working through this mechanism, should produce this outcome. Protect what works; fix what fails' }), pt])]),
      el('div', { class: 'fcfoot' }, [el('span', { class: 'fcql', text: 'What goes to Test' }), el('span', { class: 'fcst' }, [blank ? el('span', { class: 'fce', text: 'We will try … in … because the models show … We will know it is working when … improves, without crossing …' }) : document.createTextNode(cut(mBodyFull(), 420))]), el('span', { class: 'fcsrc', text: 'Viability Thinking Lab · Model' })])]);
    var bar = el('div', { class: 'fx fcbar no-print' }, [el('a', { class: 'btn sm', href: '#mhome', text: '‹ Back to Model' }), el('span', { class: 'fxgrow' }),
      el('label', { class: 'fxcheckrow', style: 'font-size:14px;padding:0;margin-right:6px' }, [el('input', { type: 'checkbox', id: 'mcBlank', checked: blank, onchange: function (e) { FX.blankCanvas = e.target.checked; render(); } }), el('span', { text: 'Blank, for a workshop' })]),
      el('button', { class: 'btn sm', type: 'button', text: 'Save as PDF', title: 'Choose “Save as PDF” in the print window', onclick: function () { window.print(); } }), el('button', { class: 'btn sm fxmain', type: 'button', id: 'mcPrint', text: 'Print', onclick: function () { window.print(); } })]);
    main.appendChild(el('div', { class: 'fcwrap' }, [bar, el('p', { class: 'fx fxmuted no-print', style: 'margin:0 0 12px', text: 'One A4 page, landscape, in black and grey. Long entries are shortened to fit.' }), el('div', { class: 'fcscroll' }, [canvas])]));
  }

  // ---------- Test, in three parts (31 October 2026): The alpha test, The beta test, Outcomes ----------
  // Each design proposition is tried twice: first in the model (alpha), then in use (beta). Part 3 is what the
  // change leaves behind: for the stakeholders, and for the organisation (Purpose, Awareness, Coordination and
  // Engagement), with one agreed sentence. The alpha result is kept on the proposition (the 'props' tile); the
  // beta test keeps its own records (the 'beta' tile); part 3 is saved in the 'teststep' tile:
  //   { out: { gains, exposed, absent }, measure: 'yes'|'no'|'unsure', line: 'held'|'crossed'|'unsure', sentence: {...}, agreed: {...} }
  var TSTEP = { label: 'The three parts of Test', back: ['Test', '#thome'] };
  // a list of tools as rows, with the next one picked out
  function toolRows(tools, nextId) {
    return el('div', { class: 'fxtools-list flat' }, tools.map(function (t) {
      var isNext = t.id === nextId;
      return el('div', { class: 'fxtoolrow' + (isNext ? ' now' : ''), 'data-tool': t.id }, [el('div', { class: 'fxtrt' }, [el('b', { text: t.n }), el('span', { class: 'fxmuted', text: t.by }), el('p', { text: String(t.does || '').split(/(?<=\.)\s/)[0] })]),
        el('div', { class: 'fxtra' }, [el('span', { class: 'fxtag ' + (t.used ? 'ok' : isNext ? 'now' : ''), text: t.used ? '✓ In use' : isNext ? 'Next' : 'Not started' }), el('a', { class: 'btn sm' + (isNext ? ' fxmain' : ''), href: t.href, text: t.used ? 'Open' : 'Start' })])]);
    }));
  }
  function tRow() { return ((row('teststep') || {}).content) || {}; }
  function tv(k) { return String((tRow().sentence || {})[k] || '').trim(); }
  var testQ = Promise.resolve();
  function saveTestStep(fn, summary) { var run = testQ.then(function () { return saveTestStep1(fn, summary); }); testQ = run.catch(function () {}); return run; }
  async function saveTestStep1(fn, summary) {
    fxSave('busy');
    try {
      var r = row('teststep'), c = JSON.parse(JSON.stringify((r && r.content) || {})); fn(c);
      var d = await api({ action: 'p_save', tile_key: 'teststep', status: (r && r.status) || 'partly', summary: summary, base_version: r ? r.version : null, content: c });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'teststep'; }); S.data.tiles.push(d.tile); fxSave('ok');
    } catch (e) { fxSave('bad'); throw e; }
  }
  async function saveProp(id, fn, summary) {
    fxSave('busy');
    try {
      var r = row('props'), c = JSON.parse(JSON.stringify((r && r.content) || { items: [] })); c.items = c.items || [];
      c.items.forEach(function (x) { if (x.id === id) fn(x); });
      var d = await api({ action: 'p_save', tile_key: 'props', status: (r && r.status) || 'partly', summary: summary, base_version: r ? r.version : null, content: c });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'props'; }); S.data.tiles.push(d.tile); fxSave('ok');
    } catch (e) { fxSave('bad'); throw e; }
  }
  var ARES = [['holds', 'Holds', 'y'], ['changed', 'Changed', 'n'], ['fails', 'Fails', 'x']];
  function alphaOf(p) { var a = p.alpha || {}; return a.result || (p.status === 'ready' ? 'holds' : ''); }
  var TSENT = [['who', 'For ', 'whom?', 'patients on high-risk medicines and the weekend teams'], ['what', ', the change has ', 'done what?', 'cut the wait for a doctor from hours to minutes'], ['stronger', '. It leaves the organisation stronger in ', 'which?', 'coordination at weekends'], ['weaker', ' and weaker in ', 'which?', 'nothing we have seen yet'], ['keep', '. We will keep ', 'what?', 'the named doctor'], ['change', ', change ', 'what?', 'how the flag reaches them'], ['stop', ' and stop ', 'what?', 'the ward results book'], [null, '.']];
  function tBodyFull() { return TSENT.map(function (p) { return p[0] ? p[1] + (tv(p[0]) || '__________') : p[1]; }).join(''); }
  function tState() { var ag = tRow().agreed || {}; return { at: ag.at, by: ag.by, text: ag.text, changed: !!ag.at && String(ag.text || '').replace(/^Agreed on [^.]*\.\s*/, '') !== tBodyFull() }; }
  function tParts() {
    var ps = mProps(), B = window.VTBeta && window.VTBeta.status ? window.VTBeta.status() : [], T = window.VTBeta && window.VTBeta.tally ? window.VTBeta.tally() : { n: 0, pace: {} };
    var held = ps.filter(function (p) { return alphaOf(p) === 'holds'; }), c = tRow(), out = c.out || {}, st = tState();
    var G = window.VTAnalyse && window.VTAnalyse.stepGroups ? window.VTAnalyse.stepGroups('test') : [], tools = {}; G.forEach(function (g) { g.tools.forEach(function (t) { tools[t.id] = t; }); });
    var bres = function (p) { var x = B.filter(function (y) { return y.id === p.id; })[0]; return x ? x.result : ''; };
    return {
      alpha: ps.length ? ps.map(function (p) { return [!!alphaOf(p), (window.VTProps ? window.VTProps.label(p) + ' ' : '') + (p.n || 'Untitled'), '#talpha']; }) : [[false, 'Propositions from Model', '/model#mdesign']],
      betaMs: held.length ? held.map(function (p) { var r = bres(p), xd = (((tRow().exp || {})[p.id] || {}).decision || {}).d; return [r === 'proven' || r === 'sentback' || xd === 'proven' || xd === 'sentback', (window.VTProps ? window.VTProps.label(p) + ' ' : '') + (p.n || 'Untitled'), '#tbeta']; }) : [[false, 'A proposition that holds in the model', '#talpha']],
      out: [[!!(out.gains && out.exposed && out.absent), 'What changed for each group', '#tout'], [!!c.measure && !!c.line, 'The measure and the threshold checked', '#tout'], [!!(tools.pace && tools.pace.used) || T.n > 0, 'Purpose, Awareness, Coordination and Engagement', '#tout'], [!!(st.at && !st.changed), 'The outcome agreed', '#tout']],
      props: ps, held: held, beta: B, tally: T, tools: tools, st: st, bres: bres
    };
  }
  function tPath(cur, note) { return treePath('test', cur, note); }

  function tTitle(title, lede, status, part) { return fxTitle(title, lede, status, part, { step: 'Test', tile: 'teststep', one: ['Test Canvas', '#tcanvas'], present: '#present=t' }); }
  // the connected map, inside Test: where each change acts, over time and by level
  function tmapCss() {
    if (!document.getElementById('tmapCss')) { var tcs = document.createElement('style'); tcs.id = 'tmapCss'; tcs.textContent = '.tmapcard{display:grid;gap:4px;border:2px solid currentColor;padding:18px 20px;margin:18px 0 22px;text-decoration:none;color:inherit;border-left:8px solid var(--accent,#e07030)}.tmapcard:hover{background:color-mix(in srgb,var(--accent,#e07030) 8%,transparent)}.tmapk{font-family:"DM Mono",monospace;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--accent,#e07030)}.tmapn{font-size:26px;font-weight:600}.tmapq{max-width:760px}.tmapgo{margin-top:6px;font-weight:600;text-decoration:underline}.tmaplead{margin:0 0 6px}.tmaplead p{margin:0 0 8px;max-width:980px}.tmapps{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.tmapp{border:1px solid var(--line);padding:4px 9px;font-size:13px;text-decoration:none;color:inherit;max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tmapp span{opacity:.7;margin-left:6px;font-size:12px}.tmapp.holds{border-left:4px solid var(--ok,#2e8b57)}.tmapp.fails{border-left:4px solid var(--accent,#e07030)}.tmapp.changed{border-left:4px dashed var(--ok,#2e8b57)}'; document.head.appendChild(tcs); }
  }
  function renderTMap() {
    tmapCss();
    document.body.classList.add('cm-wide');
    var ps = mProps(), AR = { holds: 'Holds in the model', fails: 'Fails in the model', changed: 'Changed in the model' };
    var lead = el('section', { class: 'tmaplead no-print' }, [
      el('p', { class: 'fxmuted', text: 'For each change: find where it acts on the route, at its level, and play the event through with it in place. Does the route still reach the threshold? Zoom out in time to see whether it lasts, and up a level to see what it depends on.' }),
      el('div', { class: 'tmapps' }, ps.map(function (p) { var a = alphaOf(p); return el('a', { class: 'tmapp ' + (a || 'none'), href: '#talpha', title: (p.n || 'Untitled') + ': ' + (AR[a] || 'Not tried yet') }, [el('b', { text: window.VTProps ? window.VTProps.label(p) : '' }), document.createTextNode(' ' + (p.n || 'Untitled')), el('span', { text: AR[a] || 'Not tried yet' })]); }))]);
    if (window.VTCMap) { window.VTCMap.render(main, VTX, { back: ['‹ Test', '#thome'], from: 'test' }); var hst = document.getElementById('cmHost'); if (hst) hst.parentNode.insertBefore(lead, hst); else main.appendChild(lead); }
    else main.appendChild(el('p', { class: 'fxmuted', text: 'The connected map did not load. Reload the page.' }));
  }
  function renderTHome() {
    var P = tParts(), s = S.data.session;
    var wrap = el('div', { class: 'ww', id: 'testHome' });
    wrap.appendChild(stepPlate('test', 'ww-plate'));
    wrap.appendChild(el('p', { class: 'ww-kick', text: 'Step 4 of 4 · ' + (s.name || '') }));
    wrap.appendChild(el('h1', { class: 'ww-h', text: 'Test' }));
    wrap.appendChild(el('p', { class: 'ww-lede', text: 'Try each change twice: first in the model, then in use, by the people who run the service. Then say what the change leaves behind, for the people the service is for and for the organisation.' }));
    var cmr = row('cmap'), hasMap = !!(cmr && cmr.content && cmr.content.map);
    wrap.appendChild(el('a', { class: 'tmapcard', id: 'tMapCard', href: '#tmap' }, [el('span', { class: 'tmapk', text: 'Start here · 4.1.1' }), el('span', { class: 'tmapn', text: 'The connected map' }), el('span', { class: 'tmapq', text: 'See where each change acts on the route of the event, zoomed in time from decades to minutes and by level from the field down to the front line. Play the event through with the change in place.' }), el('span', { class: 'tmapgo', text: hasMap ? 'Open the map' : 'No map yet: build it in Model, 3.3' })]));
    tmapCss();
    var grid = partCards('test');
    wrap.appendChild(grid);
    wrap.appendChild(modelRunPanel('home'));
    wrap.appendChild(el('div', { class: 'ph-more' }, [workLink(), el('a', { href: '/model' + (EXAMPLE ? location.search : '') + '#mdesign', text: '‹ What goes to Test, in Model' }), el('a', { href: '#evidence', text: 'The evidence matrix' })]));
    main.appendChild(wrap);
  }
  // ---------- the changes run in the model (1 November 2026) ----------
  // The flow model and the agent-based model are built in Model; Test shows what they say about each change.
  var ATOOL = [['', 'Choose'], ['tharm', 'The flow model'], ['abm', 'The agent-based model'], ['cmap', 'The connected map'], ['scentest', 'Scenario testing'], ['bia', 'Impact analysis'], ['risk', 'Risk assessment'], ['other', 'Judgement, without a model']];
  function toolBuilt(k) {
    var v = invData() || {}, has = function (x) { return !!(x && (x.items || x.procs || []).length); };
    if (k === 'tharm') { var r = row('tharm'); return !!(r && r.content && r.content.model && (r.content.model.options || []).length); }
    if (k === 'cmap') { var c = row('cmap'); return !!(c && c.content && c.content.map); }
    if (k === 'abm') return has(v.abm);
    if (k === 'scentest' || k === 'bia' || k === 'risk') return has(v[k]);
    var md = window.VTModel && window.VTModel.models.filter(function (x) { return x.id === k; })[0];
    if (md && md.key) { try { return !!(v[md.key] && !md.empty(v, v[md.key])); } catch (e) { return false; } }
    return false;
  }
  function alphaBasis(p) {
    var a = (p && p.alpha) || {}, k = a.tool || '';
    if (!k || k === 'other') return { k: 'judgement', t: 'Judgement', why: k === 'other' ? 'Not run in a model' : 'No model named' };
    var md = window.VTModel && window.VTModel.models.filter(function (x) { return x.id === k; })[0], n = (ATOOL.filter(function (x) { return x[0] === k; })[0] || [k, md ? 'The ' + md.name.charAt(0).toLowerCase() + md.name.slice(1) : k])[1];
    return toolBuilt(k) ? { k: 'run', t: 'Model run', why: n } : { k: 'judgement', t: 'Judgement', why: n.replace(/^The /, 'the ') + ' has not been built yet' };
  }
  var RUNC = { sig: null, abm: null };
  function flowFor(p) {
    var r = row('tharm'), m = r && r.content && r.content.model; if (!m || !window.VTTharm) return [];
    var lab = window.VTProps ? window.VTProps.label(p) : '', re = new RegExp('\\b' + lab + '\\b');
    if (!lab) return [];
    return window.VTTharm.evaluate(m).filter(function (x) { return re.test(x.o.n); });
  }
  function modelRunPanel(where) {
    var ex = EXAMPLE ? location.search : '', box = el('section', { class: 'fxcard trun', id: 'tRun-' + where }), T = window.VTTharm;
    box.appendChild(el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Run the changes in the model' }), el('span', { class: 'fxgrow' })]));
    box.appendChild(el('p', { class: 'fxmuted', text: 'Each change run against doing nothing, in the models built in Model. These are what could happen in the scenarios tried, not forecasts.' }));
    var grid = el('div', { class: 'trun-grid' }); box.appendChild(grid);
    // the flow model
    var fr = row('tharm'), m = fr && fr.content && fr.content.model, f = el('div', { class: 'trun-m', 'data-run': 'tharm' }, [el('h3', { text: 'The flow model' }), el('p', { class: 'fxmuted sm', text: 'More throughput, no intolerable harm' })]);
    if (m && T && (m.options || []).length) {
      var rs = T.evaluate(m), today = rs[0];
      f.appendChild(el('p', {}, [el('b', { text: today.o.n + ': ' }), document.createTextNode(today.pct + ' per cent of the threshold in the worst scenario' + (today.pct >= 100 ? ', beyond tolerance.' : ', within tolerance.'))]));
      var ul = el('ul', { class: 'trun-list' });
      rs.slice(1).forEach(function (x) { ul.appendChild(el('li', {}, [T.markIcon(x.reg), el('span', { text: x.o.n + ': ' + x.pct + ' per cent' + (x.gain ? ', throughput ' + (x.gain > 0 ? '+' : '') + x.gain + ' per cent' : '') }), el('span', { class: 'fxmuted sm', text: ' · ' + T.REG[x.reg][0] })])); });
      f.appendChild(ul);
      T.interactions(m, rs).forEach(function (x) { f.appendChild(el('p', { class: 'trun-ix', text: x.text })); });
      f.appendChild(el('p', { class: 'fxmuted sm', text: 'Intolerable when the backlog reaches ' + m.threshold + ' (' + m.unit + '). ' + (m.name || '') }));
    } else f.appendChild(el('p', { class: 'fxmuted', text: 'Not built yet. Build it in Model with the stages, the scenarios and each proposition as a change.' }));
    f.appendChild(el('a', { class: 'btn sm', href: '/model' + ex + '#tharm', text: m ? 'Open the flow model' : 'Build the flow model' }));
    grid.appendChild(f);
    // the agent-based model
    var v = invData() || {}, am = v.abm || {}, a = el('div', { class: 'trun-m', 'data-run': 'abm' }, [el('h3', { text: 'The agent-based model' })]);
    if ((am.procs || []).length && window.VTModel && window.VTModel.abmResults) {
      var tw = window.VTModel.twinOf(am); a.appendChild(el('p', { class: 'fxmuted sm', text: tw.t + (tw.k === 'assumed' ? ': ' + tw.real + ' of ' + tw.n + ' numbers from data' : '') }));
      var sig = JSON.stringify([am, v.scenarios, v.processes, v.resources, v.tolerance]);
      if (RUNC.sig !== sig) { try { RUNC.abm = window.VTModel.abmResults(v); } catch (e) { RUNC.abm = null; } RUNC.sig = sig; }
      var tol = window.VTModel.tolOf(v);
      if (RUNC.abm) { var ul2 = el('ul', { class: 'trun-list' }); RUNC.abm.forEach(function (x) { ul2.appendChild(el('li', {}, [el('span', { text: x.n + ': ' + Math.round(x.pb * 100) + ' in 100 replays breach the tolerance' + (x.max != null ? '; worst ' + x.max.toFixed(1) + ' hours' : '') })])); }); a.appendChild(ul2); }
      a.appendChild(el('p', { class: 'fxmuted sm', text: 'Tolerance: ' + (tol ? tol + (tol === 1 ? ' hour' : ' hours') + '. ' : 'intolerable at once, so any wait counts as a breach: read these as how often work waits outside the picture at all. ') + (am.runs || 200) + ' replays for each scenario, today’s set-up. Change the set-up in Model to try a proposition.' }));
    } else a.appendChild(el('p', { class: 'fxmuted', text: 'Not built yet. Build it in Model from the processes and resources already mapped.' }));
    a.appendChild(el('a', { class: 'btn sm', href: '/model' + ex + '#abm', text: (am.procs || []).length ? 'Open the agent-based model' : 'Build the agent-based model' }));
    grid.appendChild(a);
    // the connected map
    var cr = row('cmap'), hm = !!(cr && cr.content && cr.content.map);
    grid.appendChild(el('div', { class: 'trun-m', 'data-run': 'cmap' }, [el('h3', { text: 'The connected map' }), el('p', { class: 'fxmuted sm', text: 'Where each change acts on the route of the event, by time and by level. Play the event through with the change in place.' }), hm ? null : el('p', { class: 'fxmuted', text: 'Not built yet. Build it in Model.' }), el('a', { class: 'btn sm', href: hm ? '/test' + ex + '#tmap' : '/model' + ex + '#cmap', text: hm ? 'Open the map in Test' : 'Build the map in Model' })]));
    return box;
  }
  // part 1: The alpha test
  function renderTAlpha() {
    var P = tParts(), ps = P.props, ro = !!S.readonly, PR = window.VTProps, ex = EXAMPLE ? location.search : '';
    var wrap = el('div', { class: 'fx', id: 'fxTAlpha' }); main.appendChild(wrap);
    var done = ps.filter(function (p) { return alphaOf(p); }).length, nx = ps.filter(function (p) { return !alphaOf(p); })[0];
    wrap.appendChild(tPath('talpha', done + ' of ' + ps.length + ' tried'));
    wrap.appendChild(tTitle('Testing the model (alpha)', 'Try each proposition in the model before anyone tries it in use. Run it against doing nothing, under severe but plausible scenarios. Only the ones that hold go on to the trial in the organisation.', [el('b', { text: ps.length ? done + ' of ' + ps.length + ' propositions tried in the model.' : 'No propositions yet.' }), nx ? nextLink('Next: ' + (PR ? PR.label(nx) + ' ' : '') + (nx.n || ''), '[data-aprop="' + nx.id + '"]') : null], 'a'));
    var ms = mState();
    wrap.appendChild(el('p', { class: 'fxmuted', id: 'tFromModel' }, [document.createTextNode(ms.at ? 'From Model, agreed ' + dlong(ms.at) + ': ' : 'From Model (not yet agreed): '), el('i', { text: mBodyFull() }), document.createTextNode(' '), el('a', { href: '/model' + ex + '#mdesign', text: 'Open in Model' })]));
    wrap.appendChild(modelRunPanel('alpha'));
    if (!ps.length) wrap.appendChild(el('div', { class: 'fxcard' }, [el('p', {}, [document.createTextNode('Model has no design propositions yet. '), el('a', { href: '/model' + ex + '#mdesign', text: 'Write them in Model' })])]));
    ps.forEach(function (p) {
      var a = p.alpha || {}, r = alphaOf(p), isNext = nx && nx.id === p.id, card = el('section', { class: 'fxcard fxmcard' + (isNext ? ' now' : ''), 'data-aprop': p.id });
      card.appendChild(el('div', { class: 'fxqhead' }, [r ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring' + (isNext ? ' now' : ''), text: (PR ? PR.label(p) : '').replace(/^P/, '') }), el('h2', { class: 'fxsech', text: (PR ? PR.label(p) + ' ' : '') + (p.n || 'Untitled proposition') }), el('span', { class: 'fxgrow' }),
        el('span', { class: 'fxthree', role: 'group', 'aria-label': 'Result in the model' }, ARES.map(function (o) { return el('button', { type: 'button', class: r === o[0] ? 'on ' + o[2] : '', 'aria-pressed': String(r === o[0]), 'data-ares': p.id, 'data-v': o[0], disabled: ro, text: o[1], onclick: function () { if (r === o[0]) return; saveProp(p.id, function (x) { x.alpha = x.alpha || {}; x.alpha.result = o[0]; x.alpha.by = meName(); x.alpha.at = new Date().toISOString(); x.status = o[0] === 'holds' ? 'ready' : 'tested'; }, 'Testing the model: ' + (PR ? PR.label(p) : '') + ' ' + o[1].toLowerCase()).then(render, function (e) { alert(saveErr(e)); }); } }); }))]));
      card.appendChild(el('div', { class: 'fxcimo' }, [['c', 'In this situation'], ['i', 'this change'], ['m', 'working through'], ['o', 'should produce']].map(function (k) { return p[k[0]] ? el('div', {}, [el('b', { text: k[1] }), el('span', { text: p[k[0]] })]) : null; })));
      var fld = function (k, l, ph) { var t = el('textarea', { rows: 1, 'data-alpha': p.id + '.' + k, disabled: ro, placeholder: ph }); t.value = a[k] || ''; grow(t); t.addEventListener('blur', function () { var v = t.value.trim(); if (v === (a[k] || '')) return; saveProp(p.id, function (x) { x.alpha = x.alpha || {}; x.alpha[k] = v; }, 'Testing the model: ' + l.toLowerCase()).catch(function (e) { alert(saveErr(e)); }); }); return el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: l }), t]); };
      var bas = alphaBasis(p), tsel = el('select', { 'data-atool': p.id, disabled: ro, 'aria-label': 'Tried in which model' }, ATOOL.concat(a.tool && !ATOOL.some(function (o) { return o[0] === a.tool; }) ? [[a.tool, bas.why.replace(/ has not been built yet$/, '')]] : []).map(function (o) { return el('option', { value: o[0], text: o[1] }); })); tsel.value = a.tool || '';
      tsel.addEventListener('change', function () { saveProp(p.id, function (x) { x.alpha = x.alpha || {}; x.alpha.tool = tsel.value; }, 'Testing the model: model used').then(render, function (e) { alert(saveErr(e)); }); });
      var fl = flowFor(p);
      card.appendChild(el('div', { class: 'tbasis' }, [el('label', { class: 'fxql', text: 'Tried in' }), tsel, el('span', { class: 'tbtag ' + bas.k, 'data-basis': bas.k, title: bas.why, text: bas.t }), el('span', { class: 'fxmuted sm', text: bas.k === 'judgement' ? bas.why + '. Read it as the team’s judgement, not a model result.' : '' })]));
      if (fl.length && window.VTTharm) card.appendChild(el('ul', { class: 'trun-list tflow', 'data-flow': p.id }, fl.map(function (x) { return el('li', {}, [window.VTTharm.markIcon(x.reg), el('span', { text: 'In the flow model, ' + x.o.n + ': ' + x.pct + ' per cent of the threshold in the worst scenario (' + window.VTTharm.REG[x.reg][0].toLowerCase() + ').' })]); })));
      card.appendChild(el('div', { class: 'fxqs two' }, [fld('scenario', 'Tried against which scenario?', 'For example: a dangerous result late on a bank holiday Friday'), fld('showed', 'What did the model show, against doing nothing?', 'For example: worst wait fell from 14 hours to 2'), fld('holds', 'It holds when …', 'For example: two doctors are on call')]));
      if (a.by) card.appendChild(byLine({ by: a.by, at: a.at }, el('span', { text: ' · ' + (r === 'holds' ? 'goes on to the trial in the organisation' : r === 'fails' ? 'back to Model to redesign' : 'changed: try it again') })));
      wrap.appendChild(card);
    });
    var IQ = ((window.VTModel && X0inv().interrogate) || {}).items || [], UQ = IQ.filter(function (x) { return x.state !== 'yes' || x.report === 'no' || !String(x.notice || '').trim() || x.ever === 'unknown'; });
    wrap.appendChild(el('section', { class: 'fxcard', id: 'tUnchecked', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Unchecked conditions, from Model' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '/model' + ex + '#interrogate', text: 'Open the questions' })]),
      el('p', { class: 'fxmuted', text: 'Parts of the map whose real state nobody can confirm, or whose failure nobody would notice or report. Check them before relying on any change that rests on them.' }),
      UQ.length ? el('ul', { class: 'fxfindlist' }, UQ.map(function (x) { return el('li', { text: (x.n || (X0inv().processes || []).filter(function (p2) { return p2.id === x.proc; }).map(function (p2) { return p2.n; })[0] || 'A part of the map') + (x.how ? ': ' + x.how : '') }); })) : el('p', { class: 'fxmuted', text: IQ.length ? 'None: every part questioned has been checked.' : 'The parts of the map have not been questioned yet, in Model, How it fails.' })]));
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'Tests of disruption, in the model' }));
    wrap.appendChild(el('p', { class: 'fxsub', text: 'Can the organisation run as a minimum viable company? And the traditional tools, each judged against the threshold set in Frame.' }));
    wrap.appendChild(toolRows(['mvc', 'bia', 'bcp', 'dr', 'risk'].map(function (k) { return P.tools[k]; }).filter(Boolean), null));
    var tl = ['scentest'].map(function (k) { return P.tools[k]; }).filter(Boolean).concat(MCAT.filter(function (m) { return m.id === 'tharm' || m.id === 'abm'; }).map(function (m) { return { id: m.id, n: 'Run the ' + m.n.replace(/^The /, '').toLowerCase(), by: 'Built in Model', does: 'Run the model with the change, and without it.', used: toolBuilt(m.id), href: '/model' + ex + m.href }; }));
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'Running the changes in the model' }));
    wrap.appendChild(toolRows(tl, null));
    wrap.appendChild(fxFoot(['4 Test', '#thome'], ['Next: 4.2 Disruption and plans', '#tplans'], 'A proposition marked Holds goes on to the trial in the organisation.'));
  }
  // part 2: The beta test, each proposition as a small experiment
  function renderTBeta() {
    var P = tParts(), PR = window.VTProps;
    var wrap = el('div', { class: 'fx', id: 'fxTBeta' }); main.appendChild(wrap);
    var stg = function (p) { return expStage(expOf(p.id)); };
    var decided = P.held.filter(function (p) { return stg(p) === 'done'; }).length, nx = P.held.filter(function (p) { return stg(p) !== 'done'; })[0];
    var nextWord = { design: 'agree the design', run: 'add a reading', read: 'decide', stopped: 'read the result', done: '' };
    wrap.appendChild(tPath('tbeta', decided + ' of ' + P.held.length + ' decided'));
    wrap.appendChild(tTitle('Trial in the organisation (beta)', 'Each proposition that held in the model is tried in use as a small experiment: what we expect, where and for how long, what we compare it with, what we measure, and what counts as success, all decided in advance. Then the readings, the result, and the decision.', [el('b', { text: decided + ' of ' + P.held.length + ' experiments decided.' }), nx ? nextLink('Next: ' + (PR ? PR.label(nx) + ' ' : '') + 'to ' + nextWord[stg(nx)], '[data-bprop="' + nx.id + '"]') : null], 'b'));
    if (!P.held.length) wrap.appendChild(el('div', { class: 'fxcard' }, [el('p', {}, [document.createTextNode('No proposition has held in the model yet. '), el('a', { href: '#talpha', text: 'Go to Testing the model (alpha)' })])]));
    P.held.forEach(function (p) {
      var x = expOf(p.id), d = x.design || {}, st = stg(p), isNext = nx && nx.id === p.id, rs = x.readings || [], last = rs[rs.length - 1], res = x.result || {};
      var steps = el('ol', { class: 'fxexsteps small' }, ['design', 'run', 'read', 'done'].map(function (k, i) { var order = ['design', 'run', 'read', 'done'], cur = order.indexOf(st === 'stopped' ? 'read' : st); return el('li', { class: i < cur ? 'done' : i === cur ? 'here' : '' }, [el('span', { text: ['Before', 'During', 'After', 'Decision'][i] })]); }));
      var RES2 = { yes: 'Met', partly: 'Partly met', no: 'Not met' };
      wrap.appendChild(el('section', { class: 'fxcard fxmcard' + (isNext ? ' now' : ''), 'data-bprop': p.id }, [
        el('div', { class: 'fxqhead' }, [st === 'done' ? el('span', { class: 'fxtick', text: '✓' }) : el('span', { class: 'fxring' + (isNext ? ' now' : ''), text: (PR ? PR.label(p) : '').replace(/^P/, '') }), el('h2', { class: 'fxsech', text: (PR ? PR.label(p) + ' ' : '') + (p.n || '') }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag ' + (st === 'done' ? 'ok' : isNext ? 'now' : ''), text: STAGE[st] + (x.round > 1 ? ', round ' + x.round : '') }), el('a', { class: 'btn sm' + (isNext ? ' fxmain' : ''), href: '#exp=' + p.id, 'data-openexp': p.id, text: st === 'design' && !d.where ? 'Design the experiment' : 'Open the experiment' })]),
        steps,
        el('div', { class: 'fxexsum' }, [
          el('div', {}, [el('b', { text: 'We expect' }), el('span', { text: cutT(d.expect || expectOf(p) || 'Not written yet', 200) })]),
          el('div', {}, [el('b', { text: 'Success' }), el('span', { text: d.success ? cutT(d.success, 140) : 'Not decided yet' })]),
          el('div', {}, [el('b', { text: 'So far' }), el('span', { text: res.success ? RES2[res.success] + (res.mechanism ? '; mechanism ' + ({ yes: 'as expected', partly: 'partly as expected', no: 'not as expected' })[res.mechanism] : '') : rs.length ? rs.length + (rs.length === 1 ? ' reading' : ' readings') + (last && last.value !== '' ? ', latest ' + last.value + (d.unit ? ' ' + d.unit : '') : '') + (rs.some(function (r) { return r.line === 'crossed'; }) ? '; the threshold was crossed' : '') : 'No readings yet' })])])]));
    });
    var tl = ['plans', 'exlog'].map(function (k) { return P.tools[k]; }).filter(Boolean);
    if (tl.length) { wrap.appendChild(el('h2', { class: 'fxh2', text: 'Plans and exercises' })); wrap.appendChild(el('p', { class: 'fxsub', text: 'The organisation’s own plans, and every exercise and real use of them, read against the change.' })); wrap.appendChild(toolRows(tl, null)); }
    wrap.appendChild(el('p', { class: 'fxmuted', style: 'margin-top:14px' }, [document.createTextNode('The people trying the changes report at the Lab’s Try page, with the project code. '), el('a', { href: '#beta', text: 'Their reports, and what each person sees' })]));
    wrap.appendChild(fxFoot(['4.2 Disruption and plans', '#tplans'], ['Next: 4.4 Outcomes', '#tout'], ''));
  }
  // part 3: Outcomes
  function renderTOut() {
    var P = tParts(), ro = !!S.readonly, c = tRow(), out = c.out || {}, T = P.tally, ex = EXAMPLE ? location.search : '';
    var wrap = el('div', { class: 'fx', id: 'fxTOut' }); main.appendChild(wrap);
    var done = P.out.filter(function (m) { return m[0]; }).length;
    wrap.appendChild(tPath('tout', done + ' of 4'));
    wrap.appendChild(tTitle('Outcomes', 'What the change leaves behind: for the people the service is for, and for the organisation. Then say, in one sentence, what we keep, change and stop.', [el('b', { id: 'tStatusTxt', text: done + ' of 4 done.' })], 'o'));
    // for the stakeholders
    var G = [['gains', 'Who gains', fv('value', 'gains')], ['exposed', 'Who is hurt if it fails', fv('exposure', 'exposed')], ['absent', 'Who is affected but not asked', fv('exposure', 'absent')]];
    var sh = el('section', { class: 'fxcard', id: 'tStake' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'For the stakeholders' }), el('span', { class: 'fxgrow' }), el('a', { class: 'btn sm', href: '/diagnose' + ex + '#dependants', text: 'Dependants, profiled' })]), el('p', { class: 'fxmuted', text: 'The groups named in Frame. For each, what changed for them in use, compared with before, from the reports of the trial in the organisation.' })]);
    var qs = el('div', { class: 'fxqs' });
    G.forEach(function (g) {
      var t = el('textarea', { rows: 2, 'data-out': g[0], disabled: ro, placeholder: 'What changed for them in use?' }); t.value = out[g[0]] || ''; grow(t);
      t.addEventListener('blur', function () { var v = t.value.trim(); if (v === (out[g[0]] || '')) return; saveTestStep(function (cc) { cc.out = cc.out || {}; cc.out[g[0]] = v; cc.who = cc.who || {}; cc.who[g[0]] = { by: meName(), at: new Date().toISOString() }; }, 'Outcomes: ' + g[1].toLowerCase()).then(function () { out[g[0]] = v; }, function (e) { alert(saveErr(e)); }); });
      qs.appendChild(el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: g[1] }), el('p', { class: 'fxeg' }, [el('span', { text: 'In Frame: ' }), el('i', { text: g[2] || 'not said' })]), t]));
    });
    sh.appendChild(qs);
    var choice = function (k, label, opts, frameText) { var cur = c[k] || ''; return el('div', { class: 'fxq', 'data-check': k }, [el('span', { class: 'fxql', text: label }), el('p', { class: 'fxeg' }, [el('span', { text: 'From Frame: ' }), el('i', { text: frameText || 'not said' })]), el('span', { class: 'fxthree', role: 'group', 'aria-label': label }, opts.map(function (o) { return el('button', { type: 'button', class: cur === o[0] ? 'on ' + o[2] : '', 'aria-pressed': String(cur === o[0]), 'data-v': o[0], disabled: ro, text: o[1], onclick: function () { saveTestStep(function (cc) { cc[k] = o[0]; }, 'Outcomes: ' + label.toLowerCase().replace(/\?$/, '') + ': ' + o[1].toLowerCase()).then(render, function (e) { alert(saveErr(e)); }); } }); }))]); };
    var EX = P.held.map(function (p) { return expOf(p.id); }).filter(function (x) { return x.locked || x.result || (x.readings || []).length; });
    if (EX.length) { var cnt = function (f) { return EX.filter(f).length; }; sh.appendChild(el('p', { class: 'fxexfrom', id: 'tFromExp' }, [el('b', { text: 'From the experiments: ' }), document.createTextNode(EX.length + (EX.length === 1 ? ' experiment' : ' experiments') + '; success met in ' + cnt(function (x) { return x.result && x.result.success === 'yes'; }) + ', partly in ' + cnt(function (x) { return x.result && x.result.success === 'partly'; }) + ', not met in ' + cnt(function (x) { return x.result && x.result.success === 'no'; }) + '; the threshold was crossed in ' + cnt(function (x) { return (x.readings || []).some(function (r) { return r.line === 'crossed'; }); }) + '. Confirm below.')])); }
    sh.appendChild(el('div', { class: 'fxqs two', style: 'margin-top:16px' }, [choice('measure', 'Did the measure that matters most improve?', [['yes', 'Yes', 'y'], ['unsure', 'Can’t say', 'n'], ['no', 'No', 'x']], fv('good', 'primary')), choice('line', 'Was the threshold ever crossed?', [['held', 'No, it held', 'y'], ['unsure', 'Can’t say', 'n'], ['crossed', 'Yes', 'x']], fv('gap', 'mustnot'))]));
    if (T.n) sh.appendChild(el('p', { class: 'fxmuted', style: 'margin:12px 0 0', text: 'From ' + T.n + ' reports from the trial in the organisation (beta): ' + T.value + ' say what it delivered; harm within tolerance in ' + T.within + ', beyond it in ' + T.crossed + '.' }));
    wrap.appendChild(sh);
    // for the organisation
    var PACEN = [['purpose', 'Purpose'], ['awareness', 'Awareness'], ['coordination', 'Coordination'], ['engagement', 'Engagement']];
    var org = el('section', { class: 'fxcard', id: 'tPace', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'For the organisation' }), el('span', { class: 'fxgrow' })]), el('p', { class: 'fxmuted', text: 'Is the organisation better able to keep the service viable? Purpose, Awareness, Coordination and Engagement, before and after, and what keeps the change in place.' })]);
    org.appendChild(el('div', { class: 'fxpace' }, PACEN.map(function (k) { var t = (T.pace || {})[k[0]] || { better: 0, same: 0, worse: 0 }; return el('div', { class: 'fxpacecell', 'data-pace': k[0] }, [el('b', { text: k[1] }), el('span', { text: T.n ? t.better + ' better · ' + t.same + ' no change · ' + t.worse + ' worse' : 'No reports yet' })]); })));
    var tl = ['pace', 'steer', 'forcefield'].map(function (k) { return P.tools[k]; }).filter(Boolean);
    org.appendChild(toolRows(tl, null));
    wrap.appendChild(org);
    // supporting evidence
    var sup = ['selfassess'].map(function (k) { return P.tools[k]; }).filter(Boolean);
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'The evidence' }));
    wrap.appendChild(el('div', { class: 'fxlinks' }, [dLink('#evidence', 'The evidence matrix', 'How far each proposition has climbed, from proposed to proven in operation', null)].concat(sup.map(function (t) { return dLink(t.href, t.n, t.by, t.used ? ['In use', 'ok'] : null); }))));
    // the sentence
    var sent = el('p', { class: 'fxsentence', id: 'tSentence' }), pill = el('span', { class: 'fxtag' }), note = el('span', { class: 'fxmuted' });
    var agree = ro ? null : el('button', { class: 'btn fxmain', type: 'button', id: 'tAgree' });
    var paint = function () {
      sent.innerHTML = '';
      TSENT.forEach(function (p) {
        sent.appendChild(document.createTextNode(p[1]));
        if (!p[0]) return;
        var k = p[0], v = tv(k);
        if (FX.edit === 't-' + k && !ro) {
          var inp = el('input', { type: 'text', 'data-field': 'teststep.' + k, value: v, placeholder: 'For example: ' + p[3], 'aria-label': p[2] });
          var doneF = async function () { var nv = inp.value.trim(); FX.edit = null; try { if (nv !== tv(k)) await saveTestStep(function (cc) { cc.sentence = cc.sentence || {}; cc.sentence[k] = nv; }, 'Changed the outcome sentence'); } catch (e) { note.textContent = saveErr(e); } paint(); };
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doneF(); } if (e.key === 'Escape') { FX.edit = null; paint(); } });
          sent.appendChild(el('span', { class: 'fxinline' }, [inp, el('button', { class: 'btn sm fxmain', type: 'button', 'data-done': k, text: 'Done', onmousedown: function (e) { e.preventDefault(); }, onclick: doneF })]));
          setTimeout(function () { inp.focus(); }, 0);
        } else if (v) sent.appendChild(el('button', { class: 'fxfill fxeditable', type: 'button', 'data-blank': k, text: v, disabled: ro, onclick: function () { FX.edit = 't-' + k; paint(); } }));
        else sent.appendChild(el('button', { class: 'fxblank', type: 'button', 'data-blank': k, text: p[2] + ' ✎', disabled: ro, onclick: function () { FX.edit = 't-' + k; paint(); } }));
      });
      var s2 = tState(), n = TSENT.filter(function (p) { return p[0] && !tv(p[0]); }).length;
      pill.className = 'fxtag ' + (s2.at && !s2.changed ? 'ok' : ''); pill.textContent = s2.at ? (s2.changed ? 'Changed since agreed' : 'Agreed ' + dshort(s2.at)) : 'Draft';
      if (agree) { agree.disabled = !!n || !!(s2.at && !s2.changed); agree.textContent = s2.at ? (s2.changed ? 'Agree it again' : 'Agreed') : 'Agree the outcome'; }
      note.textContent = n ? 'Fill the ' + (n === 1 ? 'last blank' : n + ' blanks') + ' to agree it.' : s2.at && !s2.changed ? 'Agreed by ' + String(s2.by || '').replace(/ \(master\)$/, '') + '.' : '';
    };
    if (agree) agree.addEventListener('click', async function () { var now = new Date().toISOString(), txt = 'Agreed on ' + dlong(now) + '. ' + tBodyFull(); try { await saveTestStep(function (cc) { var past = cc.agreed && cc.agreed.at ? [cc.agreed].concat(cc.agreed.past || []).map(function (x) { return { at: x.at, text: x.text, by: x.by }; }).slice(0, 10) : []; cc.agreed = { at: now, text: txt, by: meName(), past: past }; }, 'The outcome agreed'); render(); } catch (e) { note.textContent = saveErr(e); } });
    wrap.appendChild(el('h2', { class: 'fxh2', text: 'What we keep, change and stop' }));
    wrap.appendChild(el('div', { class: 'fxcard fxhero', id: 'tStatement' }, [el('div', { class: 'fxqhead' }, [el('span', { class: 'fxql', text: 'The outcome, in one sentence' }), el('span', { class: 'fxgrow' }), pill]), sent, el('div', { class: 'fxagree' }, [note, el('span', { class: 'fxgrow' }), agree])]));
    paint();
    wrap.appendChild(fxFoot(['4.3 Trial in the organisation (beta)', '#tbeta'], ['Back to the project home', '/home' + ex], 'Anything sent back goes to Model, Diagnose or Frame, and the loop starts again from there.'));
  }
  // the Test Canvas
  function renderTCanvas() {
    var P = tParts(), blank = !!FX.blankCanvas, f = (frameAns().question || {}).fields || {}, ts = tState(), PR = window.VTProps, c = tRow(), out = c.out || {}, T = P.tally;
    var cut = function (t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };
    var none = function () { return el('span', { class: 'fce', text: blank ? '' : 'Nothing recorded yet' }); };
    var RES = { trying: 'Trying in use', proven: 'Proven in use', sentback: 'Sent back' }, AR = { holds: 'Holds', fails: 'Fails', changed: 'Changed' };
    var rows = blank ? [1, 2, 3, 4] : P.props.slice(0, 6);
    var pt = el('table', { class: 'fctab' }, [el('thead', {}, [el('tr', {}, ['Proposition', '1 Testing the model (alpha)', '2 Trial in the organisation (beta)', 'Verdict'].map(function (h) { return el('th', { text: h }); }))]),
      el('tbody', {}, rows.length ? rows.map(function (p) { if (blank) return el('tr', {}, [el('td', { text: 'P' + p }), el('td'), el('td'), el('td')]); var a = p.alpha || {}, b = P.beta.filter(function (y) { return y.id === p.id; })[0]; return el('tr', {}, [el('td', {}, [el('b', { text: (PR ? PR.label(p) + ' ' : '') }), document.createTextNode(cut(p.n, 60))]), el('td', { text: (AR[alphaOf(p)] || 'Not tried') + (a.showed ? ': ' + cut(a.showed, 90) : '') }), el('td', { text: (function () { var xx = expOf(p.id), dd = xx.design || {}, rr = xx.result || {}; if (dd.success || rr.success) return 'Expected: ' + cut(dd.success || '', 70) + (rr.success ? '. Result: ' + ({ yes: 'met', partly: 'partly met', no: 'not met' })[rr.success] + (function () { var nums = (xx.readings || []).map(function (q) { return Number(q.value); }).filter(function (v) { return !isNaN(v); }); return nums.length && dd.baseNum !== '' && dd.baseNum != null ? ' (' + dd.baseNum + ' before, ' + nums[nums.length - 1] + ' at the end' + (dd.unit ? ', ' + dd.unit : '') + ')' : ''; })() : xx.readings && xx.readings.length ? '. ' + xx.readings.length + ' readings so far' : ''); return b ? (b.reports + (b.reports === 1 ? ' report' : ' reports')) + (b.learnt ? ': ' + cut(b.learnt, 90) : '') : alphaOf(p) === 'holds' ? 'Not yet tried in use' : ''; })() }), el('td', { text: (function () { var dx = (expOf(p.id).decision || {}).d; if (dx) return { proven: 'Proven in use', extend: 'Extended', sentback: 'Sent back' }[dx]; return b ? RES[b.result] || '' : alphaOf(p) === 'fails' ? 'Back to Model' : ''; })() })]); }) : [el('tr', {}, [el('td', { colspan: '4' }, [none()])])])]);
    var item = function (label, t, n) { return el('div', { class: 'fci' }, [el('b', { text: label }), el('div', {}, [blank || !t ? none() : document.createTextNode(cut(t, n || 140))])]); };
    var CH = { yes: 'Yes', no: 'No', unsure: 'Can’t say', held: 'Held', crossed: 'Crossed' };
    var PACEN = [['purpose', 'Purpose'], ['awareness', 'Awareness'], ['coordination', 'Coordination'], ['engagement', 'Engagement']];
    var canvas = el('article', { class: 'fcanvas tcanvas' + (blank ? ' blank' : ''), id: 'tcCanvas', 'aria-label': 'Test Canvas' }, [
      el('div', { class: 'fchead' }, [
        el('div', { class: 'fctitle' }, [el('div', { class: 'fcbrand', text: 'Test Canvas' }), el('div', { class: 'fcmeta', text: S.data.session.name || '' }), el('div', { class: 'fcmeta', text: blank ? 'Date:' : dlong(new Date().toISOString()) + ' · ' + (ts.at && !ts.changed ? 'Agreed ' + dlong(ts.at) : 'Draft') })]),
        el('div', { class: 'fcq' }, [el('span', { class: 'fcql', text: 'The question' }), el('div', { class: 'fcqt' }, [blank ? el('span') : document.createTextNode(cut(f.question || '', 200))]), !blank ? el('div', { class: 'fcqs', text: 'From Model: ' + cut(mBodyFull(), 230) }) : null]),
        el('div', { class: 'fcwho' }, [item('The measure: did it improve?', blank ? '' : (fv('good', 'primary') ? cut(fv('good', 'primary'), 60) + ': ' : '') + (CH[c.measure] || 'not checked'), 100), item('The threshold: was it crossed?', blank ? '' : (CH[c.line] || 'not checked'), 90)])]),
      el('div', { class: 'fcgrid tgrid' }, [
        el('section', { class: 'fcc t1' }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn wide', text: '1, 2' }), el('h3', { text: 'Each proposition, tried twice' })]), el('p', { class: 'fcp', text: 'First in the model, against doing nothing; then in use, by the people who run the service' }), pt]),
        el('section', { class: 'fcc t2' }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn', text: '3' }), el('h3', { text: 'For the stakeholders' })]), el('p', { class: 'fcp', text: 'What changed for each group named in Frame' }), item('Who gains', out.gains, 150), item('Who is hurt if it fails', out.exposed, 150), item('Affected but not asked', out.absent, 130)]),
        el('section', { class: 'fcc t3' }, [el('div', { class: 'fchd' }, [el('span', { class: 'fcn', text: '3' }), el('h3', { text: 'For the organisation' })]), el('p', { class: 'fcp', text: 'Purpose, Awareness, Coordination and Engagement: better, no change or worse' }), blank ? el('div', {}, PACEN.map(function (k) { return el('div', { class: 'fci' }, [el('b', { text: k[1] })]); })) : el('ul', { class: 'fcas' }, PACEN.map(function (k) { var t = (T.pace || {})[k[0]] || {}; return el('li', {}, [el('span', { class: 'fcmark', text: k[1] }), document.createTextNode(T.n ? (t.better || 0) + ' better, ' + (t.same || 0) + ' no change, ' + (t.worse || 0) + ' worse' : 'no reports yet')]); }))])]),
      el('div', { class: 'fcfoot' }, [el('span', { class: 'fcql', text: 'The outcome' }), el('span', { class: 'fcst' }, [blank ? el('span', { class: 'fce', text: 'For … the change has … It leaves the organisation stronger in … and weaker in … We will keep … change … and stop …' }) : document.createTextNode(cut(tBodyFull(), 420))]), el('span', { class: 'fcsrc', text: 'Viability Thinking Lab · Test' })])]);
    var bar = el('div', { class: 'fx fcbar no-print' }, [el('a', { class: 'btn sm', href: '#thome', text: '‹ Back to Test' }), el('span', { class: 'fxgrow' }),
      el('label', { class: 'fxcheckrow', style: 'font-size:14px;padding:0;margin-right:6px' }, [el('input', { type: 'checkbox', id: 'tcBlank', checked: blank, onchange: function (e) { FX.blankCanvas = e.target.checked; render(); } }), el('span', { text: 'Blank, for a workshop' })]),
      el('button', { class: 'btn sm', type: 'button', text: 'Save as PDF', title: 'Choose “Save as PDF” in the print window', onclick: function () { window.print(); } }), el('button', { class: 'btn sm fxmain', type: 'button', id: 'tcPrint', text: 'Print', onclick: function () { window.print(); } })]);
    main.appendChild(el('div', { class: 'fcwrap' }, [bar, el('p', { class: 'fx fxmuted no-print', style: 'margin:0 0 12px', text: 'One A4 page, landscape, in black and grey. Long entries are shortened to fit.' }), el('div', { class: 'fcscroll' }, [canvas])]));
  }

  // ---------- the beta test as a small experiment (31 October 2026) ----------
  // One card per proposition that held in the model: Before (the design, agreed and locked), During (readings each
  // period, with the service's reports), After (the result against what we expected), and the decision.
  // Saved in the 'teststep' tile under exp[propId]: { design: {...}, locked: { at, by }, past: [designs],
  //   readings: [{ period, value, mech, line, unexpected, by, at }], stopped: { at, by, why },
  //   result: { success, mechanism, model, surprised, by, at }, decision: { d, to, at, by } }
  var COMPARE = [['before', 'Before and after', 'The same place, measured before the change and during it'], ['side', 'Side by side', 'A similar place that does not change, measured over the same period'], ['onoff', 'Switched on and off', 'The change runs in some periods and not in others, in the same place']];
  var STAGE = { design: 'Designing', run: 'Running', read: 'Reading the result', done: 'Decided', stopped: 'Stopped early' };
  function expOf(pid) { return ((tRow().exp || {})[pid]) || {}; }
  function expStage(x) { if (x.decision && x.decision.d && x.decision.d !== 'extend') return 'done'; if (x.stopped && x.stopped.at && !(x.result && x.result.success)) return 'stopped'; if (x.result && x.result.success) return 'read'; if (x.locked && x.locked.at) return 'run'; return 'design'; }
  async function saveExp(pid, fn, summary) { await saveTestStep(function (c) { c.exp = c.exp || {}; c.exp[pid] = c.exp[pid] || {}; fn(c.exp[pid], c); }, summary); }
  function expectOf(p) { var b = []; if (p.c) b.push('in ' + p.c.replace(/^in\s+/i, '')); if (p.i || p.n) b.push((p.i || p.n).replace(/\.$/, '')); if (p.m) b.push('working through ' + p.m.replace(/^working through\s+/i, '').replace(/\.$/, '')); var s = b.join(', '); return s ? 'We expect that, ' + s + (p.o ? ', it will ' + p.o.replace(/^(it )?(will |should )?/i, '').replace(/\.$/, '') : '') + '.' : ''; }
  function expChart(x) {
    var d = x.design || {}, rs = (x.readings || []).filter(function (r) { return r.value !== '' && r.value != null && !isNaN(Number(r.value)); }), base = Number(d.baseNum), thr = Number(d.thrNum);
    var vals = rs.map(function (r) { return Number(r.value); }).concat(isNaN(base) || d.baseNum === '' || d.baseNum == null ? [] : [base]).concat(isNaN(thr) || d.thrNum === '' || d.thrNum == null ? [] : [thr]);
    if (!vals.length) return null;
    var W = 640, H = 200, L = 46, R = 16, T = 14, B = 30, mx = Math.max.apply(null, vals), mn = Math.min(0, Math.min.apply(null, vals)); if (mx === mn) mx = mn + 1; mx += (mx - mn) * 0.1;
    var y = function (v) { return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); }, n = Math.max(rs.length, 1), xx = function (i) { return L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)); };
    var s = '<svg class="fxchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Readings against the starting level and the success threshold"><line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" class="fxax"/>';
    [mn, (mn + mx) / 2, mx].forEach(function (v) { s += '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="fxcl">' + Math.round(v * 10) / 10 + '</text>'; });
    if (d.baseNum !== '' && d.baseNum != null && !isNaN(base)) s += '<line x1="' + L + '" y1="' + y(base) + '" x2="' + (W - R) + '" y2="' + y(base) + '" class="fxbase"/><text x="' + (W - R) + '" y="' + (y(base) - 5) + '" text-anchor="end" class="fxcl">Before: ' + base + '</text>';
    if (d.thrNum !== '' && d.thrNum != null && !isNaN(thr)) s += '<line x1="' + L + '" y1="' + y(thr) + '" x2="' + (W - R) + '" y2="' + y(thr) + '" class="fxthr"/><text x="' + (L + 4) + '" y="' + (y(thr) - 5) + '" class="fxcl">Success: ' + (d.dir === 'higher' ? 'at or above ' : 'at or below ') + thr + '</text>';
    if (rs.length) { s += '<polyline class="fxrun" points="' + rs.map(function (r, i) { return xx(i) + ',' + y(Number(r.value)); }).join(' ') + '"/>'; rs.forEach(function (r, i) { s += '<circle cx="' + xx(i) + '" cy="' + y(Number(r.value)) + '" r="4.5" class="fxpt' + (r.line === 'crossed' ? ' bad' : '') + '"/><text x="' + xx(i) + '" y="' + (H - 10) + '" text-anchor="' + (n > 1 && i === n - 1 ? 'end' : n > 1 && i === 0 ? 'start' : 'middle') + '" class="fxcl">' + esc(String(r.period || i + 1)).slice(0, 14) + '</text>'; }); }
    return el('div', { class: 'fxchartbox', html: s + '</svg>' });
  }
  function renderTExp(pid) {
    var ps = mProps(), p = ps.filter(function (x) { return x.id === pid; })[0], ro = !!S.readonly, PR = window.VTProps, B = window.VTBeta;
    var wrap = el('div', { class: 'fx', id: 'fxExp' }); main.appendChild(wrap);
    if (!p) { wrap.appendChild(el('p', {}, [document.createTextNode('That proposition was not found. '), el('a', { href: '#tbeta', text: 'Back to Trial in the organisation (beta)' })])); return; }
    var x = expOf(pid), d = Object.assign({}, x.design || {}), st = expStage(x), locked = !!(x.locked && x.locked.at), lab = (PR ? PR.label(p) + ' ' : '') + (p.n || '');
    if (!d.expect) d.expect = expectOf(p); if (!d.measure) d.measure = fv('good', 'primary'); if (!d.line) d.line = lineText(); if (!d.compare) d.compare = 'before';
    wrap.appendChild(tPath('tbeta', STAGE[st].toLowerCase()));
    wrap.appendChild(tTitle('The experiment: ' + lab, 'A small experiment, set out in advance: what we expect, how we will know, and when we would stop. Then the readings, the result against the expectation, and the decision.', [el('span', { class: 'fxtag ' + (st === 'done' ? 'ok' : 'now'), text: STAGE[st] }), el('a', { class: 'fxnext', href: '#tbeta', text: '‹ All the experiments' })], 'b'));
    var stepNav = el('ol', { class: 'fxexsteps' }, [['design', '1 Before: the design'], ['run', '2 During: the readings'], ['read', '3 After: the result'], ['done', '4 The decision']].map(function (k, i) { var order = ['design', 'run', 'read', 'done'], cur = order.indexOf(st === 'stopped' ? 'read' : st); return el('li', { class: i < cur ? 'done' : i === cur ? 'here' : '' }, [el('span', { text: k[1] })]); }));
    wrap.appendChild(stepNav);
    // 1 Before: the design
    var dsec = el('section', { class: 'fxcard fxmcard' + (st === 'design' ? ' now' : ''), id: 'exDesign' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: '1 Before: the design' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag ' + (locked ? 'ok' : 'now'), text: locked ? 'Agreed ' + dshort(x.locked.at) + ' and locked' : 'Not agreed yet' })]), el('p', { class: 'fxmuted', text: 'Agree this before anything is tried, so the result is judged against what we said we expected, not a moved target.' })]);
    var dis = ro || locked;
    var dfld = function (k, l, ph, eg, rows) { var t = el('textarea', { rows: rows || 1, 'data-exd': k, disabled: dis, placeholder: ph || '' }); t.value = d[k] || ''; grow(t); t.addEventListener('blur', function () { var v = t.value.trim(); if (v === ((x.design || {})[k] || '')) return; saveExp(pid, function (e) { e.design = Object.assign({}, d, e.design || {}); e.design[k] = v; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': ' + l.toLowerCase()).catch(function (er) { alert(saveErr(er)); }); }); return el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: l }), eg ? el('p', { class: 'fxeg' }, [el('span', { text: 'For example: ' }), el('i', { text: eg })]) : null, t]); };
    var nfld = function (k, l, ph) { var t = el('input', { type: 'text', inputmode: 'decimal', 'data-exd': k, disabled: dis, placeholder: ph || '', value: d[k] || '' }); t.addEventListener('blur', function () { var v = t.value.trim(); if (v === ((x.design || {})[k] || '')) return; saveExp(pid, function (e) { e.design = Object.assign({}, d, e.design || {}); e.design[k] = v; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': ' + l.toLowerCase()).catch(function (er) { alert(saveErr(er)); }); }); return el('div', { class: 'fxq fxnum' }, [el('label', { class: 'fxql', text: l }), t]); };
    dsec.appendChild(el('div', { class: 'fxqs' }, [dfld('expect', 'What we expect', '', null, 2)]));
    dsec.appendChild(el('div', { class: 'fxqs two' }, [dfld('where', 'Where, and who leads it', 'Which wards, teams or sites; the named lead', 'two medical wards; the weekend registrar leads'), dfld('period', 'For how long', 'How long, and in what periods', 'six weekends, read each Monday')]));
    // how we compare
    var cmp = el('div', { class: 'fxq', 'data-exd': 'compare' }, [el('span', { class: 'fxql', text: 'What we compare it with' }), el('div', { class: 'fxcmp' }, COMPARE.map(function (o) { var r = el('input', { type: 'radio', name: 'cmp-' + pid, value: o[0], disabled: dis, 'data-cmp': o[0] }); r.checked = d.compare === o[0]; r.addEventListener('change', function () { saveExp(pid, function (e) { e.design = Object.assign({}, d, e.design || {}); e.design.compare = o[0]; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': compared ' + o[1].toLowerCase()).then(render, function (er) { alert(saveErr(er)); }); }); return el('label', { class: 'fxchoice' + (d.compare === o[0] ? ' on' : '') }, [r, el('span', {}, [el('b', { text: o[1] }), el('span', { text: o[2] })])]); }))]);
    dsec.appendChild(cmp);
    if (d.compare !== 'before') dsec.appendChild(el('div', { class: 'fxqs' }, [dfld('against', d.compare === 'side' ? 'The place we compare with' : 'Which periods have the change, and which do not', d.compare === 'side' ? 'A similar place that does not change' : 'For example: alternate weekends', null)]));
    dsec.appendChild(el('h3', { class: 'fxsub3', text: 'What we measure' }));
    dsec.appendChild(el('div', { class: 'fxqs two' }, [dfld('measure', 'The main measure', 'From Frame: the measure that matters most', null), el('div', { class: 'fxqs two inner' }, [nfld('baseNum', 'Starting level, before', 'a number'), nfld('unit', 'In', 'for example: hours')])]));
    dsec.appendChild(el('div', { class: 'fxqs two' }, [dfld('mech', 'Signs the mechanism is working', 'What we should see if it works for the reason we think', 'the doctor knows within ten minutes that the result is theirs'), dfld('line', 'The threshold that must not be crossed', 'From Frame', null)]));
    dsec.appendChild(el('h3', { class: 'fxsub3', text: 'Decided in advance' }));
    var dirSel = el('select', { 'data-exd': 'dir', disabled: dis }, [['lower', 'Lower is better'], ['higher', 'Higher is better']].map(function (o) { var op = el('option', { value: o[0], text: o[1] }); if ((d.dir || 'lower') === o[0]) op.selected = true; return op; }));
    dirSel.addEventListener('change', function () { saveExp(pid, function (e) { e.design = Object.assign({}, d, e.design || {}); e.design.dir = dirSel.value; }, 'Experiment: direction').catch(function () {}); });
    dsec.appendChild(el('div', { class: 'fxqs two' }, [dfld('success', 'What counts as success', 'In words, decided now', 'the wait falls below two hours in at least five of six weekends'), el('div', { class: 'fxqs two inner' }, [nfld('thrNum', 'Success threshold', 'a number'), el('div', { class: 'fxq fxnum' }, [el('label', { class: 'fxql', text: 'Direction' }), dirSel])])]));
    dsec.appendChild(el('div', { class: 'fxqs' }, [dfld('stop', 'When we stop early', 'Besides the threshold being crossed', 'any patient harmed by a delayed result; the lead asks to stop')]));
    if (!ro) {
      var need = ['expect', 'where', 'period', 'measure', 'success'].filter(function (k) { return !String(((x.design || {})[k]) || (k === 'expect' || k === 'measure' ? d[k] : '') || '').trim(); });
      var msg = el('span', { class: 'fxmuted' });
      if (!locked) dsec.appendChild(el('div', { class: 'fxagree' }, [el('span', { class: 'fxmuted', text: need.length ? 'To fill before agreeing: ' + need.map(function (k) { return { expect: 'what we expect', where: 'where', period: 'how long', measure: 'the main measure', success: 'what counts as success' }[k]; }).join(', ') + '.' : 'Ready to agree. Once agreed, the design is locked.' }), msg, el('span', { class: 'fxgrow' }), el('button', { class: 'btn fxmain', type: 'button', id: 'exAgree', text: 'Agree the design and start', onclick: function () { var cd = Object.assign({}, d, expOf(pid).design || {}), miss = ['where', 'period', 'success'].filter(function (k) { return !String(cd[k] || '').trim(); }).concat(['expect', 'measure'].filter(function (k) { return !String(cd[k] || '').trim(); })); if (miss.length) { msg.textContent = 'Fill these first: ' + miss.map(function (k) { return { expect: 'what we expect', where: 'where', period: 'how long', measure: 'the main measure', success: 'what counts as success' }[k]; }).join(', ') + '.'; return; } saveExp(pid, function (e) { e.design = Object.assign({}, d, e.design || {}); e.locked = { at: new Date().toISOString(), by: meName() }; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': design agreed').then(render, function (er) { msg.textContent = saveErr(er); }); } })]));
      else if (st !== 'done') dsec.appendChild(el('div', { class: 'fxagree' }, [el('span', { class: 'fxmuted', text: 'Agreed by ' + String(x.locked.by || '').replace(/ \(master\)$/, '') + '. Changing it now keeps this version in the history.' }), el('span', { class: 'fxgrow' }), el('button', { class: 'btn sm', type: 'button', id: 'exUnlock', text: 'Change the design', onclick: function () { if (!confirm('Change the agreed design? The agreed version is kept in the history, and the result will be judged against the new one.')) return; saveExp(pid, function (e) { e.past = (e.past || []).concat([{ design: e.design, locked: e.locked }]).slice(-10); e.locked = null; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': design reopened').then(render, function (er) { alert(saveErr(er)); }); } })]));
    }
    if ((x.past || []).length) dsec.appendChild(el('p', { class: 'fxmuted', text: (x.past.length === 1 ? 'One earlier agreed design' : x.past.length + ' earlier agreed designs') + ' kept in the history.' }));
    wrap.appendChild(dsec);
    // 2 During: the readings
    var rsec = el('section', { class: 'fxcard fxmcard' + (st === 'run' ? ' now' : ''), id: 'exReadings', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: '2 During: the readings' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag', text: (x.readings || []).length + ((x.readings || []).length === 1 ? ' reading' : ' readings') })]), el('p', { class: 'fxmuted', text: locked ? 'One entry for each period: the main measure, the signs the mechanism is working, whether the threshold held, and anything unexpected.' : 'Readings start once the design is agreed.' })]);
    var ch = expChart(x); if (ch) rsec.appendChild(ch);
    if ((x.readings || []).length) rsec.appendChild(el('table', { class: 'fxtable', id: 'exTable' }, [el('thead', {}, [el('tr', {}, ['Period', (d.measure ? cutT(d.measure, 40) : 'Main measure') + (d.unit ? ' (' + d.unit + ')' : ''), 'Put in place', 'Actually done', 'Mechanism', 'The threshold', 'Unexpected', ''].map(function (h) { return el('th', { text: h }); }))]),
      el('tbody', {}, x.readings.map(function (r, i) { return el('tr', { class: r.line === 'crossed' ? 'bad' : '' }, [el('td', { text: r.period || String(i + 1) }), el('td', { text: r.value === '' || r.value == null ? '' : String(r.value) }), el('td', { text: ({ yes: 'Yes', partly: 'Partly', no: 'No' })[r.installed] || '' }), el('td', { text: (({ yes: 'Yes', partly: 'Partly', no: 'No' })[r.enacted] || '') + (r.enactEv ? ': ' + r.enactEv : '') }), el('td', { text: r.mech || '' }), el('td', { text: r.line === 'crossed' ? 'Crossed' : r.line === 'held' ? 'Held' : '' }), el('td', { text: r.unexpected || '' }), el('td', {}, [byLine({ by: r.by, at: r.at }), ro || st === 'done' ? null : el('button', { class: 'fxico', type: 'button', 'aria-label': 'Remove this reading', text: '×', onclick: function () { saveExp(pid, function (e) { e.readings.splice(i, 1); }, 'Experiment: removed a reading').then(render); } })])]); }))]));
    if (locked && !ro && st !== 'done') {
      var R = { period: el('input', { type: 'text', 'data-rd': 'period', placeholder: (function () { var rr = x.readings || [], lp = rr.length ? String(rr[rr.length - 1].period || '') : '', m = lp.match(/^(.*?)(\d+)\s*$/); return m ? m[1] + (Number(m[2]) + 1) : rr.length ? 'Period ' + (rr.length + 1) : 'Weekend 1'; })() }), value: el('input', { type: 'text', inputmode: 'decimal', 'data-rd': 'value', placeholder: 'a number' }), mech: el('input', { type: 'text', 'data-rd': 'mech', placeholder: 'What we saw of the mechanism' }), unexpected: el('input', { type: 'text', 'data-rd': 'unexpected', placeholder: 'Anything we did not expect' }) };
      var lineSel = el('select', { 'data-rd': 'line' }, [['held', 'The threshold held'], ['crossed', 'The threshold was crossed']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
      var YPN = [['', 'Choose'], ['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']];
      var instSel = el('select', { 'data-rd': 'installed' }, YPN.map(function (o) { return el('option', { value: o[0], text: o[1] }); })), enSel = el('select', { 'data-rd': 'enacted' }, YPN.map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
      R.enactEv = el('input', { type: 'text', 'data-rd': 'enactEv', placeholder: 'Not what people say: a record, an observation, a log' });
      var rmsg = el('span', { class: 'fxmuted' });
      rsec.appendChild(el('div', { class: 'fxreading' }, [el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Period' }), R.period]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: d.measure ? cutT(d.measure, 50) : 'Main measure' }), R.value]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'The threshold' }), lineSel]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Put in place?' }), instSel]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Actually done?' }), enSel]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'How we know it was done' }), R.enactEv]), el('div', { class: 'fxq wide' }, [el('label', { class: 'fxql', text: 'Signs the mechanism is working' }), R.mech]), el('div', { class: 'fxq wide' }, [el('label', { class: 'fxql', text: 'Unexpected' }), R.unexpected]),
        el('div', { class: 'fxagree wide', style: 'border:0;padding:0' }, [rmsg, el('span', { class: 'fxgrow' }), el('button', { class: 'btn sm fxmain', type: 'button', id: 'exAddReading', text: 'Add the reading', onclick: function () {
          var v = R.value.value.trim(); if (v && isNaN(Number(v))) { rmsg.textContent = 'The measure needs to be a number.'; return; }
          if (enSel.value && enSel.value !== 'no' && !R.enactEv.value.trim()) { rmsg.textContent = 'Say how we know it was actually done: not what people say, but a record or an observation.'; return; }
          var rec = { period: R.period.value.trim() || 'Period ' + ((x.readings || []).length + 1), value: v, mech: R.mech.value.trim(), line: lineSel.value, installed: instSel.value, enacted: enSel.value, enactEv: R.enactEv.value.trim(), unexpected: R.unexpected.value.trim(), by: meName(), at: new Date().toISOString() };
          saveExp(pid, function (e) { e.readings = (e.readings || []).concat([rec]); if (rec.line === 'crossed' && !e.stopped) e.stopped = { at: rec.at, by: rec.by, why: 'The threshold was crossed in ' + rec.period }; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': reading for ' + rec.period).then(render, function (er) { rmsg.textContent = saveErr(er); });
        } })])]));
      if (!(x.stopped && x.stopped.at)) { var sw = el('input', { type: 'text', placeholder: 'Why we stop', 'aria-label': 'Why we stop' }); rsec.appendChild(el('details', { class: 'fxstop' }, [el('summary', { text: 'Stop the experiment early' }), el('div', { class: 'fxamb' }, [sw, el('button', { class: 'btn sm', type: 'button', id: 'exStop', text: 'Stop it', onclick: function () { if (!sw.value.trim()) return sw.focus(); saveExp(pid, function (e) { e.stopped = { at: new Date().toISOString(), by: meName(), why: sw.value.trim() }; }, 'Experiment ' + (PR ? PR.label(p) : '') + ': stopped early').then(render); } })])])); }
    }
    if (x.stopped && x.stopped.at) rsec.appendChild(el('div', { class: 'fxcard fxwarn', style: 'margin:12px 0 0' }, [el('b', { text: 'Stopped early, ' + dshort(x.stopped.at) + ', by ' + String(x.stopped.by || '').replace(/ \(master\)$/, '') }), el('p', { style: 'margin:4px 0 0', text: x.stopped.why || '' })]));
    var reps = B && B.reportsFor ? B.reportsFor(pid) : [];
    rsec.appendChild(el('p', { class: 'fxmuted', style: 'margin:12px 0 0' }, [document.createTextNode(reps.length + (reps.length === 1 ? ' report' : ' reports') + ' from the people running it. '), el('a', { href: '#beta', text: reps.length ? 'Read them, and choose what they see' : 'Choose what they see, and invite reports' })]));
    wrap.appendChild(rsec);
    // 3 After: the result
    var res = x.result || {}, canRead = locked && ((x.readings || []).length || (x.stopped && x.stopped.at));
    var asec = el('section', { class: 'fxcard fxmcard' + (st === 'run' && canRead || st === 'stopped' ? ' now' : ''), id: 'exResult', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: '3 After: the result against what we expected' })]), el('p', { class: 'fxeg' }, [el('span', { text: 'We said success would be: ' }), el('i', { text: d.success || 'not said yet' })])]);
    var three = function (k, label, opts) { var cur = res[k] || ''; return el('div', { class: 'fxq', 'data-res': k }, [el('span', { class: 'fxql', text: label }), el('span', { class: 'fxthree', role: 'group', 'aria-label': label }, opts.map(function (o) { return el('button', { type: 'button', class: cur === o[0] ? 'on ' + o[2] : '', 'aria-pressed': String(cur === o[0]), 'data-v': o[0], disabled: ro || !canRead || st === 'done', text: o[1], onclick: function () { saveExp(pid, function (e) { e.result = e.result || {}; e.result[k] = o[0]; e.result.by = meName(); e.result.at = new Date().toISOString(); }, 'Experiment ' + (PR ? PR.label(p) : '') + ': ' + label.toLowerCase().replace(/\?$/, '') + ': ' + o[1].toLowerCase()).then(render, function (er) { alert(saveErr(er)); }); } }); }))]); };
    asec.appendChild(el('div', { class: 'fxqs two' }, [three('success', 'Did it meet what counts as success?', [['yes', 'Yes', 'y'], ['partly', 'Partly', 'n'], ['no', 'No', 'x']]), three('mechanism', 'Did the mechanism work as expected?', [['yes', 'Yes', 'y'], ['partly', 'Partly', 'n'], ['no', 'No', 'x']]), three('model', 'Against what the model predicted', [['as', 'As predicted', 'y'], ['better', 'Better', 'y'], ['worse', 'Worse', 'x']])]));
    var sur = el('textarea', { rows: 1, 'data-res': 'surprised', disabled: ro || !canRead || st === 'done', placeholder: 'What surprised us' }); sur.value = res.surprised || ''; grow(sur);
    sur.addEventListener('blur', function () { var v = sur.value.trim(); if (v === (res.surprised || '')) return; saveExp(pid, function (e) { e.result = e.result || {}; e.result.surprised = v; }, 'Experiment: what surprised us').catch(function () {}); });
    asec.appendChild(el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'What surprised us' }), sur]));
    if (res.mechanism === 'no' && res.success === 'yes') asec.appendChild(el('p', { class: 'fxmuted', text: 'A good result for a reason we did not expect may not last. Say why below before deciding.' }));
    if (!canRead) asec.appendChild(el('p', { class: 'fxmuted', text: 'Add a reading first.' }));
    wrap.appendChild(asec);
    // 4 The decision
    var dec = x.decision || {}, csec = el('section', { class: 'fxcard fxmcard' + (st === 'read' ? ' now' : ''), id: 'exDecision', style: 'margin-top:16px' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: '4 The decision' }), el('span', { class: 'fxgrow' }), dec.d ? el('span', { class: 'fxtag ok', text: { proven: 'Proven in use', extend: 'Extended', sentback: 'Sent back to ' + ({ model: 'Model', diagnose: 'Diagnose', frame: 'Frame' })[dec.to] }[dec.d] + ', ' + dshort(dec.at) }) : null])]);
    if (!ro && res.success && st !== 'done') {
      var learnt = el('textarea', { rows: 2, id: 'exLearnt', placeholder: 'What we learnt, in a sentence or two. It goes with the decision.' }); grow(learnt);
      var to = el('select', { id: 'exTo' }, [['model', 'Model: redesign the proposition'], ['diagnose', 'Diagnose: the formulation missed something'], ['frame', 'Frame: look again at the question and its assumptions']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
      var dmsg = el('span', { class: 'fxmuted' });
      var decide = function (dd) { if (dd !== 'proven' && !learnt.value.trim()) { dmsg.textContent = 'Say what we learnt first.'; learnt.focus(); return; } var now = new Date().toISOString(); (async function () { try { if (dd !== 'extend' && B && B.decideFor) await B.decideFor(pid, dd, { learnt: learnt.value.trim(), worked: res.surprised || '', to: to.value }); await saveExp(pid, function (e) { e.decision = { d: dd, to: dd === 'sentback' ? to.value : null, at: now, by: meName(), learnt: learnt.value.trim() }; if (dd === 'extend') { e.past = (e.past || []).concat([{ design: e.design, locked: e.locked, readings: e.readings, result: e.result, round: (e.round || 1) }]).slice(-10); e.round = (e.round || 1) + 1; e.locked = null; e.readings = []; e.result = null; e.stopped = null; } }, 'Experiment ' + (PR ? PR.label(p) : '') + ': ' + ({ proven: 'proven in use', extend: 'extended to a second round', sentback: 'sent back to ' + to.value })[dd]); render(); } catch (er) { dmsg.textContent = saveErr(er); } })(); };
      csec.appendChild(el('div', { class: 'fxq' }, [el('label', { class: 'fxql', for: 'exLearnt', text: 'What we learnt' }), learnt]));
      csec.appendChild(el('div', { class: 'fxdecide' }, [el('button', { class: 'btn fxmain', type: 'button', 'data-decide': 'proven', text: 'Proven in use', onclick: function () { decide('proven'); } }), el('button', { class: 'btn', type: 'button', 'data-decide': 'extend', text: 'Extend: run a second round', onclick: function () { decide('extend'); } }), el('span', { class: 'fxsendto' }, [el('button', { class: 'btn', type: 'button', 'data-decide': 'sentback', text: 'Send it back to', onclick: function () { decide('sentback'); } }), to]), dmsg]));
    } else if (!dec.d) csec.appendChild(el('p', { class: 'fxmuted', text: 'Decide once the result is read.' }));
    if (dec.learnt) csec.appendChild(el('p', {}, [el('b', { text: 'What we learnt: ' }), document.createTextNode(dec.learnt)]));
    if (x.round > 1) csec.appendChild(el('p', { class: 'fxmuted', text: 'Round ' + x.round + '. Earlier rounds are kept in the history.' }));
    wrap.appendChild(csec);
    wrap.appendChild(fxFoot(['4.3 All the experiments', '#tbeta'], ['Next: 4.4 Outcomes', '#tout'], ''));
  }
  function X0inv() { return invData(); }
  function cutT(t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }

  // ---------- the one-page summary: the frame on one printable page ----------
  function renderOnePage() {
    var a = frameAns(), f = (a.question && a.question.fields) || {}, hf = (a.help && a.help.fields) || {}, st = statementState(), RT = window.VTRoute, r = RT ? RT.R() : { lists: {} }, on = function (k) { return RT ? RT.on(r, k) : []; };
    var na = function (v) { return v ? document.createTextNode(v) : el('i', { text: 'Not yet answered' }); };
    var dl = function (pairs) { return el('dl', {}, [].concat.apply([], pairs.map(function (p) { return [el('dt', { text: p[0] }), el('dd', {}, [na(p[1])])]; }))); };
    var people = {}; Object.keys(a).forEach(function (k) { var b = a[k]; if (b && b.by) people[b.by.replace(/ \(master\)$/, '')] = 1; if (b && b.who) Object.keys(b.who).forEach(function (q) { if (b.who[q].by) people[b.who[q].by.replace(/ \(master\)$/, '')] = 1; }); });
    var presented = (f.first || hf.first || hf.words || '').replace(/^[“"]|[”"]$/g, '');
    var paper = el('article', { class: 'fxpaper', id: 'fxPaper' }, [
      el('h1', { text: (S.data.session.name || 'The project') + ': the frame' }),
      el('div', { class: 'fxpmeta' }, [el('span', { text: 'Frame, one-page summary · ' + (st.at && !st.changed ? 'Agreed ' + dlong(st.at) : 'Draft') }), el('span', { text: dlong(new Date().toISOString()) + (Object.keys(people).length ? ' · ' + Object.keys(people).join(', ') : '') })]),
      el('h4', { text: 'The question' }), el('p', { class: 'fxpq', text: f.question || 'Not written yet' }),
      presented ? el('p', { class: 'fxpsmall', text: 'From the words as first put: “' + presented + '”' }) : null,
      el('h4', { text: 'Our starting point' }), el('div', { class: 'fxpst', text: st.at && !st.changed ? st.text : stBody().replace(/\[|\]/g, '') }),
      el('div', { class: 'fxpcols' }, [
        el('div', {}, [el('h4', { text: 'Is it the right question?' }), dl([['Whose problem is it?', fv('question', 'whose') || f.owner], ['Do we want to solve it?', fv('question', 'want')], ['What will it make possible?', fv('question', 'sothat')], ['What decision will it inform?', fv('question', 'decision')]])]),
        el('div', {}, [el('h4', { text: 'Who it matters to' }), dl([['Who gains', fv('value', 'gains')], ['Who is hurt if it fails', fv('exposure', 'exposed')], ['What must never happen', fv('gap', 'mustnot')], ['Affected but not asked', fv('exposure', 'absent')]])]),
        el('div', {}, [el('h4', { text: 'What is prompting this' }), el('p', {}, [na(fv('help', 'why'))]), el('h4', { text: 'What we compare against' }), dl([['If we do nothing', fv('question', 'nothing')], ['The measure that matters most', fv('good', 'primary')]])]),
        el('div', {}, [el('h4', { text: 'How it works' }), el('p', {}, [na([on('work').join(', '), ((a.requires && a.requires.runs) || []).length ? 'Runs on: ' + a.requires.runs.map(function (x) { return x.t; }).join(', ') : ''].filter(Boolean).join('. '))]), el('h4', { text: 'First guesses' }), el('p', {}, [na(fv('guesses', 'text'))])])]),
      el('h4', { text: 'What we take for granted' }),
      assumptions().length ? el('table', {}, [el('thead', {}, [el('tr', {}, [el('th', { text: 'We are assuming that' }), el('th', { text: 'Status' }), el('th', { text: 'How we know' })])]), el('tbody', {}, assumptions().map(function (x) { var m = markOf(x); return el('tr', {}, [el('td', { text: x.t }), el('td', { text: MARKS.filter(function (o) { return o[0] === m; })[0][1] }), el('td', { text: x.how || (m === 'unchecked' ? 'To be tested in Diagnose' : '') })]); }))]) : el('p', {}, [na('')]),
      el('div', { class: 'fxpfoot' }, [el('span', { text: 'Viability Thinking Lab · Frame' }), el('span', { text: 'Page 1 of 1' })])]);
    var word = function () { var css = 'body{font-family:Arial,sans-serif;font-size:11pt;color:#000}h1{font-size:20pt;font-weight:normal}h4{font-size:9pt;letter-spacing:1px;text-transform:uppercase;margin:12pt 0 3pt}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #999;padding:3pt;text-align:left;vertical-align:top}dt{font-weight:bold}dd{margin:0 0 4pt}'; download((S.data.session.name || 'frame').replace(/[^\w ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '-frame.doc', '<html><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + paper.innerHTML + '</body></html>', 'application/msword'); };
    main.appendChild(el('div', { class: 'fx fxonepage' }, [el('div', { class: 'fxexbar no-print' }, [el('a', { class: 'btn sm', href: '#fhome', text: '‹ Back to Frame' }), el('span', { class: 'fxgrow' }), el('button', { class: 'btn sm', type: 'button', id: 'fxWord', text: 'Download Word', onclick: word }), el('button', { class: 'btn sm', type: 'button', text: 'Save as PDF', title: 'Choose “Save as PDF” in the print window', onclick: function () { window.print(); } }), el('button', { class: 'btn sm fxmain', type: 'button', text: 'Print', onclick: function () { window.print(); } })]), paper]));
  }

  // ---------- presenting: one question at a time, large, for a room ----------
  function presentSlides(part) {
    var a = frameAns(), f = (a.question && a.question.fields) || {}, hf = (a.help && a.help.fields) || {}, out = [];
    if (part === 'q') {
      var pr = (f.first || hf.first || hf.words || '').replace(/^[“"]|[”"]$/g, '');
      out.push({ k: 'The question', h: f.question || 'What is the question?', a: pr ? '“' + pr + '”' : '', aby: pr ? 'The words as first put' : '', big: true, box: 'question', key: 'question' });
      CHECKS.forEach(function (c, i) { out.push({ k: 'Is it the right question? · Check ' + (i + 1) + ' of 4', h: c.l, box: c.box, key: c.k }); });
    } else if (part === 's') {
      workSections().forEach(function (x) { x.rows.forEach(function (rw) { if (rw.box) out.push({ k: 'Frame · ' + x.n, h: rw.l, box: rw.box, key: rw.k }); }); if (x.list) out.push({ k: 'Frame · ' + x.n, h: 'What are we taking for granted?', list: assumptions().map(function (y) { return 'We are assuming that ' + y.t + ' (' + MARKS.filter(function (o) { return o[0] === markOf(y); })[0][1].toLowerCase() + ')'; }) }); });
    } else if (part === 'l') {
      out.push({ k: 'Thresholds · in one sentence', h: 'What must never happen?', a: fv('gap', 'mustnot'), big: true, box: 'gap', key: 'mustnot' });
      LCAPS.forEach(function (c) { var ls = LHOLD.map(function (h) { var l = lineOf(c[0], h[0]); return h[1] + ': ' + (hasLine(l) ? bandText(c[0], l) : l.none ? 'no threshold can be set' : 'not set yet'); }); out.push({ k: 'Thresholds · ' + c[1], h: govern(c[0]) ? c[1] + ': ' + govText(c[0]) : c[1] + ': where is the threshold?', list: ls }); });
      var lf = lineFindings(); if (lf.length) out.push({ k: 'Thresholds · what the thresholds show', h: 'What do the thresholds show?', list: lf.slice(0, 8).map(function (f) { return f.t; }) });
    } else if (part === 't') {
      out.push({ k: 'Test · the outcome', h: 'What does the change leave behind?', a: tBodyFull(), aby: tState().at ? 'Agreed ' + dlong(tState().at) : 'Draft' });
      var TP2 = tParts(), AR2 = { holds: 'holds in the model', fails: 'fails in the model', changed: 'changed in the model' }, RS2 = { trying: 'trying in use', proven: 'proven in use', sentback: 'sent back' };
      TP2.props.forEach(function (p) { var a = p.alpha || {}, b = TP2.beta.filter(function (y) { return y.id === p.id; })[0]; out.push({ k: 'Test · ' + (window.VTProps ? window.VTProps.label(p) : ''), h: p.n || 'Untitled proposition', list: [(AR2[alphaOf(p)] || 'not yet tried in the model') + (a.showed ? ': ' + a.showed : ''), b ? RS2[b.result] + ' (' + b.reports + (b.reports === 1 ? ' report)' : ' reports)') : 'not yet tried in use'] }); });
    } else if (part === 'm') {
      out.push({ k: 'Model · what goes to Test', h: 'What will we try?', a: mBodyFull(), aby: mState().at ? 'Agreed ' + dlong(mState().at) : 'Draft' });
      mChosen().forEach(function (m) { out.push({ k: 'Model · ' + m.n, h: m.n + ': how it works, and how it fails', list: mFind(m.id, 'works').map(function (x) { return 'It works because ' + x.t; }).concat(mFind(m.id, 'fails').map(function (x) { return 'It fails because ' + x.t; })) }); });
    } else if (part === 'd') {
      out.push({ k: 'Diagnose · the formulation', h: 'How does it work, and how does it fail?', a: dBodyFull(), aby: dState().at ? 'Agreed ' + dlong(dState().at) : 'Draft' });
      var F = window.VTAnalyse && window.VTAnalyse.formAll ? window.VTAnalyse.formAll() : {};
      ['protective', 'predisposing', 'precipitating', 'perpetuating'].forEach(function (k) { var x = F[k]; if (!x) return; out.push({ k: 'Diagnose · ' + x.head, h: x.name + ': ' + x.line.replace(/:.*$/, '').replace(/\.$/, ''), list: x.entries.slice(0, 7).map(function (e) { return e.text; }) }); });
    } else out.push({ k: 'The system · our starting point', h: 'Is this the right boundary?', a: stBody(), aby: statementState().at ? 'Agreed ' + dlong(statementState().at) : 'Draft' });
    out.forEach(function (s, i) { s.n = (i + 1) + ' of ' + out.length; });
    return out;
  }
  function renderPresent(part) {
    var back = part === 's' ? '#work' : part === 'l' ? '#line' : part === 'y' ? '#system' : part === 'd' ? '#dform' : part === 'm' ? '#mdesign' : part === 't' ? '#tout' : '#question';
    var slides = presentSlides(part), i = Math.max(0, Math.min(slides.length - 1, FX.slide || 0)), typing = false;
    main.appendChild(el('p', { class: 'fxmuted', text: 'Presenting. Press Esc to stop.' }));
    var old = document.getElementById('fxPresentView'); if (old) old.remove(); if (FX.presKey) document.removeEventListener('keydown', FX.presKey);
    var host = el('div', { class: 'fxpresent', id: 'fxPresentView', role: 'dialog', 'aria-label': 'Presenting' }); document.body.appendChild(host);
    var stop = function () { document.removeEventListener('keydown', key); host.remove(); FX.slide = 0; location.hash = back; };
    var key = function (e) { if (typing) return; if (e.key === 'Escape') stop(); else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go2(1); } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go2(-1); } };
    var go2 = function (d) { i = Math.max(0, Math.min(slides.length - 1, i + d)); FX.slide = i; paint(); };
    var paint = function () {
      var s = slides[i], ans = s.box ? fv(s.box, s.key) : s.a, w = s.box ? whoOf(s.box, s.key) : null;
      host.innerHTML = '';
      var ansEl = s.list ? el('ul', { class: 'fxpans' }, s.list.length ? s.list.map(function (t) { return el('li', { text: t }); }) : [el('li', { text: 'None written yet.' })]) : el('div', { class: 'fxpans' + (ans ? '' : ' empty') }, [document.createTextNode(ans || 'Not answered yet.'), w && w.by ? el('div', { class: 'fxpby', text: 'Written by ' + w.by.replace(/ \(master\)$/, '') + (w.at ? ', ' + dshort(w.at) : '') }) : s.aby ? el('div', { class: 'fxpby', text: s.aby }) : null]);
      var write = null;
      if (s.box && !S.readonly && s.key !== 'question') write = el('button', { type: 'button', class: 'fxpbtn', id: 'fxPresWrite', text: ans ? 'Change the answer' : 'Write the answer', onclick: function () {
        typing = true; var t = el('textarea', { class: 'fxptype', rows: 3, 'aria-label': s.h }); t.value = ans || ''; ansEl.replaceWith(t); t.focus();
        t.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); t.blur(); } });
        t.addEventListener('blur', async function () { typing = false; var v = t.value.trim(); if (v !== fv(s.box, s.key)) { try { await saveFrameField(s.box, s.key, v); } catch (e) {} } paint(); });
      } });
      host.appendChild(el('div', { class: 'fxptop' }, [el('span', { text: (S.data.session.name || '') }), el('button', { type: 'button', class: 'fxpbtn', id: 'fxPresStop', text: 'Stop presenting (Esc)', onclick: stop })]));
      host.appendChild(el('div', { class: 'fxpmid' }, [el('div', { class: 'fxpk', text: s.k }), el('h2', { class: 'fxph' + (s.big ? ' big' : '') + ((s.h || '').length > 90 ? ' long' : ''), text: s.h }), ansEl]));
      host.appendChild(el('div', { class: 'fxpbot' }, [el('span', { class: 'fxpdots', 'aria-label': 'Slide ' + s.n }, slides.map(function (_, j) { return el('i', { class: j === i ? 'on' : '' }); })), el('span', { class: 'fxpnav' }, [el('button', { type: 'button', class: 'fxpbtn', disabled: i === 0, text: '‹ Previous', onclick: function () { go2(-1); } }), write, el('button', { type: 'button', class: 'fxpbtn', id: 'fxPresNext', disabled: i === slides.length - 1, text: 'Next ›', onclick: function () { go2(1); } })])]));
    };
    FX.presKey = key; document.addEventListener('keydown', key);
    paint();
  }
  // the assumptions (30 October 2026): written as "We are assuming that ...". Since 31 October each is
  // Not tested yet, Holds or Does not hold, with how we know. Not tested ones go to Diagnose to be tested.
  // Kept in answers.assume.items; an older single answer shows as the first.
  function assumptions() { var a = frameAns(), x = a.assume || {}; if (x.items && x.items.length) return x.items; var t = String((x.fields && x.fields.text) || '').trim(); return t ? [{ id: 'a0', t: t, mark: 'unchecked', old: true }] : []; }
  // the stopping rule, from the book: three tests (two on The situation, the boundary one on The system)
  function stopTests() {
    var c = ((row('frame') || {}).content || {}).stopTests || {};
    return [{ id: 'wrong', l: 'We have written down at least three ways our picture of the problem could be wrong', ok: !!c.wrong },
      { id: 'arguable', l: 'The boundary is plain enough for someone to disagree with', ok: !!c.arguable },
      { id: 'cost', l: 'We have named at least one person who is affected but not asked', ok: !!c.cost && !!fv('exposure', 'absent'), needs: fv('exposure', 'absent') ? '' : 'name them first, under Who it matters to' }];
  }
  async function saveFrameContent(fn, summary) {
    fxSave('busy');
    try {
      var r = row('frame'), c = JSON.parse(JSON.stringify((r && r.content) || {})); c.answers = c.answers || {}; fn(c);
      var d = await api({ action: 'p_save', tile_key: 'frame', status: (r && r.status) || 'partly', summary: summary, base_version: r ? r.version : null, content: c });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'frame'; }); S.data.tiles.push(d.tile); fxSave('ok');
    } catch (e) { fxSave('bad'); throw e; }
  }
  async function saveFrameField(box, k, v, note) {
    var r = row('frame'), c = JSON.parse(JSON.stringify((r && r.content) || {})); c.answers = c.answers || {};
    if (note) { c.teamNotes = c.teamNotes || {}; c.teamNotes[box] = v; }
    else { var b = c.answers[box] = c.answers[box] || {}; b.fields = b.fields || {}; if (String(b.fields[k] || '') === v) return; b.fields[k] = v; b.by = meName(); b.at = new Date().toISOString(); b.who = b.who || {}; b.who[k] = { by: b.by, at: b.at }; }
    fxSave('busy');
    try {
      var d = await api({ action: 'p_save', tile_key: 'frame', status: (r && r.status) || 'partly', summary: note ? 'Team note: ' + box : 'Changed: ' + box + ' (' + k + ')', base_version: r ? r.version : null, content: c });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'frame'; }); S.data.tiles.push(d.tile); fxSave('ok');
    } catch (e) { fxSave('bad'); throw e; }
  }
  function renderReasonsSummary() {
    var team = !!S.sumTeam;
    var A = function (tile, field) { return props(tile, field, 'accepted'); };
    var one2 = function (tile, field) { return A(tile, field)[0]; };
    main.appendChild(partTabs('r', 'summary'));
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin:-6px 0 8px' }, [el('span'),
      el('div', { class: 'seg' }, [el('button', { 'aria-pressed': String(!team), text: 'Organisation version', onclick: function () { S.sumTeam = false; render(); } }), el('button', { 'aria-pressed': String(team), id: 'teamVer', text: 'Team version', onclick: function () { S.sumTeam = true; render(); } })]),
      el('button', { class: 'btn sm', text: 'Print', onclick: function () { window.print(); } })]));
    head(S.data.session.name || 'Frame', 'Reasons summary', team ? 'Team version: includes what is not shown to the organisation.' : 'Why they have come, as agreed so far.');
    var lay = el('div', { class: 'sumlay' + (team ? ' withteam' : '') });
    var C = el('div', { class: 'glass sumc' });
    var w = A('words', 'main');
    C.appendChild(el('div', { class: 'flab', text: 'In their words' }));
    if (w.length) w.forEach(function (p) { var s3 = srcById(p.source_id); C.appendChild(el('div', { class: 'qv big', text: '“' + p.value + '”' })); C.appendChild(el('div', { class: 'muted sm', text: s3 ? [s3.speaker, s3.kind === 'transcript' ? 'first call' : s3.title].filter(Boolean).join(', ') : '' })); });
    else C.appendChild(el('div', { class: 'gap', text: 'Not found yet' }));
    var k1 = one2('kind', 'main'), k2 = one2('kind', 'second');
    var kindTxt = function (p) { return p.choice ? p.choice.replace(/^Wanted, /, 'Reaching something wanted, ').replace(/^Harm, /, 'Avoiding harm, ').replace(/:.*$/, '') : ''; };
    C.appendChild(el('div', { class: 'flab', style: 'margin-top:18px', text: 'What kind of reason' }));
    C.appendChild(el('div', { text: k1 ? kindTxt(k1) + (k1.value && k1.value !== k1.choice ? ': ' + k1.value.replace(/\.$/, '') : '') + '.' + (k2 ? ' Also: ' + kindTxt(k2).toLowerCase() + (k2.value && k2.value !== k2.choice ? ' (' + k2.value.replace(/\.$/, '') + ')' : '') + '.' : '') : 'Not found yet', class: k1 ? '' : 'gap' }));
    C.appendChild(el('div', { class: 'flab', style: 'margin-top:18px', text: 'Where things stand' }));
    var ms = ['routine', 'idea', 'howfar', 'choice'].map(function (f) { var p = one2('markers', f); if (!p) return null; var v = p.value && p.value !== p.choice ? p.value.replace(/\.$/, '') : ''; return el('li', {}, [el('span', { class: 'muted', text: fieldOf('markers', f).label + ': ' }), document.createTextNode((p.choice || '') + (p.choice && v ? ' (' + v.charAt(0).toLowerCase() + v.slice(1) + ')' : v))]); }).filter(Boolean);
    C.appendChild(ms.length ? el('ul', { class: 'tl' }, ms) : el('div', { class: 'gap', text: 'Not found yet' }));
    var miss = ['routine', 'idea', 'howfar', 'choice'].filter(function (f) { return !one2('markers', f); }).map(function (f) { return fieldOf('markers', f).label.toLowerCase(); });
    if (miss.length) C.appendChild(el('div', { class: 'muted sm', style: 'margin-top:6px', text: 'Still to confirm: ' + miss.join('; ') + '.' }));
    var used = {}; props(null, null, 'accepted').forEach(function (p) { var t = tileDef(p.tile_key); if (t && t.g === 'r' && (team || !t.team) && p.source_id) used[p.source_id] = 1; });
    var sl = Object.keys(used).map(function (id) { var s3 = srcById(id); return s3 ? s3.title + (s3.source_date ? ' (' + new Date(s3.source_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ')' : '') : ''; }).filter(Boolean);
    C.appendChild(el('div', { class: 'sfoot', text: (sl.length ? 'Sources: ' + sl.join('; ') + '. ' : '') + 'Work in progress.' }));
    lay.appendChild(C);
    if (team) {
      var T = el('div', { class: 'glass sumc teamside' }, [el('div', { class: 'spread' }, [el('div', { class: 'flab', style: 'margin:0', text: 'Team only' }), el('span', { class: 'team', text: 'Not in the organisation version' })])]);
      var t1 = one2('firstview', 'type'), t2 = one2('firstview', 'type2'), why = one2('firstview', 'why');
      T.appendChild(el('div', { style: 'margin-top:10px' }, [document.createTextNode('First view of the challenge: '), el('b', { text: t1 ? t1.choice : 'not yet formed' }), document.createTextNode(t2 ? ', possibly ' + t2.choice.toLowerCase() : ''), document.createTextNode(t1 && t1.confidence ? ' (' + t1.confidence + ' confidence).' : '.')]));
      if (why) T.appendChild(el('div', { class: 'sm', text: why.value }));
      var fv = fieldsAnswered('firstview', ['type', 'type2', 'why']);
      if (fv.length) T.appendChild(el('ul', { class: 'sm tl' }, fv.map(function (x) { return el('li', { text: x }); })));
      var dis = one2('markers', 'disguised');
      if (dis) T.appendChild(el('div', { class: 'sm', style: 'margin-top:10px', text: 'A solution already in mind: ' + dis.value + ' To question in the assumptions step.' }));
      if (tileOn(tileDef('assumptions'))) {
        var asm = fieldsAnswered('assumptions', []);
        T.appendChild(el('div', { class: 'flab', style: 'margin-top:14px', text: 'Assumptions (immunity to change)' }));
        T.appendChild(asm.length ? el('ul', { class: 'sm tl' }, asm.map(function (x) { return el('li', { text: x }); })) : el('div', { class: 'gap sm', text: 'Not found yet' }));
      }
      var gaps = []; rTiles().forEach(function (t) { t.fields.forEach(function (f) { if (f.core && !A(t.id, f.id).length && f.ask) gaps.push(f.ask); }); });
      if (gaps.length) { T.appendChild(el('div', { class: 'flab', style: 'margin-top:14px', text: 'Ask next' })); T.appendChild(el('ul', { class: 'sm tl' }, gaps.map(function (x) { return el('li', { text: x }); }))); }
      lay.appendChild(T);
    }
    main.appendChild(lay);
  }
  function fieldsAnswered(tile, skip) {
    var t = tileDef(tile), out3 = [];
    t.fields.forEach(function (f) { if (skip.indexOf(f.id) >= 0) return; props(tile, f.id, 'accepted').forEach(function (p) { out3.push(f.label.replace(/\?$/, '') + ': ' + (p.choice ? p.choice + (p.value && p.value !== p.choice ? '. ' + p.value : '') : p.value)); }); });
    return out3;
  }

  // ---------- the toolkit: options, to be used selectively ----------
  function renderToolkit(only) {
    if (only) main.appendChild(partTabs(only, 'tools'));
    else main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: '← The frame', onclick: function () { go('canvas'); } })]));
    head(S.data.session.name || 'Frame', only ? groupDef(only).sn + ': tools' : 'The Problem toolkit', only ? 'Each line of this part of the canvas is made by one of its core tools. Open a tool to add or change what it says. Optional tools add further lines when the engagement needs them.' : 'Optional tools for framing. Choose two or three that suit this challenge: more is rarely better. Say why when you choose one; the reason is kept with the engagement.');
    if (only) {
      main.appendChild(el('h3', { style: 'margin:22px 0 10px', text: 'Core tools' }));
      var core = el('div', { class: 'tkgrid' });
      if (only === 'r') core.appendChild(el('div', { class: 'glass tool core', 'data-core': 'sheet' }, [el('div', { class: 'spread' }, [el('h4', { text: 'The first-session sheet' }), el('span', { class: 'pill' + (row('sheet') ? ' ok' : ''), text: row('sheet') ? 'Started' : 'Not started' })]), el('p', { class: 'sm', text: 'One page for the room to fill together, before the other tools. Each box seeds a tool.' }), el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn sm solid', text: 'Open', onclick: function () { go('sheet'); } })])]));
      VIS().filter(function (t) { return t.g === only; }).forEach(function (t) {
        var st = stateOf(t.id), r = row(t.id);
        core.appendChild(el('div', { class: 'glass tool core', 'data-core': t.id }, [el('div', { class: 'spread' }, [el('h4', { text: t.name }), el('span', { class: 'pill ' + (st === 'done' ? 'ok' : st === 'partly' || st === 'reopened' ? 'part' : ''), text: WORDS[st] })]),
          t.tool ? el('div', { class: 'muted sm', text: t.tool }) : null, el('p', { class: 'sm', text: t.q }),
          r && r.summary ? el('p', { class: 'sm why', text: 'Says: ' + r.summary }) : null,
          el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn sm solid', text: 'Open', onclick: function () { go('tile=' + t.id); } }), t.team ? el('span', { class: 'team', text: 'Team only' }) : null])]));
      });
      main.appendChild(core);
      main.appendChild(el('h3', { style: 'margin:30px 0 4px', text: 'Optional tools' }));
    }
    var types = props('firstview', null, 'accepted').filter(function (p) { return (p.field === 'type' || p.field === 'type2') && p.choice; }).map(function (p) { return p.choice; });
    var chosen = chosenTools(), n = Object.keys(chosen).length;
    main.appendChild(el('p', { class: 'meta', style: 'margin-top:10px', text: (n ? n + (n === 1 ? ' tool chosen' : ' tools chosen') + ' so far. ' : 'None chosen yet. ') + (types.length ? 'Suggested for a ' + types.join(' and ').toLowerCase() + ' challenge are marked.' : 'Suggestions appear once a first view of the challenge is accepted.') }));
    (only ? GROUPS : PG).forEach(function (g) {
      if (only && g.id !== only) return;
      var list = (D.toolkit || []).filter(function (x) { return x.part === g.id; }); if (!list.length) { if (only) main.appendChild(el('p', { class: 'meta', style: 'margin-top:16px', text: 'No tools for this part yet.' })); return; }
      if (!only) main.appendChild(el('h3', { style: 'margin:26px 0 10px', text: g.name.replace(/^\d\.\s*/, '') }));
      else main.appendChild(el('div', { style: 'height:18px' }));
      var grid = el('div', { class: 'tkgrid' });
      list.forEach(function (x) { grid.appendChild(toolCard(x, chosen, types)); });
      main.appendChild(grid);
    });
    if (only) main.appendChild(el('div', { class: 'bfoot' }, [el('button', { class: 'quiet', text: 'See the whole toolkit', onclick: function () { go('toolkit'); } })]));
  }
  function toolCard(x, chosen, types) {
    var on = !!chosen[x.id], sug = (x.suits || []).some(function (t) { return types.indexOf(t) >= 0; });
    var card = el('div', { class: 'glass tool' + (on ? ' on' : '') + (sug ? ' sug' : ''), 'data-tool': x.id }, [
      el('div', { class: 'spread' }, [el('h4', { text: x.name }), sug && !on ? el('span', { class: 'pill wait', text: 'Suggested' }) : on ? el('span', { class: 'pill ok', text: 'Chosen' }) : null]),
      x.by ? el('div', { class: 'muted sm', text: x.by }) : null,
      el('p', { class: 'tp', text: x.prompt }), el('p', { class: 'sm', text: x.reveals }),
      el('div', { class: 'muted sm', text: [x.time, x.mode, x.share].filter(Boolean).join('  ·  ') })]);
    if (on) {
      card.appendChild(el('div', { class: 'sm why', text: 'Why: ' + (chosen[x.id].why || '') }));
      card.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [x.tile ? el('button', { class: 'btn sm', text: 'Open the tile', onclick: function () { go('tile=' + x.tile); } }) : el('span', { class: 'muted sm', text: 'No tile yet: use the prompt in the session.' }),
        el('button', { class: 'btn sm', text: 'Remove', onclick: function () { setTool(x.id, null); } })]));
    } else {
      var why = el('input', { type: 'text', placeholder: 'Why this tool for this engagement?', style: 'flex:1;min-width:200px' });
      var f = el('div', { class: 'row', hidden: true, style: 'margin-top:10px' }, [why, el('button', { class: 'btn sm solid', text: 'Choose', onclick: function () { if (!why.value.trim()) { why.focus(); return; } setTool(x.id, why.value.trim()); } })]);
      card.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn sm', 'data-use': x.id, text: 'Use this tool', onclick: function () { f.hidden = false; why.focus(); } }), x.tile && groupDef(x.part) ? el('span', { class: 'muted sm', text: 'Adds a tile to ' + groupDef(x.part).name.replace(/^\d\.\s*/, '') + '.' }) : null]));
      card.appendChild(f);
    }
    return card;
  }
  async function setTool(id, why) {
    if (window.VTScope && window.VTScope.active()) {
      // the selector in Project › What's included now decides which tools are used
      var sr = row('scope'), nc = JSON.parse(JSON.stringify(sr.content)); nc.on['tk.' + id] = !!why; nc.why = nc.why || {}; if (why) nc.why[id] = why; nc.changed = true;
      try { var sd = await api({ action: 'p_save', tile_key: 'scope', status: 'done', summary: (why ? 'Switched on: ' : 'Switched off: ') + 'tk.' + id, base_version: sr.version, content: nc }); S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'scope'; }); S.data.tiles.push(sd.tile); window.VTScope.set(sd.tile); render(); } catch (e) { alert(e.message); }
      return;
    }
    var r = row('toolkit'), chosen = JSON.parse(JSON.stringify(chosenTools()));
    if (why) chosen[id] = { why: why, at: new Date().toISOString() }; else delete chosen[id];
    try {
      var d = await api({ action: 'p_save', tile_key: 'toolkit', status: 'done', base_version: r ? r.version : null, content: { chosen: chosen } });
      S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'toolkit'; }); S.data.tiles.push(d.tile); render();
    } catch (e) { alert(e.message); }
  }

  // =====================================================================
  // The service: the dependency inventory. What the service needs to work,
  // under the five headings plus third parties, shown six ways, with export
  // and import for the client's own risk and compliance system.
  // =====================================================================
  var RT = { people: ['People', '#3b6fd6'], tech: ['Technology', '#7b4fc9'], fac: ['Facilities', '#2e8a56'], info: ['Information', '#b8860b'], third: ['Third party', '#c4502f'], other: ['Other (no regulatory heading)', '#8a8f98'] };
  // The six capitals: what a resource holds or carries. Suggested from the type, and can be changed.
  var CAPS = { financial: ['Financial', '#0f8b8d'], manufactured: ['Manufactured', '#8c7a63'], human: ['Human', '#c2457a'], social: ['Social', '#3b82c4'], natural: ['Natural', '#4f9a3a'], information: ['Information', '#c9961a'] };
  var DEFCAP = { people: ['human'], tech: ['manufactured', 'information'], fac: ['manufactured'], info: ['information'], third: [], other: [] };
  var capsOf = function (r) { return r.cap && r.cap.length ? r.cap : (DEFCAP[r.t] || []); };
  var capWords = function (r) { return capsOf(r).map(function (c) { return CAPS[c] ? CAPS[c][0] : c; }).join(', '); };
  var resColour = function (r) { if (S.invColour === 'capital') { var c = capsOf(r)[0]; return c && CAPS[c] ? CAPS[c][1] : '#8a8f98'; } return (RT[r.t] || RT.people)[1]; };
  var CRIT = ['Critical', 'High', 'Medium', 'Low'], POS = ['controlled', 'influenced', 'outside'], POSW = { controlled: 'Controlled by the organisation', influenced: 'Influenced by the organisation', outside: 'Outside the organisation’s control' };
  var emptyInv = function () { return { service: '', tolerance: { hours: null, text: '' }, processes: [], resources: [], scenarios: [] }; };
  function invData() { var r = row('inventory'); var v = r && r.content && r.content.inv; return v ? JSON.parse(JSON.stringify(v)) : emptyInv(); }
  var isSpof = function (r) { return /^none$/i.test(String(r.alt || '').trim()) && (r.u || []).length >= 2; };
  function invState(v) { v = v || invData(); if (!v.processes.length && !v.resources.length) return 'none'; return v.processes.length && v.resources.length && v.tolerance && v.tolerance.hours ? 'done' : 'partly'; }
  var nid = function (pre, list) { var n = 1; while (list.some(function (x) { return x.id === pre + n; })) n++; return pre + n; };
  async function saveInv(v) {
    var r = row('inventory');
    var d = await api({ action: 'p_save', tile_key: 'inventory', status: invState(v), summary: v.resources.length + ' resources, ' + v.processes.length + ' processes, ' + v.resources.filter(isSpof).length + ' single points of failure', base_version: r ? r.version : null, content: { inv: v } });
    S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== 'inventory'; }); S.data.tiles.push(d.tile);
  }
  // How good is the evidence (1 November 2026): every Frame section, the line, every tool and every step can say so,
  // and where it is thin or missing, say what would close the gap. One register, kept in the inventory as evq.
  var EVQ = [['strong', 'Strong', 'Seen in records or observed, from more than one source'], ['some', 'Some', 'From people who know, or one good record'], ['thin', 'Thin', 'One account, second-hand, or reconstructed after the event'], ['none', 'None yet', 'Our working assumption: nothing checked yet']];
  // the evidence levels, 0 to 5 (agreed 3 November 2026); older grades carry across: none 0, thin 2, some 3, strong 4
  var EVL = [[0, 'No evidence', 'Nothing says it exists or is true'], [1, 'Said', 'People say so, in a call, a meeting, an interview or the room'], [2, 'Written down', 'In a plan, procedure, record or contract'], [3, 'Done, or confirmed', 'People have done it, or a record confirms it'], [4, 'Tested, or independently confirmed', 'Tested on its own and met the figure, or confirmed by an independent source'], [5, 'Tested end to end, or confirmed across sources', 'Met the figure end to end or in a live event, or confirmed across records, people and outside evidence']];
  var OLDLV = { none: 0, thin: 2, some: 3, strong: 4 };
  function lvOf(x) { if (!x) return null; if (x.lv != null && x.lv !== '') return Number(x.lv); return x.q && OLDLV[x.q] != null ? OLDLV[x.q] : null; }
  var qOfLv = function (lv) { return lv == null ? '' : lv === 0 ? 'none' : lv <= 2 ? 'thin' : lv === 3 ? 'some' : 'strong'; };
  var EVQW = { strong: 'Strong', some: 'Some', thin: 'Thin', none: 'None yet' };
  function evqAll() { var r = row('inventory'); return (r && r.content && r.content.inv && r.content.inv.evq) || {}; }
  function evqBar(key, label, step) {
    var ro = !!S.readonly, cur = evqAll()[key] || {}, msg = el('span', { class: 'muted sm', role: 'status' });
    var put = async function (patch) { try { var v = invData(); v.evq = v.evq || {}; v.evq[key] = Object.assign({}, v.evq[key] || {}, patch, { label: label, step: step || '', by: myName(), at: new Date().toISOString() }); await saveInv(v); msg.textContent = 'Saved.'; render(); } catch (e) { msg.textContent = e.message; } };
    var box = el('div', { class: 'evq' + (lvOf(cur) != null ? ' q-' + qOfLv(lvOf(cur)) : ''), 'data-evq': key }, [el('span', { class: 'evql', text: 'How good is the evidence here?' })]);
    var seg = el('div', { class: 'evqseg', role: 'group', 'aria-label': 'How good is the evidence for ' + label });
    var curLv = lvOf(cur);
    EVL.forEach(function (o) { var on = curLv === o[0]; seg.appendChild(el('button', { type: 'button', class: 'evqb lv q-' + qOfLv(o[0]), 'data-lv': String(o[0]), 'data-q': qOfLv(o[0]), 'aria-pressed': String(on), title: o[1] + ': ' + o[2], disabled: ro, onclick: function () { put(on ? { lv: '', q: '' } : { lv: o[0], q: qOfLv(o[0]) }); } }, [el('b', { text: String(o[0]) }), el('span', { text: ' ' + o[1] })])); });
    box.appendChild(seg);
    var t = el('input', { type: 'text', class: 'evqn', 'data-evqnote': key, disabled: ro, placeholder: (lvOf(cur) || 0) >= 4 ? 'Where it comes from' : 'What is missing, and where we would get it', 'aria-label': 'What is missing, and where we would get it' }); t.value = cur.note || '';
    t.addEventListener('change', function () { if (t.value.trim() !== (cur.note || '')) put({ note: t.value.trim() }); });
    box.appendChild(t); box.appendChild(msg);
    if (curLv != null) box.appendChild(el('span', { class: 'evqw muted sm', text: 'Level ' + curLv + ': ' + EVL[curLv][2] + '.' }));
    return box;
  }
  // where the evidence is thin, gathered for one step or the whole project
  function evqSummary(step) {
    var all = evqAll(), keys = Object.keys(all).filter(function (k) { return all[k] && lvOf(all[k]) != null && (!step || all[k].step === step); });
    var n = function (lv) { return keys.filter(function (k) { return lvOf(all[k]) === lv; }).length; };
    var weak = keys.filter(function (k) { return lvOf(all[k]) <= 2; }).sort(function (a, b) { return lvOf(all[a]) - lvOf(all[b]); });
    var box = el('div', { class: 'panel evqsum', id: step ? 'evqSum-' + step : 'evqSum' }, [el('h3', { style: 'margin:0 0 4px', text: 'How good is the evidence' }),
      el('p', { class: 'meta', text: keys.length ? EVL.map(function (o) { return n(o[0]) + ' at level ' + o[0]; }).filter(function (t) { return !/^0 at/.test(t); }).join(' · ') + '. Marked on ' + keys.length + ' section' + (keys.length === 1 ? '' : 's') + ' and tool' + (keys.length === 1 ? '' : 's') + '.' : 'Nothing marked yet. Each section, tool and step has a row asking how good the evidence is.' })]);
    if (weak.length) box.appendChild(el('table', { class: 'evqtab' }, [el('thead', {}, [el('tr', {}, [el('th', { text: 'Where' }), el('th', { text: 'Evidence' }), el('th', { text: 'What is missing, and where we would get it' })])]), el('tbody', {}, weak.map(function (k) { var x = all[k]; return el('tr', { 'data-evqrow': k }, [el('td', { text: x.label || k }), el('td', {}, [el('span', { class: 'evqchip q-' + qOfLv(lvOf(x)), text: lvOf(x) + ' ' + EVL[lvOf(x)][1] })]), el('td', { text: x.note || 'Not said' })]); }))]));
    else if (keys.length) box.appendChild(el('p', { class: 'meta', text: 'Nothing marked thin or missing.' }));
    return box;
  }
  function invSrcChip(o) {
    if (!o || !o.src || !o.src.source_id) return null;
    var src = srcById(o.src.source_id); if (!src) return null;
    return el('a', { class: 'srcchip k-' + src.kind, href: '#source=' + src.id, title: o.src.excerpt || '', text: KINDS[src.kind] + ' · ' + shortWho(src) + (o.src.para != null ? ' · ¶' + (o.src.para + 1) : '') });
  }

  // ---------- the six views ----------
  var INVV = [['map', 'Map'], ['tree', 'Tree'], ['register', 'Register'], ['matrix', 'Matrix'], ['dashboard', 'Dashboard'], ['journey', 'Journey to inventory']];
  function inventoryPanel(vIn) {
    var v = vIn || invData(), view = S.invView || 'map';
    var box = el('div', { class: 'glass invp', id: 'invp' });
    box.appendChild(el('div', { class: 'spread' }, [el('div', {}, [el('div', { class: 'flab', text: 'Dependencies' }), el('h3', { style: 'margin:2px 0 0', text: v.service || 'The service, not yet named' })]),
      el('div', { class: 'row' }, [el('button', { class: 'btn sm', id: 'invEdit', text: 'Edit the inventory', onclick: function () { go('tile=inventory'); } }), el('button', { class: 'btn sm', id: 'invExport', text: 'Export', onclick: function () { exportInv(v); } })])]));
    box.appendChild(el('div', { class: 'seg invtabs', style: 'margin-top:12px' }, INVV.map(function (x) { return el('button', { 'aria-pressed': String(view === x[0]), 'data-iv': x[0], text: x[1], onclick: function () { S.invView = x[0]; render(); } }); })));
    var byCap = S.invColour === 'capital', KS = byCap ? CAPS : RT;
    var key = el('div', { class: 'invkey' }, [el('span', { class: 'seg cseg' }, [['type', 'Colour by regulatory heading'], ['capital', 'Colour by capital']].map(function (x) { return el('button', { 'aria-pressed': String((S.invColour || 'type') === x[0]), 'data-col': x[0], text: x[1], onclick: function () { S.invColour = x[0]; render(); } }); }))].concat(Object.keys(KS).map(function (k) { return el('span', {}, [el('i', { style: 'background:' + KS[k][1] }), document.createTextNode(KS[k][0])]); })).concat([el('span', {}, [el('i', { style: 'background:var(--muted)' }), document.createTextNode(byCap ? 'Not yet tagged' : 'Process')])]));
    box.appendChild(key);
    if (!v.processes.length && !v.resources.length) { box.appendChild(el('p', { class: 'meta', style: 'margin-top:14px', text: 'Nothing mapped yet. Open a source and select words to start the inventory, import a register, or edit it directly.' })); return box; }
    var host = el('div', { class: 'invview', 'data-view': view });
    ({ map: viewMap, tree: viewTree, register: viewRegister, matrix: viewMatrix, dashboard: viewDash, journey: viewJourney })[view](v, host);
    box.appendChild(host);
    return box;
  }
  var NS2 = 'http://www.w3.org/2000/svg';
  function viewMap(v, host) {
    var lay = el('div', { class: 'ndlay' }), W = 900, H = 560, cx = W / 2, cy = H / 2, pos = { s: [cx, cy] };
    v.processes.forEach(function (p, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, v.processes.length); pos[p.id] = [cx + 215 * Math.cos(a), cy + 150 * Math.sin(a)]; });
    v.resources.forEach(function (r, i) { var a = -Math.PI / 2 + (i + .5) * 2 * Math.PI / Math.max(1, v.resources.length); pos[r.id] = [cx + 380 * Math.cos(a), cy + 245 * Math.sin(a)]; });
    var s = '';
    var ln = function (a, b, ida, idb) { return '<line class="nedge" data-a="' + ida + '" data-b="' + idb + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'; };
    v.processes.forEach(function (p) { s += ln(pos.s, pos[p.id], 's', p.id); });
    v.resources.forEach(function (r) { (r.u || []).forEach(function (pid) { if (pos[pid]) s += ln(pos[pid], pos[r.id], pid, r.id); }); });
    var bx = function (id, x, y, w, h, cls, colour, label) {
      var words = String(label).split(/\s+/), lines = [], cur = '';
      words.forEach(function (wd) { if ((cur + ' ' + wd).trim().length > 18) { if (cur) lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); }); if (cur) lines.push(cur); lines = lines.slice(0, 3);
      return '<g class="nnode ' + cls + '" data-id="' + id + '" tabindex="0"><rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="8"' + (colour ? ' style="stroke:' + colour + ';fill:' + colour + '1f"' : '') + '/>' +
        lines.map(function (l, i) { return '<text x="' + x + '" y="' + (y + (i - (lines.length - 1) / 2) * 13 + 4) + '" text-anchor="middle">' + esc(l) + '</text>'; }).join('') + '</g>';
    };
    s += bx('s', cx, cy, 160, 56, 'svc', '', v.service || 'The service');
    v.processes.forEach(function (p) { s += bx(p.id, pos[p.id][0], pos[p.id][1], 132, 42, 'proc', '', p.n); });
    v.resources.forEach(function (r) {
      s += bx(r.id, pos[r.id][0], pos[r.id][1], 130, 42, 'res', resColour(r), r.n);
      if (isSpof(r)) s += '<g class="spofm" pointer-events="none"><circle cx="' + (pos[r.id][0] + 61) + '" cy="' + (pos[r.id][1] - 19) + '" r="9"/><text x="' + (pos[r.id][0] + 61) + '" y="' + (pos[r.id][1] - 15) + '" text-anchor="middle">!</text></g>';
    });
    var svg = document.createElementNS(NS2, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'ndsvg'); svg.innerHTML = s;
    var side = el('div', { class: 'ndside' }, [el('h4', { text: 'Click a box' }), el('p', { class: 'meta', text: 'Each box is a record. Its details, and where it came from, appear here. A red mark is a single point of failure: used by more than one process, with no alternative.' })]);
    Array.prototype.forEach.call(svg.querySelectorAll('.nnode'), function (g) {
      g.addEventListener('click', function () {
        var id = g.getAttribute('data-id'), near = {}; near[id] = 1;
        Array.prototype.forEach.call(svg.querySelectorAll('.nedge'), function (e) { var on = e.getAttribute('data-a') === id || e.getAttribute('data-b') === id; e.classList.toggle('hl', on); e.classList.toggle('dim', !on); if (on) { near[e.getAttribute('data-a')] = 1; near[e.getAttribute('data-b')] = 1; } });
        Array.prototype.forEach.call(svg.querySelectorAll('.nnode'), function (n) { n.classList.toggle('dim', !near[n.getAttribute('data-id')]); });
        side.innerHTML = ''; recordView(v, id, side);
      });
    });
    lay.appendChild(el('div', { class: 'ndwrap' }, [svg])); lay.appendChild(side); host.appendChild(lay);
  }
  function recordView(v, id, side) {
    var r = v.resources.filter(function (x) { return x.id === id; })[0], p = v.processes.filter(function (x) { return x.id === id; })[0];
    var dl = function (pairs) { return el('dl', { class: 'recdl' }, [].concat.apply([], pairs.filter(function (x) { return x[1]; }).map(function (x) { return [el('dt', { text: x[0] }), el('dd', { text: x[1] })]; }))); };
    if (r) {
      side.appendChild(el('div', { class: 'flab', style: 'color:' + (RT[r.t] || RT.people)[1], text: (RT[r.t] || RT.people)[0] }));
      side.appendChild(el('h4', { text: r.n }));
      side.appendChild(dl([['Owner', r.owner], ['Capitals', capWords(r)], ['Criticality', r.c], ['Recovery time', r.rto], ['Alternative', r.alt], ['Position', POSW[r.pos]], ['Last checked', r.chk ? r.chk + (r.chkBy ? ', by ' + r.chkBy : '') : 'Not recorded'], ['When there', r.avail], ['Who would notice', r.det], ['Evidence', r.grade], ['Direction', r.dir === 'relied on by' ? 'Relies on this service' : 'The service relies on it'], ['Supports', (r.u || []).map(function (u) { var q2 = v.processes.filter(function (x) { return x.id === u; })[0]; return q2 ? q2.n : ''; }).filter(Boolean).join('; ')]]));
      if (isSpof(r)) side.appendChild(el('span', { class: 'spofb', text: 'Single point of failure' }));
      var c = invSrcChip(r); if (c) side.appendChild(el('div', { style: 'margin-top:10px' }, [c]));
    } else if (p) {
      side.appendChild(el('div', { class: 'flab', text: 'Process' })); side.appendChild(el('h4', { text: p.n }));
      side.appendChild(dl([['Owner', p.owner], ['How it fails', p.fails], ['Resources', v.resources.filter(function (r2) { return (r2.u || []).indexOf(p.id) >= 0; }).map(function (r2) { return r2.n; }).join('; ')]]));
      var c2 = invSrcChip(p); if (c2) side.appendChild(el('div', { style: 'margin-top:10px' }, [c2]));
    } else {
      side.appendChild(el('div', { class: 'flab', text: 'Important business service' })); side.appendChild(el('h4', { text: v.service || 'The service' }));
      side.appendChild(dl([['Tolerance', v.tolerance && v.tolerance.text], ['Within', v.tolerance && v.tolerance.hours ? v.tolerance.hours + ' hours' : ''], ['Processes', String(v.processes.length)], ['Resources', String(v.resources.length)], ['Single points', String(v.resources.filter(isSpof).length)]]));
    }
  }
  var rtag = function (t) { return el('span', { class: 'rtag', style: 'background:' + (RT[t] || RT.people)[1], text: (RT[t] || RT.people)[0] }); };
  function viewTree(v, host) {
    var ul = el('ul', { class: 'itree' }), top = el('li', {}, [el('b', { text: v.service || 'The service' }), el('span', { class: 'muted sm', text: '  important business service' + (v.tolerance && v.tolerance.hours ? ' · back within ' + v.tolerance.hours + ' hours' : '') })]);
    var pl = el('ul', {});
    v.processes.forEach(function (p) {
      var li = el('li', {}, [el('span', { class: 'rtag', style: 'background:var(--muted)', text: 'Process' }), el('b', { text: p.n })]), rl = el('ul', {});
      v.resources.filter(function (r) { return (r.u || []).indexOf(p.id) >= 0; }).forEach(function (r) { rl.appendChild(el('li', {}, [rtag(r.t), document.createTextNode(r.n), el('span', { class: 'muted sm', text: '  ' + (r.c || '') + (isSpof(r) ? ' · single point of failure' : '') })])); });
      li.appendChild(rl); pl.appendChild(li);
    });
    var loose = v.resources.filter(function (r) { return !(r.u || []).length; });
    if (loose.length) { var li2 = el('li', {}, [el('b', { text: 'Not yet linked to a process' })]), rl2 = el('ul', {}); loose.forEach(function (r) { rl2.appendChild(el('li', {}, [rtag(r.t), document.createTextNode(r.n)])); }); li2.appendChild(rl2); pl.appendChild(li2); }
    top.appendChild(pl); ul.appendChild(top); host.appendChild(ul);
  }
  var rag = function (r) { return isSpof(r) ? 'r' : /^partial/i.test(r.alt || '') ? 'a' : /^none$/i.test(r.alt || '') ? 'a' : 'g'; };
  function viewRegister(v, host) {
    var t = el('table', { class: 'itab' });
    t.appendChild(el('tr', {}, ['Resource', 'Type', 'Capitals', 'Owner', 'Criticality', 'Recovery time', 'Alternative', 'Position', 'Processes', 'Status', 'Source'].map(function (h) { return el('th', { text: h }); })));
    v.resources.forEach(function (r) {
      var g = rag(r);
      t.appendChild(el('tr', {}, [el('td', {}, [el('b', { text: r.n })]), el('td', { text: (RT[r.t] || RT.people)[0] }), el('td', { text: capWords(r) }), el('td', { text: r.owner || '' }), el('td', { text: r.c || '' }), el('td', { text: r.rto || '' }), el('td', { text: r.alt || '' }), el('td', { text: r.pos || '' }), el('td', { text: String((r.u || []).length) }),
        el('td', {}, [el('i', { class: 'ragd ' + g }), document.createTextNode(g === 'r' ? 'Single point of failure' : g === 'a' ? 'Partly covered' : 'Covered')]), el('td', {}, [invSrcChip(r)])]));
    });
    host.appendChild(el('div', { class: 'iscroll' }, [t]));
  }
  function viewMatrix(v, host) {
    var t = el('table', { class: 'itab mx2' });
    t.appendChild(el('tr', {}, [el('th', { text: 'Resource' })].concat(v.processes.map(function (p) { return el('th', { text: p.n }); })).concat([el('th', { text: 'Alternative' })])));
    v.resources.forEach(function (r) {
      t.appendChild(el('tr', { class: isSpof(r) ? 'sp' : '' }, [el('td', {}, [rtag(r.t), document.createTextNode(r.n)])].concat(v.processes.map(function (p) { return el('td', {}, [(r.u || []).indexOf(p.id) >= 0 ? el('span', { class: 'mdot' }) : null]); })).concat([el('td', { text: r.alt || '' })])));
    });
    host.appendChild(el('div', { class: 'iscroll' }, [t]));
    host.appendChild(el('p', { class: 'meta', text: 'Shaded rows are single points of failure: a resource used by more than one process, with no alternative.' }));
  }
  function viewDash(v, host) {
    var tol = v.tolerance && v.tolerance.hours, out = (v.scenarios || []).filter(function (s2) { return tol && Math.max(s2.worst || 0, s2.last || 0) > tol; }).length;
    var kpi = function (k, val, warn) { return el('div', { class: 'kpi2' }, [el('div', { class: 'muted sm', text: k }), el('div', { class: 'kv' + (warn ? ' warn' : ''), text: val })]); };
    host.appendChild(el('div', { class: 'kpis' }, [kpi('Processes mapped', String(v.processes.length)), kpi('Resources mapped', String(v.resources.length)), kpi('Single points of failure', String(v.resources.filter(isSpof).length), v.resources.filter(isSpof).length > 0), kpi('Scenarios outside tolerance', (v.scenarios || []).length ? out + ' of ' + v.scenarios.length : 'None tested', out > 0)]));
    var col = function (h) { return !h ? '' : !tol ? 'n' : h <= tol ? 'g' : h <= tol * 1.5 ? 'a' : 'r'; };
    if ((v.scenarios || []).length) {
      var t = el('table', { class: 'itab heat2' });
      t.appendChild(el('tr', {}, ['Severe but plausible scenario', 'Best case (hours)', 'Worst case (hours)', 'Last test (hours)'].map(function (h) { return el('th', { text: h }); })));
      v.scenarios.forEach(function (s2) { t.appendChild(el('tr', {}, [el('td', { text: s2.n }), el('td', { class: col(s2.best), text: s2.best ? String(s2.best) : '' }), el('td', { class: col(s2.worst), text: s2.worst ? String(s2.worst) : '' }), el('td', { class: col(s2.last), text: s2.last ? String(s2.last) : 'Not tested' })])); });
      host.appendChild(el('div', { class: 'iscroll', style: 'margin-top:12px' }, [t]));
    }
    host.appendChild(el('p', { class: 'meta', text: tol ? 'Impact tolerance: ' + (v.tolerance.text || 'back within ' + tol + ' hours') + '. Green is within it; amber up to half as long again; red beyond.' : 'Set the impact tolerance in the inventory to compare scenarios against it.' }));
  }
  function viewJourney(v, host) {
    var grid = el('div', { class: 'jgrid' });
    var L = el('div', {}, [el('h4', { text: 'The journey, step by step, and how it fails' })]);
    v.processes.forEach(function (p, i) {
      var needs = v.resources.filter(function (r) { return (r.u || []).indexOf(p.id) >= 0; });
      L.appendChild(el('div', { class: 'jstep' }, [el('b', { text: (i + 1) + '. ' + p.n }), el('div', { class: 'sm', text: 'Needs: ' + (needs.map(function (r) { return r.n; }).join('; ') || 'nothing linked yet') }), p.fails ? el('div', { class: 'jf', text: 'How it fails: ' + p.fails }) : null]));
    });
    var R2 = el('div', {}, [el('h4', { text: 'Exported to the organisation’s system' })]);
    R2.appendChild(el('div', { class: 'jinv' }, [el('b', { text: 'Processes' }), document.createTextNode(v.processes.map(function (p) { return p.n; }).join('; '))]));
    Object.keys(RT).forEach(function (k) { var l = v.resources.filter(function (r) { return r.t === k; }); if (l.length) R2.appendChild(el('div', { class: 'jinv' }, [el('b', { text: RT[k][0] }), document.createTextNode(l.map(function (r) { return r.n + (isSpof(r) ? ' (single point of failure)' : ''); }).join('; '))])); });
    var vul = v.processes.filter(function (p) { return p.fails; }).map(function (p) { return p.n + ': ' + p.fails; }).concat(v.resources.filter(isSpof).map(function (r) { return r.n + ': no alternative'; }));
    R2.appendChild(el('div', { class: 'jinv' }, [el('b', { text: 'Vulnerabilities' }), vul.length ? el('ul', { class: 'tl' }, vul.map(function (x) { return el('li', { text: x }); })) : document.createTextNode('None recorded yet')]));
    grid.appendChild(L); grid.appendChild(el('div', { class: 'jarrow', text: '→' })); grid.appendChild(R2); host.appendChild(grid);
  }

  // ---------- export and import ----------
  function csvCell(x) { x = String(x == null ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function csv(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }
  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function invCsv(v, which) {
    var pn = function (id) { var p = v.processes.filter(function (x) { return x.id === id; })[0]; return p ? p.n : ''; };
    if (which === 'resources') return csv([['Service', 'Resource', 'Type', 'Capitals', 'Owner', 'Criticality', 'Recovery time', 'Alternative', 'Position', 'Direction', 'Supports processes', 'Single point of failure']].concat(v.resources.map(function (r) { return [v.service, r.n, (RT[r.t] || RT.people)[0], capWords(r), r.owner, r.c, r.rto, r.alt, r.pos, r.dir, (r.u || []).map(pn).join('; '), isSpof(r) ? 'Yes' : 'No']; })));
    if (which === 'processes') return csv([['Service', 'Order', 'Process', 'Owner', 'How it fails']].concat(v.processes.map(function (p, i) { return [v.service, i + 1, p.n, p.owner, p.fails]; })));
    if (which === 'vulnerabilities') return csv([['Service', 'Where', 'Vulnerability']].concat(v.processes.filter(function (p) { return p.fails; }).map(function (p) { return [v.service, p.n, p.fails]; })).concat(v.resources.filter(isSpof).map(function (r) { return [v.service, r.n, 'Single point of failure: used by ' + (r.u || []).length + ' processes with no alternative']; })));
    return csv([['Service', 'Scenario', 'Best case (hours)', 'Worst case (hours)', 'Last test (hours)', 'Impact tolerance (hours)']].concat((v.scenarios || []).map(function (s2) { return [v.service, s2.n, s2.best, s2.worst, s2.last, v.tolerance && v.tolerance.hours]; })));
  }
  function exportInv(v) {
    var base = (S.data.session.name || 'service').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'Export the inventory' }), el('button', { class: 'btn sm', text: 'Close', onclick: closeModal })]),
      el('p', { class: 'meta', text: 'Spreadsheet files (CSV) that a risk and compliance system can take in: resources, processes, vulnerabilities and scenarios. Once we have the organisation’s own field layout, the columns can be matched to it exactly.' }),
      el('div', { class: 'row', style: 'margin-top:12px' }, ['resources', 'processes', 'vulnerabilities', 'scenarios'].map(function (w) { return el('button', { class: 'btn sm', 'data-exp': w, text: w.charAt(0).toUpperCase() + w.slice(1), onclick: function () { download(base + '-' + w + '.csv', invCsv(v, w)); } }); }).concat([el('button', { class: 'btn sm', text: 'Everything (JSON)', onclick: function () { download(base + '-inventory.json', JSON.stringify(v, null, 2), 'application/json'); } })]))]);
  }
  function parseCsv(text) {
    var rows = [], cur = [], cell = '', q2 = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q2) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q2 = false; } else cell += ch; }
      else if (ch === '"') q2 = true; else if (ch === ',') { cur.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; cur.push(cell); rows.push(cur); cur = []; cell = ''; } else cell += ch;
    }
    if (cell || cur.length) { cur.push(cell); rows.push(cur); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }
  function importInv(text, v) {
    var rows = parseCsv(text); if (rows.length < 2) throw new Error('No rows found in that file');
    var h = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    var col = function () { for (var i = 0; i < arguments.length; i++) { var k = h.indexOf(arguments[i]); if (k >= 0) return k; } return -1; };
    var cN = col('resource', 'resource name', 'name', 'asset'), cT = col('type', 'resource type', 'category'), cO = col('owner', 'resource owner'), cC = col('criticality', 'critical'), cR = col('recovery time', 'rto', 'recovery time objective'), cA = col('alternative', 'workaround'), cP = col('supports processes', 'processes', 'process');
    if (cN < 0) throw new Error('The file needs a column called Resource or Name');
    var typeOf = function (x) { x = String(x || '').toLowerCase(); return /people|staff|team|person/.test(x) ? 'people' : /tech|system|software|hardware|application|it/.test(x) ? 'tech' : /facilit|site|building|location|premises/.test(x) ? 'fac' : /info|data|record/.test(x) ? 'info' : /third|supplier|vendor|outsourc|provider/.test(x) ? 'third' : /other|financ|money|budget|natural|weather/.test(x) ? 'other' : 'tech'; };
    var added = 0;
    rows.slice(1).forEach(function (r) {
      var n = String(r[cN] || '').trim(); if (!n || v.resources.some(function (x) { return x.n.toLowerCase() === n.toLowerCase(); })) return;
      var u = [];
      if (cP >= 0) String(r[cP] || '').split(/;|\|/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (pn) {
        var p = v.processes.filter(function (x) { return x.n.toLowerCase() === pn.toLowerCase(); })[0];
        if (!p) { p = { id: nid('p', v.processes), n: pn, owner: '', fails: '' }; v.processes.push(p); }
        u.push(p.id);
      });
      v.resources.push({ id: nid('r', v.resources), n: n, t: typeOf(cT >= 0 ? r[cT] : ''), owner: cO >= 0 ? r[cO] : '', c: cC >= 0 ? r[cC] : '', rto: cR >= 0 ? r[cR] : '', alt: cA >= 0 ? r[cA] : '', u: u, pos: 'controlled', dir: 'relies on', src: null, imported: true });
      added++;
    });
    return added;
  }

  // ---------- the model: one map of the service, running through all four practices ----------
  function renderModel() {
    if (window.VTModel) return window.VTModel.render(main);
    head(S.data.session.name || 'The model', 'The model');
    main.appendChild(inventoryPanel());
  }

  // ---------- editing the inventory (a fallback to taking it from sources) ----------
  function renderInventoryEditor() {
    var v = invData();
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: '← The model', onclick: toModel })]));
    head(S.data.session.name || 'The model', 'Dependencies: the inventory', 'The service, its processes, and the resources each one needs. Most entries come from sources: open a source and select the words. Edit the details here, or import a register the organisation already holds.');
    var m = el('div', { class: 'msg' });
    var save = async function () { try { await saveInv(v); m.className = 'msg good'; m.textContent = 'Saved.'; } catch (e) { m.className = 'msg bad'; m.textContent = e.message; } };
    var file = el('input', { type: 'file', id: 'invImport', accept: '.csv,text/csv', hidden: true });
    file.addEventListener('change', async function () { var f = file.files[0]; if (!f) return; try { var n = importInv(await f.text(), v); await saveInv(v); render(); alert(n + (n === 1 ? ' resource' : ' resources') + ' imported.'); } catch (e) { alert(e.message); } file.value = ''; });
    main.appendChild(el('div', { class: 'row no-print', style: 'margin-top:14px' }, [file, el('button', { class: 'btn sm', text: 'Import a register (CSV)', onclick: function () { file.click(); } }), el('button', { class: 'btn sm', text: 'Export', onclick: function () { exportInv(v); } }), el('button', { class: 'btn sm', text: 'Back to the views', onclick: function () { S.mtab = 'ibs'; toModel(); } })]));
    // the service and its tolerance
    var sv = el('input', { type: 'text', id: 'invSvc', value: v.service || '', placeholder: 'The important business service, for example: customers can make a loan repayment' });
    var th = el('input', { type: 'number', id: 'invTolH', value: v.tolerance && v.tolerance.hours || '' }), tt = el('input', { type: 'text', value: v.tolerance && v.tolerance.text || '', placeholder: 'The impact tolerance in words' });
    main.appendChild(el('div', { class: 'panel' }, [el('h4', { text: 'The service and its impact tolerance' }), sv, el('div', { class: 'row', style: 'margin-top:8px;flex-wrap:nowrap' }, [el('span', { class: 'muted sm', text: 'Back within' }), th, el('span', { class: 'muted sm', text: 'hours' }), tt]),
      el('div', { class: 'row', style: 'margin-top:10px' }, [el('button', { class: 'btn sm solid', id: 'invSaveSvc', text: 'Save', onclick: function () { v.service = sv.value.trim(); v.tolerance = { hours: Number(th.value) || null, text: tt.value.trim() }; save(); } }), m])]));
    // processes
    var pbox = el('div', { class: 'panel' }, [el('h4', { text: 'Processes, in the order the service runs (' + v.processes.length + ')' })]);
    v.processes.forEach(function (p, i) {
      var n = el('input', { type: 'text', value: p.n }), o = el('input', { type: 'text', value: p.owner || '', placeholder: 'Owner' }), f = el('input', { type: 'text', value: p.fails || '', placeholder: 'How it fails' });
      var opt = function (vals, cur, ph) { var s3 = el('select', {}, [el('option', { value: '', text: ph })].concat(vals.map(function (x) { return el('option', { value: x[0], text: x[1] }); }))); s3.value = cur || ''; return s3; };
      var aw = opt([['yes', 'Owner knows it is theirs'], ['no', 'Owner does not know'], ['unknown', 'Not known']], p.aware, 'Owner aware?');
      var dc = opt([['both', 'Documented and practised'], ['documented', 'Documented, not practised'], ['practised', 'Practised, not documented'], ['contradictory', 'Documented inconsistently']], p.doc, 'Documented or practised?');
      var tu = el('input', { type: 'number', step: 'any', value: p.tUsual == null ? '' : p.tUsual, title: 'Usual time (hours)', placeholder: 'usual h' }), tl = el('input', { type: 'number', step: 'any', value: p.tLong == null ? '' : p.tLong, title: 'Long time (hours)', placeholder: 'long h' });
      var gr = opt([['observed', 'Observed'], ['stated', 'Stated'], ['assumed', 'Assumed']], p.grade, 'Evidence');
      pbox.appendChild(el('div', { class: 'irow' }, [el('span', { class: 'muted sm', text: String(i + 1) }), n, o, f, invSrcChip(p)]));
      pbox.appendChild(el('div', { class: 'irow sub' }, [aw, dc, el('span', { class: 'muted sm', text: 'Usual' }), tu, el('span', { class: 'muted sm', text: 'long' }), tl, el('span', { class: 'muted sm', text: 'hours' }), gr,
        el('button', { class: 'btn sm', text: 'Save', onclick: function () { p.n = n.value.trim() || p.n; p.owner = o.value.trim(); p.fails = f.value.trim(); p.aware = aw.value; p.doc = dc.value; p.tUsual = tu.value === '' ? null : Number(tu.value); p.tLong = tl.value === '' ? null : Number(tl.value); p.grade = gr.value; save(); } }),
        el('button', { class: 'btn sm', text: 'Remove', onclick: function () { if (!confirm('Remove this process? Resources stay, but are unlinked from it.')) return; v.processes = v.processes.filter(function (x) { return x !== p; }); v.resources.forEach(function (r) { r.u = (r.u || []).filter(function (u) { return u !== p.id; }); }); save().then(render); } })]));
    });
    var np = el('input', { type: 'text', id: 'invNewProc', placeholder: 'Add a process' });
    pbox.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [np, el('button', { class: 'btn sm', id: 'invAddProc', text: 'Add', onclick: function () { if (!np.value.trim()) return; v.processes.push({ id: nid('p', v.processes), n: np.value.trim(), owner: '', fails: '' }); save().then(render); } })]));
    main.appendChild(pbox);
    // resources
    var rbox = el('div', { class: 'panel' }, [el('h4', { text: 'Resources, under the regulators\u2019 headings, with the capitals each holds (' + v.resources.length + ')' })]);
    v.resources.forEach(function (r) {
      var sel = function (opts, val, labels) { var s3 = el('select', {}); opts.forEach(function (x, i) { s3.appendChild(el('option', { value: x, text: labels ? labels[i] : x })); }); s3.value = val || opts[0]; return s3; };
      var n = el('input', { type: 'text', value: r.n }), t = sel(Object.keys(RT), r.t, Object.keys(RT).map(function (k) { return RT[k][0]; })), o = el('input', { type: 'text', value: r.owner || '', placeholder: 'Owner' });
      var c = sel(CRIT, r.c), rto = el('input', { type: 'text', value: r.rto || '', placeholder: 'Recovery time' }), alt = el('input', { type: 'text', value: r.alt || '', placeholder: 'Alternative (or None)' }), pos = sel(POS, r.pos, POS.map(function (x) { return POSW[x]; }));
      var dir = sel(['relies on', 'relied on by'], r.dir, ['The service relies on it', 'It relies on the service']);
      var chk = el('input', { type: 'text', value: r.chk || '', placeholder: 'Last checked (date, how)' }), chkBy = el('input', { type: 'text', value: r.chkBy || '', placeholder: 'Checked by (role)' });
      var det = el('input', { type: 'text', value: r.det || '', placeholder: 'Who would notice if it failed, how soon' }), avail = el('input', { type: 'text', value: r.avail || '', placeholder: r.t === 'people' ? 'When there: nights, weekends, holidays (rota, and who answers)' : 'When available' });
      var indep = sel(['', 'yes', 'no', 'unknown'], r.indep, ['Alternative independent?', 'Alternative is independent', 'Alternative shares the same weakness', 'Not known']);
      var grade = sel(['', 'observed', 'stated', 'assumed'], r.grade, ['Evidence grade', 'Observed', 'Stated', 'Assumed']);
      var caps = el('div', { class: 'ilinks icaps' }, Object.keys(CAPS).map(function (k) { return el('label', {}, [el('input', { type: 'checkbox', checked: capsOf(r).indexOf(k) >= 0, 'data-c': k }), document.createTextNode(CAPS[k][0])]); }));
      var links = el('div', { class: 'ilinks' }, v.processes.map(function (p) { var cb = el('input', { type: 'checkbox', checked: (r.u || []).indexOf(p.id) >= 0, 'data-p': p.id }); return el('label', {}, [cb, document.createTextNode(p.n)]); }));
      rbox.appendChild(el('div', { class: 'ires' + (isSpof(r) ? ' sp' : '') }, [
        el('div', { class: 'irow' }, [n, t, o, c, rto, alt, pos, dir]),
        el('div', { class: 'row', style: 'margin-top:6px;align-items:flex-start' }, [el('span', { class: 'muted sm', text: 'Supports:' }), links]),
        el('div', { class: 'row', style: 'margin-top:6px;align-items:flex-start' }, [el('span', { class: 'muted sm', text: 'Capitals:' }), caps]),
        el('div', { class: 'irow sub' }, [chk, chkBy, det, avail, indep, grade]),
        el('div', { class: 'row', style: 'margin-top:6px' }, [invSrcChip(r), isSpof(r) ? el('span', { class: 'spofb', text: 'Single point of failure' }) : null, el('span', { style: 'flex:1' }),
          el('button', { class: 'btn sm', text: 'Save', onclick: function () { r.n = n.value.trim() || r.n; r.t = t.value; r.owner = o.value.trim(); r.c = c.value; r.rto = rto.value.trim(); r.alt = alt.value.trim(); r.pos = pos.value; r.dir = dir.value; r.u = Array.prototype.filter.call(links.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-p'); }); r.cap = Array.prototype.filter.call(caps.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-c'); }); r.chk = chk.value.trim(); r.chkBy = chkBy.value.trim(); r.det = det.value.trim(); r.avail = avail.value.trim(); r.indep = indep.value; r.grade = grade.value; save().then(render); } }),
          el('button', { class: 'btn sm', text: 'Remove', onclick: function () { if (!confirm('Remove this resource?')) return; v.resources = v.resources.filter(function (x) { return x !== r; }); save().then(render); } })])]));
    });
    var nr = el('input', { type: 'text', id: 'invNewRes', placeholder: 'Add a resource' }), nt = el('select', { id: 'invNewResType' }); Object.keys(RT).forEach(function (k) { nt.appendChild(el('option', { value: k, text: RT[k][0] })); });
    rbox.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [nr, nt, el('button', { class: 'btn sm', id: 'invAddRes', text: 'Add', onclick: function () { if (!nr.value.trim()) return; v.resources.push({ id: nid('r', v.resources), n: nr.value.trim(), t: nt.value, owner: '', c: 'High', rto: '', alt: '', u: [], pos: 'controlled', dir: 'relies on', src: null }); save().then(render); } })]));
    main.appendChild(rbox);
    // scenarios
    var sbox = el('div', { class: 'panel' }, [el('h4', { text: 'Severe but plausible scenarios (' + (v.scenarios || []).length + ')' })]);
    (v.scenarios || []).forEach(function (s2) {
      var n = el('input', { type: 'text', value: s2.n }), b = el('input', { type: 'number', value: s2.best || '' }), w = el('input', { type: 'number', value: s2.worst || '' }), l = el('input', { type: 'number', value: s2.last || '' });
      sbox.appendChild(el('div', { class: 'irow' }, [n, el('span', { class: 'muted sm', text: 'best' }), b, el('span', { class: 'muted sm', text: 'worst' }), w, el('span', { class: 'muted sm', text: 'last test' }), l, el('span', { class: 'muted sm', text: 'hours' }),
        el('button', { class: 'btn sm', text: 'Save', onclick: function () { s2.n = n.value.trim() || s2.n; s2.best = Number(b.value) || null; s2.worst = Number(w.value) || null; s2.last = Number(l.value) || null; save(); } }),
        el('button', { class: 'btn sm', text: 'Remove', onclick: function () { v.scenarios = v.scenarios.filter(function (x) { return x !== s2; }); save().then(render); } })]));
    });
    var ns = el('input', { type: 'text', placeholder: 'Add a scenario' });
    sbox.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [ns, el('button', { class: 'btn sm', text: 'Add', onclick: function () { if (!ns.value.trim()) return; v.scenarios = v.scenarios || []; v.scenarios.push({ id: nid('s', v.scenarios), n: ns.value.trim(), best: null, worst: null, last: null }); save().then(render); } })]));
    main.appendChild(sbox);
  }
  async function saveRow(key, c, status) {
    var r = row(key);
    var d = await api({ action: 'p_save', tile_key: key, status: status || 'partly', summary: '', base_version: r ? r.version : null, content: c });
    S.data.tiles = S.data.tiles.filter(function (x) { return x.tile_key !== key; }); S.data.tiles.push(d.tile);
  }
  // Words selected in a source can start a process or a resource.
  async function takeIntoInventory(kind, text, src, para) {
    var v = invData(), name = text.length > 90 ? text.slice(0, 90).replace(/\s+\S*$/, '') + '…' : text, ref = { source_id: src.id, para: para, excerpt: text };
    if (kind === 'process') v.processes.push({ id: nid('p', v.processes), n: name, owner: '', fails: '', src: ref });
    else if (kind === 'fails') { var last = v.processes[v.processes.length - 1]; if (!last) throw new Error('Add a process first, then select how it fails'); last.fails = text; last.src = last.src || ref; }
    else v.resources.push({ id: nid('r', v.resources), n: name, t: kind, owner: '', c: 'High', rto: '', alt: '', u: [], pos: 'controlled', dir: 'relies on', src: ref });
    await saveInv(v);
  }

  var VTX = { renderHash: function (host, h) { return renderHash(host, h); }, ON: { home: ON_HOME, analyse: ON_ANALYSE, evaluate: ON_EVALUATE, project: ON_PROJECT, model: ON_MODEL, step: STEP }, route: function () { route(); }, fxPath: function (a, b, c) { return fxPath(a, b, c); }, fxTitle: function (a, b, c, d, e) { return fxTitle(a, b, c, d, e); }, fxFoot: function (a, b, c) { return fxFoot(a, b, c); }, LCAPS: LCAPS, LSCALE: LSCALE, EXAMPLE: EXAMPLE, alphaBasis: function (p) { return alphaBasis(p); }, FRAME: FR, fieldVal: function (b, f) { return fieldVal(b, f); }, vis: vis, ORDER: ORDER, INVV: INVV, invView: function (view, host) { ({ map: viewMap, tree: viewTree, register: viewRegister, matrix: viewMatrix, dashboard: viewDash, journey: viewJourney })[view](invData(), host); }, toolCard: function (x) { var types = props('firstview', null, 'accepted').filter(function (p) { return (p.field === 'type' || p.field === 'type2') && p.choice; }).map(function (p) { return p.choice; }); return toolCard(x, chosenTools(), types); }, sourcesBox: sourcesBox, el: el, esc: esc, S: S, D: D, render: function () { render(); }, go: go, head: head, modal: modal, closeModal: closeModal, download: download, csv: csv, parseCsv: parseCsv, invData: invData, saveInv: saveInv, evqBar: evqBar, evqSummary: evqSummary, saveRow: saveRow, nid: nid, isSpof: isSpof, inventoryPanel: inventoryPanel, CAPS: CAPS, RT: RT, row: row, stateOf: stateOf, api: function (b) { return api(b); }, readFileText: readFileText,
    me: function () { return meName(); }, lineGoverning: function () { return lineGoverning(); }, lineText: function () { return lineText(); },
    byRes: function (id) { return invData().resources.filter(function (r) { return r.id === id; })[0]; }, byProc: function (id) { return invData().processes.filter(function (p) { return p.id === id; })[0]; } };
  if (window.VTModel) window.VTModel.init(VTX);
  if (window.VTNeeds) window.VTNeeds.init(VTX);
  if (window.VTAnalyse) window.VTAnalyse.init(VTX);
  if (window.VTProps) window.VTProps.init(VTX);
  if (window.VTBeta) window.VTBeta.init(VTX);
  if (window.VTBox) window.VTBox.init(VTX);
  if (window.VTRoute) window.VTRoute.init(VTX);
  if (window.VTGuide) window.VTGuide.init(VTX);
  if (window.VTReport) window.VTReport.init(VTX);
  load();
})();
