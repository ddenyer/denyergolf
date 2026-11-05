// Guided framing: Frame written as if the client will use it on their own
// (task sheet 2026-10-26-guided-framing-client-led.md). The same screens serve a client alone, a consultant
// sharing the screen, or a consultant working from notes afterwards. Every answer writes to the boxes the
// canvas already has, so the canvas, the model and Diagnose read it unchanged. Parts 1 and 3 are the route
// (route.js), hosted here: one route, two ways in. Every screen works with suggestions switched off.
(function () {
  'use strict';
  var X, el, S, HOST, G = { at: null, pending: null, busy: false, err: null, msg: null, ask: null, why: null, menu: null, view: false, arrive: null, ex: false };
  var PARTS = ['What you’re working on', 'What’s prompting this', 'How it works', 'Your question', 'Who it matters to', 'Your first guesses'];
  // the flow, in order: part 0 is the start, 7 the finish. q: a question screen (it gets the three quiet links and counts towards time left)
  var FLOW = [
    { id: 'welcome', part: 0 }, { id: 'sources', part: 0 },
    { id: 'open1', part: 1, opener: true }, { id: 'describe', part: 1, route: true, q: true }, { id: 'clarify', part: 1, route: true, q: true, only: 'clarify' }, { id: 'name', part: 1, route: true, q: true }, { id: 'within', part: 1, route: true, q: true }, { id: 'check1', part: 1, check: true },
    { id: 'open2', part: 2, opener: true }, { id: 'prompt', part: 2, q: true }, { id: 'closest', part: 2, q: true }, { id: 'before', part: 2, q: true },
    { id: 'open3', part: 3, opener: true }, { id: 'inside', part: 3, route: true, q: true }, { id: 'outside', part: 3, route: true, q: true }, { id: 'level', part: 3, route: true, q: true }, { id: 'inputs', part: 3, route: true, q: true }, { id: 'work', part: 3, route: true, q: true }, { id: 'outputs', part: 3, route: true, q: true }, { id: 'shape', part: 3, route: true, q: true }, { id: 'runs', part: 3, q: true }, { id: 'purpose', part: 3, q: true }, { id: 'check3', part: 3, check: true },
    { id: 'open4', part: 4, opener: true }, { id: 'question', part: 4, q: true }, { id: 'decider', part: 4, q: true }, { id: 'sides', part: 4, q: true }, { id: 'role', part: 4, q: true }, { id: 'check4', part: 4, check: true },
    { id: 'open5', part: 5, opener: true }, { id: 'matters', part: 5, q: true, wide: true },
    { id: 'open6', part: 6, opener: true }, { id: 'guesses', part: 6, q: true, wide: true },
    { id: 'framing', part: 7 }];
  var OPENERS = {
    1: { what: 'What you want to work on, in your own words, and what it is part of. This is how we make sure we’re all looking at the same thing.', time: 'About 4 minutes', ask: '3 short questions', get: 'A plain name for it, and where it sits' },
    2: { what: 'What is prompting you to look at this now, and whether it has happened or been tried before.', time: 'About 3 minutes', ask: '3 short questions', get: 'Your reason, kept in your own words' },
    3: { what: 'Where {svc} starts and ends, what goes in, what it does, and what comes out. This is how we make sure we’re all looking at the same thing.', time: 'About 8 minutes', ask: '9 short questions, mostly by ticking', get: 'A simple picture of the service and its edges' },
    4: { what: 'The question you want answered about {svc}, who decides, and what is at stake.', time: 'About 5 minutes', ask: '4 short questions', get: 'Your question, in a form we can test' },
    5: { what: 'Who gains when {svc} works well, and who is harmed when it goes wrong. Often they are not the same people.', time: 'About 5 minutes', ask: 'One screen, in two halves', get: 'Both sides, and the threshold it must never cross' },
    6: { what: 'Before anyone looks at the evidence: your hunch about where it goes wrong, where it could be better, and where it already works well.', time: 'About 3 minutes', ask: 'One screen', get: 'Your guesses, kept exactly as you write them' } };
  var CLOSEST = [['wrong', 'Something went wrong'], ['might', 'Something might go wrong'], ['improve', 'We want to improve how it works'], ['asked', 'A regulator, inspector or board asked'], ['changing', 'Something is changing'], ['decision', 'A decision is coming up']];
  var WHY = {
    prompt: 'So that everything that follows starts from your reason, in your words.',
    closest: 'It tells us whether this is mainly about something going wrong, something going better, or a decision.',
    before: 'What was tried, and what happened next, often says more than the problem itself.',
    runs: 'Anything it relies on that belongs to someone else is a place it can be let down.',
    purpose: 'This is what must hold, however much else changes.',
    question: 'A question we can test keeps the work on what you need to know, not on everything that could be looked at.',
    decider: 'A question with nobody to act on the answer rarely changes anything.',
    sides: 'Most services have something to protect as well as something to improve. Naming both stops one being traded away for the other.',
    role: 'It tells us whose view this is, and who else we should hear from.',
    matters: 'When it works well, some people gain. When it goes wrong, some people are harmed, and often not the same people.',
    guesses: 'It shows what everyone assumed at the start, so we can see later what the evidence changed.' };

  // ---------- data ----------
  function frameRow() { return X.row('frame'); }
  function A() { var r = frameRow(); return (r && r.content && r.content.answers) || {}; }
  function GD() { var r = frameRow(); return (r && r.content && r.content.guide) || {}; }
  function F(box, k) { var b = A()[box]; return (b && b.fields && b.fields[k]) || ''; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function aiOn() { var r = X.row('aiset'); return !!(r && r.content && r.content.on); }
  function RT() { return window.VTRoute; }
  function R() { return RT().R(); }
  function svc() { return RT().svc(); }
  function lc(t) { t = String(t || ''); return t && !/^[A-Z]{2,}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  function join(a) { a = (a || []).filter(Boolean); return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function joinlc(a) { return join((a || []).map(function (t, i) { return i ? lc(t) : t; })); }
  function sub(t) { return String(t || '').replace(/\{svc\}/g, svc()); }
  function person() { var g = GD(); return (g.person && g.person.name) || (S.data.as === 'master' ? 'David (master)' : 'Facilitator'); }
  function whoLabel() { return GD().who === 'team' ? 'the team, for the organisation' : 'the organisation'; }
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function stamp(iso) { try { var d = new Date(iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function idx(id) { for (var i = 0; i < FLOW.length; i++) if (FLOW[i].id === id) return i; return 0; }
  function stepOf(id) { return FLOW[idx(id)]; }
  function skip(sc) { return sc.only === 'clarify' && !RT().needClarify(R()); }
  function nextOf(id) { var i = idx(id) + 1; while (i < FLOW.length && skip(FLOW[i])) i++; return FLOW[Math.min(i, FLOW.length - 1)].id; }
  function prevOf(id) { var i = idx(id) - 1; while (i > 0 && skip(FLOW[i])) i--; return i >= 0 ? FLOW[i].id : null; }
  function minutesLeft(id) { var n = 0; for (var i = idx(id); i < FLOW.length; i++) if (FLOW[i].q && !skip(FLOW[i])) n += FLOW[i].wide ? 3 : 1; return n; }
  function sourceNames() { return (S.data.sources || []).map(function (s) { return s.title || s.file_name; }).filter(Boolean); }
  function sourcesText() { return (S.data.sources || []).filter(function (s) { return s.kind !== 'image'; }).map(function (s) { return (s.title || '') + ':\n' + String(s.body || '').slice(0, 1500); }).join('\n\n').slice(0, 3800); }

  // save the frame: answers and the guide (where the flow has got to, not sure, who answered)
  // saves go one after another, each on the latest version, so nothing is lost when they come close together
  var queue = Promise.resolve();
  function run(fn) { var p = queue.then(fn); queue = p.catch(function () {}); return p; }
  function gsave(mut, summary) { return run(function () { return gsave1(mut, summary); }); }
  async function gsave1(mut, summary) {
    var r0 = frameRow(), c = clone((r0 && r0.content) || {}); c.answers = c.answers || {}; c.guide = c.guide || {};
    var before = JSON.stringify(c.answers); mut(c.answers, c.guide);
    if (c.guide.sent && JSON.stringify(c.answers) !== before) c.guide.changedSince = true;
    var d = await X.api({ action: 'p_save', tile_key: 'frame', status: r0 ? r0.status : 'partly', summary: summary || 'Guided framing', content: c, base_version: r0 ? r0.version : null });
    S.data.tiles = (S.data.tiles || []).filter(function (t) { return t.tile_key !== 'frame'; }); S.data.tiles.push(d.tile);
  }
  function box(a, k) { a[k] = a[k] || {}; a[k].fields = a[k].fields || {}; a[k].by = person(); a[k].at = new Date().toISOString(); a[k].from = (a[k].from || []).filter(function (x) { return x.way !== 'guided'; }).concat([{ way: 'guided' }]); return a[k]; }
  async function safe(fn) { try { G.busy = true; paint(); await fn(); G.err = null; } catch (e) { G.err = e.message; } G.busy = false; paint(); }
  // go to a screen, and remember it so the flow can be picked up again
  function goto(id) {
    G.at = id; G.ask = null; G.menu = null; G.why = null; G.err = null; G.arrive = null; G.drafts = {}; G.draftsFor = id;
    try { history.replaceState(null, '', '#guided=' + id); } catch (e) {}
    paint(); window.scrollTo(0, 0);
    var who = GD().who || 'client';
    gsave(function (a, g) { g.at = id; g.started = g.started || new Date().toISOString(); }, 'Guided framing: ' + id).then(function () { setSaved(); }).catch(function () {});
  }
  function advance(from) { var sc = stepOf(from || G.at); recordWho(sc); goto(nextOf(from || G.at)); }
  function recordWho(sc) { if (!sc || !sc.q) return; var w = GD().who || 'client'; gsave(function (a, g) { g.by = g.by || {}; g.by[sc.id] = { who: w, name: person(), at: new Date().toISOString() }; }).catch(function () {}); }
  function setSaved() { var s = document.getElementById('gdSaved'); if (s) { s.hidden = false; s.classList.add('fresh'); setTimeout(function () { s.classList.remove('fresh'); }, 1200); } }

  // the route tells us when one of its screens moves on
  var hooks = {
    paint: function () { paint(); },
    moved: function (to, from) { G.pending = to; },
    context: function () { return sourcesText(); },
    run: function (fn) { return run(fn); }
  };

  // ---------- the page ----------
  function render(main, x, id) {
    X = x; el = x.el; S = x.S; if (window.VTBox && window.VTBox.css) window.VTBox.css(); css();
    if (RT()) RT().hostIn(hooks);
    document.body.classList.add('gd-on');
    var g = GD();
    G.at = id && stepOf(id).id === id ? id : (g.at && idx(g.at) ? g.at : 'welcome');
    HOST = el('div', { class: 'gd', id: 'gdHost' }); main.appendChild(HOST); paint();
  }
  function leave() { if (RT()) RT().hostIn(null); document.body.classList.remove('gd-on'); HOST = null; }
  function paint() {
    if (!HOST) return;
    // a route screen has moved on: follow it (the clarifying question, or a new level, go back to the name)
    if (G.pending) {
      var to = G.pending; G.pending = null;
      if (to === 'clarify') { G.at = 'clarify'; }
      else if (to === 'name' && (G.at === 'level' || G.at === 'clarify')) { G.at = 'name'; }
      else if (stepOf(G.at).route && to !== G.at) { var nx = nextOf(G.at); recordWho(stepOf(G.at)); G.at = nx; }
      try { history.replaceState(null, '', '#guided=' + G.at); } catch (e) {}
      gsave(function (a, g) { g.at = G.at; }).catch(function () {});
      window.scrollTo(0, 0);
    }
    var sc = stepOf(G.at), keep = document.activeElement && document.activeElement.id;
    // what has been typed but not yet saved survives a repaint of the same screen
    if (G.draftsFor !== sc.id) { G.drafts = {}; G.draftsFor = sc.id; }
    Array.prototype.forEach.call(HOST.querySelectorAll('#gdCol textarea[id], #gdCol input[type=text][id], #gdCol input[type=url][id]'), function (e) { G.drafts[e.id] = e.value; });
    HOST.innerHTML = '';
    HOST.appendChild(labBar());
    HOST.appendChild(topBar(sc));
    if (sc.part >= 1 && sc.part <= 6) HOST.appendChild(journey(sc.part));
    var s = (SCREEN[sc.id] || placeholder)(sc);
    var wrap = el('div', { class: 'gd-body' + (s.two ? ' two' : '') + (s.narrow ? ' narrow' : '') });
    var col = el('div', { class: 'gd-col', id: 'gdCol' });
    (s.body || []).forEach(function (k) { if (k) col.appendChild(k); });
    // the button, and the three quiet links on every question screen
    var rs = RT().state(), busy = G.busy || rs.busy, err = G.err || rs.err;
    if (s.primary !== false) {
      var act = el('div', { class: 'gd-actions' }, [
        s.primary ? el('button', { class: 'gd-btn', id: 'gdNext', disabled: busy || s.primary.off ? true : null, onclick: s.primary.fn }, [busy ? 'Saving…' : s.primary.text]) : null,
        prevOf(sc.id) && sc.part > 0 && !s.noBack ? el('button', { class: 'gd-link', id: 'gdBack', onclick: function () { goto(prevOf(sc.id)); } }, ['Back']) : null]
        .concat(s.extra || []).concat([s.primary && !s.noEnter ? el('span', { class: 'gd-kbd', text: s.enterText || 'Enter to continue' }) : null]));
      col.appendChild(act);
    }
    if (err || G.msg) col.appendChild(el('p', { class: 'gd-msg' + (err ? ' bad' : ''), id: 'gdMsg', role: err ? 'alert' : 'status', text: err || G.msg }));
    G.msg = null; if (rs.err) rs.err = null;
    if (sc.q) col.appendChild(quiet(sc, s.whyText));
    if (G.ask === sc.id) col.appendChild(askPanel(sc, s.askPrompt || G.qText || ''));
    wrap.appendChild(col);
    if (s.two) {
      var side = el('aside', { class: 'gd-side' + (G.view ? ' open' : ''), id: 'gdSide', 'aria-label': 'The framing of your problem' }, [panel()]);
      wrap.appendChild(el('button', { class: 'gd-viewbtn', id: 'gdViewBtn', 'aria-expanded': String(!!G.view), onclick: function () { G.view = !G.view; paint(); } }, [G.view ? 'Hide your framing' : 'View your framing']));
      wrap.appendChild(side);
    }
    HOST.appendChild(wrap);
    Object.keys(G.drafts || {}).forEach(function (id) { var e = document.getElementById(id); if (e && e.value !== G.drafts[id] && !/^rtAdd|^gdAdd|^gdRunAdd|^gdMenuInput/.test(id)) e.value = G.drafts[id]; });
    if (G.ex) HOST.appendChild(example());
    var f = keep && document.getElementById(keep);
    if (f && f !== document.body && /INPUT|TEXTAREA/.test(f.tagName)) { try { f.focus(); } catch (e) {} }
    else { var af = HOST.querySelector('[data-autofocus]'); if (af && !busy) try { af.focus({ preventScroll: true }); } catch (e) {} }
  }
  function topBar(sc) {
    var g = GD(), who = g.who || 'client';
    var where = sc.part >= 1 && sc.part <= 6 ? 'Part ' + sc.part + ' of 6 · ' + (sc.check ? 'end of this part' : 'about ' + Math.max(1, minutesLeft(sc.id)) + ' minutes left') : sc.part === 7 ? 'Your framing' : 'Before we start';
    var file = el('input', { type: 'file', id: 'gdAddFile', multiple: true, style: 'display:none', accept: '.pdf,.docx,.doc,.pptx,.xlsx,.txt,.md,.csv,.eml,.vtt,.srt,image/*' });
    file.addEventListener('change', function () { addFiles(file.files, 'document'); });
    return el('div', { class: 'gd-bar' }, [
      el('span', { class: 'gd-svc', id: 'gdSvc', text: R().named ? R().name : (S.data.session.client || S.data.session.name || ''), title: R().named ? R().name : (S.data.session.client || S.data.session.name || '') }),
      el('span', { class: 'gd-where', id: 'gdWhere' }, [where.split(' · ')[0], where.indexOf(' · ') > 0 ? el('span', { class: 'gd-mins', text: ' · ' + where.split(' · ').slice(1).join(' · ') }) : null]),
      el('span', { class: 'gd-saved', id: 'gdSaved', hidden: !frameRow() }, [el('i'), 'Saved']),
      el('div', { class: 'gd-who', role: 'group', 'aria-label': 'Who is answering' }, [
        el('button', { class: who === 'client' ? 'on' : '', id: 'gdWhoClient', 'aria-pressed': String(who === 'client'), onclick: function () { setWho('client'); } }, ['The organisation is answering']),
        el('button', { class: who === 'team' ? 'on' : '', id: 'gdWhoTeam', 'aria-pressed': String(who === 'team'), onclick: function () { setWho('team'); } }, ['I’m answering for them'])]),
      sc.part >= 1 ? el('button', { class: 'gd-chip', id: 'gdAddSource', onclick: function () { file.click(); } }, ['+ Add a source']) : null, file,
      who === 'team' ? el('a', { class: 'gd-quietlink', id: 'gdCanvas', href: '#canvas', title: 'The team’s place to review and edit the same answers' }, ['The canvas']) : null,
      // one way out, always the same (option D, 28 October 2026): every answer is already saved
      el('a', { class: 'gd-out', id: 'gdOut', href: '/home' + (S.readonly ? location.search : ''), onclick: function (e) { if (G.busy) { e.preventDefault(); } } }, ['Save and go to the project home'])]);
  }
  // the Lab's header, kept on the guided screens for everyone, client included, in a quieter form (28 October 2026)
  function labBar() {
    var ex = S.readonly ? location.search : '', SC = window.VTScope, on = function (k) { return !k || !SC || SC.on(k); };
    var items = [['Home', '/home' + ex], ['Frame', '/frame' + ex + '#canvas', 'problem', true], ['Diagnose', '/diagnose' + ex, 'analyse'], ['Model', '/model' + ex, 'evaluate'], ['Test', '/test' + ex, 'test'], ['Project', '/project' + ex, 'project'], ['About Viability Thinking', '/about']].filter(function (x) { return on(x[2] === 'project' ? null : x[2]); });
    return el('div', { class: 'gd-hdr', id: 'gdLab' }, [
      el('a', { class: 'gd-lablogo', href: '/hub', 'aria-label': 'Viability Thinking Lab: Home' }, [el('span', { class: 'vt-wordmark' }, [el('b', { text: 'viabilitythinking' }), el('i', { text: 'lab' })])]),
      el('nav', { class: 'gd-labtabs', 'aria-label': 'The Lab' }, items.map(function (x) { return el('a', { href: x[1], class: x[3] ? 'on' : null, 'aria-current': x[3] ? 'page' : null, text: x[0] }); })),
      el('span', { class: 'gd-labme' }, [el('span', { class: 'gd-av', id: 'gdAv', 'aria-hidden': 'true', text: initials(me()) }), el('span', { class: 'gd-labname', text: me() })])]);
  }
  function me() { var u = window.VTAuth && window.VTAuth.user && window.VTAuth.user(); return (u && u.name) || (S.data.as === 'master' ? 'David' : (GD().person && GD().person.name) || 'Facilitator'); }
  function initials(t) { var w = String(t || '').replace(/[^A-Za-z ]+/g, ' ').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : (w[0] || '').slice(1, 2))).toUpperCase(); }
  // where the guided framing has got to, part by part, for the project's "Where we are" page
  function progress() {
    var g = GD(), by = g.by || {}, ns = g.notsure || {}, cur = g.at ? stepOf(g.at).part : 0;
    var parts = PARTS.map(function (name, i) {
      var p = i + 1, qs = FLOW.filter(function (s) { var sk = false; try { sk = skip(s); } catch (e) {} return s.part === p && s.q && !sk; });
      var done = qs.filter(function (s) { return by[s.id]; }), last = done.map(function (s) { return by[s.id]; }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); })[0] || null;
      var status = g.sent || cur > p || (qs.length && done.length === qs.length) ? 'done' : (done.length || cur === p) ? 'progress' : 'todo';
      var open = qs.filter(function (s) { return !by[s.id]; })[0];
      return { part: p, name: name, status: status, by: last && last.name, at: last && last.at, notsure: qs.filter(function (s) { return ns[s.id]; }).length, step: cur === p && g.at ? g.at : open ? 'open' + p : 'open' + p };
    });
    return { parts: parts, sent: g.sent || null, at: g.at || null, part: cur, stopped: g.at ? (LABELS[g.at] || '') : '', minutes: Math.max(1, minutesLeft(g.at || 'welcome')), notsure: Object.keys(ns).length };
  }
  function setWho(w) { safe(function () { return gsave(function (a, g) { g.who = w; }, w === 'team' ? 'The team is answering for the organisation' : 'The organisation is answering'); }); }
  function journey(p) {
    return el('div', { class: 'gd-journey', 'aria-label': 'The six parts' }, PARTS.map(function (n, i) { var k = i + 1; return el('span', { class: k < p ? 'done' : k === p ? 'now' : '', 'aria-current': k === p ? 'step' : null }, [n]); }));
  }
  // Not sure, Ask a colleague, Why are we asking this?
  function quiet(sc, whyText) {
    var ns = (GD().notsure || {})[sc.id];
    var kids = [
      el('button', { class: 'gd-q', id: 'gdNotSure', onclick: function () { notSure(sc); } }, [ns ? 'Not sure (recorded)' : 'Not sure']),
      el('button', { class: 'gd-q', id: 'gdAsk', 'aria-expanded': String(G.ask === sc.id), onclick: function () { G.ask = G.ask === sc.id ? null : sc.id; paint(); } }, ['Ask a colleague']),
      el('details', { class: 'gd-why', id: 'gdWhy' }, [el('summary', { text: sc.id === 'matters' ? 'Why both sides?' : 'Why are we asking this?' }), el('p', { text: whyText || WHY[sc.id] || 'So that the framing is built from what you know, in your own words.' })])];
    var row = el('div', { class: 'gd-quiet' }, kids);
    if (ns) return el('div', {}, [el('p', { class: 'gd-ns', id: 'gdNsNote' }, ['Marked not sure by ' + ns.by + ', ' + stamp(ns.at) + '. ', el('button', { class: 'gd-link sm', id: 'gdNsClear', onclick: function () { safe(function () { return gsave(function (a, g) { if (g.notsure) delete g.notsure[sc.id]; }, 'Cleared not sure'); }); } }, ['Clear it'])]), row]);
    return row;
  }
  function notSure(sc) {
    safe(async function () { await gsave(function (a, g) { g.notsure = g.notsure || {}; g.notsure[sc.id] = { by: person() + (g.who === 'team' ? ' (for the organisation)' : ''), at: new Date().toISOString(), q: G.qText || '' }; }, 'Not sure: ' + sc.id); });
    advance(sc.id);
  }
  // Ask a colleague: just this question; their answers stay hidden until all have replied, then side by side
  function askPanel(sc, prompt) {
    var g = GD(), a = (g.asks || {})[sc.id], hostEl = el('div', { class: 'gd-askp', id: 'gdAskPanel' });
    hostEl.appendChild(el('p', { text: 'Your colleagues answer this one question on their own, on a phone or in the browser, at ' + location.origin + ' with the code ' + S.data.session.session_code + '. Nobody sees the others’ answers until everyone has replied.' }));
    if (!a || a.kept) {
      if (a && a.kept) hostEl.appendChild(answersEl(a));
      hostEl.appendChild(el('button', { class: 'gd-btn sm', id: 'gdAskSend', onclick: function () { safe(async function () { var d = await X.api({ action: 'p_round_open', tile_key: 'frame', prompt: prompt }); await gsave(function (x, gg) { gg.asks = gg.asks || {}; gg.asks[sc.id] = { round: d.round.id, prompt: prompt, at: new Date().toISOString() }; }, 'Asked colleagues: ' + prompt); }); } }, [a && a.kept ? 'Ask again' : 'Send this question']));
      return hostEl;
    }
    var status = el('p', { class: 'gd-askcount', id: 'gdAskCount', text: 'Checking who has answered…' });
    hostEl.appendChild(status);
    (async function () {
      try {
        var d = await X.api({ action: 'p_load' }), r = (d.rounds || []).filter(function (x) { return x.id === a.round; })[0];
        if (!r) { status.textContent = 'This question has closed.'; return; }
        if (r.status === 'open') {
          var all = d.joined > 0 && r.count >= d.joined;
          status.textContent = r.count + ' of ' + d.joined + ' have answered' + (all ? '. Everyone has answered.' : '.');
          hostEl.appendChild(el('button', { class: 'gd-btn sm', id: 'gdAskReveal', disabled: r.count ? null : true, onclick: function () { safe(async function () { await X.api({ action: 'p_round_reveal', round_id: r.id }); }); } }, [all ? 'Show them side by side' : 'Show them now']));
        } else {
          status.textContent = 'Their answers, side by side:';
          hostEl.appendChild(el('div', { class: 'gd-side-by-side', id: 'gdAskAnswers' }, (r.answers || []).map(function (t) { return el('p', { class: 'gd-ans', text: t }); })));
          hostEl.appendChild(el('button', { class: 'gd-btn sm', id: 'gdAskKeep', onclick: function () { safe(async function () { await gsave(function (x, gg) { gg.asks[sc.id] = Object.assign({}, gg.asks[sc.id], { answers: r.answers, kept: new Date().toISOString() }); }, 'Kept colleagues’ answers'); await X.api({ action: 'p_round_close', round_id: r.id }); }); } }, ['Keep them with this question']));
        }
      } catch (e) { status.textContent = e.message; }
    })();
    return hostEl;
  }
  function answersEl(a) { return el('div', { class: 'gd-side-by-side' }, (a.answers || []).map(function (t) { return el('p', { class: 'gd-ans', text: t }); })); }
  // a question: the question large, a short line, then the body
  function qHead(over, q, line, extra) { G.qText = q; return [el('p', { class: 'gd-over', text: over }), el('h1', { class: 'gd-qh', id: 'gdQ', text: q }), line ? el('p', { class: 'gd-lede', text: line }) : null].concat(extra || []); }
  function suggestedFrom(on) { var n = sourceNames(); return on && n.length ? el('p', { class: 'gd-hint', id: 'gdSugFrom', text: 'Suggested from ' + join(n.slice(0, 2)) + (n.length > 2 ? ' and ' + (n.length - 2) + ' more' : '') + '. Change anything.' }) : null; }
  function area(id, val, rows, ph) { var t = el('textarea', { class: 'gd-area', id: id, rows: rows || 4, placeholder: ph || '', 'data-autofocus': '' }); t.value = val || ''; return t; }
  function rows(name, opts, picked, multi) {
    return el('div', { class: 'gd-rows', role: multi ? 'group' : 'radiogroup' }, opts.map(function (o, i) {
      var on = multi ? picked.indexOf(o[0]) >= 0 : picked === o[0];
      return el('label', { class: 'gd-row' + (on ? ' on' : '') }, [el('input', { type: multi ? 'checkbox' : 'radio', name: name, value: o[0], checked: on, 'data-n': String(i + 1) }), el('span', { class: 'gd-rt' }, [o[1], o[2] ? el('small', { text: o[2] }) : null])]);
    }));
  }
  function picked(name) { return Array.prototype.map.call(HOST.querySelectorAll('input[name="' + name + '"]:checked'), function (x) { return x.value; }); }
  function placeholder(sc) { return { body: [el('h1', { class: 'gd-qh', text: 'This screen comes in the next step of the build.' })], primary: { text: 'Next', fn: function () { advance(sc.id); } } }; }

  // ---------- the framing panel, building as answers are given ----------
  function panel() {
    var r = R(), on = RT().on, ins = on(r, 'inside'), outs = on(r, 'outside'), within = r.standalone ? 'It stands alone' : on(r, 'within').join(' · ');
    var title = r.named ? r.name : r.desc || '';
    // the answer just ticked moves into its place, shown dark for a moment
    var now = ins.concat(outs), prev = G.prevSet; G.prevSet = now; G.arrive = null;
    if (prev) for (var j = 0; j < now.length; j++) if (prev.indexOf(now[j]) < 0) { G.arrive = now[j]; break; }
    var kids = [el('p', { class: 'gd-fr-title', text: 'The framing of your problem' })];
    if (!title && !within) { kids.push(el('div', { class: 'gd-nest empty' }, [el('p', { text: 'The framing of your problem will appear here' })])); return el('div', { id: 'gdPanel' }, kids); }
    var why = F('help', 'why');
    if (why) kids.push(el('div', { class: 'gd-why-now' }, [el('span', { text: 'Why now' }), String(why).split(/(?<=\.)\s/)[0]]));
    var items = function (list, cls) { var shown = list.slice(0, 4), more = list.length - shown.length; return el('div', { class: 'gd-items' }, shown.map(function (t) { return el('span', { class: 'gd-it' + (cls || '') + (G.arrive === t ? ' arrive' : ''), text: t }); }).concat(more > 0 ? [el('span', { class: 'gd-it more', text: '+' + more + ' more' })] : [])); };
    var steps = (r.steps || []).map(function (x) { return x.n; }), ii = on(r, 'inputs'), oo = on(r, 'outputs'), runsP = ((A().requires || {}).runs || []);
    var flow = el('div', { class: 'gd-flow' + (ii.length || oo.length || steps.length ? '' : ' ghost') }, [el('span', { class: 'gd-box', title: ii.join('; ') || 'What comes in', text: 'In' }), el('span', { class: 'gd-ar', text: '→' }),
      el('span', { class: 'gd-steps' }, (steps.length ? steps : on(r, 'work').length ? on(r, 'work') : [1, 2, 3, 4]).slice(0, 7).map(function (t) { return el('i', { title: typeof t === 'string' ? t : '' }); })), el('span', { class: 'gd-ar', text: '→' }),
      el('span', { class: 'gd-box', title: oo.join('; ') || 'What comes out', text: 'Out' }), ii.length || oo.length ? null : el('span', { class: 'gd-later', text: 'later in part 3' })]);
    var core = el('div', { class: 'gd-core', id: 'gdCore' }, [el('div', { class: 'gd-lbl', text: 'Working on' }), el('h3', { id: 'gdPanelName', text: title }),
      F('service', 'for') ? el('p', { class: 'gd-for', text: 'For: ' + lc(F('service', 'for')) }) : null, ins.length ? items(ins) : null, flow, runsP.length ? el('div', { class: 'gd-relies' }, [el('span', { class: 'gd-nl2', text: 'Relies on' }), items(runsP.map(function (x) { return x.t; }))]) : null]);
    var mid = el('div', { class: 'gd-mid' }, [el('span', { class: 'gd-nl', text: outs.length ? 'Decided elsewhere' : 'Decided elsewhere · part 3' }), outs.length ? items(outs, ' raised') : null, core]);
    kids.push(el('div', { class: 'gd-nest' }, [el('span', { class: 'gd-nl', text: within ? 'Part of: ' + within : 'Part of: not yet answered' }), mid]));
    kids.push(el('p', { class: 'gd-hint', text: 'Each answer moves into its place as you tick it.' }));
    return el('div', { id: 'gdPanel' }, kids);
  }

  // ---------- the screens ----------
  function opener(n) {
    var o = OPENERS[n];
    return function (sc) {
      return { narrow: true, body: [el('div', { class: 'gd-opener' }, [el('p', { class: 'gd-num', 'aria-hidden': 'true', text: String(n) }), el('h1', { id: 'gdQ', text: PARTS[n - 1] }), el('p', { class: 'gd-what', text: sub(o.what) }),
        el('div', { class: 'gd-facts' }, [el('div', {}, [el('b', { text: 'Takes' }), o.time]), el('div', {}, [el('b', { text: 'You’ll answer' }), o.ask]), el('div', {}, [el('b', { text: 'You’ll get' }), o.get])])])],
        primary: { text: 'Start this part', fn: function () { advance(sc.id); } }, enterText: 'Press Enter to start',
        extra: [el('button', { class: 'gd-link', id: 'gdSkipPart', onclick: function () { var i = idx(sc.id) + 1; while (i < FLOW.length && FLOW[i].part === n) i++; goto(FLOW[i].id); } }, ['Skip for now'])], noBack: true };
    };
  }
  var SCREEN = {
    // one welcome for an engagement: what Viability is, and how this works (it replaces the hub's welcome band)
    welcome: function (sc) {
      var g = GD(), nm = el('input', { type: 'text', class: 'gd-input', id: 'gdName', placeholder: 'For example: Sam Patel, Head of Outpatients', value: (g.person && g.person.name) || '' }), org = el('input', { type: 'text', class: 'gd-input', id: 'gdOrg', placeholder: 'Your organisation', value: (g.person && g.person.org) || S.data.session.client || '' });
      return { narrow: true, noBack: true, body: [el('p', { class: 'gd-over', text: 'Welcome' }), el('h1', { class: 'gd-qh big', id: 'gdQ', text: 'Let’s get clear on what you want to work on' }),
        el('p', { class: 'gd-lede', text: 'Viability asks whether a service can keep doing what it is for, through what is changing around it. This first part frames the question, before anyone looks at the evidence.' }),
        el('p', { class: 'gd-hint', id: 'gdReadMore' }, [el('a', { href: '/about', target: '_blank', rel: 'noopener', text: 'Read more about Viability Thinking' }), ' (opens in a new tab, so you keep your place).']),
        el('p', { class: 'gd-lede', text: 'About 30 minutes. One question at a time, and you can stop and come back. As you answer, the framing of your problem builds on the right. At the end you get it on one page to share.' }),
        el('p', { class: 'gd-stages', id: 'gdStages' }, [el('b', { text: 'Frame' }), ' agree what you are answering, and the threshold the service must never cross. ', el('b', { text: 'Diagnose' }), ' gather the evidence of how it really runs. ', el('b', { text: 'Test and decide' }), ' try the options before anything is decided. You are starting the first.']),
        el('div', { class: 'gd-fields' }, [el('label', { for: 'gdName', text: 'Your name' }), nm, el('label', { for: 'gdOrg', text: 'Your organisation' }), org])],
        primary: { text: g.at && g.at !== 'welcome' ? 'Carry on' : 'Start', fn: function () { var n = nm.value.trim(), o = org.value.trim(); safe(async function () { await gsave(function (a, gg) { gg.person = { name: n, org: o }; }, 'Guided framing started'); }); advance('welcome'); } },
        extra: [el('button', { class: 'gd-link', id: 'gdExample', onclick: function () { G.ex = true; paint(); } }, ['See a 2-minute example first'])] };
    },
    sources: function (sc) {
      var add = function (kind, accept, multi, id) { var f = el('input', { type: 'file', id: id, accept: accept, multiple: multi ? true : null, style: 'display:none' }); f.addEventListener('change', function () { addFiles(f.files, kind); }); return f; };
      var docs = add('document', '.pdf,.docx,.doc,.pptx,.xlsx,.txt,.md,.csv', true, 'gdDocs'), notes = add('notes', 'image/*,.txt,.md,.vtt,.srt,.docx,.pdf', true, 'gdNotes'), photo = add('notes', 'image/*', false, 'gdPhoto'); photo.setAttribute('capture', 'environment');
      var url = el('input', { type: 'url', class: 'gd-input', id: 'gdUrl', placeholder: 'https://' }), mail = el('textarea', { class: 'gd-area', id: 'gdMail', rows: 3, placeholder: 'Paste the email or message here' });
      var have = (S.data.sources || []).map(function (s) { return el('span', { class: 'gd-file', 'data-src': s.id, text: s.title || s.file_name }); });
      return { narrow: true, body: [el('p', { class: 'gd-over', text: 'Before we start · optional' }), el('h1', { class: 'gd-qh', id: 'gdQ', text: 'Share what you have' }),
        el('p', { class: 'gd-lede', text: aiOn() ? 'Anything that describes the service or the problem. We read it and use it to suggest answers, so you are choosing and correcting rather than starting from blank.' : 'Anything that describes the service or the problem. We keep it with your framing for the team to read.' }),
        el('div', { class: 'gd-srcs' }, [
          el('div', { class: 'gd-src' }, [el('b', { text: 'Add a link' }), el('small', { text: 'A web page about the service, a public report or an inspection' }), el('div', { class: 'gd-inl' }, [url, el('button', { class: 'gd-link', id: 'gdUrlAdd', onclick: function () { var v = url.value.trim(); if (!/^https?:\/\//.test(v)) { G.err = 'Paste the whole address, starting https://'; return paint(); } safe(function () { return addSource({ kind: 'document', title: 'Web page: ' + v.replace(/^https?:\/\//, '').slice(0, 80), file_name: v.slice(0, 200), body: v }); }); } }, ['Add'])])]),
          el('div', { class: 'gd-src' }, [el('b', { text: 'Upload documents' }), el('small', { text: 'Board papers, reports, process maps, policies (PDF, Word, PowerPoint, Excel)' }), el('button', { class: 'gd-link', id: 'gdDocsBtn', onclick: function () { docs.click(); } }, ['+ Choose files']), docs]),
          el('div', { class: 'gd-src' }, [el('b', { text: 'Upload notes' }), el('small', { text: 'Photos or scans of handwritten notes, typed notes, a meeting transcript' }), el('div', { class: 'gd-inl' }, [el('button', { class: 'gd-link', id: 'gdPhotoBtn', onclick: function () { photo.click(); } }, ['+ Take a photo']), el('button', { class: 'gd-link', id: 'gdNotesBtn', onclick: function () { notes.click(); } }, ['+ Browse'])]), notes, photo]),
          el('div', { class: 'gd-src' }, [el('b', { text: 'Paste an email or message' }), el('small', { text: 'For example the request that started this' }), mail, el('button', { class: 'gd-link', id: 'gdMailAdd', onclick: function () { var v = mail.value.trim(); if (!v) return; safe(function () { return addSource({ kind: 'notes', title: 'Email or message, ' + day(new Date().toISOString()), body: v }); }); } }, ['Add'])])]),
        have.length ? el('div', { class: 'gd-files', id: 'gdHave' }, [el('span', { class: 'gd-hint', text: 'Shared so far:' })].concat(have)) : null,
        el('p', { class: 'gd-hint', text: 'You can add more at any point with “Add a source” at the top of each screen.' })],
        primary: { text: (S.data.sources || []).length ? 'Next' : 'Skip this for now', fn: function () { safe(async function () { await prefill(); }); advance('sources'); } } };
    },
    open1: opener(1), open2: opener(2), open3: opener(3), open4: opener(4), open5: opener(5), open6: opener(6),
    prompt: function (sc) {
      var g = GD(), v = F('help', 'why') || (g.prefill && g.prefill.prompt) || '', t = area('gdPrompt', v, 5, 'In your own words');
      return { two: true, body: qHead('What’s prompting this', 'What’s prompting you to look at this now?', null, [t, !F('help', 'why') && g.prefill && g.prefill.prompt ? suggestedFrom(true) : null]),
        primary: { text: 'Next', fn: function () { var x = t.value.trim(); if (!x) { G.err = 'Write a line or two, or choose Not sure.'; return paint(); } safe(async function () { await gsave(function (a) { var h = box(a, 'help'); h.fields.why = x; if (!String(h.fields.first || '').trim()) h.fields.first = x; if (!String(h.fields.words || '').trim()) h.fields.words = x; }, 'Why now, in their words'); advance('prompt'); }); } } };
    },
    closest: function (sc) {
      var h = A().help || {}, cur = h.closest || [];
      return { two: true, body: qHead('What’s prompting this', 'Which of these is closest?', 'Choose all that apply.', [rows('closest', CLOSEST, cur, true)]),
        primary: { text: 'Next', fn: function () { var p = picked('closest'); safe(async function () { await gsave(function (a) { var hh = box(a, 'help'); hh.closest = p; var k = kindOf(p); if (k && !(hh.kind && hh.kind.main)) hh.kind = k; if (p.indexOf('asked') >= 0) { hh.markers = hh.markers || {}; if (!hh.markers.idea) hh.markers.idea = 'asked'; } }, 'Which is closest'); advance('closest'); }); } } };
    },
    before: function (sc) {
      var g = GD(), v = F('question', 'before') || (g.prefill && g.prefill.before) || '', t = area('gdBefore', v, 4, 'What happened, what was tried, and what happened next');
      return { two: true, body: qHead('What’s prompting this', 'Has this happened before, or been tried before?', null, [t, !F('question', 'before') && g.prefill && g.prefill.before ? suggestedFrom(true) : null]),
        primary: { text: 'Next', fn: function () { var x = t.value.trim(); safe(async function () { await gsave(function (a) { var q = box(a, 'question'); q.fields.before = x; }, 'Happened before, or tried before'); advance('before'); }); } } };
    }
  };
  // ---------- part 3, after the route: what it relies on, and what it is for ----------
  var KINDS = [['People', 'human'], ['Systems', 'information'], ['Places', 'manufactured'], ['Suppliers', 'social'], ['Know-how', 'information'], ['Money', 'financial']];
  var OWNS = [['ours', 'yours'], ['theirs', 'someone else’s'], ['shared', 'shared']];
  function kindGuess(t) { t = String(t || '').toLowerCase(); if (/\b(money|fund|funds|funding|budget|cash)\b/.test(t)) return 'Money'; if (/\b(supplier|contractor|vendor|partner)/.test(t)) return 'Suppliers'; if (/\b(system|data|software|records|it\b|computer|phone)/.test(t)) return 'Systems'; if (/\b(room|building|site|clinic|office|depot|place|space)/.test(t)) return 'Places'; if (/\b(rules|know-how|knowledge|skills|training|procedure|policy|expertise)/.test(t)) return 'Know-how'; return 'People'; }
  // the list to choose from: what was kept before, then what step 2 suggests (inside items and parts are yours, decided elsewhere is someone else's)
  function runsList() {
    var a = A(), g = GD(), have = ((a.requires && a.requires.runs) || []).map(function (x) { return { t: x.t, kind: x.kind || kindFromCap(x.cap), own: x.own || 'ours', on: true }; });
    var off = (g.runsOff || []).map(function (x) { return Object.assign({}, x, { on: false }); }), seen = have.concat(off).map(function (x) { return x.t.toLowerCase(); }), r = R();
    var sug = [];
    RT().on(r, 'inside').concat(r.parts || []).forEach(function (t) { if (seen.indexOf(t.toLowerCase()) < 0) { seen.push(t.toLowerCase()); sug.push({ t: t, kind: kindGuess(t), own: 'ours', on: false, sug: true }); } });
    RT().on(r, 'outside').forEach(function (t) { if (seen.indexOf(t.toLowerCase()) < 0) { seen.push(t.toLowerCase()); sug.push({ t: t, kind: kindGuess(t), own: 'theirs', on: false, sug: true }); } });
    return have.concat(off).concat(sug);
  }
  function kindFromCap(c) { return ({ human: 'People', information: 'Systems', manufactured: 'Places', social: 'Suppliers', financial: 'Money' })[c] || 'People'; }
  function capOf(k) { var m = KINDS.filter(function (x) { return x[0] === k; })[0]; return m ? m[1] : 'human'; }
  function saveRuns(list) {
    return gsave(function (a, g) {
      var q = box(a, 'requires');
      q.runs = list.filter(function (x) { return x.on && String(x.t || '').trim(); }).map(function (x) { return { t: x.t, cap: capOf(x.kind), own: x.own, kind: x.kind }; });
      q.fields.runs = q.runs.map(function (x) { return x.t + ' (' + x.kind + ', ' + (x.own === 'ours' ? 'yours' : x.own === 'theirs' ? 'someone else’s' : 'shared') + ')'; }).join('\n');
      g.runsOff = list.filter(function (x) { return !x.on && !x.sug; }).map(function (x) { return { t: x.t, kind: x.kind, own: x.own }; });
    }, 'What it relies on');
  }
  SCREEN.runs = function (sc) {
    var list = runsList();
    var rowsEl = el('div', { class: 'gd-rows', id: 'gdRuns' }, list.map(function (x, i) {
      var cb = el('input', { type: 'checkbox', checked: x.on, 'data-run': x.t, 'aria-label': x.t });
      cb.addEventListener('change', function () { list[i].on = cb.checked; if (cb.checked) list[i].sug = false; safe(function () { return saveRuns(list); }); });
      var kind = el('select', { class: 'gd-sel', 'aria-label': 'What kind', 'data-kind': x.t }, KINDS.map(function (k) { return el('option', { value: k[0], text: k[0] }); })); kind.value = x.kind;
      kind.addEventListener('change', function () { list[i].kind = kind.value; if (list[i].on) safe(function () { return saveRuns(list); }); });
      var own = el('select', { class: 'gd-sel', 'aria-label': 'Whose it is', 'data-own': x.t }, OWNS.map(function (o) { return el('option', { value: o[0], text: o[1] }); })); own.value = x.own;
      own.addEventListener('change', function () { list[i].own = own.value; if (list[i].on) safe(function () { return saveRuns(list); }); });
      return el('div', { class: 'gd-row run' + (x.on ? ' on' : '') }, [el('label', { class: 'gd-rl' }, [cb, el('span', { class: 'gd-rt', text: x.t })]), kind, own]);
    }));
    var add = el('input', { type: 'text', class: 'rt-add', id: 'gdRunAdd', placeholder: 'Add your own' });
    add.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = add.value.trim(); if (!v) return; list.push({ t: v, kind: kindGuess(v), own: 'ours', on: true }); safe(function () { return saveRuns(list); }); } });
    return { two: true, body: qHead(PARTS[2], 'What does it rely on to keep running?', 'Things it needs every day that are not used up: people, systems, places, suppliers, know-how, money. Mark each one yours or someone else’s.', [list.some(function (x) { return x.sug; }) ? el('p', { class: 'gd-hint', text: 'Suggested from what you said it controls, and what is decided elsewhere. Tick the ones it relies on.' }) : null, rowsEl, el('div', { class: 'rt-addrow' }, [add])]),
      primary: { text: 'Next', fn: function () { advance('runs'); } } };
  };
  SCREEN.purpose = function (sc) {
    var f = area('gdFor', F('service', 'for'), 3, 'What it is for'), nv = area('gdNever', F('service', 'never'), 3, 'What could never change'); nv.removeAttribute('data-autofocus');
    var outs = RT().on(R(), 'outputs');
    var chips = outs.length ? el('div', { class: 'gd-chips', id: 'gdForSug' }, [el('span', { class: 'gd-hint', text: 'From what comes out of it. Tap to use:' })].concat(outs.slice(0, 5).map(function (o) { return el('button', { class: 'gd-chip', 'data-sug': o, onclick: function () { var cur = f.value.trim(); f.value = cur ? cur.replace(/\.?$/, '; ') + lc(o) + '.' : o + '.'; f.focus(); } }, [o]); }))) : null;
    return { two: true, body: qHead(PARTS[2], 'What is it for?', null, [f, chips, el('h2', { class: 'gd-qh sm', text: 'What could never change without it becoming something else?' }), nv]),
      primary: { text: 'Next', fn: function () { var a1 = f.value.trim(), a2 = nv.value.trim(); safe(async function () { await gsave(function (a) { var s2 = box(a, 'service'); s2.fields.for = a1; s2.fields.never = a2; }, 'What it is for'); advance('purpose'); }); } } };
  };
  // ---------- end-of-part checks: "Let me check I've got this right" (parts 1, 3 and 4) ----------
  // The part's answers as a short paragraph; every answer underlined and tappable. With suggestions off it is built from the lists.
  function tk(t, ref) { return { t: t, ref: ref }; }
  function para(n) {
    var r = R(), on = RT().on, a = A(), within = r.standalone ? 'nothing larger: it stands alone' : joinlc(on(r, 'within'));
    var nm = r.name || 'It', P = [];
    if (n === 1) {
      P.push([tk(nm, { name: 1 }), ' is part of ', tk(within || 'something not yet said', { list: 'within' }), '. You described it as ', tk('“' + (r.desc || '') + '”', { desc: 1 }), '.']);
    } else if (n === 3) {
      var runs = ((a.requires || {}).runs || []).map(function (x) { return x.t; });
      P.push([tk(nm, { name: 1 }), ' is part of ', tk(within || 'something not yet said', { list: 'within' }), '. It takes in ', tk(lc(joinlc(on(r, 'inputs'))) || 'nothing yet', { list: 'inputs' }), ', and its team ', tk(lc(joinlc(on(r, 'work'))) || 'does work not yet said', { list: 'work' }), '. What comes out is ', tk(lc(joinlc(on(r, 'outputs'))) || 'not yet said', { list: 'outputs' }), '.']);
      P.push(['People in the service control ', tk(lc(joinlc(on(r, 'inside'))) || 'nothing yet', { list: 'inside' }), '. Decisions taken elsewhere: ', tk(lc(joinlc(on(r, 'outside'))) || 'none yet', { list: 'outside' }), '.']);
      P.push(['It relies on ', tk(lc(joinlc(runs)) || 'nothing yet', { goto: 'runs' }), ', and it is there for ', tk(lc(F('service', 'for')).replace(/\.$/, '') || 'a purpose not yet said', { field: ['service', 'for'] }), '.']);
    } else {
      var q = a.question || {}, f = q.fields || {}, rel = (q.rel || []).filter(function (x) { return x.who === person() || !x.who; })[0];
      P.push(['Your question: ', tk('“' + (f.question || 'not yet written') + '”', { field: ['question', 'question'] }), '.']);
      P.push([q.form === 'decision' ? 'It is decided by ' : 'Underneath it: ', q.form === 'decision' ? tk(f.owner || 'nobody named yet', { field: ['question', 'owner'] }) : tk(lc(f.under || 'not yet said').replace(/\.$/, ''), { field: ['question', 'under'] }), '. You want ', tk(lc(f.better || 'nothing named').replace(/\.$/, ''), { field: ['question', 'better'] }), ' to work better, and ', tk(lc(f.notfail || 'nothing named').replace(/\.$/, ''), { field: ['question', 'notfail'] }), ' must not fail.']);
      if (rel) P.push(['Your role: ', tk(lc(ROLES.filter(function (x) { return x[0] === rel.rel; }).map(function (x) { return x[1]; })[0] || 'not said'), { goto: 'role' }), '.']);
    }
    return P;
  }
  function paraText(P) { return P.map(function (line) { return line.map(function (x) { return typeof x === 'string' ? x : x.t; }).join(''); }).join(' '); }
  function checkScreen(n) {
    return function (sc) {
      var P = para(n), c = (GD().checks || {})['p' + n] || {}, k = 0, toks = [];
      var paras = P.map(function (line) { return el('p', { class: 'gd-para' }, line.map(function (x) { if (typeof x === 'string') return x; var i = k++; toks.push(x); var tg = function () { G.menu = G.menu === i ? null : i; paint(); }; return el('span', { class: 'gd-w' + (G.menu === i ? ' open' : ''), role: 'button', tabindex: '0', 'aria-expanded': String(G.menu === i), 'data-tok': String(i), onclick: tg, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); tg(); } } }, [x.t]); })); });
      var body = [el('p', { class: 'gd-voice', id: 'gdQ', text: 'Let me check I’ve got this right.' })].concat(paras);
      if (G.menu != null && toks[G.menu]) body.push(menuFor(toks[G.menu]));
      if (c.tidy) body.push(el('div', { class: 'gd-tidy', id: 'gdTidyCard' }, [el('p', { class: 'gd-hint', text: 'Tidier wording, with everything kept:' }), el('p', { class: 'gd-para sm', text: c.tidy }),
        el('div', { class: 'gd-inl' }, [el('button', { class: 'gd-link', id: 'gdUseTidy', onclick: function () { safe(function () { return gsave(function (a, g) { g.checks['p' + n].useTidy = true; }); }); } }, [c.useTidy ? 'Using this wording' : 'Use this wording']), el('button', { class: 'gd-link', id: 'gdKeepMine', onclick: function () { safe(function () { return gsave(function (a, g) { delete g.checks['p' + n].tidy; g.checks['p' + n].useTidy = false; }); }); } }, ['Keep mine'])])]));
      body.push(el('p', { class: 'gd-kbd', text: 'Tap any underlined words to change them.' }));
      var extra = [aiOn() ? el('button', { class: 'gd-link', id: 'gdTidy', onclick: function () { safe(async function () { var o = await RT().ai('tidy', { text: paraText(P) }); await gsave(function (a, g) { g.checks = g.checks || {}; g.checks['p' + n] = Object.assign({}, g.checks['p' + n], { tidy: o.text || '' }); }, 'Tidied the wording'); }); } }, ['Tidy the wording']) : null,
        el('button', { class: 'gd-link', id: 'gdAskCheck', onclick: function () { G.ask = sc.id; G.askPrompt = 'Is this right? ' + paraText(P); paint(); } }, ['Ask a colleague to check'])];
      return { narrow: true, wideText: true, body: body, extra: extra, noEnter: true, askPrompt: G.askPrompt || paraText(P),
        primary: { text: 'Yes, that’s right', fn: function () { var txt = paraText(P); safe(async function () {
          await gsave(function (a, g) { g.checks = g.checks || {}; g.checks['p' + n] = Object.assign({}, g.checks['p' + n], { ok: true, at: new Date().toISOString(), by: person(), text: txt }); }, 'Checked part ' + n);
          if (n === 3) await agreeSystem(txt);
          advance(sc.id); }); } } };
    };
  }
  // part 3 checked: the system is agreed, as the box 1 page agrees it, with its summary
  async function agreeSystem(txt) {
    var r = R(), sum = '';
    if (aiOn()) { try { sum = (await RT().ai('summary', { within: r.standalone ? 'It stands alone' : RT().on(r, 'within').join('; '), how: txt })).text || ''; } catch (e) { sum = ''; } }
    await RT().save(function (x) { x.how = txt; x.howOk = true; x.agreed = { at: new Date().toISOString(), by: person() }; x.summary = sum || RT().plainSummary(x); }, 'Agreed the system: ' + r.name);
  }
  // the small dark menu: keep, add a suggestion, type it differently
  function menuFor(t) {
    var ref = t.ref, r = R(), kids = [el('p', { class: 'gd-mt', text: t.t.replace(/^“|”$/g, '') }), el('button', { class: 'gd-mo', id: 'gdKeep', onclick: function () { G.menu = null; paint(); } }, ['Keep'])];
    if (ref.list) RT().L(r, ref.list).filter(function (x) { return !x.on; }).slice(0, 4).forEach(function (x, i) { kids.push(el('button', { class: 'gd-mo', 'data-addsug': x.t, onclick: function () { safe(function () { return RT().save(function (y) { (y.lists[ref.list] || []).forEach(function (z) { if (z.t === x.t) z.on = true; }); }, 'Added ' + x.t); }); } }, ['Add: ' + x.t])); });
    if (ref.goto) { kids.push(el('button', { class: 'gd-mo', onclick: function () { goto(ref.goto); } }, ['Change it on its own screen'])); return el('div', { class: 'gd-pop', id: 'gdMenu' }, kids); }
    var inp = el('input', { type: 'text', class: 'gd-mi', id: 'gdMenuInput', placeholder: ref.list ? 'Add it in your words' : 'Type it differently…' });
    if (ref.field) inp.value = F(ref.field[0], ref.field[1]); if (ref.name) inp.value = r.name || ''; if (ref.desc) inp.value = r.desc || '';
    var keep = function () {
      var v = inp.value.trim(); if (!v) return;
      safe(async function () {
        if (ref.list) await RT().save(function (y) { y.lists[ref.list] = (y.lists[ref.list] || []).concat([{ t: v, on: true, own: true, m: ref.list === 'outside' ? 'elsewhere' : undefined }]); }, 'Added ' + v);
        else if (ref.name) await RT().save(function (y) { y.name = v; y.named = true; }, 'Renamed: ' + v);
        else if (ref.desc) await RT().save(function (y) { y.desc = v; }, 'Described again');
        else if (ref.field) await gsave(function (a) { box(a, ref.field[0]).fields[ref.field[1]] = v; }, 'Changed in the check');
        G.menu = null;
      });
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
    kids.push(el('div', { class: 'gd-mrow' }, [inp, el('button', { class: 'gd-mo', id: 'gdMenuSave', onclick: keep }, ['Use this'])]));
    return el('div', { class: 'gd-pop', id: 'gdMenu' }, kids);
  }
  SCREEN.check1 = checkScreen(1); SCREEN.check3 = checkScreen(3); SCREEN.check4 = checkScreen(4);

  // ---------- part 4: your question ----------
  var ROLES = [['parent', 'I’m accountable for what it is part of'], ['accountable', 'I’m accountable for it'], ['leads', 'I lead it: I set direction and make the main trade-offs'], ['runs', 'I run it day to day'], ['part', 'I lead a major part of it'], ['within', 'I work within it'], ['advises', 'I advise or influence it; others decide'], ['outside', 'I look at it from outside: a consultant, researcher, regulator or partner']];
  function firstSentence(t) { var m = /^[^.?!]*[.?!]?/.exec(String(t || '').trim()); return m ? m[0].replace(/[.?!]$/, '') : ''; }
  // three versions, built from their words when suggestions are off
  function plainVersions() {
    var s = svc(), why = lc(firstSentence(F('help', 'why'))), out = RT().on(R(), 'outputs')[0];
    return { question: 'What would it take for ' + s + ' to ' + (out ? 'deliver ' + lc(out) : 'work as it should') + (why ? ', given that ' + why : '') + '?',
      decision: 'What should we decide about ' + s + ', by when, and on what evidence?',
      problem: 'Why does ' + s + ' fall short' + (why ? ' when ' + why : '') + ', and what lies underneath it?' };
  }
  function hints(q) {
    var out = [], s = String(q || ''), nm = (R().name || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 3; });
    if (/^(can|could|is|are|should|will|would|do|does|did|has|have)\b/i.test(s) && !/\b(and if not|what|how|which|where|why|when)\b/i.test(s.slice(6))) out.push('It may be answerable yes or no: try adding what would it take, or how.');
    if (/\b(training|policy|document|new system|automat\w*|new post|more staff|software|tool|kit)\b/i.test(s)) out.push('It mentions a fix (' + (/\b(training|policy|document|new system|automat\w*|new post|more staff|software|tool|kit)\b/i.exec(s) || [''])[0] + '): is that the answer before the question?');
    if (nm.length && !nm.some(function (w) { return s.toLowerCase().indexOf(w) >= 0; })) out.push('It does not yet name the service: ' + R().name + '.');
    if (/\b(everything|all of|what would it take)\b/i.test(s) && s.length > 140) out.push('It may be too broad to answer: could it be narrower?');
    return out;
  }
  SCREEN.question = function (sc) {
    var g = GD(), q = A().question || {}, v = g.qVersions;
    if (!v) {
      if (aiOn() && !G.qAsked) { G.qAsked = true; (async function () { try { var o = await RT().ai('question3', { why: F('help', 'why'), outputs: RT().on(R(), 'outputs').join('; ') }); await gsave(function (a, gg) { gg.qVersions = o.question ? o : plainVersions(); }); paint(); } catch (e) { await gsave(function (a, gg) { gg.qVersions = plainVersions(); }); paint(); } })(); }
      v = plainVersions();
    }
    var form = q.form || G.form || 'question', cur = (q.fields && q.fields.question && (q.form || 'question') === form) ? q.fields.question : v[form];
    var opts = [['question', 'As a question', v.question], ['decision', 'As a decision', v.decision], ['problem', 'As a problem', v.problem]];
    var radios = el('div', { class: 'gd-rows', role: 'radiogroup' }, opts.map(function (o, i) { return el('label', { class: 'gd-row' + (form === o[0] ? ' on' : '') }, [el('input', { type: 'radio', name: 'form', value: o[0], checked: form === o[0], 'data-n': String(i + 1), onchange: function () { G.form = o[0]; G.qDraft = null; paint(); } }), el('span', { class: 'gd-rt' }, [el('b', { text: o[1] }), el('small', { class: 'gd-qv', text: o[2] })])]); }));
    var t = area('gdQuestion', G.qDraft != null ? G.qDraft : cur, 3); t.removeAttribute('data-autofocus');
    t.addEventListener('input', function () { G.qDraft = t.value; var hl = document.getElementById('gdHints'); if (hl) { hl.innerHTML = ''; hintList(t.value).forEach(function (x) { hl.appendChild(x); }); } });
    var hl = el('div', { class: 'gd-hints', id: 'gdHints' }, hintList(t.value));
    return { two: true, body: qHead(PARTS[3], 'Here’s what you told us, turned into a question about ' + svc() + '.', 'Choose the version closest to what you need, then change any words.', [el('p', { class: 'gd-hint', id: 'gdTurned', text: 'This is where the problem as you brought it becomes the question we work on. Treat it as a working hypothesis: we will sharpen it, or change it, as we learn more.' }), radios, el('p', { class: 'gd-hint', text: 'Your question, in your words:' }), t, hl]),
      primary: { text: 'Next', fn: function () { var x = t.value.trim(); if (!x) { G.err = 'Write the question, or choose Not sure.'; return paint(); } safe(async function () { await gsave(function (a) { var qq = box(a, 'question'); qq.form = form; if (!String(qq.fields.first || '').trim()) qq.fields.first = (a.help && a.help.fields && a.help.fields.first) || x; qq.fields.question = x; }, 'The question'); G.qDraft = null; advance('question'); }); } } };
  };
  function hintList(q) { var h = hints(q); return h.length ? h.map(function (x) { return el('p', { class: 'gd-hintl', text: x }); }) : [el('p', { class: 'gd-hintl ok', text: 'It reads as a question to answer, names the service, and does not jump to a fix.' })]; }
  SCREEN.decider = function (sc) {
    var q = A().question || {}, f = q.fields || {};
    if (q.form === 'decision') {
      var who = el('input', { type: 'text', class: 'gd-input', id: 'gdOwner', placeholder: 'For example: the planned care board', value: (f.owner || '').split(/, by /)[0], 'data-autofocus': '' }), by = el('input', { type: 'text', class: 'gd-input', id: 'gdBy', placeholder: 'For example: 15 January 2027', value: (f.owner || '').split(/, by /)[1] || '' });
      return { two: true, body: qHead(PARTS[3], 'Who makes the decision, and by when?', null, [el('div', { class: 'gd-fields' }, [el('label', { for: 'gdOwner', text: 'Who makes it' }), who, el('label', { for: 'gdBy', text: 'By when' }), by])]),
        primary: { text: 'Next', fn: function () { var a1 = who.value.trim(), b1 = by.value.trim(); safe(async function () { await gsave(function (a) { var qq = box(a, 'question'); qq.fields.owner = a1 + (b1 ? ', by ' + b1 : ''); qq.byWhen = b1; }, 'Who decides, by when'); advance('decider'); }); } } };
    }
    var t = area('gdUnder', f.under || '', 4, 'In your own words');
    return { two: true, body: qHead(PARTS[3], 'What is the problem underneath it?', 'What would still be wrong if the question were answered tomorrow?', [t]),
      primary: { text: 'Next', fn: function () { var x = t.value.trim(); safe(async function () { await gsave(function (a) { box(a, 'question').fields.under = x; }, 'The problem underneath it'); advance('decider'); }); } } };
  };
  SCREEN.sides = function (sc) {
    var f = (A().question || {}).fields || {}, b1 = area('gdBetter', f.better || '', 3, 'What do you want to work better?'), b2 = area('gdNotFail', f.notfail || '', 3, 'What must not fail?'); b2.removeAttribute('data-autofocus');
    return { two: true, body: qHead(PARTS[3], 'Both sides: what do you want to work better, and what must not fail?', null, [el('label', { class: 'gd-lab', for: 'gdBetter', text: 'What do you want to work better?' }), b1, el('label', { class: 'gd-lab', for: 'gdNotFail', text: 'What must not fail?' }), b2]),
      primary: { text: 'Next', fn: function () { var x1 = b1.value.trim(), x2 = b2.value.trim(); safe(async function () { await gsave(function (a) { var qq = box(a, 'question'); qq.fields.better = x1; qq.fields.notfail = x2; }, 'Both sides'); advance('sides'); }); } } };
  };
  SCREEN.role = function (sc) {
    var rel = ((A().question || {}).rel || []).filter(function (x) { return x.who === person(); })[0];
    return { two: true, body: qHead(PARTS[3], 'What is your role in it?', 'Choose the one closest to yours.', [rows('role', ROLES, rel ? rel.rel : '', false)]),
      primary: { text: 'Next', fn: function () { var p = picked('role')[0]; safe(async function () { await gsave(function (a) { var qq = box(a, 'question'); qq.rel = (qq.rel || []).filter(function (x) { return x.who !== person(); }).concat(p ? [{ who: person(), rel: p }] : []); }, 'Your role'); advance('role'); }); } } };
  };

  // ---------- part 5: who it matters to, in two halves ----------
  SCREEN.matters = function (sc) {
    var a = A(), vw = clone((a.value && a.value.who) || []), ew = clone((a.exposure && a.exposure.who) || []), sug = GD().mattersSug;
    if (!vw.length && !ew.length && aiOn() && !sug && !G.mAsked) { G.mAsked = true; (async function () { try { var o = await RT().ai('matters', { why: F('help', 'why'), outputs: RT().on(R(), 'outputs').join('; ') }); await gsave(function (x, g) { g.mattersSug = o; }); paint(); } catch (e) {} })(); }
    if (!vw.length && sug) vw = (sug.gain || []).map(function (t) { return { t: t, dep: 3, alt: 'none', sug: true }; });
    if (!ew.length && sug) ew = (sug.harm || []).map(function (t) { return { t: t, harm: 3, sug: true }; });
    var dots = function (n, onSet, label) { return el('span', { class: 'gd-dots', role: 'group', 'aria-label': label }, [1, 2, 3, 4, 5].map(function (k) { return el('button', { class: 'gd-dot' + (k <= n ? ' on' : ''), 'aria-label': label + ': ' + k + ' of 5', 'aria-pressed': String(k <= n), onclick: function () { onSet(k); } }); })); };
    var saveV = function () { return gsave(function (x) { var v = box(x, 'value'); v.who = vw.map(function (z) { return { t: z.t, dep: z.dep, alt: z.alt }; }); v.fields.gains = vw.map(function (z) { return z.t; }).join('; '); }, 'Who gains'); };
    var saveE = function () { return gsave(function (x) { var e = box(x, 'exposure'); e.who = ew.map(function (z) { return { t: z.t, harm: z.harm }; }); e.fields.exposed = ew.map(function (z) { return z.t; }).join('; '); }, 'Who is harmed'); };
    var vRows = vw.map(function (z, i) { return el('div', { class: 'gd-mrow2', 'data-gain': z.t }, [el('span', { class: 'gd-mn', text: z.t }), dots(z.dep || 0, function (k) { vw[i].dep = k; safe(saveV); }, 'How much they depend on it'),
      el('button', { class: 'gd-alt', 'data-alt': z.t, onclick: function () { vw[i].alt = vw[i].alt === 'elsewhere' ? 'none' : 'elsewhere'; safe(saveV); } }, [z.alt === 'elsewhere' ? 'could get it elsewhere' : 'no other way'])]); });
    var eRows = ew.map(function (z, i) { return el('div', { class: 'gd-mrow2', 'data-harm': z.t }, [el('span', { class: 'gd-mn', text: z.t }), dots(z.harm || 0, function (k) { ew[i].harm = k; safe(saveE); }, 'How badly they are harmed')]); });
    var addV = el('input', { type: 'text', class: 'gd-addin', id: 'gdAddGain', placeholder: 'Add who gains' }), addE = el('input', { type: 'text', class: 'gd-addin', id: 'gdAddHarm', placeholder: 'Add who is harmed' });
    addV.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = addV.value.trim(); if (v) { vw.push({ t: v, dep: 3, alt: 'none' }); safe(saveV); } } });
    addE.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = addE.value.trim(); if (v) { ew.push({ t: v, harm: 3 }); safe(saveE); } } });
    var good = area('gdGood', F('good', 'good') || (sug && sug.good) || '', 2, 'What working well looks like'); good.removeAttribute('data-autofocus');
    var meas = el('input', { type: 'text', class: 'gd-input', id: 'gdMeasure', placeholder: 'How you would know', value: F('good', 'measure') || (sug && sug.measure) || '' });
    var rare = el('textarea', { class: 'gd-rare', id: 'gdRare', rows: 2, placeholder: 'Who is rarely asked?' }); rare.value = F('exposure', 'absent') || (sug && sug.rare) || '';
    var never = area('gdNever2', F('gap', 'mustnot') || (sug && sug.never) || '', 2, 'What must never happen'); never.removeAttribute('data-autofocus');
    var sugNote = sug && (vw.some(function (z) { return z.sug; }) || ew.some(function (z) { return z.sug; })) ? el('p', { class: 'gd-hint', text: 'Suggested from what you have told us so far. Change anything, and set the dots.' }) : null;
    var halves = el('div', { class: 'gd-halves' }, [
      el('section', { class: 'gd-half v', 'aria-label': 'When it works well' }, [el('h2', { text: 'When it works well' }), el('p', { class: 'gd-hq', text: 'Who gains, and how much do they depend on it?' }), el('div', { class: 'gd-whol', id: 'gdGains' }, vRows.concat([el('div', { class: 'gd-mrow2 add' }, [addV])])),
        el('div', { class: 'gd-card' }, [el('b', { text: 'Working well looks like' }), good, meas])]),
      el('section', { class: 'gd-half e', 'aria-label': 'When it goes wrong' }, [el('h2', { text: 'When it goes wrong' }), el('p', { class: 'gd-hq', text: 'Who is harmed, and who is rarely asked?' }), el('div', { class: 'gd-whol', id: 'gdHarms' }, eRows.concat([el('div', { class: 'gd-mrow2 add' }, [addE])])),
        el('label', { class: 'gd-rarel', for: 'gdRare', text: 'Rarely asked' }), rare,
        el('div', { class: 'gd-card' }, [el('b', { text: 'What must never happen' }), never, el('p', { class: 'gd-invite' }, ['Ask the people most affected to say where the threshold is. ', el('button', { class: 'gd-link u', id: 'gdInvite', onclick: function () { G.ask = 'matters'; G.askPrompt = 'Where is the threshold? What must never happen to the people affected by ' + svc() + '?'; paint(); } }, ['Invite them'])])])])]);
    return { body: [el('p', { class: 'gd-over', text: PARTS[4] }), el('h1', { class: 'gd-qh', id: 'gdQ', text: R().name ? R().name + ' matters to people in two ways' : 'It matters to people in two ways' }), el('p', { class: 'gd-lede', text: 'When it works well, some people gain. When it goes wrong, some people are harmed, often not the same people. Fill in both sides.' }), sugNote, halves],
      askPrompt: G.askPrompt, primary: { text: 'Next', fn: function () { var g1 = good.value.trim(), m1 = meas.value.trim(), r1 = rare.value.trim(), n1 = never.value.trim(); safe(async function () { await saveV(); await saveE(); await gsave(function (x) { var gg = box(x, 'good'); gg.fields.good = g1; gg.fields.measure = m1; box(x, 'exposure').fields.absent = r1; box(x, 'gap').fields.mustnot = n1; }, 'Who it matters to'); advance('matters'); }); } } };
  };

  // ---------- part 6: your first guesses, kept as written ----------
  SCREEN.guesses = function (sc) {
    var g = GD(), mine = (g.guesses || []).filter(function (x) { return x.name === person(); })[0], others = (g.guesses || []).filter(function (x) { return x.name !== person(); });
    var kept = function (label, text, cls) { return el('div', { class: 'gd-gcard' + (cls || '') }, [el('b', { text: label }), el('p', { text: text || 'Not said' })]); };
    var body = [el('p', { class: 'gd-over', text: PARTS[5] }), el('h1', { class: 'gd-qh', id: 'gdQ', text: 'Before anyone looks at the evidence, what’s your hunch?' }), el('p', { class: 'gd-lede', text: 'We keep your guesses exactly as you write them, with today’s date, and look at them again when we test the service. It shows what everyone assumed at the start.' })];
    var w1, w2, w3;
    if (mine) body.push(kept('Where it is most likely to go wrong', mine.wrong), kept('Where it could be better', mine.better), kept('Where it already works well', mine.well, ' well'));
    else {
      w1 = area('gdWrong', '', 3, 'Where it is most likely to go wrong'); w2 = area('gdBetterG', '', 3, 'Where it could be better'); w3 = area('gdWell', '', 2, 'Where it already works well'); w2.removeAttribute('data-autofocus'); w3.removeAttribute('data-autofocus');
      body.push(el('div', { class: 'gd-gcard in' }, [el('label', { for: 'gdWrong', text: 'Where it is most likely to go wrong' }), w1]), el('div', { class: 'gd-gcard in' }, [el('label', { for: 'gdBetterG', text: 'Where it could be better' }), w2]), el('div', { class: 'gd-gcard in well' }, [el('label', { for: 'gdWell', text: 'Where it already works well' }), w3]));
    }
    var joined = G.joined;
    if (joined == null) { G.joined = '…'; X.api({ action: 'p_load' }).then(function (d) { G.joined = d.joined; paint(); }).catch(function () {}); }
    var side = el('aside', { class: 'gd-kept', 'aria-label': 'How they are kept' }, [el('p', { class: 'gd-over', text: 'How they are kept' }),
      el('div', {}, [el('b', { text: 'Recorded' }), el('span', { id: 'gdRecorded', text: mine ? stamp(mine.at) + ', by ' + mine.name : 'With the date and time, and your name, when you record them' })]),
      el('div', {}, [el('b', { text: 'Kept as written' }), el('span', { text: 'Nobody can change them later, including us.' })]),
      el('div', {}, [el('b', { text: 'Looked at again' }), el('span', { text: 'When the service is tested, beside what the evidence shows.' })]),
      el('div', {}, [el('b', { text: 'Colleagues' }), el('span', { id: 'gdColleagues', text: (others.length + (mine ? 1 : 0)) + ' of ' + ((typeof joined === 'number' ? joined : 0) + 1) + ' have added theirs. You see theirs once everyone has answered.' }), el('button', { class: 'gd-link u', id: 'gdAskGuesses', onclick: function () { G.ask = 'guesses'; G.askPrompt = 'Before anyone looks at the evidence: where is ' + svc() + ' most likely to go wrong, where could it be better, and where does it already work well?'; paint(); } }, ['Ask colleagues for theirs'])])]);
    return { body: [el('div', { class: 'gd-gwrap' }, [el('div', {}, body), side])], askPrompt: G.askPrompt, noEnter: true,
      primary: mine ? { text: 'Next: your framing', fn: function () { advance('guesses'); } } : { text: 'Record my guesses', fn: function () {
        var x1 = w1.value.trim(), x2 = w2.value.trim(), x3 = w3.value.trim(); if (!x1 && !x2 && !x3) { G.err = 'Write at least one guess, or choose Not sure.'; return paint(); }
        safe(async function () { var at = new Date().toISOString(); await gsave(function (a, gg) {
          var entry = { name: person(), who: gg.who || 'client', at: at, wrong: x1, better: x2, well: x3 };
          gg.guesses = (gg.guesses || []).concat([entry]);
          var b = box(a, 'guesses'); b.fields.text = (b.fields.text ? b.fields.text + '\n' : '') + stamp(at) + ', ' + entry.name + ': most likely to go wrong: ' + (x1 || 'not said') + '. Could be better: ' + (x2 || 'not said') + '. Already works well: ' + (x3 || 'not said') + '.';
          if (x3) { var v = box(a, 'value'); if (!String(v.fields.works || '').trim()) v.fields.works = x3; }
        }, 'First guesses recorded'); }); } } };
  };
  // ---------- the finish: your framing, on one page ----------
  var PARTSCREENS = { 1: ['describe', 'name', 'within'], 2: ['prompt', 'closest', 'before'], 3: ['inside', 'outside', 'level', 'inputs', 'work', 'outputs', 'shape', 'runs', 'purpose'], 4: ['question', 'decider', 'sides', 'role'], 5: ['matters'], 6: ['guesses'] };
  function partDone(n) {
    var a = A(), r = R(), g = GD(), ns = g.notsure || {}, q = (a.question || {}).fields || {};
    var done = { 1: !!(r.named && (r.standalone || RT().on(r, 'within').length)), 2: !!(F('help', 'why') && (a.help || {}).closest && (a.help.closest.length)), 3: !!r.agreed, 4: !!q.question, 5: !!(((a.value || {}).who || []).length && ((a.exposure || {}).who || []).length && F('gap', 'mustnot')), 6: !!(g.guesses || []).length }[n];
    return done || PARTSCREENS[n].every(function (id) { return ns[id] || ({ 1: 0, 2: 0 }[n] === 0 && false); }) || PARTSCREENS[n].some(function (id) { return ns[id]; }) && PARTSCREENS[n].every(function (id) { return ns[id] || screenAnswered(id); });
  }
  function screenAnswered(id) { var a = A(), r = R(), q = (a.question || {}).fields || {}; return { describe: !!r.desc, name: !!r.named, within: !!(r.standalone || RT().on(r, 'within').length), prompt: !!F('help', 'why'), closest: !!((a.help || {}).closest || []).length, before: !!q.before, inside: !!RT().on(r, 'inside').length, outside: !!RT().on(r, 'outside').length, level: !!r.level, inputs: !!RT().on(r, 'inputs').length, work: !!RT().on(r, 'work').length, outputs: !!RT().on(r, 'outputs').length, shape: !!r.shape, runs: !!((a.requires || {}).runs || []).length, purpose: !!F('service', 'for'), question: !!q.question, decider: !!(q.owner || q.under), sides: !!(q.better || q.notfail), role: !!((a.question || {}).rel || []).length, matters: !!F('gap', 'mustnot'), guesses: !!(GD().guesses || []).length }[id]; }
  SCREEN.framing = function (sc) {
    var a = A(), r = R(), g = GD(), on = RT().on, q = (a.question || {}).fields || {}, form = (a.question || {}).form;
    var ver = (g.sends || []).length + (g.sent && !g.changedSince ? 0 : 1), author = person() + (g.person && g.person.org ? '' : '');
    var sec = function (label, kids, cls) { return el('section', { class: 'fx-sec' + (cls ? ' ' + cls : '') }, [el('h3', { text: label })].concat(kids)); };
    var p = function (t, cls) { return t ? el('p', { class: cls || '', text: t }) : el('p', { class: 'fx-empty', text: 'Not yet answered' }); };
    var steps = (r.steps || []).map(function (x) { return x.n; }); if (!steps.length) steps = on(r, 'work');
    var vw = (a.value || {}).who || [], ew = (a.exposure || {}).who || [], gs = g.guesses || [];
    var allParts = [1, 2, 3, 4, 5, 6].every(partDone), ck = g.shareChecks || {};
    var checkRow = function (id, label, auto) { var okv = auto != null ? auto : !!ck[id]; return el('li', { class: 'fx-ck' + (okv ? ' ok' : '') + (auto != null ? ' auto' : '') }, [auto != null ? el('i', { 'aria-hidden': 'true' }) : el('button', { class: 'fx-tick', 'aria-pressed': String(okv), 'aria-label': label, 'data-ck': id, onclick: function () { safe(function () { return gsave(function (x, gg) { gg.shareChecks = gg.shareChecks || {}; gg.shareChecks[id] = !okv; }); }); } }), el('span', { text: label })]); };
    var doc = el('article', { class: 'fx-doc', id: 'gdFraming' }, [
      el('header', { class: 'fx-head' }, [el('span', { text: 'The framing of your problem' }), el('span', { id: 'fxVersion', text: 'Version ' + Math.max(1, ver) + ' · ' + day(new Date().toISOString()) + ' · ' + author })]),
      el('h1', { text: r.name || 'Not yet named' }), F('service', 'for') ? el('p', { class: 'fx-for', text: 'For ' + lc(F('service', 'for')) }) : null,
      sec('Your question', [el('p', { class: 'fx-q', text: q.question || 'Not yet written' }), p(form === 'decision' ? (q.owner ? 'Decided by ' + lc(q.owner).replace(/^the /, 'the ') + '.' : '') : (q.under ? 'Underneath it: ' + q.under : ''), 'fx-sub')]),
      el('div', { class: 'fx-two' }, [sec('Why now', [p(F('help', 'why'))]), sec('Tried before', [p(q.before)])]),
      sec('How it works', [el('div', { class: 'fx-flow' }, [el('div', {}, [el('b', { text: 'In' }), on(r, 'inputs').join('; ') || 'Not yet answered']), el('div', { class: 'fx-steps' }, [el('b', { text: 'Steps' }), steps.join(' · ') || 'Not yet answered']), el('div', {}, [el('b', { text: 'Out' }), on(r, 'outputs').join('; ') || 'Not yet answered'])]),
        p((on(r, 'inside').length ? 'Controls ' + lc(joinlc(on(r, 'inside'))) + '. ' : '') + (on(r, 'outside').length ? 'Decided elsewhere: ' + lc(joinlc(on(r, 'outside'))) + '.' : ''), 'fx-sub')]),
      sec('Who it matters to', [el('div', { class: 'fx-two' }, [
        el('div', { class: 'fx-half v' }, [el('h4', { text: 'When it works well' }), el('p', { text: (vw.map(function (x) { return x.t; }).join(', ') || 'Not yet answered') + (F('good', 'good') ? '. Working well: ' + lc(F('good', 'good')) : '') })]),
        el('div', { class: 'fx-half e' }, [el('h4', { text: 'When it goes wrong' }), el('p', { text: (ew.map(function (x) { return x.t; }).join(', ') || 'Not yet answered') + (F('gap', 'mustnot') ? '. Must never happen: ' + lc(F('gap', 'mustnot')) : '') })])])]),
      el('div', { class: 'fx-two' }, [
        sec('First guesses', [p(gs.length ? 'Recorded by ' + gs.length + (gs.length === 1 ? ' person' : ' people') + ' on ' + day(gs[0].at) + '. Looked at again when the service is tested.' : '')]),
        sec('Before you share it', [el('ul', { class: 'fx-cks', id: 'fxChecks' }, [checkRow('parts', 'Every part answered, or marked “not sure”', allParts), checkRow('front', 'Would frontline staff recognise these words?'), checkRow('line', 'Have the people most affected said where the threshold is?')])])])]);
    var sent = g.sent;
    var after = [el('p', { class: 'gd-hint', text: 'What happens next: we read it, come back with anything we’d question, and agree with you what evidence to gather first.' })];
    if (sent) after.unshift(el('p', { class: 'gd-msg', id: 'fxSent', text: 'Sent to Viability Thinking on ' + stamp(sent.at) + ' by ' + sent.by + '.' }));
    if (G.share) after.push(el('div', { class: 'gd-askp', id: 'fxShare' }, [el('p', { text: 'Colleagues can read it and add their own first guesses. Send them ' + location.origin + ' and the code you used to sign in.' })]));
    if (G.change) after.push(el('div', { class: 'gd-askp', id: 'fxChange' }, [el('p', { text: 'Which part do you want to change?' })].concat(PARTS.map(function (n, i) { return el('button', { class: 'gd-link u', 'data-part': String(i + 1), onclick: function () { G.change = false; goto(PARTSCREENS[i + 1][0]); } }, [(i + 1) + '. ' + n]); }))));
    return { body: [doc].concat(after), noBack: true, noEnter: true,
      primary: { text: sent && !g.changedSince ? 'Sent' : 'Send to Viability Thinking', off: !!(sent && !g.changedSince), fn: function () { safe(async function () { var at = new Date().toISOString(); await gsave(function (x, gg) { gg.sends = (gg.sends || []).concat([{ at: at, by: person(), who: gg.who || 'client' }]); gg.sent = { at: at, by: person(), version: gg.sends.length }; gg.changedSince = false; }, 'Sent to Viability Thinking: the framing, version ' + ((g.sends || []).length + 1)); G.msg = 'Sent. Thank you.'; }); } },
      extra: [el('button', { class: 'gd-link', id: 'fxShareBtn', onclick: function () { G.share = !G.share; paint(); } }, ['Share with colleagues']), el('button', { class: 'gd-link', id: 'fxPdf', onclick: function () { window.print(); } }, ['Download as PDF']), el('button', { class: 'gd-link', id: 'fxChangeBtn', onclick: function () { G.change = !G.change; paint(); } }, ['Change an answer'])] };
  };
  // the closest reason, as box 8's kind of reason (the six-cell grid): only where it maps plainly
  function kindOf(p) {
    if (p.indexOf('wrong') >= 0) return { main: 'harm.here', second: p.indexOf('changing') >= 0 ? 'harm.date' : undefined };
    if (p.indexOf('might') >= 0) return { main: 'harm.might' };
    if (p.indexOf('improve') >= 0) return { main: 'want.here' };
    if (p.indexOf('changing') >= 0) return { main: 'harm.date' };
    if (p.indexOf('decision') >= 0) return { main: 'want.date' };
    return null;
  }

  // the route's own screens (parts 1 and 3), restyled: the question large, plain rows, its own button
  ['describe', 'clarify', 'name', 'within', 'inside', 'outside', 'level', 'inputs', 'work', 'outputs', 'shape'].forEach(function (id) {
    SCREEN[id] = function (sc) {
      var s = RT().screen(id), body = s.body.slice(0);
      if (id === 'describe') body = [body[0], GD().prefill && GD().prefill.describe && !R().desc ? suggestedFrom(true) : null];
      if (id === 'describe' && !R().desc && GD().prefill && GD().prefill.describe) body[0].value = GD().prefill.describe;
      var p = s.primary;
      if (id === 'shape') p = { text: 'Next', off: !R().shape, fn: function () { advance('shape'); } };
      if (id === 'within' || id === 'inside' || id === 'outside') body.unshift(aiOn() && sourceNames().length ? suggestedFrom(true) : null);
      return { two: true, body: qHead(sc.part === 1 ? PARTS[0] : PARTS[2], s.q, [s.test, s.help].filter(Boolean).join(' '), body), primary: p, whyText: s.why, hint: s.hint };
    };
  });

  // ---------- sources: added from the second screen, or "Add a source" at the top of any screen ----------
  async function addSource(body) { var d = await X.api(Object.assign({ action: 's_add' }, body)); S.data.sources = (S.data.sources || []).concat([d.source]); G.msg = 'Added: ' + (d.source.title || ''); return d.source; }
  function addFiles(list, kind) {
    var files = Array.prototype.slice.call(list || []);
    safe(async function () {
      for (var i = 0; i < files.length; i++) {
        var f = files[i], ext = (f.name.split('.').pop() || '').toLowerCase();
        if (/^image\//.test(f.type)) { var url = await new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(f); }); await addSource({ kind: 'image', title: 'Notes (photo): ' + f.name, file_name: f.name, body: url }); continue; }
        var txt = '';
        try { txt = await X.readFileText(f); } catch (e) { txt = ''; }
        if (!txt.trim()) txt = 'The file ' + f.name + ' is kept for the team; its words could not be read here.';
        await addSource({ kind: kind === 'notes' ? 'notes' : 'document', title: f.name, file_name: f.name, body: txt.slice(0, 380000) });
      }
    });
  }
  // with reading switched on, later screens start from what was shared, and say so
  async function prefill() {
    if (!aiOn() || !sourcesText()) return;
    try { var o = await X.api({ action: 'ai_define', stage: 'prefill', name: '', desc: '', context: sourcesText() }); await gsave(function (a, g) { g.prefill = { describe: o.describe || '', prompt: o.prompt || '', before: o.before || '', from: sourceNames() }; }, 'Read what was shared'); } catch (e) { /* the screens start blank */ }
  }

  // ---------- the 2-minute example: the drive to Milton Keynes Central ----------
  function example() {
    var close = function () { G.ex = false; paint(); };
    return el('div', { class: 'gd-ov', id: 'gdExampleBox', onclick: function (e) { if (e.target.id === 'gdExampleBox') close(); } }, [el('div', { class: 'gd-dlg', role: 'dialog', 'aria-label': 'A 2-minute example' }, [
      el('p', { class: 'gd-over', text: 'A 2-minute example (illustrative)' }), el('h2', { text: 'Getting from a village outside Milton Keynes to Milton Keynes Central for the London train' }),
      el('dl', { class: 'gd-exdl' }, [
        el('dt', { text: 'What’s prompting this' }), el('dd', { text: 'An early meeting in London next week, and the last two trips were tight.' }),
        el('dt', { text: 'How it works' }), el('dd', { text: 'In: you, the car, the timetable. Steps: leave, drive the main route, park, walk to the platform. Out: on the train, on time. Decided elsewhere: roadworks, the train company’s timetable, the car park.' }),
        el('dt', { text: 'Your question' }), el('dd', { text: 'When do I need to leave to be sure of the train, and what would I do if the main route is closed?' }),
        el('dt', { text: 'When it works well, and when it goes wrong' }), el('dd', { text: 'Working well: on the platform with ten minutes to spare. Must never happen: missing the meeting.' }),
        el('dt', { text: 'First guesses' }), el('dd', { text: 'Most likely to go wrong: roadworks or a crash on the main route. Already works well: leaving ten minutes earlier and going straight to the overflow car park.' })]),
      el('p', { class: 'gd-hint', text: 'The same six parts, for a small question. Yours will take about 30 minutes.' }),
      el('button', { class: 'gd-btn', id: 'gdExampleClose', onclick: close }, ['Back to the start'])])]);
  }

  // ---------- keyboard: Enter continues, number keys tick ----------
  document.addEventListener('keydown', function (e) {
    if (!HOST || !document.body.contains(HOST) || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, typing = t && (/TEXTAREA|SELECT/.test(t.tagName) || (t.tagName === 'INPUT' && !/checkbox|radio/.test(t.type)) || t.isContentEditable);
    if (e.key === 'Enter' && !typing && !(t && /BUTTON|A|SUMMARY/.test(t.tagName))) { var b = document.getElementById('gdNext'); if (b && !b.disabled) { e.preventDefault(); b.click(); } return; }
    if (/^[1-9]$/.test(e.key) && !typing) { var boxes = HOST.querySelectorAll('#gdCol input[type=checkbox], #gdCol input[type=radio]'), c = boxes[+e.key - 1]; if (c) { e.preventDefault(); c.click(); } }
  });

  function css() {
    if (document.getElementById('gdCss')) return;
    var s = document.createElement('style'); s.id = 'gdCss';
    s.textContent = [
      'html:has(body.gd-on),body.gd-on{background:#FAF9F7 !important}body.gd-on header.top,body.gd-on #subtabs,body.gd-on .exband{display:none}body.gd-on main{max-width:none;padding:0 0 60px}',
      '.gd{--ground:#FAF9F7;--raised:#FFFFFF;--tone:#F1EFEA;--tone2:#E9E6DF;--ink:#15171A;--ink2:#3A3F46;--muted:#5B616B;--faint:#8A8F97;--rule:#DEDAD2;--value:#1E6FD9;--value-text:#1E5BB0;--value-tint:#EAF2FD;--expo:#E8590C;--expo-text:#9A3B08;--expo-tint:#FDEFE6;--ok:#1F7A4D;--serif:Newsreader,Georgia,"Times New Roman",serif;--sans:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--ground);color:var(--ink);font-family:var(--sans);font-size:15.5px;line-height:1.55;max-width:1240px;margin:0 auto;padding:18px max(16px,3vw) 48px}',
      '.gd-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-bottom:26px}.gd-brand{color:var(--ink)}.gd-svc{flex:1 1 140px;min-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gd-where{margin-left:auto}',
      '.gd-saved{display:inline-flex;align-items:center;gap:6px;color:var(--ok);font-weight:600}.gd-saved i{width:7px;height:7px;border-radius:99px;background:var(--ok)}.gd-saved.fresh{opacity:1}',
      '.gd-who{display:inline-flex;background:var(--tone);border-radius:99px;padding:3px}.gd-who button{font:inherit;font-size:12.5px;border:0;background:transparent;color:var(--muted);border-radius:99px;padding:5px 11px;cursor:pointer}.gd-who button.on{background:var(--ink);color:#fff}',
      '.gd-chip{font:inherit;font-size:12.5px;border:0;background:var(--tone);color:var(--ink2);border-radius:99px;padding:5px 11px;cursor:pointer}.gd-quietlink{font-size:12.5px;color:var(--muted)}.gd-hdr{display:flex;align-items:center;gap:18px;padding:0 0 12px;margin:0 0 14px;border-bottom:1px solid var(--rule);font-size:13px;color:var(--muted)}.gd-lablogo{font-weight:700;font-size:14px;color:var(--ink);text-decoration:none;white-space:nowrap}.gd-lablogo span{color:#D9480F;font-size:9.5px;letter-spacing:2px;margin-left:6px}.gd-labtabs{display:flex;gap:2px;min-width:0;overflow-x:auto;scrollbar-width:none}.gd-labtabs a{color:var(--muted);text-decoration:none;padding:4px 10px;border-radius:99px;white-space:nowrap}.gd-labtabs a:hover{color:var(--ink)}.gd-labtabs a.on{color:var(--ink);background:var(--tone)}.gd-labme{margin-left:auto;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}@media (max-width:760px){.gd-labname{display:none}.gd-hdr{gap:10px}}.gd-av{width:26px;height:26px;border-radius:99px;background:var(--tone2,#E6E2DA);display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;color:var(--ink2);flex:none}.gd-out{color:var(--ink);font-weight:600;font-size:13px;text-decoration:none;white-space:nowrap;border:1px solid var(--rule);border-radius:99px;padding:6px 12px;background:var(--raised)}.gd-out:hover{border-color:var(--ink)}.gd-out:focus-visible{outline:2px solid var(--ink);outline-offset:2px}@media (max-width:1380px){.gd-mins{display:none}}@media (max-width:640px){.gd-out{width:100%;text-align:center}}',
      '.gd-journey{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:0 0 30px}.gd-journey span{font-size:12.5px;color:var(--faint);padding:5px 10px;border-radius:99px;background:var(--tone)}.gd-journey span.done{color:var(--ink2)}.gd-journey span.now{background:var(--ink);color:#fff}',
      '.gd-body{display:block}.gd-body.two{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:56px;align-items:start}.gd-body.narrow .gd-col{max-width:760px;margin:0 auto}',
      '.gd-over{font-size:12px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);margin:0 0 14px}',
      '.gd-qh{font-family:var(--serif);font-weight:400;font-size:36px;line-height:1.18;margin:0 0 10px;text-wrap:balance}.gd-qh.big{font-size:46px}',
      '.gd-lede{color:var(--ink2);font-size:16.5px;margin:0 0 22px;max-width:58ch}.gd-hint{font-size:13px;color:var(--muted);margin:6px 0 10px}.gd-hint a{color:var(--ink);text-underline-offset:3px}body.gd-on input.gd-input,body.gd-on textarea.gd-input{background:var(--raised);color:var(--ink)}body.gd-on textarea:focus,body.gd-on input:focus,body.gd-on select:focus{border-color:var(--ink);box-shadow:0 0 0 3px rgba(21,23,26,.10)}',
      '.gd-area{width:100%;box-sizing:border-box;font-family:var(--serif);font-size:20px;line-height:1.5;color:var(--ink);background:var(--raised);border:1px solid var(--rule);border-radius:14px;padding:14px 16px;resize:vertical}.gd-area:focus,.gd-input:focus{outline:2px solid var(--ink);outline-offset:1px}',
      '.gd-input{font:inherit;font-size:16px;padding:11px 13px;border:1px solid var(--rule);border-radius:10px;background:var(--raised);color:var(--ink);width:100%;box-sizing:border-box}',
      '.gd-fields{display:grid;gap:8px;max-width:520px;margin:0 0 10px}.gd-fields label{font-size:13px;color:var(--muted);margin-top:8px}',
      '.gd-rows{display:flex;flex-direction:column;gap:2px;margin:0 0 6px}.gd-row{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:12px;cursor:pointer}.gd-row:hover{background:var(--tone)}.gd-row small{display:block;font-size:12.5px;color:var(--faint)}.gd-rt{flex:1}',
      '.gd input[type=radio]{-webkit-appearance:none;appearance:none;flex:none;width:22px;height:22px;margin:0;border-radius:99px;background:var(--tone2);display:inline-grid;place-content:center;cursor:pointer}.gd input[type=radio]:checked{background:var(--ink)}.gd input[type=radio]:checked::after{content:"";width:8px;height:8px;border-radius:99px;background:#fff}',
      '.gd-relies{margin-top:12px}.gd-nl2{display:block;font-size:11px;color:var(--muted);margin-bottom:4px}.gd-qh.sm{font-size:24px;margin-top:22px}.gd-sel{font:inherit;font-size:13px;border:0;background:var(--tone);border-radius:8px;padding:5px 8px;color:var(--ink2)}.gd-row.run{gap:10px}.gd-rl{display:flex;align-items:center;gap:14px;flex:1;cursor:pointer}.gd-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 4px}.gd-chips .gd-hint{width:100%;margin:0}',
      '.gd-voice{font-family:var(--serif);font-style:italic;color:var(--muted);font-size:18px;margin:0 0 8px}.gd-para{font-family:var(--serif);font-size:25px;line-height:1.6;margin:0 0 10px}.gd-para.sm{font-size:19px}',
      '.gd .gd-w{display:inline;-webkit-box-decoration-break:clone;box-decoration-break:clone;width:auto;font:inherit;color:inherit;background:none;border:0;padding:0;white-space:normal;border-bottom:1.5px dotted var(--faint);cursor:pointer;text-align:left}.gd-w.open{background:var(--tone);border-radius:4px;border-bottom-color:var(--ink)}',
      '.gd-pop{background:var(--ink);color:#fff;border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.45;max-width:420px;box-shadow:0 14px 30px rgba(0,0,0,.25);margin:4px 0 14px;display:flex;flex-direction:column;gap:2px}.gd-mt{margin:0 0 4px;font-weight:600}.gd-mo{font:inherit;color:#fff;opacity:.85;background:none;border:0;text-align:left;padding:3px 0;cursor:pointer}.gd-mo:hover{opacity:1;text-decoration:underline}.gd-mrow{display:flex;gap:8px;margin-top:4px}.gd-mi{flex:1;font:inherit;font-size:13.5px;border:0;border-radius:8px;padding:6px 8px;background:#2A2E35;color:#fff}',
      '.gd-tidy{background:var(--tone);border-radius:14px;padding:12px 16px;margin:8px 0}',
      '.gd-qv{font-family:var(--serif);font-size:16.5px;color:var(--ink2)}.gd-hints{margin-top:8px}.gd-hintl{margin:4px 0;font-size:13.5px;color:var(--ink2)}.gd-hintl.ok{color:var(--muted)}.gd-lab{display:block;font-size:13px;color:var(--muted);margin:12px 0 6px}',
      '.gd-halves{display:grid;grid-template-columns:1fr 1fr;gap:18px}.gd-half{border-radius:22px;padding:24px}.gd-half.v{background:var(--value-tint)}.gd-half.e{background:var(--expo-tint)}.gd-half h2{font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin:0 0 4px}.gd-half.v h2{color:var(--value-text)}.gd-half.e h2{color:var(--expo-text)}.gd-hq{font-family:var(--serif);font-size:22px;line-height:1.3;margin:0 0 14px}',
      '.gd-whol{display:flex;flex-direction:column;margin-bottom:14px}.gd-mrow2{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)}.gd-mn{flex:1;min-width:0}.gd-mrow2.add{border:0}.gd .gd-addin{flex:1;font:inherit;font-size:14.5px;border:0;border-bottom:1.5px dashed var(--faint);border-radius:0;box-shadow:none;background:transparent;padding:6px 0}',
      '.gd-dots{display:flex;gap:3px}.gd .gd-dot{flex:none;width:13px;min-width:0;height:13px;border-radius:99px;border:0;padding:0;background:rgba(0,0,0,.12);cursor:pointer}.gd-half.v .gd-dot.on{background:var(--value)}.gd-half.e .gd-dot.on{background:var(--expo)}',
      '.gd-alt{font:inherit;font-size:12.5px;color:var(--muted);background:none;border:0;cursor:pointer;min-width:120px;text-align:right}.gd-rarel{display:block;font-size:13px;color:var(--expo-text);margin:4px 0}.gd .gd-rare{border-radius:0;box-shadow:none;width:100%;box-sizing:border-box;font:inherit;font-size:14px;color:var(--expo-text);background:transparent;border:0;border-bottom:1px dashed rgba(154,59,8,.4);resize:vertical;margin-bottom:12px}',
      '.gd-card{background:var(--raised);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}.gd-card b{font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted)}.gd-card .gd-area{font-size:18px;border:0;padding:0;background:transparent}.gd-card .gd-input{border:0;border-bottom:1px solid var(--rule);border-radius:0;padding:4px 0;font-size:14px}.gd-invite{margin:0;font-size:13px;color:var(--muted)}.gd-link.u{text-decoration:underline;font-size:13px}.gd-half.e .gd-link.u{color:var(--expo-text)}',
      '.gd-gwrap{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:56px;align-items:start}.gd-gcard{background:var(--raised);border-radius:18px;padding:18px 22px;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,.04)}.gd-gcard b,.gd-gcard label{display:block;font-size:12px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);margin-bottom:6px}.gd-gcard p{margin:0;font-family:var(--serif);font-size:19px}.gd-gcard .gd-area{border:0;padding:0;background:transparent;font-size:19px}.gd-gcard.well{background:var(--value-tint)}.gd-gcard.well b,.gd-gcard.well label{color:var(--value-text)}',
      '.gd-kept{border-left:1.5px solid var(--rule);padding-left:28px;margin-top:56px;display:flex;flex-direction:column;gap:0}.gd-kept>div{padding:12px 0;border-bottom:1px solid var(--rule);display:flex;flex-direction:column;gap:2px;font-size:14px;color:var(--ink2)}.gd-kept>div:last-child{border:0}.gd-kept b{color:var(--ink);font-size:14px}',
      '@media (max-width:900px){.gd-halves,.gd-gwrap{grid-template-columns:1fr}.gd-kept{margin-top:0}}',
      '.fx-doc{background:#fff;border-radius:6px;box-shadow:0 20px 50px rgba(0,0,0,.08);padding:48px 52px;max-width:880px;margin:0 auto}.fx-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);padding-bottom:12px;border-bottom:1px solid var(--rule);margin-bottom:28px}',
      '.fx-doc h1{font-family:var(--serif);font-weight:400;font-size:40px;line-height:1.15;margin:0 0 6px}.fx-for{margin:0 0 22px;color:var(--ink2)}.fx-sec{margin:0 0 20px}.fx-sec h3{font-size:11.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin:0 0 8px}.fx-sec p{margin:0 0 6px;font-size:14.5px;color:var(--ink2)}.fx-q{font-family:var(--serif);font-size:20px !important;color:var(--ink) !important}.fx-sub{font-size:14px}.fx-empty{color:var(--faint) !important;font-style:italic}',
      '.gd-col:has(#gdFraming)>*:not(.fx-doc){max-width:880px;margin-left:auto;margin-right:auto}.gd-col:has(#gdFraming)>.gd-actions{display:flex}.fx-two{display:grid;grid-template-columns:1fr 1fr;gap:24px}.fx-flow{display:grid;grid-template-columns:1fr 1.6fr 1fr;gap:8px;margin-bottom:8px}.fx-flow>div{background:var(--tone);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--ink2)}.fx-flow b{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted)}',
      '.fx-half{border-radius:12px;padding:14px 16px}.fx-half.v{background:var(--value-tint)}.fx-half.e{background:var(--expo-tint)}.fx-half h4{margin:0 0 4px;font-size:11.5px;letter-spacing:1.4px;text-transform:uppercase}.fx-half.v h4{color:var(--value-text)}.fx-half.e h4{color:var(--expo-text)}.fx-half p{margin:0;font-size:13.5px}',
      '.fx-cks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.fx-ck{display:flex;gap:10px;align-items:center;font-size:14px;color:var(--ink2)}.fx-ck i{width:16px;height:16px;border-radius:99px;background:var(--tone2);flex:none}.fx-ck.auto.ok i{background:var(--ok)}.fx-tick{width:18px;height:18px;border-radius:6px;border:0;background:var(--tone2);cursor:pointer;flex:none;padding:0}.fx-ck.ok .fx-tick{background:var(--ink)}',
      '@media (max-width:760px){.fx-doc{padding:28px 20px}.fx-two,.fx-flow{grid-template-columns:1fr}}',
      '@media print{body.gd-on .gd-bar,body.gd-on .gd-journey,body.gd-on .gd-actions,body.gd-on .gd-hint,body.gd-on .gd-msg,body.gd-on .gd-askp{display:none !important}.fx-doc{box-shadow:none;padding:0;max-width:none}html:has(body.gd-on),body.gd-on{background:#fff !important}}',
      '.gd-stages{font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 24px}.gd-stages b{color:var(--ink);font-weight:600;margin-right:4px}',
      '.gd-actions{display:flex;align-items:center;gap:18px;margin-top:28px;flex-wrap:wrap}',
      '.gd-btn{background:var(--ink);color:#fff;border:0;font:inherit;font-weight:600;font-size:15.5px;border-radius:99px;padding:14px 28px;cursor:pointer;box-shadow:0 8px 22px rgba(21,23,26,.16)}.gd-btn:disabled{opacity:.45;cursor:default}.gd-btn.sm{padding:9px 18px;font-size:14px;box-shadow:none}',
      '.gd-link{background:none;border:0;font:inherit;color:var(--muted);cursor:pointer;padding:0}.gd-link:hover{color:var(--ink)}.gd-link.sm{font-size:13px;text-decoration:underline}.gd-kbd{font-size:12px;color:var(--faint)}',
      '.gd-quiet{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;font-size:13.5px;color:var(--muted);margin-top:26px}.gd-q,.gd-why summary{background:none;border:0;font:inherit;color:var(--muted);cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--rule)}.gd-why summary{list-style:none}.gd-why summary::-webkit-details-marker{display:none}.gd-why p{margin:8px 0 0;max-width:48ch;color:var(--ink2)}',
      '.gd-ns{font-size:13px;color:var(--ink2);margin:20px 0 -12px}',
      '.gd-msg{font-size:13.5px;color:var(--muted);margin:12px 0 0}.gd-msg.bad{color:#9A3B08}',
      '.gd-askp{margin-top:16px;background:var(--tone);border-radius:16px;padding:16px 18px;font-size:14px;color:var(--ink2);display:flex;flex-direction:column;gap:10px;align-items:flex-start}.gd-side-by-side{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;width:100%}.gd-ans{margin:0;background:var(--raised);border-radius:12px;padding:10px 12px;font-family:var(--serif);font-size:16px}',
      // the framing panel
      '.gd-side{position:sticky;top:18px}.gd-viewbtn{display:none}',
      '.gd-fr-title{font-size:12px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--faint);margin:0 0 12px}',
      '.gd-why-now{margin:0 0 14px;font-size:13px;color:var(--muted);background:var(--tone);border-radius:14px;padding:10px 12px}.gd-why-now span{display:block;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:3px}',
      '.gd-nest{position:relative;border-radius:28px;background:var(--tone);padding:44px 18px 18px}.gd-nest.empty{padding:60px 24px;text-align:center;color:var(--faint);font-family:var(--serif);font-size:19px}.gd-nest.empty p{margin:0}',
      '.gd-nest>.gd-nl{position:absolute;top:16px;left:22px;font-size:12px;color:var(--muted)}',
      '.gd-mid{border-radius:22px;background:var(--tone2);padding:40px 16px 16px;position:relative;display:flex;flex-direction:column;gap:12px}.gd-mid>.gd-nl{position:absolute;top:14px;left:18px;font-size:12px;color:var(--muted)}',
      '.gd-core{background:var(--raised);border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.07)}.gd-lbl{font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}.gd-core h3{font-family:var(--serif);font-weight:400;font-size:21px;line-height:1.25;margin:6px 0 10px}.gd-for{font-size:12.5px;color:var(--muted);margin:-4px 0 10px}',
      '.gd-items{display:flex;flex-wrap:wrap;gap:6px}.gd-it{font-size:12.5px;background:var(--tone);border-radius:8px;padding:4px 9px;color:var(--ink2)}.gd-it.raised{background:var(--raised)}.gd-it.more{background:transparent;color:var(--faint)}',
      '.gd-it.arrive{background:var(--ink);color:#fff;animation:gdArrive 1.6s ease-out 1}@keyframes gdArrive{0%{transform:translate(-80px,30px) scale(.9);opacity:0}35%{opacity:1}60%{transform:none}100%{transform:none}}@media (prefers-reduced-motion: reduce){.gd-it.arrive{animation:none}}',
      '.gd-flow{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12px;color:var(--muted)}.gd-flow.ghost{opacity:.42}.gd-box{background:var(--tone);border-radius:8px;padding:5px 8px}.gd-steps{display:flex;gap:3px}.gd-steps i{display:block;width:16px;height:22px;border-radius:5px;background:var(--ink)}.gd-flow.ghost .gd-steps i{background:var(--faint)}.gd-later{margin-left:6px}',
      // opener
      '.gd-opener .gd-num{font-family:var(--serif);font-size:96px;line-height:1;color:var(--tone2);margin:0 0 6px}.gd-opener h1{font-family:var(--serif);font-weight:400;font-size:52px;line-height:1.08;margin:0 0 16px}.gd-what{font-size:19px;color:var(--ink2);max-width:52ch;margin:0 0 30px}',
      '.gd-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;padding:22px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}.gd-facts b{display:block;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:var(--faint);font-weight:600;margin-bottom:4px}',
      // sources
      '.gd-srcs{display:flex;flex-direction:column;gap:6px;margin:0 0 14px}.gd-src{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border-radius:14px}.gd-src:hover{background:var(--tone)}.gd-src small{color:var(--faint);font-size:13px}.gd-inl{display:flex;gap:14px;align-items:center}.gd-files{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.gd-file{font-size:12.5px;background:var(--tone);border-radius:8px;padding:4px 9px}',
      // example
      '.gd-ov{position:fixed;inset:0;background:rgba(21,23,26,.35);display:flex;align-items:center;justify-content:center;z-index:90;padding:16px}.gd-dlg{background:var(--raised);border-radius:20px;padding:28px 30px;max-width:640px;max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.25)}.gd-dlg h2{font-family:var(--serif);font-weight:400;font-size:28px;margin:0 0 14px}.gd-exdl dt{font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);margin-top:12px}.gd-exdl dd{margin:2px 0 0;font-family:var(--serif);font-size:17px}',
      '@media (max-width:900px){.gd-body.two{grid-template-columns:1fr;gap:20px}.gd-side{display:none;position:static}.gd-side.open{display:block}.gd-viewbtn{display:inline-block;font:inherit;font-size:14px;border:1px solid var(--rule);background:var(--raised);border-radius:99px;padding:8px 16px;justify-self:start}.gd-where{margin-left:0}.gd-facts{grid-template-columns:1fr}.gd-qh{font-size:30px}}',
      '@media print{.gd-bar,.gd-journey,.gd-quiet,.gd-actions,.gd-viewbtn{display:none}}'].join('');
    document.head.appendChild(s);
  }
  function init(x) { X = x; el = x.el; S = x.S; }
  function finished() { var g = GD(); return !!g.sent; }
  var LABELS = { describe: 'what you’re working on', name: 'its name', within: 'what it is part of', prompt: 'what’s prompting this', closest: 'the closest reason', before: 'what has been tried before', inside: 'what it controls', outside: 'what is decided elsewhere', level: 'the level to work at', inputs: 'what comes in', work: 'what it does', outputs: 'what comes out', shape: 'steps or parts', runs: 'what it runs on', purpose: 'what it is for', question: 'the question', decider: 'who decides', sides: 'better and not failing', role: 'what the question is for', matters: 'who it matters to', guesses: 'first guesses' };
  window.VTGuide = { label: function (id) { return LABELS[id] || id; }, init: init, progress: function () { return progress(); }, render: render, leave: leave, finished: finished, FLOW: FLOW, has: function (id) { return !!SCREEN[id] || idx(id) > 0 || id === 'welcome'; } };
})();
