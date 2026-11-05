// Track changes and comments, like Word (5 November 2026).
// In Use, each page (one of the four steps) has a Review bar: Show (all changes, simple, no changes, original),
// comments on or off, previous and next, accept, accept all, reject, reject all, and a new comment.
// Changes made in Use wait until the team accepts or rejects them. Accept all and reject all cover this page only.
// Clients can change and comment; only the team can accept or reject. In Build, the home page lists everything
// still waiting, page by page.
(function () {
  'use strict';
  var X, el, S;
  var SHOWS = [['all', 'All changes', 'See what changed, marked up'], ['simple', 'Simple', 'A bar beside anything that changed'], ['none', 'No changes', 'The page as if every change were accepted'], ['original', 'Original', 'The page before these changes']];
  var STEPN = { frame: 'Frame', diagnose: 'Diagnose', model: 'Model', test: 'Test' };
  var LBL = { n: 'wording', who: 'who does it', t: 'text', text: 'text', v: 'figure', x: 'position', y: 'position', why: 'reason', cap: 'capacity', arrive: 'arrivals', name: 'name', label: 'label', q: 'question', hours: 'hours', level: 'level', from: 'from' };
  var RV = { show: 'all', com: true, data: {}, base: {}, cur: -1, form: null, reply: null, resolved: false, step: null, busy: false };
  try { RV.show = localStorage.getItem('vt_rvshow') || 'all'; RV.com = localStorage.getItem('vt_rvcom') !== '0'; } catch (e) {}
  var off = function () { return !X || !S || !S.data || X.EXAMPLE || S.readonly || S.data.as === 'public'; };
  var when = function (t) { try { return new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  function sig(d) { return ((d && d.changes) || []).map(function (c) { return c.id; }).join(','); }
  function label(p) {
    var parts = [];
    (p || []).forEach(function (k) { if (typeof k === 'number') { if (parts.length) parts[parts.length - 1] += ' ' + (k + 1); else parts.push('item ' + (k + 1)); } else parts.push(LBL[k] || String(k).replace(/_/g, ' ')); });
    return parts.slice(-2).join(', ');
  }
  function kind(c) {
    var d = c.diffs || [];
    if (d.length && d.every(function (x) { var k = x.p[x.p.length - 1]; return k === 'x' || k === 'y'; })) return 'Moved';
    if (d.length && d.every(function (x) { return !x.o && x.n; })) return 'Added';
    if (d.length && d.every(function (x) { return x.o && !x.n; })) return 'Removed';
    return 'Changed';
  }
  function set(k, v) { RV[k] = v; try { if (k === 'show') localStorage.setItem('vt_rvshow', v); if (k === 'com') localStorage.setItem('vt_rvcom', v ? '1' : '0'); } catch (e) {} }

  // ---------- the Review bar ----------
  function bar(step) {
    if (off()) return null;
    RV.step = step;
    var d = RV.data[step], can = d ? d.canDecide : !(window.VTUse && window.VTUse.isClient());
    var show = el('select', { id: 'rvShow', class: 'rv-sel', 'aria-label': 'Show' }, SHOWS.map(function (s) { return el('option', { value: s[0], selected: RV.show === s[0], text: s[1] + ': ' + s[2].toLowerCase() }); }));
    show.addEventListener('change', function () { set('show', show.value); RV.cur = -1; X.render(); });
    var kids = [el('span', { class: 'rv-lb', text: 'Show' }), show,
      el('button', { type: 'button', class: 'rv-b', id: 'rvCom', 'aria-pressed': String(RV.com), text: 'Comments: ' + (RV.com ? 'on' : 'off'), onclick: function () { set('com', !RV.com); X.render(); } }),
      el('span', { class: 'rv-sep' }),
      el('button', { type: 'button', class: 'rv-b', id: 'rvPrev', text: '‹ Previous', onclick: function () { go(-1); } }),
      el('button', { type: 'button', class: 'rv-b', id: 'rvNext', text: 'Next ›', onclick: function () { go(1); } })];
    if (can) kids.push(el('span', { class: 'rv-sep' }),
      el('button', { type: 'button', class: 'rv-b pri', id: 'rvAccept', text: 'Accept', onclick: function () { one('accept'); } }),
      menu('accept'),
      el('button', { type: 'button', class: 'rv-b', id: 'rvReject', text: 'Reject', onclick: function () { one('reject'); } }),
      menu('reject'));
    kids.push(el('span', { class: 'rv-sep' }), el('button', { type: 'button', class: 'rv-b', id: 'rvAddCom', text: '+ Comment', onclick: function () { var s = ''; try { s = String(window.getSelection() || '').trim().slice(0, 300); } catch (e) {} RV.form = { about: s }; X.render(); } }),
      el('span', { class: 'rv-grow' }), el('span', { class: 'rv-cnt', id: 'rvCount', text: d ? count(d) : '' }));
    return el('div', { class: 'rv-bar', id: 'rvBar', role: 'toolbar', 'aria-label': 'Changes and comments' }, kids);
  }
  function count(d) {
    var c = (d.changes || []).length, o = (d.comments || []).filter(function (x) { return !x.resolved; }).length;
    return (c ? c + (c === 1 ? ' change' : ' changes') + ' waiting' : 'No changes waiting') + ' · ' + (o ? o + (o === 1 ? ' open comment' : ' open comments') : 'no open comments');
  }
  function menu(how) {
    var d = RV.data[RV.step], cs = (d && d.changes) || [];
    var who = []; cs.forEach(function (c) { if (who.indexOf(c.by) < 0) who.push(c.by); });
    var W = how === 'accept' ? 'Accept' : 'Reject';
    var items = [el('button', { type: 'button', 'data-all': how, text: W + ' all changes on this page', onclick: function () { many(how, cs); } })];
    if (who.length > 1) who.forEach(function (w) { items.push(el('button', { type: 'button', text: W + ' all on this page by ' + w, onclick: function () { many(how, cs.filter(function (c) { return c.by === w; })); } })); });
    return el('details', { class: 'rv-dd', id: how === 'accept' ? 'rvAcceptAll' : 'rvRejectAll' }, [el('summary', { class: 'rv-b', text: W + ' all' }), el('div', { class: 'rv-menu' }, items.concat([el('p', { class: 'rv-mnote', text: 'This page only. Other pages are dealt with on their own.' })]))]);
  }
  async function decide(ids, how) {
    if (!ids.length) return;
    if (how === 'reject' && !confirm(ids.length === 1 ? 'Reject this change? What it changed goes back to how it was. The rejection is recorded.' : 'Reject ' + ids.length + ' changes on this page? What they changed goes back to how it was. The rejection is recorded.')) return;
    try {
      var r = await X.api({ action: 'p_decide', ids: ids, how: how });
      if (how === 'reject') { var d = await X.api({ action: 'p_load' }); if (d && d.tiles) S.data.tiles = d.tiles; }
      if (r && r.kept) alert(r.kept === 1 ? 'One part had been changed again since, so it was left as it is.' : r.kept + ' parts had been changed again since, so they were left as they are.');
      RV.cur = -1; X.render();
    } catch (e) { alert(e.message || e); }
  }
  function one(how) { var d = RV.data[RV.step], cs = (d && d.changes) || []; var c = cs[RV.cur] || cs[0]; if (!c) return alert('No changes waiting on this page.'); decide([c.id], how); }
  function many(how, cs) { if (!cs.length) return alert('No changes waiting on this page.'); decide(cs.map(function (c) { return c.id; }), how); }
  function go(dir) {
    var bs = Array.prototype.slice.call(document.querySelectorAll('.rv-margin [data-rvi]'));
    if (!bs.length) return;
    var i = bs.findIndex(function (b) { return b.classList.contains('cur'); });
    i = i < 0 ? (dir > 0 ? 0 : bs.length - 1) : (i + dir + bs.length) % bs.length;
    bs.forEach(function (b) { b.classList.remove('cur'); }); bs[i].classList.add('cur');
    var n = bs[i].getAttribute('data-rvi'); if (bs[i].getAttribute('data-kind') === 'change') RV.cur = Number(n);
    var mk = document.querySelector('[data-rvm="' + bs[i].getAttribute('data-key') + '"]');
    (mk || bs[i]).scrollIntoView({ block: 'center', behavior: 'smooth' });
    document.querySelectorAll('.rv-hot').forEach(function (x) { x.classList.remove('rv-hot'); }); if (mk) mk.classList.add('rv-hot');
  }

  // ---------- Original: draw the page as it was before the waiting changes ----------
  function swapIn(step) {
    if (off() || RV.show !== 'original') return null;
    var b = RV.base[step]; if (!b || !b.base) return null;
    var keep = [], ro = S.readonly;
    Object.keys(b.base).forEach(function (k) {
      var t = (S.data.tiles || []).filter(function (x) { return x.tile_key === k; })[0];
      if (t) { keep.push([t, t.content]); t.content = b.base[k] || {}; }
    });
    S.readonly = true;
    return function () { keep.forEach(function (p) { p[0].content = p[1]; }); S.readonly = ro; };
  }

  // ---------- after the page is drawn: the markup and the margin ----------
  function after(step, host, aside) {
    if (off()) { if (aside) aside.remove(); return; }
    X.api({ action: 'p_changes', step: step }).then(function (d) {
      var had = RV.data[step]; RV.data[step] = d;
      var cnt = document.getElementById('rvCount'); if (cnt) cnt.textContent = count(d);
      if (!had || sig(had) !== sig(d) || had.canDecide !== d.canDecide) { var b = document.getElementById('rvBar'); if (b) b.replaceWith(bar(step)); }
      if (RV.show === 'original' && (!RV.base[step] || RV.base[step].sig !== sig(d))) {
        return X.api({ action: 'p_changes', step: step, base: true }).then(function (e) { RV.base[step] = { sig: sig(d), base: e.base || {} }; X.render(); });
      }
      draw(step, host, aside, d);
    }).catch(function (e) { if (aside) { aside.textContent = ''; aside.appendChild(el('p', { class: 'rv-note', text: 'Could not load the changes: ' + (e.message || e) })); } });
  }
  function draw(step, host, aside, d) {
    aside.textContent = '';
    var cs = d.changes || [], com = (d.comments || []).filter(function (c) { return RV.resolved || !c.resolved; }), nres = (d.comments || []).filter(function (c) { return c.resolved; }).length;
    if (RV.form) aside.appendChild(newForm(step));
    if (RV.show === 'original') { host.inert = true; host.classList.add('rv-ro'); }
    if (RV.show === 'original') aside.appendChild(el('div', { class: 'rv-bal rv-orig' }, [el('b', { text: 'The original' }), el('div', { text: cs.length ? 'The page as it was before ' + cs.length + (cs.length === 1 ? ' change' : ' changes') + ' made in Confirm. Read-only: choose All changes to work on it.' : 'Nothing has been changed in Confirm, so this is the page as it is.' })]));
    if (RV.show === 'none' && cs.length) aside.appendChild(el('p', { class: 'rv-note', text: cs.length + (cs.length === 1 ? ' change is' : ' changes are') + ' hidden. Choose All changes to see ' + (cs.length === 1 ? 'it.' : 'them.') }));
    if (RV.show === 'all' || RV.show === 'simple') cs.forEach(function (c, i) {
      var found = mark(host, c, i, RV.show);
      if (RV.show === 'all') aside.appendChild(changeBal(c, i, d.canDecide, found));
    });
    if (RV.show === 'simple' && cs.length) aside.appendChild(el('p', { class: 'rv-note', text: cs.length + (cs.length === 1 ? ' change, marked' : ' changes, marked') + ' with a bar beside it. Choose All changes to see the old and new wording.' }));
    if (RV.com && RV.show !== 'original') {
      com.forEach(function (c) { anchor(host, c); aside.appendChild(commentBal(c)); });
      if (nres) aside.appendChild(el('button', { type: 'button', class: 'rv-link', text: RV.resolved ? 'Hide resolved comments' : 'Show resolved comments (' + nres + ')', onclick: function () { RV.resolved = !RV.resolved; X.render(); } }));
    }
    if (!aside.children.length) aside.remove();
  }
  function texts(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentElement; if (!p || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT; if (p.closest('svg,script,style,ins,del,textarea,option,select,.rv-margin,.rv-was,mark')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
    var n; while ((n = w.nextNode())) out.push(n); return out;
  }
  function wrapText(node, str, make) {
    var i = node.nodeValue.indexOf(str); if (i < 0) return null;
    var r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + str.length);
    var w = make(); r.surroundContents(w); return w;
  }
  function mark(host, c, i, how) {
    var hit = false, key = 'c' + c.id;
    (c.diffs || []).forEach(function (x) {
      if (!x.prim || !x.n) return;
      var nv = String(x.n), done = false;
      // single lower-case words are settings, not wording: marking them would catch ordinary text
      if (nv.length < 3 || !(/\s/.test(nv) || /\d/.test(nv) || /^[A-Z]/.test(nv))) return;
      Array.prototype.forEach.call(host.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea'), function (inp) {
        if (done || inp.value !== nv) return; done = true;
        inp.classList.add(how === 'all' ? 'rv-inp' : 'rv-barin'); inp.setAttribute('data-rvm', key);
        if (how === 'all' && x.o) inp.insertAdjacentElement('afterend', el('span', { class: 'rv-was', text: 'Was: ' + x.o }));
      });
      if (done) { hit = true; return; }
      var t = texts(host).filter(function (n) { return n.nodeValue.indexOf(nv) >= 0; })[0];
      if (!t) return;
      hit = true;
      if (how === 'all') {
        var ins = wrapText(t, nv, function () { return el('ins', { class: 'rv-ins', 'data-rvm': key, title: (x.o ? 'Was: ' + x.o + '. ' : '') + 'Changed by ' + c.by }); });
        if (ins && x.o) ins.parentNode.insertBefore(el('del', { class: 'rv-del', text: x.o }), ins);
      } else {
        var blk = t.parentElement.closest('li,td,button,p,label,h3,h4,div'); if (blk) { blk.classList.add('rv-barred'); blk.setAttribute('data-rvm', key); blk.title = (x.o ? 'Was: ' + x.o + '. ' : '') + 'Changed by ' + c.by; }
      }
    });
    return hit;
  }
  function anchor(host, c) {
    if (!c.about || c.about.length < 3) return;
    var t = texts(host).filter(function (n) { return n.nodeValue.indexOf(c.about) >= 0; })[0];
    if (t) wrapText(t, c.about, function () { return el('mark', { class: 'rv-mk', 'data-rvm': 'm' + c.cid, title: 'Comment by ' + c.by }); });
  }
  function changeBal(c, i, can, found) {
    var rows = (c.diffs || []).slice(0, 5).map(function (x) {
      var k = x.p[x.p.length - 1];
      if (k === 'x' || k === 'y' || /\(details\)/.test(x.o + ' ' + x.n)) return null;
      return el('div', { class: 'rv-d' }, [el('span', { class: 'rv-dl', text: label(x.p) }), x.o ? el('del', { class: 'rv-del', text: x.o }) : null, x.o && x.n ? document.createTextNode(' ') : null, x.n ? el('ins', { class: 'rv-ins', text: x.n }) : el('i', { text: ' removed' })]);
    }).filter(Boolean);
    if (kind(c) === 'Moved') rows = [el('div', { class: 'rv-d', text: 'Moved on the board.' })];
    if ((c.diffs || []).length > 5) rows.push(el('div', { class: 'rv-dl', text: 'and ' + (c.diffs.length - 5) + ' more parts' }));
    var acts = can ? [el('button', { type: 'button', class: 'rv-b pri sm', 'data-acc': c.id, text: 'Accept', onclick: function () { decide([c.id], 'accept'); } }), el('button', { type: 'button', class: 'rv-b sm', 'data-rej': c.id, text: 'Reject', onclick: function () { decide([c.id], 'reject'); } })] : [el('span', { class: 'rv-dl', text: 'Waiting for the team' })];
    acts.push(el('button', { type: 'button', class: 'rv-b sm', text: 'Comment', onclick: function () { RV.form = { about: (c.diffs || []).map(function (x) { return x.n; }).filter(Boolean)[0] || c.summary || '' }; X.render(); } }));
    return el('div', { class: 'rv-bal ch' + (RV.cur === i ? ' cur' : ''), 'data-rvi': String(i), 'data-kind': 'change', 'data-key': 'c' + c.id }, [
      el('div', { class: 'rv-who' }, [el('b', { text: (i + 1) + ' · ' + kind(c) }), document.createTextNode(' · ' + c.by + ', ' + when(c.at))]),
      c.summary ? el('div', { class: 'rv-sum', text: c.summary }) : null, c.nohist ? el('div', { class: 'rv-dl', text: 'The earlier version is not on record, so the old wording cannot be shown. Rejecting it is not possible; change it back by hand if needed.' }) : null].concat(rows).concat([found ? null : el('div', { class: 'rv-dl', text: 'Not marked on this view: it may be on another tab.' }), el('div', { class: 'rv-acts' }, acts)]));
  }
  function commentBal(c) {
    var kids = [el('div', { class: 'rv-who' }, [el('b', { text: 'Comment' + (c.resolved ? ', resolved' : '') }), document.createTextNode(' · ' + c.by + ', ' + when(c.at))]),
      c.about ? el('div', { class: 'rv-about', text: '“' + c.about + '”' }) : null, el('div', { class: 'rv-txt', text: c.text })];
    (c.replies || []).forEach(function (r) { kids.push(el('div', { class: 'rv-rep' }, [el('div', { class: 'rv-who', text: r.by + ', ' + when(r.at) }), el('div', { text: r.text })])); });
    if (RV.reply === c.cid) {
      var ta = el('textarea', { class: 'rv-ta', rows: '3', 'aria-label': 'Your reply' });
      kids.push(ta, el('div', { class: 'rv-acts' }, [el('button', { type: 'button', class: 'rv-b pri sm', text: 'Reply', onclick: function () { post({ cid: c.cid, text: ta.value }); } }), el('button', { type: 'button', class: 'rv-b sm', text: 'Cancel', onclick: function () { RV.reply = null; X.render(); } })]));
      setTimeout(function () { ta.focus(); }, 0);
    } else kids.push(el('div', { class: 'rv-acts' }, [el('button', { type: 'button', class: 'rv-b sm', text: 'Reply', onclick: function () { RV.reply = c.cid; X.render(); } }),
      el('button', { type: 'button', class: 'rv-b sm', 'data-resolve': c.cid, text: c.resolved ? 'Reopen' : 'Resolve', onclick: function () { post(c.resolved ? { cid: c.cid, reopen: true } : { cid: c.cid, resolve: true }); } })]));
    return el('div', { class: 'rv-bal cm' + (c.resolved ? ' done' : ''), 'data-rvi': c.cid, 'data-kind': 'comment', 'data-key': 'm' + c.cid }, kids);
  }
  function newForm(step) {
    var about = el('input', { type: 'text', class: 'rv-ta', value: RV.form.about || '', placeholder: 'What it is about (optional)', 'aria-label': 'What the comment is about' });
    var ta = el('textarea', { class: 'rv-ta', id: 'rvComText', rows: '4', placeholder: 'Your comment', 'aria-label': 'Your comment' });
    setTimeout(function () { ta.focus(); }, 0);
    return el('div', { class: 'rv-bal cm new' }, [el('b', { text: 'New comment on this page' }), about, ta, el('div', { class: 'rv-acts' }, [
      el('button', { type: 'button', class: 'rv-b pri sm', id: 'rvComPost', text: 'Post', onclick: function () { post({ step: step, view: viewNow(), about: about.value.trim(), text: ta.value }); } }),
      el('button', { type: 'button', class: 'rv-b sm', text: 'Cancel', onclick: function () { RV.form = null; X.render(); } })])]);
  }
  function viewNow() { var h = document.querySelector('.use-host'); return (h && h.getAttribute('data-uview')) || ''; }
  async function post(b) {
    if (b.text != null && !String(b.text).trim()) return alert('Write the comment first.');
    if (RV.busy) return; RV.busy = true;
    try { b.action = 'p_comment'; await X.api(b); RV.form = null; RV.reply = null; X.render(); } catch (e) { alert(e.message || e); } finally { RV.busy = false; }
  }

  // ---------- home in Use: what is waiting on each step ----------
  function homeCounts(grid) {
    if (off()) return;
    X.api({ action: 'p_changes' }).then(function (d) {
      ['frame', 'diagnose', 'model', 'test'].forEach(function (s) {
        var sec = grid.querySelector('[data-ustep="' + s + '"]'); if (!sec) return;
        var c = (d.changes || []).filter(function (x) { return x.step === s; }).length, o = (d.comments || []).filter(function (x) { return x.step === s && !x.resolved; }).length;
        if (!c && !o) return;
        var t = [c ? c + (c === 1 ? ' change' : ' changes') + ' waiting' : '', o ? o + (o === 1 ? ' comment' : ' comments') : ''].filter(Boolean).join(' · ');
        var h = sec.querySelector('h2'); if (h) h.insertAdjacentElement('afterend', el('span', { class: 'rv-pill', text: t }));
      });
    }).catch(function () {});
  }

  // ---------- Build: everything waiting, page by page ----------
  function buildCard() {
    var box = el('div', { class: 'glass evbox use-changes', id: 'useChanges', style: 'margin-top:16px' }, [el('h3', { style: 'margin:0 0 6px', text: 'Changes and comments from Confirm' }),
      el('p', { class: 'sm muted', style: 'margin:0 0 8px', text: 'Changes made in Confirm wait here until the team accepts or rejects them. Each counts as level 1 evidence (said) until checked. Accept all and reject all cover one page at a time. Every version stays in the history.' })]);
    var list = el('div', { class: 'sm', text: 'Loading…' }); box.appendChild(list);
    X.api({ action: 'p_changes' }).then(function (d) {
      list.textContent = '';
      var cs = d.changes || [], co = (d.comments || []).filter(function (c) { return !c.resolved; });
      if (!cs.length && !co.length) { list.textContent = 'Nothing waiting.'; return; }
      ['frame', 'diagnose', 'model', 'test'].forEach(function (s) {
        var mine = cs.filter(function (c) { return c.step === s; }), mc = co.filter(function (c) { return c.step === s; });
        if (!mine.length && !mc.length) return;
        var head = el('summary', { class: 'rv-gh' }, [el('b', { text: STEPN[s] }), el('span', { class: 'muted', text: ' · ' + [mine.length ? mine.length + (mine.length === 1 ? ' change' : ' changes') : '', mc.length ? mc.length + (mc.length === 1 ? ' open comment' : ' open comments') : ''].filter(Boolean).join(' · ') })]);
        var body = el('div', { class: 'rv-gb' });
        if (mine.length && d.canDecide) body.appendChild(el('div', { class: 'rv-acts' }, [
          el('button', { type: 'button', class: 'rv-b pri sm', 'data-accall': s, text: 'Accept all on this page', onclick: function () { decide(mine.map(function (c) { return c.id; }), 'accept'); } }),
          el('button', { type: 'button', class: 'rv-b sm', text: 'Reject all on this page', onclick: function () { decide(mine.map(function (c) { return c.id; }), 'reject'); } }),
          el('button', { type: 'button', class: 'rv-b sm', text: 'Open the page with changes shown', onclick: function () { open(s); } })]));
        mine.forEach(function (c, i) { body.appendChild(changeBal(c, i, d.canDecide, true)); });
        mc.forEach(function (c) { body.appendChild(commentBal(c)); });
        list.appendChild(el('details', { class: 'rv-grp', open: true }, [head, body]));
      });
    }).catch(function () { list.textContent = 'Could not load the changes.'; });
    return box;
  }
  function open(step) {
    var code = (S.data.session && S.data.session.session_code) || 'example';
    try { localStorage.setItem('vt_mode:' + code, 'use'); localStorage.setItem('vt_rvshow', 'all'); } catch (e) {}
    location.href = ({ frame: '/frame', diagnose: '/diagnose', model: '/model', test: '/test' })[step] + '#use=out';
  }

  function css() {
    if (document.getElementById('rvCss')) return;
    var s = document.createElement('style'); s.id = 'rvCss';
    s.textContent = '.rv-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px;padding:8px 12px;border:1px solid var(--line,rgba(127,127,127,.3));border-radius:14px;background:rgba(127,127,127,.06);color:var(--paper,#f0ede8);font-size:13px}' +
      '.rv-lb{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}.rv-sel{font:inherit;font-size:13px;padding:7px 8px;border-radius:9px;min-height:36px;background:none;color:inherit;border:1px solid var(--line,rgba(127,127,127,.4));max-width:340px}.rv-sel option{color:#111}' +
      '.rv-b{font:inherit;font-size:13px;padding:7px 12px;min-height:36px;border-radius:9px;border:1px solid var(--line,rgba(127,127,127,.45));background:none;color:var(--paper,#f0ede8);cursor:pointer;list-style:none}.rv-b::-webkit-details-marker{display:none}.rv-b.pri{background:var(--paper,#141414);color:var(--bg,#f4f3f0);font-weight:600}.rv-b.sm{padding:5px 10px;min-height:32px;font-size:12px}' +
      '.rv-sep{width:1px;height:24px;background:var(--line,rgba(127,127,127,.3))}.rv-grow{flex:1}.rv-cnt{opacity:.8}' +
      '.rv-dd{position:relative}.rv-dd>summary:after{content:" ▾";font-size:10px}.rv-menu{position:absolute;z-index:20;top:42px;left:0;min-width:270px;background:var(--bg,#141210);border:1px solid var(--line,rgba(127,127,127,.4));border-radius:10px;padding:6px;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;flex-direction:column}.rv-menu button{font:inherit;font-size:13px;text-align:left;padding:9px 10px;border:0;border-radius:7px;background:none;color:inherit;cursor:pointer}.rv-menu button:hover{background:rgba(127,127,127,.15)}.rv-mnote{font-size:12px;opacity:.7;margin:4px 10px 6px}' +
      '.rv-grid{display:flex;gap:18px;align-items:flex-start}.rv-grid>.use-host{flex:1;min-width:0}.rv-margin{flex:none;width:300px;display:flex;flex-direction:column;gap:10px;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto}@media(max-width:900px){.rv-grid{flex-direction:column}.rv-margin{width:auto;position:static;max-height:none}}' +
      '.rv-bal{border:1px solid rgba(70,140,230,.55);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45;background:rgba(70,140,230,.06)}.rv-bal.cm{border-color:rgba(200,150,20,.6);background:rgba(220,170,40,.07)}.rv-bal.done{opacity:.6}.rv-bal.rv-orig{color:inherit;border-color:var(--line,rgba(127,127,127,.4));background:none}.rv-bal.cur{outline:2px solid currentColor;outline-offset:2px}' +
      '.rv-who{font-size:12px;opacity:.8}.rv-sum{margin:4px 0}.rv-d{margin:4px 0}.rv-dl{display:block;font-size:11px;opacity:.7}.rv-about{font-style:italic;opacity:.85;margin:4px 0}.rv-txt{margin:4px 0}.rv-rep{border-left:2px solid var(--line,rgba(127,127,127,.4));padding-left:9px;margin-top:8px}.rv-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}' +
      '.rv-ta{width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:8px;margin-top:6px;border-radius:8px;border:1px solid var(--line,rgba(127,127,127,.45));background:none;color:inherit}' +
      'ins.rv-ins{color:#2f78d4;text-decoration:underline;text-decoration-color:#2f78d4}del.rv-del{color:#c8402a;text-decoration:line-through;margin-right:3px}[data-theme="dark"] ins.rv-ins,body.dark ins.rv-ins{color:#8cc6ff}' +
      '@media(prefers-color-scheme:dark){ins.rv-ins{color:#8cc6ff}del.rv-del{color:#ff8f7a}}' +
      '.rv-inp{outline:2px solid #2f78d4!important;outline-offset:1px}.rv-was{display:block;font-size:12px;color:#c8402a;text-decoration:line-through;margin-top:2px}.rv-barred,.rv-barin{box-shadow:-5px 0 0 -1px #2f78d4!important}' +
      'mark.rv-mk{background:rgba(230,180,40,.28);color:inherit;border-bottom:2px solid #d8a020}.rv-hot{outline:2px solid #2f78d4;outline-offset:2px}' +
      '.rv-ro{opacity:.92}.rv-ro *{cursor:default!important}.rv-note{font-size:13px;opacity:.8;margin:0}.rv-link{font:inherit;font-size:13px;background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;text-align:left;padding:4px 0}' +
      '.rv-pill{display:inline-block;align-self:flex-start;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid #2f78d4;color:inherit}' +
      '.rv-grp{border-top:1px solid var(--line,rgba(127,127,127,.25));padding:8px 0}.rv-gh{cursor:pointer;font-size:15px;padding:4px 0}.rv-gb{display:flex;flex-direction:column;gap:8px;margin-top:8px}';
    document.head.appendChild(s);
  }

  window.VTReview = {
    attach: function (x) { X = x; el = x.el; S = x.S; css(); },
    bar: function (step) { css(); return bar(step); }, after: after, swapIn: swapIn, homeCounts: homeCounts, buildCard: buildCard, off: function () { return off(); },
    show: function () { return RV.show; }
  };
})();
