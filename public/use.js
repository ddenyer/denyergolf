// Use and Build (5 November 2026).
// Build is the team's workspace: every page as it was, with the task tree, progress and evidence.
// Use is for anyone else, the client above all: each of the four steps has Inputs and Results, and only
// the views the team chose (Project › Used, shown and reported) appear, as tabs. Everything in Use can be
// changed, and every change goes straight into the one record, logged with who and when.
// Clients (people added to a project as clients) always work in Use and never see the switch.
(function () {
  'use strict';
  var X, el, S;
  var STEPS = [['frame', 'Frame', 'What we are working on, the question, who has a stake, and the line that must not be crossed.', '/frame'],
    ['diagnose', 'Diagnose', 'The evidence, and what it says about how the service works and how it fails.', '/diagnose'],
    ['model', 'Model', 'The work, the people and systems that carry it, and how it runs over time.', '/model'],
    ['test', 'Test', 'Named questions and changes, each set against the way things are now.', '/test']];
  var ICON = {
    frame: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 4v16"/>',
    diagnose: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    model: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 11l7.4-4M8.3 13l7.4 4"/>',
    test: '<path d="M4 18l5-6 4 3 7-9"/><path d="M4 21h16"/>'
  };
  // Every view that can be shown in Use. hash: the page's own address for it (drawn by problem.js);
  // own: drawn here. scope: the id in Project's list that says whether this engagement uses it at all.
  // def: shown to the client unless the team says otherwise.
  var VIEWS = [
    { id: 'canvas', step: 'frame', side: 'in', n: 'The canvas', hash: 'canvas', def: true },
    { id: 'syscanvas', step: 'frame', side: 'in', n: 'The system, on one page', hash: 'system=canvas', def: false },
    { id: 'fcanvas', step: 'frame', side: 'in', n: 'The printable page', hash: 'fcanvas', def: false },
    { id: 'question', step: 'frame', side: 'in', n: 'The question', hash: 'question', def: false },
    { id: 'stepsmap', step: 'frame', side: 'out', n: 'The steps, on a board', own: 'stepsmap', def: true },
    { id: 'syspic', step: 'frame', side: 'out', n: 'The service, drawn', hash: 'system=picture', def: true },
    { id: 'line', step: 'frame', side: 'out', n: 'The line that must not be crossed', hash: 'line', def: true },
    { id: 'stake', step: 'frame', side: 'out', n: 'Who has a stake', hash: 'stake', def: false },
    { id: 'exposure', step: 'frame', side: 'out', n: 'Who is exposed', hash: 'exposure', def: false },
    { id: 'dgather', step: 'diagnose', side: 'in', n: 'The evidence gathered', hash: 'dgather', scope: 'analyse', def: true },
    { id: 'dform', step: 'diagnose', side: 'out', n: 'The formulation', hash: 'dform', scope: 'analyse', def: true },
    { id: 'nots', step: 'diagnose', side: 'out', n: 'The twelve nots', hash: 'nots', scope: 'nots', def: true },
    { id: 'rivals', step: 'diagnose', side: 'out', n: 'Rival explanations', hash: 'rivals', scope: 'rivals', def: false },
    { id: 'combos', step: 'diagnose', side: 'out', n: 'Combinations across cases', hash: 'combos', scope: 'combos', def: false },
    { id: 'thework', step: 'model', side: 'in', n: 'The work', own: 'work', def: true },
    { id: 'tryin', step: 'model', side: 'in', n: 'Try it: the numbers', own: 'tryin', def: true },
    { id: 'tryout', step: 'model', side: 'out', n: 'Try it', own: 'tryout', def: true },
    { id: 'process', step: 'model', side: 'out', n: 'Process map', hash: 'model=process', scope: 'process', def: true },
    { id: 'bowtie', step: 'model', side: 'out', n: 'Bow tie', hash: 'model=bowtie', scope: 'bowtie', def: false },
    { id: 'systems', step: 'model', side: 'out', n: 'Systems diagram', hash: 'model=systems', scope: 'systems', def: false },
    { id: 'faulttree', step: 'model', side: 'out', n: 'Fault tree', hash: 'model=faulttree', scope: 'faulttree', def: false },
    { id: 'sna', step: 'model', side: 'out', n: 'Who is connected to whom', hash: 'model=sna', scope: 'sna', def: false },
    { id: 'tharm', step: 'model', side: 'out', n: 'The flow model', hash: 'tharm', scope: 'tharm', def: false },
    { id: 'abm', step: 'model', side: 'out', n: 'The run over time, many times', hash: 'abm', scope: 'abm', def: false },
    { id: 'cmap', step: 'model', side: 'out', n: 'The connected map', hash: 'cmap', scope: 'cmap', def: false },
    { id: 'scen', step: 'test', side: 'in', n: 'Questions and changes to try', own: 'scen', def: true },
    { id: 'compare', step: 'test', side: 'out', n: 'Each against the baseline', own: 'compare', def: true },
    { id: 'tmap', step: 'test', side: 'out', n: 'The connected map, tested', hash: 'tmap', def: false }];
  var STEP_SCOPE = { frame: 'problem', diagnose: 'analyse', model: 'evaluate', test: 'test' };

  // ---------- who, and which mode ----------
  var code = function () { return (S && S.data && S.data.session && S.data.session.session_code) || 'example'; };
  var role = function () { return (S && S.data && S.data.me && S.data.me.role) || ''; };
  var isClient = function () { return role() === 'client'; };
  // Three views (5 November 2026): Build (the team), Confirm (the client team checks and corrects), Run (a wider
  // group or a workshop watches it run; nothing saved). Confirm was called Use until today: a stored 'use' reads as confirm.
  function mode() {
    if (!S || !S.data) return 'build';
    var m = 'build'; try { m = localStorage.getItem('vt_mode:' + code()) || 'build'; } catch (e) {}
    if (m === 'use') m = 'confirm';
    if (['build', 'confirm', 'run', 'play'].indexOf(m) < 0) m = 'build';
    if (m === 'play' && (!window.VTRun || !window.VTRun.hasGame(X))) m = 'run';
    if ((m === 'run' || m === 'play') && location.pathname !== '/home') m = isClient() ? 'confirm' : 'build';
    if (isClient() && m === 'build') m = 'confirm';
    return m;
  }
  function setMode(m) {
    if (window.VTRun) window.VTRun.stop();
    try { localStorage.setItem('vt_mode:' + code(), m); } catch (e) {}
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    paintSwitch(); X.route();
  }

  // ---------- what is used and shown (Project › Used, shown and reported) ----------
  function scopeRow() { return window.VTScope && window.VTScope.row ? window.VTScope.row() : null; }
  function used(v) { var SC = window.VTScope; if (!SC) return true; if (!SC.on(STEP_SCOPE[v.step])) return false; return !v.scope || SC.on(v.scope); }
  function shownMap() { var r = scopeRow(), c = (r && r.content) || {}; return c.show || {}; }
  function shown(v) { var m = shownMap(); return used(v) && (m[v.id] == null ? v.def : !!m[v.id]); }
  function ordered(list, key) { var r = scopeRow(), o = (((r && r.content) || {}).order || {})[key] || []; return list.slice().sort(function (a, b) { var i = o.indexOf(a.id), j = o.indexOf(b.id); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || VIEWS.indexOf(a) - VIEWS.indexOf(b); }); }
  function views(step, side) { return ordered(VIEWS.filter(function (v) { return v.step === step && v.side === side && shown(v); }), step + ':' + side); }

  // ---------- the switch in the header ----------
  // The four views (5 November 2026): chosen on the project home, not in the header. A line under the header goes back.
  function paintSwitch() {
    var sw = document.getElementById('modeSw'); if (sw) sw.remove();
    if (S && S.data) document.body.classList.toggle('is-client', isClient());
  }
  function viewOfHash(h) { h = h || ''; if (!h) return ''; if (h === 'build') return 'build'; if (h === 'confirm') return 'confirm'; if (/^run/.test(h)) return 'run'; if (/^play/.test(h)) return 'play'; return 'build'; }
  function choose(v) { try { localStorage.setItem('vt_mode:' + code(), v); } catch (e) {} }
  var NAMES = { build: 'Build', confirm: 'Confirm', run: 'Run', play: 'Play' };
  function crumb(v) {
    var nm = (S && S.data && S.data.session && S.data.session.name) || 'Project';
    return el('nav', { class: 'vw-crumb', 'aria-label': 'Where you are' }, [el('a', { href: '/home' + q(), text: nm }), document.createTextNode(' › '), el('b', { text: NAMES[v] || v })]);
  }
  // the drawings: a plate seen from above at an angle, with a figure on its top face
  function iso(inner) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 190 140'); s.setAttribute('width', '190'); s.setAttribute('height', '140'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.3'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = '<g transform="translate(95,62)"><path d="M0,-44 L76,0 L0,44 L-76,0 Z"/><path d="M-76,0 L-76,10 L0,54 L76,10 L76,0"/><path d="M0,44 L0,54"/><g transform="matrix(0.866,0.5,-0.866,0.5,0,0)">' + inner + '</g></g>';
    return s;
  }
  var ART = {
    build: '<rect x="-30" y="-30" width="22" height="22"/><rect x="-4" y="-30" width="22" height="22"/><rect x="-30" y="-4" width="22" height="22"/><rect x="-4" y="-4" width="22" height="22" stroke-dasharray="3 3"/>',
    confirm: '<rect x="-28" y="-34" width="44" height="58"/><path d="M-20,-22 H8 M-20,-12 H8 M-20,-2 H0"/><path d="M-16,8 l9,9 l18,-20" stroke-width="2.4"/>',
    run: '<path d="M-34,-20 H34 M-34,0 H34 M-34,20 H34"/><circle cx="12" cy="-20" r="5" fill="currentColor"/><circle cx="-14" cy="0" r="5" fill="currentColor"/><circle cx="22" cy="20" r="5" fill="currentColor"/>',
    play: '<path d="M-34,-34 H34 V34 H-34 Z M-34,-11 H34 M-34,11 H34 M-11,-34 V34 M11,-34 V34"/><circle cx="0" cy="0" r="6" fill="currentColor"/><circle cx="-22" cy="-22" r="5"/><circle cx="22" cy="22" r="5"/>' };
  function landing(main) {
    var nm = (S && S.data && S.data.session && S.data.session.name) || 'Project';
    var list = [['build', 'Work through the four steps.'], ['confirm', 'Check and correct what has been built.'], ['run', 'Change the conditions and see what happens.'], ['play', 'Take a role and play it through.']].filter(function (v) {
      if (v[0] === 'build' && isClient()) return false;
      return true; });
    var wrap = el('div', { class: 'use-wrap' }, [el('h1', { class: 'use-h1 big vw-title', text: nm })]);
    wrap.appendChild(el('div', { class: 'vw-cards n' + list.length, id: 'viewCards' }, list.map(function (v) {
      // Play shows on every project; where the case has no game yet it says so and does not open
      if (v[0] === 'play' && !(window.VTRun && window.VTRun.hasGame(X))) return el('div', { class: 'vw-card off', 'data-view': 'play', 'aria-disabled': 'true' }, [el('div', { class: 'vw-art' }, [iso(ART.play)]), el('h2', { text: NAMES.play }), el('p', { text: v[1] }), el('span', { class: 'vw-na', text: 'Not yet available' })]);
      return el('a', { class: 'vw-card', href: '/home' + q() + '#' + v[0], 'data-view': v[0], onclick: function () { choose(v[0]); } }, [el('div', { class: 'vw-art' }, [iso(ART[v[0]])]), el('h2', { text: NAMES[v[0]] }), el('p', { text: v[1] })]); })));
    main.appendChild(wrap);
  }

  // ---------- drawing ----------
  var q = function () { return X.EXAMPLE ? location.search : ''; };
  function stepHere() { var O = X.ON || {}; return O.home ? null : O.project ? 'project' : O.analyse ? 'diagnose' : O.step === 'test' ? 'test' : O.evaluate ? 'model' : 'frame'; }
  function icon(id) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '22'); s.setAttribute('height', '22'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICON[id]; return s; }
  function render(main, x, key) {
    X = x; el = x.el; S = x.S; css(); paintSwitch();
    var onHome = location.pathname === '/home', v = onHome ? viewOfHash(key) : mode();
    document.body.classList.toggle('run-mode', v === 'run' || v === 'play');
    document.body.classList.toggle('views-home', onHome && !v);
    if (onHome && !v) return landing(main);
    if (v === 'run' || v === 'play') { main.appendChild(crumb(v)); if (window.VTRun) return window.VTRun.render(main, x, key); return; }
    if (onHome && v === 'confirm') { main.appendChild(crumb('confirm')); return home(main); }
    var step = stepHere();
    if (!step) return home(main);
    if (step === 'project') {
      main.appendChild(el('div', { class: 'use-wrap' }, [el('h1', { class: 'use-h1', text: 'Project' }), el('p', { class: 'use-sub', text: 'Running the project, what the client sees and the report are part of Build.' }), isClient() ? null : el('button', { class: 'btn solid', type: 'button', text: 'Switch to Build', onclick: function () { setMode('build'); } })]));
      return;
    }
    var m = /^use=(in|out)(?:\.([a-z0-9]+))?$/.exec(key || ''), side = m ? m[1] : 'out', want = m && m[2];
    var info = STEPS.filter(function (s) { return s[0] === step; })[0];
    var list = views(step, side), cur = list.filter(function (v) { return v.id === want; })[0] || list[0];
    main.appendChild(crumb('confirm'));
    var wrap = el('div', { class: 'use-wrap' });
    wrap.appendChild(el('div', { class: 'use-bar' }, [el('a', { href: '/home' + q() + '#confirm', class: 'use-back', text: '‹ Confirm' }), el('h1', { class: 'use-h1', text: info[1] }), el('span', { class: 'use-grow' }),
      el('div', { class: 'use-seg', role: 'group', 'aria-label': 'Inputs or results' }, [['in', 'Inputs'], ['out', 'Results']].map(function (o) { return el('a', { href: '#use=' + o[0], 'data-side': o[0], 'aria-current': o[0] === side ? 'page' : null, class: o[0] === side ? 'on' : '', text: o[1] }); }))]));
    if (!list.length) { wrap.appendChild(el('p', { class: 'use-sub', text: 'Nothing has been chosen to show here yet.' + (isClient() ? '' : ' Choose in Build, under Project › Used, shown and reported.') })); main.appendChild(wrap); return; }
    if (list.length > 1) wrap.appendChild(el('div', { class: 'use-tabs', role: 'tablist', 'aria-label': info[1] + ' ' + (side === 'in' ? 'inputs' : 'results') }, list.map(function (v) { return el('a', { role: 'tab', href: '#use=' + side + '.' + v.id, 'data-uview': v.id, 'aria-selected': String(v === cur), class: v === cur ? 'on' : '', text: v.n }); })));
    var RVW = window.VTReview, rb = RVW ? RVW.bar(step) : null;
    if (rb) wrap.appendChild(rb);
    var host = el('div', { class: 'use-host', 'data-uview': cur.id }), aside = rb ? el('aside', { class: 'rv-margin', 'aria-label': 'Changes and comments' }) : null;
    wrap.appendChild(aside ? el('div', { class: 'rv-grid' }, [host, aside]) : host); main.appendChild(wrap);
    var undo = RVW ? RVW.swapIn(step) : null;
    try {
      if (cur.own) { var f = OWN[cur.own]; if (f) f(host); else host.appendChild(el('p', { class: 'meta', text: 'Not available yet.' })); }
      else X.renderHash(host, cur.hash);
    } finally { if (undo) undo(); }
    if (RVW && aside) RVW.after(step, host, aside);
    wrap.appendChild(el('p', { class: 'use-note', text: X.S.readonly ? 'An example: read-only.' : 'Anything changed here is saved to the project straight away, with who changed it and when.' }));
  }
  function home(main) {
    var wrap = el('div', { class: 'use-wrap' });
    wrap.appendChild(el('h1', { class: 'use-h1 big', text: 'Confirm' }));
    wrap.appendChild(el('p', { class: 'use-sub', text: 'Check and correct what has been built. Each step has what goes in, and what comes out.' }));
    var g = el('div', { class: 'use-steps', id: 'useSteps' });
    STEPS.forEach(function (s) {
      var SC = window.VTScope; if (SC && !SC.on(STEP_SCOPE[s[0]])) return;
      var nin = views(s[0], 'in').length, nout = views(s[0], 'out').length;
      g.appendChild(el('section', { class: 'use-step', 'data-ustep': s[0] }, [el('div', { class: 'use-ic' }, [icon(s[0])]), el('h2', { text: s[1] }), el('p', { text: s[2] }),
        el('div', { class: 'use-btns' }, [nin ? el('a', { class: 'use-b in', href: s[3] + q() + '#use=in', text: 'Inputs' }) : el('span', { class: 'use-b none', text: 'No inputs shown' }), nout ? el('a', { class: 'use-b out', href: s[3] + q() + '#use=out', text: 'Results' }) : el('span', { class: 'use-b none', text: 'No results shown' })])]));
    });
    wrap.appendChild(g);
    if (window.VTReview) window.VTReview.homeCounts(g);
    wrap.appendChild(el('p', { class: 'use-note', text: X.S.readonly ? 'An example: read-only.' : 'Anything changed here is saved to the project, with who changed it and when. The team then accepts or rejects each change.' }));
    main.appendChild(wrap);
  }

  // ---------- the views drawn here (filled in by use-model.js where present) ----------
  var OWN = {
    work: function (host) { if (window.VTWork) window.VTWork.render(host, X); }
  };

  // ---------- for Build: the changes made in Use ----------
  function changesCard() {
    if (window.VTReview) return window.VTReview.buildCard();
    var box = el('div', { class: 'glass evbox use-changes', id: 'useChanges', style: 'margin-top:16px' }, [el('h3', { style: 'margin:0 0 6px', text: 'Changes made in Confirm' }), el('p', { class: 'sm muted', style: 'margin:0 0 8px', text: 'Saved straight into the project. Each counts as level 1 evidence (said) until checked. Earlier versions are kept in each part’s history.' })]);
    var list = el('div', { class: 'sm', text: 'Loading…' }); box.appendChild(list);
    X.api({ action: 'p_uselog' }).then(function (d) {
      list.textContent = '';
      var cs = (d && d.changes) || [];
      if (!cs.length) { list.textContent = 'None yet.'; return; }
      cs.slice(0, 12).forEach(function (c) { list.appendChild(el('div', { class: 'use-chg' }, [el('b', { text: c.summary || c.tile_key || 'A change' }), el('span', { class: 'muted', text: ' · ' + c.by + ' · ' + new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · level 1, said' })])); });
      if (cs.length > 12) list.appendChild(el('div', { class: 'muted', text: (cs.length - 12) + ' earlier changes are in the history of each part.' }));
    }).catch(function () { list.textContent = 'Could not load the changes.'; });
    return box;
  }

  function css() {
    if (document.getElementById('useCss')) return;
    var s = document.createElement('style'); s.id = 'useCss';
    s.textContent = '.modesw{display:inline-flex;border:1px solid var(--line,rgba(127,127,127,.35));border-radius:999px;padding:3px;margin:0 12px;flex:none}.modesw button{font:600 13px "DM Sans",system-ui,sans-serif;border:0;background:none;color:var(--muted,#888);padding:7px 16px;border-radius:999px;cursor:pointer;min-height:34px}.modesw button[aria-pressed="true"]{background:var(--paper,#141414);color:var(--bg,#f4f3f0)}' +
      'body.is-client [data-nav="project"]{display:none}' +
      'body.use-mode #subtabs,body.use-mode #saveBar,body.use-mode .tkbar,body.use-mode .tkcrumb,body.use-mode .evq,body.use-mode .evqsum,body.use-mode .ev-bar,body.use-mode #mPredict,body.use-mode #mEdit,body.use-mode .fxfoot,body.use-mode .fxnext,body.use-mode .ph-more,body.use-mode .ph-next,body.use-mode .fxback,body.use-mode .crumb,body.use-mode .fcfoot,body.use-mode .fxsendback,body.use-mode .fxpath,body.use-mode .vsw,body.use-mode .tk,body.use-mode .tkdeco,body.use-mode .wklink,body.use-mode .wkbars,body.use-mode .fxlenspanel,body.use-mode .mdepth,body.use-mode .needbtn,body.use-mode .needs,body.use-mode .mtabs,body.use-mode .use-host>.kick,body.use-mode .use-host>h1.wide,body.use-mode .no-use{display:none!important}' +
      '.use-wrap{max-width:1180px;margin:0 auto;padding:26px 0 40px}.use-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:14px}.use-back{font-size:14px}.use-h1{font-family:Outfit,"DM Sans",sans-serif;font-weight:400;font-size:34px;margin:0}.use-h1.big{font-weight:300;font-size:52px;margin:0 0 8px}.use-grow{flex:1}' +
      '.use-sub{color:var(--muted,#888);font-size:17px;max-width:760px;line-height:1.5;margin:0 0 30px}.use-seg{display:inline-flex;border:1px solid var(--line,rgba(127,127,127,.35));border-radius:999px;padding:3px}.use-seg a{padding:9px 18px;border-radius:999px;font-size:14px;text-decoration:none;color:inherit;opacity:.75}.use-seg a.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0);opacity:1;font-weight:600}' +
      '.use-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}.use-tabs a{padding:9px 15px;border-radius:999px;border:1px solid var(--line,rgba(127,127,127,.35));font-size:14px;text-decoration:none;color:inherit}.use-tabs a.on{border-color:var(--accent,#e07030);background:rgba(224,112,48,.12);font-weight:600}' +
      '.use-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}@media(max-width:900px){.use-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.use-steps{grid-template-columns:1fr}}' +
      '.use-step{border:1px solid var(--line,rgba(127,127,127,.3));border-radius:22px;padding:24px;background:rgba(127,127,127,.06);display:flex;flex-direction:column;gap:12px;min-height:280px}.use-step h2{font-family:Outfit,"DM Sans",sans-serif;font-weight:400;font-size:28px;margin:0}.use-step p{margin:0;color:var(--muted,#888);font-size:14px;line-height:1.5;flex:1}' +
      '.use-ic{width:44px;height:44px;border-radius:12px;border:1px solid var(--accent,#e07030);display:flex;align-items:center;justify-content:center;stroke:var(--accent,#e07030);fill:none;stroke-width:1.6}.use-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}.use-b{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;text-align:center}.use-b.in{border:1px solid var(--line,rgba(127,127,127,.5));color:inherit}.use-b.out{background:var(--accent,#e07030);color:#140a04}.use-b.none{font-weight:400;font-size:12px;color:var(--muted,#888);border:1px dashed var(--line,rgba(127,127,127,.35))}' +
      '.vw-crumb{max-width:1180px;margin:14px auto 0;font-size:13px;color:var(--muted,#888)}.vw-crumb a{color:var(--accent,#e07030);text-decoration:none}.vw-crumb b{color:var(--paper,#f4f3f0);font-weight:600}' +
      'body.views-home [data-nav]:not([data-nav="hub"]):not([data-nav="about"]){display:none}.vw-title{margin:0 0 22px!important}.vw-cards{display:grid;gap:16px;grid-template-columns:repeat(4,minmax(0,1fr))}.vw-cards.n3{grid-template-columns:repeat(3,minmax(0,1fr))}.vw-cards.n2{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:900px){.vw-cards,.vw-cards.n3{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.vw-cards,.vw-cards.n3,.vw-cards.n2{grid-template-columns:1fr}}' +
      '.vw-card.off{opacity:.5;border-style:dashed;cursor:default}.vw-card.off:hover{border-color:var(--line,rgba(127,127,127,.3))}.vw-na{font-size:13px;margin-top:auto;padding-top:10px;color:var(--muted,#888)}.vw-card{display:flex;flex-direction:column;gap:8px;padding:28px 26px;min-height:300px;border:1px solid var(--line,rgba(127,127,127,.3));background:rgba(127,127,127,.04);color:inherit;text-decoration:none}.vw-card:hover,.vw-card:focus-visible{border-color:var(--accent,#e07030)}.vw-art{height:150px;color:var(--paper,#f4f3f0)}.vw-card h2{font-family:Outfit,"DM Sans",sans-serif;font-weight:400;font-size:36px;margin:14px 0 0}.vw-card p{margin:0;font-size:15px;line-height:1.45;color:var(--muted,#888)}' +
      '.use-note{font-size:13px;color:var(--muted,#888);margin-top:22px}.use-host{min-height:200px}.use-chg{padding:6px 0;border-top:1px solid var(--line,rgba(127,127,127,.2))}';
    document.head.appendChild(s);
  }

  window.VTUse = {
    init: function (x) { X = x; el = x.el; S = x.S; css(); paintSwitch(); if (window.VTUseModel) window.VTUseModel.attach(x); if (window.VTUseMap) window.VTUseMap.attach(x); if (window.VTReview) window.VTReview.attach(x); document.body.classList.toggle('is-client', isClient()); },
    isUse: function () { if (location.pathname === '/home') { var v = viewOfHash(location.hash.replace(/^#/, '')); if (v) choose(v); return v !== 'build'; } return mode() !== 'build'; }, crumb: function (v) { return crumb(v); }, viewOfHash: viewOfHash, isConfirm: function () { return mode() === 'confirm'; }, isRun: function () { return mode() === 'run' || mode() === 'play'; },
    stepNow: function () { return stepHere(); }, viewNow: function () { var h = document.querySelector('.use-host'); return (h && h.getAttribute('data-uview')) || ''; },
    isClient: isClient, mode: mode, setMode: setMode, render: render, changesCard: changesCard,
    VIEWS: VIEWS, views: views, used: used, shown: shown, OWN: OWN, STEPS: STEPS
  };
})();
