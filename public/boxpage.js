// The box page template (design brief 29, section 3), first used for box 8, "How we might help".
// Header with the stage strip; the hero content edited in place; a one-line summary with a compact
// "Change" card; the sources tray, which is also the drop zone; notes in the right margin (at most two);
// the team note in the left margin; one primary button whose label follows the stage.
// Picking in place: opening a source splits the page and selected words are taken word for word, each
// with its source number. The room view is the same page, dark, with team material hidden.
// Everything is saved in the frame tile under answers.help; image readings in the "readings" tile.
(function () {
  'use strict';
  var X, el, S, B = { open: null, room: false, card: false, menu: false, sel: null, picked: [], ai: null, aiErr: null, busy: false, flash: null };
  var MAXW = 150;

  // ---------- the kind of reason and the four markers ----------
  var SIDES = [['harm', 'Avoiding harm'], ['want', 'Reaching something wanted']];
  var WHENS = [['here', 'Already here'], ['might', 'Might happen'], ['date', 'Coming on a known date']];
  var WHENP = { here: 'that is already here', might: 'that might happen', date: 'coming on a known date' };
  var MARKS = [
    { id: 'trigger', label: 'Routine or triggered', opts: [['routine', 'Routine', 'routine'], ['triggered', 'Triggered by events', 'triggered by events']] },
    { id: 'idea', label: 'Whose idea it was to come', opts: [['own', 'Their own idea', 'their own idea', 'your own idea'], ['asked', 'Someone asked them to', 'someone asked them to', 'someone asked you to'], ['ours', 'Our suggestion', 'our suggestion']] },
    { id: 'solution', label: 'How far they have got towards a solution', opts: [['none', 'No solution chosen yet', 'no solution chosen yet'], ['ideas', 'Some ideas', 'some ideas for a solution'], ['chosen', 'A solution chosen', 'a solution chosen']] },
    { id: 'whose', label: 'Whose choice that solution is', opts: [['theirs', 'Theirs', 'their choice', 'your choice'], ['other', 'Someone else’s', 'someone else’s choice'], ['unknown', 'Not yet known', 'whose choice not yet known']] }];
  function kindText(k) {
    if (!k || !k.main) return '';
    var m = k.main.split('.'), side = SIDES.filter(function (s) { return s[0] === m[0]; })[0];
    var t = side[1] + ' ' + WHENP[m[1]];
    if (k.second) { var s2 = k.second.split('.'), sd2 = SIDES.filter(function (s) { return s[0] === s2[0]; })[0]; t += ', and ' + sd2[1].toLowerCase() + ' ' + WHENP[s2[1]]; }
    return t + '.';
  }
  function markText(mk, client) {
    mk = mk || {};
    return MARKS.filter(function (m) { return mk[m.id] && !(m.id === 'whose' && (!mk.solution || mk.solution === 'none')); }).map(function (m) {
      var o = m.opts.filter(function (x) { return x[0] === mk[m.id]; })[0]; return o ? (client && o[3] ? o[3] : o[2]) : '';
    }).filter(Boolean).map(function (t, i) { return i ? t : t.charAt(0).toUpperCase() + t.slice(1); }).join(' · ');
  }
  function sideOf(h) { return h && h.kind && h.kind.main ? h.kind.main.split('.')[0] : null; }

  // ---------- reading and saving ----------
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var words = function (s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; };
  var norm = function (v) { return String(v == null ? '' : v).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase(); };
  function frameRow() { return X.row('frame'); }
  function H() { var r = frameRow(), a = (r && r.content && r.content.answers) || {}; return a.help || {}; }
  function wordsOf(h) { return (h.fields && h.fields.words) || ''; }
  function readings() { var r = X.row('readings'); return (r && r.content && r.content.map) || {}; }
  function srcText(s) { if (!s) return ''; if (s.kind === 'image') { var rd = readings()[s.id]; return rd ? rd.text : ''; } return s.body || ''; }
  function sources() { return (S.data.sources || []); }
  function srcById(id) { return sources().filter(function (s) { return s.id === id; })[0]; }
  function tray(h) {
    var ids = (h.tray || []).slice(0);
    sources().forEach(function (s) { if (/^brief:help/.test(s.file_name || '') && ids.indexOf(s.id) < 0) ids.push(s.id); });
    return ids.map(srcById).filter(Boolean);
  }
  function numOf(h, id) { return tray(h).map(function (s) { return s.id; }).indexOf(id) + 1; }
  function stageOf(h) {
    var w = wordsOf(h).trim();
    if (w && h.check && h.check.agreed && norm(h.check.agreed.words) === norm(w)) return 'agreed';
    if (w) return 'drafted';
    if (tray(h).length) return 'gathered';
    return 'none';
  }
  function me() { return S.data.as === 'master' ? 'David (master)' : 'Facilitator'; }
  // Change the help answer and save the frame tile. mut(h) changes h in place; way is recorded when the words change.
  async function save(mut, way) {
    var r = frameRow(), c = clone((r && r.content) || {}); c.answers = c.answers || {};
    var h = c.answers.help = c.answers.help || {}; h.fields = h.fields || { words: '', notes: '' };
    var before = h.fields.words || '';
    mut(h);
    var now = new Date().toISOString();
    if ((h.fields.words || '') !== before) {
      if (words(h.fields.words) > MAXW) throw new Error('Their words are over ' + MAXW + ' words. Please shorten them.');
      if (before.trim()) { h.past = (h.past || []).slice(0); h.past.unshift({ fields: { words: before, notes: h.fields.notes || '' }, by: h.by, at: h.at }); h.past = h.past.slice(0, 20); }
      var w = way || 'write'; h.from = (h.from || []).filter(function (x) { return x.way !== w; }).concat([{ way: w }]);
      h.by = me(); h.at = now;
      h.cites = (h.cites || []).filter(function (ct) { return (h.fields.words || '').indexOf(ct.text) >= 0; });
    }
    if (!h.at) { h.at = now; h.by = me(); }
    var d = await X.api({ action: 'p_save', tile_key: 'frame', status: frameStatus(c), summary: 'Changed: How we might help', content: c, base_version: r ? r.version : null });
    S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'frame'; }); S.data.tiles.push(d.tile);
    return d.tile.content.answers.help;
  }
  async function safe(fn) { try { B.busy = true; await fn(); B.err = null; } catch (e) { B.err = e.message; } B.busy = false; paint(); }

  // ---------- small parts ----------
  function strip(st, room) {
    var steps = [['gathered', 'Gathered'], ['drafted', 'Drafted'], ['agreed', 'Agreed']], at = steps.map(function (s) { return s[0]; }).indexOf(st);
    var kids = [];
    steps.forEach(function (s, i) {
      if (i) kids.push(el('span', { class: 'bx-line' + (i <= at ? ' done' : '') }));
      kids.push(el('span', { class: 'bx-step' + (i < at ? ' done' : i === at ? ' now' : ''), 'data-step': s[0], 'aria-current': i === at ? 'step' : null }, [el('i', {}), s[1]]));
    });
    return el('div', { class: 'bx-strip', role: 'list', 'aria-label': 'Stage' }, kids);
  }
  function stepLabel(id) { var st = (window.PROBLEM.frame.steps || []).filter(function (x) { return (x.boxes || []).indexOf(id) >= 0; })[0]; return st ? 'Step ' + st.n + ' of ' + window.PROBLEM.frame.steps.length : ''; }
  // the system as agreed in step 2 (the Define route), and its name
  function SYS() { var r = frameRow(), a = (r && r.content && r.content.answers) || {}; return a.system || {}; }
  function sysAgreed() { var y = SYS(); return !!(y.route && y.route.agreed); }
  function sysName() { var y = SYS(); return (y.route && y.route.name) || (y.fields && y.fields.what) || ''; }
  function serviceName() {
    var a = (frameRow() && frameRow().content && frameRow().content.answers) || {}, sy = a.system && a.system.fields;
    return (sy && sy.what) || S.data.session.client || S.data.session.name || '';
  }
  function heroNodes(h, highlight) {
    var w = wordsOf(h), cites = (h.cites || []).map(function (c) { return { c: c, i: w.indexOf(c.text) }; }).filter(function (x) { return x.i >= 0; }).sort(function (a, b) { return a.i - b.i; });
    var out = [], pos = 0;
    cites.forEach(function (x) {
      if (x.i < pos) return;
      if (x.i > pos) out.push(document.createTextNode(w.slice(pos, x.i)));
      var n = numOf(h, x.c.src), hl = highlight && highlight.indexOf(x.c.text) >= 0;
      out.push(el('span', { class: 'bx-pass' + (hl ? ' hl' : ''), 'data-src': x.c.src }, [x.c.text]));
      if (n > 0) out.push(el('sup', { class: 'bx-cite', title: 'From source ' + n + ': ' + (srcById(x.c.src) || {}).title, tabindex: B.room ? null : '0', 'data-n': n, onclick: function (e) { e.stopPropagation(); if (!B.room) { B.open = x.c.src; paint(); } } }, [String(n)]));
      pos = x.i + x.c.text.length;
    });
    if (pos < w.length) out.push(document.createTextNode(w.slice(pos)));
    return out;
  }
  function thumb(s, n) {
    var kid;
    if (s.kind === 'image' && /^data:image\//.test(s.body || '')) kid = el('img', { src: s.body, alt: '' });
    else if (s.kind === 'notes') kid = el('div', { class: 'bx-lined' }, [String(s.body || '').split('\n').slice(0, 4).join('\n')]);
    else if (/^https?:\/\//.test((s.file_name || '')) || /website|web page/i.test(s.title)) kid = el('div', { class: 'bx-glyph', html: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>' });
    else if (s.kind === 'transcript') kid = el('div', { class: 'bx-glyph', html: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 11v2"/></svg>' });
    else kid = el('div', { class: 'bx-doc' }, [el('i', {}), el('i', {}), el('i', {}), el('i', {})]);
    return el('div', { class: 'bx-src' }, [el('button', { class: 'bx-thumb', 'data-src': s.id, title: 'Open ' + s.title, 'aria-label': 'Open source ' + n + ': ' + s.title, onclick: function () { B.open = s.id; paint(); } }, [kid]),
      el('div', { class: 'bx-cap' }, [el('b', { text: String(n) }), ' ' + shortTitle(s)])]);
  }
  function shortTitle(s) { var d = s.source_date ? ', ' + new Date(s.source_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; return s.title + (s.title.indexOf(d.slice(2)) >= 0 ? '' : d); }

  // ---------- the page ----------
  var HOST;
  function render(main, x, id) {
    X = x; el = x.el; S = x.S; css();
    if (B.box !== id) { B = { open: null, room: false, card: false, menu: false, sel: null, picked: [], ai: null, busy: false, box: id }; }
    document.body.classList.add('bx-on');
    HOST = el('div', { class: 'bx', id: 'bxHost' }); main.appendChild(HOST); paint();
    if (aiOn() && !B.ai && !B.aiAsked) { B.aiAsked = true; if (id === 'question') askAiQ(); else askAi(); }
  }
  function paint() {
    if (!HOST) return;
    var keepFocus = document.activeElement && document.activeElement.id;
    HOST.innerHTML = ''; hideBar();
    document.body.classList.toggle('bx-room', !!B.room);
    if (B.box === 'question') return paintQ();
    var h = H();
    if (B.room) return paintRoom(h);
    if (B.open && srcById(B.open)) return paintPick(h);
    B.open = null;
    var st = stageOf(h);
    // header
    HOST.appendChild(el('div', { class: 'bx-head' }, [
      el('div', { class: 'bx-hl' }, [el('button', { class: 'bx-back', id: 'bxBack', onclick: function () { X.go('canvas'); } }, ['‹ Canvas']), el('b', { class: 'bx-name', text: 'How we might help' })]),
      strip(st),
      el('div', { class: 'bx-hr' }, [el('span', { class: 'bx-svc', title: serviceName(), text: serviceName() }), el('button', { class: 'bx-link', id: 'bxShare', title: 'Show this page on a call or in the room, with team notes hidden', onclick: function () { B.room = true; paint(); } }, ['Share'])])]));
    var grid = el('div', { class: 'bx-grid' }), left = el('div', { class: 'bx-left' }), centre = el('div', { class: 'bx-centre' }), right = el('div', { class: 'bx-right', id: 'bxMargin' });
    grid.appendChild(left); grid.appendChild(centre); grid.appendChild(right); HOST.appendChild(grid);
    // team note, left margin
    var tn = el('textarea', { class: 'bx-tn', id: 'bxTeam', rows: 4, placeholder: 'First impressions, for the team', 'aria-label': 'Team note' }); tn.value = h.team || '';
    tn.addEventListener('blur', function () { if ((h.team || '') !== tn.value) safe(async function () { await save(function (x) { x.team = tn.value.trim(); }); B.flash = 'Team note saved'; }); });
    left.appendChild(el('div', { class: 'bx-team team-only' }, [el('div', { class: 'bx-lock' }, [lock(), ' Team only']), tn]));
    // hero
    centre.appendChild(el('div', { class: 'bx-over' }, [el('span', { text: 'In their words' }), wordsOf(h) ? el('span', { class: 'bx-tag', title: 'Evidence: what they said', text: 'Said' }) : null]));
    var draft = B.draft != null ? B.draft : null;
    var hero = el('div', { class: 'bx-hero' + (wordsOf(h) || draft ? '' : ' empty'), id: 'bxWords', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Their words, up to 150 words', spellcheck: 'false' });
    if (draft != null) hero.textContent = draft; // a change that could not be saved stays on the page
    else if (wordsOf(h)) heroNodes(h, B.picked).forEach(function (n) { hero.appendChild(n); });
    else hero.setAttribute('data-ph', tray(h).length ? 'Open a source below and select their words, or type them here.' : 'Drop in notes from your first conversation, or type their words here.');
    var cnt = el('div', { class: 'bx-count', id: 'bxCount', hidden: draft == null });
    hero.addEventListener('focus', function () { hero.textContent = B.draft != null ? B.draft : wordsOf(H()); cnt.hidden = false; setCnt(); });
    hero.addEventListener('input', setCnt);
    hero.addEventListener('keydown', function (e) { if (e.key === 'Escape') { B.draft = null; hero.textContent = wordsOf(H()); hero.blur(); } });
    hero.addEventListener('blur', function () {
      var v = hero.innerText.replace(/\s+\n/g, '\n').trim();
      if (v === wordsOf(H()).trim()) { B.draft = null; hero.innerHTML = ''; if (v) heroNodes(H(), B.picked).forEach(function (n) { hero.appendChild(n); }); cnt.hidden = true; return; }
      B.draft = v;
      safe(async function () { await save(function (x) { x.fields.words = v; }, 'write'); B.draft = null; B.flash = 'Saved'; });
    });
    function setCnt() { var n = words(hero.innerText); cnt.textContent = n + ' of ' + MAXW + ' words'; cnt.className = 'bx-count' + (n > MAXW ? ' over' : ''); }
    caretIn(hero); centre.appendChild(hero); centre.appendChild(cnt); if (draft != null) setCnt();
    // one-line summary
    var kt = kindText(h.kind), mt = markText(h.markers), sd = sideOf(h);
    centre.appendChild(el('div', { class: 'bx-sum', id: 'bxSum' }, [sd ? el('span', { class: 'bx-dot ' + (sd === 'harm' ? 'exp' : 'val'), 'aria-hidden': 'true' }) : null,
      el('span', { class: 'bx-sumt' }, kt || mt ? [kt ? el('b', { text: kt }) : null, mt ? ' ' + mt : null] : [el('span', { class: 'bx-faint', text: 'What kind of reason is it? Tap it in while the call is fresh.' })]),
      el('button', { class: 'bx-link', id: 'bxChange', 'aria-expanded': String(!!B.card), onclick: function () { B.card = !B.card; paint(); } }, [kt || mt ? 'Change' : 'Choose'])]));
    if (B.card) centre.appendChild(kindCard(h));
    // the problem as they first put it (their words, no checks), and why now
    centre.appendChild(lineField('bxFirst', 'The problem as they first put it', 'Their words, as they first put the problem. No checks: it is kept as it was said.', (h.fields || {}).first || '', function (v) { return save(function (x) { x.fields.first = v; }); }));
    centre.appendChild(lineField('bxWhyNow', 'Why now', 'What prompted this now? How urgent?', whyNow(h), function (v) { return save(function (x) { x.fields.why = v; }); }));
    // sources tray
    var ts = tray(h);
    centre.appendChild(el('div', { class: 'bx-over', style: 'margin-top:40px' }, [el('span', { text: 'Sources' })]));
    var tr = el('div', { class: 'bx-tray', id: 'bxTray' });
    ts.forEach(function (s, i) { tr.appendChild(thumb(s, i + 1)); });
    tr.appendChild(el('div', { class: 'bx-src' }, [el('button', { class: 'bx-add', id: 'bxAdd', 'aria-expanded': String(!!B.menu), onclick: function () { B.menu = !B.menu; paint(); } }, [el('b', { text: '+' }), el('span', { text: 'Add notes, a transcript or an email' })])]));
    centre.appendChild(tr);
    if (B.menu) centre.appendChild(addMenu(h));
    // right margin: the client's reply, then suggestions (at most two notes in all)
    margin(h, right);
    // the one button
    var btn = primary(h, st);
    var foot = el('div', { class: 'bx-foot' }, [btn.el, el('div', { class: 'bx-hint', id: 'bxHint', text: B.err || B.flash || btn.hint }), btn.also || null]);
    if (B.err) foot.lastChild.classList.add('bad');
    HOST.appendChild(foot);
    B.flash = null;
    dropZone();
    if (keepFocus) { var f = document.getElementById(keepFocus); if (f && f.id !== 'bxWords') try { f.focus(); } catch (e) {} }
  }
  // On focus, make sure the caret is inside the element (a selection left over from an earlier page can stop typing)
  function caretIn(e) {
    var fix = function () { var s = window.getSelection(); if (s && !e.contains(s.anchorNode)) { var g = document.createRange(); g.selectNodeContents(e); g.collapse(false); s.removeAllRanges(); s.addRange(g); } };
    // at once on focus, again after the click has placed it, and before any key, so no keystroke is lost
    e.addEventListener('focus', function () { fix(); setTimeout(fix, 0); }); e.addEventListener('keydown', fix); return e;
  }
  // one line, edited in place, with its label above
  function lineField(id, label, ph, val, onSave) {
    var t = caretIn(el('div', { class: 'bx-ln', id: id, contenteditable: 'true', role: 'textbox', 'aria-label': label, 'data-ph': ph, text: val }));
    t.addEventListener('blur', function () { var v = t.innerText.trim(); if (v === String(val || '').trim()) return; safe(async function () { await onSave(v); B.flash = 'Saved'; }); });
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t.blur(); } if (e.key === 'Escape') { t.textContent = val; t.blur(); } });
    return el('div', { class: 'bx-lf' }, [el('div', { class: 'bx-over' }, [el('span', { text: label })]), t]);
  }
  // why now lives on box 8 since the six steps; older sessions kept it on the question
  function whyNow(h) { return ((h || H()).fields || {}).why || ((Q().fields || {}).why) || ''; }
  function lock() { return el('span', { class: 'bx-lk', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' }); }

  function primary(h, st) {
    var chk = h.check || {}, sent = chk.sent && norm(chk.sent.words) === norm(wordsOf(h));
    if (st === 'none') return { el: pbtn('Add notes from the call', function () { B.menu = true; paint(); }), hint: 'Or drop a file anywhere on this page' };
    if (st === 'gathered') return { el: pbtn('Draft their words', function () { B.open = tray(h)[0].id; paint(); }), hint: 'Open a source and select their words' };
    var nextQ = function () { X.go(sysAgreed() ? 'box=question' : 'box=system'); }, nextT = sysAgreed() ? 'Next: the question' : 'Next: what we are working on';
    if (st === 'drafted' && !sent) return { el: pbtn('Send to the organisation to check', function () { sendCheck(h); }), hint: 'Tap the words to edit them', also: el('button', { class: 'bx-link sm', id: 'bxNextQ', onclick: nextQ }, [nextT + ' ›']) };
    if (st === 'drafted') return { el: pbtn(nextT, nextQ), hint: 'Sent to the organisation to check on ' + day(chk.sent.at) + '. Their reply will show here.', also: el('button', { class: 'bx-link sm', id: 'bxMarkAgreed', onclick: function () { markAgreed(); } }, ['Mark as agreed']) };
    return { el: pbtn(nextT, nextQ), hint: 'Agreed by ' + chk.agreed.by + ' on ' + day(chk.agreed.at) + '. Change the words and they go back to Drafted.' };
  }
  function pbtn(t, fn) { return el('button', { class: 'bx-primary', id: 'bxPrimary', disabled: B.busy ? true : null, onclick: fn }, [t]); }
  var day = function (d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''; };

  // ---------- the compact card: kind of reason and the four markers ----------
  function kindCard(h) {
    var k = clone(h.kind || {}), mk = clone(h.markers || {});
    var grid = el('div', { class: 'bx-six', role: 'group', 'aria-label': 'The kind of reason: tap once for the main reason, again for a second' });
    grid.appendChild(el('span', {})); WHENS.forEach(function (w) { grid.appendChild(el('span', { class: 'bx-sixh', text: w[1] })); });
    SIDES.forEach(function (s) {
      grid.appendChild(el('span', { class: 'bx-sixr', text: s[1] }));
      WHENS.forEach(function (w) {
        var id = s[0] + '.' + w[0], on = k.main === id ? 'main' : k.second === id ? 'second' : '';
        grid.appendChild(el('button', { class: 'bx-cell ' + s[0] + (on ? ' ' + on : ''), 'data-cell': id, 'aria-pressed': String(!!on), title: s[1] + ', ' + w[1].toLowerCase(), onclick: function () {
          if (k.main === id) { k.main = k.second || null; k.second = null; } else if (k.second === id) k.second = null; else if (!k.main) k.main = id; else k.second = id;
          commit();
        } }, [on === 'main' ? 'Main' : on === 'second' ? 'Second' : '']));
      });
    });
    var marks = el('div', { class: 'bx-marks' }, MARKS.map(function (m) {
      return el('div', { class: 'bx-mk', role: 'group', 'aria-label': m.label }, [el('span', { class: 'bx-mkl', text: m.label }), el('span', { class: 'bx-seg' }, m.opts.map(function (o) {
        return el('button', { 'data-mark': m.id + ':' + o[0], class: mk[m.id] === o[0] ? 'on' : '', 'aria-pressed': String(mk[m.id] === o[0]), onclick: function () { mk[m.id] = mk[m.id] === o[0] ? null : o[0]; commit(); } }, [o[1]]);
      }))]);
    }));
    function commit() { safe(async function () { await save(function (x) { x.kind = k; x.markers = mk; }); }); }
    return el('div', { class: 'bx-card', id: 'bxCard' }, [el('div', { class: 'bx-cardh' }, [el('b', { text: 'The kind of reason' }), el('button', { class: 'bx-link', onclick: function () { B.card = false; paint(); } }, ['Done'])]),
      el('p', { class: 'bx-faint', text: 'Tap once for the main reason, and a second cell if there is one. It shows again with the question.' }), grid, marks]);
  }

  // ---------- the right margin ----------
  function margin(h, host) {
    var notes = [], chk = h.check || {}, last = (chk.replies || []).slice(-1)[0];
    if (last && (!chk.agreed || new Date(last.at) > new Date(chk.agreed.at)) && last.verdict !== 'agree') notes.push(el('div', { class: 'bx-note reply', 'data-note': 'reply' }, [el('p', {}, [el('b', { text: (last.verdict === 'notquite' ? 'Not quite' : 'Comment') + ', from ' + last.name + ': ' }), '“' + (last.comment || '') + '”']), last.changed ? el('p', { class: 'bx-faint', text: 'They also changed the words. The earlier version is kept.' }) : null]));
    if (aiOn() && B.ai) {
      var A = B.ai, done = (h.ai && h.ai.done) || {};
      if (A.mean && !done.mean) notes.push(el('div', { class: 'bx-note', 'data-note': 'mean' }, [el('p', { text: 'I think you mean: ' + A.mean + ' Is that right?' }), el('div', { class: 'bx-acts' }, [
        el('button', { class: 'bx-link', onclick: function () { respond('mean', 'yes'); } }, ['Yes']), el('button', { class: 'bx-link', onclick: function () { respond('mean', 'notquite'); } }, ['Not quite']), el('button', { class: 'bx-link', onclick: function () { sayDifferently(); } }, ['Say it differently'])])]));
      var offers = (A.offers || []).filter(function (o) { return !done['o:' + o.text]; });
      if (offers.length && notes.length < 2) notes.push(el('div', { class: 'bx-note', 'data-note': 'offers' }, [el('p', { text: (offers.length === 1 ? 'One detail belongs elsewhere: ' : offers.length + ' details belong elsewhere: ') + offers.map(function (o) { return '“' + o.text + '” (' + boxName(o.box) + ')'; }).join(' and ') + '.' }), el('div', { class: 'bx-acts' }, [
        el('button', { class: 'bx-link', onclick: function () { placeOffers(offers); } }, ['Place them']), el('button', { class: 'bx-link', onclick: function () { offers.forEach(function (o) { done['o:' + o.text] = 'not now'; }); safe(async function () { await save(function (x) { x.ai = x.ai || {}; x.ai.done = done; }); }); } }, ['Not now'])])]));
    }
    if (B.aiErr && aiOn()) notes.push(el('div', { class: 'bx-note', text: B.aiErr }));
    notes.slice(0, 2).forEach(function (n) { host.appendChild(n); });
  }
  function boxName(id) { var b = (window.PROBLEM.frame.boxes || []).filter(function (x) { return x.id === id; })[0]; return b ? shortBox(b) : id; }
  function shortBox(b) { return ({ question: 'The question', system: 'The system', service: 'The service', value: 'The value side', exposure: 'The exposure side', operates: 'How it operates', requires: 'What it requires', good: 'Demand', gap: 'Impact' })[b.id] || b.name; }

  // ---------- adding sources ----------
  function addMenu(h) {
    var used = tray(h).map(function (s) { return s.id; }), others = sources().filter(function (s) { return used.indexOf(s.id) < 0 && s.practice !== 'request'; });
    var item = function (id, t, d, fn) { return el('button', { class: 'bx-mi', 'data-add': id, onclick: fn }, [el('b', { text: t }), el('span', { text: d })]); };
    var grp = function (t, kids) { return el('div', { class: 'bx-mg' }, [el('div', { class: 'bx-mgt', text: t })].concat(kids)); };
    return el('div', { class: 'bx-menu', id: 'bxMenu' }, [
      grp('Notes from the call', [item('type', 'Type notes', 'Typed during or after the call', function () { formNotes(); }), item('photo', 'Photos of handwritten notes', 'One or more pages, with what they say', function () { pickFile('image/*', formPhoto, true); }), item('file', 'A file of notes', 'Word, PDF or text', function () { pickFile('.txt,.md,.docx,.pdf', function (f) { formFile(f, 'notes'); }); })]),
      grp('A recording or transcript', [item('transcript', 'Upload a transcript', 'From Teams or Zoom, only with consent', function () { pickFile('.vtt,.srt,.txt,.docx', function (f) { formFile(f, 'transcript'); }); })]),
      grp('Their own words, in advance', [item('email', 'An email, brief or tender', 'Something they have already sent', function () { pickFile('.txt,.md,.eml,.docx,.pdf', function (f) { formFile(f, 'document'); }); }), item('link', 'Send them a short link', 'Three questions, answered before the call', function () { briefLink(h); }), item('web', 'A web page', 'Their website or another page', function () { formWeb(); })]),
      others.length ? grp('Already added', others.slice(0, 6).map(function (s) { return item('use-' + s.id, s.title, 'Use this source here', function () { useSource(s.id); }); })) : null]);
  }
  function pickFile(accept, then, many) { var i = el('input', { type: 'file', accept: accept, hidden: true, multiple: many ? true : null }); i.addEventListener('change', function () { if (i.files[0]) then(many ? Array.prototype.slice.call(i.files) : i.files[0]); }); document.body.appendChild(i); i.click(); setTimeout(function () { i.remove(); }, 60000); }
  function useSource(id) { safe(async function () { await save(function (x) { x.tray = (x.tray || []).concat([id]); }); B.menu = false; }); }
  async function addSource(body) { var d = await X.api(Object.assign({ action: 's_add' }, body)); S.data.sources.push(d.source); await save(function (x) { x.tray = (x.tray || []).concat([d.source.id]); }); return d.source; }
  function overlay(title, kids, onOk, okText) {
    var m = el('div', { class: 'bx-msg', id: 'bxMsg', role: 'alert' }), box;
    var close = function () { box.remove(); };
    box = el('div', { class: 'bx-ov', onclick: function (e) { if (e.target === box) close(); } }, [el('div', { class: 'bx-dlg', role: 'dialog', 'aria-label': title }, [el('h3', { text: title })].concat(kids).concat([m, el('div', { class: 'bx-dlgb' }, [
      el('button', { class: 'bx-link', onclick: close }, ['Cancel']), onOk ? el('button', { class: 'bx-primary sm', id: 'bxOk', onclick: async function (e) { var b = e.currentTarget; b.disabled = true; try { await onOk(); close(); B.menu = false; paint(); } catch (er) { m.textContent = er.message; b.disabled = false; } } }, [okText || 'Add']) : null])]))]);
    document.body.appendChild(box); var f = box.querySelector('input,textarea'); if (f) f.focus();
    return box;
  }
  var fld = function (label, input) { return el('label', { class: 'bx-f' }, [el('span', { text: label }), input]); };
  var inp = function (id, v, ph, type) { var i = el('input', { id: id, type: type || 'text', placeholder: ph || '' }); if (v) i.value = v; return i; };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  function formNotes() {
    var t = inp('nTitle', 'Call notes'), d = inp('nDate', today(), '', 'date'), b = el('textarea', { id: 'nBody', rows: 10, placeholder: 'Who said what, in their words' });
    overlay('Type notes', [fld('Title', t), fld('Date of the call', d), fld('The notes', b)], async function () { await addSource({ kind: 'notes', title: t.value || 'Call notes', source_date: d.value, body: b.value }); }, 'Add the notes');
  }
  function formWeb() {
    var u = inp('wUrl', '', 'https://'), t = inp('wTitle', 'Their website'), b = el('textarea', { id: 'wBody', rows: 8, placeholder: 'Paste the words from the page you want to use' });
    overlay('A web page', [fld('Address', u), fld('Title', t), fld('The words to use', b)], async function () {
      if (!/^https?:\/\/\S+$/.test(u.value.trim())) throw new Error('Give the address, starting https://');
      await addSource({ kind: 'document', title: t.value || 'Web page', file_name: u.value.trim().slice(0, 200), source_date: today(), body: u.value.trim() + '\n\n' + b.value });
    }, 'Add the page');
  }
  async function formFile(f, kind) {
    var body = '';
    try { body = await X.readFileText(f); } catch (e) { return overlay('That file could not be read', [el('p', { text: e.message })]); }
    var t = inp('fTitle', f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')), d = inp('fDate', today(), '', 'date'), who = inp('fWho', '', 'Who wrote or said it'), b = el('textarea', { id: 'fBody', rows: 8 }); b.value = body;
    var cons = kind === 'transcript' ? el('input', { type: 'checkbox', id: 'fConsent' }) : null;
    overlay(kind === 'transcript' ? 'Add a transcript' : kind === 'notes' ? 'Add notes' : 'Add their email, brief or tender', [fld('Title', t), fld('Date', d), fld('From', who), fld('The text, as it will be kept', b),
      cons ? el('label', { class: 'bx-tick' }, [cons, ' Everyone on the call agreed to it being recorded or transcribed']) : null], async function () {
      if (cons && !cons.checked) throw new Error('A transcript can be added only when everyone agreed to the recording. Tick to confirm, or add notes instead.');
      await addSource({ kind: kind, title: t.value || f.name, source_date: d.value, speaker: who.value, file_name: f.name, consent: cons ? 'Recorded with the consent of everyone on the call' : '', body: b.value });
    }, 'Add it');
  }
  function formPhoto(f) {
    var files = Array.isArray(f) ? f : [f]; f = files[0];
    shrink(files).then(function (url) {
      var t = inp('pTitle', 'Call notes'), d = inp('pDate', today(), '', 'date'), rd = el('textarea', { id: 'pRead', rows: 6, placeholder: 'What the page says, so words can be picked from it. You can add this later.' });
      var auto = aiOn() ? el('button', { class: 'bx-link', id: 'pAuto', onclick: async function () { auto.textContent = 'Reading the page…'; try { var r = await X.api({ action: 'ai_read', image: url }); rd.value = r.text; auto.textContent = 'Read. Check it against the page.'; } catch (e) { auto.textContent = e.message; } } }, ['Read the page for me']) : null;
      overlay(files.length > 1 ? files.length + ' pages of handwritten notes' : 'A page of handwritten notes', [el('img', { class: 'bx-prev', src: url, alt: 'The pages as uploaded' }), fld('Title', t), fld('Date of the call', d), fld(files.length > 1 ? 'What the pages say' : 'What the page says', rd), auto], async function () {
        var s = await addSource({ kind: 'image', title: t.value || 'Handwritten notes', source_date: d.value, file_name: f.name, body: url });
        if (rd.value.trim()) await saveReading(s.id, rd.value.trim());
      }, 'Add the page');
    }).catch(function (e) { overlay('That picture could not be read', [el('p', { text: e.message })]); });
  }
  // photos of the pages, one under another, made small enough to keep (quality stepped down to fit)
  function loadImg(f) {
    return new Promise(function (ok, no) {
      var r = new FileReader(); r.onerror = function () { no(new Error('The picture could not be opened')); };
      r.onload = function () { var img = new Image(); img.onerror = function () { no(new Error('This is not a picture the browser can read')); }; img.onload = function () { ok(img); }; img.src = r.result; };
      r.readAsDataURL(f);
    });
  }
  async function shrink(files) {
    var imgs = []; for (var i = 0; i < files.length; i++) imgs.push(await loadImg(files[i]));
    var W = Math.min(1200, Math.max.apply(null, imgs.map(function (m) { return m.width; }))), hs = imgs.map(function (m) { return Math.round(m.height * W / m.width); });
    var c = document.createElement('canvas'); c.width = W; c.height = hs.reduce(function (a, b) { return a + b; }, 0) + (imgs.length - 1) * 16;
    var g = c.getContext('2d'); g.fillStyle = '#e8e6e1'; g.fillRect(0, 0, c.width, c.height);
    var y = 0; imgs.forEach(function (m, k) { g.drawImage(m, 0, y, W, hs[k]); y += hs[k] + 16; });
    var scale = 1, q = 0.8, u = c.toDataURL('image/jpeg', q);
    while (u.length > 380000 && (q > 0.35 || scale > 0.5)) {
      if (q > 0.35) q -= 0.1; else { scale -= 0.15; var c2 = document.createElement('canvas'); c2.width = Math.round(c.width * scale); c2.height = Math.round(c.height * scale); c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height); u = c2.toDataURL('image/jpeg', q); continue; }
      u = c.toDataURL('image/jpeg', q);
    }
    if (u.length > 395000) throw new Error('The pictures are too large to keep together. Add fewer pages at a time.');
    return u;
  }
  async function saveReading(id, text) {
    var r = X.row('readings'), c = clone((r && r.content) || {}); c.map = c.map || {}; c.map[id] = { text: text, by: me(), at: new Date().toISOString() };
    var d = await X.api({ action: 'p_save', tile_key: 'readings', status: 'partly', summary: 'Reading of a page of notes', content: c, base_version: r ? r.version : null });
    S.data.tiles = S.data.tiles.filter(function (t) { return t.tile_key !== 'readings'; }); S.data.tiles.push(d.tile);
  }
  function briefLink(h) {
    var url = location.origin + '/brief', code = S.data.session.session_code;
    var txt = 'Before we speak, could you answer three short questions? Go to ' + url + ' and sign in with the code ' + code + '. It takes about five minutes.';
    var ta = el('textarea', { id: 'lText', rows: 4, readonly: true }); ta.value = txt;
    overlay('Send them a short link', [el('p', { text: 'They answer three questions: what has prompted this now, what they would like from us, and anything we should read. Their answers arrive here as a source.' }), fld('A message to send them', ta),
      el('button', { class: 'bx-link', onclick: function (e) { try { navigator.clipboard.writeText(txt); e.currentTarget.textContent = 'Copied'; } catch (er) { ta.select(); } } }, ['Copy the message'])], async function () { await save(function (x) { x.brief = { sentAt: new Date().toISOString(), by: me() }; }); B.flash = 'Marked as sent. Their answers will appear in the sources.'; }, 'Mark as sent');
  }
  function dropZone() {
    if (document.body._bxDrop) return; document.body._bxDrop = true;
    document.addEventListener('dragover', function (e) { if (!document.getElementById('bxHost') || B.room) return; e.preventDefault(); document.body.classList.add('bx-drag'); });
    document.addEventListener('dragleave', function (e) { if (e.relatedTarget == null) document.body.classList.remove('bx-drag'); });
    document.addEventListener('drop', function (e) {
      if (!document.getElementById('bxHost') || B.room) return; e.preventDefault(); document.body.classList.remove('bx-drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      var all = Array.prototype.slice.call(e.dataTransfer.files); if (all.every(function (x) { return /^image\//.test(x.type); })) return formPhoto(all);
      if (/^image\//.test(f.type)) formPhoto(f); else if (ext === 'vtt' || ext === 'srt') formFile(f, 'transcript'); else if (ext === 'eml') formFile(f, 'document'); else formFile(f, 'notes');
    });
  }

  // ---------- picking in place ----------
  function paintPick(h) {
    var s = srcById(B.open), ts = tray(h), n = numOf(h, s.id);
    var pane = el('div', { class: 'bx-split' }), L = el('div', { class: 'bx-sl' }), R = el('div', { class: 'bx-sr' });
    pane.appendChild(L); pane.appendChild(R); HOST.appendChild(pane);
    L.appendChild(el('div', { class: 'bx-tabs' }, [el('button', { class: 'bx-back', id: 'bxClose', onclick: function () { B.open = null; B.picked = []; paint(); } }, ['✕ Close source'])].concat(ts.map(function (x, i) {
      return el('button', { class: 'bx-tab' + (x.id === s.id ? ' on' : ''), 'data-src': x.id, onclick: function () { B.open = x.id; paint(); } }, [(i + 1) + ' · ' + tabName(x)]);
    }))));
    var sheet = el('div', { class: 'bx-sheet' + (s.kind === 'image' || s.kind === 'notes' ? ' paper' : '') });
    var text = srcText(s);
    if (s.kind === 'image') {
      if (/^data:image\//.test(s.body || '')) sheet.appendChild(el('img', { class: 'bx-page', src: s.body, alt: 'The page as uploaded' }));
      if (!text) {
        var rd = el('textarea', { id: 'bxRead', rows: 8, placeholder: 'Type what the page says, so you can pick their words from it' });
        sheet.appendChild(el('div', { class: 'bx-readbox' }, [el('b', { text: 'What the page says' }), rd, el('div', { class: 'bx-acts' }, [el('button', { class: 'bx-primary sm', id: 'bxReadSave', onclick: function () { if (rd.value.trim()) safe(async function () { await saveReading(s.id, rd.value.trim()); }); } }, ['Keep this reading']),
          aiOn() ? el('button', { class: 'bx-link', onclick: async function (e) { var b = e.currentTarget; b.textContent = 'Reading the page…'; try { var r = await X.api({ action: 'ai_read', source_id: s.id }); rd.value = r.text; b.textContent = 'Read. Check it against the page, then keep it.'; } catch (er) { b.textContent = er.message; } } }, ['Read the page for me']) : null])]));
      }
    }
    if (text) {
      var body = el('div', { class: 'bx-read', id: 'bxSource', contenteditable: 'true', spellcheck: 'false', role: 'document', 'aria-readonly': 'true', 'aria-label': 'Source ' + n + ', ' + s.title + '. Select words to use them.', tabindex: '0' });
      text.split(/\n/).forEach(function (line) { body.appendChild(el('p', { text: line || ' ' })); });
      // read only, but keeps a caret so words can be selected with the keyboard
      body.addEventListener('beforeinput', function (e) { e.preventDefault(); });
      body.addEventListener('keydown', function (e) { if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault(); if (e.key === 'Enter' && B.sel) { e.preventDefault(); var b0 = document.querySelector('#bxBar button'); if (b0) b0.focus(); } });
      body.addEventListener('paste', function (e) { e.preventDefault(); }); body.addEventListener('drop', function (e) { e.preventDefault(); });
      ['mouseup', 'keyup'].forEach(function (ev) { body.addEventListener(ev, function () { setTimeout(function () { onSelect(body, s, h); }, 0); }); });
      sheet.appendChild(body);
    }
    L.appendChild(sheet);
    // the right: the box content
    R.appendChild(el('div', { class: 'bx-sh' }, [el('b', { text: 'How we might help' }), el('span', { class: 'bx-faint', text: 'Select words in the source to use them' })]));
    R.appendChild(el('div', { class: 'bx-over' }, [el('span', { text: 'In their words' })]));
    var hero = el('div', { class: 'bx-hero sm' + (wordsOf(h) ? '' : ' empty'), id: 'bxWords', 'data-ph': 'Select their words in the source on the left. Each passage keeps its source number.' });
    heroNodes(h, B.picked).forEach(function (x) { hero.appendChild(x); });
    R.appendChild(hero);
    if (B.picked.length) R.appendChild(el('p', { class: 'bx-ok', id: 'bxKept' }, [el('span', { class: 'tick', text: '✓' }), ' Added from ' + (s.title || 'the source').toLowerCase() + ', kept word for word. Their spelling and shorthand are tidied only if they agree.']));
    // also in this source
    var also = alsoIn(h, s);
    if (also.length) { R.appendChild(el('div', { class: 'bx-over', style: 'margin-top:28px' }, [el('span', { text: 'Also in this source' })])); R.appendChild(el('div', { class: 'bx-chips', id: 'bxAlso' }, also)); }
    var used = (h.cites || []).filter(function (c) { return wordsOf(h).indexOf(c.text) >= 0; }), nsrc = {}; used.forEach(function (c) { nsrc[c.src] = 1; });
    R.appendChild(el('div', { class: 'bx-done' }, [el('button', { class: 'bx-primary', id: 'bxDone', onclick: function () { B.open = null; B.picked = []; paint(); } }, ['Done']), el('span', { class: 'bx-faint', id: 'bxUsed', text: used.length + (used.length === 1 ? ' passage' : ' passages') + ' used from ' + Object.keys(nsrc).length + (Object.keys(nsrc).length === 1 ? ' source' : ' sources') }), B.err ? el('span', { class: 'bad', text: B.err }) : null]));
  }
  function tabName(s) { return s.kind === 'image' || s.kind === 'notes' ? (/call/i.test(s.title) ? 'Call notes' : s.title) : /email/i.test(s.title) ? 'Email' : /web/i.test(s.title) ? 'Website' : s.title; }
  function alsoIn(h, s) {
    var out = [];
    (window.PROBLEM.frame.boxes || []).forEach(function (b) {
      var a = frameAll()[b.id]; ((a && a.inbox) || []).filter(function (x) { return x.src === s.id; }).forEach(function (x) { out.push(el('span', { class: 'bx-chip done' }, [x.text + ' ', el('b', { text: '→ ' + shortBox(b) })])); });
    });
    ((h.teamPicks || []).filter(function (x) { return x.src === s.id; })).forEach(function (x) { out.push(el('span', { class: 'bx-chip done' }, [x.text + ' ', el('b', { text: '→ Team note' })])); });
    if (aiOn() && B.ai) ((B.ai.offers || []).filter(function (o) { return o.src === s.id && !((h.ai && h.ai.done) || {})['o:' + o.text]; })).forEach(function (o) { out.push(el('button', { class: 'bx-chip', title: 'Offered: place it in ' + boxName(o.box), onclick: function () { placeOffers([o]); } }, [o.text + ' ', el('b', { text: '→ ' + boxName(o.box) })])); });
    return out;
  }
  function frameAll() { var r = frameRow(); return (r && r.content && r.content.answers) || {}; }
  function onSelect(body, s, h) {
    var sel = window.getSelection(); if (!sel || sel.isCollapsed || !body.contains(sel.anchorNode)) { hideBar(); B.sel = null; return; }
    var t = sel.toString().replace(/\s*\n\s*/g, ' ').trim(); if (!t) { hideBar(); return; }
    B.sel = { text: t, src: s.id };
    var rc = sel.getRangeAt(0).getBoundingClientRect(); showBar(rc, h);
  }
  function hideBar() { var b = document.getElementById('bxBar'); if (b) b.remove(); var m = document.getElementById('bxSend'); if (m) m.remove(); }
  function showBar(rc, h) {
    hideBar();
    var bar = el('div', { class: 'bx-bar', id: 'bxBar', role: 'toolbar', 'aria-label': 'Use the selected words' }, [
      el('button', { id: 'barAdd', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { pickAdd(); } }, ['Add to their words']),
      el('button', { id: 'barSend', 'aria-haspopup': 'true', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { sendMenu(bar); } }, ['Send to another box']),
      el('button', { id: 'barTeam', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { pickTeam(); } }, ['Team note'])]);
    bar.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideBar(); var src = document.getElementById('bxSource'); if (src) src.focus(); } });
    document.body.appendChild(bar);
    var top = rc.top + window.scrollY - bar.offsetHeight - 10; if (top < window.scrollY + 8) top = rc.bottom + window.scrollY + 10;
    bar.style.top = top + 'px'; bar.style.left = Math.max(8, Math.min(window.innerWidth - bar.offsetWidth - 8, rc.left + window.scrollX)) + 'px';
  }
  function pickAdd() {
    var p = B.sel; if (!p) return; hideBar();
    safe(async function () {
      var w0 = wordsOf(H());
      if (words(w0 + ' ' + p.text) > MAXW) throw new Error('That would take their words over ' + MAXW + '. Remove something first.');
      await save(function (x) { x.fields.words = (w0.trim() ? w0.trim() + ' ' : '') + p.text; x.cites = (x.cites || []).concat([{ text: p.text, src: p.src, by: me(), at: new Date().toISOString() }]); }, 'extract');
      B.picked.push(p.text); B.sel = null;
    });
  }
  function pickTeam() {
    var p = B.sel; if (!p) return; hideBar();
    safe(async function () { await save(function (x) { x.team = ((x.team || '').trim() ? x.team.trim() + '\n' : '') + p.text; x.teamPicks = (x.teamPicks || []).concat([{ text: p.text, src: p.src }]); }); B.sel = null; });
  }
  function sendMenu(bar) {
    var m = el('div', { class: 'bx-sendm', id: 'bxSend', role: 'menu' }, (window.PROBLEM.frame.boxes || []).filter(function (b) { return b.id !== 'help' && !b.band; }).map(function (b) {
      return el('button', { role: 'menuitem', 'data-box': b.id, onmousedown: function (e) { e.preventDefault(); }, onclick: function () { sendTo(b.id); } }, [shortBox(b)]);
    }));
    m.style.top = (parseFloat(bar.style.top) + bar.offsetHeight + 6) + 'px'; m.style.left = bar.style.left; document.body.appendChild(m);
    var f = m.querySelector('button'); if (f) f.focus();
  }
  async function sendToBox(box, items) {
    var r = frameRow(), c = clone((r && r.content) || {}); c.answers = c.answers || {}; var a = c.answers[box] = c.answers[box] || {};
    a.inbox = (a.inbox || []).concat(items.map(function (x) { return { text: x.text, src: x.src, from: 'help', by: me(), at: new Date().toISOString() }; }));
    var d = await X.api({ action: 'p_save', tile_key: 'frame', status: r ? r.status : 'partly', summary: 'Sent to ' + box + ' from How we might help', content: c, base_version: r ? r.version : null });
    S.data.tiles = S.data.tiles.filter(function (t) { return t.tile_key !== 'frame'; }); S.data.tiles.push(d.tile);
  }
  function sendTo(box) { var p = B.sel; if (!p) return; hideBar(); safe(async function () { await sendToBox(box, [p]); B.sel = null; }); }

  // ---------- the client check ----------
  function sendCheck(h) {
    var url = location.origin + '/check', code = S.data.session.session_code;
    var txt = 'Here is what we heard about how we might help, in your words. Please check it, change anything that is not quite right, and agree it if it is. Go to ' + url + ' and sign in with the code ' + code + '.';
    var ta = el('textarea', { id: 'cText', rows: 4, readonly: true }); ta.value = txt;
    overlay('Send to the organisation to check', [el('p', { text: 'They see their words and the kind of reason, never the team note. They can change the words, say Not quite with a comment, or agree. Any change they make is kept as a new version, with this one kept too.' }), fld('A message to send them', ta),
      el('button', { class: 'bx-link', onclick: function (e) { try { navigator.clipboard.writeText(txt); e.currentTarget.textContent = 'Copied'; } catch (er) { ta.select(); } } }, ['Copy the message'])],
    async function () { await save(function (x) { x.check = x.check || {}; x.check.sent = { at: new Date().toISOString(), by: me(), words: wordsOf(x) }; }); B.flash = 'Open for the organisation to check.'; }, 'Open it for them');
  }
  function markAgreed() {
    var who = inp('aWho', '', 'Name and role');
    overlay('Mark as agreed', [el('p', { text: 'Use this when they have agreed the words with you, on a call or in the room.' }), fld('Who agreed', who)], async function () {
      if (!who.value.trim()) throw new Error('Say who agreed');
      await save(function (x) { x.check = x.check || {}; x.check.agreed = { at: new Date().toISOString(), by: who.value.trim(), words: wordsOf(x), how: 'with the team' }; });
    }, 'Mark as agreed');
  }

  // ---------- the room view ----------
  function paintRoom(h) {
    var st = stageOf(h);
    HOST.appendChild(el('div', { class: 'bx-head bx-rm' }, [
      el('div', { class: 'bx-hl' }, [el('b', { class: 'bx-name', text: 'How we might help' }), el('span', { class: 'bx-svc', text: serviceName() })]),
      strip(st, true),
      el('div', { class: 'bx-hr' }, [el('span', { class: 'bx-hidden', id: 'bxHidden' }, [lock(), ' Team notes hidden while sharing']), el('button', { class: 'bx-link', id: 'bxStop', onclick: function () { B.room = false; paint(); } }, ['Stop sharing'])])]));
    var c = el('div', { class: 'bx-roomc' });
    c.appendChild(el('div', { class: 'bx-over bx-rm' }, [el('span', { text: 'In your words' })]));
    c.appendChild(el('div', { class: 'bx-hero bx-rm', id: 'bxWords', text: wordsOf(h) || 'Nothing written yet.' }));
    var kt = kindText(h.kind), mt = markText(h.markers, true);
    if (kt || mt) c.appendChild(el('div', { class: 'bx-sum bx-rm' }, [kt ? el('b', { text: kt }) : null, mt ? ' ' + mt : null]));
    HOST.appendChild(c);
    var done = (h.ai && h.ai.done) || {};
    if (aiOn() && B.ai && B.ai.ask && !done.ask) HOST.appendChild(el('div', { class: 'bx-rcard', id: 'bxRoomCard' }, [el('span', { text: B.ai.ask }), el('span', { class: 'bx-acts' }, [el('button', { class: 'bx-pill light', onclick: function () { respond('ask', 'yes'); } }, ['Yes']), el('button', { class: 'bx-pill', onclick: function () { respond('ask', 'notquite'); } }, ['Not quite'])])]));
    var agreed = st === 'agreed';
    HOST.appendChild(el('div', { class: 'bx-foot bx-rm' }, [agreed ? el('div', { class: 'bx-agreed', id: 'bxAgreedRoom' }, [el('span', { class: 'tick', text: '✓' }), ' Agreed']) : el('button', { class: 'bx-primary bx-rm', id: 'bxRoomAgree', disabled: wordsOf(h) ? null : true, onclick: function () {
      safe(async function () { await save(function (x) { x.check = x.check || {}; x.check.agreed = { at: new Date().toISOString(), by: 'In the room', words: wordsOf(x), how: 'shared on screen' }; }); });
    } }, ['Agree these words'])]));
  }

  // ---------- suggestions (only when switched on for the engagement) ----------
  function aiOn() { var r = X.row('aiset'); return !!(r && r.content && r.content.on); }
  async function askAi() {
    try { B.ai = await X.api({ action: 'ai_suggest', box: 'help' }); B.aiErr = null; }
    catch (e) { B.ai = null; B.aiErr = e.status === 503 ? null : 'Suggestions could not be fetched just now.'; }
    paint();
  }
  async function askAiQ() {
    try { var r = await X.api({ action: 'ai_suggest', box: 'question' }); B.qai = r.reframe && r.reframe.text ? r.reframe : null; } catch (e) { B.qai = null; }
    paint();
  }
  function respond(key, ans) { safe(async function () { await save(function (x) { x.ai = x.ai || {}; x.ai.done = x.ai.done || {}; x.ai.done[key] = ans; x.ai.log = (x.ai.log || []).concat([{ key: key, text: key === 'mean' ? B.ai.mean : B.ai.ask, answer: ans, by: me(), at: new Date().toISOString() }]).slice(-40); }); }); }
  function sayDifferently() {
    var t = el('textarea', { id: 'sdText', rows: 3 });
    overlay('Say it differently', [el('p', { text: 'In a sentence, what do they mean?' }), t], async function () { if (!t.value.trim()) throw new Error('Write a sentence first'); await save(function (x) { x.ai = x.ai || {}; x.ai.done = x.ai.done || {}; x.ai.done.mean = 'differently'; x.ai.log = (x.ai.log || []).concat([{ key: 'mean', text: B.ai.mean, answer: 'differently', instead: t.value.trim(), by: me(), at: new Date().toISOString() }]); }); }, 'Keep it');
  }
  function placeOffers(list) {
    safe(async function () {
      var by = {}; list.forEach(function (o) { (by[o.box] = by[o.box] || []).push(o); });
      for (var k in by) await sendToBox(k, by[k]);
      await save(function (x) { x.ai = x.ai || {}; x.ai.done = x.ai.done || {}; list.forEach(function (o) { x.ai.done['o:' + o.text] = 'placed'; }); });
    });
  }

  // =====================================================================
  // Box 7, the question (step 1, after How we might help), on the same template
  // =====================================================================
  var CHECKS = [
    ['yesno', 'It cannot be answered yes or no', 'If it can, it is not ready yet.'],
    ['fix', 'It does not jump to a known or technical fix', 'A document, training, a policy, a piece of kit, a new system or automation, a new post, more staff: the usual form of a solution in disguise.'],
    ['names', 'It names the service, the setting and the outcome', 'Compared with what we are working on (step 2).'],
    ['broad', 'It is not too broad to answer', '']];
  function Q() { var r = frameRow(), a = (r && r.content && r.content.answers) || {}; return a.question || {}; }
  function qf(h, k) { return (h.fields && h.fields[k]) || ''; }
  async function saveQ(mut, way) {
    var r = frameRow(), c = clone((r && r.content) || {}); c.answers = c.answers || {};
    var h = c.answers.question = c.answers.question || {}; h.fields = h.fields || {};
    var before = JSON.stringify(h.fields), beforeQ = h.fields.question || '', prevFields = clone(h.fields);
    var hf = (c.answers.help && c.answers.help.fields && c.answers.help.fields.first) || '';
    if (!h.fields.first && hf.trim()) h.fields.first = hf.trim();
    mut(h);
    var now = new Date().toISOString();
    if (!h.fields.first && (h.fields.question || '').trim()) { h.fields.first = (beforeQ || h.fields.question).trim(); h.firstAt = h.firstAt || now; }
    if (JSON.stringify(h.fields) !== before) {
      if ((h.fields.question || '') !== beforeQ && beforeQ.trim()) { h.past = (h.past || []).slice(0); h.past.unshift({ fields: prevFields, by: h.by, at: h.at }); h.past = h.past.slice(0, 30); }
      var w = way || 'write'; h.from = (h.from || []).filter(function (x) { return x.way !== w; }).concat([{ way: w }]);
      h.by = me(); h.at = now;
    }
    var d = await X.api({ action: 'p_save', tile_key: 'frame', status: frameStatus(c), summary: 'Changed: The question', content: c, base_version: r ? r.version : null });
    S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'frame'; }); S.data.tiles.push(d.tile);
  }
  function frameStatus(c) {
    var MAIN = (window.PROBLEM.frame.boxes || []).filter(function (b) { return !b.band && !b.retired; });
    return MAIN.every(function (y) { var x = c.answers[y.id]; return x && x.fields && y.fields.filter(function (f) { return !f.hidden && !f.page; }).every(function (f) { return String(x.fields[f.id] || '').trim(); }); }) ? 'done' : 'partly';
  }
  function qStage(h) {
    var q = qf(h, 'question').trim();
    if (q && h.agreed && norm(h.agreed.text) === norm(q)) return 'agreed';
    if (q) return 'drafted';
    return wordsOf(H()).trim() ? 'gathered' : 'none';
  }
  var items = function (t) { return String(t || '').split(/\n|;\s*/).map(function (x) { return x.trim(); }).filter(Boolean); };
  function paintQ() {
    var h = Q(), st = qStage(h), q = qf(h, 'question');
    HOST.appendChild(el('div', { class: 'bx-head' }, [
      el('div', { class: 'bx-hl' }, [el('button', { class: 'bx-back', id: 'bxBack', onclick: function () { X.go('canvas'); } }, ['‹ Canvas']), el('b', { class: 'bx-name', text: 'The question' }), el('span', { class: 'bx-faint', text: stepLabel('question') })]),
      strip(st), el('div', { class: 'bx-hr' }, [el('span', { class: 'bx-svc', title: serviceName(), text: serviceName() })])]));
    var grid = el('div', { class: 'bx-grid' }), left = el('div', { class: 'bx-left' }), centre = el('div', { class: 'bx-centre' }), right = el('div', { class: 'bx-right', id: 'bxMargin' });
    grid.appendChild(left); grid.appendChild(centre); grid.appendChild(right); HOST.appendChild(grid);
    // team note: the first view of the kind of challenge, and behind it the chain and where else it has been seen
    var tn = el('textarea', { class: 'bx-tn', id: 'bxTeam', rows: 3, placeholder: 'First view of the kind of challenge', 'aria-label': 'Team note: first view of the kind of challenge' }); tn.value = qf(h, 'kindview');
    tn.addEventListener('blur', function () { if (qf(Q(), 'kindview') !== tn.value.trim()) safe(async function () { await saveQ(function (x) { x.fields.kindview = tn.value.trim(); }); B.flash = 'Team note saved'; }); });
    left.appendChild(el('div', { class: 'bx-team team-only' }, [el('div', { class: 'bx-lock' }, [lock(), ' Team only']), tn,
      el('button', { class: 'bx-link sm', id: 'bxChain', onclick: function () { B.qcard = B.qcard === 'chain' ? null : 'chain'; paint(); } }, ['The chain, and where else it has been seen'])]));
    if (B.qcard === 'chain') left.appendChild(fieldsCard('chain', [['chain', 'The problem as a chain', 'Context, intervention, mechanism, outcome'], ['elsewhere', 'Where else the mechanism has been seen', 'Other services, other cases']]));
    // the history line: first put, dated versions, now
    var vers = (h.past || []).filter(function (p) { return p.fields && p.fields.question; }).slice().reverse();
    var hist = el('div', { class: 'bx-hist', id: 'bxHist' }, [el('span', { class: 'hs' }, [el('i', {}), 'First put' + (h.firstAt ? ', ' + day(h.firstAt) : '')])]);
    vers.filter(function (p) { return norm(p.fields.question) !== norm(qf(h, 'first')); }).slice(-3).forEach(function (p) { hist.appendChild(el('span', { class: 'hl' })); hist.appendChild(el('span', { class: 'hs' }, [el('i', {}), day(p.at)])); });
    if (q) { hist.appendChild(el('span', { class: 'hl' })); hist.appendChild(el('span', { class: 'hs now' }, [el('i', {}), 'Now'])); }
    if (qf(h, 'first')) hist.appendChild(el('button', { class: 'bx-link sm', id: 'bxHow', onclick: function () { B.qcard = B.qcard === 'hist' ? null : 'hist'; paint(); } }, ['See how it changed']));
    if (qf(h, 'first') || q) centre.appendChild(hist);
    if (B.qcard === 'hist') centre.appendChild(el('div', { class: 'bx-card', id: 'bxHistCard' }, [el('div', { class: 'bx-cardh' }, [el('b', { text: 'How the question changed' }), el('button', { class: 'bx-link', onclick: function () { B.qcard = null; paint(); } }, ['Done'])]),
      el('div', { class: 'bx-ver first' }, [el('span', { class: 'bx-faint', text: 'As they first put it' + (h.firstAt ? ', ' + day(h.firstAt) : '') + ' (kept as it was)' }), el('p', { text: qf(h, 'first') })])].concat(vers.map(function (p) { return el('div', { class: 'bx-ver' }, [el('span', { class: 'bx-faint', text: day(p.at) + (p.by ? ', ' + p.by : '') }), el('p', { text: p.fields.question })]); })).concat([el('div', { class: 'bx-ver now' }, [el('span', { class: 'bx-faint', text: 'Now' }), el('p', { text: q })])])));
    var fromTest = ((X.S && X.S.data && X.S.data.questions) || []).filter(function (q) { return q.tile_key === 'question' && q.from_practice === 'test' && (q.status === 'open' || q.status === 'kept_open'); });
    if (fromTest.length) centre.appendChild(el('div', { class: 'bx-card', id: 'bxFromTest', style: 'margin:8px 0 10px' }, [el('b', { text: 'Sent back from Test: look again at the question and the assumptions behind it' })].concat(fromTest.map(function (q) {
      var close = function (st, ans) { return async function () { try { await X.api({ action: 'p_question_set', id: q.id, status: st, answer: ans }); q.status = st; q.answer = ans; paint(); } catch (e) { alert(e.message); } }; };
      return el('div', { style: 'margin:8px 0 0', 'data-testq': q.id }, [el('p', { style: 'margin:0' }, [document.createTextNode(q.text), q.why ? el('span', { class: 'bx-faint', text: ' (' + q.why + ')' }) : null]),
        S.readonly ? null : el('div', { style: 'display:flex;gap:14px;margin-top:6px' }, [el('button', { class: 'bx-link sm', 'data-revised': q.id, onclick: close('new_version', 'The question was revised') }, ['Done: the question is revised']), el('button', { class: 'bx-link sm', 'data-kept': q.id, onclick: close('answered', 'Looked at again; the question stands') }, ['Looked at again: it stands'])])]);
    }))));
    centre.appendChild(el('p', { class: 'bx-faint', id: 'bxTurned', style: 'margin:6px 0 8px', text: 'Step 1 recorded the problem as the organisation first put it. Here it is turned into the question we work on: a working hypothesis, sharpened or changed as we learn.' }));
    // the hero: the question as it now stands
    var hero = el('div', { class: 'bx-hero' + (q ? '' : ' empty'), id: 'bxQuestion', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'The question as it now stands', spellcheck: 'false', 'data-ph': 'What exactly are we answering or deciding? Write it as a question.' });
    hero.textContent = B.qdraft != null ? B.qdraft : q;
    hero.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hero.blur(); } if (e.key === 'Escape') { B.qdraft = null; hero.textContent = qf(Q(), 'question'); hero.blur(); } });
    hero.addEventListener('blur', function () { var v = hero.innerText.replace(/\s+/g, ' ').trim(); if (v === qf(Q(), 'question')) { B.qdraft = null; return; } B.qdraft = v; safe(async function () { await saveQ(function (x) { x.fields.question = v; }); B.qdraft = null; B.flash = 'Saved'; }); });
    caretIn(hero); centre.appendChild(hero);
    // informs the decision
    var dec = el('span', { class: 'bx-inl', id: 'bxDecision', contenteditable: 'true', role: 'textbox', 'aria-label': 'The decision it informs', 'data-ph': 'which decision will the answer inform?' }); dec.textContent = qf(h, 'decision');
    caretIn(dec); dec.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); dec.blur(); } });
    dec.addEventListener('blur', function () { var v = dec.innerText.trim(); if (v !== qf(Q(), 'decision')) safe(async function () { await saveQ(function (x) { x.fields.decision = v; }); }); });
    centre.appendChild(el('p', { class: 'bx-dec' }, [el('span', { class: 'bx-faint', text: 'Informs the decision: ' }), dec]));
    // the one-line summary: who decides, by when; why now; if nothing changes
    var sm = [qf(h, 'owner') ? el('b', { text: dotted(qf(h, 'owner')) }) : null, whyNow() ? ' ' + dotted(whyNow()) : null, qf(h, 'nothing') ? ' ' + dotted('If nothing changes: ' + lc(qf(h, 'nothing'))) : null].filter(Boolean);
    centre.appendChild(el('div', { class: 'bx-sum q', id: 'bxQSum' }, [el('span', { class: 'bx-sumt' }, sm.length ? sm : [el('span', { class: 'bx-faint', text: 'Who decides, by when? Why now? What happens if nothing changes?' })]),
      el('button', { class: 'bx-link', id: 'bxQChange', 'aria-expanded': String(B.qcard === 'own'), onclick: function () { B.qcard = B.qcard === 'own' ? null : 'own'; paint(); } }, [sm.length ? 'Change' : 'Add'])]));
    // our client's relationship to the system (from the Define tool; moved here from step 2), one line per person
    var rels = (h.rel || []).filter(function (x) { return x.who || x.rel; });
    if (rels.length) centre.appendChild(el('p', { class: 'bx-faint bx-rels', id: 'bxRels' }, [el('span', { text: 'Relationship to the system: ' })].concat(rels.map(function (x, i) { return el('span', {}, [i ? '; ' : '', el('b', { text: x.who || 'Not named' }), ', ' + relText(x.rel)]); }))));
    if (B.qcard === 'own') centre.appendChild(fieldsCard('own', [['owner', 'Who decides, by when', 'For example: the operations director, by the next board'], ['nothing', 'What happens if nothing changes', 'Doing nothing, named as an option to be judged like any other'], ['decided', 'What is already decided', 'What cannot be reopened'], ['authorise', 'What the decider can authorise', ''], ['before', 'Happened before, and what has been tried', 'Has it happened before? What was tried, and why did it not last?']]));
    // the checks, as one quiet line
    var ck = h.checks || {}, done = CHECKS.filter(function (c) { return ck[c[0]] != null; }), passN = CHECKS.filter(function (c) { return ck[c[0]] === true; }).length, look = CHECKS.filter(function (c) { return ck[c[0]] === false; });
    var wordsN = ['None', 'One', 'Two', 'Three', 'Four'];
    centre.appendChild(el('div', { class: 'bx-checks', id: 'bxChecks' }, [done.length ? el('span', { class: passN >= 3 ? 'ok' : '' }, [passN >= 3 ? el('span', { class: 'tick', text: '✓ ' }) : null, wordsN[passN] + ' of four checks pass']) : el('span', { class: 'bx-faint', text: 'Four gentle checks, not yet done' }),
      look.length ? el('span', { class: 'look', text: (look.length === 1 ? 'One' : wordsN[look.length]) + ' to look at: ' + look.map(function (c) { return lc(c[1].replace(/^It /, 'it ')); }).join('; ') }) : null,
      el('button', { class: 'bx-link sm', id: 'bxShowChecks', onclick: function () { B.qcard = B.qcard === 'checks' ? null : 'checks'; paint(); } }, [B.qcard === 'checks' ? 'Hide checks' : 'Show checks'])]));
    if (B.qcard === 'checks') centre.appendChild(el('div', { class: 'bx-card', id: 'bxCheckCard' }, [el('p', { class: 'bx-faint', text: 'Prompts, not rules: nothing is blocked. Tick each one as you read the question.' })].concat(CHECKS.map(function (c) {
      var v = ck[c[0]], set = function (val) { safe(async function () { await saveQ(function (x) { x.checks = x.checks || {}; x.checks[c[0]] = val; }); }); };
      return el('div', { class: 'bx-ck', 'data-check': c[0] }, [el('div', {}, [el('b', { text: c[1] }), c[2] ? el('div', { class: 'bx-faint', text: c[2] }) : null, hint(c[0], q)]), el('span', { class: 'bx-seg' }, [el('button', { class: v === true ? 'on' : '', 'data-pass': c[0], onclick: function () { set(v === true ? null : true); } }, ['Passes']), el('button', { class: v === false ? 'on' : '', 'data-look': c[0], onclick: function () { set(v === false ? null : false); } }, ['To look at'])])]);
    }))));
    // three small tags with counts
    var tag = function (k, label) { var n = items(qf(h, k)).length; return el('button', { class: 'bx-qtag' + (B.qcard === k ? ' on' : ''), 'data-tag': k, onclick: function () { B.qcard = B.qcard === k ? null : k; paint(); } }, [label + ' · ', el('b', { text: String(n) })]); };
    centre.appendChild(el('div', { class: 'bx-qtags' }, [tag('levers', 'Levers'), tag('costs', 'Whose costs count'), tag('decided', 'Already decided')]));
    if (B.qcard === 'levers') centre.appendChild(fieldsCard('levers', [['levers', 'The levers', 'What can be changed, by whom, and within what range: one a line']]));
    if (B.qcard === 'costs') centre.appendChild(fieldsCard('costs', [['costs', 'Whose costs and benefits count', 'The firm, the people it serves, the regulator, society: one a line']]));
    if (B.qcard === 'decided') centre.appendChild(fieldsCard('decided', [['decided', 'What is already decided', 'One a line']]));
    // why they came, from box 8
    var kl = kindLine();
    if (kl) centre.appendChild(el('p', { class: 'bx-why', id: 'bxWhy' }, [el('span', { class: 'bx-faint', text: 'Why they came: ' }), kl]));
    // the margin: the question put another way (suggestions on)
    if (aiOn() && B.qai && !(h.ai && h.ai.done && h.ai.done[B.qai.text])) right.appendChild(el('div', { class: 'bx-note', 'data-note': 'reframe' }, [el('p', { text: 'It could also be put as ' + B.qai.form + ': ' + B.qai.text }), el('div', { class: 'bx-acts' }, [
      el('button', { class: 'bx-link', onclick: function () { var t = B.qai.text; safe(async function () { await saveQ(function (x) { x.fields.question = t; x.ai = x.ai || {}; x.ai.done = x.ai.done || {}; x.ai.done[t] = 'used'; }, 'options'); }); } }, ['Use this']),
      el('button', { class: 'bx-link', onclick: function () { var t = B.qai.text; safe(async function () { await saveQ(function (x) { x.ai = x.ai || {}; x.ai.done = x.ai.done || {}; x.ai.done[t] = 'kept mine'; }); }); } }, ['Keep mine'])])]));
    // the room's sentences, once revealed
    var rooms = h.room || [];
    if (rooms.length) { var last = rooms[rooms.length - 1], mt = last.sentences.filter(function (x) { return x.match; }).length; centre.appendChild(el('p', { class: 'bx-faint', id: 'bxRoomLine' }, ['The room, ' + day(last.at) + ': ' + mt + ' of ' + last.sentences.length + ' sentences match the question. ', el('button', { class: 'bx-link sm', onclick: function () { roomReveal(last); } }, ['See them'])])); }
    // two buttons only
    var prim = st === 'agreed' ? ['Back to the canvas', function () { X.go('canvas'); }] : st === 'drafted' ? ['Agree the question for now', function () { agreeQ(); }] : ['Write the question', function () { var hh = document.getElementById('bxQuestion'); if (hh) hh.focus(); }];
    HOST.appendChild(el('div', { class: 'bx-foot' }, [el('div', { class: 'bx-two' }, [el('button', { class: 'bx-second', id: 'bxRoom', onclick: function () { askRoom(); } }, ['Ask the room first']), el('button', { class: 'bx-primary', id: 'bxPrimary', disabled: B.busy ? true : null, onclick: prim[1] }, [prim[0]])]),
      el('div', { class: 'bx-hint' + (B.err ? ' bad' : ''), id: 'bxHint', text: B.err || B.flash || (st === 'agreed' ? 'Agreed for now by ' + h.agreed.by + ' on ' + day(h.agreed.at) + '. It can change as the frame develops; it is settled in the testing band.' : 'Tap the question to edit it. It can change as the frame develops.') })]));
    B.flash = null;
  }
  function dotted(t) { t = String(t).trim(); return /[.?!]$/.test(t) ? t : t + '.'; }
  function lc(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  var STOP = ['what', 'which', 'with', 'from', 'that', 'this', 'their', 'there', 'would', 'could', 'should', 'into', 'over', 'about', 'when', 'where', 'they', 'them', 'have', 'does', 'make', 'take', 'more', 'than', 'only', 'also', 'must', 'keep', 'stay', 'still'];
  function hint(k, q) {
    var t = '', s = String(q || '');
    if (k === 'yesno' && /^(can|could|is|are|should|will|would|do|does|did|has|have)\b/i.test(s) && !/\b(and if not|what|how|which|where|why)\b/i.test(s)) t = 'It starts “' + s.split(' ')[0] + '” and asks nothing more: it may be answerable yes or no.';
    if (k === 'fix' && /\b(training|policy|document|system|automat|new post|more staff|software|tool|kit)\b/i.test(s)) t = 'It mentions “' + (/\b(training|policy|document|system|automat\w*|new post|more staff|software|tool|kit)\b/i.exec(s) || [''])[0] + '”: is that the answer already?';
    if (k === 'names') { var nm = sysName(), sig = function (x) { return String(x || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 3 && STOP.indexOf(w) < 0; }); }, qs = sig(s), miss = nm && qs.length && !sig(nm).some(function (w) { return qs.indexOf(w) >= 0; }); var outs = ((SYS().route && SYS().route.lists && SYS().route.lists.outputs) || []).filter(function (x) { return x.on; }).map(function (x) { return x.t; }); t = nm ? (miss ? 'It does not yet use the name of the system agreed in step 2: “' + nm + '”.' : 'The system agreed in step 2: “' + nm + '”.') + (outs.length ? ' What it produces: ' + outs.slice(0, 3).join('; ') + '.' : '') : 'Agree the system in step 2 first: this check compares the question with it.'; }
    if (k === 'broad' && /\bwhat would it take\b|\beverything\b|\ball\b/i.test(s)) t = 'Phrases such as “what would it take” can make it broad.';
    return t ? el('div', { class: 'bx-hintline', text: t }) : null;
  }
  var RELS = [['parent', 'Accountable for what it sits within'], ['accountable', 'Accountable for this system'], ['leads', 'Leads it, sets direction and makes the main trade-offs'], ['runs', 'Runs it day to day'], ['part', 'Leads a major part of it'], ['within', 'Works within it'], ['advises', 'Advises or influences it; others decide'], ['outside', 'Outside view (consultant, researcher, regulator or partner)']];
  function relText(k) { var o = RELS.filter(function (r) { return r[0] === k; })[0]; return o ? o[1].charAt(0).toLowerCase() + o[1].slice(1) : 'relationship not said'; }
  function relEditor(h, rows) {
    var host = el('div', { class: 'bx-f bx-rel', id: 'bxRel' }, [el('span', { text: 'Your relationship to the system' }), el('div', { class: 'bx-faint', text: 'For the person we are working with. Add more than one person if needed.' })]);
    var list = el('div', {}); host.appendChild(list);
    function row(x) {
      var n = el('input', { class: 'bx-relw', placeholder: 'Name and role', value: x.who || '' }), sel = el('select', { class: 'bx-relr', 'aria-label': 'Relationship' }, [el('option', { value: '', text: 'Choose' })].concat(RELS.map(function (r) { return el('option', { value: r[0], text: r[1] }); })));
      sel.value = x.rel || ''; var r = { n: n, s: sel }; rows.push(r);
      list.appendChild(el('div', { class: 'bx-relrow' }, [n, sel]));
    }
    (h.rel && h.rel.length ? h.rel : [{}]).forEach(row);
    host.appendChild(el('button', { class: 'bx-link sm', id: 'bxRelAdd', onclick: function () { row({}); } }, ['Add another person']));
    return host;
  }
  function fieldsCard(id, defs) {
    var h = Q(), inputs = {}, relRows = [];
    var kids = defs.map(function (d) { var t = el('textarea', { id: 'qf-' + d[0], rows: d[0] === 'levers' || d[0] === 'costs' || d[0] === 'decided' ? 4 : 2, placeholder: d[2] || '' }); t.value = qf(h, d[0]); inputs[d[0]] = t; return el('label', { class: 'bx-f' }, [el('span', { text: d[1] }), t]); });
    if (id === 'own') kids.splice(1, 0, relEditor(h, relRows));
    return el('div', { class: 'bx-card', id: 'bxCard-' + id }, kids.concat([el('div', { class: 'bx-dlgb' }, [el('button', { class: 'bx-link', onclick: function () { B.qcard = null; paint(); } }, ['Cancel']), el('button', { class: 'bx-primary sm', id: 'bxCardSave', onclick: function () {
      safe(async function () { await saveQ(function (x) { Object.keys(inputs).forEach(function (k) { x.fields[k] = inputs[k].value.trim(); }); if (relRows.length) x.rel = relRows.map(function (r) { return { who: r.n.value.trim(), rel: r.s.value }; }).filter(function (r) { return r.who || r.rel; }); }); B.qcard = null; B.flash = 'Saved'; });
    } }, ['Keep these'])])]));
  }
  function agreeQ() {
    var who = el('input', { id: 'aWho', placeholder: 'Name and role' });
    overlay('Agree the question for now', [el('p', { text: 'Agreed for now, open to change as the frame develops. It is settled at the end, in the testing band.' }), fld('Who agreed', who)], async function () {
      if (!who.value.trim()) throw new Error('Say who agreed');
      await saveQ(function (x) { x.agreed = { at: new Date().toISOString(), by: who.value.trim(), text: x.fields.question }; });
    }, 'Agree for now');
  }
  // Ask the room: each person writes one sentence alone; hidden until all have answered; then shown together.
  async function askRoom() {
    var prompt = 'In one sentence, what is being decided?', box = el('div', { id: 'bxRoomBox' }), timer = null;
    var ov = overlay('Ask the room first', [el('p', { text: 'Each person, on a phone or in the browser, goes to ' + location.origin + ' and joins with the session code ' + S.data.session.session_code + '. They write one sentence alone. Nobody sees the others until everyone has answered.' }), box], null);
    var stop = function () { if (timer) clearInterval(timer); };
    ov.addEventListener('click', function (e) { if (e.target === ov || /Cancel/.test(e.target.textContent || '')) stop(); });
    var draw = async function () {
      var d; try { d = await X.api({ action: 'p_load' }); } catch (e) { box.textContent = e.message; return; }
      var r = (d.rounds || []).filter(function (x) { return x.tile_key === 'question' && x.status !== 'closed'; })[0];
      box.innerHTML = '';
      if (!r) { box.appendChild(el('button', { class: 'bx-primary sm', id: 'bxRoomOpen', onclick: async function () { await X.api({ action: 'p_round_open', tile_key: 'question', prompt: prompt }); draw(); } }, ['Open the question to the room'])); return; }
      if (r.status === 'open') {
        var all = d.joined > 0 && r.count >= d.joined;
        box.appendChild(el('p', { class: 'bx-roomcount', id: 'bxRoomCount', text: r.count + ' of ' + d.joined + ' have answered' + (all ? '. Everyone has answered.' : '.') }));
        box.appendChild(el('button', { class: 'bx-primary sm', id: 'bxRoomReveal', disabled: r.count ? null : true, onclick: async function () { if (!all && !confirm('Not everyone has answered. Show the sentences now?')) return; await X.api({ action: 'p_round_reveal', round_id: r.id }); draw(); } }, [all ? 'Show them together' : 'Show them now']));
        return;
      }
      stop();
      var list = r.answers.map(function (t) { return { text: t, match: false }; });
      box.appendChild(el('p', { class: 'bx-faint', text: 'The question: ' + (qf(Q(), 'question') || 'not written yet') + ' Tick the sentences that match it.' }));
      list.forEach(function (x, i) { var cb = el('input', { type: 'checkbox', 'data-match': String(i) }); cb.addEventListener('change', function () { x.match = cb.checked; }); box.appendChild(el('label', { class: 'bx-tick bx-sent' }, [cb, ' “' + x.text + '”'])); });
      box.appendChild(el('button', { class: 'bx-primary sm', id: 'bxRoomKeep', onclick: async function () {
        await saveQ(function (h) { h.room = (h.room || []).concat([{ at: new Date().toISOString(), prompt: prompt, when: 'start', sentences: list }]); });
        await X.api({ action: 'p_round_close', round_id: r.id }); ov.remove(); paint();
      } }, ['Keep them']));
    };
    await draw(); timer = setInterval(function () { if (!document.body.contains(box)) return stop(); if (!box.querySelector('#bxRoomKeep')) draw(); }, 3000);
  }
  function roomReveal(r) {
    overlay('The room’s sentences, ' + day(r.at), [el('p', { class: 'bx-faint', text: r.prompt })].concat(r.sentences.map(function (x) { return el('p', { class: 'bx-sent' + (x.match ? ' match' : '') }, [(x.match ? '✓ ' : '') + '“' + x.text + '”']); })), null);
  }

  // ---------- the look ----------
  function css() {
    if (document.getElementById('bxCss')) return;
    var s = document.createElement('style'); s.id = 'bxCss';
    s.textContent = [
      'body.bx-on{background:#FAF9F7}body.bx-on main{max-width:none;padding:0 0 60px}body.bx-on header.top{background:#FAF9F7}body.bx-on #subtabs{display:none}',
      '.bx{--g:#FAF9F7;--sf:#fff;--tn:#F1EFEA;--tn2:#EFEDE8;--tx:#15171A;--t2:#3A3F46;--mu:#5B616B;--fa:#8A8F97;--val:#1E6FD9;--valt:#1E5BB0;--valw:#EAF2FD;--exp:#E8590C;--expt:#9A3B08;--expw:#FDEFE6;--ok:#1F7A4D;',
      'background:var(--g);color:var(--tx);font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.5;min-height:calc(100vh - 70px)}',
      '.bx button{font-family:inherit;cursor:pointer}.bx :focus-visible,.bx-bar :focus-visible,.bx-ov :focus-visible,.bx-sendm :focus-visible{outline:3px solid #1E6FD9;outline-offset:2px;border-radius:6px}',
      '.bx-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:20px 40px;gap:16px}.bx-hl{display:flex;gap:18px;align-items:center}.bx-hr{display:flex;gap:16px;justify-content:flex-end;align-items:center;color:var(--t2);font-size:15px}',
      '.bx-back{background:none;border:0;color:var(--t2);font-size:15px;padding:8px 6px;min-height:44px}.bx-name{font-size:16px;font-weight:600}',
      '.bx-strip{display:flex;align-items:center;gap:10px;font-size:15px;color:var(--mu)}.bx-step{display:inline-flex;align-items:center;gap:8px}.bx-step i{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--fa);display:inline-block}',
      '.bx-step.done i{background:var(--tx);border-color:var(--tx)}.bx-step.done{color:var(--t2)}.bx-step.now{color:var(--tx);font-weight:700}.bx-step.now i{width:11px;height:11px;background:var(--tx);border-color:var(--tx);box-shadow:0 0 0 4px rgba(21,23,26,.12)}',
      '.bx-line{width:34px;height:1px;background:#D5D3CE}',
      '.bx-link{background:none;border:0;color:var(--tx);text-decoration:underline;text-underline-offset:3px;font-size:15px;padding:10px 4px;min-height:44px}',
      '.bx-grid{display:grid;grid-template-columns:minmax(200px,1fr) minmax(0,780px) minmax(220px,1fr);gap:40px;padding:40px 40px 0;align-items:start}',
      '.bx-team{background:var(--tn);border-radius:14px;padding:16px 18px;margin-top:92px;max-width:270px}.bx-lock{font-size:13px;font-weight:600;color:var(--mu);display:flex;align-items:center;gap:6px;margin-bottom:6px}',
      '.bx-tn{width:100%;border:0!important;background:transparent!important;box-shadow:none!important;font:15px/1.55 Inter,system-ui,sans-serif;color:var(--t2);resize:vertical;padding:4px 0}.bx-tn:focus{outline:2px solid #D5D3CE;border-radius:6px}',
      '.bx-over{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.6px;color:var(--mu);display:flex;gap:12px;align-items:center;margin-bottom:22px}',
      '.bx-tag{letter-spacing:.4px;text-transform:none;font-weight:600;font-size:12px;background:var(--tn);color:var(--t2);border-radius:999px;padding:2px 10px}',
      '.bx-hero{font-family:Newsreader,Georgia,serif;font-size:34px;line-height:1.42;color:var(--tx);border-radius:10px;padding:4px 8px;margin:0 -8px;min-height:1.4em;outline:none;white-space:pre-wrap}',
      '.bx-hero:hover{background:rgba(21,23,26,.025)}.bx-hero:focus{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06),0 0 0 2px #D5D3CE}.bx-hero.sm{font-size:30px}',
      '.bx-hero.empty:not(:focus)::before{content:attr(data-ph);color:var(--fa);font-size:24px}',
      '.bx-cite{font-family:Inter,sans-serif;font-size:13px;color:var(--fa);margin-left:3px;cursor:pointer;vertical-align:super;line-height:0}.bx-pass.hl{background:var(--expw);box-shadow:0 0 0 3px var(--expw);border-radius:3px;transition:background .3s ease-out}',
      '.bx-count{font-size:13px;color:var(--mu);margin-top:6px}.bx-count.over{color:#B3261E;font-weight:600}',
      '.bx-sum{display:flex;align-items:baseline;gap:12px;margin-top:30px;font-size:18px;color:var(--t2)}.bx-sum b{color:var(--tx);font-weight:600}.bx-sumt{flex:1}.bx-faint{color:var(--fa);font-size:15px}',
      '.bx-dot{width:11px;height:11px;border-radius:50%;flex:0 0 11px;transform:translateY(-1px)}.bx-dot.exp{background:var(--exp)}.bx-dot.val{background:var(--val)}',
      '.bx-card{background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.07);padding:18px 22px;margin-top:14px}.bx-cardh{display:flex;justify-content:space-between;align-items:center}',
      '.bx-six{display:grid;grid-template-columns:auto repeat(3,1fr);gap:6px;margin:12px 0 16px;font-size:13px;align-items:center}.bx-sixh{color:var(--mu);text-align:center}.bx-sixr{color:var(--t2);padding-right:8px}',
      '.bx-cell{min-height:44px;border-radius:10px;border:1px solid #E2E0DB;background:var(--g);font-size:13px;font-weight:600}.bx-cell.harm.main{background:var(--exp);color:#fff;border-color:var(--exp)}.bx-cell.harm.second{background:var(--expw);color:var(--expt);border-color:#F4C9AE}',
      '.bx-cell.want.main{background:var(--val);color:#fff;border-color:var(--val)}.bx-cell.want.second{background:var(--valw);color:var(--valt);border-color:#BCD5F5}',
      '.bx-marks{display:grid;gap:10px}.bx-mk{display:grid;grid-template-columns:240px 1fr;gap:10px;align-items:center}.bx-mkl{font-size:14px;color:var(--t2)}',
      '.bx-seg{display:flex;flex-wrap:wrap;gap:6px}.bx-seg button{border:1px solid #E2E0DB;background:#fff;border-radius:999px;padding:8px 14px;font-size:14px;min-height:40px;color:var(--t2)}.bx-seg button.on{background:var(--tx);color:#fff;border-color:var(--tx)}',
      '.bx-tray{display:flex;flex-wrap:wrap;gap:16px}.bx-src{width:172px}.bx-thumb{width:172px;height:110px;border:0;padding:0;border-radius:10px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;display:block;transition:box-shadow .2s ease-out}',
      '.bx-thumb:hover{box-shadow:0 4px 14px rgba(0,0,0,.12)}.bx-thumb img{width:100%;height:100%;object-fit:cover;object-position:top}.bx-cap{font-size:14px;margin-top:8px;color:var(--tx)}.bx-cap b{color:var(--fa);font-weight:600;margin-right:4px}',
      '.bx-lined{height:100%;padding:12px;text-align:left;font-family:Newsreader,Georgia,serif;font-size:13px;line-height:19px;color:#2A3550;white-space:pre-wrap;overflow:hidden;background:repeating-linear-gradient(#FBF8EF 0 18px,#E4E8EF 18px 19px)}',
      '.bx-doc{padding:20px 16px;display:grid;gap:8px}.bx-doc i{display:block;height:6px;border-radius:3px;background:#E4E2DD}.bx-doc i:first-child{width:60%}.bx-glyph{display:grid;place-items:center;height:100%;color:var(--mu)}',
      '.bx-add{width:172px;height:110px;border:1.5px dashed #C9C6C0;border-radius:10px;background:transparent;color:var(--t2);font-size:14px;display:grid;place-items:center;align-content:center;gap:4px;padding:10px}.bx-add b{font-size:22px;font-weight:400}',
      'body.bx-drag .bx-add{border-color:var(--tx);background:#fff}',
      '.bx-menu{margin-top:14px;background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}',
      '.bx-mgt{font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--mu);padding:6px 10px}.bx-mi{display:block;width:100%;text-align:left;background:none;border:0;border-radius:10px;padding:10px;min-height:44px}.bx-mi:hover{background:var(--tn)}.bx-mi b{display:block;font-weight:600;font-size:15px}.bx-mi span{font-size:13px;color:var(--mu)}',
      '.bx-right{padding-top:92px;display:grid;gap:26px;max-width:290px}.bx-note{border-left:2px solid var(--tx);padding:2px 0 2px 16px;font-size:15px;color:var(--t2)}.bx-note p{margin:0 0 6px}.bx-note.reply{border-left-color:var(--exp)}.bx-acts{display:flex;gap:14px;flex-wrap:wrap}',
      '.bx-foot{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:64px}.bx-primary{background:#15171A;color:#fff;border:0;border-radius:999px;padding:16px 34px;font-size:18px;font-weight:600;min-height:52px;box-shadow:0 6px 18px rgba(0,0,0,.14)}',
      '.bx-primary:disabled{opacity:.5}.bx-primary.sm{padding:11px 22px;font-size:15px;min-height:44px;box-shadow:none}.bx-hint{font-size:15px;color:var(--fa)}.bx-hint.bad,.bx .bad{color:#B3261E}',
      '.bx-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:calc(100vh - 70px)}.bx-sl{background:var(--tn2);padding:18px 40px 40px}.bx-sr{padding:18px 48px 40px;display:flex;flex-direction:column}',
      '.bx-tabs{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:28px}.bx-tab{background:none;border:0;border-radius:999px;padding:8px 16px;font-size:15px;color:var(--t2);min-height:40px}.bx-tab.on{background:#fff;color:var(--tx);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.06)}',
      '.bx-sheet{background:#fff;border-radius:10px;box-shadow:0 2px 14px rgba(0,0,0,.08);padding:36px 44px;max-width:680px;margin:0 auto}.bx-sheet.paper{background:#FBF8EF}',
      '.bx-page{width:100%;border-radius:6px;margin-bottom:18px}.bx-read{font-family:Newsreader,Georgia,serif;font-size:22px;line-height:1.6;color:#22304E;outline:none;caret-color:#15171A}.bx-read p{margin:0 0 4px}.bx-sheet:not(.paper) .bx-read{font-family:Inter,sans-serif;font-size:16px;color:var(--tx)}',
      '.bx .bx-read:focus-visible{outline:2px solid #D5D3CE;outline-offset:8px}.bx-hero.empty.sm:not(:focus)::before{font-size:22px}.bx-read ::selection{background:#FAD9C4}.bx-readbox{display:grid;gap:8px}.bx-readbox textarea{width:100%;font:16px/1.5 Inter,sans-serif;border:1px solid #D5D3CE;border-radius:10px;padding:10px}',
      '.bx-sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:64px;min-height:44px}.bx-ok{font-size:14px;color:var(--mu)}.bx-ok .tick{color:var(--ok)}',
      '.bx-chips{display:flex;flex-wrap:wrap;gap:8px}.bx-chip{background:#fff;border:0;border-radius:999px;padding:8px 14px;font-size:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);color:var(--tx)}.bx-chip b{color:var(--t2);font-weight:600}',
      '.bx-done{margin-top:auto;padding-top:40px;display:flex;gap:18px;align-items:center}',
      '.bx-bar{position:absolute;z-index:60;background:#15171A;color:#fff;border-radius:12px;padding:5px;display:flex;gap:2px;box-shadow:0 8px 24px rgba(0,0,0,.2)}.bx-bar button{background:none;border:0;color:#fff;font:600 14px Inter,sans-serif;padding:9px 14px;border-radius:8px;min-height:40px;cursor:pointer}.bx-bar button:first-child{background:#fff;color:#15171A}.bx-bar button:hover:not(:first-child){background:#2A2D33}',
      '.bx-sendm{position:absolute;z-index:61;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.16);padding:6px;display:grid;min-width:220px}.bx-sendm button{background:none;border:0;text-align:left;padding:10px 12px;border-radius:8px;font:15px Inter,sans-serif;min-height:40px;cursor:pointer}.bx-sendm button:hover{background:#F1EFEA}',
      '.bx-ov{position:fixed;inset:0;background:rgba(21,23,26,.28);z-index:70;display:grid;place-items:center;padding:20px}.bx-dlg{background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.2);padding:26px 28px;width:min(560px,100%);max-height:90vh;overflow:auto;font:15px/1.5 Inter,system-ui,sans-serif;color:#15171A}',
      '.bx-dlg h3{margin:0 0 10px;font-size:20px}.bx-dlg p{color:#3A3F46}.bx-f{display:grid;gap:4px;margin:10px 0;font-size:13px;color:#5B616B}.bx-f input,.bx-f textarea{font:15px/1.45 Inter,sans-serif;color:#15171A;border:1px solid #D5D3CE;border-radius:10px;padding:10px 12px;width:100%;box-sizing:border-box}',
      '.bx-tick{display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:8px 0}.bx-dlgb{display:flex;justify-content:flex-end;gap:12px;margin-top:16px;align-items:center}.bx-msg{color:#B3261E;font-size:14px;min-height:1em}.bx-prev{max-width:100%;max-height:260px;border-radius:8px;display:block;margin-bottom:8px}',
      '.bx-hist{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--mu);margin-bottom:18px;flex-wrap:wrap}.bx-hist .hs{display:inline-flex;align-items:center;gap:7px}.bx-hist .hs i{width:7px;height:7px;border-radius:50%;background:#B8B5AE;display:inline-block}.bx-hist .hs.now{color:var(--tx);font-weight:600}.bx-hist .hs.now i{background:var(--tx);width:9px;height:9px}.bx-hist .hl{width:46px;height:1px;background:#D5D3CE}',
      '.bx-link.sm{font-size:14px;padding:6px 2px;min-height:36px}.bx-dec{font-size:19px;color:var(--t2);margin:26px 0 0}.bx-inl{outline:none;border-radius:6px;padding:2px 4px;margin:-2px -4px}.bx-inl:focus{background:#fff;box-shadow:0 0 0 2px #D5D3CE}.bx-inl:empty::before{content:attr(data-ph);color:var(--fa)}.bx-lf{margin-top:28px;width:100%;align-self:stretch;display:block}.bx-lf .bx-over{margin-bottom:8px}.bx-ln{display:block;width:100%;box-sizing:border-box;font-size:16px;line-height:1.5;padding:6px 8px;margin:0 -8px;border-radius:6px;outline:none;min-height:1.5em}.bx-ln:hover{background:rgba(0,0,0,.03)}.bx-ln:focus{background:#fff;box-shadow:0 0 0 2px #D5D3CE}.bx-ln:empty::before{content:attr(data-ph);color:var(--fa)}.bx-relrow{display:flex;gap:8px;margin:6px 0}.bx-relrow input,.bx-relrow select{font:inherit;font-size:14px;padding:7px 9px;border:1px solid #D5D3CE;border-radius:8px;background:#fff;flex:1;min-width:0}.bx-rels{margin:8px 0 0}',
      '.bx-sum.q{font-size:17px;margin-top:22px}.bx-checks{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;margin-top:18px;font-size:15px}.bx-checks .ok{color:var(--ok);font-weight:600}.bx-checks .look{color:var(--expt)}',
      '.bx-ck{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start;padding:10px 0;border-top:1px solid #EFEDE8}.bx-ck:first-of-type{border-top:0}.bx-hintline{font-size:13px;color:var(--expt);margin-top:4px}',
      '.bx-qtags{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.bx-qtag{background:var(--tn);border:0;border-radius:999px;padding:9px 16px;font-size:15px;color:var(--mu);min-height:40px}.bx-qtag b{color:var(--tx);font-weight:600}.bx-qtag.on{background:var(--tx);color:#fff}.bx-qtag.on b{color:#fff}',
      '.bx-why{font-size:14px;color:var(--t2);margin-top:26px}.bx-ver{padding:10px 0;border-top:1px solid #EFEDE8}.bx-ver p{margin:4px 0 0;font-family:Newsreader,Georgia,serif;font-size:19px}.bx-ver.now p{font-weight:500}',
      '.bx-two{display:flex;gap:14px;align-items:center}.bx-second{background:#fff;color:var(--tx);border:0;border-radius:999px;padding:16px 26px;font-size:18px;font-weight:600;min-height:52px;box-shadow:0 2px 10px rgba(0,0,0,.08)}',
      '.bx-sent{font-family:Newsreader,Georgia,serif;font-size:18px}.bx-sent.match{color:var(--ok)}.bx-roomcount{font-size:18px;font-weight:600}',
      // the room view
      'body.bx-room{background:#0B0C0F}body.bx-room header.top{display:none}body.bx-room main{padding:0}',
      'body.bx-room .bx{background:radial-gradient(ellipse at 50% 30%,#1A1D23 0%,#0B0C0F 70%);color:#F2F2F0;min-height:100vh;display:flex;flex-direction:column}',
      '.bx-head.bx-rm{color:#F2F2F0}.bx-head.bx-rm .bx-svc,.bx-head.bx-rm .bx-hr{color:#A9AEB6}.bx-head.bx-rm .bx-step{color:#A9AEB6}.bx-head.bx-rm .bx-step.now{color:#F2F2F0}.bx-head.bx-rm .bx-step.now i{background:#FF7A2E;border-color:#FF7A2E;box-shadow:0 0 0 4px rgba(255,122,46,.2)}',
      '.bx-head.bx-rm .bx-step.done i{background:#F2F2F0;border-color:#F2F2F0}.bx-head.bx-rm .bx-line{background:#3A3F46}.bx-head.bx-rm .bx-link{color:#A9AEB6}.bx-hidden{display:inline-flex;gap:6px;align-items:center;font-size:14px}',
      '.bx-roomc{max-width:1100px;margin:60px auto 0;padding:0 40px;text-align:center}.bx-over.bx-rm{justify-content:center;color:#FF9A5E}.bx-hero.bx-rm{font-size:44px;line-height:1.4;text-align:center;color:#F2F2F0;padding:0;margin:0}.bx-hero.bx-rm:hover{background:none}',
      '.bx-sum.bx-rm{display:block;color:#A9AEB6;font-size:19px;margin-top:34px}.bx-sum.bx-rm b{color:#F2F2F0}',
      '.bx-rcard{margin:auto auto 0;display:flex;gap:30px;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px 24px;max-width:700px;color:#D9DBDE;font-size:16px}',
      '.bx-rcard .bx-acts{flex-wrap:nowrap}.bx-svc{max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bx-pill{border-radius:999px;padding:10px 20px;font-weight:600;font-size:15px;background:none;color:#F2F2F0;border:1px solid rgba(255,255,255,.3);min-height:44px}.bx-pill.light{background:#F2F2F0;color:#15171A;border-color:#F2F2F0}',
      '.bx-foot.bx-rm{margin:auto 0 50px;padding-top:30px}.bx-primary.bx-rm{background:#FF7A2E;color:#15171A;box-shadow:0 8px 28px rgba(255,122,46,.35)}.bx-agreed{font-size:20px;font-weight:600;color:#7ED3A6}',
      '@media (max-width:1100px){.bx-grid{grid-template-columns:1fr;padding:20px}.bx-team{margin-top:0;max-width:none}.bx-right{padding-top:0;max-width:none}.bx-head{grid-template-columns:1fr;padding:16px 20px}.bx-split{grid-template-columns:1fr}.bx-hero{font-size:28px}}',
      '@media print{.team-only,.bx-right,.bx-foot,.bx-tray,.bx-add,.bx-hr .bx-link,#bxChange{display:none!important}.bx-grid{display:block}.bx{background:#fff}}'].join('\n');
    document.head.appendChild(s);
  }
  // the kind of reason as one line, for box 7
  function kindLine() { var h = H(), kt = kindText(h.kind), mt = markText(h.markers); return kt || mt ? (kt ? kt + ' ' : '') + mt : ''; }
  function leave() { document.body.classList.remove('bx-on', 'bx-room'); hideBar(); HOST = null; }
  function init(x) { X = x; el = x.el; S = x.S; }
  window.VTBox = { init: init, css: css, render: render, leave: leave, kindLine: kindLine, kindText: kindText, markText: markText, MARKS: MARKS };
})();
