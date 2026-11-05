// Frame, part 3, before the line is drawn (1 November 2026): who is exposed, and how exposed they are.
// Restores the old Lab's Move 8 (stake and standing: the party list, placements kept apart then revealed, the
// exposed and load-bearing cells, the six absence cells, who decides) and Move 9 (the dependants' profile: what the
// loss costs them per capital, somewhere else to go, whether it can be put back, segments, shared roots, the order
// rule ranked by the worst-off segment, omissions) as two pages in front of the line. Reads and saves the tile
// "stake". Placements are entered by the team for each person (each person places alone; nothing is shown until
// the reveal); entry on people's own phones is to come with the shared board.
(function () {
  'use strict';
  var X, el, S, ST = { placer: null, open: null };
  var LEVELS = [['exec', 'Executive'], ['manager', 'Manager'], ['front', 'Front line'], ['outside', 'Outside']];
  var HML = [['', '–'], ['high', 'High'], ['med', 'Medium'], ['low', 'Low']];
  var YN = [['', '–'], ['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not known']];
  var STAND = [['standing', 'Present, with standing'], ['present', 'Present, without standing'], ['notinvited', 'Identified, not invited'], ['unidentified', 'Not identified until late']];
  var SIDE = [['exposure', 'Exposed if it fails'], ['value', 'Gains when it works'], ['both', 'Both']];
  var RLEV = [['', 'Not known'], ['none', 'None'], ['few', 'A few'], ['many', 'Many']];
  var NKIND = [['', 'Not known'], ['other', 'Another way'], ['defer', 'Can put it off'], ['without', 'Can go without'], ['none', 'None']];
  var IKIND = [['', '–'], ['time', 'Comes back in time'], ['cost', 'Comes back at a cost'], ['never', 'Never comes back']];
  var EVQ = [['', 'Not graded'], ['strong', 'Strong'], ['some', 'Some'], ['thin', 'Thin'], ['none', 'None yet']];
  var FALLBACK = /\bfall[\s-]?backs?\b/i;

  var data = function () { var r = X.row('stake'); return JSON.parse(JSON.stringify((r && r.content) || {})); };
  var ro = function () { return !!S.readonly; };
  var lab = function (L, v) { var x = L.filter(function (y) { return y[0] === v; })[0]; return x ? x[1] : ''; };
  var nid = function (p, list) { var n = 1; while (list.some(function (x) { return x.id === p + n; })) n++; return p + n; };
  var q = Promise.resolve();
  function save(fn, why) {
    var run = q.then(async function () { var c = data(); fn(c); await X.saveRow('stake', c, 'partly'); });
    q = run.catch(function () {});
    return run.then(function () { var s = document.getElementById('fxSave'); if (s) { s.className = 'fxsave ok'; s.textContent = '✓ All changes saved'; } }, function (e) { var s = document.getElementById('fxSave'); if (s) { s.className = 'fxsave bad'; s.textContent = 'Not saved: ' + (e.message || e) + '. Your text is still on the page.'; } throw e; });
  }
  function sel(list, v, on, aria) { var s = el('select', { disabled: ro(), 'aria-label': aria || '' }, list.map(function (o) { return el('option', { value: o[0], text: o[1] }); })); s.value = v || ''; s.addEventListener('change', function () { on(s.value); }); return s; }
  function txt(v, on, ph, aria) { var t = el('input', { type: 'text', value: v || '', placeholder: ph || '', disabled: ro(), 'aria-label': aria || ph || '' }); t.addEventListener('change', function () { on(t.value.trim()); }); return t; }
  function area(v, on, ph, aria) { var t = el('textarea', { rows: 2, placeholder: ph || '', disabled: ro(), 'aria-label': aria || ph || '' }); t.value = v || ''; t.addEventListener('change', function () { on(t.value.trim()); }); return t; }

  // ---------- the three pages of part 3 ----------
  function strip(cur) {
    // replaced by the task row (1.3.1 to 1.3.6) under the path, 3 November 2026
    if (cur) return document.createDocumentFragment();
    var ex = (X.EXAMPLE ? location.search : '');
    var P = [['stake', '3a', 'Who is exposed', '#stake'], ['exposure', '3b', 'How exposed they are', '#exposure'], ['line', '3c', 'Where the threshold is', '#line']];
    return el('nav', { class: 'skstrip', 'aria-label': 'Thresholds, in three parts' }, P.map(function (p) { return el('a', { href: ex + p[3], class: p[0] === cur ? 'on' : '', 'aria-current': p[0] === cur ? 'page' : null }, [el('b', { text: p[1] }), document.createTextNode(' ' + p[2])]); }));
  }

  // ---------- the stakeholder map: who is exposed ----------
  function cellsOf(c) {
    var ps = c.parties || [], placers = (c.placers || []).filter(function (p) { return p.done; }), useP = c.revealed && placers.length >= 3;
    return ps.map(function (p) {
      var votes = { stake: {}, stop: {}, contrib: {} };
      if (useP) placers.forEach(function (pl) { var x = ((pl.p || {})[p.id]) || {}; ['stake', 'stop', 'contrib'].forEach(function (k) { if (x[k]) votes[k][x[k]] = (votes[k][x[k]] || 0) + 1; }); });
      var share = function (k, v) { var n = 0, t = 0; Object.keys(votes[k]).forEach(function (a) { t += votes[k][a]; if (a === v) n += votes[k][a]; }); return t ? n / t : null; };
      var val = function (k, v) { if (!useP) return p[k] === v ? 1 : 0; var s = share(k, v); return s == null ? (p[k] === v ? 1 : 0) : s; };
      var exposed = Math.min(val('stake', 'high'), val('stop', 'no')), lb = Math.min(val('contrib', 'high'), val('stop', 'no'));
      var spread = function (k) { var keys = Object.keys(votes[k]).filter(function (a) { return a !== 'unknown'; }); var order = { high: 2, med: 1, low: 0, yes: 1, no: 0 }; var vs = keys.map(function (a) { return order[a]; }); return vs.length ? Math.max.apply(null, vs) - Math.min.apply(null, vs) : 0; };
      var levels = {}; if (useP) placers.forEach(function (pl) { var x = ((pl.p || {})[p.id]) || {}; if (x.stake || x.stop) { (levels[pl.level] = levels[pl.level] || []).push((x.stake || '') + '/' + (x.stop || '')); } });
      var mode = function (arr) { var n = {}; arr.forEach(function (a) { n[a] = (n[a] || 0) + 1; }); return Object.keys(n).sort(function (a, b) { return n[b] - n[a]; })[0]; }, modes = Object.keys(levels).map(function (l) { return mode(levels[l]); });
      return { p: p, votes: votes, exposed: exposed > 0.5, exposedC: exposed >= 1 / 3 && exposed <= 0.5, lb: lb > 0.5, lbC: lb >= 1 / 3 && lb <= 0.5, spreadStake: Math.max(spread('stake'), spread('contrib')), levelsDiffer: modes.length > 1 && modes.some(function (m) { return m !== modes[0]; }), unanimous: useP && ['stake', 'stop', 'contrib'].every(function (k) { return Object.keys(votes[k]).length <= 1; }), levels: levels, useP: useP };
    });
  }
  function renderWho(main) {
    var c = data(), ps = c.parties = c.parties || [], placers = c.placers = c.placers || [], cells = cellsOf(c);
    var wrap = el('div', { class: 'fx sk', id: 'skWho' }); main.appendChild(wrap);
    wrap.appendChild(X.fxPath('line', 'Who is exposed'));
    wrap.appendChild(strip('stake'));
    var nExp = cells.filter(function (x) { return x.exposed; }).length, nLb = cells.filter(function (x) { return x.lb; }).length;
    wrap.appendChild(X.fxTitle('Who is exposed', 'Before anyone sets a threshold, list everyone with a stake: who gains, who is exposed if it fails, who can start or stop it, and who holds it together. The people listed here are the people whose threshold is set first.', [el('b', { text: ps.length + (ps.length === 1 ? ' party' : ' parties') + ' · ' + nExp + ' exposed · ' + nLb + ' load-bearing' })], 'line'));
    // the parties
    var sec = el('section', { class: 'fxcard', id: 'skParties' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Everyone with a stake' }), el('span', { class: 'fxgrow' })]),
      el('p', { class: 'fxmuted', text: 'Roles and groups, never names. Include those who cannot leave and those nobody would think to invite. Rate each from what the team knows; where people place them on their own (below), the placements decide.' })]);
    var tb = el('tbody');
    ps.forEach(function (p, i) {
      var upd = function (k) { return function (v) { save(function (d) { var x = (d.parties || []).filter(function (y) { return y.id === p.id; })[0]; if (x) x[k] = v; }, 'party'); }; };
      var caps = el('div', { class: 'skcaps' }, X.LCAPS.map(function (cp) { var b = el('input', { type: 'checkbox', checked: (p.caps || []).indexOf(cp[0]) >= 0, disabled: ro(), 'aria-label': cp[1] }); b.addEventListener('change', function () { save(function (d) { var x = (d.parties || []).filter(function (y) { return y.id === p.id; })[0]; if (!x) return; x.caps = (x.caps || []).filter(function (k) { return k !== cp[0]; }); if (b.checked) x.caps.push(cp[0]); }, 'capitals'); }); return el('label', { title: cp[1] }, [b, el('span', { text: cp[1].split(',')[0] })]); }));
      tb.appendChild(el('tr', { 'data-party': p.id }, [
        el('td', {}, [txt(p.n, upd('n'), 'Role or group', 'Role or group'), sel([['inside', 'Inside'], ['outside', 'Outside']], p.where || 'inside', upd('where'), 'Inside or outside the organisation')]),
        el('td', {}, [sel(HML, p.stake, upd('stake'), 'Stake')]), el('td', {}, [sel(YN, p.start, upd('start'), 'Can start it')]), el('td', {}, [sel(YN, p.stop, upd('stop'), 'Can stop it')]), el('td', {}, [sel(HML, p.contrib, upd('contrib'), 'Contribution')]),
        el('td', {}, [caps]),
        el('td', {}, [sel(STAND, p.stand || 'standing', upd('stand'), 'Where they stand'), sel(SIDE, p.side || 'exposure', upd('side'), 'Exposure or value')]),
        el('td', {}, [txt(p.voice, upd('voice'), 'Who speaks for them', 'Who speaks for them'), txt(p.src, upd('src'), 'Source', 'Source')]),
        el('td', {}, ro() ? [] : [el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: function () { save(function (d) { d.parties = (d.parties || []).filter(function (y) { return y.id !== p.id; }); }, 'remove').then(X.render); } })])]));
    });
    sec.appendChild(el('div', { class: 'skscroll' }, [el('table', { class: 'fxtable sktab' }, [el('thead', {}, [el('tr', {}, ['Role or group', 'Stake', 'Can start', 'Can stop', 'Holds it together', 'Capitals', 'Where they stand', 'Voice and source', ''].map(function (h) { return el('th', { text: h }); }))]), tb])]));
    if (!ro()) sec.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { class: 'btn sm', type: 'button', id: 'skAdd', text: 'Add a party', onclick: function () { save(function (d) { d.parties = d.parties || []; d.parties.push({ id: nid('s', d.parties), n: '', where: 'outside', stand: 'standing', side: 'exposure', caps: [] }); }, 'add').then(X.render); } }),
      el('button', { class: 'btn sm', type: 'button', id: 'skSeed', text: 'Add the parties named in the system', onclick: function () { var R = ((((X.row('frame') || {}).content || {}).answers || {}).system || {}).route || {}, L = R.lists || {}, names = [].concat((L.inside || []).map(function (x) { return [x.t, 'inside']; }), (L.outside || []).map(function (x) { return [x.t, 'outside']; })); save(function (d) { d.parties = d.parties || []; names.forEach(function (nm) { if (!d.parties.some(function (y) { return y.n === nm[0]; })) d.parties.push({ id: nid('s', d.parties), n: nm[0], where: nm[1], stand: 'standing', side: 'exposure', caps: [], src: 'The system (Frame, 1.2)' }); }); }, 'seed').then(X.render); } })]));
    wrap.appendChild(sec);
    // placements, kept apart, then revealed
    var pl = el('section', { class: 'fxcard', id: 'skPlace' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Each person places everyone, on their own' }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag' + (c.revealed ? ' ok' : ''), text: c.revealed ? 'Revealed' : placers.filter(function (x) { return x.done; }).length + ' placed, not yet revealed' })]),
      el('p', { class: 'fxmuted', text: 'Six to ten people across levels, one at a time. Each places every party for stake, whether they can stop it, and whether they hold it together, without seeing anyone else’s. Enter each person’s placement here as they give it. Nothing is shown until the reveal; then the spread is kept, by level.' })]);
    var plist = el('div', { class: 'skplacers' });
    placers.forEach(function (x) { plist.appendChild(el('button', { type: 'button', class: 'btn sm' + (ST.placer === x.id ? ' solid' : ''), 'data-placer': x.id, text: x.id.toUpperCase() + ' · ' + lab(LEVELS, x.level) + (x.done ? ' ✓' : ''), onclick: function () { ST.placer = ST.placer === x.id ? null : x.id; X.render(); } })); });
    if (!ro() && !c.revealed) plist.appendChild(el('span', { class: 'row', style: 'gap:6px' }, [(function () { var s = sel(LEVELS, 'front', function () {}, 'Level of the next person'); s.id = 'skLevel'; return s; })(), el('button', { class: 'btn sm', type: 'button', id: 'skAddPlacer', text: 'Add a person', onclick: function () { var lv = document.getElementById('skLevel').value; save(function (d) { d.placers = d.placers || []; var id = nid('r', d.placers); d.placers.push({ id: id, level: lv, p: {} }); ST.placer = id; }, 'placer').then(X.render); } })]));
    pl.appendChild(plist);
    var cur = placers.filter(function (x) { return x.id === ST.placer; })[0];
    if (cur && !c.revealed) {
      var g = el('tbody');
      ps.forEach(function (p) { var v = (cur.p || {})[p.id] || {}; var up = function (k) { return function (val) { save(function (d) { var x = (d.placers || []).filter(function (y) { return y.id === cur.id; })[0]; if (!x) return; x.p = x.p || {}; x.p[p.id] = x.p[p.id] || {}; x.p[p.id][k] = val; }, 'placement'); }; };
        g.appendChild(el('tr', {}, [el('td', { text: p.n || 'Unnamed' }), el('td', {}, [sel(HML, v.stake, up('stake'), 'Stake')]), el('td', {}, [sel(YN, v.stop, up('stop'), 'Can stop')]), el('td', {}, [sel(HML, v.contrib, up('contrib'), 'Holds it together')])])); });
      pl.appendChild(el('h3', { class: 'fxsub3', text: cur.id.toUpperCase() + ', ' + lab(LEVELS, cur.level).toLowerCase() + ': their placement' }));
      pl.appendChild(el('table', { class: 'fxtable' }, [el('thead', {}, [el('tr', {}, ['Party', 'Stake', 'Can stop', 'Holds it together'].map(function (h) { return el('th', { text: h }); }))]), g]));
      if (!ro()) pl.appendChild(el('button', { class: 'btn sm', type: 'button', text: cur.done ? 'Placed: reopen' : 'This person has finished', onclick: function () { save(function (d) { var x = (d.placers || []).filter(function (y) { return y.id === cur.id; })[0]; if (x) x.done = !x.done; }, 'done').then(function () { ST.placer = null; X.render(); }); } }));
    }
    var doneN = placers.filter(function (x) { return x.done; }).length, lvN = Object.keys(placers.filter(function (x) { return x.done; }).reduce(function (a, x) { a[x.level] = 1; return a; }, {})).length;
    if (!ro()) pl.appendChild(el('div', { class: 'fxagree' }, [el('span', { class: 'fxmuted', text: c.revealed ? 'Revealed. Placements made from now on are kept and marked as after the reveal.' : doneN < 3 ? 'The reveal needs at least three people who have finished.' : lvN < 2 ? 'The reveal needs people from at least two levels.' : 'Ready to reveal.' }), el('span', { class: 'fxgrow' }), el('button', { class: 'btn fxmain', type: 'button', id: 'skReveal', disabled: c.revealed || doneN < 3 || lvN < 2, text: c.revealed ? 'Revealed' : 'Close placements and reveal', onclick: function () { save(function (d) { d.revealed = { at: new Date().toISOString(), by: X.me ? X.me() : '' }; }, 'reveal').then(X.render); } })]));
    if (c.revealed && doneN) {
      var un = cells.filter(function (x) { return x.unanimous; }).length;
      var dt = el('tbody');
      cells.forEach(function (x) { var cnt = function (k, list) { return list.map(function (o) { return (x.votes[k][o] || 0) + ' ' + o; }).filter(function (s) { return s[0] !== '0'; }).join(', ') || '–'; };
        var stopSplit = Object.keys(x.votes.stop).filter(function (a) { return a !== 'unknown'; }).length > 1, flags = [x.spreadStake >= 2 || stopSplit ? 'Spread' : '', x.levelsDiffer ? 'Levels differ' : '', x.unanimous ? 'Unanimous' : ''].filter(Boolean).join(' · ');
        if (x.levelsDiffer) flags += '';
        dt.appendChild(el('tr', {}, [el('td', { text: x.p.n }), el('td', { text: cnt('stake', ['high', 'med', 'low']) }), el('td', { text: cnt('stop', ['yes', 'no', 'unknown']) }), el('td', { text: cnt('contrib', ['high', 'med', 'low']) }), el('td', { text: flags })])); });
      pl.appendChild(el('h3', { class: 'fxsub3', text: 'The spread' }));
      pl.appendChild(el('table', { class: 'fxtable', id: 'skSpread' }, [el('thead', {}, [el('tr', {}, ['Party', 'Stake', 'Can stop', 'Holds it together', ''].map(function (h) { return el('th', { text: h }); }))]), dt]));
      if (un * 2 > cells.length) pl.appendChild(el('p', { class: 'skwarn', text: 'Everybody gives the same answer for most parties. Either you met one group, or the answers are rehearsed: talk to more people, across levels.' }));
    }
    wrap.appendChild(pl);
    // the cells
    var cs = el('section', { class: 'fxcard', id: 'skCells' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'The stakeholder matrix: exposed and load-bearing' }), el('span', { class: 'fxgrow' })]),
      el('p', { class: 'fxmuted', text: (cells.length && cells[0].useP ? 'From the placements, once revealed. ' : 'From the team’s ratings until at least three people’s placements are revealed. ') + 'A party is listed as contested when a third or more of the placements put it there.' })]);
    var col = function (title, sub, key, keyC) { var xs = cells.filter(function (x) { return x[key] || x[keyC]; }); return el('div', { class: 'skcell', 'data-cell': key }, [el('h3', { text: title }), el('p', { class: 'fxmuted sm', text: sub }), xs.length ? el('ul', {}, xs.map(function (x) { return el('li', {}, [document.createTextNode(x.p.n || 'Unnamed'), x[keyC] ? el('span', { class: 'fxtag', text: 'Contested' }) : null]); })) : el('p', { class: 'fxmuted', text: 'Nobody yet.' })]); };
    var both = cells.filter(function (x) { return x.exposed && x.lb; });
    cs.appendChild(partyMatrix(cells));
    cs.appendChild(el('div', { class: 'skcells' }, [col('Exposed', 'High stake, and cannot stop it', 'exposed', 'exposedC'), col('Load-bearing', 'Holds it together, and cannot stop it', 'lb', 'lbC')]));
    if (both.length) cs.appendChild(el('p', { class: 'skwarn', text: 'In both cells: ' + both.map(function (x) { return x.p.n; }).join(', ') + '. The people who hold it together are also the ones exposed when it fails, and they cannot stop it.' }));
    wrap.appendChild(cs);
    // absences and owners
    var ab = el('section', { class: 'fxcard', id: 'skAbsent' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Who is missing' }), el('span', { class: 'fxgrow' })]), el('p', { class: 'fxmuted', text: 'Six ways to be missing, on the exposure side and the value side. An empty cell needs a reason.' })]);
    var rowsA = [['unidentified', 'Not identified'], ['notinvited', 'Identified, not invited'], ['present', 'Present, without standing']];
    var at = el('tbody');
    rowsA.forEach(function (r) { at.appendChild(el('tr', {}, [el('th', { text: r[1] })].concat(['exposure', 'value'].map(function (sd) { var xs = ps.filter(function (p) { return (p.stand || 'standing') === r[0] && ((p.side || 'exposure') === sd || p.side === 'both'); }); return el('td', { 'data-abs': r[0] + ':' + sd, text: xs.length ? xs.map(function (p) { return p.n; }).join('; ') : '–' }); })))); });
    ab.appendChild(el('table', { class: 'fxtable' }, [el('thead', {}, [el('tr', {}, [el('th'), el('th', { text: 'Exposed if it fails' }), el('th', { text: 'Gains when it works' })])]), at]));
    var noOwner = X.LCAPS.filter(function (cp) { return !ps.some(function (p) { return (p.caps || []).indexOf(cp[0]) >= 0 && (p.start === 'yes' || p.stop === 'yes'); }); }).map(function (cp) { return cp[1]; });
    ab.appendChild(el('p', { id: 'skNoOwner', text: noOwner.length ? 'Capitals nobody listed can start or stop: ' + noOwner.join(', ') + '.' : 'Every capital has someone who can start or stop it.' }));
    ab.appendChild(el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Why a cell is empty, or who we did not ask' }), area(c.absentNote, function (v) { save(function (d) { d.absentNote = v; }, 'absences'); }, 'For example: no families were asked; the patients’ forum speaks for them')]));
    wrap.appendChild(ab);
    // who decides
    var steps = ((((X.row('frame') || {}).content || {}).answers || {}).system || {}).route; steps = ((steps && steps.steps) || []).map(function (s) { return s.n; }).filter(Boolean);
    var wd = el('section', { class: 'fxcard', id: 'skDecides' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Who decides, and do they know it' }), el('span', { class: 'fxgrow' })])]);
    if (!steps.length) wd.appendChild(el('p', { class: 'fxmuted', text: 'Name the steps in 1.2 The system, to ask who can act on each.' }));
    else {
      var dec = c.decides || {}, named = 0, unaware = 0, dtb = el('tbody');
      steps.forEach(function (n, i) { var k = 'st' + i, v = dec[k] || {}; if (v.who && v.who !== 'nobody') { named++; if (v.aware === 'no') unaware++; }
        var up = function (f) { return function (val) { save(function (d) { d.decides = d.decides || {}; d.decides[k] = Object.assign({ step: n }, d.decides[k] || {}); d.decides[k][f] = val; }, 'who decides'); }; };
        dtb.appendChild(el('tr', {}, [el('td', { text: n }), el('td', {}, [txt(v.who, up('who'), 'A role, or nobody', 'Who can act')]), el('td', {}, [sel(YN, v.aware, up('aware'), 'Do they know it is theirs')])])); });
      wd.appendChild(el('table', { class: 'fxtable' }, [el('thead', {}, [el('tr', {}, ['Step', 'Who can act on it', 'Do they know it is theirs?'].map(function (h) { return el('th', { text: h }); }))]), dtb]));
      wd.appendChild(el('p', { id: 'skMismatch', text: named ? unaware + ' of ' + named + ' named owners do not know it is theirs.' : 'No owners named yet.' }));
    }
    wrap.appendChild(wd);
    // the output test
    var ot = c.otest || {}, otb = el('section', { class: 'fxcard', id: 'skTest' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Did this find anything?' }), el('span', { class: 'fxgrow' })])]);
    [['newparty', 'A party nobody had listed at the start'], ['emptycell', 'An empty cell, for a reason'], ['nodoc', 'Someone the service depends on who appears in no document']].forEach(function (o) { var b = el('input', { type: 'checkbox', checked: !!ot[o[0]], disabled: ro() }); b.addEventListener('change', function () { save(function (d) { d.otest = d.otest || {}; d.otest[o[0]] = b.checked; }, 'output test').then(X.render); }); otb.appendChild(el('label', { class: 'skchk' }, [b, el('span', { text: o[1] })])); });
    if (!ot.newparty && !ot.emptycell && !ot.nodoc) otb.appendChild(el('p', { class: 'skwarn', text: 'None ticked: this has recorded the organisation chart with better facilitation. Go back to more people before setting the threshold.' }));
    wrap.appendChild(otb);
    wrap.appendChild(X.evqBar('f:stake', 'Frame: who is exposed', 'frame'));
    wrap.appendChild(X.fxFoot(['The system', '#system'], ['How exposed they are', '#exposure'], 'The exposed parties outside the organisation become the groups profiled next.'));
  }

  // ---------- the dependants' profile: how exposed they are ----------
  var capsOf = function (c) { return Object.keys(c.V || {}).filter(function (k) { return c.V[k] && c.V[k].sev !== '' && c.V[k].sev != null; }); };
  function holdsR(c) { var R = c.R || {}; return (R.level === 'few' || R.level === 'many') && R.reach !== 'no' && R.fails !== 'yes'; }
  function holdsN(c) { var N = c.N || {}; return (N.kind === 'other' && N.fails !== 'yes') || N.kind === 'defer' || N.kind === 'without'; }
  var irreversible = function (c) { return capsOf(c).some(function (k) { return (c.I || {})[k] === 'never'; }); };
  var maxOf = function (c, k) { return Math.max.apply(null, [-1].concat(capsOf(c).map(function (x) { var v = Number(c.V[x][k]); return isNaN(v) ? -1 : v; }))); };
  // the order rule (version 3 of the old Lab): smaller sorts first; an unanswered R or N never lowers a group
  function orderKey(c) {
    var R = c.R || {}, N = c.N || {}, rKnown = ['none', 'few', 'many'].indexOf(R.level) >= 0, nKnown = ['other', 'defer', 'without', 'none'].indexOf(N.kind) >= 0;
    var noR = R.level === 'none' || ((R.level === 'few' || R.level === 'many') && !holdsR(c));
    return [irreversible(c) ? 0 : 1, !nKnown ? 0.5 : N.kind === 'none' || (N.kind === 'other' && N.fails === 'yes') ? 0 : 1, !rKnown ? 0.5 : noR ? 0 : 1, -maxOf(c, 'sev'), -maxOf(c, 'scale')];
  }
  var cmp = function (a, b) { for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  function ranked(cards) {
    var top = cards.filter(function (c) { return !c.parent || !cards.some(function (p) { return p.id === c.parent; }); });
    var keyOf = function (c) { var k = orderKey(c); cards.filter(function (x) { return x.parent === c.id; }).forEach(function (ch) { var kc = orderKey(ch); if (cmp(kc, k) < 0) k = kc; }); return k; };
    var s = top.map(function (c) { return { c: c, k: keyOf(c) }; }).sort(function (a, b) { return cmp(a.k, b.k); }), rank = 0;
    return s.map(function (x, i) { if (!i || cmp(x.k, s[i - 1].k)) rank = i + 1; var worst = cards.filter(function (y) { return y.parent === x.c.id; }).sort(function (a, b) { return cmp(orderKey(a), orderKey(b)); })[0]; return { c: x.c, rank: rank, worst: worst && cmp(orderKey(worst), orderKey(x.c)) < 0 ? worst : null }; });
  }
  function why(c) {
    var out = []; if (irreversible(c)) out.push('cannot be put back'); var N = c.N || {}, R = c.R || {};
    if (N.kind === 'none') out.push('no other way'); else if (N.kind === 'other' && N.fails === 'yes') out.push('the other way fails with it'); else if (!N.kind) out.push('other way not known');
    if (R.level === 'none') out.push('no other provider'); else if ((R.level === 'few' || R.level === 'many') && !holdsR(c)) out.push(R.reach === 'no' ? 'other providers out of reach' : 'other providers fail with it'); else if (!R.level) out.push('other providers not known');
    return out;
  }
  // ---- the stakeholder matrix (3a): stake against whether they can stop it ----
  var modeOf = function (votes, fb) { var ks = Object.keys(votes || {}); if (!ks.length) return fb; return ks.sort(function (a, b) { return votes[b] - votes[a]; })[0]; };
  function partyMatrix(cells) {
    var rows = [['high', 'High stake'], ['med', 'Medium stake'], ['low', 'Low stake']], cols = [['yes', 'Can stop it'], ['unknown', 'Not known'], ['no', 'Cannot stop it']];
    var at = function (x) { var st = x.useP ? modeOf(x.votes.stake, x.p.stake) : x.p.stake, sp = x.useP ? modeOf(x.votes.stop, x.p.stop) : x.p.stop; return [st || '', sp || 'unknown']; };
    var unplaced = [];
    var g = el('div', { class: 'skmx', role: 'table', 'aria-label': 'Stakeholder matrix: stake against whether they can stop it' });
    g.appendChild(el('div', { class: 'skmxc skmxh', role: 'columnheader' }));
    cols.forEach(function (c) { g.appendChild(el('div', { class: 'skmxc skmxh', role: 'columnheader', text: c[1] })); });
    rows.forEach(function (r) {
      g.appendChild(el('div', { class: 'skmxc skmxh skmxrh', role: 'rowheader', text: r[1] }));
      cols.forEach(function (c) {
        var xs = cells.filter(function (x) { var a = at(x); return a[0] === r[0] && a[1] === c[0]; });
        var hot = r[0] === 'high' && c[0] === 'no', warm = (r[0] === 'high' && c[0] === 'unknown') || (r[0] === 'med' && c[0] === 'no');
        g.appendChild(el('div', { class: 'skmxc' + (hot ? ' hot' : warm ? ' warm' : ''), role: 'cell', 'data-mx': r[0] + ':' + c[0] }, [hot ? el('span', { class: 'skmxl', text: 'Exposed' }) : null].concat(xs.map(function (x) { return el('span', { class: 'skchip' + (x.lb || x.lbC ? ' lb' : '') + (x.exposedC || x.lbC ? ' contested' : ''), title: (x.lb || x.lbC ? 'Holds it together. ' : '') + (x.exposedC || x.lbC ? 'Contested in the placements.' : ''), text: x.p.n || 'Unnamed' }); }))));
      });
    });
    cells.forEach(function (x) { if (!at(x)[0]) unplaced.push(x.p.n || 'Unnamed'); });
    return el('div', {}, [g,
      el('p', { class: 'fxmuted sm', text: 'Interest becomes stake: what they would lose, not how much attention they pay. Power becomes whether they can stop it. A heavy outline marks those who hold it together; a dashed one, a placement that is contested. Top right is the finding, not a group to keep happy.' }),
      unplaced.length ? el('p', { class: 'fxmuted sm', text: 'No stake given yet: ' + unplaced.join(', ') + '.' }) : null]);
  }

  // ---- the exposure matrix (3b): value at stake against the cost of finding a substitute ----
  var LVL = [['', 'From the profile'], ['0.15', 'Low'], ['0.5', 'Medium'], ['0.85', 'High']];
  var SCL = [['', 'Cost to switch?'], ['low', 'Low'], ['med', 'Medium'], ['high', 'High']], SCV = { low: 0.15, med: 0.5, high: 0.85 };
  var DRIFT = [['', 'Moving? Not known'], ['toward', 'Drifting towards the corner'], ['steady', 'Steady'], ['away', 'Moving away (renewal)']];
  function scored(k) {
    var S2 = k.vs || {}, dims = (S2.dims || []).filter(function (d) { return d.n && Number(d.w) > 0; }), subs = (S2.subs || []).filter(function (s) { return s.n; });
    if (!dims.length || !subs.length) return null;
    var max = 3 * dims.reduce(function (a, d) { return a + Number(d.w); }, 0);
    var res = subs.map(function (s) { return { s: s, r: dims.reduce(function (a, d) { var v = Number(((s.r || {})[d.id])); return a + (isNaN(v) ? 3 : v) * Number(d.w); }, 0) }; }).sort(function (a, b) { return a.r - b.r; });
    return { best: res[0], max: max, all: res };
  }
  function vasOf(k) {
    var m = k.mx || {}; if (m.y) return { v: Number(m.y), how: 'placed by hand' };
    var sc = scored(k); if (sc) return { v: sc.best.r / sc.max, how: 'scored: ' + sc.best.r + ' of ' + sc.max + ' left after the best substitute' };
    var sev = maxOf(k, 'sev'), scale = maxOf(k, 'scale'); if (sev < 0) return null;
    return { v: Math.min(1, (sev / 3) * 0.8 + (Math.max(scale, 0) / 3) * 0.2), how: 'from how bad and how many' };
  }
  function scOf(k) {
    var m = k.mx || {}; if (m.x) return { v: Number(m.x), how: 'placed by hand' };
    var sc = scored(k); if (sc && sc.best.s.sc) return { v: SCV[sc.best.s.sc], how: 'from the best substitute' };
    var R = k.R || {}, N = k.N || {};
    var n = N.kind === 'none' || (N.kind === 'other' && N.fails === 'yes') ? 1 : N.kind === 'defer' ? 0.55 : N.kind === 'other' ? 0.25 : N.kind === 'without' ? 0.05 : null;
    var r = R.level === 'none' ? 1 : (R.level === 'few' || R.level === 'many') && !holdsR(k) ? 0.85 : R.level === 'few' ? 0.45 : R.level === 'many' ? 0.15 : null;
    if (n == null && r == null) return null;
    return { v: n == null ? r : r == null ? n : (n + r) / 2, how: 'from other providers and other ways', guess: n == null || r == null };
  }
  function exposureMatrix(cards, R) {
    var ns = 'http://www.w3.org/2000/svg', W = 560, H = 420, L = 58, T = 18, PW = W - L - 16, PH = H - T - 50;
    var sv = function (t, a, txt) { var e = document.createElementNS(ns, t); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); if (txt != null) e.textContent = txt; return e; };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'skxm', role: 'img', 'aria-label': 'Exposure matrix: value at stake against the cost of finding a substitute' });
    var X0 = function (x) { return L + x * PW; }, Y0 = function (y) { return T + (1 - y) * PH; };
    svg.appendChild(sv('rect', { x: X0(0.5), y: Y0(1), width: PW / 2, height: PH / 2, class: 'skxhot' }));
    var pts = []; for (var i = 0; i <= 40; i++) { var x = 0.45 + i * 0.55 / 40, y = 0.36 / x; if (y <= 1) pts.push(X0(x).toFixed(1) + ',' + Y0(y).toFixed(1)); }
    svg.appendChild(sv('polyline', { points: pts.join(' '), class: 'skxtol' }));
    svg.appendChild(sv('text', { x: X0(0.99), y: Y0(0.97), 'text-anchor': 'end', class: 'skxq b' }, 'Most exposed'));
    svg.appendChild(sv('text', { x: X0(0.01), y: Y0(0.97), class: 'skxq' }, 'Replaceable: leaving softens the loss'));
    svg.appendChild(sv('text', { x: X0(0.01), y: Y0(0.03), class: 'skxq' }, 'Low exposure'));
    svg.appendChild(sv('text', { x: X0(0.99), y: Y0(0.03), 'text-anchor': 'end', class: 'skxq' }, 'Locked in, little at stake'));
    svg.appendChild(sv('text', { x: X0(0.62), y: Y0(0.66), class: 'skxq i' }, 'towards intolerable'));
    svg.appendChild(sv('rect', { x: L, y: T, width: PW, height: PH, class: 'skxframe' }));
    svg.appendChild(sv('line', { x1: X0(0.5), y1: T, x2: X0(0.5), y2: T + PH, class: 'skxmid' })); svg.appendChild(sv('line', { x1: L, y1: Y0(0.5), x2: L + PW, y2: Y0(0.5), class: 'skxmid' }));
    svg.appendChild(sv('text', { x: L + PW / 2, y: H - 12, 'text-anchor': 'middle', class: 'skxa' }, 'Cost of finding a substitute  →'));
    var ya = sv('text', { x: 16, y: T + PH / 2, 'text-anchor': 'middle', class: 'skxa', transform: 'rotate(-90 16 ' + (T + PH / 2) + ')' }, 'Value at stake  →'); svg.appendChild(ya);
    svg.appendChild(sv('text', { x: L, y: T + PH + 16, class: 'skxt' }, 'Low')); svg.appendChild(sv('text', { x: L + PW, y: T + PH + 16, 'text-anchor': 'end', class: 'skxt' }, 'High'));
    var defs = sv('defs'), mk = sv('marker', { id: 'skArr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }); mk.appendChild(sv('path', { d: 'M0,0 L10,5 L0,10 z', class: 'skxarrh' })); defs.appendChild(mk); svg.appendChild(defs);
    var legend = [], missing = [], placed = [];
    var rankOf = {}; R.forEach(function (x) { rankOf[x.c.id] = x.rank; });
    var list = []; cards.filter(function (k) { return !k.parent; }).forEach(function (k) { list.push([k, String(rankOf[k.id] || '?')]); cards.filter(function (s) { return s.parent === k.id; }).forEach(function (s, j) { list.push([s, (rankOf[k.id] || '?') + String.fromCharCode(97 + j)]); }); });
    list.forEach(function (it) {
      var k = it[0], lab2 = it[1], v = vasOf(k), s = scOf(k);
      if (!v || !s) { missing.push(k.n || 'Unnamed'); return; }
      var bx = X0(Math.max(0.05, Math.min(0.95, s.v))), by = Y0(Math.max(0.06, Math.min(0.9, v.v))), cx = bx, cy = by;
      var OFF = [[0, 0], [-26, 0], [0, 26], [-26, 26], [-52, 0], [-52, 26], [0, 52], [-26, 52], [26, 0], [26, 26]];
      for (var o = 0; o < OFF.length; o++) { var tx = Math.min(L + PW - 12, Math.max(L + 12, bx + OFF[o][0])), ty = Math.min(T + PH - 12, Math.max(T + 24, by + OFF[o][1])); if (!placed.some(function (q) { return Math.abs(q[0] - tx) < 23 && Math.abs(q[1] - ty) < 23; })) { cx = tx; cy = ty; break; } }
      placed.push([cx, cy]);
      if (k.drift === 'toward' || k.drift === 'away') { var d = k.drift === 'toward' ? 1 : -1; svg.appendChild(sv('line', { x1: cx, y1: cy, x2: cx + d * 34, y2: cy - d * 26, class: 'skxarr' + (d < 0 ? ' away' : ''), 'marker-end': 'url(#skArr)' })); }
      var g = sv('g', { class: 'skxpt' + (k.parent ? ' seg' : '') + (irreversible(k) ? ' never' : '') + (s.guess ? ' guess' : ''), 'data-pt': k.id });
      g.appendChild(sv('title', {}, (k.n || 'Unnamed') + '. Value at stake ' + v.how + '; cost of a substitute ' + s.how + (irreversible(k) ? '. A loss that cannot be put back.' : '')));
      g.appendChild(irreversible(k) ? sv('rect', { x: cx - 11, y: cy - 11, width: 22, height: 22, rx: 3 }) : sv('circle', { cx: cx, cy: cy, r: 11 }));
      g.appendChild(sv('text', { x: cx, y: cy + 4, 'text-anchor': 'middle' }, lab2));
      svg.appendChild(g);
      var how = [v.how !== 'from how bad and how many' ? 'value at stake ' + v.how.replace(/^scored:/, 'scored,') : '', s.how !== 'from other providers and other ways' ? 'cost of a substitute: ' + s.how : '', s.guess ? 'half answered' : ''].filter(Boolean).join('; ');
      legend.push({ k: lab2, li: el('li', {}, [el('b', { text: lab2 + ' ' }), document.createTextNode(k.n || 'Unnamed'), el('span', { class: 'fxmuted sm', text: ' · ' + (why(k).join('; ') || 'somewhere else to go') + (how ? ' (' + how + ')' : '') })]) });
    });
    return el('div', { class: 'skxwrap' }, [svg, el('ul', { class: 'skxleg' }, legend.sort(function (a, b) { return parseInt(a.k, 10) - parseInt(b.k, 10) || (a.k < b.k ? -1 : 1); }).map(function (x) { return x.li; })),
      el('p', { class: 'fxmuted sm', text: 'Unless scored or placed by hand, value at stake comes from how bad and how many, and the cost of a substitute from other providers and other ways. A square is a loss that cannot be put back. A dashed outline means only one of other providers and other ways is answered. Arrows show drift towards the corner or renewal away from it. The curve is for reading the picture, not a measured threshold: the thresholds themselves are set in 1.3.3 to 1.3.6.' }),
      missing.length ? el('p', { class: 'fxmuted sm', text: 'Not placed yet (needs how bad, and other providers or another way): ' + missing.join(', ') + '.' }) : null,
      el('p', { class: 'fxmuted sm', text: 'Adapted from Bowman’s customer matrix (2003), read from the side of the people who rely on the service: perceived value becomes value at stake, price becomes the cost of finding a substitute.' })]);
  }
  // the weighted scoring, per group (optional)
  function scorePanel(k, upd) {
    var vs = k.vs || {}, dims = vs.dims || [], subs = vs.subs || [], sc = scored(k);
    var put = function (fn) { return save(function (d) { var x = (d.cards || []).filter(function (y) { return y.id === k.id; })[0]; if (!x) return; x.vs = x.vs || { dims: [], subs: [] }; x.vs.dims = x.vs.dims || []; x.vs.subs = x.vs.subs || []; fn(x.vs); }, 'score'); };
    var det = el('details', { class: 'skscore', open: ST.open === k.id || null }, [el('summary', { text: 'Score the value at stake (optional)' + (sc ? ': ' + sc.best.r + ' of ' + sc.max + ' left after the best substitute' : '') })]);
    det.addEventListener('toggle', function () { ST.open = det.open ? k.id : (ST.open === k.id ? null : ST.open); });
    if (vs.note) det.appendChild(el('p', { class: 'skwarn', text: vs.note }));
    det.appendChild(el('p', { class: 'fxmuted sm', text: 'List what this group values about the service in their own terms (not the capitals), weight them to 100, then rate each substitute 0 (replaces it fully) to 3 (replaces nothing). Value at stake is what is left after the best substitute.' }));
    var R03 = [['', '–'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']];
    var thead = el('tr', {}, [el('th', { text: 'What they value' }), el('th', { text: 'Weight' })].concat(subs.map(function (s, j) { return el('th', {}, [txt(s.n, function (v) { put(function (o) { o.subs[j].n = v; }); }, 'Substitute', 'Substitute ' + (j + 1)), sel(SCL, s.sc, function (v) { put(function (o) { o.subs[j].sc = v; }); }, 'Cost to switch, substitute ' + (j + 1))]); })));
    var tb = el('tbody');
    dims.forEach(function (d, i) { tb.appendChild(el('tr', {}, [el('td', {}, [txt(d.n, function (v) { put(function (o) { o.dims[i].n = v; }); }, 'Always on', 'What they value ' + (i + 1))]), el('td', {}, [txt(d.w, function (v) { put(function (o) { o.dims[i].w = v; }); }, '25', 'Weight ' + (i + 1))])].concat(subs.map(function (s, j) { return el('td', {}, [sel(R03, ((s.r || {})[d.id]) == null ? '' : String(s.r[d.id]), function (v) { put(function (o) { o.subs[j].r = o.subs[j].r || {}; o.subs[j].r[d.id] = v; }); }, 'Rating')]); })))); });
    var wsum = dims.reduce(function (a, d) { return a + (Number(d.w) || 0); }, 0);
    tb.appendChild(el('tr', {}, [el('th', { text: 'Left at stake' }), el('td', { text: wsum ? String(wsum) + (wsum !== 100 ? ' (weights should add to 100)' : '') : '' })].concat(subs.map(function (s) { var r = sc && sc.all.filter(function (a) { return a.s === s || a.s.id === s.id; })[0]; return el('td', { text: r ? String(r.r) : '' }); }))));
    det.appendChild(el('div', { class: 'skscroll' }, [el('table', { class: 'fxtable skscoretab' }, [el('thead', {}, [thead]), tb])]));
    if (!ro()) det.appendChild(el('div', { class: 'row', style: 'gap:8px' }, [el('button', { class: 'btn sm', type: 'button', text: 'Add something they value', onclick: function () { ST.open = k.id; put(function (o) { o.dims.push({ id: nid('d', o.dims), n: '', w: '' }); }).then(X.render); } }), el('button', { class: 'btn sm', type: 'button', text: 'Add a substitute', onclick: function () { ST.open = k.id; put(function (o) { o.subs.push({ id: nid('u', o.subs), n: '', sc: '', r: {} }); }).then(X.render); } })]));
    return det;
  }
  function renderHow(main) {
    var c = data(), cards = c.cards = c.cards || [], R = ranked(cards);
    var wrap = el('div', { class: 'fx sk', id: 'skHow' }); main.appendChild(wrap);
    wrap.appendChild(X.fxPath('line', 'How exposed they are'));
    wrap.appendChild(strip('exposure'));
    wrap.appendChild(X.fxTitle('How exposed they are', 'For each group that relies on the service from outside: what losing it would cost them, capital by capital; whether they have somewhere else to go; and whether the loss can be put back. The most exposed are the people whose threshold is set first.', [el('b', { text: R.length + (R.length === 1 ? ' group' : ' groups') + ' profiled · ' + (c.omissions || []).filter(function (o) { return o.n; }).length + ' left out, with reasons' })], 'line'));
    if (FALLBACK.test(JSON.stringify(c))) wrap.appendChild(el('p', { class: 'skwarn', text: '“Fallback” appears below. Say what the other way actually is, who runs it and whether it fails with the service.' }));
    // the ranking
    var rk = el('section', { class: 'fxcard', id: 'skRank' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'The most exposed first' }), el('span', { class: 'fxgrow' })]),
      el('p', { class: 'fxmuted', text: 'Ordered by: a loss that cannot be put back; no other way; no other provider that holds; then how bad, then how many. A group that splits is ranked by its worst-off segment. No probabilities.' })]);
    if (!R.length) rk.appendChild(el('p', { class: 'fxmuted', text: 'No groups yet.' }));
    else rk.appendChild(el('ol', { class: 'skrank' }, R.map(function (x) { var w = x.worst || x.c; return el('li', { 'data-rank': x.rank }, [el('b', { text: x.c.n || 'Unnamed group' }), x.worst ? el('span', { text: ', worst off: ' + x.worst.n }) : null, el('span', { class: 'fxmuted', text: ' · ' + (why(w).join('; ') || 'somewhere else to go') }), el('span', { class: 'fxtag', text: lab(EVQ, w.ev) || 'Not graded' })]); })));
    wrap.appendChild(rk);
    wrap.appendChild(el('section', { class: 'fxcard', id: 'skMatrix' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'The exposure matrix' }), el('span', { class: 'fxgrow' })]), el('p', { class: 'fxmuted', text: 'Each group placed by what it would lose and how hard it would be to replace. Placed from the profiles below unless scored or placed by hand. Numbers match the ranking.' }), exposureMatrix(cards, R)]));
    // the cards
    var top = cards.filter(function (x) { return !x.parent; });
    var card = function (k, depth) {
      var upd = function (path) { return function (v) { save(function (d) { var x = (d.cards || []).filter(function (y) { return y.id === k.id; })[0]; if (!x) return; var o = x; for (var i = 0; i < path.length - 1; i++) { o[path[i]] = o[path[i]] || {}; o = o[path[i]]; } o[path[path.length - 1]] = v; }, 'profile'); }; };
      var box = el('section', { class: 'fxcard skcard' + (depth ? ' skseg' : ''), 'data-card': k.id }, [el('div', { class: 'fxqhead' }, [el('h3', { class: 'fxsech', text: (depth ? 'Segment: ' : '') + (k.n || 'Unnamed group') }), el('span', { class: 'fxgrow' }), el('span', { class: 'fxtag', text: lab(EVQ, k.ev) || 'Not graded' })])]);
      box.appendChild(el('div', { class: 'fxqs two' }, [el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: depth ? 'Who is in this segment' : 'The group' }), txt(k.n, upd(['n']), 'Patients admitted under another specialty')]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'What they receive (an outcome, not an activity)' }), txt(k.svc, upd(['svc']), 'A dangerous result seen by a doctor in time')])]));
      var vt = el('tbody');
      X.LCAPS.forEach(function (cp) { var v = (k.V || {})[cp[0]] || {}; vt.appendChild(el('tr', {}, [el('th', { text: cp[1] }), el('td', {}, [sel([['', 'No loss']].concat(cp[4].map(function (w, i) { return [String(i), w]; })), v.sev == null ? '' : String(v.sev), upd(['V', cp[0], 'sev']), 'How bad, ' + cp[1])]), el('td', {}, [sel([['', '–']].concat(X.LSCALE.map(function (w, i) { return [String(i), w]; })), v.scale == null ? '' : String(v.scale), upd(['V', cp[0], 'scale']), 'How many, ' + cp[1])]), el('td', {}, [sel(IKIND, (k.I || {})[cp[0]], upd(['I', cp[0]]), 'Can it be put back, ' + cp[1])])])); });
      box.appendChild(el('table', { class: 'fxtable skv' }, [el('thead', {}, [el('tr', {}, ['What losing it costs them', 'How bad', 'How many', 'Can it be put back?'].map(function (h) { return el('th', { text: h }); }))]), vt]));
      var Rr = k.R || {}, Nn = k.N || {};
      box.appendChild(el('div', { class: 'fxqs two' }, [
        el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Other providers they could turn to' }), el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [sel(RLEV, Rr.level, upd(['R', 'level']), 'Other providers'), sel(YN, Rr.reach, upd(['R', 'reach']), 'Can they reach them, in time, at a cost they can bear'), sel(YN, Rr.fails, upd(['R', 'fails']), 'Do they fail with the service')]), el('span', { class: 'fxmuted sm', text: 'How many · can they reach them, in time and at a cost they can bear? · do they fail with the service?' }), txt(Rr.who, upd(['R', 'who']), 'Who they are', 'Who the other providers are')]),
        el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Another way, from their side' }), el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [sel(NKIND, Nn.kind, upd(['N', 'kind']), 'Another way'), sel(YN, Nn.fails, upd(['N', 'fails']), 'Does it fail with the service')]), el('span', { class: 'fxmuted sm', text: 'What · does it fail with the service?' }), txt(Nn.what, upd(['N', 'what']), 'What it is', 'What the other way is')])]));
      box.appendChild(el('div', { class: 'fxqs two' }, [el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'What the alternatives share with the service' }), txt(k.root, upd(['root']), 'The same rota, the same results system', 'Shared root')]), el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'Whose account this is' }), el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [txt(k.voice, upd(['voice']), 'Their own words, or who spoke for them', 'Whose account'), sel([['', 'Their own voice?'], ['own', 'Their own voice'], ['proxy', 'A proxy']], k.voiceKind, upd(['voiceKind']), 'Own voice or proxy'), sel(EVQ, k.ev, upd(['ev']), 'How good is the evidence')])])]));
      var mxv = k.mx || {};
      box.appendChild(el('div', { class: 'fxq' }, [el('label', { class: 'fxql', text: 'On the exposure matrix' }), el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [el('span', { class: 'fxmuted sm', text: 'Value at stake' }), sel(LVL, mxv.y, upd(['mx', 'y']), 'Value at stake, by hand'), el('span', { class: 'fxmuted sm', text: 'Cost of a substitute' }), sel(LVL, mxv.x, upd(['mx', 'x']), 'Cost of a substitute, by hand'), sel(DRIFT, k.drift, upd(['drift']), 'Drift or renewal')])]));
      box.appendChild(scorePanel(k, upd));
      if (k.voiceKind === 'proxy' && orderKey(k)[0] === 0) box.appendChild(el('p', { class: 'skwarn', text: 'A loss that cannot be put back, told by a proxy: find a route to their own voice before the threshold is set.' }));
      if (!ro()) box.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [depth ? null : el('button', { class: 'btn sm', type: 'button', text: 'It splits: add a segment', onclick: function () { save(function (d) { d.cards.push({ id: nid('g', d.cards), parent: k.id, n: '', svc: k.svc, V: {}, I: {}, R: {}, N: {} }); }, 'segment').then(X.render); } }), el('button', { class: 'btn sm', type: 'button', text: 'Remove', onclick: function () { save(function (d) { d.cards = d.cards.filter(function (y) { return y.id !== k.id && y.parent !== k.id; }); }, 'remove').then(X.render); } })]));
      return box;
    };
    top.forEach(function (k) { wrap.appendChild(card(k, 0)); cards.filter(function (y) { return y.parent === k.id; }).forEach(function (s) { wrap.appendChild(card(s, 1)); }); });
    if (!ro()) {
      var exposedOut = cellsOf(c).filter(function (x) { return (x.exposed || x.exposedC) && x.p.where === 'outside' && !cards.some(function (k) { return k.from === x.p.id; }); });
      wrap.appendChild(el('div', { class: 'row', style: 'gap:8px;margin:12px 0' }, [el('button', { class: 'btn sm', type: 'button', id: 'skAddCard', text: 'Add a group', onclick: function () { save(function (d) { d.cards = d.cards || []; d.cards.push({ id: nid('g', d.cards), n: '', V: {}, I: {}, R: {}, N: {} }); }, 'group').then(X.render); } }),
        exposedOut.length ? el('button', { class: 'btn sm', type: 'button', id: 'skFromMap', text: 'Add the exposed groups from the stakeholder map (' + exposedOut.length + ')', onclick: function () { save(function (d) { d.cards = d.cards || []; exposedOut.forEach(function (x) { d.cards.push({ id: nid('g', d.cards), from: x.p.id, n: x.p.n, voice: x.p.voice || '', V: {}, I: {}, R: {}, N: {} }); }); }, 'from map').then(X.render); } }) : null]));
    }
    // shared roots
    var shared = cards.filter(function (k) { return (k.R && k.R.fails === 'yes') || (k.N && k.N.fails === 'yes'); });
    var sr = el('section', { class: 'fxcard', id: 'skShared' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Alternatives that fail together' }), el('span', { class: 'fxgrow' })])]);
    sr.appendChild(shared.length ? el('ul', {}, shared.map(function (k) { return el('li', { text: (k.n || 'Unnamed') + ': ' + (k.root || 'the alternative fails with the service; say why') }); })) : el('p', { class: 'fxmuted', text: 'None found yet. For every alternative, ask: does it rely on the same people, systems or place as the service?' }));
    wrap.appendChild(sr);
    // omissions
    var om = el('section', { class: 'fxcard', id: 'skOmit' }, [el('div', { class: 'fxqhead' }, [el('h2', { class: 'fxsech', text: 'Who we left out, and why' }), el('span', { class: 'fxgrow' })]), el('p', { class: 'fxmuted', text: 'At least one. A profile with nobody left out has not looked hard enough.' })]);
    (c.omissions || []).forEach(function (o, i) { om.appendChild(el('div', { class: 'row', style: 'gap:6px;margin:4px 0' }, [txt(o.n, function (v) { save(function (d) { d.omissions[i].n = v; }, 'omission'); }, 'Who', 'Who was left out'), txt(o.why, function (v) { save(function (d) { d.omissions[i].why = v; }, 'omission'); }, 'Why', 'Why they were left out')])); });
    if (!(c.omissions || []).some(function (o) { return o.n; })) om.appendChild(el('p', { class: 'skwarn', text: 'Nobody listed yet.' }));
    if (!ro()) om.appendChild(el('button', { class: 'btn sm', type: 'button', text: 'Add someone left out', onclick: function () { save(function (d) { d.omissions = d.omissions || []; d.omissions.push({ n: '', why: '' }); }, 'omission').then(X.render); } }));
    wrap.appendChild(om);
    wrap.appendChild(X.evqBar('f:exposure', 'Frame: how exposed they are', 'frame'));
    wrap.appendChild(X.fxFoot(['Who is exposed', '#stake'], ['Where the threshold is', '#line'], 'The most exposed groups set their threshold first. Diagnose tests these profiles against the evidence.'));
  }

  // what the line page needs: the most exposed groups, for the first column
  function mostExposed(n) { var r = X.row('stake'), c = (r && r.content) || {}; return ranked(c.cards || []).slice(0, n || 3).map(function (x) { return x.worst ? x.c.n + ' (worst off: ' + x.worst.n + ')' : x.c.n; }); }
  function css() {
    if (document.getElementById('skCss')) return;
    var s = document.createElement('style'); s.id = 'skCss';
    s.textContent = [
      '.skstrip{display:flex;flex-wrap:wrap;gap:0;border:1px solid var(--line);margin:4px 0 18px}.skstrip a{flex:1;min-width:150px;padding:9px 14px;text-decoration:none;color:inherit;border-right:1px solid var(--line);font-size:14px}.skstrip a:last-child{border-right:0}.skstrip a.on{background:var(--paper,#141414);color:var(--bg,#f4f3f0)}.skstrip b{font-family:"DM Mono",monospace;font-size:12px;margin-right:4px}',
      '.sk .fxcard{margin-top:16px}.skscroll{overflow-x:auto}.sktab{min-width:1100px}.sktab td{vertical-align:top}.sktab td:first-child{min-width:230px}.sktab input[type=text]{min-width:170px;width:100%}.sktab select{max-width:180px}.sktab td>*{display:block;margin:2px 0}.sktab td>.skcaps{display:grid}.sk select{max-width:100%}',
      '.skcaps{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:12px;min-width:170px}.skcaps label{display:flex;gap:4px;align-items:center}',
      '.skplacers{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.skcells{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:700px){.skcells{grid-template-columns:1fr}}.skcell{border:1px solid var(--line);padding:10px 12px}.skcell h3{margin:0 0 2px;font-size:18px}.skcell ul{margin:6px 0 0;padding-left:18px}.skcell .fxtag{margin-left:6px}',
      '.skwarn{border-left:4px solid var(--accent,#e07030);padding:6px 10px;margin:10px 0}.skchk{display:flex;gap:8px;align-items:center;margin:4px 0}',
      '.skmx{display:grid;grid-template-columns:120px repeat(3,1fr);border-top:1px solid var(--line);border-left:1px solid var(--line);margin:8px 0}.skmxc{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:6px;min-height:58px;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start;position:relative}.skmxh{min-height:0;font-size:12px;font-family:"DM Mono",monospace;text-transform:uppercase;letter-spacing:.04em;align-items:center}.skmxc.hot{background:color-mix(in srgb,var(--accent,#e07030) 18%,transparent)}.skmxc.warm{background:color-mix(in srgb,var(--accent,#e07030) 7%,transparent)}.skmxl{width:100%;font-size:12px;font-weight:700}.skchip{border:1px solid var(--line);padding:2px 7px;font-size:12.5px;line-height:1.35;background:var(--bg,#fff)}.skchip.lb{border:2px solid currentColor;font-weight:600}.skchip.contested{border-style:dashed}@media(max-width:700px){.skmx{grid-template-columns:72px repeat(3,1fr)}.skchip{font-size:11px}}',
      '.skxwrap{display:grid;grid-template-columns:minmax(0,560px) minmax(220px,1fr);gap:16px;align-items:start}@media(max-width:860px){.skxwrap{grid-template-columns:1fr}}.skxwrap>p{grid-column:1/-1;margin:2px 0}.skxm{width:100%;height:auto;color:inherit}.skxframe{fill:none;stroke:var(--line);}.skxmid{stroke:var(--line);stroke-dasharray:3 4}.skxhot{fill:color-mix(in srgb,var(--accent,#e07030) 14%,transparent)}.skxtol{fill:none;stroke:var(--accent,#e07030);stroke-width:2;stroke-dasharray:7 5}.skxq{font-size:12px;fill:currentColor;opacity:.75}.skxq.b{font-weight:700;opacity:1}.skxq.i{font-style:italic;fill:var(--accent,#e07030);opacity:1}.skxa{font-size:13px;fill:currentColor;font-weight:600}.skxt{font-size:11px;fill:currentColor;opacity:.7}.skxpt circle,.skxpt rect{fill:var(--paper,#141414);stroke:var(--paper,#141414);stroke-width:2}.skxpt text{fill:var(--bg,#f4f3f0);font-size:11px;font-weight:700;font-family:"DM Mono",monospace}.skxpt.seg circle,.skxpt.seg rect{fill:var(--bg,#fff)}.skxpt.seg text{fill:currentColor}.skxpt.guess circle,.skxpt.guess rect{stroke-dasharray:3 2;stroke:var(--accent,#e07030)}.skxarr{stroke:var(--accent,#e07030);stroke-width:2}.skxarr.away{stroke:var(--ok,#2e8b57)}.skxarrh{fill:var(--accent,#e07030)}.skxleg{margin:0;padding-left:0;list-style:none;font-size:14px}.skxleg li{margin:0 0 6px}.skscore{margin-top:10px}.skscore summary{cursor:pointer;font-weight:600}.skscore input[type=text]{min-width:90px;width:100%}.skscoretab{min-width:760px}.skscoretab td:first-child{min-width:300px}.skscoretab td:nth-child(2){width:80px}.skscoretab td:nth-child(2) input{min-width:0}.skscoretab th select{width:100%}.skscoretab td select{width:auto}',
      '.skrank{margin:6px 0 0;padding-left:22px}.skrank li{margin:4px 0}.skrank .fxtag{margin-left:8px}.skcard.skseg{margin-left:28px;border-left:4px solid var(--line)}.skv select{min-width:0;width:100%}.skv th{white-space:nowrap}.sk .fxqs.two .row select{flex:1 1 140px;min-width:0}.sk .fxq input[type=text]{width:100%}'].join('\n');
    document.head.appendChild(s);
  }
  function render(main, x, part) { X = x; el = x.el; S = x.S; css(); return part === 'how' ? renderHow(main) : renderWho(main); }
  window.VTStake = { render: render, strip: function (x, cur) { X = x; el = x.el; S = x.S; css(); return strip(cur); }, mostExposed: function (x, n) { X = x; el = x.el; S = x.S; return mostExposed(n); }, ranked: ranked, orderKey: orderKey };
})();
