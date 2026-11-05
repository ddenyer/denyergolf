// Run (5 November 2026): the third view, beside Build and Confirm.
// For a wider group or a workshop: watch the case run and try a change. Nothing in Run is saved to the project.
// Two kinds of piece, drawn from what the project holds:
//   a story (a timed account with players on a map, such as Friendly Fire), from the 'run' tile;
//   a service (the flow model in Model), run hour by hour from the same simulation the Lab already uses.
// Plus "each question against the baseline", the Confirm results view shown read-only.
(function () {
  'use strict';
  var X, el, S;
  var R = { t: null, playing: false, speed: 120, raf: 0, last: 0, stopsOn: true, stopped: {}, runs: [], on: {}, hold: null, held: false, tab: 'map', piece: '', scen: '', h: 0, flow: null, flowKey: '', solo: '', ask: null, seat: 'all', view: 'map', dz: false, rp: null };
  var SPEEDS = [[30, '× 30'], [120, '× 120'], [600, '× 600'], [1800, '× 1800']], FSPEEDS = [[1, '1 hour a second'], [4, '4 hours a second'], [12, '12 hours a second']];
  var hm = function (t) { t = Math.max(0, Math.round(t)); return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Light and dark (5 November 2026): the drawings are written in the dark palette and translated when the light theme is on
  var isLight = function () { return document.documentElement.getAttribute('data-theme') === 'light'; };
  var LIGHT = [['#121619', '#eef1f2'], ['#171c1a', '#e2e6e1'], ['#0f1214', '#f4f5f6'], ['#111312', '#f4f5f3'], ['#c9c2ba', '#5a5550'], ['#7fd99a', '#23824a'], ['#9fd0ff', '#2467b8'], ['#ff8f6a', '#c4502f'], ['#ff9f8a', '#b8432a'], ['#f0ede8', '#1c1b1a']];
  function th(svg) {
    if (!isLight()) return svg;
    svg = svg.split('rgba(0,0,0,.6)').join('@CAP@').split('rgba(255,255,255,').join('rgba(0,0,0,').split('@CAP@').join('rgba(255,255,255,.9)');
    LIGHT.forEach(function (p) { svg = svg.split(p[0]).join(p[1]); });
    return svg;
  }
  function cc(c) { if (!isLight()) return c; var m = LIGHT.filter(function (p) { return p[0] === c; })[0]; return m ? m[1] : c; }
  function story() { var r = X.row('run'); return (r && r.content && r.content.story) || null; }
  function inv() { try { return X.invData(); } catch (e) { return null; } }
  function hasFlow(v) { return !!(v && v.abm && (v.abm.procs || []).length && window.VTModel && window.VTModel._sim); }
  function scens(v) { return [{ id: '', n: 'As things are now' }].concat((v.scenarios || []).filter(function (s) { return ((v.abm || {}).shocks || []).some(function (x) { return x.s === s.id; }); })); }
  // Run tests the system (no roles); Play is the game (roles, decisions, debrief). 5 November 2026: four views.
  function hasGame(st) { return !!(st && ((st.decisions || []).length || (st.roles || []).length)); }
  function pieces() {
    var out = [], st = story(), v = inv();
    if (st && (st.barriers || []).length) out.push({ id: 'explore', n: 'Try a change', d: 'Put back what was missing and run the morning again.' });
    if (hasFlow(v)) out.push({ id: 'flow', n: 'The service, as it runs', d: 'Each step, hour by hour, against the line that must not be crossed.' });
    if (hasFlow(v) && scens(v).length > 1) out.push({ id: 'compare', n: 'Each question against the baseline', d: 'Every question the team has asked, against the way things are now.' });
    return out;
  }
  function stopAnim() { if (R.raf) cancelAnimationFrame(R.raf); R.raf = 0; R.playing = false; }

  // ---------- entry ----------
  function render(main, x, key) {
    X = x; el = x.el; S = x.S; css(); stopAnim();
    key = key || '';
    // older addresses: #run=story.replay and .after belong to Play now; .try is Run's Explore
    var old = /^run=story(?:\.([a-z]+))?/.exec(key);
    if (old) key = (!old[1] || old[1] === 'try') ? 'run=explore' : 'play=' + (['map', 'lanes', 'should'].indexOf(old[1]) >= 0 ? 'after' : old[1]);
    var wrap = el('div', { class: 'run-wrap' });
    main.appendChild(wrap);
    if (/^play/.test(key)) return playView(wrap, (/^play=([a-z]+)/.exec(key) || [])[1]);
    var m = /^run=([a-z]+)/.exec(key), list = pieces();
    if (!m) return home(wrap, list);
    var p = list.filter(function (z) { return z.id === m[1]; })[0];
    if (!p) { wrap.appendChild(el('p', { class: 'run-sub', text: 'That is not available in this project.' })); return home(wrap, list); }
    if (R.piece !== p.id) { R.piece = p.id; R.t = null; R.stopped = {}; R.hold = null; R.held = false; R.h = 0; }
    wrap.appendChild(el('div', { class: 'run-top' }, [el('a', { href: '#run', class: 'run-back', text: '‹ Run' }), el('h1', { class: 'run-h1', text: p.n }), el('span', { class: 'run-sub2', text: p.id === 'explore' ? (story().title || '') : '' })]));
    if (p.id === 'explore') { storyView(wrap, 'try', 'run'); return dzWalk(wrap); }
    if (p.id === 'flow') return flowView(wrap);
    if (p.id === 'compare') { var h = el('div', { class: 'use-host' }); wrap.appendChild(h); var ro = S.readonly; S.readonly = true; try { window.VTUse.OWN.compare(h); } finally { S.readonly = ro; } }
  }
  function home(wrap, list) {
    wrap.appendChild(el('h1', { class: 'run-h1 big', text: 'Run' }));
    wrap.appendChild(el('p', { class: 'run-sub', text: 'Change the conditions and see what happens. Nothing done here changes the project.' }));
    if (!list.length) { wrap.appendChild(el('p', { class: 'run-sub', text: 'Nothing to run yet. A flow model in Model, or a case with barriers, gives Run something to test.' })); return; }
    wrap.appendChild(el('div', { class: 'run-cards', id: 'runCards' }, list.map(function (p) { return el('a', { class: 'run-card', href: '#run=' + p.id, 'data-piece': p.id }, [el('h2', { text: p.n }), el('p', { text: p.d }), el('span', { class: 'run-go', text: 'Open ›' })]); })));
  }
  // ---------- Play: the game ----------
  function playView(wrap, tab) {
    var st = story();
    if (!hasGame(st)) { wrap.appendChild(el('h1', { class: 'run-h1 big', text: 'Play' })); wrap.appendChild(el('p', { class: 'run-sub', text: 'No game has been set up for this project.' })); return; }
    if (R.piece !== 'play') { R.piece = 'play'; R.t = null; R.stopped = {}; }
    if (!tab) {
      wrap.appendChild(el('h1', { class: 'run-h1 big', text: 'Play' }));
      wrap.appendChild(el('p', { class: 'run-sub', text: (st.title || '') + (st.sub ? ', ' + st.sub : '') + '. Take a role, decide as it unfolds, then look back.' }));
      var modes = [['live', 'Play live', 'Everyone on their own device, each in a role.', false], ['replay', 'Replay: stop and decide', 'On one screen. Decide before you see what happened.', true], ['after', 'After the event', 'See it as each role saw it, and debrief.', true]];
      wrap.appendChild(el('div', { class: 'run-cards', id: 'playCards' }, modes.map(function (o) { return o[3] ? el('a', { class: 'run-card', href: '#play=' + o[0], 'data-mode': o[0] }, [el('h2', { text: o[1] }), el('p', { text: o[2] }), el('span', { class: 'run-go', text: 'Open ›' })]) : el('div', { class: 'run-card off', 'data-mode': o[0] }, [el('h2', { text: o[1] }), el('p', { text: o[2] }), el('span', { class: 'run-dim', text: 'Being built' })]); })));
      if ((st.barriers || []).length) wrap.appendChild(el('p', { class: 'run-note' }, [document.createTextNode('Afterwards, test which changes would have mattered: '), el('a', { href: '#run=explore', text: 'Run › Try a change' }), document.createTextNode('.')]));
      return dzWalk(wrap);
    }
    wrap.appendChild(el('div', { class: 'run-top' }, [el('a', { href: '#play', class: 'run-back', text: '‹ Play' }), el('h1', { class: 'run-h1', text: st.title || 'Play' }), el('span', { class: 'run-sub2', text: st.sub || '' })]));
    storyView(wrap, tab === 'after' ? 'after' : 'replay', 'play');
    dzWalk(wrap);
  }

  // ---------- a story ----------
  function storyView(wrap, tab, where) {
    var st = story(); R.tab = tab;
    if (R.t == null) R.t = st.t0;
    var TABS = where === 'play' ? [['replay', 'Replay: stop and decide'], ['after', 'After the event']] : [];
    if (!(st.decisions || []).length) TABS = TABS.filter(function (t) { return t[0] !== 'replay'; });
    wrap.appendChild(el('div', { class: 'run-tabs', role: 'tablist' }, TABS.map(function (t) { return el('a', { role: 'tab', href: '#play=' + t[0], 'data-tab': t[0], 'aria-selected': String(t[0] === tab), class: t[0] === tab ? 'on' : '', text: t[1] }); }).concat([el('span', { class: 'run-grow' }), el('label', { class: 'run-chk' }, [el('input', { type: 'checkbox', id: 'runDz', checked: R.dz, onchange: function (e) { R.dz = e.target.checked; X.render(); } }), document.createTextNode(' Disguise the names')])])));
    if (tab === 'replay') return replayView(wrap, st);
    var stage = el('div', { class: 'run-stage', id: 'runStage' });
    if (tab === 'after') {
      wrap.appendChild(seeAs(st));
      wrap.appendChild(el('div', { class: 'run-tabs sub' }, [['map', 'On the map'], ['lanes', 'Who knew what, and when'], ['should', 'Planned against what happened']].map(function (v) { return el('button', { type: 'button', 'data-view': v[0], class: R.view === v[0] ? 'on' : '', text: v[1], onclick: function () { R.view = v[0]; X.render(); } }); })));
    }
    wrap.appendChild(stage);
    var view = tab === 'after' ? R.view : tab;
    if (tab === 'try') { tryPanel(stage, st); }
    else if (tab === 'after' && R.seat === 'every' && view === 'map') { stage.appendChild(el('div', { class: 'run-grid', id: 'runGrid' })); }
    else if (view === 'map') { stage.appendChild(el('div', { class: 'run-map', id: 'runMap' })); stage.appendChild(el('div', { class: 'run-side', id: 'runSide' })); }
    else if (view === 'lanes') { stage.appendChild(el('div', { class: 'run-map wide', id: 'runLanes' })); }
    else if (view === 'should') { stage.appendChild(el('div', { class: 'run-two' }, [el('div', {}, [el('div', { class: 'run-k green', text: 'What should happen' }), el('div', { class: 'run-map', id: 'runMapS' })]), el('div', {}, [el('div', { class: 'run-k red', text: 'What happened' }), el('div', { class: 'run-map', id: 'runMapD' })])])); }
    wrap.appendChild(playBar(st));
    if (view === 'should') wrap.appendChild(el('div', { class: 'run-steps', id: 'runSteps' }));
    if (tab === 'try') wrap.appendChild(el('div', { class: 'run-tryres', id: 'runTryRes' }));
    if (tab === 'after') wrap.appendChild(lensPanel(st, R.rp && R.rp.started ? R.rp : null));
    wrap.appendChild(el('p', { class: 'run-note', text: st.note || '' }));
    paint();
  }
  // "See it as": everything, one role at a time, or every role at once
  function seeAs(st) {
    var opts = [['all', 'Everything']].concat((st.roles || []).map(function (r) { return [r.id, r.n]; })).concat([['every', 'Every role at once']]);
    return el('div', { class: 'run-seeas' }, [el('span', { class: 'run-k', style: 'margin:0', text: 'See it as' })].concat(opts.map(function (o) { return el('button', { type: 'button', class: 'run-chip' + (R.seat === o[0] ? ' on' : ''), 'data-seat': o[0], text: o[1], onclick: function () { R.seat = o[0]; X.render(); } }); })));
  }
  function playBar(st) {
    var bar = el('div', { class: 'run-bar', id: 'runBar' });
    bar.appendChild(el('div', { class: 'run-ctl' }, [el('span', { class: 'run-clock', id: 'runClock', text: hm(R.t) }),
      el('button', { type: 'button', class: 'run-b pri big', id: 'runPlay', text: R.playing ? '❚❚ Pause' : '▶ Play', onclick: function () { if (R.playing) stopAnim(); else play(); paint(); } }),
      el('button', { type: 'button', class: 'run-b', id: 'runReset', text: '↺ From the start', onclick: function () { stopAnim(); R.t = st.t0; R.stopped = {}; R.held = false; paint(); } }),
      el('div', { class: 'run-seg', role: 'group', 'aria-label': 'Speed' }, SPEEDS.map(function (s) { return el('button', { type: 'button', 'aria-pressed': String(R.speed === s[0]), class: R.speed === s[0] ? 'on' : '', text: s[1], onclick: function () { R.speed = s[0]; X.render(); } }); })),
      el('label', { class: 'run-chk' }, [el('input', { type: 'checkbox', checked: R.stopsOn, onchange: function (e) { R.stopsOn = e.target.checked; } }), document.createTextNode(' Workshop stops')]),
      el('span', { class: 'run-grow' }), el('span', { class: 'run-dim', text: st.date || '' })]));
    var sl = el('input', { type: 'range', class: 'run-range', id: 'runRange', min: String(st.t0), max: String(st.t1), step: '1', value: String(R.t), 'aria-label': 'Time' });
    sl.addEventListener('input', function () { stopAnim(); R.t = Number(sl.value); R.held = false; paint(); });
    bar.appendChild(sl);
    bar.appendChild(el('div', { class: 'run-ticks', id: 'runTicks' }));
    bar.appendChild(el('div', { class: 'run-chips' }, (st.jumps || []).map(function (j) { return el('button', { type: 'button', class: 'run-chip' + (j.red ? ' red' : ''), text: hm(j.t) + ' ' + j.n, onclick: function () { stopAnim(); R.t = j.t; R.held = false; paint(); } }); })));
    return bar;
  }
  function play() {
    var st = story(); if (R.t >= st.t1) { R.t = st.t0; R.stopped = {}; R.held = false; }
    R.playing = true; R.last = performance.now(); R.ask = null;
    var tick = function (now) {
      if (!R.playing) return;
      var dt = Math.min(0.25, (now - R.last) / 1000); R.last = now;
      var nt = R.t + dt * R.speed / 60, cross = null;
      if (R.tab === 'try' && R.hold && R.t < R.hold.t && nt >= R.hold.t) { R.t = R.hold.t; R.held = true; stopAnim(); record(); paint(); return; }
      if (R.tab === 'replay' && R.rp) { var nd = nextDp(st); if (nd && R.t < nd.t + 0.001 && nt >= nd.t) { R.t = nd.t; stopAnim(); R.rp.phase = 'decide'; R.rp.cur = nd.id; paintReplay(); return; } }
      if (R.stopsOn && R.tab !== 'try' && R.tab !== 'replay') (st.stops || []).forEach(function (s, i) { if (!R.stopped[i] && R.t < s.t && nt >= s.t && !cross) cross = [s, i]; });
      if (cross) { R.t = cross[0].t; R.stopped[cross[1]] = 1; stopAnim(); R.ask = cross[0].q; paint(); return; }
      R.t = Math.min(st.t1, nt);
      if (R.t >= st.t1) { stopAnim(); if (R.tab === 'try') record(); if (R.tab === 'replay' && R.rp) { R.rp.phase = 'end'; paintReplay(); return; } }
      paint();
      if (R.playing) R.raf = requestAnimationFrame(tick);
    };
    R.raf = requestAnimationFrame(tick);
  }
  // what is visible depends on the tab; everything is redrawn from the clock
  function paint() {
    var st = story(); if (!st) return;
    var t = R.t, c = document.getElementById('runClock'); if (c) c.textContent = hm(t);
    var rg = document.getElementById('runRange'); if (rg && Number(rg.value) !== Math.round(t)) rg.value = String(Math.round(t));
    var pb = document.getElementById('runPlay'); if (pb) pb.textContent = R.playing ? '❚❚ Pause' : '▶ Play';
    ticks(st);
    var m = document.getElementById('runMap'); if (m) m.innerHTML = th(mapSvg(st, t, 'path'));
    var ms = document.getElementById('runMapS'); if (ms) ms.innerHTML = th(mapSvg(st, t, 'should'));
    var md = document.getElementById('runMapD'); if (md) md.innerHTML = th(mapSvg(st, t, 'path'));
    var ln = document.getElementById('runLanes'); if (ln) ln.innerHTML = th(lanesSvg(st, t));
    var gr = document.getElementById('runGrid'); if (gr) grid(gr, st, t);
    var sd = document.getElementById('runSide'); if (sd) { if (R.tab === 'replay') replaySide(sd, st, t); else if (R.seat !== 'all' && R.seat !== 'every') seatSide(sd, st, t, R.seat); else side(sd, st, t); }
    var sp = document.getElementById('runSteps'); if (sp) steps(sp, st, t);
    var tr = document.getElementById('runTryRes'); if (tr) tryRes(tr, st, t);
    var ov = document.getElementById('runAsk');
    if (R.ask && !ov) { var stage = document.getElementById('runStage'); if (stage) stage.appendChild(el('div', { class: 'run-ask', id: 'runAsk', role: 'dialog', 'aria-label': 'A question for the room' }, [el('div', { class: 'run-k', text: 'Stop here and ask the room' }), el('div', { class: 'run-askq', text: R.ask }), el('button', { type: 'button', class: 'run-b pri big', text: 'Carry on', onclick: function () { R.ask = null; var o = document.getElementById('runAsk'); if (o) o.remove(); play(); } })])); }
    if (!R.ask && ov) ov.remove();
    if (R.dz) dzWalk(document.querySelector('.run-wrap'));
  }
  function ticks(st) {
    var box = document.getElementById('runTicks'); if (!box || box.childNodes.length) return;
    var W = st.t1 - st.t0, s = '<svg viewBox="0 0 1000 18" preserveAspectRatio="none" width="100%" height="18" aria-hidden="true">';
    (st.events || []).forEach(function (e) { var x = (e.t - st.t0) / W * 1000; s += '<rect x="' + (x - 1) + '" y="4" width="2" height="10" fill="' + (laneC(st, e.lane)) + '"/>'; });
    if (st.line) s += '<rect x="' + ((st.line.t - st.t0) / W * 1000 - 2) + '" y="0" width="4" height="18" fill="#e85f45"/>';
    (st.stops || []).forEach(function (p) { s += '<circle cx="' + ((p.t - st.t0) / W * 1000) + '" cy="9" r="3.5" fill="#f0ede8"/>'; });
    box.innerHTML = th(s + '</svg>');
  }
  function laneC(st, id) { var l = (st.lanes || []).filter(function (x) { return x.id === id; })[0]; return l ? l.c : '#f0ede8'; }
  function at(path, t) {
    if (!path || !path.length || t < path[0][0]) return null;
    for (var i = 1; i < path.length; i++) if (t <= path[i][0]) { var a = path[i - 1], b = path[i], f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, Math.atan2(b[2] - a[2], b[1] - a[1]) * 180 / Math.PI]; }
    var l = path[path.length - 1], p = path[path.length - 2] || l; return [l[1], l[2], Math.atan2(l[2] - p[2], l[1] - p[1]) * 180 / Math.PI];
  }
  function trail(path, t) {
    var pts = []; if (!path) return '';
    for (var i = 0; i < path.length && path[i][0] <= t; i++) pts.push(path[i][1] + ',' + path[i][2]);
    var now = at(path, t); if (now && pts.length) pts.push(now[0].toFixed(1) + ',' + now[1].toFixed(1));
    return pts.length > 1 ? pts.join(' ') : '';
  }
  var SHAPE = {
    heli: function (c) { return '<ellipse rx="9" ry="4.5" fill="' + c + '"/><line x1="-14" y1="-6" x2="14" y2="-6" stroke="' + c + '" stroke-width="2"/><line x1="-9" y1="0" x2="-17" y2="-2" stroke="' + c + '" stroke-width="2"/>'; },
    jet: function (c) { return '<path d="M14,0 L-8,-9 L-4,0 L-8,9 Z" fill="' + c + '"/>'; },
    awacs: function (c) { return '<path d="M16,0 L-10,-12 L-6,0 L-10,12 Z" fill="' + c + '"/><ellipse rx="9" ry="3.5" fill="none" stroke="' + c + '" stroke-width="2"/>'; },
    dot: function (c) { return '<circle r="7" fill="' + c + '"/>'; }
  };
  function mapSvg(st, t, which) {
    var M = st.map || { w: 900, h: 520, shapes: [] }, s = '<svg viewBox="0 0 ' + M.w + ' ' + M.h + '" width="100%" role="img" aria-label="' + esc(st.title) + ' at ' + hm(t) + '" style="display:block">';
    s += '<defs><pattern id="rmt" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0,10 L5,3 L10,10" fill="none" stroke="rgba(255,255,255,.12)"/></pattern></defs>';
    s += '<rect width="' + M.w + '" height="' + M.h + '" fill="' + (M.bg || '#121619') + '"/>';
    (M.shapes || []).forEach(function (z) {
      if (z.k === 'path') s += '<path d="' + z.d + '" fill="' + (z.fill || 'none') + '"' + (z.stroke ? ' stroke="' + z.stroke + '" stroke-width="' + (z.w || 1) + '"' : '') + (z.dash ? ' stroke-dasharray="' + z.dash + '"' : '') + '/>';
      else if (z.k === 'hatch') s += '<path d="' + z.d + '" fill="url(#rmt)"/>';
      else if (z.k === 'label') s += '<text x="' + z.x + '" y="' + z.y + '" text-anchor="' + (z.anchor || 'start') + '" class="rl' + (z.cap ? ' cap' : '') + '"' + (z.fill ? ' fill="' + z.fill + '"' : '') + '>' + esc(z.cap ? String(z.t).toUpperCase() : z.t) + '</text>';
      else if (z.k === 'place') s += '<circle cx="' + z.x + '" cy="' + z.y + '" r="5" fill="#c9c2ba"/><text x="' + (z.x + 10) + '" y="' + (z.y - 4) + '" class="rp">' + esc(z.t) + '</text>';
    });
    var placed = [];
    (st.players || []).forEach(function (p) {
      var path = which === 'should' ? (p.should || p.path) : p.path, tr = trail(path, t), how0 = which === 'should' ? 'shown' : vis(st, R.seatMap || R.seat, p.id, t);
      if (tr && p.kind !== 'awacs' && (how0 === 'shown' || how0 === 'own')) s += '<polyline points="' + tr + '" fill="none" stroke="' + p.c + '" stroke-opacity=".55" stroke-width="2.2"/>';
      var pos = at(path, t); if (!pos) return;
      var how = which === 'should' ? 'shown' : vis(st, R.seatMap || R.seat, p.id, t);
      if (how === 'hidden') return;
      if (how === 'unknown') { s += '<g transform="translate(' + pos[0].toFixed(1) + ',' + pos[1].toFixed(1) + ')"><path d="M0,-10 L10,0 L0,10 L-10,0 Z" fill="none" stroke="#ff9f8a" stroke-width="2"/><text y="4" text-anchor="middle" class="rn" fill="#ff9f8a">?</text></g><text x="' + (pos[0] + 14).toFixed(0) + '" y="' + (pos[1] - 12).toFixed(0) + '" class="rn" fill="#ff9f8a">Unknown contact</text>'; return; }
      var op = how === 'faint' ? 0.35 : how === 'flicker' ? (Math.sin(t * 2.2) > -0.2 ? 0.9 : 0.15) : 1;
      s += '<g opacity="' + op + '">';
      var lost = which !== 'should' && p.end && t >= p.end.t;
      if (lost) { s += '<g transform="translate(' + pos[0] + ',' + pos[1] + ')"><circle r="16" fill="none" stroke="#e85f45" stroke-width="2"/><path d="M-8,-8 L8,8 M8,-8 L-8,8" stroke="#e85f45" stroke-width="3"/></g></g>'; return; }
      var rot = p.kind === 'heli' ? 0 : pos[2];
      s += '<g transform="translate(' + pos[0].toFixed(1) + ',' + pos[1].toFixed(1) + ') rotate(' + rot.toFixed(0) + ')">' + (SHAPE[p.kind] || SHAPE.dot)(p.c) + '</g>';
      // a name close to one already placed goes below its aircraft instead of above
      var ly = pos[1] - 12; if (placed.some(function (q) { return Math.abs(q[0] - pos[0]) < 140 && Math.abs(q[1] - ly) < 16; })) ly = pos[1] + 24; placed.push([pos[0], ly]);
      s += '<text x="' + (pos[0] + 14).toFixed(0) + '" y="' + ly.toFixed(0) + '" class="rn" fill="' + p.c + '">' + esc(p.n) + '</text></g>';
    });
    // the last radio call, near the bottom of the map
    var sq = R.seatMap || R.seat, last = (st.events || []).filter(function (e) { return e.radio && e.t <= t && t - e.t < 4 && hears(st, sq, e); }).slice(-1)[0];
    if (last && which !== 'should') s += '<rect x="20" y="' + (M.h - 64) + '" width="' + (M.w - 40) + '" height="34" rx="8" fill="rgba(0,0,0,.6)"/><text x="' + (M.w / 2) + '" y="' + (M.h - 42) + '" text-anchor="middle" class="rq">' + esc(hm(last.t) + '  ' + last.t2) + '</text>';
    if (st.line && t >= st.line.t && which !== 'should') s += '<rect x="0" y="0" width="' + M.w + '" height="6" fill="#e85f45"/>';
    s += '<text x="12" y="' + (M.h - 10) + '" class="rl cap">' + esc(String(M.note || '').toUpperCase()) + '</text></svg>';
    return s;
  }
  function side(box, st, t) {
    var key = (st.seats || []).map(function (z) { var s = z.says.filter(function (x) { return x[0] <= t; }).slice(-1)[0]; return s ? s[0] : ''; }).join('|') + '|' + Math.floor(t);
    if (box.getAttribute('data-k') === key) return; box.setAttribute('data-k', key); box.textContent = '';
    var card = el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'What each one can see and hear at ' + hm(t) })]);
    (st.seats || []).forEach(function (z) {
      var s = z.says.filter(function (x) { return x[0] <= t; }).slice(-1)[0];
      card.appendChild(el('div', { class: 'run-seat' + (s && t - s[0] < 2 ? ' fresh' : '') }, [el('span', { class: 'run-dot', style: 'background:' + cc(z.c) }), el('div', {}, [el('b', { text: z.n }), el('div', { class: 'run-dim', text: s ? s[1] : 'Not yet in the story.' })])]));
    });
    box.appendChild(card);
    var radio = (st.events || []).filter(function (e) { return e.radio && e.t <= t; }).slice(-5);
    box.appendChild(el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'Radio' })].concat(radio.length ? radio.map(function (e) { return el('div', { class: 'run-radio' }, [el('span', { class: 'run-dim', text: hm(e.t) + ' ' }), document.createTextNode(e.t2)]); }) : [el('div', { class: 'run-dim', text: 'Nothing yet.' })])));
  }
  function lanesSvg(st, t) {
    var X0 = 240, X1 = 1190, T0 = st.t0, T1 = st.t1, tx = function (v) { return X0 + (v - T0) / (T1 - T0) * (X1 - X0); }, L = st.lanes || [], LY = function (i) { return 92 + i * 136; };
    var solo = R.solo, dim = function (id) { return solo && id !== solo ? ' opacity=".18"' : ''; };
    var s = '<svg viewBox="0 0 1220 ' + (LY(L.length) + 20) + '" width="100%" role="img" aria-label="Who knew what, and when" style="display:block"><rect width="1220" height="' + (LY(L.length) + 20) + '" fill="#0f1214"/>';
    var bandsAt = []; L.forEach(function (l, i) { if (!i || l.band !== L[i - 1].band) bandsAt.push([i, l.band]); });
    bandsAt.forEach(function (b, k) { var from = LY(b[0]) - 34, to = k + 1 < bandsAt.length ? LY(bandsAt[k + 1][0]) - 34 : LY(L.length) - 34, bd = (st.bands || []).filter(function (x) { return x.id === b[1]; })[0] || {}; s += '<rect x="' + (X0 - 8) + '" y="' + from + '" width="' + (X1 - X0 + 16) + '" height="' + (to - from - 4) + '" fill="' + (bd.c || '#fff') + '" opacity=".05"/><text x="' + (X0 - 2) + '" y="' + (from + 14) + '" class="rl cap" fill="' + (bd.c || '#aaa') + '">' + esc(String(bd.n || '').toUpperCase()) + '</text>'; if (k) s += '<line x1="' + (X0 - 8) + '" y1="' + (from - 2) + '" x2="' + (X1 + 8) + '" y2="' + (from - 2) + '" stroke="#e85f45" stroke-width="2" stroke-dasharray="8 5"/><text x="' + X1 + '" y="' + (from - 8) + '" text-anchor="end" class="rl cap" fill="#ff9f8a">THE TWO FREQUENCIES CANNOT HEAR EACH OTHER</text>'; });
    for (var h = Math.ceil(T0 / 20) * 20; h <= T1; h += 20) s += '<line x1="' + tx(h) + '" y1="40" x2="' + tx(h) + '" y2="' + (LY(L.length) - 30) + '" stroke="rgba(255,255,255,.05)"/><text x="' + tx(h) + '" y="' + (LY(L.length) - 12) + '" text-anchor="middle" class="rl">' + hm(h) + '</text>';
    L.forEach(function (l, i) { var y = LY(i); s += '<g' + dim(l.id) + '><text x="16" y="' + (y - 4) + '" class="rln">' + esc(l.n) + '</text><text x="16" y="' + (y + 14) + '" class="rl">' + esc(l.sub || '') + '</text><line x1="' + X0 + '" y1="' + y + '" x2="' + X1 + '" y2="' + y + '" stroke="rgba(255,255,255,.12)"/></g>'; });
    (st.spans || []).forEach(function (p) { var i = L.map(function (l) { return l.id; }).indexOf(p.lane); if (i < 0 || t < p.from) return; var y = LY(i), to = Math.min(t, p.to);
      s += '<g' + dim(p.lane) + '>' + (p.solid ? '<line x1="' + tx(p.from) + '" y1="' + y + '" x2="' + tx(to) + '" y2="' + y + '" stroke="' + L[i].c + '" stroke-width="3"/>' : p.dash ? '<line x1="' + tx(p.from) + '" y1="' + y + '" x2="' + tx(to) + '" y2="' + y + '" stroke="' + L[i].c + '" stroke-width="2" stroke-dasharray="3 4"/>' : '<rect x="' + tx(p.from) + '" y="' + (y - 6) + '" width="' + Math.max(0, tx(to) - tx(p.from)) + '" height="12" rx="3" fill="' + L[i].c + '" opacity=".2"/>') + (p.t ? '<text x="' + (tx(p.from) + 4) + '" y="' + (y + 26) + '" class="rl">' + esc(p.t) + '</text>' : '') + '</g>'; });
    // labels: each lane has four rows (above and below the line); a label takes the first row where it does not overlap one already placed
    var used = {}, ROWS = [-10, 26, -26, 42, -42, 58];
    (st.spans || []).forEach(function (p) { if (p.t && t >= p.from) (used[p.lane + ':1'] = used[p.lane + ':1'] || []).push([tx(p.from), tx(p.from) + p.t.length * 6.1 + 8]); });
    (st.events || []).forEach(function (e) { var i = L.map(function (l) { return l.id; }).indexOf(e.lane); if (i < 0 || e.t > t) return; var y = LY(i), x = tx(e.t), txt = e.t2.length > 64 ? e.t2.slice(0, 62) + '…' : e.t2, w = txt.length * 6.3 + 10, right = x + w > X1 + 20;
      var x0 = right ? x - w : x, x1 = right ? x : x + w, row = 0;
      for (; row < ROWS.length; row++) { var u = used[e.lane + ':' + row] || []; if (!u.some(function (z) { return x0 < z[1] && x1 > z[0]; })) break; }
      if (row >= ROWS.length) row = ROWS.length - 1;
      (used[e.lane + ':' + row] = used[e.lane + ':' + row] || []).push([x0, x1]);
      s += '<g' + dim(e.lane) + '><circle cx="' + x + '" cy="' + y + '" r="5" fill="' + L[i].c + '"/><text x="' + (right ? x - 8 : x + 8) + '" y="' + (y + ROWS[row]) + '" text-anchor="' + (right ? 'end' : 'start') + '" class="' + (e.q ? 'rq2' : 're') + '">' + esc(txt) + '</text></g>'; });
    if (st.line && t >= st.line.t) s += '<line x1="' + tx(st.line.t) + '" y1="40" x2="' + tx(st.line.t) + '" y2="' + (LY(L.length) - 30) + '" stroke="#e85f45" stroke-width="2"/>';
    s += '<line x1="' + tx(t) + '" y1="30" x2="' + tx(t) + '" y2="' + (LY(L.length) - 30) + '" stroke="#f0ede8" stroke-width="1.5"/><text x="' + tx(t) + '" y="24" text-anchor="middle" class="rln">' + hm(t) + '</text></svg>';
    var wrap = '<div class="run-solo">' + ['', ].concat(L.map(function (l) { return l.id; })).map(function (id) { var l = L.filter(function (z) { return z.id === id; })[0]; return '<button type="button" data-solo="' + id + '" class="run-chip' + (R.solo === id ? ' on' : '') + '">' + (id ? 'Only what ' + esc(l.n) + ' knew' : 'Everyone') + '</button>'; }).join('') + '</div>';
    setTimeout(function () { Array.prototype.forEach.call(document.querySelectorAll('[data-solo]'), function (b) { b.onclick = function () { R.solo = b.getAttribute('data-solo'); paint(); }; }); }, 0);
    return s + wrap;
  }
  function steps(box, st, t) {
    var key = (st.steps || []).filter(function (x) { return x.t <= t; }).length; if (box.getAttribute('data-k') === String(key)) return; box.setAttribute('data-k', String(key)); box.textContent = '';
    var off = (st.steps || []).filter(function (x) { return x.t <= t; }).length;
    box.appendChild(el('div', { class: 'run-k', text: off ? off + ' of the ' + st.steps.length + ' steps have gone a different way by ' + hm(t) : 'As the clock runs, each step lights up when the morning reaches it.' }));
    (st.steps || []).forEach(function (x, i) {
      var reached = x.t <= t;
      box.appendChild(el('div', { class: 'run-step' + (reached ? ' off' : ' next') }, [el('span', { class: 'run-n', text: String(i + 1) }), el('span', { text: x.should }), el('span', {}, reached ? [document.createTextNode(x.did), el('br'), el('span', { class: 'run-tag', text: x.not })] : [])]));
    });
  }
  // ---------- what each role could see and hear ----------
  function vis(st, seat, pid, t) {
    if (!seat || seat === 'all' || seat === 'every' || !st.sees || !st.sees[seat]) return 'shown';
    var w = (st.sees[seat][pid] || []).filter(function (x) { return t >= x[0] && t <= x[1]; })[0];
    return w ? w[2] : 'hidden';
  }
  function bandOf(st, lane) { var l = (st.lanes || []).filter(function (x) { return x.id === lane; })[0]; return l ? l.band : null; }
  function roleOf(st, id) { return (st.roles || []).filter(function (r) { return r.id === id; })[0] || null; }
  function hears(st, seat, e) {
    var r = roleOf(st, seat); if (!r) return true;
    return e.lane === seat || (e.radio && (r.hears || []).indexOf(bandOf(st, e.lane)) >= 0);
  }
  function seatSays(st, seat, t) { var z = (st.seats || []).filter(function (x) { return x.id === seat; })[0]; var s = z && z.says.filter(function (x) { return x[0] <= t; }).slice(-1)[0]; return s ? s[1] : ''; }
  function seatSide(box, st, t, seat) {
    var r = roleOf(st, seat); if (!r) return side(box, st, t);
    var heard = (st.events || []).filter(function (e) { return e.t <= t && hears(st, seat, e); }).slice(-6);
    var key = seat + '|' + Math.floor(t) + '|' + heard.length; if (box.getAttribute('data-k') === key) return; box.setAttribute('data-k', key); box.textContent = '';
    box.appendChild(el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: r.n + ': what you see at ' + hm(t) }), el('div', { class: 'run-seatnow', text: seatSays(st, seat, t) || 'Nothing yet.' })]));
    box.appendChild(el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'What you hear' })].concat(heard.length ? heard.map(function (e) { return el('div', { class: 'run-radio' }, [el('span', { class: 'run-dim', text: hm(e.t) + ' ' }), document.createTextNode(e.t2)]); }) : [el('div', { class: 'run-dim', text: 'Nothing yet.' })])));
    box.appendChild(brief(r));
  }
  function brief(r) {
    return el('details', { class: 'run-card2 run-brief' }, [el('summary', { text: 'Your briefing' }), el('div', { class: 'run-k', style: 'margin-top:8px', text: 'You know' })].concat(r.knows.map(function (k) { return el('div', { class: 'run-li', text: k }); })).concat([el('div', { class: 'run-k', style: 'margin-top:8px', text: 'Not in your briefing' })]).concat(r.not.map(function (k) { return el('div', { class: 'run-li dim', text: k }); })));
  }
  // every role at once: one small map and one panel per role, on the same clock
  function grid(box, st, t) {
    var key = Math.round(t * 2) + '|' + R.dz; if (box.getAttribute('data-k') === key) return; box.setAttribute('data-k', key); box.textContent = '';
    (st.roles || []).forEach(function (r) {
      R.seatMap = r.id; var svg = th(mapSvg(st, t, 'path')); R.seatMap = null;
      var heard = (st.events || []).filter(function (e) { return e.t <= t && e.radio && hears(st, r.id, e); }).slice(-2);
      var card = el('div', { class: 'run-gcard' }, [el('div', { class: 'run-k', style: 'color:' + cc(r.c), text: r.n }), el('div', { class: 'run-gmap' }), el('div', { class: 'run-seatnow', text: seatSays(st, r.id, t) || 'Nothing yet.' })].concat(heard.map(function (e) { return el('div', { class: 'run-radio', text: hm(e.t) + ' ' + e.t2 }); })));
      card.querySelector('.run-gmap').innerHTML = svg; box.appendChild(card);
    });
  }

  // ---------- Replay: stop and decide (5 November 2026) ----------
  // Pick a seat (or everyone, for a room). The morning runs and stops at each decision point. Each person commits to an
  // answer and a reason before anything is revealed; then what happened, why it made sense at the time, and the nots.
  // Answers go to the session record (the log), never into the project's own work.
  function dps(st) { var seat = R.rp ? R.rp.seat : 'all'; return (st.decisions || []).filter(function (d) { return seat === 'all' || d.prompt[seat]; }); }
  function nextDp(st) { var a = (R.rp && R.rp.ans) || {}; return dps(st).slice().sort(function (x, y) { return x.t - y.t; }).filter(function (d) { return !a[d.id]; })[0] || null; }
  function newRid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function save(body) { body.action = 'p_run_answer'; body.rid = R.rp.rid; body.seat = R.rp.seat; body.disguised = R.dz; return X.api(body).then(function () { R.rp.saved = true; }, function (e) { R.rp.saved = false; R.rp.err = e.message || String(e); }); }
  function replayView(wrap, st) {
    if (!R.rp || !R.rp.started) {
      R.rp = R.rp || { rid: newRid(), seat: 'all', ans: {}, hind: {}, phase: 'start', started: false };
      var seats = [['all', 'Everyone', 'For a room: see the whole picture, and record how the room voted at each point']].concat((st.roles || []).map(function (r) { return [r.id, r.n, r.sub]; }));
      var box = el('div', { class: 'run-start' }, [
        st.sensitivity && st.sensitivity.note ? el('div', { class: 'run-card2 run-warn' }, [el('div', { class: 'run-k', text: 'Before you start' }), el('div', { text: st.sensitivity.note })]) : null,
        el('div', { class: 'run-k', text: 'Choose a seat' }),
        el('div', { class: 'run-seats', id: 'runSeats' }, seats.map(function (o) { return el('button', { type: 'button', class: 'run-seatcard' + (R.rp.seat === o[0] ? ' on' : ''), 'data-seat': o[0], onclick: function () { R.rp.seat = o[0]; X.render(); } }, [el('b', { text: o[1] }), el('span', { text: o[2] || '' })]); })),
        el('p', { class: 'run-dim', text: 'The morning runs and stops at the moments where your seat had a decision to make (' + dps(st).length + ' for this seat). At each one you commit to what you would do, and why, before you see what happened. Your answers are kept for the debrief. Nothing you do here changes the project.' }),
        el('button', { type: 'button', class: 'run-b pri big', id: 'runStart', text: '▶ Start the morning', onclick: function () { R.rp.started = true; R.rp.phase = 'play'; R.t = st.t0; R.seat = R.rp.seat; save({ kind: 'start' }); X.render(); setTimeout(play, 300); } })]);
      wrap.appendChild(box);
      return;
    }
    var stage = el('div', { class: 'run-stage', id: 'runStage' }, [el('div', { class: 'run-map', id: 'runMap' }), el('div', { class: 'run-side', id: 'runSide' })]);
    wrap.appendChild(stage);
    var bar = el('div', { class: 'run-bar' }, [el('div', { class: 'run-ctl' }, [el('span', { class: 'run-clock', id: 'runClock', text: hm(R.t) }),
      el('button', { type: 'button', class: 'run-b pri big', id: 'runPlay', text: '▶ Play', onclick: function () { if (R.rp.phase !== 'play') return; if (R.playing) stopAnim(); else play(); paint(); } }),
      el('div', { class: 'run-seg', role: 'group', 'aria-label': 'Speed' }, SPEEDS.map(function (s2) { return el('button', { type: 'button', 'aria-pressed': String(R.speed === s2[0]), class: R.speed === s2[0] ? 'on' : '', text: s2[1], onclick: function () { R.speed = s2[0]; X.render(); } }); })),
      el('span', { class: 'run-dim', id: 'runSeatName', text: R.rp.seat === 'all' ? 'Seat: everyone' : 'Seat: ' + (roleOf(st, R.rp.seat) || {}).n }),
      el('span', { class: 'run-grow' }), el('span', { class: 'run-dim', id: 'runDone', text: Object.keys(R.rp.ans).length + ' of ' + dps(st).length + ' decisions made' }),
      el('button', { type: 'button', class: 'run-b', text: 'Start again', onclick: function () { if (!confirm('Start the morning again, in a new seat if you like? Your answers so far stay in the record.')) return; stopAnim(); R.rp = null; R.t = st.t0; X.render(); } })])]);
    wrap.appendChild(bar);
    wrap.appendChild(el('div', { id: 'runEnd' }));
    paint(); paintReplay();
  }
  function replaySide(box, st, t) {
    var rp = R.rp; if (!rp) return;
    if (rp.phase === 'play' || rp.phase === 'start') { box.removeAttribute('data-rk'); return rp.seat === 'all' ? side(box, st, t) : seatSide(box, st, t, rp.seat); }
  }
  function paintReplay() {
    var st = story(), rp = R.rp, box = document.getElementById('runSide'); if (!rp || !box) return;
    var done = document.getElementById('runDone'); if (done) done.textContent = Object.keys(rp.ans).length + ' of ' + dps(st).length + ' decisions made';
    var c = document.getElementById('runClock'); if (c) c.textContent = hm(R.t);
    var pb = document.getElementById('runPlay'); if (pb) { pb.textContent = R.playing ? '❚❚ Pause' : '▶ Play'; pb.disabled = rp.phase !== 'play'; }
    if (rp.phase === 'play') return;
    var d = (st.decisions || []).filter(function (x) { return x.id === rp.cur; })[0];
    var key = rp.phase + '|' + (d ? d.id : ''); if (box.getAttribute('data-rk') === key) return; box.setAttribute('data-rk', key); box.removeAttribute('data-k'); box.textContent = '';
    if (rp.phase === 'decide' && d) {
      var seat = rp.seat, sit = d.situation[seat] || d.situation.all, pr = d.prompt[seat] || d.prompt.all, ops = (d.options[seat] || d.options.all || []);
      var room = {}, pick = null, reason = el('textarea', { class: 'run-ta', id: 'runReason', rows: '3', placeholder: 'Why? What are you going on?', 'aria-label': 'Your reason' });
      var other = el('input', { type: 'text', class: 'run-ta', placeholder: 'Something else (write it here)', 'aria-label': 'Something else' });
      var list = el('div', { class: 'run-opts' }, ops.map(function (o, i) {
        var b = el('label', { class: 'run-opt' }, [el('input', { type: 'radio', name: 'runOpt', value: o, 'data-opt': String(i), onchange: function () { pick = o; } }), el('span', { text: o })].concat(seat === 'all' ? [el('input', { type: 'number', min: '0', class: 'run-num', placeholder: 'How many', 'aria-label': 'How many in the room chose this', onchange: function (e) { room[o] = Number(e.target.value) || 0; } })] : []));
        return b; }));
      box.appendChild(el('div', { class: 'run-card2 run-decide' }, [el('div', { class: 'run-k', text: hm(d.t) + ' · ' + d.title }), el('div', { class: 'run-sit', text: sit }), el('div', { class: 'run-big', text: pr }), list, other, reason,
        el('button', { type: 'button', class: 'run-b pri big', id: 'runCommit', text: 'Commit my answer', onclick: function () {
          var choice = pick || other.value.trim(); if (!choice) return alert('Choose an answer, or write your own.');
          rp.ans[d.id] = { choice: choice, text: reason.value.trim(), room: room };
          save({ kind: 'answer', dp: d.id, choice: choice, text: reason.value.trim(), room: seat === 'all' ? room : undefined });
          rp.phase = 'reveal'; paintReplay(); } }),
        el('div', { class: 'run-dim', text: 'Nothing is shown until you commit.' })]));
    } else if (rp.phase === 'reveal' && d) {
      var a = rp.ans[d.id] || {};
      box.appendChild(el('div', { class: 'run-card2 run-reveal' }, [el('div', { class: 'run-k', text: hm(d.t) + ' · ' + d.title }),
        el('div', { class: 'run-k', style: 'margin-top:6px', text: 'Your answer' }), el('div', { text: a.choice + (a.text ? ': ' + a.text : '') }),
        el('div', { class: 'run-k', style: 'margin-top:10px', text: 'What happened' }), el('div', { class: 'run-big', text: d.did }),
        el('div', { class: 'run-k', style: 'margin-top:10px', text: 'Why it made sense at the time' }), el('div', { text: d.why }),
        el('div', { class: 'run-nots' }, (d.nots || []).map(function (n) { return el('span', { class: 'run-tag', text: n }); })),
        el('button', { type: 'button', class: 'run-b pri big', id: 'runCarry', text: nextDp(st) ? 'Carry on' : 'Carry on to the end', onclick: function () { rp.phase = 'play'; box.removeAttribute('data-rk'); paint(); play(); } })]));
    } else if (rp.phase === 'end') { box.textContent = ''; box.appendChild(el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'The end of the morning' }), el('div', { text: 'Below: your decisions against what happened, and the debrief.' })])); endOfReplay(st); }
    if (R.dz) dzWalk(document.querySelector('.run-wrap'));
  }
  function endOfReplay(st) {
    var box = document.getElementById('runEnd'); if (!box || box.childNodes.length) return; var rp = R.rp;
    var t = el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'Your decisions against what happened' }), el('p', { class: 'run-dim', style: 'margin:0 0 8px', text: 'Now that you know the ending: given only what they knew at the time, how reasonable was what they did? 1 is not at all, 5 is entirely.' })]);
    dps(st).forEach(function (d) {
      var a = rp.ans[d.id] || {};
      var rate = el('div', { class: 'run-rate' }, [1, 2, 3, 4, 5].map(function (n) { return el('button', { type: 'button', class: 'run-chip' + (rp.hind[d.id] === n ? ' on' : ''), 'data-rate': d.id + ':' + n, text: String(n), onclick: function (e) { rp.hind[d.id] = n; save({ kind: 'hindsight', dp: d.id, rate: n }); if (R.lensDraw) R.lensDraw(); Array.prototype.forEach.call(e.target.parentNode.children, function (b) { b.classList.toggle('on', b === e.target); }); } }); }));
      t.appendChild(el('div', { class: 'run-endrow' }, [el('div', {}, [el('b', { text: hm(d.t) + ' ' + d.title })]), el('div', {}, [el('span', { class: 'run-k', text: 'You' }), el('div', { text: a.choice || 'No answer' })]), el('div', {}, [el('span', { class: 'run-k', text: 'What happened' }), el('div', { text: d.did })]), rate]));
    });
    box.appendChild(t);
    box.appendChild(lensPanel(st, rp));
    if (rp.saved === false) box.appendChild(el('p', { class: 'run-dim', text: 'Your answers could not be saved to the record (' + (rp.err || 'not saved') + '). They are kept on this screen until you leave it.' }));
  }

  // ---------- debrief lenses: separate modules that read the same record ----------
  var LENSES = {
    aar: { n: 'After action review', q: ['What was supposed to happen?', 'What actually happened?', 'Why was there a difference?', 'What would we keep, and what would we change?'] },
    drift: { n: 'Practical drift: planned against what happened', q: ['Where had practice moved away from the written procedure?', 'Why did each change seem sensible to the people who made it?', 'Who could have seen the gap growing, and how?'] },
    hindsight: { n: 'Hindsight and outcome bias', q: ['Compare what you chose at each point with how you now rate what they did.', 'Where did knowing the ending make the right answer look obvious?', 'What would have made the danger visible at the time?'] },
    nots: { n: 'The twelve nots', q: ['Which nots were present at each decision point?', 'Which combination was enough on its own?', 'Which of them do you recognise in your own organisation?'] } };
  function lensPanel(st, rp) {
    var ids = ((st.debrief || {}).lenses) || Object.keys(LENSES); R.lens = R.lens && ids.indexOf(R.lens) >= 0 ? R.lens : ids[0];
    var body = el('div', { class: 'run-lensbody' });
    var draw = function () {
      body.textContent = ''; var L = LENSES[R.lens]; if (!L) return;
      var own = ((st.debrief || {}).prompts || {})[R.lens];
      body.appendChild(el('ol', { class: 'run-ol' }, (own ? [own] : []).concat(L.q).map(function (q) { return el('li', { text: q }); })));
      if (R.lens === 'nots') { var c = {}; (st.decisions || []).forEach(function (d) { (d.nots || []).forEach(function (n) { c[n] = (c[n] || 0) + 1; }); }); body.appendChild(el('div', { class: 'run-nots' }, Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (n) { return el('span', { class: 'run-tag', text: n + ' · ' + c[n] }); }))); }
      if (R.lens === 'hindsight' && rp) body.appendChild(el('div', {}, (st.decisions || []).map(function (d) { var a = rp.ans[d.id] || {}, h = rp.hind[d.id]; return el('div', { class: 'run-li', text: d.title + ': you chose "' + (a.choice || 'nothing') + '"; you rate what they did ' + (h ? h + ' out of 5' : 'not yet rated') + '.' }); })));
      if (R.lens === 'drift' || R.lens === 'aar') body.appendChild(el('div', {}, (st.steps || []).slice(0, 10).map(function (x, i) { return el('div', { class: 'run-step off' }, [el('span', { class: 'run-n', text: String(i + 1) }), el('span', { text: x.should }), el('span', { text: x.did })]); })));
      if (R.dz) dzWalk(body);
    };
    var box = el('div', { class: 'run-card2 run-lens', id: 'runLens' }, [el('div', { class: 'run-k', text: 'Debrief' }), el('div', { class: 'run-tabs sub' }, ids.filter(function (i) { return LENSES[i]; }).map(function (i) { return el('button', { type: 'button', 'data-lens': i, class: R.lens === i ? 'on' : '', text: LENSES[i].n, onclick: function (e) { R.lens = i; Array.prototype.forEach.call(e.target.parentNode.children, function (b) { b.classList.toggle('on', b === e.target); }); draw(); } }); })), body]);
    R.lensDraw = draw; draw(); return box;
  }
  // disguise: replace the case's names on screen, so people who know it do not play to the ending
  function dzWalk(root) {
    var st = story(); if (!R.dz || !root || !st || !st.disguise) return;
    var keys = Object.keys(st.disguise).sort(function (a, b) { return b.length - a.length; });
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (node) { var v = node.nodeValue, o = v; keys.forEach(function (k) { if (v.indexOf(k) >= 0) v = v.split(k).join(st.disguise[k]); var K = k.toUpperCase(); if (K !== k && v.indexOf(K) >= 0) v = v.split(K).join(String(st.disguise[k]).toUpperCase()); }); if (v !== o) node.nodeValue = v; });
    Array.prototype.forEach.call(root.querySelectorAll('textarea[placeholder],input[placeholder]'), function () {});
  }

  // ---------- a story: try a change ----------
  function tryPanel(stage, st) {
    var groups = []; (st.barriers || []).forEach(function (b) { if (groups.indexOf(b.g) < 0) groups.push(b.g); });
    var box = el('div', { class: 'run-try' }, [el('div', { class: 'run-k', text: 'Put a barrier back, then run the morning again' })]);
    groups.forEach(function (g) {
      box.appendChild(el('div', { class: 'run-grp', text: g }));
      st.barriers.filter(function (b) { return b.g === g; }).forEach(function (b) {
        box.appendChild(el('label', { class: 'run-tog' }, [el('input', { type: 'checkbox', 'data-bar': b.id, checked: !!R.on[b.id], onchange: function (e) { R.on[b.id] = e.target.checked; R.held = false; stopAnim(); R.t = st.t0; paint(); } }), el('span', { text: b.n })]));
      });
    });
    box.appendChild(el('div', { class: 'run-row' }, [el('button', { type: 'button', class: 'run-b pri big', id: 'runAgain', text: '▶ Run the morning again', onclick: function () { stopAnim(); R.t = st.t0; R.held = false; R.hold = firstHold(st); play(); } }),
      el('button', { type: 'button', class: 'run-b', text: 'Clear', onclick: function () { R.on = {}; R.held = false; stopAnim(); R.t = st.t0; X.render(); } })]));
    stage.appendChild(box);
    stage.appendChild(el('div', { class: 'run-map', id: 'runMap' }));
  }
  function firstHold(st) { return (st.barriers || []).filter(function (b) { return R.on[b.id]; }).sort(function (a, b) { return a.t - b.t; })[0] || null; }
  function record() {
    var st = story(), on = (st.barriers || []).filter(function (b) { return R.on[b.id]; });
    R.runs.push({ n: on.length ? on.map(function (b) { return b.n; }).join('; ') : 'As it happened', held: R.held ? R.hold : null, on: on.map(function (b) { return b.id; }) });
  }
  function tryRes(box, st, t) {
    var key = [R.held ? 1 : 0, R.runs.length, t >= (st.line || {}).t ? 1 : 0, Object.keys(R.on).filter(function (k) { return R.on[k]; }).join()].join('|'); if (box.getAttribute('data-k') === key) return; box.setAttribute('data-k', key); box.textContent = '';
    if (R.held && R.hold) box.appendChild(el('div', { class: 'run-card2 good' }, [el('div', { class: 'run-k', text: 'Held at ' + hm(R.hold.t) + ': ' + R.hold.n }), el('div', { class: 'run-big', text: R.hold.stop }), el('div', { class: 'run-dim', text: 'In this run the line is not crossed.' })]));
    else if (st.line && t >= st.line.t) box.appendChild(el('div', { class: 'run-card2 bad' }, [el('div', { class: 'run-k', text: 'The line is crossed at ' + hm(st.line.t) }), el('div', { class: 'run-big', text: firstHold(st) ? 'The barriers put back come too late in the morning to stop it.' : 'Every barrier the morning met had a hole in it.' })]));
    var order = (st.barriers || []).slice().sort(function (a, b) { return a.t - b.t; });
    if (R.runs.length) {
      var tbl = el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'This room’s runs. Each box is a barrier, in the order the morning meets it; a hole is one that did not hold.' })]);
      R.runs.forEach(function (r, i) {
        var hi = r.held ? order.indexOf(order.filter(function (b) { return b.id === r.held.id; })[0]) : 99;
        tbl.appendChild(el('div', { class: 'run-runrow' }, [el('span', { class: 'run-rn', text: 'Run ' + (i + 1) }), el('span', { class: 'run-boxes' }, order.map(function (b, k) { return el('span', { class: 'run-bx ' + (k === hi ? 'held' : k > hi ? 'unused' : 'hole'), title: b.n }); })), el('span', { class: 'run-dim', text: r.n }), el('span', { class: r.held ? 'run-ok' : 'run-bad', text: r.held ? 'Held, ' + hm(r.held.t) : 'Line crossed, ' + hm(st.line.t) })]));
      });
      box.appendChild(tbl);
    }
  }

  // ---------- a service, run hour by hour ----------
  function flowView(wrap) {
    var v = inv(), list = scens(v);
    if (!list.some(function (s) { return s.id === R.scen; })) R.scen = '';
    var key = R.scen + '|' + JSON.stringify([v.abm, v.processes && v.processes.length, v.resources && v.resources.length]);
    if (R.flowKey !== key) { R.flow = window.VTModel._sim(v, v.abm, { seed: (Number(v.abm.seed) || 7) * 1000, scen: R.scen || undefined }); R.flowKey = key; R.h = 0; }
    wrap.appendChild(el('div', { class: 'run-tabs' }, list.map(function (s) { return el('button', { type: 'button', class: R.scen === s.id ? 'on' : '', 'data-scen': s.id, text: s.n, onclick: function () { R.scen = s.id; stopAnim(); X.render(); } }); })));
    var stage = el('div', { class: 'run-stage' }, [el('div', { class: 'run-map', id: 'runFlow' }), el('div', { class: 'run-side', id: 'runFSide' })]);
    wrap.appendChild(stage);
    var bar = el('div', { class: 'run-bar' }, [el('div', { class: 'run-ctl' }, [el('span', { class: 'run-clock', id: 'runClock' }),
      el('button', { type: 'button', class: 'run-b pri big', id: 'runPlay', text: '▶ Play', onclick: function () { if (R.playing) stopAnim(); else playFlow(); paintFlow(); } }),
      el('button', { type: 'button', class: 'run-b', text: '↺ From the start', onclick: function () { stopAnim(); R.h = 0; paintFlow(); } }),
      el('div', { class: 'run-seg', role: 'group', 'aria-label': 'Speed' }, FSPEEDS.map(function (s) { return el('button', { type: 'button', 'aria-pressed': String(R.fs === s[0]), class: (R.fs || 4) === s[0] ? 'on' : '', text: s[1], onclick: function () { R.fs = s[0]; X.render(); } }); })),
      el('button', { type: 'button', class: 'run-b', id: 'runMany', text: 'Run it many times', onclick: function () { manyRuns(); } }), el('span', { class: 'run-grow' })])]);
    var sl = el('input', { type: 'range', class: 'run-range', id: 'runRange', min: '0', max: String(R.flow.H - 1), step: '1', value: String(Math.floor(R.h)), 'aria-label': 'Hour' });
    sl.addEventListener('input', function () { stopAnim(); R.h = Number(sl.value); paintFlow(); });
    bar.appendChild(sl); wrap.appendChild(bar);
    wrap.appendChild(el('div', { id: 'runManyOut' }));
    wrap.appendChild(el('p', { class: 'run-note', text: 'One run of the flow model in Model, hour by hour: the same rules the Lab uses everywhere else. "Run it many times" gives the spread. Nothing here changes the project.' }));
    paintFlow();
  }
  function playFlow() {
    R.playing = true; R.last = performance.now();
    var tick = function (now) { if (!R.playing) return; var dt = Math.min(0.25, (now - R.last) / 1000); R.last = now; R.h = Math.min(R.flow.H - 1, R.h + dt * (R.fs || 4)); if (R.h >= R.flow.H - 1) stopAnim(); paintFlow(); if (R.playing) R.raf = requestAnimationFrame(tick); };
    R.raf = requestAnimationFrame(tick);
  }
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function when(f, h) { var abs = (f.start || 0) * 24 + Math.floor(h); return DAYS[Math.floor(abs / 24) % 7] + ' ' + String(abs % 24).padStart(2, '0') + ':00'; }
  function paintFlow() {
    var f = R.flow, v = inv(), h = Math.floor(R.h); if (!f) return;
    var c = document.getElementById('runClock'); if (c) c.textContent = when(f, h);
    var rg = document.getElementById('runRange'); if (rg && Number(rg.value) !== h) rg.value = String(h);
    var pb = document.getElementById('runPlay'); if (pb) pb.textContent = R.playing ? '❚❚ Pause' : '▶ Play';
    var res = {}; (v.resources || []).forEach(function (r) { res[r.id] = r; });
    var box = document.getElementById('runFlow');
    if (box) {
      var rowH = 70, W = 860, s = '<svg viewBox="0 0 ' + W + ' ' + (f.steps.length * rowH + 20) + '" width="100%" role="img" aria-label="The service at ' + when(f, h) + '" style="display:block"><rect width="' + W + '" height="' + (f.steps.length * rowH + 20) + '" fill="#111312"/>';
      f.steps.forEach(function (st, j) {
        var y = 10 + j * rowH, qn = (f.qs[h] || [])[j] || 0, cap = Math.max(1, Math.round(st.cap)), red = qn > cap * 3;
        s += '<rect x="10" y="' + y + '" width="' + (W - 20) + '" height="' + (rowH - 10) + '" rx="10" fill="' + (red ? 'rgba(232,95,69,.1)' : 'rgba(255,255,255,.03)') + '" stroke="' + (red ? '#e85f45' : 'rgba(255,255,255,.12)') + '"/>';
        s += '<text x="24" y="' + (y + 24) + '" class="rln">' + esc(st.n.length > 46 ? st.n.slice(0, 45) + '…' : st.n) + '</text>';
        var avs = f.avs[h] || {}, down = st.rs.filter(function (id) { return avs[id] != null && avs[id] < 1; });
        s += '<text x="24" y="' + (y + 44) + '" class="rl">' + (down.length ? esc(down.map(function (id) { return (res[id] || {}).n || id; }).join(', ') + (avs[down[0]] === 0 ? ': not there' : ': partly there')) : 'Everything it needs is there') + '</text>';
        for (var k = 0; k < Math.min(qn, 14); k++) s += '<circle cx="' + (420 + k * 18) + '" cy="' + (y + 30) + '" r="7" fill="' + (red && k >= cap * 3 ? '#e85f45' : '#e07030') + '"/>';
        s += '<text x="' + (420 + Math.min(qn, 14) * 18 + 6) + '" y="' + (y + 34) + '" class="rl">' + (qn ? qn + ' waiting' : 'none waiting') + '</text>';
        st.rs.slice(0, 4).forEach(function (id, k) { var a = avs[id] == null ? 1 : avs[id], x = 712 + k * 36, yy = y + 30, col = a >= 1 ? '#f0ede8' : a > 0 ? '#e0a050' : '#e85f45';
          s += '<g transform="translate(' + x + ',' + yy + ')"' + (a < 1 ? ' opacity=".85"' : '') + '><circle r="6" cy="-7" fill="' + (a >= 1 ? col : 'none') + '" stroke="' + col + '" stroke-width="1.5"' + (a === 0 ? ' stroke-dasharray="2 2"' : '') + '/><path d="M-9,11 C-9,1 9,1 9,11" fill="' + (a >= 1 ? col : 'none') + '" stroke="' + col + '" stroke-width="1.5"' + (a === 0 ? ' stroke-dasharray="2 2"' : '') + '/></g>'; });
      });
      box.innerHTML = th(s + '</svg>');
    }
    var sd = document.getElementById('runFSide');
    if (sd) {
      var wait = f.backlog[h] || 0, old = f.oldest[h] || 0, over = old > f.tol;
      var k = h + '|' + wait + '|' + Math.round(old); if (sd.getAttribute('data-k') === k) return; sd.setAttribute('data-k', k); sd.textContent = '';
      sd.appendChild(el('div', { class: 'run-kpis' }, [kpi(String(wait), 'waiting now'), kpi(fmtH(old), 'longest wait now', over), kpi(fmtH(f.tol), 'the line'), kpi(String(f.items), 'through in this run')]));
      sd.appendChild(el('div', { class: 'run-card2' + (over ? ' bad' : '') }, [el('div', { class: 'run-k', text: 'The line that must not be crossed' }), el('div', { text: over ? 'Crossed: the longest wait is ' + fmtH(old) + ', over ' + fmtH(f.tol) + '.' : 'Held so far: the longest wait is ' + fmtH(old) + ', against ' + fmtH(f.tol) + '.' })]));
      sd.appendChild(el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'The question being run' }), el('div', { text: (scens(v).filter(function (s) { return s.id === R.scen; })[0] || {}).n || '' }), el('div', { class: 'run-dim', text: 'Orange dots: work waiting at each step. Figures: what each step needs; dashed when it is not there.' })]));
    }
  }
  function kpi(v, l, red) { return el('div', { class: 'run-kpi' + (red ? ' red' : '') }, [el('div', { class: 'run-kv', text: v }), el('div', { class: 'run-kl', text: l })]); }
  function fmtH(x) { x = Number(x) || 0; var hh = Math.floor(x), mm = Math.round((x - hh) * 60); return mm ? hh + 'h ' + mm : hh + 'h'; }
  function manyRuns() {
    var out = document.getElementById('runManyOut'); if (!out) return; out.textContent = 'Running…';
    setTimeout(function () {
      var rs = []; try { rs = window.VTModel.abmResults(inv()); } catch (e) { out.textContent = 'Could not run it: ' + e.message; return; }
      out.textContent = '';
      out.appendChild(el('div', { class: 'run-card2' }, [el('div', { class: 'run-k', text: 'Run many times: how often the line is crossed' })].concat(rs.map(function (r) {
        var n = Math.round(r.pb * 100);
        return el('div', { class: 'run-manyrow' }, [el('span', { text: r.n }), el('span', { class: 'run-barw' }, [el('span', { class: 'run-barf' + (n > 10 ? ' red' : ''), style: 'width:' + n + '%' })]), el('span', { class: 'run-dim', text: n + ' in 100 runs cross the line · typical longest wait ' + fmtH(r.med) })]);
      }))));
    }, 30);
  }

  function css() {
    if (document.getElementById('runCss')) return;
    var s = document.createElement('style'); s.id = 'runCss';
    s.textContent = 'body.run-mode [data-nav]:not([data-nav="hub"]):not([data-nav="about"]){display:none}' +
      '.run-wrap{max-width:1260px;margin:0 auto;padding:22px 0 40px;color:var(--paper,#f0ede8)}.run-top{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:10px}.run-back{font-size:14px;color:var(--accent,#f0a070)}.run-h1{font-family:Outfit,"DM Sans",sans-serif;font-weight:400;font-size:32px;margin:0}.run-h1.big{font-weight:300;font-size:52px;margin:0 0 8px}.run-sub{color:var(--muted,#a09890);font-size:17px;max-width:760px;line-height:1.5;margin:0 0 26px}.run-sub2{color:var(--muted,#a09890);font-size:14px}' +
      '.run-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.run-card{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line,rgba(255,255,255,.16));border-radius:20px;padding:24px;text-decoration:none;color:inherit;background:rgba(127,127,127,.06);min-height:200px}.run-card:hover{border-color:#e07030}.run-card.off{opacity:.5;border-style:dashed}.run-card h2{font-family:Outfit,sans-serif;font-weight:400;font-size:26px;margin:0}.run-card p{margin:0;color:var(--muted,#a09890);line-height:1.5;flex:1}.run-go{color:var(--accent,#f0a070);font-weight:600}' +
      '.run-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 14px}.run-tabs a,.run-tabs button{font:inherit;font-size:14px;padding:9px 15px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.22));color:var(--muted,#c9c2ba);text-decoration:none;background:none;cursor:pointer}.run-tabs .on{border-color:#e07030;background:rgba(224,112,48,.15);color:inherit;font-weight:600}' +
      '.run-stage{display:flex;gap:16px;align-items:flex-start;position:relative}.run-map{color:#f0ede8;flex:1;min-width:0;border:1px solid var(--line,rgba(255,255,255,.12));border-radius:16px;overflow:hidden;background:#101418}.run-map.wide{flex:1 1 100%}.run-side{width:340px;flex:none;display:flex;flex-direction:column;gap:10px}@media(max-width:980px){.run-stage{flex-direction:column}.run-side{width:auto}}' +
      '.run-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%}@media(max-width:980px){.run-two{grid-template-columns:1fr}}.run-k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#a09890);margin:0 0 6px}.run-k.green{color:var(--ok,#7fd99a)}.run-k.red{color:var(--none,#ff9f8a)}' +
      '.run-card2{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:14px;padding:12px 14px;background:rgba(127,127,127,.06);font-size:13px;line-height:1.45;margin-bottom:10px}.run-card2.good{border-color:rgba(120,200,140,.55);background:rgba(120,200,140,.07)}.run-card2.bad{border-color:rgba(232,95,69,.6);background:rgba(232,95,69,.07)}.run-big{font-family:Outfit,sans-serif;font-size:22px;font-weight:300;line-height:1.35;margin:4px 0}' +
      '.run-seat{display:grid;grid-template-columns:12px 1fr;gap:8px;margin:8px 0;transition:background .4s}.run-seat.fresh{background:rgba(127,127,127,.12);border-radius:6px}.run-dot{width:10px;height:10px;border-radius:50%;margin-top:4px}.run-dim{color:var(--muted,#a09890)}.run-radio{font-family:"DM Mono",ui-monospace,monospace;font-size:12px;line-height:1.6}' +
      '.run-bar{margin-top:14px;border:1px solid var(--line,rgba(255,255,255,.14));border-radius:14px;padding:12px 16px;background:rgba(127,127,127,.06)}.run-ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.run-clock{font-family:Outfit,sans-serif;font-size:30px;font-weight:300;font-variant-numeric:tabular-nums;min-width:110px}' +
      '.run-b{font:inherit;font-size:13px;border:1px solid var(--line,rgba(255,255,255,.3));border-radius:9px;padding:8px 13px;color:inherit;background:none;cursor:pointer;min-height:38px}.run-b.pri{background:var(--paper,#f0ede8);color:var(--bg,#0e0c0b);font-weight:600}.run-b.big{font-size:15px;padding:10px 18px}' +
      '.run-seg{display:inline-flex;border:1px solid var(--line,rgba(255,255,255,.22));border-radius:999px;padding:3px}.run-seg button{font:inherit;font-size:12px;border:0;background:none;color:var(--muted,#c9c2ba);padding:6px 11px;border-radius:999px;cursor:pointer}.run-seg button.on{background:var(--paper,#f0ede8);color:var(--bg,#0e0c0b);font-weight:600}.run-chk{font-size:13px;color:var(--muted,#c9c2ba)}.run-grow{flex:1}' +
      '.run-range{width:100%;margin:12px 0 0;accent-color:#e07030}.run-ticks{margin:-2px 0 4px}.run-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.run-chip{font:inherit;font-size:12px;padding:5px 10px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.22));color:var(--muted,#c9c2ba);background:none;cursor:pointer}.run-chip.red{border-color:#e85f45;color:var(--none,#ff9f8a)}.run-chip.on{background:var(--paper,#f0ede8);color:var(--bg,#0e0c0b)}.run-solo{display:flex;gap:6px;flex-wrap:wrap;padding:10px}.run-map .run-chip{color:#c9c2ba;border-color:rgba(255,255,255,.25)}.run-map .run-chip.on{background:#f0ede8;color:#0e0c0b}' +
      '.run-steps{margin-top:14px}.run-step{display:grid;grid-template-columns:26px 1fr 1fr;gap:10px;font-size:13px;line-height:1.4;padding:8px 10px;border-radius:9px;border:1px solid var(--line,rgba(255,255,255,.1));margin-bottom:6px}.run-step.off{border-color:rgba(232,95,69,.6);background:rgba(232,95,69,.07)}.run-step.next{opacity:.5}.run-n{font-weight:700;color:var(--muted,#a09890)}.run-tag{display:inline-block;font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid rgba(232,95,69,.6);color:var(--none,#ff9f8a);margin-top:4px}' +
      '.run-try{width:380px;flex:none;border:1px solid var(--line,rgba(255,255,255,.14));border-radius:14px;padding:12px 14px;background:rgba(127,127,127,.06)}@media(max-width:980px){.run-try{width:auto}}.run-grp{font-family:Outfit,sans-serif;font-size:15px;margin:12px 0 2px}.run-tog{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line,rgba(255,255,255,.08));font-size:13px;line-height:1.4;cursor:pointer}.run-tog input{width:18px;height:18px;accent-color:#3aa66a;flex:none}.run-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.run-tryres{margin-top:14px}' +
      '.run-runrow{display:grid;grid-template-columns:60px auto 1fr auto;gap:12px;align-items:center;padding:6px 0;border-top:1px solid var(--line,rgba(255,255,255,.08))}.run-boxes{display:flex;gap:3px}.run-bx{width:18px;height:14px;border-radius:3px;border:1px solid #e85f45;background:radial-gradient(circle,var(--bg,#0b0a09) 30%,rgba(232,95,69,.25) 32%)}.run-bx.held{border-color:#78c88c;background:rgba(120,200,140,.4)}.run-bx.unused{border-color:rgba(255,255,255,.2);background:none}.run-ok{color:var(--ok,#8fd9a6)}.run-bad{color:var(--none,#ff9f8a)}' +
      '.run-ask{color:#f0ede8;position:absolute;left:50%;top:40px;transform:translateX(-50%);width:min(620px,90%);background:#1a1614;border:1px solid #f0ede8;border-radius:18px;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:5}.run-askq{font-family:Outfit,sans-serif;font-size:26px;font-weight:300;line-height:1.35;margin:6px 0 16px}' +
      '.run-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.run-kpi{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:12px;padding:10px 12px}.run-kpi.red{border-color:#e85f45}.run-kpi.red .run-kv{color:var(--none,#ff9f8a)}.run-kv{font-family:Outfit,sans-serif;font-size:28px;font-weight:300}.run-kl{font-size:12px;color:var(--muted,#a09890)}' +
      '.run-manyrow{display:grid;grid-template-columns:220px 1fr auto;gap:12px;align-items:center;padding:6px 0;font-size:13px}.run-barw{height:10px;border-radius:5px;background:rgba(127,127,127,.18);overflow:hidden}.run-barf{display:block;height:100%;background:#78c88c}.run-barf.red{background:#e85f45}' +
      '.run-seeas{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.run-tabs.sub button{font-size:13px;padding:7px 12px}.run-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px;width:100%}.run-gcard{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:14px;padding:10px;background:rgba(127,127,127,.06);font-size:12.5px}.run-gmap{border-radius:10px;overflow:hidden;margin:6px 0}.run-seatnow{font-size:14px;line-height:1.45;margin:4px 0}.run-li{padding:3px 0;font-size:13px}.run-li.dim{color:var(--muted,#a09890)}.run-brief summary{cursor:pointer;font-weight:600}' +
      '.run-start{max-width:900px}.run-warn{border-color:rgba(232,95,69,.6)}.run-seats{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:8px 0 14px}.run-seatcard{font:inherit;text-align:left;display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.2));background:rgba(127,127,127,.06);color:inherit;cursor:pointer;min-height:84px}.run-seatcard span{font-size:12.5px;color:var(--muted,#a09890)}.run-seatcard.on{border-color:#e07030;background:rgba(224,112,48,.12)}' +
      '.run-decide,.run-reveal{border-color:#e07030}.run-reveal .run-big{font-size:18px}.run-sit{font-size:13.5px;margin:4px 0 8px;color:var(--muted,#a09890)}.run-opts{display:flex;flex-direction:column;gap:6px;margin:10px 0}.run-opt{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid var(--line,rgba(255,255,255,.18));border-radius:10px;cursor:pointer;font-size:14px}.run-opt span{flex:1}.run-opt input[type=radio]{width:18px;height:18px;accent-color:#e07030}.run-num{width:84px;font:inherit;font-size:13px;padding:6px;border-radius:8px;border:1px solid var(--line,rgba(255,255,255,.25));background:none;color:inherit}.run-ta{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:9px;margin:6px 0;border-radius:9px;border:1px solid var(--line,rgba(255,255,255,.25));background:none;color:inherit}.run-nots{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.run-nots .run-tag{margin:0}' +
      '.run-endrow{display:grid;grid-template-columns:1.2fr 1.4fr 2fr auto;gap:12px;align-items:start;padding:10px 0;border-top:1px solid var(--line,rgba(255,255,255,.1));font-size:13px}@media(max-width:900px){.run-endrow{grid-template-columns:1fr}}.run-rate{display:flex;gap:4px}.run-lens{margin-top:12px}.run-ol{margin:8px 0 10px 18px;padding:0;font-size:14px;line-height:1.6}' +
      '.run-note a{color:var(--accent,#e07030)}.run-note{font-size:12.5px;color:var(--muted,#a09890);margin-top:16px;max-width:900px;line-height:1.5}' +
      ':root[data-theme="light"] .run-map{color:#1c1b1a;background:#eef1f2}:root[data-theme="light"] .run-map .run-chip{color:#3a3632;border-color:rgba(0,0,0,.2)}:root[data-theme="light"] .run-map .run-chip.on{background:#1c1b1a;color:#fff}' +
      ':root[data-theme="light"] .rl{fill:#6b6560}:root[data-theme="light"] .rl.cap{fill:#8a847e}:root[data-theme="light"] .rp{fill:#3a3632}:root[data-theme="light"] .rq,:root[data-theme="light"] .rln,:root[data-theme="light"] .re,:root[data-theme="light"] .rq2{fill:#1c1b1a}' +
      '.rl{font:11px "DM Sans",sans-serif;fill:#a09890}.rl.cap{letter-spacing:.08em;fill:#8a8178}.rp{font:12px "DM Sans",sans-serif;fill:#c9c2ba}.rn{font:600 12px "DM Sans",sans-serif}.rq{font:600 15px "DM Sans",sans-serif;fill:#f0ede8}.rln{font:600 14px "DM Sans",sans-serif;fill:#f0ede8}.re{font:12px "DM Sans",sans-serif;fill:#f0ede8}.rq2{font:italic 12px "DM Sans",sans-serif;fill:#f0ede8}';
    document.head.appendChild(s);
  }

  try { new MutationObserver(function () { if (X && document.body.classList.contains('run-mode')) { if (R.piece === 'flow') paintFlow(); else { var tk = document.getElementById('runTicks'); if (tk) tk.textContent = ''; var sd = document.getElementById('runSide'); if (sd) sd.removeAttribute('data-k'); paint(); } } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
  window.VTRun = { render: render, pieces: pieces, hasGame: function (x) { if (x) { X = x; el = x.el; S = x.S; } if (!X) return false; return hasGame(story()); }, stop: stopAnim };
})();
