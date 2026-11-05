// Use › Frame › Results: the steps of the service, drawn on a board that can be changed by hand (5 November 2026).
// Drag a step to move it; add a step; draw a line from one step to another; select a step to reword it,
// say who does it, or remove it. The steps are the frame's own (What we are working on › the steps), so a
// change here is a change to the frame, saved straight away and logged as a change made in Confirm.
(function () {
  'use strict';
  var X, el, ST = { sel: null, mode: 'move', from: null };
  var BW = 156, BH = 66, GX = 182, GY = 140, PER = 5;
  var ro = function () { return !!X.S.readonly; };
  function RT() { return window.VTRoute; }
  function steps(r) {
    var s = (r.steps || []).length ? r.steps : RT().on(r, 'work').map(function (t) { return { n: t, who: '' }; });
    return s.map(function (x, i) { return { id: x.id || 'st' + (i + 1), n: x.n || '', who: x.who || '', x: x.x, y: x.y }; });
  }
  function pos(s, i) { return { x: s.x != null ? s.x : 24 + (i % PER) * GX, y: s.y != null ? s.y : 48 + Math.floor(i / PER) * GY }; }
  function put(fn, summary) {
    if (ro()) return;
    RT().save(function (r) { var list = steps(r); fn(list, r); r.steps = list.map(function (s) { var o = { id: s.id, n: s.n, who: s.who }; if (s.x != null) { o.x = s.x; o.y = s.y; } return o; }); r.links = (r.links || []).filter(function (l) { return list.some(function (s) { return s.id === l.a; }) && list.some(function (s) { return s.id === l.b; }); }); if (!r.shape) r.shape = 'steps'; }, summary || 'Changed the steps, in Confirm')
      .then(function () { X.render(); }, function (e) { alert(e.message || e); });
  }
  function draw(host) {
    if (!RT()) { host.appendChild(el('p', { class: 'meta', text: 'Not available.' })); return; }
    css();
    var r = RT().R(), list = steps(r), links = r.links || [];
    var tools = el('div', { class: 'umap-tools', role: 'toolbar', 'aria-label': 'Drawing tools' }, ro() ? [] : [
      el('button', { type: 'button', class: 'umap-tb' + (ST.mode === 'move' ? ' on' : ''), 'aria-pressed': String(ST.mode === 'move'), text: 'Select and move', onclick: function () { ST.mode = 'move'; ST.from = null; X.render(); } }),
      el('button', { type: 'button', class: 'umap-tb' + (ST.mode === 'link' ? ' on' : ''), 'aria-pressed': String(ST.mode === 'link'), id: 'umapLink', text: 'Draw a line', onclick: function () { ST.mode = 'link'; ST.from = null; X.render(); } }),
      el('button', { type: 'button', class: 'umap-tb', id: 'umapAdd', text: 'Add a step', onclick: function () { var id = 'st' + Date.now().toString(36); ST.sel = id; put(function (l) { var last = l.length ? pos(l[l.length - 1], l.length - 1) : { x: -GX + 24, y: 36 }; l.push({ id: id, n: 'A new step', who: '', x: last.x + GX, y: last.y }); }, 'Added a step, in Confirm'); } }),
      el('span', { class: 'umap-hint', text: ST.mode === 'link' ? (ST.from ? 'Now press the step it goes to.' : 'Press the step the line starts from.') : 'Drag a step to move it. Press a step to change it.' })]);
    var maxX = 0, maxY = 0; list.forEach(function (s, i) { var p = pos(s, i); maxX = Math.max(maxX, p.x + BW); maxY = Math.max(maxY, p.y + BH); });
    var W = Math.max(1000, maxX + 40), H = Math.max(260, maxY + 50);
    var board = el('div', { class: 'umap-board', id: 'umapBoard', style: 'width:' + W + 'px;height:' + H + 'px' });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('class', 'umap-svg'); svg.setAttribute('aria-hidden', 'true');
    var P = {}; list.forEach(function (s, i) { P[s.id] = pos(s, i); });
    var line = function (a, b, cls) { var pa = P[a], pb = P[b]; if (!pa || !pb) return ''; var x1 = pa.x + BW, y1 = pa.y + BH / 2, x2 = pb.x, y2 = pb.y + BH / 2; if (pb.x < pa.x + BW) { x1 = pa.x + BW / 2; y1 = pa.y + BH; x2 = pb.x + BW / 2; y2 = pb.y; if (pb.y < pa.y) { y1 = pa.y; y2 = pb.y + BH; } } var mx = (x1 + x2) / 2; if (cls === 'own' && Math.abs(pa.y - pb.y) < BH && Math.abs(pb.x - pa.x) > GX + 10) { x1 = pa.x + BW / 2; y1 = pa.y; x2 = pb.x + BW / 2; y2 = pb.y; var up = Math.max(4, y1 - 30); return '<path class="own" d="M' + x1 + ',' + y1 + ' C' + x1 + ',' + (up - 10) + ' ' + x2 + ',' + (up - 10) + ' ' + x2 + ',' + y2 + '" marker-end="url(#umaro)"/>'; } return '<path class="' + cls + '" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" marker-end="url(#umar' + (cls === 'own' ? 'o' : '') + ')"/>'; };
    var s = '<defs><marker id="umar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity=".45"/></marker><marker id="umaro" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#e07030"/></marker></defs>';
    for (var i = 1; i < list.length; i++) s += line(list[i - 1].id, list[i].id, 'seq');
    links.forEach(function (l) { s += line(l.a, l.b, 'own'); });
    svg.innerHTML = s; board.appendChild(svg);
    list.forEach(function (st, i) {
      var p = P[st.id], b = el('button', { type: 'button', class: 'umap-box' + (ST.sel === st.id ? ' sel' : '') + (ST.from === st.id ? ' from' : ''), 'data-step': st.id, style: 'left:' + p.x + 'px;top:' + p.y + 'px', 'aria-label': (i + 1) + '. ' + st.n + (st.who ? ', done by ' + st.who : '') }, [el('span', { class: 'umap-n', text: (i + 1) + '. ' + (st.n || 'Unnamed') }), st.who ? el('span', { class: 'umap-w', text: st.who }) : null]);
      var drag = null;
      b.addEventListener('pointerdown', function (e) { if (ro() || ST.mode !== 'move') return; drag = { sx: e.clientX, sy: e.clientY, x: p.x, y: p.y, moved: false }; try { b.setPointerCapture(e.pointerId); } catch (er) {} });
      b.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { b.style.left = Math.max(0, drag.x + dx) + 'px'; b.style.top = Math.max(0, drag.y + dy) + 'px'; } });
      b.addEventListener('pointerup', function (e) { if (!drag) return; var d = drag; drag = null; if (d.moved) { var nx = Math.max(0, Math.round((d.x + e.clientX - d.sx) / 4) * 4), ny = Math.max(0, Math.round((d.y + e.clientY - d.sy) / 4) * 4); put(function (l) { l.forEach(function (x, j) { var q = pos(x, j); x.x = q.x; x.y = q.y; }); var me = l.filter(function (x) { return x.id === st.id; })[0]; if (me) { me.x = nx; me.y = ny; } }, 'Moved a step, in Confirm'); } });
      b.addEventListener('click', function () {
        if (ST.mode === 'link' && !ro()) { if (!ST.from) { ST.from = st.id; X.render(); return; } if (ST.from === st.id) { ST.from = null; X.render(); return; } var a = ST.from; ST.from = null; put(function (l, r) { r.links = (r.links || []).filter(function (x) { return !(x.a === a && x.b === st.id); }).concat([{ a: a, b: st.id }]); }, 'Drew a line between steps, in Confirm'); return; }
        ST.sel = ST.sel === st.id ? null : st.id; X.render();
      });
      board.appendChild(b);
    });
    var wrap = el('div', { class: 'umap' }, [tools, el('div', { class: 'umap-main' }, [el('div', { class: 'umap-scroll' }, [board]), side(list, links)])]);
    host.appendChild(wrap);
    host.appendChild(el('p', { class: 'um-note', text: 'Grey arrows: the order of the steps. Orange lines: drawn by hand, for example a hand-back or a step that skips ahead. These are the frame’s steps: the full picture of the service is the next tab.' }));
  }
  function side(list, links) {
    var st = list.filter(function (x) { return x.id === ST.sel; })[0];
    var box = el('div', { class: 'umap-side' });
    if (!st) { box.appendChild(el('p', { class: 'um-note', style: 'margin:0', text: list.length + (list.length === 1 ? ' step' : ' steps') + '. Press one to change its wording, say who does it, or remove it.' })); return box; }
    var name = el('input', { type: 'text', id: 'umapName', value: st.n, disabled: ro(), 'aria-label': 'Wording of the step' });
    name.addEventListener('change', function () { put(function (l) { var x = l.filter(function (y) { return y.id === st.id; })[0]; if (x) x.n = name.value.trim(); }, 'Reworded a step, in Confirm'); });
    var who = el('input', { type: 'text', value: st.who, disabled: ro(), placeholder: 'A role or team', 'aria-label': 'Who does it' });
    who.addEventListener('change', function () { put(function (l) { var x = l.filter(function (y) { return y.id === st.id; })[0]; if (x) x.who = who.value.trim(); }, 'Said who does a step, in Confirm'); });
    var nm = function (id) { var x = list.filter(function (y) { return y.id === id; })[0]; return x ? x.n : id; };
    var mine = links.filter(function (l) { return l.a === st.id || l.b === st.id; });
    box.appendChild(el('div', { class: 'um-k', text: 'Selected step' }));
    box.appendChild(el('label', { class: 'umap-f' }, [el('span', { text: 'Wording' }), name]));
    box.appendChild(el('label', { class: 'umap-f' }, [el('span', { text: 'Who does it' }), who]));
    if (mine.length) box.appendChild(el('div', { class: 'umap-links' }, [el('span', { class: 'um-k', text: 'Lines drawn by hand' })].concat(mine.map(function (l) { return el('div', { class: 'umap-l' }, [el('span', { text: nm(l.a) + ' → ' + nm(l.b) }), ro() ? null : el('button', { type: 'button', class: 'link', text: 'Remove', onclick: function () { put(function (ll, r) { r.links = (r.links || []).filter(function (x) { return !(x.a === l.a && x.b === l.b); }); }, 'Removed a line, in Confirm'); } })]); }))));
    if (!ro()) box.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { type: 'button', class: 'btn sm', text: 'Earlier', onclick: function () { put(function (l) { var i = l.map(function (x) { return x.id; }).indexOf(st.id); if (i > 0) { var t = l[i - 1]; l[i - 1] = l[i]; l[i] = t; } }, 'Reordered the steps, in Confirm'); } }),
      el('button', { type: 'button', class: 'btn sm', text: 'Later', onclick: function () { put(function (l) { var i = l.map(function (x) { return x.id; }).indexOf(st.id); if (i >= 0 && i < l.length - 1) { var t = l[i + 1]; l[i + 1] = l[i]; l[i] = t; } }, 'Reordered the steps, in Confirm'); } }),
      el('button', { type: 'button', class: 'btn sm', id: 'umapDel', text: 'Remove this step', onclick: function () { if (!confirm('Remove “' + st.n + '”? It stays in the history of the frame.')) return; ST.sel = null; put(function (l) { var i = l.map(function (x) { return x.id; }).indexOf(st.id); if (i >= 0) l.splice(i, 1); }, 'Removed a step, in Confirm'); } })]));
    box.appendChild(el('p', { class: 'um-note', text: 'Saved to the frame straight away, as a change made in Confirm.' }));
    return box;
  }
  function css() {
    if (document.getElementById('umapCss')) return;
    var s = document.createElement('style'); s.id = 'umapCss';
    s.textContent = '.umap-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.umap-tb{font:inherit;font-size:14px;padding:9px 14px;min-height:42px;border-radius:10px;border:1px solid var(--line,rgba(127,127,127,.4));background:none;color:inherit;cursor:pointer}.umap-tb.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0)}.umap-hint{font-size:13px;opacity:.75}' +
      '.umap-main{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}.umap-scroll{flex:999 1 620px;min-width:0;overflow:auto;border:1px solid var(--line,rgba(127,127,127,.3));border-radius:16px;background-image:radial-gradient(rgba(127,127,127,.25) 1px,transparent 1px);background-size:22px 22px}' +
      '.umap-board{position:relative}.umap-svg{position:absolute;left:0;top:0;pointer-events:none;color:inherit}.umap-svg .seq{fill:none;stroke:currentColor;stroke-opacity:.35;stroke-width:1.6}.umap-svg .own{fill:none;stroke:#e07030;stroke-width:2.2}' +
      '.umap-box{position:absolute;width:' + BW + 'px;min-height:' + BH + 'px;box-sizing:border-box;padding:8px 10px;border-radius:10px;border:1px solid #e07030;background:var(--bg,#141210);color:inherit;font:inherit;font-size:13px;line-height:1.3;text-align:left;cursor:grab;touch-action:none;display:flex;flex-direction:column;gap:3px}.umap-box.sel{outline:2px solid currentColor;outline-offset:3px}.umap-box.from{background:rgba(224,112,48,.2)}.umap-n{font-weight:600}.umap-w{font-size:11px;opacity:.7}' +
      '.umap-side{flex:1 1 240px;max-width:320px;border:1px solid var(--line,rgba(127,127,127,.3));border-radius:14px;padding:14px}.umap-f{display:flex;flex-direction:column;gap:4px;font-size:13px;margin:8px 0}.umap-f input{font:inherit;font-size:14px;padding:9px;min-height:40px}.umap-side .um-note{font-size:13px}.umap-l{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:4px 0}';
    document.head.appendChild(s);
  }
  window.VTUseMap = { attach: function (x) { X = x; el = x.el; if (window.VTUse) window.VTUse.OWN.stepsmap = function (host) { draw(host); }; } };
})();
