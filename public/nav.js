// The header every page shares: Home, the four steps of the method (Frame, Diagnose, Model, Test; 29 October 2026),
// Project, About Viability Thinking (open to every role, never hidden), and the depth of the engagement (1 to 5, for the team only).
// Each step keeps its internal scope id, so what was shown or hidden before still applies: Frame is "problem",
// Diagnose is "analyse", Model is "evaluate" and Test is "test".
// The days behind each level show only in the hover text; the client never sees them.
(function () {
  'use strict';
  var ITEMS = [['hub', 'Home', '/hub'], ['frame', 'Frame', '/frame'], ['diagnose', 'Diagnose', '/diagnose'], ['model', 'Model', '/model'], ['test', 'Test', '/test'], ['project', 'Project', '/project'], ['about', 'About Viability Thinking', '/about']];
  var BUILT = { about: 1, hub: 1, frame: 1, diagnose: 1, model: 1, test: 1, project: 1 };
  var SCOPEID = { frame: 'problem', diagnose: 'analyse', model: 'evaluate', test: 'test' };
  // older pages may still pass the old names
  var OLD = { problem: 'frame', analyse: 'diagnose', evaluate: 'model' };
  var DEPTHS = [null, ['', 'up to 1 day', 'Judgement in the room, scribbled notes, a sketched model'], ['', '2 to 4 days', 'Key documents read, the sponsor and a few people interviewed, the main models drawn'], ['', '5 to 15 days', 'Most documents and interviews, every core model populated, first scenarios'], ['', '16 to 50 days', 'Evidence gathered and checked across all four forms, every model populated, scenarios run'], ['', 'more than 50 days', 'Everything, including calibration data, tested combinations and a retest, up to a full inquiry']];
  var row = null, opts = {};
  function creds() { try { return JSON.parse(sessionStorage.getItem('vt_fac') || 'null'); } catch (e) { return null; } }
  async function papi(body) {
    var c = creds(); if (!c) throw new Error('Not signed in');
    var headers = { 'Content-Type': 'application/json' }, b = { session_code: c.session_code };
    if (c.master || c.member) { var hh = window.VTAuth ? await window.VTAuth.header() : null; if (hh) headers.Authorization = hh; } else b.fac_code = c.fac_code;
    for (var k in body) b[k] = body[k];
    var r = await fetch('/api/problem', { method: 'POST', headers: headers, body: JSON.stringify(b) });
    var d = await r.json().catch(function () { return {}; }); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d;
  }
  function draw(active) {
    var nav = document.querySelector('header .tabs'); if (!nav) return;
    nav.setAttribute('role', 'navigation'); nav.setAttribute('aria-label', 'The Lab');
    var SC = window.VTScope;
    var signedIn = !!creds() || !!opts.example;
    active = OLD[active] || active;
    nav.innerHTML = ITEMS.filter(function (x) { return signedIn || x[0] === 'hub' || x[0] === 'about'; }).filter(function (x) { return !SC || !SCOPEID[x[0]] || SC.on(SCOPEID[x[0]]) || x[0] === active; }).map(function (x) {
      var href = opts.example && (SCOPEID[x[0]] || x[0] === 'project') ? x[2] + '?example=' + encodeURIComponent(opts.example) : x[2];
      // inside a project, Home is the project home (its four steps); the Lab's front door is the logo, and links on the project home
      if (x[0] === 'hub' && (creds() || opts.example)) href = '/home' + (opts.example ? '?example=' + encodeURIComponent(opts.example) : '');
      // signed in, the header is full, so About is shortened (its full name shows on hover)
      var label = x[1], tip = '';
      return '<a href="' + href + '" data-nav="' + x[0] + '"' + tip + (x[0] === active ? ' aria-current="page" aria-selected="true"' : '') + (BUILT[x[0]] ? '' : ' class="soon" title="Not built yet: opens a description of it"') + '>' + label + '</a>';
    }).join('');
    var slot = document.getElementById('depth');
    if (!slot) { slot = document.createElement('div'); slot.id = 'depth'; slot.className = 'depth'; slot.hidden = true; nav.parentNode.insertBefore(slot, nav.nextSibling); }
  }
  function control() {
    // the depth is no longer chosen in the header (3 November 2026): it is read from the evidence, and the agreed depth is set in the protocol
    var slot0 = document.getElementById('depth'); if (slot0) { slot0.innerHTML = ''; slot0.hidden = true; } return;
    var slot = document.getElementById('depth'); if (!slot) return;
    var lvl = row && row.content && row.content.level ? Number(row.content.level) : 3;
    var sel = document.createElement('select'); sel.id = 'depthSel'; sel.setAttribute('aria-label', 'Depth of the engagement');
    for (var i = 1; i <= 5; i++) { var o = document.createElement('option'); o.value = String(i); o.textContent = 'Depth: ' + i + (DEPTHS[i][0] ? ' (' + DEPTHS[i][0] + ')' : ''); sel.appendChild(o); }
    sel.value = String(lvl);
    if (opts.readonly) { sel.disabled = true; slot.title = 'An example: read-only'; slot.innerHTML = ''; slot.appendChild(sel); slot.hidden = false; return; }
    var tip = function () { var x = DEPTHS[Number(sel.value)]; slot.title = 'Depth ' + sel.value + ': ' + x[1] + ' (for the team only). ' + x[2] + '.'; };
    sel.onchange = async function () {
      try {
        var d = await papi({ action: 'p_save', tile_key: 'depth', status: 'done', summary: 'Depth ' + sel.value, base_version: row ? row.version : null, content: { level: Number(sel.value), set_at: new Date().toISOString() } });
        row = d.tile; tip(); slot.classList.add('saved'); setTimeout(function () { slot.classList.remove('saved'); }, 900);
        if (opts.onDepth) opts.onDepth(row);
      } catch (e) { alert(e.message); sel.value = String(lvl); }
    };
    slot.innerHTML = ''; slot.appendChild(sel); tip(); slot.hidden = false;
  }
  window.VTNav = {
    // active: which item is this page. depthRow: the saved depth if the page already has it (undefined: load it).
    init: async function (o) {
      opts = o || {}; draw(opts.active);
      if (opts.depthRow !== undefined) { row = opts.depthRow; control(); return; }
      try {
        var d = await papi({ action: 'p_load' }); row = (d.tiles || []).filter(function (t) { return t.tile_key === 'depth'; })[0] || null; control();
        if (window.VTScope) { var tk = (d.tiles || []).filter(function (t) { return t.tile_key === 'toolkit'; })[0]; window.VTScope.setLegacy(tk && tk.content && tk.content.chosen); window.VTScope.set((d.tiles || []).filter(function (t) { return t.tile_key === 'scope'; })[0] || null); draw(opts.active); document.dispatchEvent(new Event('vtscope')); }
      } catch (e) { /* not signed in yet: no depth shown */ }
    },
    redraw: function () { draw(opts.active); },
    depth: function () { return row && row.content && row.content.level ? Number(row.content.level) : 3; }
  };
})();
