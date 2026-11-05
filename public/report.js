// Report: an index of every output in the Lab. The consultant ticks what to include and downloads it
// as PowerPoint or PDF. Diagrams go in as pictures; tables go in as native tables that can be edited.
// The default look is plain: white, Arial, black. Other templates (fonts, colours, background images
// exported from a house PowerPoint, the client's logo) can be added and are kept with the engagement.
// Libraries are served from /vendor, loaded only when a report is built.
(function () {
  'use strict';
  var X, el, esc, S, M, N, A;
  var W = 13.333, H = 7.5; // slide size in inches (16:9)
  var PLAIN = { id: 'plain', name: 'Plain (white, Arial)', font: 'Arial', title: '000000', text: '000000', accent: '000000', bgTitle: '', bgContent: '' };
  var FONTS = ['Arial', 'Calibri', 'Helvetica', 'Georgia', 'Verdana', 'Tahoma', 'Times New Roman'];

  // ---------- what is saved with the engagement ----------
  var content = function () { var r = X.row('report'); return JSON.parse(JSON.stringify((r && r.content) || {})); };
  async function save(c) { await X.saveRow('report', c, 'partly'); }
  function templates() { return [PLAIN].concat(content().templates || []); }
  function tplById(id) { return templates().filter(function (t) { return t.id === id; })[0] || PLAIN; }

  // ---------- the index of every output ----------
  var chosen = function () { var r = X.row('toolkit'); return (r && r.content && r.content.chosen) || {}; };
  var VIS = function () { return X.D.tiles.filter(function (t) { return !t.toolkit || chosen()[t.toolkit]; }); };
  function mdById(id) { return M.models.filter(function (x) { return x.id === id; })[0]; }
  function modelItems(md, team) {
    var v = X.invData(), out = [];
    if (md.inventory) {
      var has = (v.processes || []).length || (v.resources || []).length;
      (X.INVV || []).forEach(function (iv) { out.push({ id: 'ibs:' + iv[0], t: md.name + ': ' + iv[1].toLowerCase(), kind: 'image', empty: !has, build: function () { return capture(function (host) { X.invView(iv[0], host); }); } }); });
      out.push({ id: 'ibs:table', t: md.name + ': resources (table)', kind: 'table', empty: !has, build: function () { return [{ head: ['Resource', 'Heading', 'Owner', 'Criticality', 'Recovery time', 'Alternative', 'Processes'], rows: (v.resources || []).map(function (r) { return [r.n, (X.RT[r.t] || [r.t])[0], r.owner, r.c, r.rto, r.alt, (r.u || []).map(function (id) { var p = (v.processes || []).filter(function (x) { return x.id === id; })[0]; return p ? p.n : id; }).join('; ')]; }) }]; } });
      return out;
    }
    var m = (md.key && v[md.key]) || {}, empty = md.empty(v, m);
    md.views.forEach(function (vw) { out.push({ id: md.id + ':' + vw[0], t: vw[1].toLowerCase() === md.name.toLowerCase() || md.views.length === 1 ? md.name : md.name + ': ' + vw[1].toLowerCase(), kind: 'image', team: team, empty: empty, build: function () { return capture(function (host) { md.draw[vw[0]].call(md, v, m, host); }); } }); });
    var regs = []; try { regs = md.registers(v, m) || []; } catch (e) { regs = []; }
    regs.forEach(function (r) { out.push({ id: md.id + ':reg:' + r.name, t: md.name + ': ' + r.name.replace(/-/g, ' ') + ' (table)', kind: 'table', team: team, empty: empty || !r.rows.length, build: function () { return [{ head: r.head, rows: r.rows }]; } }); });
    return out;
  }
  function analyseView(view) { return function () { return capture(function (host) { A.render(host, view); }, true); }; }
  function catalogue() {
    var tiles = VIS(), groups = [];
    // Problem
    var PG = X.D.groups.filter(function (g) { return g.id !== 'e'; });
    var FRm = X.FRAME, P = [{ id: 'p:frame', t: 'The problem framing canvas: every box', kind: 'table', build: function (aud) { return FRm.groups.map(function (g) { var bs = X.ORDER.map(function (k) { return FRm.boxes.filter(function (b) { return b.id === k; })[0]; }).filter(function (b) { return b.g === g.id && (aud === 'team' || !b.team); }); var rows = []; bs.forEach(function (b) { X.vis(b).forEach(function (f) { var v = X.fieldVal(b, f); rows.push([b.name, f.label, v ? v.text + (v.standin ? ' (carried over from ' + v.standin + ')' : '') : 'Not answered yet']); }); }); return { sub: g.name, head: ['Box', 'Line', 'The answer'], rows: rows }; }).filter(function (x) { return x.rows.length; }); } }];
    P.push({ id: 'p:canvas', t: 'The older tools, by part: all five parts', kind: 'table', build: function (aud) { return PG.map(function (g) { return { sub: g.name.replace(/^\d\.\s*/, ''), head: ['Tool', 'What it says'], rows: canvasRows(g.id, aud) }; }); } });
    PG.forEach(function (g) { P.push({ id: 'p:part:' + g.id, t: g.name.replace(/^\d\.\s*/, ''), kind: 'table', build: function (aud) { return [{ head: ['Tool', 'What it says'], rows: canvasRows(g.id, aud) }]; } }); });
    tiles.filter(function (t) { return t.team; }).forEach(function (t) { P.push({ id: 'p:team:' + t.id, t: t.name + ' (team only, in full)', kind: 'table', team: true, empty: !X.row(t.id), build: function () { var r = X.row(t.id); return [{ head: ['Tool', 'What it says'], rows: [[t.name, r ? (r.summary || '') : '']] }]; } }); });
    P.push({ id: 'p:questions', t: 'Questions sent back to Frame', kind: 'table', empty: !(S.data.questions || []).length, build: function () { return [{ head: ['Tool', 'Question', 'From', 'Status', 'Answer'], rows: (S.data.questions || []).map(function (q) { var t = tiles.filter(function (x) { return x.id === q.tile_key; })[0]; return [t ? t.name : q.tile_key, q.text, q.from_practice || 'Problem', q.status, q.answer || '']; }) }]; } });
    groups.push({ id: 'problem', name: 'Frame', items: P });
    groups.push({ id: 'project', name: 'Project', items: [{ id: 'j:run', t: 'Project set-up: who decides, terms, tools, when to stop', kind: 'table', build: function (aud) { return [{ head: ['Tool', 'What it says'], rows: canvasRows('e', aud) }]; } }] });
    // Diagnose: data collection
    var srcs = S.data.sources || [];
    var C = [
      { id: 'a:evidence', t: 'The four forms of evidence', kind: 'image', build: analyseView('analyse') },
      { id: 'a:sources', t: 'Sources', kind: 'table', empty: !srcs.length, build: function () { return [{ head: ['Source', 'Kind', 'From', 'Date', 'Form of evidence'], rows: srcs.map(function (x) { return [x.title, x.kind, [x.speaker, x.role].filter(Boolean).join(', '), x.source_date || '', N.FORMS[N.formOf(x)][0]]; }) }]; } },
      { id: 'a:levels', t: 'Evidence by level', kind: 'image', build: analyseView('levels') },
      { id: 'a:capitals', t: 'Evidence by capital', kind: 'image', build: analyseView('capitals') }];
    C = C.concat(modelItems(mdById('outside')));
    C.push({ id: 'a:models', t: 'Depth the evidence supports, by model', kind: 'image', team: true, build: analyseView('models') });
    C.push({ id: 'a:outcomes', t: 'Is it enough? The eleven outcomes', kind: 'image', team: true, build: analyseView('outcomes') });
    C.push({ id: 'a:request', t: 'The evidence request', kind: 'table', empty: !Object.keys(((X.row('request') || {}).content || {}).items || {}).length, build: function () { var it = ((X.row('request') || {}).content || {}).items || {}; return [{ head: ['Round', 'Who should answer', 'What we need', 'Status'], rows: Object.keys(it).map(function (k) { return [String(it[k].round), it[k].holder, it[k].text, it[k].status === 'closed' ? 'Entered in the model' : 'Asked']; }) }]; } });
    groups.push({ id: 'collect', name: 'Diagnose: data collection', items: C });
    // Diagnose: data analysis
    var T = [];
    // what goes right comes first: how it works, before how it fails (29 October 2026)
    var anl = M.models.filter(function (x) { return x.hidden && x.id !== 'outside' && !x.practice; });
    anl.sort(function (a, b) { return (b.id === 'goright') - (a.id === 'goright'); });
    anl.forEach(function (md) { T = T.concat(modelItems(md, md.id === 'evframe')); });
    groups.push({ id: 'analysis', name: 'Diagnose: how it works and how it fails', items: T });
    // The maps of the system
    var Mo = [];
    M.models.filter(function (x) { return !x.hidden; }).forEach(function (md) { Mo = Mo.concat(modelItems(md)); });
    groups.push({ id: 'model', name: 'Diagnose: maps of the system', items: Mo });
    var E = []; M.models.filter(function (x) { return x.practice === 'model'; }).forEach(function (md) { E = E.concat(modelItems(md)); });
    if (window.VTProps) E.unshift({ id: 'evaluate:props', t: 'Design propositions, with their test in the model', kind: 'table', empty: !window.VTProps.items().length, build: function () { return [{ head: ['', 'Proposition', 'It', 'Answers', 'Context', 'Intervention', 'Mechanisms', 'Outcomes', 'Scenario', 'What the model showed', 'Holds when', 'Status'], rows: window.VTProps.rows() }]; } });
    groups.push({ id: 'evaluate', name: 'Model', items: E });
    var Te = []; M.models.filter(function (x) { return x.practice === 'test'; }).forEach(function (md) { Te = Te.concat(modelItems(md)); });
    if (window.VTBeta) {
      Te.unshift({ id: 'test:beta-decisions', t: 'Trial in the organisation (beta): reflections and decisions', kind: 'table', empty: !window.VTBeta.decisions().length, build: function () { return [{ head: ['Proposition', 'Result', 'What worked', 'Why', 'What we now need to ask', 'What was learnt'], rows: window.VTBeta.decisions() }]; } });
      Te.unshift({ id: 'test:beta', t: 'Trial in the organisation (beta): what happened in use', kind: 'table', empty: !window.VTBeta.rows().length, build: function () { return [{ head: ['Proposition', 'Who', 'When', 'What happened', 'What it delivered', 'Harm', 'Purpose, Awareness, Coordination, Engagement', 'Against the model'], rows: window.VTBeta.rows() }]; } });
    }
    groups.push({ id: 'test', name: 'Test', items: Te });
    // only what is switched on for this engagement (Project › What's included)
    var SC = window.VTScope, AV = { evidence: 'v.analyse', sources: 'v.sources', levels: 'v.levels', capitals: 'v.capitals', models: 'v.models', outcomes: 'v.outcomes', request: 'v.request' };
    var sid = function (g, x) { var k = x.id.split(':'); if (g.id === 'project') return null; if (g.id === 'problem') return /^p:(canvas|part|team)/.test(x.id) ? 'p.tools' : 'problem'; if (k[0] === 'a') return AV[k[1]] || 'analyse'; return k[0]; };
    if (SC) groups.forEach(function (g) { g.items = g.items.filter(function (x) { var k = sid(g, x); return !k || (SC.on(k) && (!SC.inReport || SC.inReport(k))); }); });
    return groups.filter(function (g) { return g.items.length; });
  }
  function canvasRows(g, aud) {
    return VIS().filter(function (t) { return t.g === g && (aud === 'team' || !t.team); }).map(function (t) { var r = X.row(t.id), st = X.stateOf(t.id); return [t.name, r ? (st === 'skip' ? 'Not used' + (r.skip_reason ? ': ' + r.skip_reason : '') : (r.summary || 'No summary yet')) : 'Not started']; });
  }

  // ---------- pictures of diagrams ----------
  var PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'display', 'visibility', 'marker-end'];
  function inlineSvg(svg) {
    Array.prototype.forEach.call(svg.querySelectorAll('*'), function (n) {
      var cs = getComputedStyle(n), st = '';
      PROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) st += p + ':' + v + ';'; });
      n.setAttribute('style', st + (n.getAttribute('style') || ''));
    });
  }
  async function capture(draw, page) {
    var cap = document.getElementById('repcap'); if (!cap) { cap = el('div', { id: 'repcap', class: 'repcap' }); document.body.appendChild(cap); }
    cap.innerHTML = ''; var host = el('div', { class: 'invview' }); cap.appendChild(host);
    var oh = X.head; X.head = function () {};
    try { draw(host); } catch (e) { host.appendChild(el('p', { text: 'This view could not be drawn: ' + e.message })); } finally { X.head = oh; }
    Array.prototype.forEach.call(host.querySelectorAll('.no-print, button, select, input, textarea, .qflag, .qflagh, .needs, .seg'), function (n) { n.remove(); });
    if (page) Array.prototype.forEach.call(host.querySelectorAll('h1, .kick, .lead'), function (n) { n.remove(); });
    Array.prototype.forEach.call(host.querySelectorAll('.iscroll, .dscroll, .dwrap'), function (n) { n.style.maxHeight = 'none'; n.style.overflow = 'visible'; });
    Array.prototype.forEach.call(host.querySelectorAll('svg'), inlineSvg);
    await new Promise(function (r) { setTimeout(r, 30); });
    var canvas = await window.html2canvas(cap, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
    cap.innerHTML = '';
    return [{ png: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }];
  }

  // ---------- the deck, as plain slide records, then written as PowerPoint or PDF ----------
  async function slides(sel, aud, msg) {
    var out = [], groups = catalogue();
    var light = document.documentElement.getAttribute('data-theme'); document.documentElement.setAttribute('data-theme', 'light');
    try {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi], items = g.items.filter(function (x) { return sel[x.id] && (aud === 'team' || !x.team); });
        if (!items.length) continue;
        out.push({ section: g.name });
        for (var i = 0; i < items.length; i++) {
          msg('Building ' + items[i].t + '…');
          var parts = await items[i].build(aud);
          parts.forEach(function (p) { out.push(Object.assign({ title: items[i].t }, p, p.sub ? { title: items[i].t, sub: p.sub } : {})); });
        }
      }
    } finally { if (light) document.documentElement.setAttribute('data-theme', light); else document.documentElement.removeAttribute('data-theme'); }
    return out;
  }
  var hex = function (h) { return String(h || '000000').replace('#', ''); };
  function fit(w, h, bw, bh) { var r = Math.min(bw / w, bh / h); return { w: w * r, h: h * r }; }
  function loadImgSize(src) { return new Promise(function (ok) { if (!src) return ok(null); var i = new Image(); i.onload = function () { ok({ w: i.naturalWidth, h: i.naturalHeight }); }; i.onerror = function () { ok(null); }; i.src = src; }); }

  async function toPptx(deck, opt) {
    var tp = opt.tpl, P = new window.PptxGenJS(); P.layout = 'LAYOUT_WIDE'; P.title = opt.title; P.company = opt.engagement;
    P.theme = { headFontFace: tp.font, bodyFontFace: tp.font };
    var logo = opt.logo, ls = await loadImgSize(logo), lsz = ls ? fit(ls.w, ls.h, 1.7, 0.55) : null;
    var foot = [{ text: { text: opt.engagement + (opt.aud === 'team' ? '  ·  Team version: for the team only' : ''), options: { x: 0.5, y: 7.05, w: 9, h: 0.3, fontFace: tp.font, fontSize: 9, color: '666666' } } }];
    P.defineSlideMaster({ title: 'CONTENT', background: tp.bgContent ? { data: tp.bgContent } : { color: 'FFFFFF' }, objects: foot.concat(lsz ? [{ image: { data: logo, x: W - 0.5 - lsz.w, y: 0.3, w: lsz.w, h: lsz.h } }] : []), slideNumber: { x: W - 1.0, y: 7.05, fontFace: tp.font, fontSize: 9, color: '666666' } });
    P.defineSlideMaster({ title: 'TITLE', background: tp.bgTitle ? { data: tp.bgTitle } : { color: 'FFFFFF' }, objects: [] });
    var t = P.addSlide({ masterName: 'TITLE' });
    if (lsz) { var big = fit(ls.w, ls.h, 3.2, 1.2); t.addImage({ data: logo, x: 0.8, y: 0.8, w: big.w, h: big.h }); }
    t.addText(opt.title, { x: 0.8, y: 2.6, w: 11.5, h: 1.2, fontFace: tp.font, fontSize: 36, bold: true, color: hex(tp.title) });
    if (opt.sub) t.addText(opt.sub, { x: 0.8, y: 3.8, w: 11.5, h: 0.6, fontFace: tp.font, fontSize: 18, color: hex(tp.text) });
    t.addText([opt.engagement, opt.date, opt.aud === 'team' ? 'Team version: for the team only' : ''].filter(Boolean).join('\n'), { x: 0.8, y: 5.4, w: 11.5, h: 1.0, fontFace: tp.font, fontSize: 12, color: '666666' });
    deck.forEach(function (s2) {
      if (s2.section) { var sec = P.addSlide({ masterName: 'CONTENT' }); sec.addText(s2.section, { x: 0.8, y: 3.0, w: 11.5, h: 1.0, fontFace: tp.font, fontSize: 30, bold: true, color: hex(tp.title) }); sec.addShape(P.ShapeType.line, { x: 0.8, y: 4.05, w: 2.0, h: 0, line: { color: hex(tp.accent), width: 2 } }); return; }
      var sl = P.addSlide({ masterName: 'CONTENT' });
      sl.addText(s2.title, { x: 0.5, y: 0.3, w: W - 3, h: 0.6, fontFace: tp.font, fontSize: 22, bold: true, color: hex(tp.title) });
      if (s2.sub) sl.addText(s2.sub, { x: 0.5, y: 0.88, w: W - 3, h: 0.35, fontFace: tp.font, fontSize: 13, color: hex(tp.accent) });
      var top = s2.sub ? 1.35 : 1.15, bh = 6.85 - top;
      if (s2.png) { var f = fit(s2.w, s2.h, W - 1, bh); sl.addImage({ data: s2.png, x: (W - f.w) / 2, y: top, w: f.w, h: f.h }); }
      else if (s2.head) {
        if (!s2.rows.length) { sl.addText('Nothing recorded yet.', { x: 0.5, y: top, w: 8, h: 0.5, fontFace: tp.font, fontSize: 14, color: '666666' }); return; }
        var cell = function (v, hd) { return { text: String(v == null ? '' : v), options: { bold: !!hd, fill: hd ? { color: 'F0F0F0' } : undefined } }; };
        var rows = [s2.head.map(function (h) { return cell(h, true); })].concat(s2.rows.map(function (r) { return r.map(function (c) { return cell(c); }); }));
        sl.addTable(rows, { x: 0.5, y: top, w: W - 1, fontFace: tp.font, fontSize: s2.head.length > 7 ? 8 : 10, color: hex(tp.text), border: { type: 'solid', pt: 0.5, color: 'BFBFBF' }, valign: 'top', autoPage: true, autoPageRepeatHeader: true, autoPageHeaderRows: 1, autoPageSlideStartY: 1.15, newSlideStartY: 1.15, margin: 0.05 });
      }
    });
    await P.writeFile({ fileName: opt.file + '.pptx' });
  }

  async function toPdf(deck, opt) {
    var tp = opt.tpl, J = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'in', format: [W, H] }), font = 'helvetica', page = 1;
    var rgb = function (h) { h = hex(h); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
    var logo = opt.logo, ls = await loadImgSize(logo), lsz = ls ? fit(ls.w, ls.h, 1.7, 0.55) : null, fmt = function (d) { return /^data:image\/jpe?g/.test(d) ? 'JPEG' : 'PNG'; };
    function frame(isTitle) {
      var bg = isTitle ? tp.bgTitle : tp.bgContent; if (bg) J.addImage(bg, fmt(bg), 0, 0, W, H);
      if (isTitle) return;
      if (lsz) J.addImage(logo, fmt(logo), W - 0.5 - lsz.w, 0.3, lsz.w, lsz.h);
      J.setFont(font, 'normal'); J.setFontSize(9); J.setTextColor(102, 102, 102);
      J.text(opt.engagement + (opt.aud === 'team' ? '  ·  Team version: for the team only' : ''), 0.5, 7.2); J.text(String(page), W - 0.5, 7.2, { align: 'right' });
    }
    function next() { J.addPage([W, H], 'landscape'); page++; frame(false); }
    frame(true);
    if (lsz) { var big = fit(ls.w, ls.h, 3.2, 1.2); J.addImage(logo, fmt(logo), 0.8, 0.8, big.w, big.h); }
    J.setFont(font, 'bold'); J.setFontSize(36); J.setTextColor.apply(J, rgb(tp.title)); J.text(J.splitTextToSize(opt.title, 11.5), 0.8, 3.1);
    J.setFont(font, 'normal'); if (opt.sub) { J.setFontSize(18); J.setTextColor.apply(J, rgb(tp.text)); J.text(opt.sub, 0.8, 4.1); }
    J.setFontSize(12); J.setTextColor(102, 102, 102); J.text([opt.engagement, opt.date, opt.aud === 'team' ? 'Team version: for the team only' : ''].filter(Boolean), 0.8, 5.6);
    deck.forEach(function (s2) {
      next();
      if (s2.section) { J.setFont(font, 'bold'); J.setFontSize(30); J.setTextColor.apply(J, rgb(tp.title)); J.text(s2.section, 0.8, 3.6); J.setDrawColor.apply(J, rgb(tp.accent)); J.setLineWidth(0.03); J.line(0.8, 4.0, 2.8, 4.0); return; }
      var head = function () { J.setFont(font, 'bold'); J.setFontSize(22); J.setTextColor.apply(J, rgb(tp.title)); J.text(s2.title, 0.5, 0.75, { maxWidth: W - 3 }); if (s2.sub) { J.setFont(font, 'normal'); J.setFontSize(13); J.setTextColor.apply(J, rgb(tp.accent)); J.text(s2.sub, 0.5, 1.12); } };
      head();
      var top = s2.sub ? 1.35 : 1.15, bh = 6.85 - top;
      if (s2.png) { var f = fit(s2.w, s2.h, W - 1, bh); J.addImage(s2.png, 'PNG', (W - f.w) / 2, top, f.w, f.h); }
      else if (s2.head) {
        if (!s2.rows.length) { J.setFontSize(14); J.setTextColor(102, 102, 102); J.text('Nothing recorded yet.', 0.5, top + 0.3); return; }
        J.autoTable({ head: [s2.head], body: s2.rows.map(function (r) { return r.map(function (c) { return String(c == null ? '' : c); }); }), startY: top, margin: { left: 0.5, right: 0.5, top: 1.15, bottom: 0.65 }, theme: 'grid',
          styles: { font: font, fontSize: s2.head.length > 7 ? 7 : 9, textColor: rgb(tp.text), lineColor: [191, 191, 191], lineWidth: 0.007, cellPadding: 0.05, valign: 'top' }, headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          didDrawPage: function (d) { if (d.pageNumber > 1 && J.internal.getCurrentPageInfo().pageNumber !== page) { page = J.internal.getCurrentPageInfo().pageNumber; frame(false); head(); } } });
      }
    });
    J.save(opt.file + '.pdf');
  }

  // ---------- loading the libraries ----------
  function script(src) { return new Promise(function (ok, no) { if (document.querySelector('script[src="' + src + '"]')) return ok(); var s2 = document.createElement('script'); s2.src = src; s2.onload = ok; s2.onerror = function () { no(new Error('Could not load ' + src)); }; document.head.appendChild(s2); }); }
  async function libs(kind) {
    await script('/vendor/html2canvas.min.js');
    if (kind === 'pptx') await script('/vendor/pptxgen.bundle.js');
    else { await script('/vendor/jspdf.umd.min.js'); await script('/vendor/jspdf.plugin.autotable.min.js'); }
  }

  // ---------- images the consultant adds: the client's logo, template backgrounds ----------
  function readImage(file, maxW, maxH, jpeg) {
    return new Promise(function (ok, no) {
      if (!/^image\/(png|jpeg)$/.test(file.type)) return no(new Error('Please choose a PNG or JPEG image.'));
      var r = new FileReader(); r.onerror = function () { no(new Error('Could not read that file.')); };
      r.onload = function () { var i = new Image(); i.onerror = function () { no(new Error('That image could not be loaded.')); }; i.onload = function () { var f = Math.min(1, maxW / i.width, maxH / i.height), c = document.createElement('canvas'); c.width = Math.round(i.width * f); c.height = Math.round(i.height * f); var g = c.getContext('2d'); if (jpeg) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.82)); }; i.src = r.result; };
      r.readAsDataURL(file);
    });
  }

  // ---------- the page ----------
  function render(main) {
    var c = content(), R = S.rep = S.rep || {};
    if (!R.loaded) { var cur = (c.reports || []).filter(function (x) { return x.id === c.current; })[0] || (c.reports || [])[0]; R.sel = cur ? Object.assign({}, cur.sel) : {}; R.id = cur ? cur.id : null; R.name = cur ? cur.name : ''; R.title = cur ? cur.title : ''; R.sub = cur ? cur.sub : ''; R.aud = cur ? cur.aud : 'client'; R.tpl = cur ? cur.tpl : 'plain'; R.loaded = true; }
    X.head(S.data.session.name || 'Report', 'Report', 'Every output in the Lab, in one index. Open a group or search, tick what to include, then download it as PowerPoint or PDF. Diagrams go in as pictures; tables go in as tables that can be edited. Saved reports rebuild with the latest data.');
    var groups = catalogue(), lay = el('div', { class: 'replay' });
    // the index: a search box, then each group, folded until opened or searched
    var idx = el('div', { class: 'repidx' }), q = (R.q || '').trim().toLowerCase();
    // on opening the page, the groups that already hold chosen outputs start open
    if (!R.open) { R.open = {}; groups.forEach(function (g) { if (g.items.some(function (x) { return R.sel[x.id]; })) R.open[g.id] = true; }); }
    var search = el('input', { type: 'search', id: 'repSearch', placeholder: 'Search the outputs, for example: risk, bow tie, table', value: R.q || '', 'aria-label': 'Search the outputs' });
    search.addEventListener('input', function () { R.q = search.value; var pos = search.selectionStart; X.render(); var s2 = document.getElementById('repSearch'); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} } });
    idx.appendChild(el('div', { class: 'row repsearch no-print' }, [search,
      el('button', { class: 'btn sm', id: 'repOpenAll', text: 'Open all', onclick: function () { groups.forEach(function (g) { R.open[g.id] = true; }); X.render(); } }),
      el('button', { class: 'btn sm', id: 'repCloseAll', text: 'Fold all', onclick: function () { R.open = {}; X.render(); } })]));
    var hits = 0;
    groups.forEach(function (g) {
      var match = function (x) { return !q || (g.name + ' ' + x.t + ' ' + (x.kind === 'image' ? 'picture diagram' : 'table')).toLowerCase().indexOf(q) >= 0; };
      var items = g.items.filter(match); if (q && !items.length) return; hits += items.length;
      var usable = items.filter(function (x) { return !x.empty && (R.aud === 'team' || !x.team); });
      var allOn = usable.length && usable.every(function (x) { return R.sel[x.id]; });
      var nOn = g.items.filter(function (x) { return R.sel[x.id] && !x.empty && (R.aud === 'team' || !x.team); }).length;
      var open = !!q || !!R.open[g.id];
      var box = el('div', { class: 'glass evbox repgrp' + (open ? ' open' : ''), 'data-group': g.id });
      var tog = el('button', { class: 'repfold', 'aria-expanded': String(open), 'data-fold': g.id, onclick: function () { if (q) return; R.open[g.id] = !R.open[g.id]; X.render(); } }, [
        el('span', { class: 'chev', text: open ? '\u25be' : '\u25b8' }), el('span', { class: 'flab', style: 'margin:0', text: g.name }),
        el('span', { class: 'muted sm', text: (q ? items.length + ' of ' + g.items.length + ' match' : g.items.length + ' outputs') + (nOn ? '  ·  ' + nOn + ' chosen' : '') })]);
      box.appendChild(el('div', { class: 'spread' }, [tog, open ? el('button', { class: 'btn sm', 'data-all': g.id, text: allOn ? 'Clear' : (q ? 'Select these' : 'Select all'), onclick: function () { usable.forEach(function (x) { if (allOn) delete R.sel[x.id]; else R.sel[x.id] = true; }); X.render(); } }) : null]));
      if (open) items.forEach(function (x) {
        var off = x.empty || (x.team && R.aud !== 'team');
        var cb = el('input', { type: 'checkbox', 'data-item': x.id, disabled: off }); cb.checked = !off && !!R.sel[x.id];
        cb.addEventListener('change', function () { if (cb.checked) R.sel[x.id] = true; else delete R.sel[x.id]; count(); });
        box.appendChild(el('label', { class: 'repitem' + (off ? ' off' : '') }, [cb, el('span', { text: x.t }), el('span', { class: 'rk', text: x.kind === 'image' ? 'Picture' : 'Table' }), x.team ? el('span', { class: 'team', text: 'Team only' }) : null, x.empty ? el('span', { class: 'muted sm', text: 'nothing yet' }) : null]));
      });
      idx.appendChild(box);
    });
    if (q && !hits) idx.appendChild(el('p', { class: 'meta', id: 'repNone', text: 'No output matches “' + R.q + '”.' }));
    // the settings
    var side = el('div', { class: 'glass evbox repside' });
    var tIn = el('input', { type: 'text', id: 'repTitle', value: R.title || '', placeholder: 'Report title, for example: Findings for the board' }); tIn.oninput = function () { R.title = tIn.value; };
    var sIn = el('input', { type: 'text', id: 'repSub', value: R.sub || '', placeholder: 'Subtitle (optional)' }); sIn.oninput = function () { R.sub = sIn.value; };
    var aud = el('div', { class: 'seg' }, [['client', 'Organisation version'], ['team', 'Team version']].map(function (a) { return el('button', { 'aria-pressed': String(R.aud === a[0]), 'data-aud': a[0], text: a[1], onclick: function () { R.aud = a[0]; X.render(); } }); }));
    var tsel = el('select', { id: 'repTpl', 'aria-label': 'Template' }, templates().map(function (t) { return el('option', { value: t.id, text: t.name }); })); tsel.value = R.tpl || 'plain'; tsel.onchange = function () { R.tpl = tsel.value; X.render(); };
    var msg = el('div', { class: 'msg', id: 'repMsg' }), nEl = el('div', { class: 'meta', id: 'repCount' });
    function count() { var n = 0; groups.forEach(function (g) { g.items.forEach(function (x) { if (R.sel[x.id] && !x.empty && (R.aud === 'team' || !x.team)) n++; }); }); nEl.textContent = n + (n === 1 ? ' output chosen' : ' outputs chosen'); return n; }
    async function build(kind) {
      if (!count()) { msg.className = 'msg bad'; msg.textContent = 'Tick at least one output.'; return; }
      var say = function (t) { msg.className = 'msg'; msg.textContent = t; };
      try {
        say('Loading…'); await libs(kind);
        var deck = await slides(R.sel, R.aud, say), nm = S.data.session.name || 'Engagement';
        var opt = { title: R.title || 'Report', sub: R.sub || '', engagement: nm, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), aud: R.aud, tpl: tplById(R.tpl), logo: c.logo || '', file: ((R.title || 'report') + '-' + nm).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() };
        say('Writing the file…');
        if (kind === 'pptx') await toPptx(deck, opt); else await toPdf(deck, opt);
        msg.className = 'msg good'; msg.textContent = 'Downloaded: ' + deck.filter(function (x) { return !x.section; }).length + ' pages of content.';
      } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
    }
    // saved reports
    var reps = c.reports || [];
    var rsel = el('select', { id: 'repSaved', 'aria-label': 'Saved reports' }, [el('option', { value: '', text: reps.length ? 'Open a saved report…' : 'No saved reports yet' })].concat(reps.map(function (x) { return el('option', { value: x.id, text: x.name }); })));
    rsel.value = R.id || '';
    rsel.onchange = function () { var x = reps.filter(function (y) { return y.id === rsel.value; })[0]; if (!x) return; R.sel = Object.assign({}, x.sel); R.id = x.id; R.name = x.name; R.title = x.title; R.sub = x.sub; R.aud = x.aud; R.tpl = x.tpl; X.render(); };
    var nameIn = el('input', { type: 'text', id: 'repName', value: R.name || '', placeholder: 'Name to save under, for example: Board pack' });
    async function store(asNew) {
      var c2 = content(); c2.reports = c2.reports || [];
      var name = nameIn.value.trim(); if (!name) { nameIn.focus(); return; }
      var rec2 = { id: !asNew && R.id ? R.id : 'r' + Date.now().toString(36), name: name, sel: R.sel, title: R.title || '', sub: R.sub || '', aud: R.aud, tpl: R.tpl, saved_at: new Date().toISOString() };
      c2.reports = c2.reports.filter(function (x) { return x.id !== rec2.id; }).concat([rec2]); c2.current = rec2.id;
      try { await save(c2); R.id = rec2.id; R.name = name; X.render(); } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
    }
    // logo
    var logoIn = el('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: true, id: 'repLogoFile' });
    logoIn.onchange = async function () { var f = logoIn.files[0]; logoIn.value = ''; if (!f) return; try { var d = await readImage(f, 800, 400, false); var c2 = content(); c2.logo = d; await save(c2); X.render(); } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; } };
    side.appendChild(el('div', { class: 'flab', text: 'This report' }));
    side.appendChild(el('div', { class: 'col', style: 'gap:8px;margin-top:8px' }, [tIn, sIn, aud, el('p', { class: 'meta', style: 'margin:0', text: R.aud === 'team' ? 'Team version: everything, marked on every page as for the team only.' : 'Organisation version: team-only outputs are left out and cannot be ticked.' })]));
    side.appendChild(el('div', { class: 'flab', style: 'margin-top:16px', text: 'Look' }));
    side.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [tsel, el('button', { class: 'btn sm', id: 'repNewTpl', text: 'Add a template', onclick: function () { tplForm(); } }), R.tpl !== 'plain' ? el('button', { class: 'btn sm', text: 'Edit', onclick: function () { tplForm(tplById(R.tpl)); } }) : null]));
    side.appendChild(el('div', { class: 'row', style: 'margin-top:10px;align-items:center' }, [c.logo ? el('img', { src: c.logo, alt: 'Organisation logo', class: 'replogo' }) : el('span', { class: 'muted sm', text: 'No organisation logo' }), logoIn, el('button', { class: 'btn sm', id: 'repLogo', text: c.logo ? 'Change the logo' : 'Upload the organisation’s logo', onclick: function () { logoIn.click(); } }), c.logo ? el('button', { class: 'btn sm', text: 'Remove', onclick: async function () { var c2 = content(); delete c2.logo; await save(c2); X.render(); } }) : null]));
    side.appendChild(el('div', { class: 'flab', style: 'margin-top:16px', text: 'Download' }));
    side.appendChild(nEl);
    side.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn sm solid', id: 'repPptx', text: 'PowerPoint', onclick: function () { build('pptx'); } }), el('button', { class: 'btn sm solid', id: 'repPdf', text: 'PDF', onclick: function () { build('pdf'); } })]));
    side.appendChild(msg);
    side.appendChild(el('div', { class: 'flab', style: 'margin-top:16px', text: 'Saved reports' }));
    side.appendChild(el('div', { class: 'col', style: 'gap:8px;margin-top:8px' }, [rsel, nameIn, el('div', { class: 'row' }, [el('button', { class: 'btn sm', id: 'repSave', text: R.id ? 'Save changes' : 'Save', onclick: function () { store(false); } }), R.id ? el('button', { class: 'btn sm', text: 'Save as new', onclick: function () { store(true); } }) : null, R.id ? el('button', { class: 'btn sm', text: 'Delete', onclick: async function () { if (!confirm('Delete the saved report “' + R.name + '”? The outputs themselves are not touched.')) return; var c2 = content(); c2.reports = (c2.reports || []).filter(function (x) { return x.id !== R.id; }); delete c2.current; await save(c2); R.id = null; R.name = ''; X.render(); } }) : null])]));
    lay.appendChild(idx); lay.appendChild(side); main.appendChild(lay);
    count();
  }

  // ---------- a template: font, colours, and background images exported from a house PowerPoint ----------
  function tplForm(t0) {
    var t = Object.assign({}, PLAIN, t0 || { id: 't' + Date.now().toString(36), name: '' });
    var name = el('input', { type: 'text', id: 'tplName', value: t0 ? t.name : '', placeholder: 'Template name, for example: ChangeBefore' });
    var font = el('select', { id: 'tplFont' }, FONTS.map(function (f) { return el('option', { value: f, text: f }); })); font.value = t.font;
    var col = function (k, l) { var i = el('input', { type: 'color', value: '#' + hex(t[k]), 'data-col': k }); i.oninput = function () { t[k] = i.value.replace('#', ''); }; return el('label', { class: 'mef' }, [el('span', { text: l }), i]); };
    var bg = function (k, l) {
      var f = el('input', { type: 'file', accept: 'image/png,image/jpeg', 'data-bg': k }), prev = el('span', { class: 'muted sm', text: t[k] ? 'An image is set' : 'None' });
      f.onchange = async function () { if (!f.files[0]) return; try { t[k] = await readImage(f.files[0], 1600, 900, true); prev.textContent = 'An image is set'; } catch (e) { prev.textContent = e.message; } };
      return el('label', { class: 'mef wide2' }, [el('span', { text: l }), f, prev]);
    };
    var m = el('div', { class: 'msg' });
    X.modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: t0 ? 'Edit the template' : 'Add a template' }), el('button', { class: 'btn sm', text: 'Close', onclick: X.closeModal })]),
      el('p', { class: 'meta', text: 'A template sets the font, the colours and, if you want, a background picture for the title page and for the other pages. To use a house PowerPoint design, save its title slide and a blank content slide as pictures (File, Export, PNG) and add them here. Leave space at the top for the page title.' }),
      el('div', { class: 'merow' }, [el('label', { class: 'mef grow' }, [el('span', { text: 'Name' }), name]), el('label', { class: 'mef' }, [el('span', { text: 'Font' }), font]), col('title', 'Titles'), col('text', 'Text'), col('accent', 'Accent')]),
      el('div', { class: 'merow', style: 'margin-top:8px' }, [bg('bgTitle', 'Background for the title page'), bg('bgContent', 'Background for the other pages')]),
      el('div', { class: 'row', style: 'margin-top:12px' }, [el('button', { class: 'btn solid', id: 'tplSave', text: 'Save the template', onclick: async function () {
        if (!name.value.trim()) { name.focus(); return; }
        t.name = name.value.trim(); t.font = font.value;
        var c2 = content(); c2.templates = (c2.templates || []).filter(function (x) { return x.id !== t.id; }).concat([t]);
        try { await save(c2); S.rep.tpl = t.id; X.closeModal(); X.render(); } catch (e) { m.className = 'msg bad'; m.textContent = e.message; }
      } }), t0 ? el('button', { class: 'btn', text: 'Delete the template', onclick: async function () { var c2 = content(); c2.templates = (c2.templates || []).filter(function (x) { return x.id !== t.id; }); await save(c2); S.rep.tpl = 'plain'; X.closeModal(); X.render(); } }) : null]), m]);
  }

  window.VTReport = { init: function (x) { X = x; el = x.el; esc = x.esc; S = x.S; M = window.VTModel; N = window.VTNeeds; A = window.VTAnalyse; }, render: render, catalogue: catalogue };
})();
