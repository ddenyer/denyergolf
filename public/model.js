// The model in the Viability Thinking Lab: one shared map of the service, drawn as
// different kinds of model. Every model reads the same processes, resources and people
// (saved in the 'inventory' tile) and adds what is particular to it. Each model has the
// same frame: a row of views, Edit and Export. Loaded after problem.js, which hands over
// its helpers through window.VTX.
(function () {
  'use strict';
  var X, el, esc, S, NS = 'http://www.w3.org/2000/svg';

  // ---------- shared vocabulary ----------
  var NOTS = ['Not imagined', 'Not searched for', 'Not noticed', 'Not told', 'Not integrated', 'Not understood', 'Not owned', 'Not able', 'Not willing', 'Not acted on', 'Not corrected', 'Not renewed'];
  var PHASES = ['Normal operations', 'The event', 'Crisis response', 'Investigation', 'Learning', 'Putting it right'];
  var KIND_EV = { incident: 'Incident', near: 'Near miss', warning: 'Warning sign', decision: 'Decision', change: 'Change' };
  var LANES = [['person', 'What the person does'], ['front', 'Front stage: what they see'], ['back', 'Back stage: what they do not see'], ['support', 'Support processes and systems']];
  var BSTATE = { working: ['Working', '#3a9b63'], weak: ['Weak', '#e2a52b'], failed: ['Failed', '#d9472b'], untested: ['Not tested', '#8a8f98'] };
  var ALEVELS = ['Government and policy', 'Regulators and professional bodies', 'The organisation and its board', 'Management and supervision', 'Front-line work', 'Equipment, systems and surroundings', 'Outcome'];
  var FKIND = { human: 'Human', tech: 'Technological', org: 'Organisational' };
  var TIES = { info: 'Passes information', advice: 'Asks for advice', authority: 'Gives authority', handover: 'Hands over work', watches: 'Checks the work of' };
  var ASPECTS = [['I', 'Input'], ['O', 'Output'], ['P', 'Precondition'], ['R', 'Resource'], ['T', 'Time'], ['C', 'Control']];
  var BEERFN = [['s1', 'Operations (System 1)'], ['s2', 'Coordination (System 2)'], ['s3', 'Control (System 3)'], ['s3s', 'Audit (System 3*)'], ['s4', 'Intelligence (System 4)'], ['s5', 'Policy (System 5)'], ['ind', 'Carried by individuals']];
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ---------- small helpers ----------
  var byId = function (list, id) { return (list || []).filter(function (x) { return x.id === id; })[0]; };
  var nameOf = function (list, id) { var x = byId(list, id); return x ? x.n : ''; };
  var wrap = function (label, max) { var words = String(label || '').split(/\s+/), lines = [], cur = ''; words.forEach(function (w) { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur); return lines; };
  function svgText(x, y, label, max, cls, lh) { var ls = wrap(label, max || 18).slice(0, 4); lh = lh || 13; return ls.map(function (l, i) { return '<text class="' + (cls || 'mt') + '" x="' + x + '" y="' + (y + (i - (ls.length - 1) / 2) * lh + 4) + '" text-anchor="middle">' + esc(l) + '</text>'; }).join(''); }
  function dwrap(svg) { return el('div', { class: 'dscroll' }, [svg]); }
  function svgEl(W, H, inner, cls) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('class', 'msvg ' + (cls || '')); s.innerHTML = '<defs><marker id="mar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:rgba(160,152,144,.9)"/></marker><marker id="marA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:#e07030"/></marker></defs>' + inner; return s; }
  function table(head, rows, cls) {
    var t = el('table', { class: 'itab ' + (cls || '') });
    t.appendChild(el('tr', {}, head.map(function (h) { return el('th', { text: h }); })));
    rows.forEach(function (r) { t.appendChild(el('tr', { class: r.cls || '' }, (r.cells || r).map(function (c) { return c && c.nodeType ? el('td', {}, [c]) : el('td', { text: c == null ? '' : String(c) }); }))); });
    return el('div', { class: 'iscroll' }, [t]);
  }
  var tag = function (text, colour) { return el('span', { class: 'rtag', style: 'background:' + colour, text: text }); };
  var kpi = function (k, val, warn) { return el('div', { class: 'kpi2' }, [el('div', { class: 'muted sm', text: k }), el('div', { class: 'kv' + (warn ? ' warn' : ''), text: val })]); };
  var note = function (t) { return el('p', { class: 'meta', text: t }); };
  function hours(s) { var m = /([\d.]+)\s*(min|minute|hour|hr|h\b|day|week)?/i.exec(String(s || '')); if (!m) return null; var n = Number(m[1]), u = (m[2] || 'hour').toLowerCase(); return u.indexOf('min') === 0 ? n / 60 : u.indexOf('day') === 0 ? n * 24 : u.indexOf('week') === 0 ? n * 168 : n; }
  var procs = function (v) { return v.processes || []; }, ress = function (v) { return v.resources || []; };
  var resOpts = function (v) { return [['', 'None']].concat(ress(v).map(function (r) { return [r.id, r.n]; })); };
  var procOpts = function (v) { return procs(v).map(function (p) { return [p.id, p.n]; }); };

  // =====================================================================
  // The models. Each one: id, name, the key it keeps its own data under (or none when
  // it is drawn wholly from the shared map), a subject line, its views, what Edit shows,
  // and what Export gives.
  // =====================================================================
  var MODELS = [];

  // ---------- customer journey ----------
  MODELS.push({
    id: 'journey', name: 'Customer journey', key: 'journey',
    about: 'The service as the person it is for lives it, step by step: what they do, what they meet, how it feels, and where it goes wrong.',
    subject: function (v, m) { return m.persona ? 'The journey of ' + m.persona.charAt(0).toLowerCase() + m.persona.slice(1) : 'The person the service is for'; },
    empty: function (v, m) { return !(m.stages || []).length; },
    views: [['map', 'Journey'], ['moments', 'Moments that matter'], ['behind', 'Behind each step']],
    edit: { root: [{ k: 'persona', l: 'The person the service is for', t: 'text' }, { k: 'goal', l: 'What they are trying to get done', t: 'text' }, { k: 'good', l: 'The good journey traced (which case, chosen by whom)', t: 'long' }, { k: 'voice', l: 'How it feels, in their own words (with consent)', t: 'long' }],
      lists: [{ k: 'stages', title: 'Steps, in order', blank: function () { return { n: '', doing: '', touch: '', feel: 0, pain: '', proc: [] }; },
        fields: [{ k: 'n', l: 'Step', t: 'text' }, { k: 'doing', l: 'What they do', t: 'text' }, { k: 'touch', l: 'What they meet', t: 'text' }, { k: 'feel', l: 'How it feels', t: 'sel', o: function () { return [['2', 'Very good'], ['1', 'Good'], ['0', 'Neutral'], ['-1', 'Poor'], ['-2', 'Very poor']]; } }, { k: 'pain', l: 'Where it goes wrong', t: 'long' }, { k: 'proc', l: 'Processes behind this step', t: 'multi', o: procOpts }] }] },
    registers: function (v, m) { return [{ name: 'journey', head: ['Step', 'What they do', 'What they meet', 'How it feels (-2 to 2)', 'Where it goes wrong', 'Processes behind it'], rows: (m.stages || []).map(function (s) { return [s.n, s.doing, s.touch, s.feel, s.pain, (s.proc || []).map(function (p) { return nameOf(procs(v), p); }).join('; ')]; }) }]; },
    draw: {
      map: function (v, m, host) {
        var st = m.stages || [], W = Math.max(900, st.length * 170), H = 150, step = W / st.length, s = '';
        s += '<line class="mzero" x1="0" y1="75" x2="' + W + '" y2="75"/>';
        var pts = st.map(function (x, i) { return [step * i + step / 2, 75 - Number(x.feel || 0) * 28]; });
        s += '<polyline class="mcurve" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
        pts.forEach(function (p, i) { var f = Number(st[i].feel || 0); s += '<circle class="mpt ' + (f < 0 ? 'bad' : f > 0 ? 'good' : '') + '" cx="' + p[0] + '" cy="' + p[1] + '" r="7"/>'; });
        s += '<text class="mt sm" x="6" y="18" text-anchor="start">Better</text><text class="mt sm" x="6" y="142" text-anchor="start">Worse</text>';
        host.appendChild(el('div', { class: 'jcurve' }, [svgEl(W, H, s)]));
        var g = el('div', { class: 'jcols', style: 'grid-template-columns:repeat(' + st.length + ',minmax(150px,1fr))' });
        st.forEach(function (x, i) {
          g.appendChild(el('div', { class: 'jcol' + (Number(x.feel) < 0 ? ' bad' : ''), 'data-id': x.id }, [el('div', { class: 'flab', text: 'Step ' + (i + 1) }), el('b', { text: x.n }),
            x.doing ? el('div', { class: 'sm', text: 'Does: ' + x.doing }) : null, x.touch ? el('div', { class: 'sm muted', text: 'Meets: ' + x.touch }) : null, x.pain ? el('div', { class: 'jf', text: x.pain }) : null]));
        });
        host.appendChild(el('div', { class: 'iscroll' }, [g]));
      },
      moments: function (v, m, host) {
        var st = (m.stages || []).slice().sort(function (a, b) { return Number(a.feel) - Number(b.feel); });
        host.appendChild(table(['Step', 'How it feels', 'Where it goes wrong', 'Single points of failure behind it'], st.map(function (x) {
          var sp = ress(v).filter(function (r) { return X.isSpof(r) && (r.u || []).some(function (u) { return (x.proc || []).indexOf(u) >= 0; }); }).map(function (r) { return r.n; });
          return { cls: Number(x.feel) < 0 ? 'sp' : '', cells: [x.n, ['Very poor', 'Poor', 'Neutral', 'Good', 'Very good'][Number(x.feel) + 2], x.pain, sp.join('; ')] };
        })));
        host.appendChild(note('The steps that feel worst come first. Shaded rows are where the person is let down; the last column shows the single points of failure in the processes behind that step.'));
      },
      behind: function (v, m, host) {
        (m.stages || []).forEach(function (x, i) {
          var ps = (x.proc || []).map(function (id) { return byId(procs(v), id); }).filter(Boolean);
          host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: (i + 1) + '. ' + x.n }),
            ps.length ? el('ul', { class: 'tl' }, ps.map(function (p) { var rs = ress(v).filter(function (r) { return (r.u || []).indexOf(p.id) >= 0; }); return el('li', {}, [el('b', { text: p.n }), document.createTextNode(': ' + rs.map(function (r) { return r.n + (X.isSpof(r) ? ' (single point of failure)' : ''); }).join('; '))]); })) : el('div', { class: 'sm muted', text: 'No process linked yet' })]));
        });
      }
    }
  });

  // ---------- service blueprint ----------
  MODELS.push({
    id: 'blueprint', name: 'Service blueprint', key: 'blueprint',
    about: 'The journey with what lies behind it: what the person sees, the work they do not see, and the systems that support it, against what should happen.',
    subject: function (v) { return v.service || 'The service'; },
    empty: function (v, m) { return !(m.cells || []).length; },
    views: [['grid', 'Blueprint'], ['fails', 'Fail points'], ['should', 'What should happen']],
    edit: { lists: [
      { k: 'cells', title: 'What happens, by step and lane', blank: function () { return { st: '', lane: 'front', t: '', fail: false, res: [] }; },
        fields: [{ k: 'st', l: 'Step', t: 'sel', o: function (v) { return stageOpts(v); } }, { k: 'lane', l: 'Lane', t: 'sel', o: function () { return LANES; } }, { k: 't', l: 'What happens', t: 'long' }, { k: 'fail', l: 'A fail point', t: 'bool' }, { k: 'fn', l: 'Beer function', t: 'sel', o: function () { return [['', 'Not yet tagged']].concat(BEERFN); } }, { k: 'phase', l: 'Phase', t: 'sel', o: function () { return [['', 'Not set']].concat(PHASES.map(function (p) { return [p, p]; })); } }, { k: 'res', l: 'Resources', t: 'multi', o: function (v) { return resOpts(v).slice(1); } }] },
      { k: 'should', title: 'What should happen at each step', blank: function () { return { st: '', t: '' }; }, fields: [{ k: 'st', l: 'Step', t: 'sel', o: function (v) { return stageOpts(v); } }, { k: 't', l: 'What should happen', t: 'long' }] }] },
    registers: function (v, m) { return [{ name: 'blueprint', head: ['Step', 'Lane', 'What happens', 'Fail point', 'Resources'], rows: (m.cells || []).map(function (c) { return [stageName(v, c.st), laneName(c.lane), c.t, c.fail ? 'Yes' : 'No', (c.res || []).map(function (r) { return nameOf(ress(v), r); }).join('; ')]; }) }]; },
    draw: {
      grid: function (v, m, host) {
        var st = stages(v); if (!st.length) { host.appendChild(note('Add steps to the customer journey first: the blueprint uses them as its columns.')); return; }
        var g = el('div', { class: 'bp', style: 'grid-template-columns:170px repeat(' + st.length + ',minmax(150px,1fr))' });
        g.appendChild(el('div', { class: 'bph' })); st.forEach(function (s) { g.appendChild(el('div', { class: 'bph', text: s.n })); });
        g.appendChild(el('div', { class: 'bpl should', text: 'What should happen' }));
        st.forEach(function (s) { var x = (m.should || []).filter(function (y) { return y.st === s.id; })[0]; g.appendChild(el('div', { class: 'bpc should', text: x ? x.t : '' })); });
        LANES.forEach(function (L) {
          g.appendChild(el('div', { class: 'bpl' + (L[0] === 'back' ? ' vis' : ''), text: L[1] }));
          st.forEach(function (s) {
            var cs = (m.cells || []).filter(function (c) { return c.st === s.id && c.lane === L[0]; });
            g.appendChild(el('div', { class: 'bpc' + (L[0] === 'back' ? ' vis' : '') }, cs.map(function (c) { return el('div', { class: 'bpi' + (c.fail ? ' fail' : ''), 'data-id': c.id, title: (c.res || []).map(function (r) { return nameOf(ress(v), r); }).join('; ') }, [c.fail ? el('span', { class: 'bpf', text: '!' }) : null, document.createTextNode(c.t)]); })));
          });
        });
        host.appendChild(el('div', { class: 'iscroll' }, [g]));
        host.appendChild(note('The dashed line under the front stage is the line of visibility: below it is work the person does not see. A red mark is a fail point.'));
      },
      fails: function (v, m, host) {
        var fs = (m.cells || []).filter(function (c) { return c.fail; });
        host.appendChild(table(['Step', 'Lane', 'What goes wrong', 'Resources involved'], fs.map(function (c) { return [stageName(v, c.st), laneName(c.lane), c.t, (c.res || []).map(function (r) { var x = byId(ress(v), r); return x ? x.n + (X.isSpof(x) ? ' (single point of failure)' : '') : ''; }).join('; ')]; })));
      },
      should: function (v, m, host) {
        host.appendChild(table(['Step', 'What should happen', 'What does happen (fail points)'], stages(v).map(function (s) { var x = (m.should || []).filter(function (y) { return y.st === s.id; })[0]; return { cls: (m.cells || []).some(function (c) { return c.st === s.id && c.fail; }) ? 'sp' : '', cells: [s.n, x ? x.t : '', (m.cells || []).filter(function (c) { return c.st === s.id && c.fail; }).map(function (c) { return c.t; }).join('; ')] }; })));
      }
    }
  });
  function stages(v) { return ((v.journey || {}).stages) || []; }
  function stageOpts(v) { return stages(v).map(function (s) { return [s.id, s.n]; }); }
  function stageName(v, id) { return nameOf(stages(v), id); }
  function laneName(id) { var l = LANES.filter(function (x) { return x[0] === id; })[0]; return l ? l[1] : ''; }

  // ---------- process map (drawn from the shared map) ----------
  MODELS.push({
    id: 'process', name: 'Process map', key: null,
    about: 'The processes in order, in swimlanes by who owns them. Every move between lanes is a handoff, and handoffs are where work gets lost.',
    subject: function (v) { return v.service || 'The service'; },
    empty: function (v) { return !procs(v).length; },
    views: [['swim', 'Swimlanes'], ['handoffs', 'Handoffs'], ['steps', 'Steps']],
    editShared: true,
    registers: function (v) { return [{ name: 'steps', head: ['Order', 'Process', 'Owner', 'Resources', 'How it fails'], rows: procs(v).map(function (p, i) { return [i + 1, p.n, p.owner, ress(v).filter(function (r) { return (r.u || []).indexOf(p.id) >= 0; }).map(function (r) { return r.n; }).join('; '), p.fails]; }) }, { name: 'handoffs', head: ['From', 'From owner', 'To', 'To owner'], rows: handoffs(v).map(function (h) { return [h.a.n, h.a.owner, h.b.n, h.b.owner]; }) }]; },
    draw: {
      swim: function (v, m, host) {
        var ps = procs(v), owners = []; ps.forEach(function (p) { var o = p.owner || 'No owner named'; if (owners.indexOf(o) < 0) owners.push(o); });
        var LW = 170, CW = 170, LH = 78, W = LW + ps.length * CW + 20, H = owners.length * LH + 10, s = '';
        owners.forEach(function (o, i) { s += '<rect class="lane' + (i % 2 ? ' alt' : '') + '" x="0" y="' + (i * LH) + '" width="' + W + '" height="' + LH + '"/>' + svgText(LW / 2, i * LH + LH / 2, o, 20, 'mt b'); });
        var pos = ps.map(function (p, i) { return [LW + i * CW + CW / 2, owners.indexOf(p.owner || 'No owner named') * LH + LH / 2]; });
        ps.forEach(function (p, i) { if (i) { var a = pos[i - 1], b = pos[i], ho = a[1] !== b[1]; s += '<path class="medge' + (ho ? ' ho' : '') + '" d="M' + (a[0] + 62) + ',' + a[1] + ' C' + (a[0] + 95) + ',' + a[1] + ' ' + (b[0] - 95) + ',' + b[1] + ' ' + (b[0] - 64) + ',' + b[1] + '" marker-end="url(#' + (ho ? 'marA' : 'mar') + ')"/>'; } });
        ps.forEach(function (p, i) { var x = pos[i][0], y = pos[i][1]; s += '<g class="mbox' + (p.fails ? ' fails' : '') + '" data-id="' + p.id + '"><rect x="' + (x - 62) + '" y="' + (y - 26) + '" width="124" height="52" rx="8"/>' + svgText(x, y, (i + 1) + '. ' + p.n, 19) + '</g>'; });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
        host.appendChild(note('Orange arrows are handoffs between owners. A box with a red edge has a known way of failing.'));
      },
      handoffs: function (v, m, host) {
        var hs = handoffs(v);
        host.appendChild(el('div', { class: 'kpis' }, [kpi('Processes', String(procs(v).length)), kpi('Owners', String(uniq(procs(v).map(function (p) { return p.owner; })).length)), kpi('Handoffs', String(hs.length), hs.length > 2), kpi('Handoffs into a step that fails', String(hs.filter(function (h) { return h.b.fails; }).length), true)]));
        host.appendChild(el('div', { style: 'margin-top:12px' }, [table(['From', 'Owner', 'To', 'Owner', 'How the receiving step fails'], hs.map(function (h) { return { cls: h.b.fails ? 'sp' : '', cells: [h.a.n, h.a.owner, h.b.n, h.b.owner, h.b.fails] }; }))]));
      },
      steps: null
    }
  });
  MODELS[MODELS.length - 1].draw.steps = function (v, m, host) { host.appendChild(table(['Order', 'Process', 'Owner', 'Resources', 'How it fails'], procs(v).map(function (p, i) { return { cls: p.fails ? 'sp' : '', cells: [i + 1, p.n, p.owner, ress(v).filter(function (r) { return (r.u || []).indexOf(p.id) >= 0; }).map(function (r) { return r.n; }).join('; '), p.fails] }; }))); };
  function handoffs(v) { var ps = procs(v), out = []; for (var i = 1; i < ps.length; i++) if ((ps[i].owner || '') !== (ps[i - 1].owner || '')) out.push({ a: ps[i - 1], b: ps[i] }); return out; }
  var uniq = function (a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); };

  // ---------- timeline ----------
  MODELS.push({
    id: 'timeline', name: 'Timeline', key: 'timeline',
    about: 'What happened when, against the phases of an event: from normal operations, through the event and the response, to investigation, learning and putting it right. The incidents here also calibrate the agent-based model.',
    subject: function (v, m) { var e = (m.events || []).map(function (x) { return x.d; }).filter(Boolean).sort(); return e.length ? 'From ' + fmtD(e[0]) + ' to ' + fmtD(e[e.length - 1]) : 'Events over time'; },
    empty: function (v, m) { return !(m.events || []).length; },
    views: [['time', 'Time view'], ['list', 'Event list'], ['phases', 'By phase'], ['incidents', 'Incident history']],
    edit: { lists: [{ k: 'events', title: 'Events', blank: function () { return { d: '', n: '', phase: PHASES[0], kind: 'incident', res: '', hours: null, note: '' }; },
      fields: [{ k: 'd', l: 'Date (year-month-day)', t: 'text' }, { k: 'n', l: 'What happened', t: 'text' }, { k: 'phase', l: 'Phase', t: 'sel', o: function () { return PHASES.map(function (p) { return [p, p]; }); } }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return Object.keys(KIND_EV).map(function (k) { return [k, KIND_EV[k]]; }); } }, { k: 'res', l: 'Resource affected', t: 'sel', o: resOpts }, { k: 'hours', l: 'How long (hours)', t: 'num' }, { k: 'src', l: 'Source (document and page, or person by role)', t: 'text' }, { k: 'note', l: 'Note', t: 'long' }] }] },
    registers: function (v, m) { return [{ name: 'timeline', head: ['Date', 'What happened', 'Phase', 'Kind', 'Resource', 'Hours', 'Note'], rows: sortEv(m.events).map(function (e) { return [e.d, e.n, e.phase, KIND_EV[e.kind], nameOf(ress(v), e.res), e.hours, e.note]; }) }]; },
    draw: {
      time: function (v, m, host) {
        var ev = sortEv(m.events).filter(function (e) { return e.d && !isNaN(new Date(e.d)); }); if (!ev.length) return;
        var zoom = S.tlZoom || 'all', last = +new Date(ev[ev.length - 1].d), span = { all: 0, year: 365, quarter: 92 }[zoom];
        if (span) ev = ev.filter(function (e) { return +new Date(e.d) >= last - span * 864e5; });
        host.appendChild(el('div', { class: 'seg', style: 'margin-bottom:10px' }, [['all', 'Everything'], ['year', 'The last year'], ['quarter', 'The last three months']].map(function (z) { return el('button', { 'aria-pressed': String(zoom === z[0]), 'data-zoom': z[0], text: z[1], onclick: function () { S.tlZoom = z[0]; X.render(); } }); })));
        var t0 = +new Date(ev[0].d), t1 = +new Date(ev[ev.length - 1].d); if (t1 - t0 < 864e5 * 20) { t0 -= 864e5 * 10; t1 += 864e5 * 10; }
        var W = 1180, P = 24, x = function (d) { return P + (+new Date(d) - t0) / (t1 - t0) * (W - 2 * P); }, CH = 6.2;
        // each label takes the first row where it does not run into the one before it
        var rowsEnd = [], place = ev.map(function (e) {
          var cx = x(e.d), text = e.n.length > 46 ? e.n.slice(0, 44).replace(/\s+\S*$/, '') + '…' : e.n, w = text.length * CH + 16, left = cx + w > W - P;
          var a = left ? cx - w : cx, b = left ? cx : cx + w, r = 0; while (rowsEnd[r] != null && rowsEnd[r] > a - 6) r++; rowsEnd[r] = b;
          return { e: e, cx: cx, text: text, left: left, row: r };
        });
        var RH = 24, top = 54, base = top + rowsEnd.length * RH + 14, H = base + 40, s = '';
        // the phases, as a strip along the top
        PHASES.forEach(function (ph, i) { var es = ev.filter(function (e) { return e.phase === ph; }); if (!es.length) return; var a = x(es[0].d), b = x(es[es.length - 1].d), nx = PHASES.slice(i + 1).map(function (p2) { return ev.filter(function (e) { return e.phase === p2; })[0]; }).filter(Boolean)[0]; if (nx) b = Math.max(b, x(nx.d) - 2); else b = Math.max(b, a + 10);
          s += '<rect class="phase p' + i + '" x="' + (a - 4) + '" y="10" width="' + Math.max(10, b - a + 8) + '" height="22" rx="4"/>' + (b - a > ph.length * 6.4 ? '<text class="mt xs" x="' + (a + 4) + '" y="25" text-anchor="start">' + esc(ph) + '</text>' : '<text class="mt xs" x="' + ((a + b) / 2) + '" y="25" text-anchor="middle">' + (i + 1) + '</text>'); });
        s += '<line class="mzero" x1="' + P + '" y1="' + base + '" x2="' + (W - P) + '" y2="' + base + '"/>';
        var y0 = new Date(t0).getFullYear(), y1 = new Date(t1).getFullYear(), months = (t1 - t0) / 864e5 < 400;
        for (var y = y0; y <= y1; y++) for (var mo = 0; mo < 12; mo++) { if (!months && mo) continue; var dt = +new Date(y, mo, 1); if (dt < t0 || dt > t1) continue; s += '<line class="tick" x1="' + x(dt) + '" y1="' + (base - 4) + '" x2="' + x(dt) + '" y2="' + (base + 4) + '"/><text class="mt xs" x="' + x(dt) + '" y="' + (base + 18) + '" text-anchor="middle">' + (months ? new Date(dt).toLocaleDateString('en-GB', { month: 'short' }) + (mo === 0 ? ' ' + y : '') : y) + '</text>'; }
        place.forEach(function (q) { var cy = top + q.row * RH; s += '<g class="tev k-' + q.e.kind + '" data-id="' + q.e.id + '"><title>' + esc(fmtD(q.e.d) + ': ' + q.e.n) + '</title><line class="tstem" x1="' + q.cx + '" y1="' + cy + '" x2="' + q.cx + '" y2="' + base + '"/><circle cx="' + q.cx + '" cy="' + cy + '" r="5.5"/><text class="mt xs" x="' + (q.left ? q.cx - 9 : q.cx + 9) + '" y="' + (cy + 4) + '" text-anchor="' + (q.left ? 'end' : 'start') + '">' + esc(q.text) + '</text></g>'; });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide tl')));
        var phk = PHASES.map(function (ph, i) { var es = ev.filter(function (e) { return e.phase === ph; }); return es.length ? el('span', {}, [el('i', { class: 'pk p' + i }), document.createTextNode((i + 1) + '. ' + ph + ' (' + fmtD(es[0].d) + (es.length > 1 ? ' to ' + fmtD(es[es.length - 1].d) : '') + ')')]) : null; }).filter(Boolean);
        host.appendChild(el('div', { class: 'invkey' }, Object.keys(KIND_EV).map(function (k) { return el('span', {}, [el('i', { class: 'kd k-' + k }), document.createTextNode(KIND_EV[k])]); })));
        host.appendChild(el('div', { class: 'invkey' }, phk));
      },
      list: function (v, m, host) { host.appendChild(table(['Date', 'What happened', 'Phase', 'Kind', 'Resource', 'Hours'], sortEv(m.events).map(function (e) { return [fmtD(e.d), e.n, e.phase, KIND_EV[e.kind], nameOf(ress(v), e.res), e.hours || '']; }))); },
      phases: function (v, m, host) {
        PHASES.forEach(function (ph) { var es = sortEv(m.events).filter(function (e) { return e.phase === ph; }); host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: ph + ' (' + es.length + ')' }), es.length ? el('ul', { class: 'tl' }, es.map(function (e) { return el('li', { text: fmtD(e.d) + ': ' + e.n }); })) : el('div', { class: 'sm muted', text: 'Nothing recorded' })])); });
      },
      incidents: function (v, m, host) {
        var inc = sortEv(m.events).filter(function (e) { return e.kind === 'incident' && e.res; });
        host.appendChild(table(['Date', 'Resource', 'Hours lost', 'What happened'], inc.map(function (e) { return [fmtD(e.d), nameOf(ress(v), e.res), e.hours || '', e.n]; })));
        host.appendChild(note('Incidents with a resource and a duration feed the agent-based model: how often each resource fails, and for how long.'));
      }
    }
  });
  function sortEv(e) { return (e || []).slice().sort(function (a, b) { return String(a.d).localeCompare(String(b.d)); }); }
  function fmtD(d) { if (!d) return ''; var x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  // ---------- important business service: the dependency inventory, already built ----------
  MODELS.push({ id: 'ibs', name: 'Important business service', key: null, inventory: true });

  // ---------- bow tie ----------
  MODELS.push({
    id: 'bowtie', name: 'Bow tie', key: 'bowtie',
    about: 'One central event, with what could lead to it on the left and what could follow on the right, and the barriers on each side. It works for something wanted as well as something feared.',
    subject: function (v, m) { return m.top || 'The central event'; },
    empty: function (v, m) { return !m.top; },
    views: [['diagram', 'Bow tie'], ['register', 'Barrier register'], ['health', 'Barrier health']],
    edit: { root: [{ k: 'top', l: 'The central event', t: 'text' }, { k: 'hazard', l: 'What is being held in control', t: 'text' }],
      lists: [{ k: 'threats', title: 'What could lead to it (left side)', blank: function () { return { n: '' }; }, fields: [{ k: 'n', l: 'Cause', t: 'text' }] },
        { k: 'cons', title: 'What could follow (right side)', blank: function () { return { n: '', cap: [] }; }, fields: [{ k: 'n', l: 'Consequence', t: 'text' }, { k: 'cap', l: 'Capitals affected', t: 'multi', o: capOpts }] },
        { k: 'bars', title: 'Barriers', blank: function () { return { n: '', side: 'prevent', on: '', res: '', state: 'untested' }; }, fields: [{ k: 'n', l: 'Barrier', t: 'text' }, { k: 'side', l: 'Side', t: 'sel', o: function () { return [['prevent', 'Prevents the event'], ['recover', 'Limits what follows']]; } }, { k: 'on', l: 'Against', t: 'sel', o: function (v) { var b = v.bowtie || {}; return (b.threats || []).map(function (x) { return [x.id, 'Cause: ' + x.n]; }).concat((b.cons || []).map(function (x) { return [x.id, 'Consequence: ' + x.n]; })); } }, { k: 'res', l: 'Resource it rests on', t: 'sel', o: resOpts }, { k: 'state', l: 'State', t: 'sel', o: function () { return Object.keys(BSTATE).map(function (k) { return [k, BSTATE[k][0]]; }); } }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return [['', 'Not set'], ['prevent', 'Prevent'], ['detect', 'Detect'], ['contain', 'Contain'], ['recover', 'Recover']]; } }, { k: 'tested', l: 'Last tested (date, how), and what could defeat it', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'barriers', head: ['Barrier', 'Side', 'Against', 'Resource', 'Single point of failure', 'State'], rows: (m.bars || []).map(function (b) { var r = byId(ress(v), b.res); return [b.n, b.side === 'prevent' ? 'Prevents the event' : 'Limits what follows', nameOf((m.threats || []).concat(m.cons || []), b.on), r ? r.n : '', r && X.isSpof(r) ? 'Yes' : 'No', BSTATE[b.state][0]]; }) }]; },
    draw: {
      diagram: function (v, m, host) {
        var th = m.threats || [], co = m.cons || [], rows = Math.max(th.length, co.length, 1), RH = 74, H = rows * RH + 40, W = 1180, cx = W / 2, cy = H / 2, s = '';
        var bar = function (b, x, y) { var c = BSTATE[b.state] || BSTATE.untested; return '<g class="bbar" data-id="' + b.id + '"><title>' + esc(b.n + ': ' + c[0]) + '</title><rect x="' + (x - 47) + '" y="' + (y - 27) + '" width="94" height="54" rx="4" style="stroke:' + c[1] + ';fill:' + c[1] + '22"/>' + svgText(x, y, b.n, 17, 'mt xs', 11) + '</g>'; };
        th.forEach(function (t, i) { var y = 20 + i * RH + RH / 2 + (rows - th.length) * RH / 2; s += '<path class="medge" d="M150,' + y + ' C' + (cx - 200) + ',' + y + ' ' + (cx - 180) + ',' + cy + ' ' + (cx - 80) + ',' + cy + '"/><g class="mbox"><rect x="10" y="' + (y - 24) + '" width="140" height="48" rx="8"/>' + svgText(80, y, t.n, 20) + '</g>'; var bs = (m.bars || []).filter(function (b) { return b.on === t.id; }); bs.forEach(function (b, j) { s += bar(b, 215 + j * 100, y); }); });
        co.forEach(function (t, i) { var y = 20 + i * RH + RH / 2 + (rows - co.length) * RH / 2; s += '<path class="medge" d="M' + (cx + 80) + ',' + cy + ' C' + (cx + 180) + ',' + cy + ' ' + (cx + 200) + ',' + y + ' ' + (W - 150) + ',' + y + '"/><g class="mbox con"><rect x="' + (W - 150) + '" y="' + (y - 24) + '" width="140" height="48" rx="8"/>' + svgText(W - 80, y, t.n, 20) + '</g>'; var bs = (m.bars || []).filter(function (b) { return b.on === t.id; }); bs.forEach(function (b, j) { s += bar(b, W - 215 - j * 100, y); }); });
        s += '<g class="knot"><circle cx="' + cx + '" cy="' + cy + '" r="78"/>' + svgText(cx, cy, m.top, 18) + '</g>';
        if (m.hazard) s += '<text class="mt sm" x="' + cx + '" y="' + (cy - 92) + '">' + esc(m.hazard) + '</text>';
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
        host.appendChild(el('div', { class: 'invkey' }, Object.keys(BSTATE).map(function (k) { return el('span', {}, [el('i', { style: 'background:' + BSTATE[k][1] }), document.createTextNode(BSTATE[k][0])]); })));
      },
      register: function (v, m, host) { host.appendChild(table(['Barrier', 'Side', 'Against', 'Resource it rests on', 'State'], (m.bars || []).map(function (b) { var r = byId(ress(v), b.res); return { cls: b.state === 'failed' ? 'sp' : '', cells: [b.n, b.side === 'prevent' ? 'Prevents the event' : 'Limits what follows', nameOf((m.threats || []).concat(m.cons || []), b.on), r ? r.n + (X.isSpof(r) ? ' (single point of failure)' : '') : '', tag(BSTATE[b.state][0], BSTATE[b.state][1])] }; }))); },
      health: function (v, m, host) {
        var bs = m.bars || [], ok = function (id) { return bs.some(function (b) { return b.on === id && b.state === 'working'; }); };
        var open = (m.threats || []).filter(function (t) { return !ok(t.id); }), openC = (m.cons || []).filter(function (t) { return !ok(t.id); });
        host.appendChild(el('div', { class: 'kpis' }, [kpi('Barriers', String(bs.length)), kpi('Working', String(bs.filter(function (b) { return b.state === 'working'; }).length)), kpi('Weak or failed', String(bs.filter(function (b) { return b.state === 'weak' || b.state === 'failed'; }).length), true), kpi('Paths with no working barrier', String(open.length + openC.length), open.length + openC.length > 0)]));
        host.appendChild(el('div', { class: 'jstep', style: 'margin-top:12px' }, [el('b', { text: 'Causes with no working barrier' }), el('ul', { class: 'tl' }, open.map(function (t) { return el('li', { text: t.n }); }))]));
        host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'Consequences with no working barrier' }), el('ul', { class: 'tl' }, openC.map(function (t) { return el('li', { text: t.n + ((t.cap || []).length ? ' (' + t.cap.map(function (c) { return X.CAPS[c][0]; }).join(', ') + ')' : '') }); }))]));
        var sp = bs.filter(function (b) { var r = byId(ress(v), b.res); return r && X.isSpof(r); });
        if (sp.length) host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'Barriers that rest on a single point of failure' }), el('ul', { class: 'tl' }, sp.map(function (b) { return el('li', { text: b.n + ': ' + nameOf(ress(v), b.res) }); }))]));
      }
    }
  });
  function capOpts() { return Object.keys(X.CAPS).map(function (k) { return [k, X.CAPS[k][0]]; }); }

  // ---------- fault tree ----------
  MODELS.push({
    id: 'faulttree', name: 'Fault tree', key: 'faulttree',
    about: 'The combinations of conditions that together produce the outcome. AND means all of these must happen; OR means any one is enough. The minimal combinations are the sets of conditions to look for.',
    subject: function (v, m) { return m.top || 'The outcome'; },
    empty: function (v, m) { return !m.top; },
    views: [['tree', 'Fault tree'], ['cuts', 'Combinations'], ['register', 'Events']],
    edit: { root: [{ k: 'top', l: 'The outcome at the top', t: 'text' }, { k: 'gate', l: 'Top gate', t: 'sel', o: function () { return [['or', 'OR: any one is enough'], ['and', 'AND: all must happen']]; } }],
      lists: [{ k: 'nodes', title: 'Conditions and events', blank: function () { return { n: '', parent: 'top', gate: '', res: '', p: null }; },
        fields: [{ k: 'n', l: 'Condition or event', t: 'text' }, { k: 'parent', l: 'Under', t: 'sel', o: function (v) { var f = v.faulttree || {}; return [['top', 'The outcome']].concat((f.nodes || []).filter(function (x) { return x.gate; }).map(function (x) { return [x.id, x.n]; })); } }, { k: 'gate', l: 'Gate', t: 'sel', o: function () { return [['', 'None: a basic event'], ['or', 'OR'], ['and', 'AND']]; } }, { k: 'res', l: 'Resource', t: 'sel', o: resOpts }, { k: 'seen', l: 'How often seen (a count or band, with its source)', t: 'text' }, { k: 'p', l: 'Estimated chance in a year (0 to 1), a judgement', t: 'num' }, { k: 'warrant', l: 'Warrant for the gate: in context C, resource R leads role X to do Y', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'events', head: ['Condition', 'Under', 'Gate', 'Resource', 'Chance in a year'], rows: (m.nodes || []).map(function (x) { return [x.n, x.parent === 'top' ? m.top : nameOf(m.nodes, x.parent), (x.gate || 'basic').toUpperCase(), nameOf(ress(v), x.res), x.p]; }) }, { name: 'combinations', head: ['Combination', 'Conditions', 'Chance in a year'], rows: cuts(m).map(function (c, i) { return [i + 1, c.ids.map(function (id) { return nameOf(m.nodes, id); }).join(' AND '), c.p == null ? '' : c.p.toPrecision(2)]; }) }]; },
    draw: {
      tree: function (v, m, host) {
        var nodes = m.nodes || [], kids = function (id) { return nodes.filter(function (x) { return x.parent === id; }); };
        var leaves = 0, pos = {}, depth = 0;
        (function place(id, d) { depth = Math.max(depth, d); var k = kids(id); if (!k.length) { pos[id] = [leaves++, d]; return; } k.forEach(function (c) { place(c.id, d + 1); }); var xs = k.map(function (c) { return pos[c.id][0]; }); pos[id] = [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, d]; })('top', 0);
        var CW = 150, RH = 120, W = Math.max(900, leaves * CW + 40), H = (depth + 1) * RH + 30, X0 = 20 + CW / 2, s = '';
        var P = function (id) { return [X0 + pos[id][0] * CW, 50 + pos[id][1] * RH]; };
        nodes.forEach(function (x) { var a = P(x.parent), b = P(x.id); s += '<path class="medge" d="M' + a[0] + ',' + (a[1] + 52) + ' L' + a[0] + ',' + (a[1] + 66) + ' L' + b[0] + ',' + (a[1] + 66) + ' L' + b[0] + ',' + (b[1] - 26) + '"/>'; });
        var gate = function (g, x, y) { return g === 'and' ? '<path class="gate and" d="M' + (x - 14) + ',' + (y + 14) + ' L' + (x - 14) + ',' + y + ' A14,14 0 0 1 ' + (x + 14) + ',' + y + ' L' + (x + 14) + ',' + (y + 14) + ' Z"/><text class="mt xs" x="' + x + '" y="' + (y + 10) + '">AND</text>' : '<path class="gate or" d="M' + (x - 15) + ',' + (y + 15) + ' Q' + x + ',' + (y + 5) + ' ' + (x + 15) + ',' + (y + 15) + ' Q' + (x + 12) + ',' + (y - 4) + ' ' + x + ',' + (y - 12) + ' Q' + (x - 12) + ',' + (y - 4) + ' ' + (x - 15) + ',' + (y + 15) + ' Z"/><text class="mt xs" x="' + x + '" y="' + (y + 10) + '">OR</text>'; };
        var top = P('top'); s += '<g class="mbox top"><rect x="' + (top[0] - 130) + '" y="' + (top[1] - 26) + '" width="260" height="52" rx="6"/>' + svgText(top[0], top[1], m.top, 38) + '</g>' + gate(m.gate || 'or', top[0], top[1] + 40);
        nodes.forEach(function (x) { var p = P(x.id), r = byId(ress(v), x.res);
          if (x.gate) s += '<g class="mbox"><rect x="' + (p[0] - 64) + '" y="' + (p[1] - 26) + '" width="128" height="52" rx="6"/>' + svgText(p[0], p[1], x.n, 19) + '</g>' + gate(x.gate, p[0], p[1] + 40);
          else s += '<g class="mbox basic' + (r && X.isSpof(r) ? ' sp' : '') + '" data-id="' + x.id + '"><ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="66" ry="30"/>' + svgText(p[0], p[1] - (x.p ? 5 : 0), x.n, 18, 'mt xs', 11) + (x.p ? '<text class="mt xs muted2" x="' + p[0] + '" y="' + (p[1] + 22) + '">' + x.p + ' a year</text>' : '') + '</g>';
        });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
        host.appendChild(note('Rounded boxes are conditions with a gate below them; ovals are basic events. A red oval rests on a single point of failure.'));
      },
      cuts: function (v, m, host) {
        var cs = cuts(m), tp = cs.some(function (c) { return c.p != null; }) ? 1 - cs.reduce(function (a, c) { return a * (1 - (c.p || 0)); }, 1) : null;
        host.appendChild(el('div', { class: 'kpis' }, [kpi('Basic events', String((m.nodes || []).filter(function (x) { return !x.gate; }).length)), kpi('Minimal combinations', String(cs.length)), kpi('Single conditions enough on their own', String(cs.filter(function (c) { return c.ids.length === 1; }).length), cs.some(function (c) { return c.ids.length === 1; })), kpi('Estimated chance in a year', tp == null ? 'Not estimated' : (tp * 100).toFixed(1) + ' in 100', tp > 0.1)]));
        host.appendChild(el('div', { style: 'margin-top:12px' }, [table(['Combination', 'Conditions that together produce the outcome', 'Chance in a year'], cs.map(function (c, i) { return { cls: c.ids.length === 1 ? 'sp' : '', cells: [String(i + 1), c.ids.map(function (id) { return nameOf(m.nodes, id); }).join('  AND  '), c.p == null ? '' : c.p.toPrecision(2)] }; }))]));
        host.appendChild(note('Each row is a minimal combination: every condition in it is needed, and together they are enough. Shaded rows are a single condition that is enough on its own.'));
        host.appendChild(el('div', { class: 'limits' }, [el('b', { text: 'Limits of the estimates. ' }), document.createTextNode('The chances are judgements, not measurements. They assume the conditions in a combination occur independently, which shared causes (the same person, system, shift or rule) often break, so a combined figure can be far too low. They say nothing about conditions the model does not contain. Read them to rank combinations against each other, not as the likelihood of harm. Where a count of how often each condition has been seen exists, it is the firmer evidence.')]));
      },
      register: function (v, m, host) { host.appendChild(table(['Condition', 'Under', 'Gate', 'Resource', 'Chance in a year'], (m.nodes || []).map(function (x) { return [x.n, x.parent === 'top' ? m.top : nameOf(m.nodes, x.parent), x.gate ? x.gate.toUpperCase() : 'Basic event', nameOf(ress(v), x.res), x.p == null ? '' : x.p]; }))); }
    }
  });
  // Minimal cut sets, worked down from the top (the MOCUS method).
  function cuts(m) {
    var nodes = m.nodes || [], kids = function (id) { return nodes.filter(function (x) { return x.parent === id; }); }, seen = {};
    function exp(id, g) {
      if (seen[id]) return [[]]; seen[id] = 1;
      var k = kids(id), out;
      if (!k.length) out = [[id]];
      else if ((g || (byId(nodes, id) || {}).gate) === 'and') { out = [[]]; k.forEach(function (c) { var sub = exp(c.id); var next = []; out.forEach(function (a) { sub.forEach(function (b) { next.push(uniq(a.concat(b))); }); }); out = next; }); }
      else { out = []; k.forEach(function (c) { out = out.concat(exp(c.id)); }); }
      seen[id] = 0; return out;
    }
    var all = exp('top', m.gate || 'or').map(function (a) { return a.slice().sort(); });
    var min = all.filter(function (a, i) { return !all.some(function (b, j) { return j !== i && b.length < a.length && b.every(function (x) { return a.indexOf(x) >= 0; }); }) && all.findIndex(function (b) { return b.join() === a.join(); }) === i; });
    return min.map(function (ids) { var ps = ids.map(function (id) { var n = byId(nodes, id); return n && n.p != null ? Number(n.p) : null; }); return { ids: ids, p: ps.every(function (p) { return p != null; }) ? ps.reduce(function (a, b) { return a * b; }, 1) : null }; }).sort(function (a, b) { return a.ids.length - b.ids.length || (b.p || 0) - (a.p || 0); });
  }

  // ---------- AcciMap ----------
  MODELS.push({
    id: 'accimap', name: 'AcciMap', key: 'accimap',
    about: 'The conditions that came together, from government and regulators down to the equipment, and how they connect across levels. Each condition can be tagged with the form of failure it shows.',
    subject: function (v, m) { var o = (m.factors || []).filter(function (f) { return f.lvl === ALEVELS.length - 1; })[0]; return o ? o.n : 'What came together'; },
    empty: function (v, m) { return !(m.factors || []).length; },
    views: [['map', 'AcciMap'], ['levels', 'By level'], ['nots', 'By form of failure']],
    edit: { root: [{ k: 'none', l: 'Levels looked at and found empty', t: 'multi', o: function () { return ALEVELS.slice(0, 6).map(function (l, i) { return [i, l]; }); } }],
      lists: [{ k: 'factors', title: 'Conditions', blank: function () { return { lvl: 4, n: '', not: '' }; }, fields: [{ k: 'lvl', l: 'Level', t: 'sel', o: function () { return ALEVELS.map(function (l, i) { return [String(i), l]; }); } }, { k: 'n', l: 'Condition', t: 'text' }, { k: 'not', l: 'Form of failure', t: 'sel', o: function () { return [['', 'Not tagged']].concat(NOTS.map(function (n) { return [n, n]; })); } }, { k: 'l4', l: 'Level on the four', t: 'sel', o: function () { return [['', 'Not set'], ['institution', 'Institution'], ['organisation', 'Organisation'], ['team', 'Team'], ['person', 'Person']]; } }, { k: 'intent', l: 'Intent', t: 'sel', o: function () { return [['', 'Not coded'], ['unintended', 'Unintended'], ['knowing', 'Knowing'], ['deliberate', 'Deliberate']]; } }, { k: 'conf', l: 'Confidence', t: 'sel', o: function () { return [['', 'Not coded'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]; } }] },
      { k: 'links', title: 'Links (this contributed to that)', blank: function () { return { a: '', b: '' }; }, fields: [{ k: 'a', l: 'From', t: 'sel', o: function (v) { return ((v.accimap || {}).factors || []).map(function (f) { return [f.id, f.n]; }); } }, { k: 'b', l: 'To', t: 'sel', o: function (v) { return ((v.accimap || {}).factors || []).map(function (f) { return [f.id, f.n]; }); } }] }] },
    registers: function (v, m) { return [{ name: 'conditions', head: ['Level', 'Condition', 'Form of failure', 'Leads to'], rows: (m.factors || []).map(function (f) { return [ALEVELS[f.lvl], f.n, f.not, (m.links || []).filter(function (l) { return l.a === f.id; }).map(function (l) { return nameOf(m.factors, l.b); }).join('; ')]; }) }]; },
    draw: {
      map: function (v, m, host) {
        var fs = m.factors || [], LW = 190, RH = 100, W = 1180, H = ALEVELS.length * RH, pos = {}, s = '';
        ALEVELS.forEach(function (L, i) { s += '<rect class="lane' + (i % 2 ? ' alt' : '') + (i === ALEVELS.length - 1 ? ' out' : '') + '" x="0" y="' + i * RH + '" width="' + W + '" height="' + RH + '"/>' + svgText(LW / 2, i * RH + RH / 2, L, 22, 'mt b'); var row = fs.filter(function (f) { return Number(f.lvl) === i; }); row.forEach(function (f, j) { pos[f.id] = [LW + (W - LW) * (j + .5) / row.length, i * RH + RH / 2]; }); });
        (m.links || []).forEach(function (l) { var a = pos[l.a], b = pos[l.b]; if (!a || !b) return; var dn = b[1] >= a[1], ya = a[1] + (dn ? 30 : -30), yb = b[1] + (dn ? -32 : 32); s += '<path class="medge" d="M' + a[0] + ',' + ya + ' C' + a[0] + ',' + ((ya + yb) / 2) + ' ' + b[0] + ',' + ((ya + yb) / 2) + ' ' + b[0] + ',' + yb + '" marker-end="url(#mar)"/>'; });
        fs.forEach(function (f) { var p = pos[f.id], nl = Math.min(3, wrap(f.n, 26).length), hh = 16 + nl * 12 + (f.not ? 14 : 0); s += '<g class="mbox' + (Number(f.lvl) === ALEVELS.length - 1 ? ' top' : '') + '"><title>' + esc(f.n) + '</title><rect x="' + (p[0] - 86) + '" y="' + (p[1] - hh / 2) + '" width="172" height="' + hh + '" rx="6"/>' + svgText(p[0], p[1] - (f.not ? 7 : 0), f.n, 26, 'mt xs', 12) + (f.not ? '<text class="mt xs not" x="' + p[0] + '" y="' + (p[1] + hh / 2 - 6) + '" text-anchor="middle">' + esc(f.not) + '</text>' : '') + '</g>'; });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
      },
      levels: function (v, m, host) { ALEVELS.forEach(function (L, i) { var fs = (m.factors || []).filter(function (f) { return Number(f.lvl) === i; }); if (fs.length) host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: L }), el('ul', { class: 'tl' }, fs.map(function (f) { return el('li', { text: f.n + (f.not ? ' (' + f.not.toLowerCase() + ')' : '') }); }))])); }); },
      nots: function (v, m, host) {
        var fs = m.factors || [];
        host.appendChild(table(['Form of failure', 'How many', 'Conditions', 'Levels'], NOTS.map(function (n) { var x = fs.filter(function (f) { return f.not === n; }); return { cls: x.length ? '' : 'none', cells: [n, String(x.length), x.map(function (f) { return f.n; }).join('; '), uniq(x.map(function (f) { return ALEVELS[f.lvl]; })).join('; ')] }; })));
        host.appendChild(note('The twelve forms of failure, with the conditions tagged with each. A form that appears at several levels is worth a closer look.'));
      }
    }
  });

  // ---------- systems diagram (causal loops) ----------
  MODELS.push({
    id: 'systems', name: 'Systems diagram', key: 'systems',
    about: 'What affects what. A plus means the two move the same way; a minus means they move in opposite ways. Closed loops either reinforce themselves or balance themselves.',
    subject: function (v, m) { return (m.vars || []).length + ' variables, ' + loops(m).length + ' loops'; },
    empty: function (v, m) { return !(m.vars || []).length; },
    views: [['diagram', 'Loop diagram'], ['loops', 'Loops'], ['vars', 'Variables']],
    edit: { lists: [{ k: 'vars', title: 'Variables (things that can go up or down)', blank: function () { return { n: '' }; }, fields: [{ k: 'n', l: 'Variable', t: 'text' }] },
      { k: 'links', title: 'Links', blank: function () { return { a: '', b: '', s: '+', delay: false }; }, fields: [{ k: 'a', l: 'From', t: 'sel', o: varOpts }, { k: 'b', l: 'To', t: 'sel', o: varOpts }, { k: 's', l: 'Direction', t: 'sel', o: function () { return [['+', 'Plus: same way'], ['-', 'Minus: opposite way']]; } }, { k: 'delay', l: 'With a delay', t: 'bool' }] },
      { k: 'meas', title: 'Dated measurements of a control (two or more are needed to estimate a rate of decay)', blank: function () { return { d: '', what: '', val: '', src: '' }; }, fields: [{ k: 'd', l: 'Date', t: 'text' }, { k: 'what', l: 'Control measured', t: 'text' }, { k: 'val', l: 'Result', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'links', head: ['From', 'To', 'Direction', 'Delay'], rows: (m.links || []).map(function (l) { return [nameOf(m.vars, l.a), nameOf(m.vars, l.b), l.s === '-' ? 'Opposite' : 'Same', l.delay ? 'Yes' : 'No']; }) }, { name: 'loops', head: ['Loop', 'Kind', 'Path'], rows: loops(m).map(function (L, i) { return [i + 1, L.kind, L.path.map(function (id) { return nameOf(m.vars, id); }).join(' → ')]; }) }]; },
    draw: {
      diagram: function (v, m, host) {
        var vs = m.vars || [], W = 1000, H = 600, cx = W / 2, cy = H / 2, pos = {}, s = '', hl = S.loopHl != null ? loops(m)[S.loopHl] : null;
        vs.forEach(function (x, i) { var a = -Math.PI / 2 + i * 2 * Math.PI / vs.length; pos[x.id] = [cx + 360 * Math.cos(a), cy + 230 * Math.sin(a)]; });
        var onHl = function (l) { if (!hl) return false; var p = hl.path; for (var i = 0; i < p.length; i++) if (p[i] === l.a && p[(i + 1) % p.length] === l.b) return true; return false; };
        (m.links || []).forEach(function (l) { var a = pos[l.a], b = pos[l.b]; if (!a || !b) return; var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = cx - mx, dy = cy - my, k = 0.22, qx = mx + dx * k, qy = my + dy * k;
          var ang = Math.atan2(qy - b[1], qx - b[0]), ex = b[0] + 64 * Math.cos(ang), ey = b[1] + 26 * Math.sin(ang), sang = Math.atan2(qy - a[1], qx - a[0]), sx = a[0] + 64 * Math.cos(sang), sy = a[1] + 26 * Math.sin(sang);
          s += '<path class="medge cl' + (onHl(l) ? ' hl' : '') + (hl && !onHl(l) ? ' dim' : '') + '" d="M' + sx + ',' + sy + ' Q' + qx + ',' + qy + ' ' + ex + ',' + ey + '" marker-end="url(#' + (onHl(l) ? 'marA' : 'mar') + ')"/><text class="sign ' + (l.s === '-' ? 'neg' : 'pos') + '" x="' + (qx * .5 + ex * .5) + '" y="' + (qy * .5 + ey * .5 - 4) + '">' + (l.s === '-' ? '−' : '+') + (l.delay ? ' ‖' : '') + '</text>'; });
        vs.forEach(function (x) { var p = pos[x.id]; s += '<g class="mvar' + (hl && hl.path.indexOf(x.id) < 0 ? ' dim' : '') + '"><rect x="' + (p[0] - 64) + '" y="' + (p[1] - 24) + '" width="128" height="48" rx="24"/>' + svgText(p[0], p[1], x.n, 19, 'mt xs', 11) + '</g>'; });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
        var ls = loops(m);
        host.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [el('span', { class: 'muted sm', text: 'Show a loop:' })].concat(ls.map(function (L, i) { return el('button', { class: 'btn sm', 'aria-pressed': String(S.loopHl === i), 'data-loop': String(i), text: (L.kind === 'Reinforcing' ? 'R' : 'B') + (i + 1), title: L.kind, onclick: function () { S.loopHl = S.loopHl === i ? null : i; X.render(); } }); }))));
        host.appendChild(note('R is a reinforcing loop, B a balancing one. Two short lines on a link mean a delay.'));
      },
      loops: function (v, m, host) { host.appendChild(table(['Loop', 'Kind', 'The path round it', 'What it does'], loops(m).map(function (L, i) { return [(L.kind === 'Reinforcing' ? 'R' : 'B') + (i + 1), L.kind, L.path.concat([L.path[0]]).map(function (id) { return nameOf(m.vars, id); }).join(' → '), L.kind === 'Reinforcing' ? 'Feeds itself: a change keeps growing, for better or worse' : 'Pulls back: a change is resisted, towards a level']; }))); },
      vars: function (v, m, host) { var ls = loops(m); host.appendChild(table(['Variable', 'Affected by', 'Affects', 'Loops it is in'], (m.vars || []).map(function (x) { return [x.n, String((m.links || []).filter(function (l) { return l.b === x.id; }).length), String((m.links || []).filter(function (l) { return l.a === x.id; }).length), String(ls.filter(function (L) { return L.path.indexOf(x.id) >= 0; }).length)]; }).sort(function (a, b) { return b[3] - a[3]; }))); host.appendChild(note('Variables in several loops are places where a small push travels furthest.')); }
    }
  });
  function varOpts(v) { return ((v.systems || {}).vars || []).map(function (x) { return [x.id, x.n]; }); }
  // Every simple loop, found by searching from each variable; a loop with an odd number of minuses balances.
  function loops(m) {
    var vs = (m.vars || []).map(function (x) { return x.id; }), L = m.links || [], out = [], keys = {};
    vs.forEach(function (start, si) {
      (function dfs(node, path) {
        L.filter(function (l) { return l.a === node; }).forEach(function (l) {
          if (l.b === start) { var key = path.slice().sort().join(); if (!keys[key + path.join()]) { var min = path.reduce(function (a, b) { return vs.indexOf(a) < vs.indexOf(b) ? a : b; }); if (min === start) { keys[key + path.join()] = 1; var neg = 0; path.forEach(function (id, i) { var nx = path[(i + 1) % path.length], ln = L.filter(function (x) { return x.a === id && x.b === nx; })[0]; if (ln && ln.s === '-') neg++; }); out.push({ path: path.slice(), kind: neg % 2 ? 'Balancing' : 'Reinforcing' }); } } }
          else if (path.indexOf(l.b) < 0 && vs.indexOf(l.b) > si && path.length < 10) dfs(l.b, path.concat([l.b]));
        });
      })(start, [start]);
    });
    return out;
  }


  // ---------- Beer's viable system model ----------
  var VFN = { s5: ['Policy', 'System 5', 'What are we for now, and is the present crowding out the future?'], s4: ['Intelligence', 'System 4', 'What is changing outside that our view of the world would not let us see?'], s3: ['Control', 'System 3', 'What does control reward, where do decisions wait, and what slack has it taken out?'], s3s: ['Audit', 'System 3*', 'How would we know, other than by being told?'], s2: ['Coordination', 'System 2', 'Where does what one unit knows or does fail to reach the next?'], s1: ['Operations', 'System 1', 'What could the front line not absorb or work around, and where has its practice drifted?'], ind: ['Carried by individuals', 'not one of Beer’s systems', 'Who was carrying this, and what did the system leave them able to see and do?'] };
  var VLV = [['field', 'The field: sector and regulators'], ['org', 'The organisation'], ['team', 'Teams and functions'], ['act', 'Activities and the people who do them']];
  var VEV = { observed: ['Observed', '#3a9b63'], documented: ['Documented only', '#e2a52b'], stated: ['Stated', '#c9961a'], none: ['No evidence', '#d9472b'] };
  var VCH = { command: 'Command (control to operations)', coordination: 'Coordination (between operations)', audit: 'Audit (a second channel past line management)', alarm: 'Alarm (straight from the front line to the top)', resource: 'Resources (agreed between control and operations)', environment: 'Environment (intelligence looking outside)' };
  var vfnOpts = function () { return Object.keys(VFN).map(function (k) { return [k, VFN[k][0] + ' (' + VFN[k][1] + ')']; }); };
  MODELS.push({
    id: 'vsm', name: 'Viable system model', key: 'vsm',
    about: 'Stafford Beer’s viable system model: whether each of the functions a viable service needs is there, who carries it, and how it is evidenced. A missing function is a finding. Each box opens one level down as a viable system of its own.',
    subject: function (v, m) { return m.recursion || 'The level of recursion, not yet set'; },
    empty: function (v, m) { return !(m.fns || []).length; },
    views: [['diagram', 'Viable system'], ['grid', 'Functions by level'], ['channels', 'Channels'], ['questions', 'The sharp questions']],
    edit: { root: [{ k: 'recursion', l: 'The level being looked at', t: 'text' }, { k: 'above', l: 'The system it sits within (one level up)', t: 'text' }, { k: 'below', l: 'The systems inside it (one level down)', t: 'text' }],
      lists: [{ k: 'fns', title: 'Functions: who or what carries each one', blank: function () { return { f: 's1', lvl: 'org', who: '', how: '', ans: '', ev: 'stated', gap: false, res: [] }; },
        fields: [{ k: 'f', l: 'Function', t: 'sel', o: vfnOpts }, { k: 'lvl', l: 'Level', t: 'sel', o: function () { return VLV; } }, { k: 'who', l: 'Who or what carries it', t: 'text' }, { k: 'how', l: 'How it works', t: 'text' }, { k: 'ans', l: 'Answer to the sharp question', t: 'long' }, { k: 'ev', l: 'Evidence', t: 'sel', o: function () { return Object.keys(VEV).map(function (k) { return [k, VEV[k][0]]; }); } }, { k: 'gap', l: 'Missing: nobody carries it', t: 'bool' }, { k: 'res', l: 'Resources it rests on', t: 'multi', o: function (v) { return resOpts(v).slice(1); } }] },
        { k: 'chans', title: 'Channels between the functions', blank: function () { return { kind: 'command', a: 's3', b: 's1', n: '', works: 'unknown' }; },
          fields: [{ k: 'kind', l: 'Channel', t: 'sel', o: function () { return Object.keys(VCH).map(function (k) { return [k, VCH[k]]; }); } }, { k: 'a', l: 'From', t: 'sel', o: vfnOpts }, { k: 'b', l: 'To', t: 'sel', o: vfnOpts }, { k: 'n', l: 'What passes, and how', t: 'text' }, { k: 'works', l: 'Does it work?', t: 'sel', o: function () { return [['yes', 'Works'], ['weak', 'Weak'], ['no', 'Does not work'], ['unknown', 'Not known']]; } }] }] },
    registers: function (v, m) { return [{ name: 'functions', head: ['Function', 'Level', 'Who carries it', 'How it works', 'Answer to the sharp question', 'Evidence', 'Missing'], rows: (m.fns || []).map(function (f) { return [VFN[f.f][0] + ' (' + VFN[f.f][1] + ')', (VLV.filter(function (x) { return x[0] === f.lvl; })[0] || [0, ''])[1], f.who, f.how, f.ans, (VEV[f.ev] || [''])[0], f.gap ? 'Yes' : 'No']; }) }, { name: 'channels', head: ['Channel', 'From', 'To', 'What passes', 'Works'], rows: (m.chans || []).map(function (c) { return [VCH[c.kind], VFN[c.a] ? VFN[c.a][0] : '', VFN[c.b] ? VFN[c.b][0] : '', c.n, c.works]; }) }]; },
    draw: {
      diagram: function (v, m, host) {
        var fs = m.fns || [], lv = S.vsmLvl || (fs[0] && fs[0].lvl) || 'org', mine = fs.filter(function (f) { return f.lvl === lv; }), of = function (k) { return mine.filter(function (f) { return f.f === k; }); };
        host.appendChild(el('div', { class: 'seg', style: 'margin-bottom:10px' }, VLV.map(function (x) { return el('button', { 'aria-pressed': String(lv === x[0]), 'data-vl': x[0], text: x[1], onclick: function () { S.vsmLvl = x[0]; X.render(); } }); })));
        var W = 1000, H = 640, s = '', X0 = 380, BW = 300;
        var box = function (k, x, y, w, h, shape) {
          var list = of(k), gap = !list.length || list.every(function (f) { return f.gap; }), ev = gap ? 'none' : list.map(function (f) { return f.ev; }).sort(function (a, b) { return Object.keys(VEV).indexOf(b) - Object.keys(VEV).indexOf(a); })[0];
          var c = VEV[ev] || VEV.stated, txt = gap ? 'Missing: nobody carries it' : list.map(function (f) { return f.who; }).filter(Boolean).join('; ');
          var sh = shape === 'circle' ? '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + (w / 2) + '" ry="' + (h / 2) + '"' : '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8"';
          return '<g class="vbox' + (gap ? ' gap' : '') + '" data-id="' + k + '"><title>' + esc(VFN[k][0] + ': ' + (VEV[ev] || [''])[0]) + '</title>' + sh + ' class="vbg"/>' + sh + ' style="stroke:' + c[1] + ';fill:' + c[1] + '18"/><text class="mt b" x="' + (x + w / 2) + '" y="' + (y + 18) + '" text-anchor="middle">' + esc(VFN[k][0] + ' (' + VFN[k][1].replace('not one of Beer’s systems', 'people') + ')') + '</text>' + svgText(x + w / 2, y + h / 2 + 10, txt, Math.round(w / 7.2), 'mt xs', 12) + '</g>';
        };
        // the environment, the meta-system, the operations, as in Beer's drawing
        // the channels first, so the boxes sit over them
        var cy = { s5: 55, s4: 150, s3: 250, s3s: 337, s2: 415, s1: 470, ind: 600 }, cx = { s5: X0 + BW / 2, s4: X0 + BW / 2, s3: X0 + BW / 2, s3s: X0 - 85, s2: X0 + BW + 105, s1: X0 + BW / 2, ind: X0 + BW / 2 };
        (m.chans || []).forEach(function (c2) { if (!cx[c2.a] || !cx[c2.b]) return; var col = c2.works === 'yes' ? '#3a9b63' : c2.works === 'weak' ? '#e2a52b' : c2.works === 'no' ? '#d9472b' : '#8a8f98'; s += '<path class="vch" d="M' + cx[c2.a] + ',' + cy[c2.a] + ' Q' + ((cx[c2.a] + cx[c2.b]) / 2 + (c2.kind === 'alarm' ? 260 : c2.kind === 'audit' ? -60 : 30)) + ',' + ((cy[c2.a] + cy[c2.b]) / 2) + ' ' + cx[c2.b] + ',' + cy[c2.b] + '" style="stroke:' + col + '" marker-end="url(#mar)"><title>' + esc(VCH[c2.kind] + ': ' + (c2.n || '') + ' (' + c2.works + ')') + '</title></path>'; });
        s += '<path class="venv" d="M40,120 C10,220 20,420 60,540 C120,620 230,600 270,520 C320,420 300,250 260,150 C220,60 90,40 40,120 Z"/><text class="mt b" x="150" y="300" text-anchor="middle">The environment</text>';
        s += box('s5', X0, 20, BW, 70) + box('s4', X0, 110, BW, 80) + box('s3', X0, 210, BW, 80);
        s += box('s3s', X0 - 150, 300, 130, 74) + box('s2', X0 + BW + 30, 300, 150, 230);
        var ops = of('s1').length ? of('s1') : [null];
        ops.forEach(function (f, i) { var y = 320 + i * (300 / ops.length), h = Math.min(110, 290 / ops.length - 10); s += '<g class="vbox' + (f && !f.gap ? '' : ' gap') + '" data-id="s1"><title>Operations</title><ellipse cx="' + (X0 + 70) + '" cy="' + (y + h / 2) + '" rx="62" ry="' + (h / 2) + '" style="stroke:' + (f ? (VEV[f.ev] || VEV.stated)[1] : '#d9472b') + ';fill:rgba(255,255,255,0)"/><rect x="' + (X0 + 150) + '" y="' + (y + 6) + '" width="' + (BW - 150) + '" height="' + (h - 12) + '" rx="6" style="stroke:' + (f ? (VEV[f.ev] || VEV.stated)[1] : '#d9472b') + ';fill:rgba(255,255,255,0)"/>' + svgText(X0 + 70, y + h / 2, f ? f.how || 'Operations' : 'Missing', 14, 'mt xs', 11) + svgText(X0 + 150 + (BW - 150) / 2, y + h / 2, f ? f.who : 'Nobody', 18, 'mt xs', 11) + '</g>'; });
        s += '<path class="vch env" d="M270,250 C320,200 340,160 ' + X0 + ',150"/><path class="vch env" d="M280,450 C320,460 340,470 ' + X0 + ',470"/>';
        host.appendChild(dwrap(svgEl(W, H, s, 'wide vsm')));
        host.appendChild(el('div', { class: 'invkey' }, Object.keys(VEV).map(function (k) { return el('span', {}, [el('i', { style: 'background:' + VEV[k][1] }), document.createTextNode(VEV[k][0])]); }).concat([el('span', { text: 'Lines are the channels: green works, amber weak, red does not work, grey not known.' })])));
        host.appendChild(note((m.above ? 'Sits within: ' + m.above + '. ' : '') + (m.below ? 'Inside it: ' + m.below + '. ' : '') + 'Audit failed in five of the ten cases tested "by not looking at reality, only at documents, declarations and certificates", so each box shows whether its evidence is observed or only documented.'));
      },
      grid: function (v, m, host) {
        var fs = m.fns || [], t = el('table', { class: 'itab vgrid' });
        t.appendChild(el('tr', {}, [el('th', { text: 'Function' })].concat(VLV.map(function (x) { return el('th', { text: x[1] }); }))));
        Object.keys(VFN).forEach(function (k) { t.appendChild(el('tr', {}, [el('td', {}, [el('b', { text: VFN[k][0] }), el('div', { class: 'sm muted', text: VFN[k][1] })])].concat(VLV.map(function (x) { var c = fs.filter(function (f) { return f.f === k && f.lvl === x[0]; }); return el('td', { class: c.some(function (f) { return f.gap; }) ? 'vg' : '' }, c.length ? c.map(function (f) { return el('div', {}, [el('i', { class: 'ragd', style: 'background:' + (VEV[f.ev] || VEV.stated)[1] }), document.createTextNode(f.gap ? 'Missing' : f.who || '')]); }) : [el('span', { class: 'muted sm', text: 'Not looked at' })]); })))); });
        host.appendChild(el('div', { class: 'nwrap' }, [t]));
        host.appendChild(note('A box at one level is a viable system of its own, with the same functions inside it. "Missing" is a finding; "not looked at" is a gap in the work.'));
      },
      channels: function (v, m, host) { host.appendChild(table(['Channel', 'From', 'To', 'What passes, and how', 'Does it work?'], (m.chans || []).map(function (c) { return { cls: c.works === 'no' ? 'sp' : '', cells: [VCH[c.kind], VFN[c.a] ? VFN[c.a][0] : '', VFN[c.b] ? VFN[c.b][0] : '', c.n, { yes: 'Works', weak: 'Weak', no: 'Does not work', unknown: 'Not known' }[c.works]] }; }))); },
      questions: function (v, m, host) {
        Object.keys(VFN).forEach(function (k) { var fs = (m.fns || []).filter(function (f) { return f.f === k && f.ans; }); host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: VFN[k][0] + ': ' + VFN[k][2] }), fs.length ? el('ul', { class: 'tl' }, fs.map(function (f) { return el('li', { text: f.ans + ' (' + (VEV[f.ev] || [''])[0].toLowerCase() + ')' }); })) : el('div', { class: 'sm muted', text: 'Not yet asked' })])); });
      }
    }
  });

  // ---------- FRAM ----------
  MODELS.push({
    id: 'fram', name: 'Functional resonance (FRAM)', key: 'fram',
    about: 'The functional resonance analysis method: the service as functions, each with six aspects (input, output, precondition, resource, time, control). Functions couple where one’s output is another’s aspect, and everyday variability travels along the couplings.',
    subject: function (v, m) { return (m.fns || []).length + ' functions'; },
    empty: function (v, m) { return !(m.fns || []).length; },
    views: [['diagram', 'Function diagram'], ['couplings', 'Couplings'], ['register', 'Functions'], ['variability', 'Variability']],
    edit: { lists: [{ k: 'fns', title: 'Functions (separate several entries in an aspect with a semicolon)', blank: function () { return { n: '', kind: 'human', I: '', O: '', P: '', R: '', T: '', C: '', var: 'stable', proc: '' }; },
      fields: [{ k: 'n', l: 'Function', t: 'text' }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return Object.keys(FKIND).map(function (k) { return [k, FKIND[k]]; }); } }].concat(ASPECTS.map(function (a) { return { k: a[0], l: a[1], t: 'text' }; })).concat([{ k: 'var', l: 'Output', t: 'sel', o: function () { return [['stable', 'Stable'], ['variable', 'Variable']]; } }, { k: 'varEv', l: 'How it varies, from the people who do it', t: 'text' }, { k: 'proc', l: 'Process', t: 'sel', o: function (v) { return [['', 'None']].concat(procOpts(v)); } }]) }] },
    registers: function (v, m) { return [{ name: 'functions', head: ['Function', 'Kind'].concat(ASPECTS.map(function (a) { return a[1]; })).concat(['Output variability']), rows: (m.fns || []).map(function (f) { return [f.n, FKIND[f.kind]].concat(ASPECTS.map(function (a) { return f[a[0]]; })).concat([f.var]); }) }, { name: 'couplings', head: ['From', 'Output', 'To', 'Aspect'], rows: couple(m).map(function (c) { return [c.a.n, c.what, c.b.n, c.asp]; }) }]; },
    draw: {
      diagram: function (v, m, host) {
        var fs = m.fns || [], lv = {}, cs0 = couple(m), s = '', r = 52, pos = {};
        fs.forEach(function (f) { lv[f.id] = 0; });
        for (var it = 0; it < fs.length; it++) cs0.forEach(function (c) { if (lv[c.b.id] < lv[c.a.id] + 1) lv[c.b.id] = lv[c.a.id] + 1; });
        var ncol = Math.max.apply(null, fs.map(function (f) { return lv[f.id]; }).concat([0])) + 1, per = {}, CW = 200, RH = 170;
        fs.forEach(function (f) { per[lv[f.id]] = (per[lv[f.id]] || 0) + 1; });
        var maxRows = Math.max.apply(null, Object.keys(per).map(function (k) { return per[k]; })), W = Math.max(900, ncol * CW + 60), H = maxRows * RH + 140, used = {}, labels = [];
        fs.forEach(function (f) { var c = lv[f.id], k = used[c] = (used[c] || 0) + 1; pos[f.id] = [40 + c * (W - 80) / ncol + (W - 80) / ncol / 2, 120 + (maxRows - per[c]) * RH / 2 + (k - 1) * RH + RH / 2]; });
        var pt = function (id, a) { var p = pos[id], ang = { T: -120, C: -60, O: 0, R: 60, P: 120, I: 180 }[a] * Math.PI / 180; return [p[0] + r * Math.cos(ang), p[1] + r * Math.sin(ang)]; };
        var vary = variable(m);
        couple(m).forEach(function (c) { var a = pt(c.a.id, 'O'), b = pt(c.b.id, c.k); var colW = (W - 80) / ncol, skip = lv[c.b.id] - lv[c.a.id] > 1 && Math.abs(pos[c.a.id][1] - pos[c.b.id][1]) < 10, lift = skip ? -150 : 0;
          var bx = b[0] + (c.k === 'I' ? -60 : c.k === 'T' || c.k === 'P' ? -30 : 30), by = b[1] + (c.k === 'T' || c.k === 'C' ? -60 : c.k === 'P' || c.k === 'R' ? 60 : 0) + lift;
          s += '<path class="medge fr' + (vary[c.a.id] ? ' hl' : '') + '" d="M' + a[0] + ',' + a[1] + ' C' + (a[0] + 60) + ',' + (a[1] + lift) + ' ' + bx + ',' + by + ' ' + b[0] + ',' + b[1] + '" marker-end="url(#' + (vary[c.a.id] ? 'marA' : 'mar') + ')"/>';
          labels.push([(a[0] + b[0]) / 2, skip ? Math.min(a[1], b[1]) - 112 : (a[1] + by) / 2 - 6, c.what]); });
        labels.forEach(function (L) { s += '<text class="mt xs muted2 flab2" x="' + L[0] + '" y="' + L[1] + '" text-anchor="middle">' + esc(L[2]) + '</text>'; });
        fs.forEach(function (f) { var p = pos[f.id], pts = []; for (var k = 0; k < 6; k++) { var a = (k * 60) * Math.PI / 180; pts.push((p[0] + r * Math.cos(a)) + ',' + (p[1] + r * Math.sin(a))); }
          s += '<g class="hex k-' + f.kind + (f.var === 'variable' ? ' var' : '') + '"><polygon points="' + pts.join(' ') + '"/>' + svgText(p[0], p[1], f.n, 14, 'mt xs', 11) + '</g>';
          ASPECTS.forEach(function (a) { var q = pt(f.id, a[0]); s += '<circle class="asp" cx="' + q[0] + '" cy="' + q[1] + '" r="8"/><text class="mt xs" x="' + q[0] + '" y="' + (q[1] + 4) + '" text-anchor="middle">' + a[0] + '</text>'; });
        });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
        host.appendChild(note('Each hexagon is a function with its six aspects: I input, O output, P precondition, R resource, T time, C control. Orange couplings carry variability from a function whose output varies.'));
      },
      couplings: function (v, m, host) { host.appendChild(table(['From', 'Output', 'To', 'As its'], couple(m).map(function (c) { return [c.a.n, c.what, c.b.n, c.asp]; }))); },
      register: function (v, m, host) { host.appendChild(table(['Function', 'Kind'].concat(ASPECTS.map(function (a) { return a[1]; })), (m.fns || []).map(function (f) { return { cls: f.var === 'variable' ? 'sp' : '', cells: [f.n, FKIND[f.kind]].concat(ASPECTS.map(function (a) { return f[a[0]] || ''; })) }; }))); },
      variability: function (v, m, host) {
        var vary = variable(m), fs = m.fns || [], gaps = [];
        fs.forEach(function (f) { ASPECTS.forEach(function (a) { if (a[0] === 'O') return; split(f[a[0]]).forEach(function (x) { if (!fs.some(function (g) { return split(g.O).map(low).indexOf(low(x)) >= 0; })) gaps.push([f.n, a[1], x]); }); }); });
        host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'Functions whose output varies, and where the variation reaches' }), el('ul', { class: 'tl' }, fs.filter(function (f) { return f.var === 'variable'; }).map(function (f) { return el('li', { text: f.n + ' → ' + Object.keys(reach(m, f.id)).map(function (id) { return nameOf(fs, id); }).join(', ') }); }))]));
        host.appendChild(el('div', { style: 'margin-top:10px' }, [el('h4', { text: 'Aspects that no function provides (' + gaps.length + ')' }), table(['Function', 'Aspect', 'Needs'], gaps)]));
        host.appendChild(note('An aspect nobody provides is either outside the model or a gap: something assumed to be there that no function produces.'));
      }
    }
  });
  var split = function (s) { return String(s || '').split(';').map(function (x) { return x.trim(); }).filter(Boolean); }, low = function (s) { return s.toLowerCase(); };
  function couple(m) { var fs = m.fns || [], out = []; fs.forEach(function (a) { split(a.O).forEach(function (o) { fs.forEach(function (b) { if (b === a) return; ASPECTS.forEach(function (x) { if (x[0] === 'O') return; if (split(b[x[0]]).map(low).indexOf(low(o)) >= 0) out.push({ a: a, b: b, what: o, k: x[0], asp: x[1].toLowerCase() }); }); }); }); }); return out; }
  function reach(m, id) { var out = {}, q = [id], cs = couple(m); while (q.length) { var x = q.shift(); cs.filter(function (c) { return c.a.id === x; }).forEach(function (c) { if (!out[c.b.id] && c.b.id !== id) { out[c.b.id] = 1; q.push(c.b.id); } }); } return out; }
  function variable(m) { var out = {}; (m.fns || []).forEach(function (f) { if (f.var === 'variable') out[f.id] = 1; }); return out; }

  // ---------- social network analysis ----------
  MODELS.push({
    id: 'sna', name: 'Social network analysis', key: 'sna',
    about: 'Who talks to whom to get the work done. People who sit on many of the shortest paths between others are brokers: the network depends on them, much as a process depends on a single point of failure.',
    subject: function (v, m) { return (m.actors || []).length + ' people, ' + (m.ties || []).length + ' ties'; },
    empty: function (v, m) { return !(m.actors || []).length; },
    views: [['net', 'Network'], ['cent', 'Centrality'], ['brokers', 'Brokers and gaps']],
    edit: { lists: [{ k: 'actors', title: 'People and roles', blank: function () { return { n: '', role: '', res: '' }; }, fields: [{ k: 'n', l: 'Person or role', t: 'text' }, { k: 'role', l: 'Where they sit', t: 'text' }, { k: 'res', l: 'Resource in the inventory', t: 'sel', o: resOpts }] },
      { k: 'ties', title: 'Ties', blank: function () { return { a: '', b: '', kind: 'info', w: 1 }; }, fields: [{ k: 'a', l: 'From', t: 'sel', o: actOpts }, { k: 'b', l: 'To', t: 'sel', o: actOpts }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return Object.keys(TIES).map(function (k) { return [k, TIES[k]]; }); } }, { k: 'w', l: 'Strength (1 to 3)', t: 'num' }] }] },
    registers: function (v, m) { var c = central(m); return [{ name: 'people', head: ['Person or role', 'Where they sit', 'Ties', 'Betweenness'], rows: (m.actors || []).map(function (a) { return [a.n, a.role, c.deg[a.id], c.btw[a.id].toFixed(1)]; }) }, { name: 'ties', head: ['From', 'To', 'Kind', 'Strength'], rows: (m.ties || []).map(function (t) { return [nameOf(m.actors, t.a), nameOf(m.actors, t.b), TIES[t.kind], t.w]; }) }]; },
    draw: {
      net: function (v, m, host) {
        var as = m.actors || [], c = central(m), W = 1000, H = 560, p = layout(m, W, H), s = '', mx = Math.max.apply(null, as.map(function (a) { return c.btw[a.id]; }).concat([1]));
        (m.ties || []).forEach(function (t) { var a = p[t.a], b = p[t.b]; if (a && b) s += '<line class="tie k-' + t.kind + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" style="stroke-width:' + (0.8 + (t.w || 1) * 0.9) + '"/>'; });
        as.forEach(function (a) { var q = p[a.id], rr = 14 + 22 * c.btw[a.id] / mx; s += '<g class="actor' + (c.btw[a.id] === mx && mx > 0 ? ' top' : '') + '" data-id="' + a.id + '"><title>' + esc(a.n + (a.role ? ', ' + a.role : '')) + '</title><circle class="base" cx="' + q[0] + '" cy="' + q[1] + '" r="' + rr + '"/><circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + rr + '"/>' + svgText(q[0], q[1] + rr + 14, a.n, 20, 'mt xs', 12) + '</g>'; });
        host.appendChild(dwrap(svgEl(W, H, s, 'wide')));
        host.appendChild(el('div', { class: 'invkey' }, Object.keys(TIES).map(function (k) { return el('span', {}, [el('i', { class: 'kt k-' + k }), document.createTextNode(TIES[k])]); })));
        host.appendChild(note('The bigger the circle, the more the network relies on that person to connect others (betweenness).'));
      },
      cent: function (v, m, host) { var c = central(m); host.appendChild(table(['Person or role', 'Where they sit', 'Direct ties', 'Betweenness'], (m.actors || []).slice().sort(function (a, b) { return c.btw[b.id] - c.btw[a.id]; }).map(function (a) { return [a.n, a.role, String(c.deg[a.id]), c.btw[a.id].toFixed(1)]; }))); host.appendChild(note('Betweenness counts how many of the shortest paths between other people pass through this person.')); },
      brokers: function (v, m, host) {
        var c = central(m), as = m.actors || [], top = as.slice().sort(function (a, b) { return c.btw[b.id] - c.btw[a.id]; }).filter(function (a) { return c.btw[a.id] > 0; }).slice(0, 3), iso = as.filter(function (a) { return !c.deg[a.id]; });
        host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'Brokers: if they are away, these people lose their route to each other' }), el('ul', { class: 'tl' }, top.map(function (a) { var r = byId(ress(v), a.res); return el('li', { text: a.n + ' (betweenness ' + c.btw[a.id].toFixed(1) + ')' + (r && X.isSpof(r) ? ': also a single point of failure in the inventory' : '') }); }))]));
        host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'People with no ties recorded' }), iso.length ? el('ul', { class: 'tl' }, iso.map(function (a) { return el('li', { text: a.n }); })) : el('div', { class: 'sm muted', text: 'None' })]));
      }
    }
  });
  function actOpts(v) { return ((v.sna || {}).actors || []).map(function (a) { return [a.id, a.n]; }); }
  // Degree and betweenness (Brandes), with ties treated as two-way.
  function central(m) {
    var ids = (m.actors || []).map(function (a) { return a.id; }), nb = {}, deg = {}, btw = {};
    ids.forEach(function (i) { nb[i] = []; deg[i] = 0; btw[i] = 0; });
    (m.ties || []).forEach(function (t) { if (nb[t.a] && nb[t.b] && t.a !== t.b) { if (nb[t.a].indexOf(t.b) < 0) { nb[t.a].push(t.b); nb[t.b].push(t.a); } } });
    ids.forEach(function (i) { deg[i] = nb[i].length; });
    ids.forEach(function (s) {
      var st = [], P = {}, sg = {}, d = {}, q = [s]; ids.forEach(function (w) { P[w] = []; sg[w] = 0; d[w] = -1; }); sg[s] = 1; d[s] = 0;
      while (q.length) { var v = q.shift(); st.push(v); nb[v].forEach(function (w) { if (d[w] < 0) { q.push(w); d[w] = d[v] + 1; } if (d[w] === d[v] + 1) { sg[w] += sg[v]; P[w].push(v); } }); }
      var dl = {}; ids.forEach(function (w) { dl[w] = 0; });
      while (st.length) { var w = st.pop(); P[w].forEach(function (v) { dl[v] += sg[v] / sg[w] * (1 + dl[w]); }); if (w !== s) btw[w] += dl[w]; }
    });
    ids.forEach(function (i) { btw[i] = btw[i] / 2; });
    return { deg: deg, btw: btw };
  }
  // A spring layout, started from a circle so it comes out the same each time.
  function layout(m, W, H) {
    var as = m.actors || [], p = {}, n = as.length || 1, k = 0.9 * Math.sqrt(W * H / n), temp = W / 8;
    as.forEach(function (a, i) { var ang = i * 2 * Math.PI / n; p[a.id] = [W / 2 + 200 * Math.cos(ang), H / 2 + 150 * Math.sin(ang)]; });
    var ties = (m.ties || []).filter(function (t) { return p[t.a] && p[t.b] && t.a !== t.b; });
    for (var it = 0; it < 400; it++) {
      var d = {}; as.forEach(function (a) { d[a.id] = [0, 0]; });
      as.forEach(function (a) { as.forEach(function (b) { if (a === b) return; var dx = p[a.id][0] - p[b.id][0], dy = p[a.id][1] - p[b.id][1], dist = Math.max(1, Math.sqrt(dx * dx + dy * dy)), f = k * k / dist; d[a.id][0] += dx / dist * f; d[a.id][1] += dy / dist * f; }); });
      ties.forEach(function (t) { var dx = p[t.a][0] - p[t.b][0], dy = p[t.a][1] - p[t.b][1], dist = Math.max(1, Math.sqrt(dx * dx + dy * dy)), f = dist * dist / k; d[t.a][0] -= dx / dist * f; d[t.a][1] -= dy / dist * f; d[t.b][0] += dx / dist * f; d[t.b][1] += dy / dist * f; });
      as.forEach(function (a) { var dx = d[a.id][0], dy = d[a.id][1], len = Math.max(1, Math.sqrt(dx * dx + dy * dy)); p[a.id][0] += dx / len * Math.min(len, temp); p[a.id][1] += dy / len * Math.min(len, temp); });
      temp *= 0.985;
    }
    var xs = as.map(function (a) { return p[a.id][0]; }), ys = as.map(function (a) { return p[a.id][1]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    as.forEach(function (a) { p[a.id] = [90 + (p[a.id][0] - x0) / Math.max(1, x1 - x0) * (W - 180), 60 + (p[a.id][1] - y0) / Math.max(1, y1 - y0) * (H - 130)]; });
    return p;
  }

  // ---------- agent-based model, with a calibrated twin ----------
  // Only called a calibrated twin when most of its numbers come from data (1 November 2026).
  function twinOf(m) {
    var xs = (m.procs || []).concat(m.res || []), real = xs.filter(function (x) { return ['log', 'client', 'document', 'calibrated'].indexOf(x.from) >= 0; }).length;
    if (!m.cal || !m.cal.at) return { k: 'none', t: 'Not yet calibrated', real: real, n: xs.length };
    return real * 2 > xs.length ? { k: 'cal', t: 'Calibrated twin', real: real, n: xs.length } : { k: 'assumed', t: 'Assumed values', real: real, n: xs.length };
  }
  MODELS.push({
    id: 'abm', hidden: 'abm', name: 'Agent-based model', key: 'abm',
    about: 'The map run over time. Work arrives, passes through the processes, and waits when a resource is down; resources fail and recover as the calibration says. Run it once to watch a week, or many times to see how often the impact tolerance is breached. Calibrated with the organisation’s own data and refreshed by import; never a live feed.',
    subject: function (v, m) { var tw = twinOf(m); return tw.k === 'cal' ? 'Calibrated twin, data as at ' + fmtD(m.cal.at) : tw.k === 'assumed' ? 'Assumed values: ' + tw.real + ' of ' + tw.n + ' numbers from data' : 'Not yet calibrated'; },
    empty: function (v, m) { return !(m.procs || []).length; },
    views: [['calib', 'Calibration'], ['run', 'One run over time'], ['many', 'Many runs'], ['scen', 'Scenarios'], ['drivers', 'What drives breaches'], ['engines', 'Second engine (Mesa)']],
    edit: { root: [{ k: 'states', l: 'Operating states in staff\u2019s own words: what they call it when short, how often, what they drop first', t: 'long' }, { k: 'horizon', l: 'Hours to run', t: 'num' }, { k: 'runs', l: 'Runs for each test', t: 'num' }, { k: 'seed', l: 'Starting number for the random draws', t: 'num' }, { k: 'start', l: 'Day the run starts', t: 'sel', o: function () { return DAYS.map(function (d, i) { return [String(i), d]; }); } }],
      lists: [{ k: 'procs', title: 'Volumes and capacity, by process', blank: function () { return { p: '', arrive: null, cap: 2 }; }, fields: [{ k: 'p', l: 'Process', t: 'sel', o: procOpts }, { k: 'arrive', l: 'Arrivals a day (first process)', t: 'num' }, { k: 'cap', l: 'Items it can handle an hour', t: 'num' }, { k: 'from', l: 'Where the numbers came from', t: 'sel', o: function () { return [['', 'Not tagged'], ['log', 'From the log'], ['client', 'Entered by the organisation'], ['document', 'From a document'], ['inferred', 'Inferred'], ['assumed', 'Assumed'], ['calibrated', 'Calibrated']]; } }] },
        { k: 'res', title: 'Resources: how often they fail, for how long, and weekend cover', blank: function () { return { r: '', mtbf: null, out: null, wk: 1 }; }, fields: [{ k: 'r', l: 'Resource', t: 'sel', o: function (v) { return resOpts(v).slice(1); } }, { k: 'mtbf', l: 'Days between failures (blank: from incidents)', t: 'num' }, { k: 'out', l: 'Hours down when it fails (blank: from incidents or recovery time)', t: 'num' }, { k: 'wk', l: 'Weekend cover (0 to 1)', t: 'num' }, { k: 'from', l: 'Where the numbers came from', t: 'sel', o: function () { return [['', 'Not tagged'], ['log', 'From the log'], ['client', 'Entered by the organisation'], ['document', 'From a document'], ['inferred', 'Inferred'], ['assumed', 'Assumed'], ['calibrated', 'Calibrated']]; } }] },
        { k: 'facts', title: 'Things the organisation knows to be true, named before a run (the model should reproduce them)', blank: function () { return { t: '', src: '' }; }, fields: [{ k: 't', l: 'What they know', t: 'text' }, { k: 'src', l: 'Who said so', t: 'text' }] },
        { k: 'shocks', title: 'Scenarios: what each one does', blank: function () { return { s: '', r: '', from: 0, hours: 24, level: 0 }; }, fields: [{ k: 's', l: 'Scenario', t: 'sel', o: function (v) { return (v.scenarios || []).map(function (s) { return [s.id, s.n]; }); } }, { k: 'r', l: 'Resource', t: 'sel', o: function (v) { return resOpts(v).slice(1); } }, { k: 'from', l: 'From hour', t: 'num' }, { k: 'hours', l: 'For hours', t: 'num' }, { k: 'level', l: 'Available (0 to 1)', t: 'num' }] }] },
    registers: function (v, m) { var rs = scenResults(v, m); return [{ name: 'scenario-results', head: ['Scenario', 'Runs', 'Share of replays with a breach', 'Median worst delay (hours)', '90 in 100 runs under (hours)', 'Worst seen (hours)', 'Impact tolerance (hours)'], rows: rs.map(function (r) { return [r.n, r.runs, Math.round(r.pb * 100) + ' in 100', r.med.toFixed(1), r.p90.toFixed(1), r.max.toFixed(1), tolOf(v)]; }) }, { name: 'calibration', head: ['Resource', 'Days between failures', 'Hours down', 'Weekend cover', 'Taken from'], rows: params(v, m).map(function (p) { return [p.r.n, p.mtbf.toFixed(0), p.out.toFixed(1), p.wk, p.from]; }) }]; },
    draw: {
      calib: function (v, m, host) {
        var tw = twinOf(m); host.appendChild(el('div', { class: 'twin' }, [el('b', { text: tw.t }), el('span', { text: tw.k === 'assumed' ? ' Only ' + tw.real + ' of the ' + tw.n + ' numbers come from a log, a document or the organisation; the rest are assumed or inferred. Read the results as what could happen, not as a forecast.' + (m.cal.from ? ' Source: ' + m.cal.from + '.' : '') : m.cal && m.cal.at ? ' Data as at ' + fmtD(m.cal.at) + (m.cal.from ? ', from ' + m.cal.from : '') + '. Not a live feed: refresh it by importing new data before a retest.' : ' Add volumes and incidents, or import them, to calibrate the model to this service.' })]));
        var f1 = el('input', { type: 'file', id: 'abmVol', accept: '.csv,text/csv', hidden: true }), f2 = el('input', { type: 'file', id: 'abmInc', accept: '.csv,text/csv', hidden: true });
        f1.addEventListener('change', function () { importAbm(f1, 'vol', v); }); f2.addEventListener('change', function () { importAbm(f2, 'inc', v); });
        host.appendChild(el('div', { class: 'row', style: 'margin:10px 0' }, [f1, f2, el('button', { class: 'btn sm', text: 'Refresh volumes (CSV)', onclick: function () { f1.click(); } }), el('button', { class: 'btn sm', text: 'Refresh incident history (CSV)', onclick: function () { f2.click(); } }), el('span', { class: 'muted sm', text: 'Volumes: Process, Per day, Per hour. Incidents: Date, Resource, Hours, What happened.' })]));
        host.appendChild(el('h4', { text: 'Volumes and capacity' }));
        host.appendChild(table(['Process', 'Arrivals a day', 'Items it can handle an hour'], (m.procs || []).map(function (x) { return [nameOf(procs(v), x.p), x.arrive || '', x.cap]; })));
        host.appendChild(el('h4', { text: 'Resources', style: 'margin-top:14px' }));
        host.appendChild(table(['Resource', 'Alternative', 'Days between failures', 'Hours down', 'Weekend cover', 'Taken from'], params(v, m).map(function (p) { return { cls: X.isSpof(p.r) ? 'sp' : '', cells: [p.r.n, p.r.alt, p.mtbf.toFixed(0), p.out.toFixed(1), String(p.wk), p.from] }; })));
        host.appendChild(note('Where a resource has incidents in the timeline, how often it fails and for how long are worked out from them; otherwise from what is entered here, or from its recovery time. When a resource is down, its alternative carries part of the load: none carries nothing, a partial one half.'));
      },
      run: function (v, m, host) {
        var scs = (v.scenarios || []).filter(function (s) { return (m.shocks || []).some(function (x) { return x.s === s.id; }); });
        var sel = el('select', { id: 'abmScen' }, [el('option', { value: '', text: 'An ordinary week' })].concat(scs.map(function (s) { return el('option', { value: s.id, text: s.n }); }))); sel.value = S.abmScen || '';
        sel.addEventListener('change', function () { S.abmScen = sel.value; X.render(); });
        var seed = S.abmSeed || Number(m.seed) || 7, r = sim(v, m, { seed: seed, scen: S.abmScen || '' });
        var read = el('div', { class: 'abmread', id: 'abmRead', text: 'Press Play to watch the run hour by hour.' });
        host.appendChild(el('div', { class: 'row', style: 'margin-bottom:10px' }, [sel, el('button', { class: 'btn sm', id: 'abmAgain', text: 'Run again', onclick: function () { S.abmSeed = seed + 1; X.render(); } }), el('button', { class: 'btn sm warm', id: 'abmPlay', text: 'Play', onclick: function () { play(r, v, read, host); } }), el('span', { class: 'muted sm', text: 'Run ' + seed + ': ' + r.items + ' items, ' + r.breaches + ' outside the tolerance, longest wait ' + r.worst.toFixed(1) + ' hours' })]));
        host.appendChild(chart(r, v, m)); host.appendChild(read);
      },
      engines: function (v, m, host) {
        // The same model run by a second engine on the server (Mesa, in Python), set beside the browser's own.
        var spec = mesaSpec(v, m), scs = [''].concat((v.scenarios || []).filter(function (s) { return (m.shocks || []).some(function (x) { return x.s === s.id; }); }).map(function (s) { return s.id; }));
        var key = JSON.stringify([spec, scs, m.runs, m.seed]), memo = S.mesaMemo = S.mesaMemo || {}, res = memo[key];
        var mine = scenResults(v, m), nm = function (id) { var s = (v.scenarios || []).filter(function (x) { return x.id === id; })[0]; return id ? (s ? s.n : id) : 'An ordinary week'; };
        host.appendChild(note('The browser runs the model instantly, on this device. The second engine runs the same rules on the server, with Mesa, an open-source agent-based modelling library in Python. Run both: if they agree, the answer does not depend on the engine. The second engine is also where richer behaviour (people deciding what to drop, passing things on, adjusting) will be added.'));
        var out = el('div', { id: 'mesaOut' });
        host.appendChild(el('div', { class: 'row', style: 'margin:10px 0;align-items:center' }, [el('button', { class: 'btn sm warm', id: 'mesaRun', text: res ? 'Run again on the server' : 'Run on the server', onclick: async function (e) { e.target.disabled = true; out.textContent = 'Running ' + (Number(m.runs) || 200) + ' replays of each scenario on the server…'; try { var r = await fetch('/api/abm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec: spec, runs: Number(m.runs) || 200, seed: Number(m.seed) || 7, scenarios: scs }) }); var b = await r.json().catch(function () { return { error: 'The server did not answer.' }; }); memo[key] = r.ok ? b : { error: b.error || 'The model could not be run on the server.' }; } catch (err) { memo[key] = { error: 'The server could not be reached.' }; } X.render(); } })]));
        host.appendChild(out);
        if (res && res.error) { out.appendChild(el('p', { class: 'msg bad', text: res.error })); }
        var srv = res && res.results ? res.results : null, pc = function (x) { return x == null ? '' : Math.round(x * 100) + ' in 100'; }, hr = function (x) { return x == null ? '' : Number(x).toFixed(1) + ' h'; };
        var rows = scs.map(function (id, i) { var a = mine[i] || {}, b = srv ? srv.filter(function (x) { return x.scen === id; })[0] : null; var gap = b ? Math.abs(a.pb - b.pb) : null; return { cls: gap != null && gap > 0.1 ? 'sp' : '', cells: [nm(id), pc(a.pb), hr(a.med), hr(a.p90), b ? pc(b.pb) : 'Not run', b ? hr(b.med) : '', b ? hr(b.p90) : '', gap == null ? '' : gap <= 0.05 ? 'Agree' : gap <= 0.1 ? 'Close' : 'Differ: look again'] }; });
        out.appendChild(table(['Scenario', 'Browser: replays with a breach', 'Typical longest wait', '1 in 10 longer than', 'Server (Mesa): replays with a breach', 'Typical longest wait', '1 in 10 longer than', 'The two engines'], rows));
        if (srv) out.appendChild(note('Both use ' + (Number(m.runs) || 200) + ' replays per scenario. The random draws differ between the engines, so small differences are expected; a gap of more than 10 in 100 is marked.'));
        out.appendChild(limitsNote(m));
      },
      many: function (v, m, host) {
        var rs = many(v, m, ''), tol = tolOf(v), b = rs.filter(function (r) { return r.breaches > 0; }).length, ws = rs.map(function (r) { return r.worst; }).sort(function (a, c) { return a - c; });
        host.appendChild(el('div', { class: 'kpis' }, [kpi('Runs', String(rs.length)), kpi('Share of replays with a breach', Math.round(b / rs.length * 100) + ' in 100', b > 0), kpi('Typical longest wait', ws[Math.floor(ws.length / 2)].toFixed(1) + ' hours'), kpi('1 run in 10 waits longer than', ws[Math.floor(ws.length * .9)].toFixed(1) + ' hours', ws[Math.floor(ws.length * .9)] > tol)]));
        host.appendChild(hist(ws, tol));
        host.appendChild(note('Each bar counts runs by the longest wait for any item in that run. The orange line is the impact tolerance (' + tol + ' hours).'));
        host.appendChild(limitsNote(m));
      },
      scen: function (v, m, host) {
        var rs = scenResults(v, m), tol = tolOf(v), col = function (h) { return h <= tol ? 'g' : h <= tol * 1.5 ? 'a' : 'r'; };
        var t = el('table', { class: 'itab heat2' });
        t.appendChild(el('tr', {}, ['Scenario', 'Share of replays with a breach', 'Median longest wait', '1 run in 10 longer than', 'Worst seen', 'Estimate in the inventory (worst case)'].map(function (h) { return el('th', { text: h }); })));
        rs.forEach(function (r) { t.appendChild(el('tr', {}, [el('td', { text: r.n }), el('td', { text: Math.round(r.pb * 100) + ' in 100' }), el('td', { class: col(r.med), text: r.med.toFixed(1) }), el('td', { class: col(r.p90), text: r.p90.toFixed(1) }), el('td', { class: col(r.max), text: r.max.toFixed(1) }), el('td', { text: r.est == null ? '' : String(r.est) })])); });
        host.appendChild(el('div', { class: 'nwrap' }, [t]));
        host.appendChild(note('Hours. Each scenario is run ' + (Number(m.runs) || 200) + ' times. The last column is the judgement recorded in the inventory, for comparison; the model does not overwrite it.'));
        host.appendChild(limitsNote(m));
      },
      drivers: function (v, m, host) {
        var rs = many(v, m, ''), tot = {}, all = 0; rs.forEach(function (r) { all += r.breaches; Object.keys(r.by).forEach(function (k) { tot[k] = (tot[k] || 0) + r.by[k]; }); });
        var list = Object.keys(tot).map(function (k) { return [byId(ress(v), k), tot[k]]; }).filter(function (x) { return x[0]; }).sort(function (a, b) { return b[1] - a[1]; });
        host.appendChild(table(['Resource', 'Alternative', 'Share of breached items it held up', 'Single point of failure'], list.map(function (x) { return { cls: X.isSpof(x[0]) ? 'sp' : '', cells: [x[0].n, x[0].alt, all ? Math.round(x[1] / all * 100) + ' in 100' : '', X.isSpof(x[0]) ? 'Yes' : 'No'] }; })));
        host.appendChild(note('For every item that waited longer than the tolerance, the resources that were down or short while it waited. One item can be held up by more than one resource.'));
      }
    }
  });
  function limitsNote(m) {
    var tags = (m.procs || []).concat(m.res || []), assumed = tags.filter(function (x) { return !x.from || x.from === 'assumed' || x.from === 'inferred'; }).length;
    return el('div', { class: 'limits' }, [el('b', { text: 'Limits of the replays. ' }), document.createTextNode('Each replay is one plausible version of the week, drawn from the calibration; the shares are shares of replays, not a forecast of what will happen. They are only as good as the numbers behind them: ' + assumed + ' of ' + tags.length + ' entries are assumed, inferred or not yet tagged. Conditions the model does not contain, such as a person who stays late or a second failure caused by the first, are not in the replays.')]);
  }
  var tolOf = function (v) { var h = v.tolerance && v.tolerance.hours; return h === 0 || h === '0' ? 0 : (Number(h) || 12); };
  function rng(seed) { var a = seed >>> 0 || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var altLevel = function (r) { var a = String(r.alt || '').trim().toLowerCase(); return !a || a === 'none' ? 0 : /^partial/.test(a) ? 0.5 : 0.85; };
  // How often each resource fails and for how long: from incidents in the timeline where there are any, else as entered, else from its recovery time.
  function params(v, m) {
    var ev = ((v.timeline || {}).events || []).filter(function (e) { return e.kind === 'incident' && e.res; }), ds = ev.map(function (e) { return +new Date(e.d); }).filter(function (x) { return !isNaN(x); });
    var spanDays = ds.length > 1 ? Math.max(90, (Math.max.apply(null, ds) - Math.min.apply(null, ds)) / 864e5) : 365;
    return ress(v).filter(function (r) { return r.dir !== 'relied on by'; }).map(function (r) {
      var p = (m.res || []).filter(function (x) { return x.r === r.id; })[0] || {}, mine = ev.filter(function (e) { return e.res === r.id; }), from = [];
      var mtbf = p.mtbf ? (from.push('entered'), Number(p.mtbf)) : mine.length ? (from.push(mine.length + ' incidents'), spanDays / mine.length) : (from.push('assumed'), 365);
      var hs = mine.map(function (e) { return Number(e.hours) || 0; }).filter(Boolean);
      var out = p.out ? Number(p.out) : hs.length ? hs.reduce(function (a, b) { return a + b; }, 0) / hs.length : (hours(r.rto) || 4);
      if (!p.out) from.push(hs.length ? 'durations from incidents' : 'recovery time');
      return { r: r, mtbf: mtbf, out: out, wk: p.wk == null || p.wk === '' ? 1 : Number(p.wk), alt: altLevel(r), from: from.join(', ') };
    });
  }
  // One run: hour by hour, items arrive at the first process and move along; a process
  // handles as many items as its capacity allows, cut back by any resource that is down or short.
  function sim(v, m, o) {
    var R = rng(o.seed), H = Number(m.horizon) || 168, start = Number(m.start) || 0, tol = tolOf(v), ps = procs(v).filter(function (p) { return (m.procs || []).some(function (x) { return x.p === p.id; }); });
    var cfg = ps.map(function (p) { var c = (m.procs || []).filter(function (x) { return x.p === p.id; })[0]; return { p: p, cap: Number(c.cap) || 2, arrive: Number(c.arrive) || 0, rs: ress(v).filter(function (r) { return r.dir !== 'relied on by' && (r.u || []).indexOf(p.id) >= 0; }).map(function (r) { return r.id; }) }; });
    var par = params(v, m), downTo = {}, avail = {}, downs = {}, shocks = (m.shocks || []).filter(function (x) { return o.scen && x.s === o.scen; });
    var q = cfg.map(function () { return []; }), done = [], backlog = [], oldest = [], hurt = [], qs = [], avs = [], arriveRate = cfg.length ? cfg[0].arrive / 24 : 0;
    for (var h = 0; h < H; h++) {
      var wkend = Math.floor((start * 24 + h) / 24) % 7 >= 5, bad = {};
      par.forEach(function (p) {
        var id = p.r.id;
        if (!(downTo[id] > h) && R() < 1 / (p.mtbf * 24)) { downTo[id] = h + Math.max(1, Math.ceil(-Math.log(1 - R()) * p.out)); (downs[id] = downs[id] || []).push([h, Math.min(H, downTo[id]), 'failure']); }
        var a = downTo[id] > h ? p.alt : 1;
        if (wkend && p.r.t === 'people') a = Math.min(a, p.wk);
        shocks.forEach(function (s) { if (s.r === id && h >= Number(s.from) && h < Number(s.from) + Number(s.hours)) { var lv = Number(s.level) || 0; a = Math.min(a, lv === 0 ? p.alt : lv); if (h === Number(s.from)) (downs[id] = downs[id] || []).push([h, Math.min(H, Number(s.from) + Number(s.hours)), 'scenario']); } });
        avail[id] = a; if (a < 1) bad[id] = 1;
      });
      hurt.push(bad);
      // arrivals (a Poisson draw)
      var L = Math.exp(-arriveRate), k = 0, pr = 1; do { k++; pr *= R(); } while (pr > L); for (var i = 0; i < k - 1; i++) q[0] && q[0].push({ born: h + R() });
      var moved = cfg.map(function () { return []; });
      cfg.forEach(function (c, j) {
        var cap = c.cap * c.rs.reduce(function (a, id) { return Math.min(a, avail[id] == null ? 1 : avail[id]); }, 1), n = Math.floor(cap) + (R() < cap - Math.floor(cap) ? 1 : 0);
        var go = q[j].splice(0, n);
        go.forEach(function (it) { if (j === cfg.length - 1) { it.end = h + 1; done.push(it); } else moved[j + 1].push(it); });
      });
      moved.forEach(function (list, j) { q[j] = q[j].concat(list); });
      qs.push(q.map(function (x) { return x.length; })); avs.push(JSON.parse(JSON.stringify(avail)));
      var all = [].concat.apply([], q); backlog.push(all.length); oldest.push(all.length ? h + 1 - Math.min.apply(null, all.map(function (x) { return x.born; })) : 0);
    }
    var openN = [].concat.apply([], q).length;
    [].concat.apply([], q).forEach(function (it) { it.end = H; it.open = true; done.push(it); });
    var by = {}, breaches = 0, worst = 0;
    var lateDone = 0; done.forEach(function (it) { var age = it.end - it.born; worst = Math.max(worst, age); if (age > tol && !it.open) lateDone++; if (age > tol) { breaches++; var seen = {}; for (var x = Math.floor(it.born); x < Math.min(H, Math.ceil(it.end)); x++) Object.keys(hurt[x] || {}).forEach(function (id) { seen[id] = 1; }); Object.keys(seen).forEach(function (id) { by[id] = (by[id] || 0) + 1; }); } });
    return { H: H, start: start, items: done.length, open: openN, lateDone: lateDone, breaches: breaches, worst: worst, backlog: backlog, oldest: oldest, downs: downs, by: by, hurt: hurt,
      // hour by hour, for Run: the queue at each step and how much of each resource was there (5 November 2026)
      steps: cfg.map(function (c) { return { id: c.p.id, n: c.p.n || '', rs: c.rs, cap: c.cap }; }), qs: qs, avs: avs, tol: tol };
  }
  // The model as plain numbers, for the second engine on the server (api/abm.py): the same inputs sim() reads.
  function mesaSpec(v, m) {
    var ps = procs(v).filter(function (p) { return (m.procs || []).some(function (x) { return x.p === p.id; }); });
    return { H: Number(m.horizon) || 168, start: Number(m.start) || 0, tol: tolOf(v),
      procs: ps.map(function (p) { var c = (m.procs || []).filter(function (x) { return x.p === p.id; })[0]; return { id: p.id, cap: Number(c.cap) || 2, arrive: Number(c.arrive) || 0, rs: ress(v).filter(function (r) { return r.dir !== 'relied on by' && (r.u || []).indexOf(p.id) >= 0; }).map(function (r) { return r.id; }) }; }),
      res: params(v, m).map(function (p) { return { id: p.r.id, mtbf: p.mtbf, out: p.out, wk: p.wk, alt: p.alt, people: p.r.t === 'people' }; }),
      shocks: (m.shocks || []).map(function (x) { return { s: x.s, r: x.r, from: Number(x.from) || 0, hours: Number(x.hours) || 0, level: Number(x.level) || 0 }; }) };
  }
  var cache = {};
  function many(v, m, scen) {
    var key = JSON.stringify([v.processes, v.resources, v.tolerance, m, (v.timeline || {}).events, scen]); if (cache[key]) return cache[key];
    var n = Math.max(10, Math.min(1000, Number(m.runs) || 200)), base = Number(m.seed) || 7, out = [];
    for (var i = 0; i < n; i++) out.push(sim(v, m, { seed: base * 1000 + i, scen: scen }));
    cache = {}; cache[key] = out; return out;
  }
  function scenResults(v, m) {
    var tol = tolOf(v), list = [{ id: '', n: 'An ordinary week' }].concat((v.scenarios || []).filter(function (s) { return (m.shocks || []).some(function (x) { return x.s === s.id; }); }));
    return list.map(function (s) { var rs = many(v, m, s.id), ws = rs.map(function (r) { return r.worst; }).sort(function (a, b) { return a - b; }); return { n: s.n, runs: rs.length, pb: rs.filter(function (r) { return r.breaches > 0; }).length / rs.length, med: ws[Math.floor(ws.length / 2)], p90: ws[Math.floor(ws.length * .9)], max: ws[ws.length - 1], est: s.worst == null ? null : s.worst, tol: tol }; });
  }
  function chart(r, v, m) {
    var H = r.H, W = 1180, P = 270, top = 230, tol = tolOf(v), ids = Object.keys(r.downs), gh = 18, total = top + 40 + ids.length * gh + 10;
    var ymax = Math.max(tol * 1.4, Math.max.apply(null, r.oldest.concat([1]))), x = function (h) { return P + h / H * (W - P - 10); }, y = function (a) { return 20 + (1 - a / ymax) * (top - 30); }, s = '';
    for (var d = 0; d <= H / 24; d++) { var hx = x(d * 24); s += '<line class="tick" x1="' + hx + '" y1="20" x2="' + hx + '" y2="' + (top - 10) + '"/>'; if (d < H / 24) s += '<text class="mt xs" x="' + (hx + (x(24) - x(0)) / 2) + '" y="' + (top + 6) + '">' + DAYS[(r.start + d) % 7].slice(0, 3) + '</text>'; if (((r.start + d) % 7) >= 5 && d < H / 24) s += '<rect class="wkend" x="' + hx + '" y="20" width="' + (x(24) - x(0)) + '" height="' + (top - 30) + '"/>'; }
    s += '<line class="tol" x1="' + P + '" y1="' + y(tol) + '" x2="' + (W - 10) + '" y2="' + y(tol) + '"/><text class="mt xs tolt" x="' + (P + 4) + '" y="' + (y(tol) - 5) + '" text-anchor="start">' + (tol ? 'Impact tolerance, ' + tol + (tol === 1 ? ' hour' : ' hours') : 'Impact tolerance: intolerable at once') + '</text>';
    s += '<polyline class="aged" points="' + r.oldest.map(function (a, h) { return x(h + 1) + ',' + y(a); }).join(' ') + '"/>';
    s += '<text class="mt xs" x="' + (P - 6) + '" y="' + y(0) + '" text-anchor="end">0</text><text class="mt xs" x="' + (P - 6) + '" y="' + (y(ymax) + 8) + '" text-anchor="end">' + Math.round(ymax) + 'h</text>';
    ids.forEach(function (id, i) { var yy = top + 30 + i * gh; s += '<text class="mt xs" x="' + (P - 6) + '" y="' + (yy + 11) + '" text-anchor="end">' + (function (n) { return '<title>' + esc(n) + '</title>' + esc(n.length > 44 ? n.slice(0, 43).replace(/\s+\S*$/, '') + '…' : n); })(nameOf(ress(v), id)) + '</text>'; r.downs[id].forEach(function (b) { s += '<rect class="down ' + b[2] + '" x="' + x(b[0]) + '" y="' + yy + '" width="' + Math.max(2, x(b[1]) - x(b[0])) + '" height="' + (gh - 5) + '" rx="2"/>'; }); });
    s += '<line class="cursor" id="abmCur" x1="' + P + '" y1="16" x2="' + P + '" y2="' + (total - 4) + '" style="display:none"/>';
    var wrapEl = el('div', {}, [dwrap(svgEl(W, total, s, 'wide abm'))]);
    wrapEl.appendChild(el('div', { class: 'invkey' }, [el('span', {}, [el('i', { style: 'background:#e07030' }), document.createTextNode('Longest an item has been waiting')]), el('span', {}, [el('i', { style: 'background:#d9472b' }), document.createTextNode('Resource down (failure)')]), el('span', {}, [el('i', { style: 'background:#7b4fc9' }), document.createTextNode('Resource short (the scenario)')]), el('span', {}, [el('i', { style: 'background:rgba(160,152,144,.35)' }), document.createTextNode('Weekend')])]));
    return wrapEl;
  }
  var timer = null;
  function play(r, v, read, host) {
    if (timer) { clearInterval(timer); timer = null; }
    var cur = host.querySelector('#abmCur'), h = 0, W = 1180, P = 190; if (!cur) return; cur.style.display = '';
    timer = setInterval(function () {
      if (!document.body.contains(read) || h >= r.H) { clearInterval(timer); timer = null; return; }
      var hx = P + (h + 1) / r.H * (W - P - 10); cur.setAttribute('x1', hx); cur.setAttribute('x2', hx);
      var day = DAYS[Math.floor((r.start * 24 + h) / 24) % 7], dn = Object.keys(r.hurt[h] || {}).map(function (id) { return nameOf(ress(v), id); });
      read.textContent = day + ' ' + String(h % 24).padStart(2, '0') + ':00  ·  ' + r.backlog[h] + ' waiting  ·  longest wait ' + r.oldest[h].toFixed(1) + ' hours' + (dn.length ? '  ·  down or short: ' + dn.join(', ') : '');
      read.classList.toggle('warn', r.oldest[h] > tolOf(v)); h++;
    }, 45);
  }
  function hist(ws, tol) {
    var mx = Math.max(tol * 2, ws[ws.length - 1] || 1), bins = 24, w = mx / bins, c = new Array(bins).fill(0); ws.forEach(function (x) { c[Math.min(bins - 1, Math.floor(x / w))]++; });
    var W = 1000, H = 220, P = 40, bw = (W - P - 10) / bins, top = Math.max.apply(null, c), s = '';
    c.forEach(function (n, i) { var hh = n / top * (H - 50); s += '<rect class="hb' + ((i + 1) * w > tol ? ' over' : '') + '" x="' + (P + i * bw + 1) + '" y="' + (H - 30 - hh) + '" width="' + (bw - 2) + '" height="' + hh + '"/>'; if (i % 4 === 0) s += '<text class="mt xs" x="' + (P + i * bw) + '" y="' + (H - 12) + '">' + Math.round(i * w) + 'h</text>'; });
    var tx = P + tol / w * bw; s += '<line class="tol" x1="' + tx + '" y1="10" x2="' + tx + '" y2="' + (H - 30) + '"/>';
    return el('div', { class: 'dscroll', style: 'margin-top:12px' }, [svgEl(W, H, s, 'wide')]);
  }
  async function importAbm(input, which, v0) {
    var f = input.files[0]; if (!f) return;
    try {
      var rows = X.parseCsv(await f.text()); if (rows.length < 2) throw new Error('No rows found in that file');
      var h = rows[0].map(function (x) { return x.trim().toLowerCase(); }), col = function () { for (var i = 0; i < arguments.length; i++) { var k = h.indexOf(arguments[i]); if (k >= 0) return k; } return -1; };
      var v = X.invData(), m = v.abm = v.abm || {}, n = 0, find = function (list, name) { name = String(name || '').trim().toLowerCase(); return (list || []).filter(function (x) { return x.n.toLowerCase() === name; })[0]; };
      if (which === 'vol') {
        var cp = col('process', 'name'), cd = col('per day', 'arrivals a day', 'volume'), ch = col('per hour', 'capacity', 'capacity per hour'); if (cp < 0) throw new Error('The file needs a column called Process');
        m.procs = m.procs || [];
        rows.slice(1).forEach(function (r) { var p = find(procs(v), r[cp]); if (!p) return; var x = m.procs.filter(function (y) { return y.p === p.id; })[0]; if (!x) { x = { id: X.nid('q', m.procs), p: p.id, cap: 2 }; m.procs.push(x); } if (cd >= 0 && r[cd] !== '') x.arrive = Number(r[cd]); if (ch >= 0 && r[ch] !== '') x.cap = Number(r[ch]); n++; });
      } else {
        var c1 = col('date'), c2 = col('resource'), c3 = col('hours', 'duration', 'hours lost'), c4 = col('what happened', 'description', 'note'); if (c1 < 0 || c2 < 0) throw new Error('The file needs columns called Date and Resource');
        v.timeline = v.timeline || { events: [] }; v.timeline.events = v.timeline.events || [];
        rows.slice(1).forEach(function (r) { var res = find(ress(v), r[c2]); if (!res) return; v.timeline.events.push({ id: X.nid('e', v.timeline.events), d: String(r[c1]).trim(), n: c4 >= 0 && r[c4] ? r[c4] : res.n + ' unavailable', phase: PHASES[0], kind: 'incident', res: res.id, hours: c3 >= 0 ? Number(r[c3]) || null : null, note: 'Imported from ' + f.name }); n++; });
      }
      m.cal = { at: new Date().toISOString().slice(0, 10), from: f.name };
      await X.saveInv(v); X.render(); alert(n + (n === 1 ? ' row' : ' rows') + ' taken in. The twin is now calibrated with data as at today.');
    } catch (e) { alert(e.message); }
    input.value = '';
  }



  // =====================================================================
  // Records kept in Diagnose, not drawn as models: the dependants profiled, the outside view,
  // where the sources disagree, and the frame tested against the evidence. Same editor, same export.
  // =====================================================================
  var ALT = [['other', 'Another provider'], ['way', 'Another way'], ['defer', 'Put it off'], ['without', 'Go without'], ['none', 'None of these'], ['unknown', 'Not known']];
  var REB = [['time', 'Rebuilt in time'], ['cost', 'Rebuilt at a cost'], ['never', 'Never: it cannot be put back'], ['unknown', 'Not known']];
  var ARR = [['once', 'At once'], ['slow', 'Slowly'], ['later', 'Not until later']];
  var lab = function (list, v) { var x = list.filter(function (y) { return y[0] === v; })[0]; return x ? x[1] : ''; };
  MODELS.push({
    id: 'dependants', hidden: 'dependants', name: 'Dependants, profiled', key: 'dependants',
    about: 'Problem names who depends on the service and who is absent. Here each group is profiled from the evidence: what they would do if it stopped, whether the loss can be put back, how it would reach them, and whether their alternatives share a root with the service. A group that splits is ranked by its worst-off members.',
    subject: function (v, m) { return (m.groups || []).length + ' groups'; },
    empty: function (v, m) { return !(m.groups || []).length; },
    views: [['cards', 'Groups'], ['rank', 'Ranked: worst served first']],
    edit: { lists: [{ k: 'groups', title: 'Groups who depend on the service', blank: function () { return { n: '', depend: 'high', alt: 'unknown', rebuild: 'unknown', arrives: 'once', roots: '', worst: '', spoke: '', src: '' }; },
      fields: [{ k: 'n', l: 'Group', t: 'text' }, { k: 'depend', l: 'How much they depend on it', t: 'sel', o: function () { return [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]; } }, { k: 'alt', l: 'If it stopped tomorrow', t: 'sel', o: function () { return ALT; } }, { k: 'rebuild', l: 'Can the loss be put back?', t: 'sel', o: function () { return REB; } }, { k: 'arrives', l: 'How the loss reaches them', t: 'sel', o: function () { return ARR; } }, { k: 'roots', l: 'Shared roots: does their alternative rely on the same person, system, place, shift or rule?', t: 'text' }, { k: 'worst', l: 'The worst-off within the group', t: 'text' }, { k: 'spoke', l: 'Who spoke for them (deals with them, speaks for them, or is one of them)', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'dependants', head: ['Group', 'Depends', 'If it stopped', 'Can the loss be put back', 'How it reaches them', 'Shared roots', 'Worst-off', 'Who spoke for them', 'Source'], rows: (m.groups || []).map(function (g) { return [g.n, g.depend, lab(ALT, g.alt), lab(REB, g.rebuild), lab(ARR, g.arrives), g.roots, g.worst, g.spoke, g.src]; }) }]; },
    draw: {
      cards: function (v, m, host) { (m.groups || []).forEach(function (g) { host.appendChild(el('div', { class: 'jstep', 'data-id': g.id }, [el('b', { text: g.n }), el('div', { class: 'sm', text: 'Depends: ' + g.depend + '  ·  if it stopped: ' + lab(ALT, g.alt).toLowerCase() + '  ·  ' + lab(REB, g.rebuild).toLowerCase() + '  ·  the loss arrives ' + lab(ARR, g.arrives).toLowerCase() }), g.roots ? el('div', { class: 'sm', text: 'Shared roots: ' + g.roots }) : null, g.worst ? el('div', { class: 'jf', text: 'Worst-off: ' + g.worst }) : null, el('div', { class: 'sm muted', text: (g.spoke ? 'Heard through: ' + g.spoke : 'Not yet heard') + (g.src ? '  ·  ' + g.src : '') })])); }); },
      rank: function (v, m, host) {
        var score = function (g) { return (g.rebuild === 'never' ? 100 : 0) + (g.alt === 'none' || g.alt === 'without' ? 50 : 0) + ({ high: 20, medium: 10, low: 0 }[g.depend] || 0); };
        host.appendChild(table(['Rank', 'Group', 'Can the loss be put back', 'If it stopped', 'Depends'], (m.groups || []).slice().sort(function (a, b) { return score(b) - score(a); }).map(function (g, i) { return { cls: g.rebuild === 'never' ? 'sp' : '', cells: [String(i + 1), g.n + (g.worst ? ' (worst-off: ' + g.worst + ')' : ''), lab(REB, g.rebuild), lab(ALT, g.alt), g.depend] }; })));
        host.appendChild(note('Ordered as the method orders them: a loss that can never be put back first, then no other way, then how much they depend on it. A group that splits is ranked by its worst-off members.'));
      }
    }
  });
  var XKIND = [['inquiry', 'Inquiry or independent investigation'], ['inquest', 'Inquest or coroner’s report'], ['regulator', 'Regulator or ombudsman report'], ['guidance', 'National guidance'], ['research', 'Research'], ['internal', 'Earlier internal investigation']];
  MODELS.push({
    id: 'outside', hidden: 'outside', name: 'The outside view', key: 'outside',
    about: 'Evaluated external evidence: inquiries, inquests, regulators’ reports, guidance and research, here or elsewhere. Each is appraised: fact, judgement or recommendation; whether hindsight shaped it; and whether it was published before the as-at date. Anything published after it cannot be used as evidence.',
    subject: function (v, m) { return (m.items || []).length + ' items'; },
    empty: function (v, m) { return !(m.items || []).length; },
    views: [['list', 'Items'], ['usable', 'Usable at the as-at date']],
    edit: { root: [{ k: 'asat', l: 'The as-at date (year-month-day)', t: 'text' }], lists: [{ k: 'items', title: 'External evidence', blank: function () { return { n: '', kind: 'inquiry', where: 'elsewhere', d: '', says: '', reads: 'fact', hindsight: false, applies: 'partly', src: '' }; },
      fields: [{ k: 'n', l: 'Title', t: 'text' }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return XKIND; } }, { k: 'where', l: 'About', t: 'sel', o: function () { return [['here', 'This organisation'], ['elsewhere', 'Other organisations']]; } }, { k: 'd', l: 'Published (year-month-day)', t: 'text' }, { k: 'says', l: 'What it says that bears on this', t: 'long' }, { k: 'reads', l: 'Read as', t: 'sel', o: function () { return [['fact', 'Found as fact'], ['judgement', 'Judgement'], ['recommendation', 'Recommendation']]; } }, { k: 'hindsight', l: 'Shaped by hindsight', t: 'bool' }, { k: 'applies', l: 'Applies here?', t: 'sel', o: function () { return [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']]; } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'outside-view', head: ['Title', 'Kind', 'About', 'Published', 'Before the as-at date', 'Read as', 'Hindsight', 'Applies here', 'What it says'], rows: (m.items || []).map(function (x) { return [x.n, lab(XKIND, x.kind), x.where === 'here' ? 'This organisation' : 'Others', x.d, before(m, x) ? 'Yes' : 'No', x.reads, x.hindsight ? 'Yes' : 'No', x.applies, x.says]; }) }]; },
    draw: {
      list: function (v, m, host) { host.appendChild(table(['Title', 'Kind', 'About', 'Published', 'Read as', 'Applies here', 'What it says'], (m.items || []).map(function (x) { return { cls: before(m, x) ? '' : 'none', cells: [x.n, lab(XKIND, x.kind), x.where === 'here' ? 'This organisation' : 'Others', fmtD(x.d) + (before(m, x) ? '' : ' (after the as-at date)'), x.reads + (x.hindsight ? ', shaped by hindsight' : ''), x.applies, x.says] }; }))); },
      usable: function (v, m, host) {
        var ok = (m.items || []).filter(function (x) { return before(m, x); }), late = (m.items || []).filter(function (x) { return !before(m, x); });
        host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'Usable as evidence (published before ' + (m.asat ? fmtD(m.asat) : 'the as-at date') + '): ' + ok.length }), el('ul', { class: 'tl' }, ok.map(function (x) { return el('li', { text: x.n + ': ' + x.reads + (x.hindsight ? ' (shaped by hindsight)' : '') }); }))]));
        host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'Published after the as-at date: kept for the retest, not used as evidence (' + late.length + ')' }), el('ul', { class: 'tl' }, late.map(function (x) { return el('li', { text: x.n + ' (' + fmtD(x.d) + ')' }); }))]));
      }
    }
  });
  function when(t) { t = String(t || '').trim(); if (!t) return null; var v = Date.parse(t); if (!isNaN(v)) return v; var y = t.match(/\b(1[89]\d\d|20\d\d)\b/); return y ? Date.UTC(+y[1], 0, 1) : null; }
  function before(m, x) { var a = when(m.asat), b = when(x.d); return a == null || b == null || b <= a; }
  MODELS.push({
    id: 'disagree', hidden: 'disagree', name: 'Where the sources disagree', key: 'disagree',
    about: 'Two accounts of the same thing, set side by side and never merged, with what practice has quietly chosen. If cross-reading finds no disagreement at all, the documents were probably read one at a time.',
    subject: function (v, m) { return (m.items || []).length + ' disagreements'; },
    empty: function (v, m) { return !(m.items || []).length; },
    views: [['grid', 'Side by side'], ['open', 'Still open']],
    edit: { root: [{ k: 'none', l: 'If none found: what was cross-read, and when', t: 'text' }], lists: [{ k: 'items', title: 'Disagreements', blank: function () { return { about: '', a: '', aSrc: '', b: '', bSrc: '', practice: '', status: 'open' }; },
      fields: [{ k: 'about', l: 'About (the step or part of the map)', t: 'text' }, { k: 'a', l: 'This source says', t: 'long' }, { k: 'aSrc', l: 'Source', t: 'text' }, { k: 'b', l: 'That source says', t: 'long' }, { k: 'bSrc', l: 'Source', t: 'text' }, { k: 'practice', l: 'What practice has quietly chosen', t: 'long' }, { k: 'status', l: 'Status', t: 'sel', o: function () { return [['open', 'Open'], ['settled', 'Settled by evidence'], ['kept', 'Kept: both accounts stand']]; } }] }] },
    registers: function (v, m) { return [{ name: 'disagreements', head: ['About', 'This source says', 'Source', 'That source says', 'Source', 'What practice has chosen', 'Status'], rows: (m.items || []).map(function (x) { return [x.about, x.a, x.aSrc, x.b, x.bSrc, x.practice, x.status]; }) }]; },
    draw: {
      grid: function (v, m, host) { (m.items || []).forEach(function (x) { host.appendChild(el('div', { class: 'dgrid', 'data-id': x.id }, [el('div', { class: 'dabout' }, [el('b', { text: x.about }), el('span', { class: 'st2', text: x.status === 'open' ? 'Open' : x.status === 'settled' ? 'Settled by evidence' : 'Both accounts kept' })]), el('div', { class: 'dside' }, [el('div', { class: 'flab', text: x.aSrc || 'One source' }), el('div', { text: x.a })]), el('div', { class: 'dside' }, [el('div', { class: 'flab', text: x.bSrc || 'Another source' }), el('div', { text: x.b })]), el('div', { class: 'dprac' }, [el('div', { class: 'flab', text: 'What practice has chosen' }), el('div', { text: x.practice || 'Not yet known' })])])); }); },
      open: function (v, m, host) { host.appendChild(table(['About', 'The two accounts', 'What practice has chosen'], (m.items || []).filter(function (x) { return x.status === 'open'; }).map(function (x) { return [x.about, x.a + '  /  ' + x.b, x.practice]; }))); }
    }
  });
  MODELS.push({
    id: 'evframe', hidden: 'frame', name: 'The frame, tested against the evidence', key: 'evframe',
    about: 'Frame declares; Diagnose checks. For each part of the frame that rests on evidence, what Frame declared and what the evidence shows. Where they differ, send a question back to the Problem tile.',
    subject: function (v, m) { return 'Six parts of the frame'; },
    empty: function () { return false; },
    views: [['cards', 'Declared against found']],
    edit: { root: [
      { k: 'purposeWorks', l: 'Purpose as it actually works (from what people do, not what is written)', t: 'long' },
      { k: 'demand', l: 'Demand the service exists to meet, against demand its own failures cause (counted, with source)', t: 'long' },
      { k: 'register', l: 'The organisation’s own register of important business services, tolerances, mapping and test results: what it holds', t: 'long' },
      { k: 'revealed', l: 'Thresholds revealed by what the organisation has tolerated (risk register entries and their age; when it last stopped something)', t: 'long' },
      { k: 'typeRevised', l: 'The type of challenge, revised now the evidence is in, and what changed since the first view', t: 'long' },
      { k: 'works', l: 'What already works unusually well, from front-line staff without their managers', t: 'long' }] },
    registers: function (v, m) { return [{ name: 'frame-tested', head: ['Part of the frame', 'Problem tile', 'What the evidence shows'], rows: FRAMEPARTS.map(function (f) { return [f[1], f[2], m[f[0]] || '']; }) }]; },
    draw: {
      cards: function (v, m, host) {
        FRAMEPARTS.forEach(function (f) {
          var r = X.row(f[2]), declared = r ? (r.summary || 'Started; no summary yet') : 'Not started in Frame';
          var qi = el('input', { type: 'text', placeholder: 'A question for the Problem tile', style: 'flex:1;min-width:220px' }), qm = el('span', { class: 'msg' });
          var send = el('div', { class: 'row no-print', style: 'flex:1' }, [qi, el('button', { class: 'btn sm', 'data-send': f[2], text: 'Send back to Frame', onclick: async function () { if (!qi.value.trim()) { qi.focus(); return; } try { await X.api({ action: 'p_question_add', tile_key: f[2], text: qi.value.trim(), from_practice: 'analyse' }); qi.value = ''; qm.className = 'msg good'; qm.textContent = 'Sent: it shows on the Problem tile as an open question.'; } catch (e) { qm.className = 'msg bad'; qm.textContent = e.message; } } }), qm]);
          host.appendChild(el('div', { class: 'fcard', 'data-id': f[0] }, [el('div', { class: 'flab', text: f[1] }), el('div', { class: 'fcols' }, [el('div', {}, [el('div', { class: 'muted sm', text: 'Declared in Frame' }), el('div', { text: declared }), el('a', { class: 'sm', href: '/frame#tile=' + f[2], text: 'Open the tile' })]), el('div', {}, [el('div', { class: 'muted sm', text: 'Found in Diagnose' }), el('div', { class: m[f[0]] ? '' : 'muted', text: m[f[0]] || 'Not yet gathered' })])]), el('div', { class: 'row', style: 'margin-top:8px' }, [send])]));
        });
      }
    }
  });
  var FRAMEPARTS = [['purposeWorks', 'Purpose: as stated, and as it actually works', 'purpose'], ['demand', 'Jobs it does: the demand behind them', 'jobs'], ['register', 'Important business services: the organisation’s own register', 'ibs'], ['revealed', 'The harm thresholds: declared, and revealed', 'threshold'], ['typeRevised', 'The type of challenge: the first view, and now', 'firstview'], ['works', 'How it works: what already works unusually well', 'how']];

  // =====================================================================
  // Analysis tools for risk, continuity and change. Each is a record with its own editor, views and export,
  // drawing on the service map (processes, resources, scenarios, the tolerance) where it can.
  // =====================================================================
  var SEV = [['0', 'None'], ['1', 'Slight'], ['2', 'Moderate'], ['3', 'Serious'], ['4', 'Severe'], ['5', 'Catastrophic']];
  var FIVE = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']];
  var pn = function (v, id) { var p = procs(v).filter(function (x) { return x.id === id; })[0]; return p ? p.n : (id || ''); };
  var rn = function (v, id) { var r = ress(v).filter(function (x) { return x.id === id; })[0]; return r ? r.n : id; };
  var hrs = function (t) { var m = /([\d.]+)\s*(hour|day|week|minute)/i.exec(String(t || '')); if (!m) return null; return Number(m[1]) * ({ minute: 1 / 60, hour: 1, day: 24, week: 168 }[m[2].toLowerCase()]); };
  var sevCell = function (s) { return el('span', { class: 'sev s' + (s || 0), text: (SEV[Number(s) || 0] || SEV[0])[1] }); };
  function rec(o) { o.hidden = o.hidden || o.id; o.key = o.key || o.id; MODELS.push(o); }

  rec({ id: 'bia', name: 'Business impact analysis', about: 'For each process: how the harm grows if it stops (after an hour, a day, a week), the longest disruption that could be tolerated, and the recovery targets. The targets are then set against how long the resources each process rests on actually take to come back.',
    subject: function (v, m) { return (m.items || []).length + ' processes assessed'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['grid', 'Harm over time'], ['targets', 'Targets against the resources'], ['table', 'The full analysis']],
    edit: { lists: [{ k: 'items', title: 'Processes assessed', blank: function () { return { proc: '', h1: '0', d1: '0', w1: '0', what: '', mtpd: '', rto: '', rpo: '', deps: [], src: '' }; },
      fields: [{ k: 'proc', l: 'Process', t: 'sel', o: procOpts }, { k: 'h1', l: 'Harm after an hour', t: 'sel', o: function () { return SEV; } }, { k: 'd1', l: 'Harm after a day', t: 'sel', o: function () { return SEV; } }, { k: 'w1', l: 'Harm after a week', t: 'sel', o: function () { return SEV; } }, { k: 'what', l: 'What the harm is, and to whom (people, money, the regulator, reputation)', t: 'long' }, { k: 'mtpd', l: 'Longest disruption that could be tolerated', t: 'text' }, { k: 'rto', l: 'Recovery time target', t: 'text' }, { k: 'rpo', l: 'How much information could be lost (recovery point)', t: 'text' }, { k: 'deps', l: 'Resources it rests on', t: 'multi', o: function (v) { return resOpts(v).slice(1); } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'business-impact', head: ['Process', 'After an hour', 'After a day', 'After a week', 'The harm', 'Longest tolerable', 'Recovery target', 'Recovery point', 'Rests on', 'Source'], rows: (m.items || []).map(function (x) { return [pn(v, x.proc), SEV[x.h1 || 0][1], SEV[x.d1 || 0][1], SEV[x.w1 || 0][1], x.what, x.mtpd, x.rto, x.rpo, (x.deps || []).map(function (d) { return rn(v, d); }).join('; '), x.src]; }) }]; },
    draw: {
      grid: function (v, m, host) { host.appendChild(table(['Process', 'After an hour', 'After a day', 'After a week', 'Longest tolerable'], (m.items || []).map(function (x) { return [pn(v, x.proc), sevCell(x.h1), sevCell(x.d1), sevCell(x.w1), x.mtpd]; }))); host.appendChild(note('Read across: how fast the harm grows. A process that is serious within the hour needs a different response from one that is serious only after a week.')); },
      targets: function (v, m, host) {
        host.appendChild(table(['Process', 'Recovery target', 'Resource it rests on', 'How long that resource takes to come back', 'Believable?'], [].concat.apply([], (m.items || []).map(function (x) { var t = hrs(x.rto); return (x.deps || []).map(function (d) { var r = ress(v).filter(function (y) { return y.id === d; })[0] || {}, rt = hrs(r.rto); var ok = t == null || rt == null ? 'Cannot tell' : rt <= t ? 'Yes' : 'No: the resource takes longer'; return { cls: /^No/.test(ok) ? 'sp' : '', cells: [pn(v, x.proc), x.rto || 'Not set', r.n || d, r.rto || 'Not known', ok] }; }); }))));
        host.appendChild(note('A recovery target shorter than the time its resources take to come back is a promise the service cannot keep. Recovery times for resources come from the inventory.'));
      },
      table: function (v, m, host) { host.appendChild(table(['Process', 'The harm', 'Recovery target', 'Recovery point', 'Source'], (m.items || []).map(function (x) { return [pn(v, x.proc), x.what, x.rto, x.rpo, x.src]; }))); }
    } });

  var rl = function (x, res) { return (Number(res ? x.rl : x.l) || 0) * (Number(res ? x.ri : x.i) || 0); };
  var band = function (n) { return n >= 15 ? 'High' : n >= 8 ? 'Medium' : n ? 'Low' : ''; };
  function heat(m, host, res) {
    var g = el('div', { class: 'heat' });
    g.appendChild(el('div', { class: 'hax', text: 'Likelihood' }));
    for (var L = 5; L >= 1; L--) for (var I = 1; I <= 5; I++) { var here = (m.items || []).filter(function (x) { return Number(res ? x.rl : x.l) === L && Number(res ? x.ri : x.i) === I; }); g.appendChild(el('div', { class: 'hc b' + band(L * I).toLowerCase(), title: 'Likelihood ' + L + ', impact ' + I }, here.map(function (x) { return el('span', { class: 'hdot', 'data-id': x.id, title: x.event, text: x.ref || x.id }); }))); }
    host.appendChild(g); host.appendChild(el('div', { class: 'hax2', text: 'Impact →' }));
    host.appendChild(el('ul', { class: 'tl' }, (m.items || []).map(function (x) { return el('li', { text: (x.ref || x.id) + ': ' + x.event }); })));
  }
  rec({ id: 'risk', name: 'Risk assessment', about: 'The risks to the service: cause, event and consequence, scored for likelihood and impact on a scale of 1 to 5, before and after the controls in place. Where the organisation already has a risk register, read it in here and note what it leaves out.',
    subject: function (v, m) { return (m.items || []).length + ' risks'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['register', 'The register'], ['before', 'Heat map before controls'], ['after', 'Heat map after controls']],
    edit: { root: [{ k: 'theirs', l: 'The organisation’s own register: what it holds and what it leaves out', t: 'long' }], lists: [{ k: 'items', title: 'Risks', blank: function () { return { ref: '', cause: '', event: '', cons: '', l: '3', i: '3', controls: '', rl: '2', ri: '3', owner: '', age: '', src: '' }; },
      fields: [{ k: 'ref', l: 'Reference', t: 'text' }, { k: 'cause', l: 'Cause', t: 'text' }, { k: 'event', l: 'Event', t: 'text' }, { k: 'cons', l: 'Consequence', t: 'text' }, { k: 'l', l: 'Likelihood before controls (1 to 5)', t: 'sel', o: function () { return FIVE; } }, { k: 'i', l: 'Impact before controls (1 to 5)', t: 'sel', o: function () { return FIVE; } }, { k: 'controls', l: 'Controls in place', t: 'long' }, { k: 'rl', l: 'Likelihood after controls', t: 'sel', o: function () { return FIVE; } }, { k: 'ri', l: 'Impact after controls', t: 'sel', o: function () { return FIVE; } }, { k: 'owner', l: 'Owner', t: 'text' }, { k: 'age', l: 'First raised (on their register)', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'risks', head: ['Reference', 'Cause', 'Event', 'Consequence', 'Likelihood', 'Impact', 'Rating', 'Controls', 'Likelihood after', 'Impact after', 'Rating after', 'Owner', 'First raised', 'Source'], rows: (m.items || []).map(function (x) { return [x.ref, x.cause, x.event, x.cons, x.l, x.i, rl(x) + ' (' + band(rl(x)) + ')', x.controls, x.rl, x.ri, rl(x, true) + ' (' + band(rl(x, true)) + ')', x.owner, x.age, x.src]; }) }]; },
    draw: {
      register: function (v, m, host) { host.appendChild(table(['Ref', 'Event', 'Before', 'Controls', 'After', 'Owner', 'First raised'], (m.items || []).map(function (x) { return { cls: band(rl(x, true)) === 'High' ? 'sp' : '', cells: [x.ref, x.event + (x.cause ? ' (cause: ' + x.cause + ')' : ''), rl(x) + ' ' + band(rl(x)), x.controls, rl(x, true) + ' ' + band(rl(x, true)), x.owner, x.age] }; }))); if (m.theirs) host.appendChild(note('Their register: ' + m.theirs)); },
      before: function (v, m, host) { heat(m, host, false); }, after: function (v, m, host) { heat(m, host, true); }
    } });

  rec({ id: 'scentest', name: 'Scenario testing', about: 'Severe but plausible scenarios run against the impact tolerance of the important business service: would the service stay within it, how long until it is breached, and what breaks first. The scenarios come from the map.',
    subject: function (v, m) { var n = (m.items || []).filter(function (x) { return x.within === 'no'; }).length; return n + ' of ' + (m.items || []).length + ' outside tolerance'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['grid', 'Against the tolerance'], ['breaks', 'What breaks first']],
    edit: { lists: [{ k: 'items', title: 'Scenarios tested', blank: function () { return { scen: '', within: 'unknown', until: '', breaks: '', how: 'desk', actions: '', src: '' }; },
      fields: [{ k: 'scen', l: 'Scenario (from the map)', t: 'sel', o: function (v) { return (v.scenarios || []).map(function (s2) { return [s2.id, s2.n]; }); } }, { k: 'within', l: 'Stays within the tolerance?', t: 'sel', o: function () { return [['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not known']]; } }, { k: 'until', l: 'How long until the tolerance is breached', t: 'text' }, { k: 'breaks', l: 'What breaks first', t: 'text' }, { k: 'how', l: 'How it was tested', t: 'sel', o: function () { return [['desk', 'Desk-top, on paper'], ['sim', 'Simulated (the agent-based model)'], ['exercise', 'An exercise'], ['real', 'A real event']]; } }, { k: 'actions', l: 'What would bring it within tolerance', t: 'long' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'scenario-tests', head: ['Scenario', 'Tolerance', 'Within it', 'Until breached', 'Breaks first', 'How tested', 'Actions'], rows: (m.items || []).map(function (x) { var s2 = (v.scenarios || []).filter(function (y) { return y.id === x.scen; })[0]; return [s2 ? s2.n : x.scen, (v.tolerance || {}).text || '', x.within, x.until, x.breaks, x.how, x.actions]; }) }]; },
    draw: {
      grid: function (v, m, host) { host.appendChild(note('Tolerance: ' + (((v.tolerance || {}).text) || 'not set in the inventory'))); host.appendChild(table(['Scenario', 'Within tolerance', 'Until breached', 'How tested'], (m.items || []).map(function (x) { var s2 = (v.scenarios || []).filter(function (y) { return y.id === x.scen; })[0]; return { cls: x.within === 'no' ? 'sp' : '', cells: [s2 ? s2.n : x.scen, x.within === 'yes' ? 'Yes' : x.within === 'no' ? 'No' : 'Not known', x.until, x.how === 'desk' ? 'On paper' : x.how === 'sim' ? 'Simulated' : x.how === 'exercise' ? 'Exercise' : 'Real event'] }; }))); },
      breaks: function (v, m, host) { (m.items || []).forEach(function (x) { var s2 = (v.scenarios || []).filter(function (y) { return y.id === x.scen; })[0]; host.appendChild(el('div', { class: 'jstep', 'data-id': x.id }, [el('b', { text: s2 ? s2.n : x.scen }), el('div', { text: 'Breaks first: ' + (x.breaks || 'not known') }), x.actions ? el('div', { class: 'sm', text: 'To bring it within tolerance: ' + x.actions }) : null])); }); }
    } });

  rec({ id: 'plans', name: 'Review of existing plans', about: 'The organisation’s own continuity, recovery and incident plans, read against the model. Are the recovery times believable given what the service rests on? Are the people named still in post? When was each plan last tested, and what happened? Writing new plans belongs to Change.',
    subject: function (v, m) { return (m.items || []).length + ' plans read'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['cards', 'Plans'], ['table', 'At a glance']],
    edit: { lists: [{ k: 'items', title: 'Plans', blank: function () { return { n: '', kind: 'bcp', owner: '', dated: '', tested: '', claim: '', believable: 'unknown', why: '', people: '', gaps: '', src: '' }; },
      fields: [{ k: 'n', l: 'Plan', t: 'text' }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return [['bcp', 'Business continuity plan'], ['dr', 'Disaster recovery plan (technology)'], ['incident', 'Incident or major incident plan'], ['other', 'Other']]; } }, { k: 'owner', l: 'Owner', t: 'text' }, { k: 'dated', l: 'Date of this version', t: 'text' }, { k: 'tested', l: 'Last tested (and how)', t: 'text' }, { k: 'claim', l: 'Recovery times it promises', t: 'text' }, { k: 'believable', l: 'Believable, given the model?', t: 'sel', o: function () { return [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No'], ['unknown', 'Not yet judged']]; } }, { k: 'why', l: 'Why', t: 'long' }, { k: 'people', l: 'People named: still in post, still reachable?', t: 'text' }, { k: 'gaps', l: 'What it leaves out', t: 'long' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'plans-reviewed', head: ['Plan', 'Kind', 'Owner', 'Version', 'Last tested', 'Promises', 'Believable', 'Why', 'People named', 'Leaves out'], rows: (m.items || []).map(function (x) { return [x.n, x.kind, x.owner, x.dated, x.tested, x.claim, x.believable, x.why, x.people, x.gaps]; }) }]; },
    draw: {
      cards: function (v, m, host) { (m.items || []).forEach(function (x) { host.appendChild(el('div', { class: 'jstep', 'data-id': x.id }, [el('b', { text: x.n }), el('div', { class: 'sm muted', text: [x.owner, x.dated ? 'version ' + x.dated : '', x.tested ? 'last tested: ' + x.tested : 'never tested'].filter(Boolean).join('  ·  ') }), x.claim ? el('div', { text: 'Promises: ' + x.claim + '. Believable: ' + ({ yes: 'yes', partly: 'partly', no: 'no', unknown: 'not yet judged' })[x.believable] + (x.why ? '. ' + x.why : '') }) : null, x.people ? el('div', { class: 'sm', text: 'People named: ' + x.people }) : null, x.gaps ? el('div', { class: 'jf', text: 'Leaves out: ' + x.gaps }) : null])); }); },
      table: function (v, m, host) { host.appendChild(table(['Plan', 'Last tested', 'Believable', 'Leaves out'], (m.items || []).map(function (x) { return { cls: x.believable === 'no' ? 'sp' : '', cells: [x.n, x.tested || 'Never', x.believable, x.gaps] }; }))); }
    } });

  var CATS = [['people', 'People'], ['process', 'Process and procedure'], ['tech', 'Technology and equipment'], ['env', 'Environment and place'], ['mgmt', 'Management and organisation'], ['ext', 'Outside the organisation']];
  rec({ id: 'rca', name: 'Root cause analysis', about: 'One incident taken apart: a fishbone of contributing causes under six headings, and a chain of "why?" from the incident to what lies beneath it. Each cause is tied to its source. Use alongside the AcciMap, which shows the levels; this shows the causes.',
    subject: function (v, m) { return m.incident || 'No incident chosen'; }, empty: function (v, m) { return !m.incident && !(m.causes || []).length; },
    views: [['fish', 'Fishbone'], ['whys', 'Asking why']],
    edit: { root: [{ k: 'incident', l: 'The incident', t: 'text' }, { k: 'when', l: 'When', t: 'text' }], lists: [{ k: 'causes', title: 'Contributing causes', blank: function () { return { cat: 'process', n: '', src: '' }; }, fields: [{ k: 'cat', l: 'Heading', t: 'sel', o: function () { return CATS; } }, { k: 'n', l: 'Cause', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }, { k: 'whys', title: 'Why? (in order, from the incident down)', blank: function () { return { n: '', src: '' }; }, fields: [{ k: 'n', l: 'Because', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'causes', head: ['Heading', 'Cause', 'Source'], rows: (m.causes || []).map(function (c) { return [lab(CATS, c.cat), c.n, c.src]; }) }, { name: 'whys', head: ['Step', 'Because', 'Source'], rows: (m.whys || []).map(function (w, i) { return [i + 1, w.n, w.src]; }) }]; },
    draw: {
      fish: function (v, m, host) { host.appendChild(el('div', { class: 'fishhead', text: (m.incident || 'The incident') + (m.when ? ' (' + m.when + ')' : '') })); var g = el('div', { class: 'fishgrid' }); CATS.forEach(function (c) { var cs = (m.causes || []).filter(function (x) { return x.cat === c[0]; }); g.appendChild(el('div', { class: 'fishcat' + (cs.length ? '' : ' none') }, [el('div', { class: 'flab', text: c[1] }), cs.length ? el('ul', { class: 'tl' }, cs.map(function (x) { return el('li', { 'data-id': x.id, text: x.n }); })) : el('div', { class: 'muted sm', text: 'None found' })])); }); host.appendChild(g); },
      whys: function (v, m, host) { host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: m.incident || 'The incident' })])); (m.whys || []).forEach(function (w, i) { host.appendChild(el('div', { class: 'whyrow', 'data-id': w.id }, [el('span', { class: 'rnd', text: 'Why? ' + (i + 1) }), el('span', { text: w.n })])); }); if ((m.whys || []).length < 3) host.appendChild(note('Fewer than three steps: the chain probably stops at the first answer that looks like a cause.')); }
    } });

  rec({ id: 'exlog', name: 'Exercise and test log', about: 'Every exercise, test and real use of a plan: what was tested, what failed, and what was done about it. A failure with no action taken is a finding. This is the evidence that a plan works, needed at depth 4 and 5.',
    subject: function (v, m) { return (m.items || []).length + ' entries'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['log', 'The log'], ['open', 'Failures with nothing done']],
    edit: { lists: [{ k: 'items', title: 'Exercises, tests and real events', blank: function () { return { d: '', kind: 'exercise', n: '', failed: '', done: '', closed: false, src: '' }; },
      fields: [{ k: 'd', l: 'Date (year-month-day)', t: 'text' }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return [['exercise', 'Exercise'], ['test', 'Technical test'], ['real', 'Real event']]; } }, { k: 'n', l: 'What was tested', t: 'text' }, { k: 'failed', l: 'What failed', t: 'long' }, { k: 'done', l: 'What was done about it', t: 'long' }, { k: 'closed', l: 'Done and checked', t: 'bool' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'exercise-log', head: ['Date', 'Kind', 'Tested', 'Failed', 'Done about it', 'Closed', 'Source'], rows: (m.items || []).map(function (x) { return [x.d, x.kind, x.n, x.failed, x.done, x.closed ? 'Yes' : 'No', x.src]; }) }]; },
    draw: {
      log: function (v, m, host) { host.appendChild(table(['Date', 'Kind', 'Tested', 'Failed', 'Done about it'], (m.items || []).slice().sort(function (a, b) { return String(a.d).localeCompare(String(b.d)); }).map(function (x) { return { cls: x.failed && !x.done ? 'sp' : '', cells: [fmtD(x.d), x.kind === 'real' ? 'Real event' : x.kind === 'test' ? 'Test' : 'Exercise', x.n, x.failed || 'Nothing', x.done || (x.failed ? 'Nothing recorded' : '')] }; }))); },
      open: function (v, m, host) { var o = (m.items || []).filter(function (x) { return x.failed && !x.closed; }); if (!o.length) host.appendChild(note('None.')); host.appendChild(el('ul', { class: 'tl' }, o.map(function (x) { return el('li', { text: fmtD(x.d) + ': ' + x.failed + (x.done ? ' (action: ' + x.done + ', not checked)' : ' (nothing done)') }); }))); }
    } });

  var SCORE = [['0', '0: Nothing in place'], ['1', '1: Intended, not done'], ['2', '2: Partly in place'], ['3', '3: In place'], ['4', '4: In place and tested']];
  rec({ id: 'selfassess', name: 'Self-assessment against a standard', about: 'The organisation scored against a chosen standard or set of rules, one requirement at a time, with the evidence for each score and the gap. A score without evidence is held at 1.',
    subject: function (v, m) { return m.standard || 'No standard chosen'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['table', 'Requirements'], ['profile', 'Profile']],
    edit: { root: [{ k: 'standard', l: 'The standard or rules', t: 'text' }], lists: [{ k: 'items', title: 'Requirements', blank: function () { return { ref: '', req: '', score: '0', ev: '', gap: '', src: '' }; }, fields: [{ k: 'ref', l: 'Clause', t: 'text' }, { k: 'req', l: 'Requirement', t: 'text' }, { k: 'score', l: 'Score', t: 'sel', o: function () { return SCORE; } }, { k: 'ev', l: 'Evidence for the score', t: 'long' }, { k: 'gap', l: 'The gap', t: 'long' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'self-assessment', head: ['Clause', 'Requirement', 'Score', 'Evidence', 'Gap'], rows: (m.items || []).map(function (x) { return [x.ref, x.req, x.score, x.ev, x.gap]; }) }]; },
    draw: {
      table: function (v, m, host) { host.appendChild(table(['Clause', 'Requirement', 'Score', 'Evidence', 'Gap'], (m.items || []).map(function (x) { var s2 = !x.ev && Number(x.score) > 1 ? '1 (held: no evidence)' : x.score; return [x.ref, x.req, s2, x.ev || 'None', x.gap]; }))); },
      profile: function (v, m, host) { (m.items || []).forEach(function (x) { var s2 = !x.ev && Number(x.score) > 1 ? 1 : Number(x.score) || 0; host.appendChild(el('div', { class: 'prow', 'data-id': x.id }, [el('span', { class: 'sm', text: (x.ref ? x.ref + ' ' : '') + x.req }), el('div', { class: 'pbar' }, [el('i', { style: 'width:' + (s2 * 25) + '%' })]), el('b', { text: String(s2) })])); }); }
    } });

  var PEST = [['pol', 'Political'], ['eco', 'Economic'], ['soc', 'Social'], ['tech', 'Technological'], ['legal', 'Legal and regulatory'], ['env', 'Environmental']];
  var WHEN = [['now', 'Already here'], ['near', 'Within two years'], ['far', 'Three to five years']];
  // What goes right (29 October 2026): the protective side of the formulation, captured first, before any failure analysis.
  // Work as it is really done: what goes right every day, how often, the everyday adjustments that make it go right, and the evidence.
  var GRF = [['daily', 'Every day'], ['weekly', 'Most weeks'], ['often', 'Often, under pressure'], ['rare', 'Now and then']];
  rec({ id: 'goright', name: 'What goes right', about: 'How it works, before how it fails. What goes right every day in this service, and why, looking at work as it is really done rather than as it is written down. Things go right far more often than they go wrong, because people adjust their work to the conditions they meet. Record what goes right, how often, the everyday adjustments that make it go right, and the evidence for each.',
    subject: function (v, m) { return (m.items || []).length + ' things that go right'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['list', 'What goes right'], ['how', 'The everyday adjustments']],
    edit: { lists: [{ k: 'items', title: 'What goes right', blank: function () { return { n: '', often: 'daily', adjust: '', why: '', src: '' }; }, fields: [{ k: 'n', l: 'What goes right', t: 'text' }, { k: 'often', l: 'How often', t: 'sel', o: function () { return GRF; } }, { k: 'adjust', l: 'The everyday adjustments that make it go right', t: 'long' }, { k: 'why', l: 'Why it goes right', t: 'long' }, { k: 'src', l: 'Evidence (source and date)', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'what-goes-right', head: ['What goes right', 'How often', 'Everyday adjustments', 'Why', 'Evidence'], rows: (m.items || []).map(function (x) { return [x.n, lab(GRF, x.often), x.adjust, x.why, x.src]; }) }]; },
    draw: {
      list: function (v, m, host) { host.appendChild(table(['What goes right', 'How often', 'Why', 'Evidence'], (m.items || []).map(function (x) { return { cls: x.src ? '' : 'sp', cells: [x.n, lab(GRF, x.often), x.why || '', x.src || 'No evidence yet'] }; }))); },
      how: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return x.adjust; }); if (!xs.length) host.appendChild(note('No everyday adjustments recorded yet.')); host.appendChild(el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { 'data-id': x.id, text: x.n + ': ' + x.adjust }); }))); }
    } });

  rec({ id: 'horizon', name: 'Horizon scan', about: 'Changes coming from outside, under six headings, each with when it is likely to arrive and what it would do to the service. Feeds intelligence (System 4) in the viable system model and the scenarios.',
    subject: function (v, m) { return (m.items || []).length + ' changes'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['cat', 'By heading'], ['when', 'By when']],
    edit: { lists: [{ k: 'items', title: 'Changes', blank: function () { return { cat: 'legal', n: '', when: 'near', effect: '', likely: 'possible', src: '' }; }, fields: [{ k: 'cat', l: 'Heading', t: 'sel', o: function () { return PEST; } }, { k: 'n', l: 'The change', t: 'text' }, { k: 'when', l: 'When', t: 'sel', o: function () { return WHEN; } }, { k: 'likely', l: 'How likely', t: 'sel', o: function () { return [['certain', 'Certain'], ['likely', 'Likely'], ['possible', 'Possible']]; } }, { k: 'effect', l: 'What it would do to the service', t: 'long' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'horizon', head: ['Heading', 'Change', 'When', 'Likelihood', 'Effect', 'Source'], rows: (m.items || []).map(function (x) { return [lab(PEST, x.cat), x.n, lab(WHEN, x.when), x.likely, x.effect, x.src]; }) }]; },
    draw: {
      cat: function (v, m, host) { PEST.forEach(function (c) { var xs = (m.items || []).filter(function (x) { return x.cat === c[0]; }); host.appendChild(el('div', { class: 'jstep' + (xs.length ? '' : ' none') }, [el('b', { text: c[1] }), xs.length ? el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { 'data-id': x.id, text: x.n + ' (' + lab(WHEN, x.when).toLowerCase() + '): ' + x.effect }); })) : el('div', { class: 'muted sm', text: 'Nothing found under this heading' })])); }); },
      when: function (v, m, host) { WHEN.forEach(function (w) { var xs = (m.items || []).filter(function (x) { return x.when === w[0]; }); host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: w[1] + ' (' + xs.length + ')' }), el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { text: x.n + ' (' + x.likely + ')' }); }))])); }); }
    } });

  rec({ id: 'forcefield', name: 'Force field', about: 'What drives change and what holds things as they are, each scored from 1 to 5, with where it came from. Moved here from the problem summary: it reads the evidence, rather than declaring the frame.',
    subject: function (v, m) { var d = (m.drive || []).reduce(function (a, x) { return a + (Number(x.s) || 0); }, 0), h = (m.hold || []).reduce(function (a, x) { return a + (Number(x.s) || 0); }, 0); return 'Driving ' + d + ', holding ' + h; }, empty: function (v, m) { return !(m.drive || []).length && !(m.hold || []).length; },
    views: [['bars', 'The forces']],
    edit: { lists: [{ k: 'drive', title: 'Driving change', blank: function () { return { n: '', s: '3', src: '' }; }, fields: [{ k: 'n', l: 'Force', t: 'text' }, { k: 's', l: 'Strength (1 to 5)', t: 'sel', o: function () { return FIVE; } }, { k: 'src', l: 'Source', t: 'text' }] }, { k: 'hold', title: 'Holding things as they are', blank: function () { return { n: '', s: '3', src: '' }; }, fields: [{ k: 'n', l: 'Force', t: 'text' }, { k: 's', l: 'Strength (1 to 5)', t: 'sel', o: function () { return FIVE; } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'forces', head: ['Direction', 'Force', 'Strength', 'Source'], rows: (m.drive || []).map(function (x) { return ['Driving', x.n, x.s, x.src]; }).concat((m.hold || []).map(function (x) { return ['Holding', x.n, x.s, x.src]; })) }]; },
    draw: {
      bars: function (v, m, host) { var col = function (t, xs, cls) { return el('div', { class: 'ffcol' }, [el('div', { class: 'flab', text: t })].concat(xs.map(function (x) { return el('div', { class: 'ffrow', 'data-id': x.id }, [el('span', { class: 'sm', text: x.n }), el('div', { class: 'fbar ' + cls, style: 'width:' + ((Number(x.s) || 0) * 20) + '%' })]); }))); }; host.appendChild(el('div', { class: 'ffgrid' }, [col('Driving change', m.drive || [], 'd'), col('Holding things as they are', m.hold || [], 'h')])); }
    } });

  // =====================================================================
  // How viability is lost and kept (book, "The twelve nots", version 11, 15 October 2026):
  // the twelve nots at four levels, with the social mechanisms that produce them; the twelve
  // technical mechanisms by the six capitals; and the PACE² outcomes the change should leave behind.
  // =====================================================================
  var NOTS = [
    ['imagined', 'Not imagined', 'Imagining', 's', 'What could happen here that nobody has pictured?', 'What could we achieve that nobody has pictured?'],
    ['searched', 'Not searched for', 'Searching', 's', 'Where have we not looked, including beyond the line we drew, and whom have we not asked?', 'Where might a better way already exist, inside or beyond our boundary, that we have not looked for?'],
    ['noticed', 'Not noticed', 'Noticing', 's', 'What is in front of us that we have stopped seeing?', 'What promising signal are we walking past?'],
    ['told', 'Not told', 'Telling', 's', 'What do people here know that has not reached the people who decide?', 'What ideas do people here have that have not reached the people who decide?'],
    ['integrated', 'Not integrated', 'Integrating', 's', 'Where does what we know, or the work itself, fall apart as it crosses a boundary?', 'What could we achieve by bringing together what different parts of us know and do?'],
    ['understood', 'Not understood', 'Understanding', 's', 'What are we explaining away?', 'What are we dismissing as a one-off that might be a pattern?'],
    ['owned', 'Not owned', 'Owning', 'z', 'Who answers for the whole of this, who is actually doing it, and can they act?', 'Who answers for taking this opportunity forward, and who is actually doing it?'],
    ['willing', 'Not willing', 'Prioritising', 'z', 'What do we know matters but do not really want to deal with?', 'What opportunity do we see but are not really prepared to pursue?'],
    ['able', 'Not able', 'Enabling', 'z', 'What would we be unable to do, even if we decided to act?', 'What opportunity could we not take up, even if we wanted to?'],
    ['acted', 'Not acted on', 'Acting', 'z', 'Where are we acting too late, too weakly, in the wrong way, or for too long?', 'Where are we pursuing an opportunity too slowly, too half-heartedly, or for too long?'],
    ['corrected', 'Not corrected', 'Correcting', 't', 'Where practice and the standard differ, which one is right, and have we corrected the other?', 'Where someone has found a better way, has the standard caught up?'],
    ['renewed', 'Not renewed', 'Renewing', 't', 'Which of our assumptions about what we are for, and how we do it, are no longer true?', 'What would we do differently if we were starting again today?']];
  var NGROUP = { s: 'Sensing and anticipating', z: 'Seizing and absorbing', t: 'Transforming and adapting' };
  var NLV = [['institutional', 'Institutional'], ['organisational', 'Organisational'], ['interpersonal', 'Interpersonal'], ['intrapersonal', 'Intrapersonal']];
  var SMECH = 'Accountability on paper|Accountability sink|Accountability without authority|Adversary deception|Ambiguous evidence read reassuringly|Authority without knowledge|Boundary drawn too narrow|Brittle routine|Capture|Captured scrutiny|Complacency|Compliance on paper|Consequence delay|Decisions at the wrong level|Defensiveness|Deliberate concealment|Diffusion of responsibility|Erosion of trust|Escalation between parties|Escalation of commitment|Everything a priority|Fragmented meaning|Hubris|Information overload|Isomorphism|Leaders licensing drift|Local fix that never travels|Lock-in and path dependency|Manufactured agreement|Misaligned incentives and production pressure|Moral crumple zone|Myopia|Narrowed attention|Normalised deviance|Opacity|Organisational silence|Organised ignorance|Orphan zones|Outside-of-experience discounted|Over-control and alarm fatigue|Policy resistance|Practical drift|Presumed certainty|Reassurance that prevents vigilance|Relational withdrawal|Reliance on external rescue|Reorganisation cycling|Ritual monitoring|Short-termism|Silos and paper handovers|Simplified interpretation|Single-loop fixes|Squeezed capacity|Stalled growth|Structural secrecy|Success to the successful|Symbolic planning|Target over purpose|Untested consensus|Withdrawn reciprocity'.split('|');
  var nname = function (k) { var x = NOTS.filter(function (y) { return y[0] === k; })[0]; return x ? x[1] : k; };
  var DEC = [['', 'Not asked'], ['right', 'Where the knowledge and consequences are'], ['central', 'Too central: pulled up from where the knowledge is'], ['local', 'Too local: left where the consequences are not seen'], ['unknown', 'Not known']];
  rec({ id: 'nots', name: 'The twelve nots', about: 'How viability is lost, read through how people behave. Each finding is one of the twelve nots, at one of four levels, with the mechanisms that produced it and the evidence. Read backwards, each not is a form of failure; read forwards, each is a capability the organisation needs. Every not is asked two ways, for what could go wrong and for what could go better. For every finding, ask where the decision sat, and whether that was where the knowledge and the consequences were.',
    subject: function (v, m) { var n = (m.items || []).length; return n + (n === 1 ? ' finding' : ' findings'); }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['matrix', 'The matrix: twelve nots by four levels'], ['questions', 'The sharp questions'], ['mechs', 'Mechanisms found'], ['list', 'Findings']],
    edit: { lists: [{ k: 'items', title: 'Findings', blank: function () { return { not: 'owned', lvl: 'organisational', side: 'exposure', n: '', mechs: [], decided: '', src: '' }; },
      fields: [{ k: 'not', l: 'Which not', t: 'sel', o: function () { return NOTS.map(function (x) { return [x[0], x[1] + ' (' + x[2].toLowerCase() + ')']; }); } }, { k: 'lvl', l: 'Level', t: 'sel', o: function () { return NLV; } }, { k: 'side', l: 'Side', t: 'sel', o: function () { return [['exposure', 'What could go wrong'], ['value', 'What could go better']]; } }, { k: 'n', l: 'What was found', t: 'long' }, { k: 'mechs', l: 'Mechanisms that produced it', t: 'multi', o: function () { return SMECH.map(function (x) { return [x, x]; }); } }, { k: 'decided', l: 'Where the decision sat', t: 'sel', o: function () { return DEC; } }, { k: 'src', l: 'Evidence', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'twelve-nots', head: ['Not', 'Group', 'Level', 'Side', 'What was found', 'Mechanisms', 'Where the decision sat', 'Evidence'], rows: (m.items || []).map(function (x) { var d = NOTS.filter(function (y) { return y[0] === x.not; })[0] || []; return [nname(x.not), NGROUP[d[3]] || '', lab(NLV, x.lvl), x.side === 'value' ? 'What could go better' : 'What could go wrong', x.n, (x.mechs || []).join('; '), lab(DEC, x.decided), x.src]; }) }]; },
    draw: {
      matrix: function (v, m, host) {
        var t = el('table', { class: 'itab nmat' }), hr = el('tr', {}, [el('th', { text: 'The not' })].concat(NLV.map(function (l) { return el('th', { text: l[1] }); })));
        t.appendChild(hr);
        var g0 = null;
        NOTS.forEach(function (x, i) {
          if (x[3] !== g0) { g0 = x[3]; t.appendChild(el('tr', { class: 'ngrp' }, [el('td', { colspan: '5', text: NGROUP[g0] })])); }
          t.appendChild(el('tr', {}, [el('td', { class: 'nnm', text: (i + 1) + '. ' + x[1] })].concat(NLV.map(function (l) {
            var fs = (m.items || []).filter(function (y) { return y.not === x[0] && y.lvl === l[0]; });
            return el('td', { class: 'ncell' + (fs.length ? ' hit' + (fs.some(function (y) { return y.side !== 'value'; }) ? '' : ' val') : ''), 'data-id': fs[0] ? fs[0].id : null, title: fs.map(function (y) { return y.n; }).join('\n') }, fs.map(function (y) { return el('div', { class: 'sm', text: y.n }); }));
          }))));
        });
        host.appendChild(el('div', { class: 'nwrap' }, [t]));
        var empty = NOTS.filter(function (x) { return !(m.items || []).some(function (y) { return y.not === x[0]; }); }).map(function (x) { return x[1].toLowerCase(); });
        host.appendChild(note('Shaded: a finding of what could go wrong. Light: only a finding of what could go better. ' + (empty.length ? 'Not yet found: ' + empty.join(', ') + '. An empty row is either a strength, with evidence, or a place not yet looked.' : 'Every not has at least one finding.') + ' When a not is found, look upstream: check the capabilities before it for too little or too much.'));
      },
      questions: function (v, m, host) { var g0 = null; NOTS.forEach(function (x, i) { if (x[3] !== g0) { g0 = x[3]; host.appendChild(el('h4', { style: 'margin:14px 0 6px', text: NGROUP[g0] })); } var n = (m.items || []).filter(function (y) { return y.not === x[0]; }).length; host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: (i + 1) + '. ' + x[1] + ' / ' + x[2] + (n ? '  (' + n + ' found)' : '') }), el('div', { class: 'sm', text: 'What could go wrong: ' + x[4] }), el('div', { class: 'sm', text: 'What could go better: ' + x[5] })])); }); },
      mechs: function (v, m, host) { var c = {}; (m.items || []).forEach(function (x) { (x.mechs || []).forEach(function (k) { (c[k] = c[k] || []).push(nname(x.not) + ' (' + lab(NLV, x.lvl).toLowerCase() + ')'); }); }); var ks = Object.keys(c).sort(function (a, b) { return c[b].length - c[a].length; }); host.appendChild(table(['Mechanism', 'How often', 'Where it appears'], ks.map(function (k) { return [k, String(c[k].length), c[k].join('; ')]; }))); host.appendChild(note('A mechanism that appears under several nots is a likely place to intervene. Every mechanism fails by too little or too much; check which before choosing what to change.')); var dw = (m.items || []).filter(function (x) { return x.decided === 'central' || x.decided === 'local'; }); if (dw.length) host.appendChild(note('Decisions at the wrong level: ' + dw.length + ' of ' + (m.items || []).length + ' findings (' + dw.filter(function (x) { return x.decided === 'central'; }).length + ' too central, ' + dw.filter(function (x) { return x.decided === 'local'; }).length + ' too local).')); },
      list: function (v, m, host) { host.appendChild(table(['Not', 'Level', 'What was found', 'Mechanisms', 'Evidence'], (m.items || []).map(function (x) { return [nname(x.not), lab(NLV, x.lvl), x.n, (x.mechs || []).join('; '), x.src]; }))); }
    } });

  var TMECH = [['buffer', 'Buffer', 'st', 'Slack, reserves and headroom, measured against the flow through them', 'Everything at full stretch, so nothing is left to absorb a shock', 'Idle resources, and buffers that hide problems until they are large'],
    ['redundancy', 'Redundancy', 'st', 'A spare copy of the same thing: more than one route or component', 'A single route or component, so one failure stops everything', 'Duplication that adds complexity, with each layer assuming another will catch it'],
    ['flexibility', 'Flexibility', 'st', 'One thing with many uses', 'Single-purpose assets, people and money', 'Generalists and general-purpose assets that do nothing well'],
    ['variety', 'Variety', 'st', 'Different methods, sources and perspectives', 'Everyone and everything alike', 'Fragmentation, with nothing standard or shared'],
    ['options', 'Options', 'st', 'Something else, outside what you hold, to switch to', 'Nothing to switch to, locked in', 'Options kept open and never committed to'],
    ['connectivity', 'Connectivity', 'fl', 'Which links exist between the parts, and whether any part is cut off', 'Isolated parts and long paths', 'A dense web where failures and noise reach every part'],
    ['centrality', 'Centrality', 'fl', 'How much runs through particular nodes: hubs, bottlenecks, spreaders', 'Nothing central enough to coordinate or relay', 'A few nodes carry the network, and losing one cuts it apart'],
    ['coupling', 'Coupling', 'fl', 'How fast and how strongly effects travel along the links', 'Parts so loosely joined that nothing can be mobilised together', 'Effects spread faster than anyone can respond'],
    ['modularity', 'Modularity', 'fl', 'Whether a part can be cut off when something travels towards it', 'Everything tangled together', 'Silos, and interfaces nobody owns'],
    ['balancing', 'Balancing feedback', 'fb', 'Loops that sense a gap from the goal and correct it', 'Open loop or weak correction, so the system runs blind', 'Over-control and alarm fatigue'],
    ['reinforcing', 'Reinforcing feedback', 'fb', 'Loops where change feeds on itself, for better or worse', 'Nothing builds momentum', 'Runaway vicious circles'],
    ['delay', 'Delay', 'fb', 'The time between a change, its detection and the response', 'A hair trigger that reacts to noise', 'The signal arrives after it can be acted on']];
  var TFAM = { st: 'Stocks: what the system holds', fl: 'Flows: how things move between the parts', fb: 'Feedback: how the flows are regulated' };
  var TCAP = [['human', 'Human'], ['financial', 'Financial'], ['manufactured', 'Manufactured'], ['information', 'Information'], ['relationships', 'Relationships'], ['natural', 'Natural']];
  var TST = [['deficit', 'Too little'], ['fit', 'About right'], ['excess', 'Too much'], ['unknown', 'Not known']];
  var tname = function (k) { var x = TMECH.filter(function (y) { return y[0] === k; })[0]; return x ? x[1] : k; };
  rec({ id: 'techmech', name: 'Technical mechanisms', about: 'How viability is lost, read through how the resources are held, connected and regulated: twelve mechanisms (stocks, flows and feedback) across the six capitals. Every mechanism fails by too little and by too much; the right amount depends on what the work must achieve and how stable the conditions are. Each finding records which, for which capital, and the evidence.',
    subject: function (v, m) { var d = (m.items || []).filter(function (x) { return x.state === 'deficit'; }).length, e = (m.items || []).filter(function (x) { return x.state === 'excess'; }).length; return d + ' too little, ' + e + ' too much'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['matrix', 'The matrix: mechanisms by capitals'], ['balance', 'Too little and too much'], ['list', 'Findings']],
    edit: { lists: [{ k: 'items', title: 'Findings', blank: function () { return { mech: 'redundancy', cap: 'human', state: 'deficit', n: '', res: [], src: '' }; },
      fields: [{ k: 'mech', l: 'Mechanism', t: 'sel', o: function () { return TMECH.map(function (x) { return [x[0], x[1]]; }); } }, { k: 'cap', l: 'Capital', t: 'sel', o: function () { return TCAP; } }, { k: 'state', l: 'Balance', t: 'sel', o: function () { return TST; } }, { k: 'n', l: 'What was found', t: 'long' }, { k: 'res', l: 'Resources in the map it concerns', t: 'multi', o: function (v) { return resOpts(v).slice(1); } }, { k: 'src', l: 'Evidence', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'technical-mechanisms', head: ['Mechanism', 'Family', 'Capital', 'Balance', 'What was found', 'Resources', 'Evidence'], rows: (m.items || []).map(function (x) { var d = TMECH.filter(function (y) { return y[0] === x.mech; })[0] || []; return [tname(x.mech), TFAM[d[2]] || '', lab(TCAP, x.cap), lab(TST, x.state), x.n, (x.res || []).map(function (id) { return rn(v, id); }).join('; '), x.src]; }) }]; },
    draw: {
      matrix: function (v, m, host) {
        var t = el('table', { class: 'itab nmat' }); t.appendChild(el('tr', {}, [el('th', { text: 'Mechanism' })].concat(TCAP.map(function (c) { return el('th', { text: c[1] }); }))));
        var f0 = null;
        TMECH.forEach(function (x) {
          if (x[2] !== f0) { f0 = x[2]; t.appendChild(el('tr', { class: 'ngrp' }, [el('td', { colspan: '7', text: TFAM[f0] })])); }
          t.appendChild(el('tr', {}, [el('td', { class: 'nnm', title: x[3], text: x[1] })].concat(TCAP.map(function (c) { var fs = (m.items || []).filter(function (y) { return y.mech === x[0] && y.cap === c[0]; }), st = fs.length ? fs[0].state : ''; return el('td', { class: 'tcell ' + st, 'data-id': fs[0] ? fs[0].id : null, title: fs.map(function (y) { return lab(TST, y.state) + ': ' + y.n; }).join('\n'), text: st ? lab(TST, st) : '' }); }))));
        });
        host.appendChild(el('div', { class: 'nwrap' }, [t]));
        host.appendChild(note('Each cell is one mechanism for one capital: too little, about right or too much. Hover a cell for the finding. Excess in one place often shows up as a failure somewhere else.'));
      },
      balance: function (v, m, host) { [['deficit', 4], ['excess', 5]].forEach(function (s2) { var fs = (m.items || []).filter(function (x) { return x.state === s2[0]; }); host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: lab(TST, s2[0]) + ' (' + fs.length + ')' }), fs.length ? el('ul', { class: 'tl' }, fs.map(function (x) { var d = TMECH.filter(function (y) { return y[0] === x.mech; })[0]; return el('li', { 'data-id': x.id, text: tname(x.mech) + ', ' + lab(TCAP, x.cap).toLowerCase() + ': ' + x.n + (d ? ' (in general: ' + d[s2[1]].charAt(0).toLowerCase() + d[s2[1]].slice(1) + ')' : '') }); })) : el('div', { class: 'muted sm', text: 'None recorded' })])); }); },
      list: function (v, m, host) { host.appendChild(table(['Mechanism', 'Capital', 'Balance', 'What was found', 'Evidence'], (m.items || []).map(function (x) { return [tname(x.mech), lab(TCAP, x.cap), lab(TST, x.state), x.n, x.src]; }))); }
    } });

  var PACE = [['purpose', 'Purpose', 'A well-defined and shared understanding of why change is necessary and how it aligns with strategic goals', ['Clarifying purpose', 'Forming strategy and direction', 'Establishing value and differentiation', 'Ensuring strategic coherence']],
    ['awareness', 'Awareness', 'A deep understanding of internal and external factors, so that challenges and opportunities can be anticipated', ['Scanning external trends and benchmarking', 'Understanding stakeholder needs', 'Enhancing internal communication', 'Assessing risk and situational awareness']],
    ['coordination', 'Coordination', 'Aligned teams, structures and processes that ensure smooth execution and working across functions', ['Aligning work and outputs', 'Clarifying roles, responsibility and accountability', 'Making effective decisions', 'Solving problems']],
    ['engagement', 'Engagement', 'Trust, commitment and shared ownership, so that people are motivated to contribute to lasting change', ['Developing individual and team capabilities', 'Creating growth opportunities', 'Motivating and recognising contributions', 'Fostering psychological safety and inclusion']]];
  var PLV = [['', 'Not assessed'], ['0', '0: not produced'], ['1', '1: produced a little'], ['2', '2: partly produced'], ['3', '3: produced']];
  var ptasks = function () { var out = []; PACE.forEach(function (o) { o[3].forEach(function (t, i) { out.push({ id: o[0] + (i + 1), o: o, n: t }); }); }); return out; };
  rec({ id: 'pace', name: 'Purpose, Awareness, Coordination and Engagement', about: 'What the work and the change should leave behind in the organisation: purpose, awareness, coordination and engagement, each produced through four core tasks. Like direction, alignment and commitment in leadership (Drath and colleagues, 2008), each is a state the collective has reached or not, in degrees, whoever produced it. Score each task now and as expected after the change, with the evidence. A change that leaves none of them behind will not last.',
    subject: function (v, m) { var t = (m.tasks || []).filter(function (x) { return x.now !== '' && x.now != null; }).length; return t + ' of 16 tasks assessed'; }, empty: function (v, m) { return !(m.tasks || []).some(function (x) { return x.now !== '' && x.now != null; }); },
    views: [['profile', 'Profile: now and after the change'], ['table', 'The sixteen tasks']],
    edit: { lists: [{ k: 'tasks', title: 'The sixteen core tasks', blank: function () { return { task: 'purpose1', now: '', after: '', ev: '' }; }, fields: [{ k: 'task', l: 'Task', t: 'sel', o: function () { return ptasks().map(function (t) { return [t.id, t.o[1] + ': ' + t.n]; }); } }, { k: 'now', l: 'Now', t: 'sel', o: function () { return PLV; } }, { k: 'after', l: 'Expected after the change', t: 'sel', o: function () { return PLV; } }, { k: 'ev', l: 'Evidence', t: 'long' }] }] },
    registers: function (v, m) { return [{ name: 'pace-outcomes', head: ['Outcome', 'Task', 'Now', 'After the change', 'Evidence'], rows: ptasks().map(function (t) { var x = (m.tasks || []).filter(function (y) { return y.task === t.id; })[0] || {}; return [t.o[1], t.n, x.now || '', x.after || '', x.ev || '']; }) }]; },
    draw: {
      profile: function (v, m, host) {
        PACE.forEach(function (o) {
          var box = el('div', { class: 'jstep' }, [el('b', { text: o[1] }), el('div', { class: 'sm muted', text: o[2] })]);
          o[3].forEach(function (n, i) { var x = (m.tasks || []).filter(function (y) { return y.task === o[0] + (i + 1); })[0] || {}, a = Number(x.now), b = Number(x.after);
            box.appendChild(el('div', { class: 'prow pace', 'data-id': x.id || null }, [el('span', { class: 'sm', text: n }), el('div', { class: 'pbar2' }, [el('i', { class: 'now', style: 'width:' + (x.now ? a * 33.3 : 0) + '%' }), el('i', { class: 'aft', style: 'width:' + (x.after ? b * 33.3 : 0) + '%' })]), el('b', { class: 'sm', text: (x.now !== undefined && x.now !== '' ? x.now : '?') + ' → ' + (x.after !== undefined && x.after !== '' ? x.after : '?') })])); });
          host.appendChild(box);
        });
        host.appendChild(note('Dark bar: now. Light bar: expected after the change. 0 means not produced, 3 means produced. A task the change does not move is a reason to ask whether the change will last.'));
      },
      table: function (v, m, host) { host.appendChild(table(['Outcome', 'Task', 'Now', 'After', 'Evidence'], ptasks().map(function (t) { var x = (m.tasks || []).filter(function (y) { return y.task === t.id; })[0] || {}; return { cls: x.now === '' || x.now == null ? 'none' : '', cells: [t.o[1], t.n, x.now || '', x.after || '', x.ev || ''] }; }))); }
    } });

  // =====================================================================
  // Added 31 October 2026, after the review of the book and the parked Lab.
  // =====================================================================
  var YNU = [['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not known']];
  var procOpts = function (v) { return [['', 'Choose']].concat((v.processes || []).map(function (p) { return [p.id, p.n]; })).concat([['other', 'Something else (say in the name)']]); };
  var procName = function (v, id) { var p = (v.processes || []).filter(function (x) { return x.id === id; })[0]; return p ? p.n : ''; };
  var num = function (x) { var n = Number(String(x == null ? '' : x).replace(/[^0-9.\-]/g, '')); return x === '' || x == null || isNaN(n) ? null : n; };
  var govLines = function () { return X.lineGoverning ? X.lineGoverning() : []; };
  var lineBox = function (host) { var g = govLines(); host.appendChild(el('div', { class: 'jstep' }, [el('b', { text: 'The thresholds from Frame' }), g.length ? el('ul', { class: 'tl' }, g.map(function (x) { return el('li', { text: x.name + ': ' + x.text }); })) : el('div', { class: 'muted sm', text: (X.lineText && X.lineText()) || 'No threshold set in Frame yet. Set the thresholds in Frame, under 1.3 Thresholds.' })])); };

  // ---------- Test: can the organisation run as a minimum viable company? ----------
  // From the old Lab's Moves 33 to 37 (shutdown, minimum service, minimum viable company, endurance, return),
  // folded into one test: if everything stops, what is the least that keeps the people it serves inside the line,
  // for how long, and does each part come back before the line is crossed?
  function mvcDays(m) {
    var ds = (m.stocks || []).map(function (s) { var lo = num(s.have), hi = num(s.haveHi), use = num(s.use); if (lo == null || !use) return null; return { n: s.n, lo: lo / use, hi: (hi == null ? lo : hi) / use }; }).filter(Boolean);
    if (!ds.length) return null;
    var lo = Math.min.apply(null, ds.map(function (d) { return d.lo; })), hi = Math.min.apply(null, ds.map(function (d) { return d.hi; }));
    var first = ds.filter(function (d) { return d.lo === lo; })[0];
    return { lo: lo, hi: Math.max(lo, hi), first: first ? first.n : '' };
  }
  var dRound = function (x) { return x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10); };
  function mvcVerdict(v, m) {
    var outs = m.outcomes || [], keeps = m.keep || [];
    var uncovered = outs.filter(function (o) { return !keeps.some(function (k) { return (k.serves || []).indexOf(o.id) >= 0; }); });
    var D = mvcDays(m), race = (m.ret || []).map(function (r) { var t = num(r.takes); if (t == null || !D) return 'depends'; var tDays = r.unit === 'hours' ? t / 24 : t; return tDays <= D.lo ? 'won' : tDays > D.hi ? 'lost' : 'depends'; });
    var lost = race.filter(function (x) { return x === 'lost'; }).length, dep = race.filter(function (x) { return x === 'depends'; }).length;
    var verdict = !outs.length ? 'unknown' : uncovered.length || lost ? 'no' : !D || dep ? 'unknown' : 'yes';
    return { uncovered: uncovered, D: D, race: race, lost: lost, dep: dep, verdict: verdict };
  }
  rec({ id: 'mvc', name: 'The minimum viable company', about: 'Can the organisation be run as a minimum viable company? If everything stops, what is the least that must keep going so that the people it serves stay within the threshold set in Frame, how long it can last on what it holds, and whether each part comes back before the threshold is crossed. Doing nothing is the starting point: the test is run as things stand, then again with each change.',
    subject: function (v, m) { var V = mvcVerdict(v, m); return V.verdict === 'yes' ? 'Yes: it can run as a minimum viable company for ' + dRound(V.D.lo) + (V.D.hi > V.D.lo ? ' to ' + dRound(V.D.hi) : '') + ' days' : V.verdict === 'no' ? 'Not as it stands' : 'Not yet known'; },
    empty: function (v, m) { return !(m.outcomes || []).length && !(m.shutdown || []).length; },
    views: [['answer', 'The answer'], ['company', 'The least company'], ['clock', 'How long it lasts'], ['ret', 'The return']],
    edit: { root: [{ k: 'asis', l: 'Run as things stand, or with a change?', t: 'text' }], lists: [
      { k: 'shutdown', title: '1 What “everything stopped” looks like (versions)', blank: function () { return { n: '', what: '', src: '' }; }, fields: [{ k: 'n', l: 'Version', t: 'text' }, { k: 'what', l: 'What stops, and for how long', t: 'long' }, { k: 'src', l: 'Source', t: 'text' }] },
      { k: 'outcomes', title: '2 The minimum service, worded as outcomes for the people it serves', blank: function () { return { n: '', cap: 'human' }; }, fields: [{ k: 'n', l: 'The outcome that must still happen', t: 'text' }, { k: 'cap', l: 'The capital whose threshold it keeps', t: 'sel', o: function () { return [['human', 'People'], ['financial', 'Money'], ['manufactured', 'Buildings and kit'], ['social', 'Relationships and trust'], ['natural', 'Land, water, energy'], ['information', 'Information']]; } }] },
      { k: 'keep', title: '3 The least company: what must keep going to deliver them', blank: function () { return { n: '', proc: '', how: '', serves: [] }; }, fields: [{ k: 'n', l: 'What is kept (people, process or resource)', t: 'text' }, { k: 'proc', l: 'From the map', t: 'sel', o: procOpts }, { k: 'how', l: 'How it runs at the minimum', t: 'long' }, { k: 'serves', l: 'The outcomes it delivers', t: 'multi', o: function (v) { return ((v.mvc || {}).outcomes || []).map(function (o) { return [o.id, o.n || o.id]; }); } }] },
      { k: 'stocks', title: '4 What it lives on: stocks, and how fast they run down', blank: function () { return { n: '', have: '', haveHi: '', use: '', unit: '', src: '' }; }, fields: [{ k: 'n', l: 'Stock or supply', t: 'text' }, { k: 'have', l: 'How much is held (low)', t: 'text' }, { k: 'haveHi', l: 'How much is held (high)', t: 'text' }, { k: 'use', l: 'Used each day', t: 'text' }, { k: 'unit', l: 'Unit', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] },
      { k: 'ret', title: '5 The return: what comes back, in order', blank: function () { return { n: '', takes: '', unit: 'days', needs: '' }; }, fields: [{ k: 'n', l: 'What comes back', t: 'text' }, { k: 'takes', l: 'Time to bring it back', t: 'text' }, { k: 'unit', l: 'In', t: 'sel', o: function () { return [['hours', 'Hours'], ['days', 'Days']]; } }, { k: 'needs', l: 'What it needs first', t: 'text' }] }] },
    registers: function (v, m) { var V = mvcVerdict(v, m); return [{ name: 'minimum-service', head: ['Outcome', 'Capital', 'Delivered by'], rows: (m.outcomes || []).map(function (o) { return [o.n, o.cap, (m.keep || []).filter(function (k) { return (k.serves || []).indexOf(o.id) >= 0; }).map(function (k) { return k.n; }).join('; ')]; }) }, { name: 'endurance', head: ['Stock', 'Held (low)', 'Held (high)', 'Used each day', 'Unit', 'Days (low)', 'Days (high)'], rows: (m.stocks || []).map(function (s) { var u = num(s.use); return [s.n, s.have, s.haveHi, s.use, s.unit, u && num(s.have) != null ? dRound(num(s.have) / u) : '', u && num(s.haveHi) != null ? dRound(num(s.haveHi) / u) : '']; }) }, { name: 'return', head: ['Order', 'What comes back', 'Takes', 'Race against the threshold'], rows: (m.ret || []).map(function (r, i) { return [i + 1, r.n, r.takes + ' ' + (r.unit || ''), V.race[i]]; }) }]; },
    draw: {
      answer: function (v, m, host) {
        var V = mvcVerdict(v, m);
        lineBox(host);
        host.appendChild(el('div', { class: 'jstep mvcanswer ' + V.verdict, 'data-verdict': V.verdict }, [el('b', { text: 'Can it run as a minimum viable company? ' + (V.verdict === 'yes' ? 'Yes.' : V.verdict === 'no' ? 'Not as it stands.' : 'Not yet known.') }),
          el('ul', { class: 'tl' }, [
            el('li', { text: (m.outcomes || []).length + ' outcomes in the minimum service; ' + (V.uncovered.length ? V.uncovered.length + ' with nothing kept to deliver them: ' + V.uncovered.map(function (o) { return o.n; }).join('; ') : 'each has something kept to deliver it') + '.' }),
            el('li', { text: V.D ? 'It lasts ' + dRound(V.D.lo) + (V.D.hi > V.D.lo ? ' to ' + dRound(V.D.hi) : '') + ' days on what it holds; ' + V.D.first + ' runs out first.' : 'How long it lasts is not known: add the stocks and how fast they run down.' }),
            el('li', { text: (m.ret || []).length ? (m.ret.length - V.lost - V.dep) + ' of ' + m.ret.length + ' parts come back before the stocks run out; ' + V.lost + ' lose the race; ' + V.dep + ' depend on which end of the range holds.' : 'The order of return is not written yet.' })])]));
        if (m.asis) host.appendChild(note('Run: ' + m.asis));
      },
      company: function (v, m, host) { (m.outcomes || []).forEach(function (o) { var ks = (m.keep || []).filter(function (k) { return (k.serves || []).indexOf(o.id) >= 0; }); host.appendChild(el('div', { class: 'jstep' + (ks.length ? '' : ' none'), 'data-id': o.id }, [el('b', { text: o.n }), ks.length ? el('ul', { class: 'tl' }, ks.map(function (k) { return el('li', { text: k.n + (k.proc && procName(v, k.proc) ? ' (' + procName(v, k.proc) + ')' : '') + (k.how ? ': ' + k.how : '') }); })) : el('div', { class: 'jf', text: 'Nothing kept delivers this: the threshold would be crossed.' })])); }); var spare = (m.keep || []).filter(function (k) { return !(k.serves || []).length; }); if (spare.length) host.appendChild(note('Kept but serving no outcome (could stop): ' + spare.map(function (k) { return k.n; }).join('; '))); },
      clock: function (v, m, host) { var D = mvcDays(m); host.appendChild(table(['Stock', 'Held', 'Used each day', 'Days it lasts'], (m.stocks || []).map(function (s) { var u = num(s.use), lo = num(s.have), hi = num(s.haveHi); return { cls: D && u && lo != null && lo / u === D.lo ? 'sp' : '', cells: [s.n, (s.have || '?') + (s.haveHi ? ' to ' + s.haveHi : '') + ' ' + (s.unit || ''), s.use || 'Not known', u && lo != null ? dRound(lo / u) + (hi != null ? ' to ' + dRound(hi / u) : '') : 'Not known'] }; }))); host.appendChild(note(D ? 'The clock: ' + dRound(D.lo) + (D.hi > D.lo ? ' to ' + dRound(D.hi) : '') + ' days before the first stock runs out. Shown as a range, never one number.' : 'Add how much is held and how much is used each day.')); },
      ret: function (v, m, host) { var V = mvcVerdict(v, m); host.appendChild(table(['Order', 'What comes back', 'Takes', 'Needs first', 'Against the clock'], (m.ret || []).map(function (r, i) { return { cls: V.race[i] === 'lost' ? 'sp' : '', cells: [i + 1, r.n, (r.takes || '?') + ' ' + (r.unit || ''), r.needs || '', V.race[i] === 'won' ? 'Back in time' : V.race[i] === 'lost' ? 'Too late: the threshold is crossed' : 'Depends'] }; }))); }
    } });

  // ---------- Test: business continuity and disaster recovery plans, drawn from the model ----------
  rec({ id: 'bcp', name: 'Business continuity plan', about: 'A continuity plan drawn from the model, one process at a time: the longest disruption it can take before the threshold is crossed, how it carries on meanwhile, whether that workaround shares the failure, who invokes it, and when it was last tried. A workaround that fails for the same reason as the process is not a workaround.',
    subject: function (v, m) { return (m.items || []).length + ' processes planned'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['plan', 'The plan'], ['shared', 'Workarounds that share the failure']],
    edit: { lists: [{ k: 'items', title: 'Processes', blank: function () { return { proc: '', n: '', mtd: '', work: '', shares: 'unknown', invoke: '', who: '', tried: '', src: '' }; }, fields: [{ k: 'proc', l: 'Process, from the map', t: 'sel', o: procOpts }, { k: 'n', l: 'Name (if not on the map)', t: 'text' }, { k: 'mtd', l: 'Longest disruption before the threshold is crossed', t: 'text' }, { k: 'work', l: 'How it carries on meanwhile', t: 'long' }, { k: 'shares', l: 'Does the workaround share the failure?', t: 'sel', o: function () { return YNU; } }, { k: 'invoke', l: 'What invokes the plan', t: 'text' }, { k: 'who', l: 'Who invokes it (a named role)', t: 'text' }, { k: 'tried', l: 'Last tried, and how', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'continuity-plan', head: ['Process', 'Longest disruption', 'Workaround', 'Shares the failure', 'Invoked by', 'Who', 'Last tried'], rows: (m.items || []).map(function (x) { return [procName(v, x.proc) || x.n, x.mtd, x.work, x.shares, x.invoke, x.who, x.tried]; }) }]; },
    draw: {
      plan: function (v, m, host) { lineBox(host); (m.items || []).forEach(function (x) { host.appendChild(el('div', { class: 'jstep', 'data-id': x.id }, [el('b', { text: procName(v, x.proc) || x.n || 'A process' }), el('div', { class: 'sm muted', text: [x.mtd ? 'Can take ' + x.mtd : 'Longest disruption not known', x.who ? 'invoked by ' + x.who : 'no one named to invoke it', x.tried ? 'last tried ' + x.tried : 'never tried'].join('  ·  ') }), x.work ? el('div', { text: 'Meanwhile: ' + x.work }) : el('div', { class: 'jf', text: 'No workaround written.' }), x.shares === 'yes' ? el('div', { class: 'jf', text: 'The workaround shares the failure.' }) : null])); }); },
      shared: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return x.shares !== 'no'; }); if (!xs.length) host.appendChild(note('None: every workaround has been checked and fails for a different reason.')); host.appendChild(el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { text: (procName(v, x.proc) || x.n) + ': ' + (x.shares === 'yes' ? 'shares the failure' : 'not checked') }); }))); }
    } });
  rec({ id: 'dr', name: 'Disaster recovery plan', about: 'The technology the service rests on, and how it comes back: the recovery time and the data that may be lost, set against what actually happened the last time it was restored, and whether the backup sits apart from what it backs up. A target never tested is a hope.',
    subject: function (v, m) { return (m.items || []).length + ' systems'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['gap', 'Target against what happened'], ['order', 'Order of restore']],
    edit: { lists: [{ k: 'items', title: 'Systems', blank: function () { return { n: '', serves: '', rto: '', rpo: '', actual: '', tested: '', apart: 'unknown', src: '' }; }, fields: [{ k: 'n', l: 'System', t: 'text' }, { k: 'serves', l: 'What depends on it', t: 'text' }, { k: 'rto', l: 'Target time to restore (hours)', t: 'text' }, { k: 'rpo', l: 'Data that may be lost (hours)', t: 'text' }, { k: 'actual', l: 'Actual time to restore, last time (hours)', t: 'text' }, { k: 'tested', l: 'Last restored or tested', t: 'text' }, { k: 'apart', l: 'Backup kept apart from what it backs up?', t: 'sel', o: function () { return YNU; } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'disaster-recovery', head: ['System', 'Depends on it', 'Target (hours)', 'Data loss (hours)', 'Actual (hours)', 'Last tested', 'Backup apart'], rows: (m.items || []).map(function (x) { return [x.n, x.serves, x.rto, x.rpo, x.actual, x.tested, x.apart]; }) }]; },
    draw: {
      gap: function (v, m, host) { host.appendChild(table(['System', 'Target', 'Last time', 'Backup apart', 'Verdict'], (m.items || []).map(function (x) { var t = num(x.rto), a = num(x.actual), bad = a != null && t != null && a > t; return { cls: bad || x.apart === 'no' ? 'sp' : '', cells: [x.n, x.rto ? x.rto + ' h' : 'None set', x.actual ? x.actual + ' h' : 'Never tested', lab(YNU, x.apart), a == null ? 'A hope: never tested' : bad ? 'Misses its target' : 'Meets its target'] }; }))); },
      order: function (v, m, host) { host.appendChild(el('ol', { class: 'tl' }, (m.items || []).slice().sort(function (a, b) { return (num(a.rto) == null ? 1e9 : num(a.rto)) - (num(b.rto) == null ? 1e9 : num(b.rto)); }).map(function (x) { return el('li', { text: x.n + (x.rto ? ' (within ' + x.rto + ' hours)' : '') + (x.serves ? ': ' + x.serves : '') }); }))); }
    } });

  // ---------- Model, how it fails: the questions for every part of the map (Tool 23) ----------
  // Beside the twelve nots and the twelve technical mechanisms: asked of every step, link and resource of the
  // chosen models. What nobody can confirm becomes the list of unchecked conditions that goes to Test.
  function unchecked(m) { return (m.items || []).filter(function (x) { return x.state !== 'yes' || x.report === 'no' || !String(x.notice || '').trim() || x.ever === 'unknown'; }); }
  rec({ id: 'interrogate', name: 'Questions for every part of the map', about: 'Six questions asked of every step, link and resource in the chosen models: has it ever not happened, how often, how might it not happen, who would notice, would they report it, and can its actual state be established. Anything nobody can confirm, or a failure nobody would notice or report, goes on the list of unchecked conditions for Test. An unknown is not a safe.',
    subject: function (v, m) { return (m.items || []).length + ' parts questioned; ' + unchecked(m).length + ' unchecked'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['sheet', 'The questions'], ['unchecked', 'Unchecked conditions'], ['silent', 'Silent failures']],
    edit: { lists: [{ k: 'items', title: 'Parts of the map', blank: function () { return { proc: '', n: '', kind: 'step', ever: 'unknown', often: '', how: '', notice: '', report: 'unknown', state: 'unknown', src: '' }; }, fields: [{ k: 'proc', l: 'From the map', t: 'sel', o: procOpts }, { k: 'n', l: 'Or name it', t: 'text' }, { k: 'kind', l: 'Kind', t: 'sel', o: function () { return [['step', 'A step'], ['link', 'A link or hand-over'], ['resource', 'A resource']]; } }, { k: 'ever', l: 'Has it ever not happened?', t: 'sel', o: function () { return YNU; } }, { k: 'often', l: 'How often', t: 'text' }, { k: 'how', l: 'How might it not happen?', t: 'long' }, { k: 'notice', l: 'Who would notice?', t: 'text' }, { k: 'report', l: 'Would they report it?', t: 'sel', o: function () { return YNU; } }, { k: 'state', l: 'Can its actual state be established?', t: 'sel', o: function () { return YNU; } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'interrogation', head: ['Part', 'Kind', 'Ever not happened', 'How often', 'How it might not', 'Who would notice', 'Would report', 'State known', 'Source'], rows: (m.items || []).map(function (x) { return [procName(v, x.proc) || x.n, x.kind, x.ever, x.often, x.how, x.notice, x.report, x.state, x.src]; }) }, { name: 'unchecked', head: ['Part', 'Why it is unchecked'], rows: unchecked(m).map(function (x) { return [procName(v, x.proc) || x.n, whyUnchecked(x)]; }) }]; },
    draw: {
      sheet: function (v, m, host) { host.appendChild(table(['Part', 'Ever not happened', 'How often', 'Who would notice', 'Report it', 'State known'], (m.items || []).map(function (x) { return { cls: unchecked(m).indexOf(x) >= 0 ? 'sp' : '', cells: [procName(v, x.proc) || x.n, lab(YNU, x.ever), x.often || '', x.notice || 'No one', lab(YNU, x.report), lab(YNU, x.state)] }; }))); },
      unchecked: function (v, m, host) { var xs = unchecked(m); if (!xs.length) host.appendChild(note('None: every part has been checked.')); host.appendChild(el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { 'data-id': x.id, text: (procName(v, x.proc) || x.n) + ': ' + whyUnchecked(x) }); }))); host.appendChild(note('These go to Test, to be checked before anything is relied on.')); },
      silent: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return !String(x.notice || '').trim() || x.report === 'no'; }); if (!xs.length) host.appendChild(note('None found.')); host.appendChild(el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { text: (procName(v, x.proc) || x.n) + (x.how ? ': ' + x.how : '') + (x.report === 'no' ? ' (would not be reported)' : ' (no one would notice)') }); }))); }
    } });
  function whyUnchecked(x) { return [x.state !== 'yes' ? 'its actual state cannot be established' : '', !String(x.notice || '').trim() ? 'no one would notice' : '', x.report === 'no' ? 'it would not be reported' : '', x.ever === 'unknown' ? 'no one knows if it has ever failed' : ''].filter(Boolean).join('; '); }

  // ---------- Test, outcomes: measures that give warning in time (old Move 13) ----------
  // A measure warns in time only if it shows a change sooner than the time needed to act on it. Two dated
  // readings give a half-life of decay, and the review date is set at half of it.
  function steerOf(x) {
    var lead = num(x.lead), act = num(x.act), margin = lead != null && act != null ? lead - act : null;
    var d1 = Date.parse(x.d1), d2 = Date.parse(x.d2), r1 = num(x.r1), r2 = num(x.r2), half = null;
    if (!isNaN(d1) && !isNaN(d2) && r1 && r2 && r2 < r1 && d2 > d1) { var days = (d2 - d1) / 864e5; half = days * Math.log(2) / Math.log(r1 / r2); }
    return { margin: margin, half: half, review: half != null && !isNaN(d2) ? new Date(d2 + half / 2 * 864e5) : null };
  }
  rec({ id: 'steer', name: 'Measures that give warning in time', about: 'For each measure the change relies on: how far ahead it shows trouble, and how long it takes to act once it does. If the warning comes later than the time needed to act, the measure cannot warn in time. Two dated readings of something that wears away give its half-life; the review is booked at half of that.',
    subject: function (v, m) { var xs = m.items || []; return xs.filter(function (x) { var s = steerOf(x); return s.margin != null && s.margin > 0; }).length + ' of ' + xs.length + ' measures warn in time'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['margin', 'Do they warn in time?'], ['decay', 'What wears away']],
    edit: { lists: [{ k: 'items', title: 'Measures', blank: function () { return { n: '', warns: '', lead: '', act: '', d1: '', r1: '', d2: '', r2: '', src: '' }; }, fields: [{ k: 'n', l: 'Measure', t: 'text' }, { k: 'warns', l: 'What it warns of', t: 'text' }, { k: 'lead', l: 'How many days ahead it shows trouble', t: 'text' }, { k: 'act', l: 'Days needed to act once it does', t: 'text' }, { k: 'd1', l: 'First reading: date (year-month-day)', t: 'text' }, { k: 'r1', l: 'First reading', t: 'text' }, { k: 'd2', l: 'Later reading: date', t: 'text' }, { k: 'r2', l: 'Later reading', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'warning-measures', head: ['Measure', 'Warns of', 'Days ahead', 'Days to act', 'Margin', 'Half-life (days)', 'Review by'], rows: (m.items || []).map(function (x) { var s = steerOf(x); return [x.n, x.warns, x.lead, x.act, s.margin, s.half != null ? Math.round(s.half) : '', s.review ? s.review.toISOString().slice(0, 10) : '']; }) }]; },
    draw: {
      margin: function (v, m, host) { host.appendChild(table(['Measure', 'Warns of', 'Shows trouble', 'Time to act', 'Verdict'], (m.items || []).map(function (x) { var s = steerOf(x); return { cls: s.margin != null && s.margin <= 0 ? 'sp' : '', cells: [x.n, x.warns, x.lead ? x.lead + ' days ahead' : 'Not known', x.act ? x.act + ' days' : 'Not known', s.margin == null ? 'Not known' : s.margin > 0 ? 'Warns in time, with ' + s.margin + ' days to spare' : 'Cannot warn in time: it only describes what has happened'] }; }))); },
      decay: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return steerOf(x).half != null; }); if (!xs.length) host.appendChild(note('Add two dated readings of something that wears away (for example, the share of staff trained) to see its half-life.')); host.appendChild(el('ul', { class: 'tl' }, xs.map(function (x) { var s = steerOf(x); return el('li', { text: x.n + ': halves every ' + Math.round(s.half) + ' days; review by ' + s.review.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }); }))); }
    } });

  // ---------- Diagnose, the formulation: rival explanations (Tool 11) ----------
  var SHARE = [['most', 'Most of it'], ['much', 'Much of it'], ['some', 'Some of it'], ['little', 'Little of it']];
  rec({ id: 'rivals', name: 'Rival explanations', about: 'Every explanation that could account for what happened, ranked by how much of the evidence each one explains, never by how likely it feels. Each says what else we would see if it were true, and what would tell it apart from the others. The one that would be serious if missed is kept open, with a named person holding it.',
    subject: function (v, m) { return (m.items || []).length + ' explanations'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['rank', 'Ranked'], ['apart', 'Telling them apart']],
    edit: { lists: [{ k: 'items', title: 'Explanations', blank: function () { return { n: '', share: 'some', against: '', see: '', apart: '', keep: false, holder: '', status: 'open', src: '' }; }, fields: [{ k: 'n', l: 'The explanation', t: 'text' }, { k: 'share', l: 'How much of the evidence it explains', t: 'sel', o: function () { return SHARE; } }, { k: 'against', l: 'Evidence it does not explain', t: 'long' }, { k: 'see', l: 'What else we would see if it were true', t: 'long' }, { k: 'apart', l: 'What would tell it apart from the others', t: 'long' }, { k: 'keep', l: 'Serious if missed: keep it open', t: 'bool' }, { k: 'holder', l: 'Who holds it', t: 'text' }, { k: 'status', l: 'Status', t: 'sel', o: function () { return [['open', 'Open'], ['ruled', 'Ruled out by evidence'], ['kept', 'Kept alongside']]; } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'rival-explanations', head: ['Explanation', 'Explains', 'Does not explain', 'Would also see', 'Tells apart', 'Keep', 'Holder', 'Status'], rows: rankRivals(m).map(function (x) { return [x.n, lab(SHARE, x.share), x.against, x.see, x.apart, x.keep ? 'Yes' : '', x.holder, x.status]; }) }]; },
    draw: {
      rank: function (v, m, host) { host.appendChild(table(['', 'Explanation', 'Explains', 'Status', 'Kept open'], rankRivals(m).map(function (x, i) { return { cls: x.status === 'ruled' ? 'none' : '', cells: [i + 1, x.n, lab(SHARE, x.share), x.status === 'ruled' ? 'Ruled out' : x.status === 'kept' ? 'Kept alongside' : 'Open', x.keep ? 'Yes' + (x.holder ? ', by ' + x.holder : ', but no one named') : ''] }; }))); if (!(m.items || []).some(function (x) { return x.keep; })) host.appendChild(note('No explanation is marked serious if missed. Is there really none?')); },
      apart: function (v, m, host) { rankRivals(m).forEach(function (x) { host.appendChild(el('div', { class: 'jstep', 'data-id': x.id }, [el('b', { text: x.n }), x.see ? el('div', { text: 'If true, we would also see: ' + x.see }) : el('div', { class: 'jf', text: 'Nothing said about what else we would see.' }), x.apart ? el('div', { class: 'sm', text: 'Tells it apart: ' + x.apart }) : null, x.against ? el('div', { class: 'sm muted', text: 'Does not explain: ' + x.against }) : null])); }); }
    } });
  function rankRivals(m) { var o = { most: 0, much: 1, some: 2, little: 3 }; return (m.items || []).slice().sort(function (a, b) { return (a.status === 'ruled') - (b.status === 'ruled') || (o[a.share] || 0) - (o[b.share] || 0); }); }

  // ---------- Diagnose: combinations across cases (Combinational Regularity Analysis, 5 November 2026) ----------
  // Cases (past events, incidents, units) against conditions (the nots, the technical mechanisms, or others):
  // which combinations of conditions are enough, together, for the outcome? The analysis runs on the server
  // (/api/cora) with the open-source CORA package; this screen only sends the table and shows the answer.
  var CEV = [['', 'Not set'], ['0', '0 No evidence'], ['1', '1 Said'], ['2', '2 Written down'], ['3', '3 Done, or confirmed'], ['4', '4 Independently confirmed'], ['5', '5 Confirmed across sources']];
  var CCONS = [['1', 'Every case must agree (consistency 1)'], ['0.9', 'Nine in ten (0.9)'], ['0.8', 'Four in five (0.8)'], ['0.75', 'Three in four (0.75)']];
  function condFrom() { return [['', 'Another condition']].concat(NOTS.map(function (x) { return ['not:' + x[0], x[1]]; })).concat(TMECH.map(function (x) { return ['tech:' + x[0], 'No ' + x[1].toLowerCase() + ' (technical)']; })); }
  function condName(c) { if (c.n) return c.n; var f = condFrom().filter(function (o) { return o[0] === c.from; })[0]; return f && c.from ? f[1] : 'Unnamed condition'; }
  var CMARK = { '': ['?', 'Not known'], '1': ['Yes', 'Present'], '0': ['No', 'Absent'] };
  var cnext = function (x) { return x === '' || x == null ? '1' : x === '1' ? '0' : ''; };
  function comboKey(m) { return JSON.stringify([m.cons || '1', (m.conds || []).map(function (c) { return [c.id, condName(c)]; }), (m.cases || []).map(function (c) { return [c.id, c.out, c.v || {}]; })]); }
  async function comboSave(fn) { var v = X.invData(); v.combos = v.combos || {}; fn(v.combos); await X.saveInv(v); X.render(); }
  function comboTerm(t) { var a = t.values; return a.length === 1 && a[0] === 1 ? t.label : a.length === 1 && a[0] === 0 ? t.label + ': absent' : t.label + ' = ' + a.join(' or '); }
  rec({ id: 'combos', name: 'Combinations across cases', about: 'Several cases set side by side: past events, near misses, or units that did and did not reach the outcome. For each case, which conditions were present. The analysis finds the smallest combinations of conditions that are enough, together, for the outcome, allowing for more than one route to it. It uses Combinational Regularity Analysis (CORA), an open-source method. The answer is only as good as the coding: say how each case was judged.',
    subject: function (v, m) { var n = (m.cases || []).length, k = (m.conds || []).length; return n + (n === 1 ? ' case' : ' cases') + ', ' + k + (k === 1 ? ' condition' : ' conditions'); },
    empty: function (v, m) { return !(m.cases || []).length || !(m.conds || []).length; },
    views: [['grid', 'Cases and conditions'], ['run', 'Combinations found'], ['rules', 'How cases were judged']],
    edit: { root: [{ k: 'outcome', l: 'The outcome being explained (for example: the service crossed its threshold)', t: 'text' }, { k: 'cons', l: 'How strictly the cases must agree', t: 'sel', o: function () { return CCONS; } }, { k: 'rule', l: 'The rule for when a condition counts as present', t: 'long' }],
      lists: [{ k: 'conds', title: 'Conditions', blank: function () { return { from: '', n: '' }; }, fields: [{ k: 'from', l: 'Condition', t: 'sel', o: condFrom }, { k: 'n', l: 'Name, if another condition (or a shorter name)', t: 'text' }, { k: 'rule', l: 'When it counts as present', t: 'text' }] },
        { k: 'cases', title: 'Cases', blank: function () { return { n: '', out: '', lv: '', src: '', v: {} }; }, fields: [{ k: 'n', l: 'Case', t: 'text' }, { k: 'out', l: 'Did the outcome happen?', t: 'sel', o: function () { return [['', 'Not known'], ['1', 'Yes'], ['0', 'No']]; } }, { k: 'lv', l: 'How good is the evidence for this case?', t: 'sel', o: function () { return CEV; } }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { var cs = m.conds || []; return [{ name: 'cases-by-conditions', head: ['Case'].concat(cs.map(condName)).concat([m.outcome || 'Outcome', 'Evidence', 'Source']), rows: (m.cases || []).map(function (c) { return [c.n].concat(cs.map(function (k) { return (c.v || {})[k.id] == null ? '' : (c.v || {})[k.id]; })).concat([c.out, c.lv, c.src]); }) }]; },
    draw: {
      grid: function (v, m, host) {
        var cs = m.conds || [], ro = !!S.readonly;
        host.appendChild(note('Press a cell to mark the condition present, then absent, then not known. Cases with anything not known are left out of the analysis, and listed.'));
        var head = el('tr', {}, [el('th', { text: 'Case' })].concat(cs.map(function (c) { return el('th', { class: 'cbh', title: condName(c), text: condName(c) }); })).concat([el('th', { class: 'cbh cbo', text: m.outcome || 'The outcome' }), el('th', { text: 'Evidence' })]));
        var rows = (m.cases || []).map(function (c) {
          var cell = function (val, label, onclick, extra) { var k = val == null ? '' : String(val), mk = CMARK[k] || [k, 'Level ' + k]; return el('td', {}, [el('button', { type: 'button', class: 'cb v' + (CMARK[k] ? (k || 'n') : 'm') + (extra || ''), disabled: ro, 'data-cb': c.id + ':' + label, 'aria-label': c.n + ', ' + label + ': ' + mk[1], text: mk[0], onclick: onclick })]); };
          return el('tr', { 'data-case': c.id }, [el('th', { class: 'cbn', text: c.n || 'Unnamed case' })].concat(cs.map(function (k) {
            var cur = (c.v || {})[k.id];
            return cell(cur, condName(k), function () { comboSave(function (mm) { var x = (mm.cases || []).filter(function (y) { return y.id === c.id; })[0]; if (!x) return; x.v = Object.assign({}, x.v || {}); x.v[k.id] = cnext(cur == null ? '' : String(cur)); }); });
          })).concat([cell(c.out, 'outcome', function () { comboSave(function (mm) { var x = (mm.cases || []).filter(function (y) { return y.id === c.id; })[0]; if (x) x.out = cnext(c.out == null ? '' : String(c.out)); }); }, ' cbo'), el('td', { class: 'sm', text: c.lv === '' || c.lv == null ? '' : lab(CEV, String(c.lv)) })]));
        });
        host.appendChild(el('div', { class: 'dscroll' }, [el('table', { class: 'itab cbtab', id: 'cbGrid' }, [el('thead', {}, [head]), el('tbody', {}, rows)])]));
      },
      run: function (v, m, host) {
        var key = comboKey(m), memo = S.coraMemo = S.coraMemo || {}, res = memo[key];
        var conds = (m.conds || []).map(function (c) { return { key: c.id, label: condName(c) }; });
        var cases = (m.cases || []).map(function (c) { var vals = {}; (m.conds || []).forEach(function (k) { var x = (c.v || {})[k.id]; vals[k.id] = x === '' || x == null ? null : Number(x); }); return { id: c.id, values: vals, outcome: c.out === '' || c.out == null ? null : Number(c.out) }; });
        var nameOfCase = function (id) { var x = (m.cases || []).filter(function (c) { return c.id === id; })[0]; return x ? (x.n || 'Unnamed case') : id; };
        var out = el('div', { id: 'cbOut' });
        host.appendChild(el('div', { class: 'row', style: 'margin-bottom:10px;align-items:center' }, [el('button', { class: 'btn sm warm', id: 'cbRun', text: res ? 'Run again' : 'Find the combinations', onclick: async function (e) { e.target.disabled = true; out.textContent = 'Working…'; try { var r = await fetch('/api/cora', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conditions: conds, cases: cases, options: { consistency: Number(m.cons || 1) } }) }); var b = await r.json().catch(function () { return { error: 'The analysis did not answer.' }; }); memo[key] = r.ok ? b : { error: b.error || 'The analysis could not be run.' }; } catch (err) { memo[key] = { error: 'The analysis could not be reached.' }; } X.render(); } }), el('span', { class: 'muted sm', text: 'Outcome: ' + (m.outcome || 'not named yet') + '. ' + lab(CCONS, String(m.cons || '1')) + '.' })]));
        host.appendChild(out);
        if (!res) { out.appendChild(note('Nothing run yet for this table. Changing a cell means running it again.')); return; }
        if (res.error) { out.appendChild(el('p', { class: 'msg bad', text: res.error })); return; }
        var npos = (m.cases || []).filter(function (c) { return res.used.indexOf(c.id) >= 0 && String(c.out) === '1'; }).length;
        out.appendChild(el('div', { class: 'kpis' }, [kpi('Cases used', String(res.used.length)), kpi('With the outcome', String(npos)), kpi('Left out', String(res.dropped.length), res.dropped.length > 0), kpi('Answers found', String(res.solutions.length))]));
        (res.notes || []).forEach(function (t) { out.appendChild(el('p', { class: 'msg', text: t })); });
        if (res.contradictions && res.contradictions.length) out.appendChild(note('Same combination, different outcome: ' + res.contradictions.map(function (g) { return g.map(nameOfCase).join(' and '); }).join('; ') + '. Look again at how these were judged, or at a condition that tells them apart.'));
        var every = {}; res.solutions.forEach(function (s) { s.paths.forEach(function (p) { var k = JSON.stringify(p.terms); every[k] = (every[k] || 0) + 1; }); });
        res.solutions.slice(0, 6).forEach(function (s, i) {
          var box = el('div', { class: 'cbans', 'data-answer': String(i + 1) }, [el('h4', { text: (res.solutions.length > 1 ? 'Answer ' + (i + 1) + ': ' : '') + s.paths.length + (s.paths.length === 1 ? ' route' : ' routes') + ' to the outcome' }), el('div', { class: 'muted sm', text: 'Together they account for ' + Math.round(s.coverage * 100) + ' in 100 of the cases with the outcome; ' + Math.round((s.consistency || 0) * 100) + ' in 100 of the cases they describe had it.' })]);
          s.paths.forEach(function (p) {
            var shared = every[JSON.stringify(p.terms)] === res.solutions.length && res.solutions.length > 1;
            box.appendChild(el('div', { class: 'cbpath' }, [el('div', { class: 'cbterms' }, p.terms.map(function (t, j) { return el('span', {}, [j ? el('b', { class: 'cband', text: ' and ' }) : null, el('span', { class: 'cbt' + (t.values.length === 1 && t.values[0] === 0 ? ' abs' : ''), text: comboTerm(t) })]); }).concat(shared ? [el('span', { class: 'pill ok', style: 'margin-left:8px', text: 'In every answer' })] : [])),
              el('div', { class: 'sm', text: 'Enough on its own in ' + Math.round((p.consistency || 0) * 100) + ' in 100 of the cases it describes. Accounts for ' + Math.round(p.coverage * 100) + ' in 100 of the cases with the outcome' + (s.paths.length > 1 ? ', ' + Math.round(p.unique * 100) + ' in 100 by this route alone' : '') + '.' }),
              el('div', { class: 'muted sm', text: 'Cases: ' + p.cases.map(nameOfCase).join(', ') })]));
          });
          out.appendChild(box);
        });
        if (res.solutions.length > 6) out.appendChild(note(res.solutions.length - 6 + ' more answers fit the cases equally well. More cases, or fewer conditions, would narrow them down.'));
        if (res.dropped.length) out.appendChild(note('Left out: ' + res.dropped.map(function (d) { return nameOfCase(d.id) + ' (' + d.reason.toLowerCase() + ')'; }).join('; ') + '.'));
        out.appendChild(el('div', { class: 'limits' }, [el('b', { text: 'Reading this. ' }), document.createTextNode('A route is a combination of conditions that, in these cases, was enough for the outcome. It is a regularity in the cases you chose, not proof of cause. Two answers that fit equally well mean the cases cannot yet tell them apart. A case judged on weak evidence can change the answer: check the cases at level 0 to 2 first.')]));
      },
      rules: function (v, m, host) {
        host.appendChild(el('p', { text: m.rule ? m.rule : 'No general rule written yet. Add one under Edit: when does a condition count as present in a case?' }));
        host.appendChild(table(['Condition', 'When it counts as present'], (m.conds || []).map(function (c) { return [condName(c), c.rule || 'Not said']; })));
        host.appendChild(table(['Case', 'Outcome', 'Evidence', 'Source'], (m.cases || []).map(function (c) { return [c.n, c.out === '1' ? 'Yes' : c.out === '0' ? 'No' : 'Not known', lab(CEV, String(c.lv == null ? '' : c.lv)), c.src || '']; })));
      }
    } });

  // ---------- Diagnose: the people side (capability, load and competing commitments) ----------
  var CANDO = [['yes', 'Yes: they could if they had to'], ['no', 'No: they could not'], ['unknown', 'Not known']];
  rec({ id: 'people', name: 'Capability, load and competing commitments', about: 'For each group whose work the change depends on: what the work asks of them, whether they could do it if they had to, whether what stops them is in their surroundings (information, resources, incentives) or in themselves (knowledge, capacity, motives), what they are already carrying, and what they are protecting that a change might threaten. An absent capability looks like resistance from outside.',
    subject: function (v, m) { return (m.items || []).length + ' groups'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['groups', 'By group'], ['gaps', 'Gaps and load']],
    edit: { lists: [{ k: 'items', title: 'Groups', blank: function () { return { n: '', asks: '', cando: 'unknown', where: '', load: '', absorb: 'unknown', protect: '', few: '', src: '' }; }, fields: [{ k: 'n', l: 'Group or role', t: 'text' }, { k: 'asks', l: 'What the work asks of them', t: 'long' }, { k: 'cando', l: 'Could they do it if they had to?', t: 'sel', o: function () { return CANDO; } }, { k: 'where', l: 'What stops them', t: 'sel', o: function () { return [['', 'Choose'], ['env', 'Their surroundings: information, resources, incentives'], ['person', 'Themselves: knowledge, capacity, motives'], ['both', 'Both']]; } }, { k: 'load', l: 'What they are already carrying', t: 'long' }, { k: 'absorb', l: 'Could they take on more?', t: 'sel', o: function () { return YNU; } }, { k: 'protect', l: 'What they are protecting (a competing commitment)', t: 'long' }, { k: 'few', l: 'How few people hold a critical skill', t: 'text' }, { k: 'src', l: 'Source', t: 'text' }] }] },
    registers: function (v, m) { return [{ name: 'people-side', head: ['Group', 'Asks', 'Could do it', 'What stops them', 'Load', 'Could take more', 'Protecting', 'Few hold it'], rows: (m.items || []).map(function (x) { return [x.n, x.asks, x.cando, x.where, x.load, x.absorb, x.protect, x.few]; }) }]; },
    draw: {
      groups: function (v, m, host) { (m.items || []).forEach(function (x) { host.appendChild(el('div', { class: 'jstep', 'data-id': x.id }, [el('b', { text: x.n }), x.asks ? el('div', { text: 'Asks: ' + x.asks }) : null, el('div', { class: 'sm', text: lab(CANDO, x.cando) + (x.where ? '. Stopped by ' + ({ env: 'their surroundings', person: 'themselves', both: 'both' })[x.where] : '') }), x.load ? el('div', { class: 'sm muted', text: 'Already carrying: ' + x.load + (x.absorb === 'no' ? ' (cannot take more)' : '') }) : null, x.protect ? el('div', { class: 'jf', text: 'Protecting: ' + x.protect }) : null])); }); },
      gaps: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return x.cando === 'no' || x.absorb === 'no' || x.few; }); if (!xs.length) host.appendChild(note('No capability gaps, overload or single holders recorded.')); host.appendChild(el('ul', { class: 'tl' }, xs.map(function (x) { return el('li', { text: x.n + ': ' + [x.cando === 'no' ? 'cannot do it (a capability gap, which training alone may not fix)' : '', x.absorb === 'no' ? 'cannot take on more' : '', x.few ? 'held by ' + x.few : ''].filter(Boolean).join('; ') }); }))); }
    } });

  // ---------- Diagnose, optional: futures letters (Tools 9 and 10) ----------
  rec({ id: 'futures', name: 'Futures letters', about: 'Optional. Each person, working alone, writes two short letters from the future: the opening of the inquiry report after it failed, and a thank-you letter after it worked. Each letter names something that would show it to be wrong. Read without names; a blank sheet is kept as data.',
    subject: function (v, m) { return (m.items || []).length + ' letters'; }, empty: function (v, m) { return !(m.items || []).length; },
    views: [['fail', 'If it failed'], ['work', 'If it worked']],
    edit: { lists: [{ k: 'items', title: 'Letters', blank: function () { return { kind: 'fail', text: '', wrong: '', blank: false }; }, fields: [{ k: 'kind', l: 'Kind', t: 'sel', o: function () { return [['fail', 'The inquiry report, after it failed'], ['work', 'A thank-you letter, after it worked']]; } }, { k: 'text', l: 'The letter', t: 'long' }, { k: 'wrong', l: 'What would show this to be wrong', t: 'text' }, { k: 'blank', l: 'Left blank', t: 'bool' }] }] },
    registers: function (v, m) { return [{ name: 'futures-letters', head: ['Kind', 'Letter', 'Would show it wrong', 'Blank'], rows: (m.items || []).map(function (x) { return [x.kind, x.text, x.wrong, x.blank ? 'Yes' : '']; }) }]; },
    draw: {
      fail: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return x.kind === 'fail'; }); xs.forEach(function (x) { host.appendChild(el('div', { class: 'jstep' }, [el('div', { text: x.blank ? '(left blank)' : x.text }), x.wrong ? el('div', { class: 'sm muted', text: 'Would show it wrong: ' + x.wrong }) : null])); }); if (!xs.length) host.appendChild(note('No letters of this kind.')); },
      work: function (v, m, host) { var xs = (m.items || []).filter(function (x) { return x.kind === 'work'; }); xs.forEach(function (x) { host.appendChild(el('div', { class: 'jstep' }, [el('div', { text: x.blank ? '(left blank)' : x.text }), x.wrong ? el('div', { class: 'sm muted', text: 'Would show it wrong: ' + x.wrong }) : null])); }); if (!xs.length) host.appendChild(note('No letters of this kind.')); }
    } });

  // Which step each record belongs to (29 October 2026). Model: designed and tested offline. Test: tried in use.
  // The conditions (the twelve nots) and the technical mechanisms moved to Diagnose: they carry no practice.
  ['abm', 'bia', 'risk', 'scentest'].forEach(function (id) { var md = MODELS.filter(function (x) { return x.id === id; })[0]; if (md) md.practice = 'model'; });
  ['interrogate'].forEach(function (id) { var md = MODELS.filter(function (x) { return x.id === id; })[0]; if (md) md.practice = 'model'; });
  ['plans', 'exlog', 'selfassess', 'forcefield', 'pace', 'mvc', 'bcp', 'dr', 'steer'].forEach(function (id) { var md = MODELS.filter(function (x) { return x.id === id; })[0]; if (md) md.practice = 'test'; });
  // =====================================================================
  // The model at a depth: the same data, trimmed to what an engagement of that depth would hold.
  // Depth 1 is a sketch from the room; each depth adds the detail its evidence brings
  // (see 13-model-data-requirements.md for which item belongs to which depth).
  // =====================================================================
  var FIELD_LV = {
    processes: { owner: 2, fails: 2, aware: 3, tUsual: 3, tLong: 3, doc: 3, grade: 3, src: 3 },
    resources: { owner: 2, alt: 2, rto: 2, c: 2, pos: 2, dir: 2, cap: 2, avail: 3, chk: 3, chkBy: 3, indep: 3, grade: 3, src: 3, det: 4 }
  };
  function trim(o, map, d) { var c = JSON.parse(JSON.stringify(o)); Object.keys(map).forEach(function (k) { if (map[k] > d) delete c[k]; }); return c; }
  function project(v0, d) {
    if (d >= 5) return v0;
    var v = JSON.parse(JSON.stringify(v0));
    v.processes = (v.processes || []).map(function (p) { return trim(p, FIELD_LV.processes, d); });
    v.resources = (v.resources || []).map(function (r) { var c = trim(r, FIELD_LV.resources, d); if (d < 2) { c.t = c.t; c.alt = ''; } return c; });
    v.scenarios = d < 2 ? [] : (v.scenarios || []).map(function (s2) { return d < 3 ? { id: s2.id, n: s2.n } : d < 4 ? { id: s2.id, n: s2.n, best: s2.best, worst: s2.worst } : s2; });
    if (v.journey) { var j = v.journey; j.stages = (j.stages || []).map(function (x) { return d < 2 ? { id: x.id, n: x.n, feel: x.feel, proc: [] } : x; }); if (d < 3) { delete j.good; delete j.voice; } }
    if (v.blueprint) { var b = v.blueprint; if (d < 2) { b.cells = []; b.should = []; } else if (d < 3) b.cells = (b.cells || []).map(function (c) { return { id: c.id, st: c.st, lane: c.lane, t: c.t, fail: c.fail }; }); }
    if (v.timeline) { var ev = v.timeline.events || []; v.timeline.events = ev.filter(function (e, i) { return d >= 3 || (d === 2 ? (e.kind !== 'incident' || e.phase !== PHASES[0]) : (i === 0 || e.phase !== PHASES[0])); }).map(function (e) { return d < 4 ? Object.assign({}, e, { hours: null, res: d < 3 ? '' : e.res }) : e; }); }
    if (v.bowtie) { var bt = v.bowtie; if (d < 2) { bt.bars = []; (bt.cons || []).forEach(function (c) { c.cap = []; }); } else bt.bars = (bt.bars || []).map(function (x) { var c = Object.assign({}, x); if (d < 3) c.state = 'untested'; if (d < 4) { delete c.kind; delete c.tested; } return c; }); }
    if (v.faulttree) { var ft = v.faulttree; if (d < 2) ft.nodes = (ft.nodes || []).filter(function (x) { return x.parent === 'top'; }).map(function (x) { return { id: x.id, n: x.n, parent: 'top', gate: '' }; }); else ft.nodes = (ft.nodes || []).map(function (x) { var c = Object.assign({}, x); if (d < 3) delete c.seen; if (d < 4) { c.p = null; delete c.warrant; } return c; }); }
    if (v.accimap) { var am = v.accimap; if (d < 2) { am.factors = (am.factors || []).filter(function (f) { return Number(f.lvl) >= 4; }).map(function (f) { return { id: f.id, lvl: f.lvl, n: f.n }; }); am.links = []; } else if (d < 3) { am.factors = (am.factors || []).map(function (f) { return { id: f.id, lvl: f.lvl, n: f.n }; }); am.links = []; } else if (d < 4) am.factors = (am.factors || []).map(function (f) { var c = Object.assign({}, f); delete c.intent; delete c.conf; return c; }); }
    if (v.systems) { var sy = v.systems; if (d < 2) sy.links = []; else if (d < 3) sy.links = (sy.links || []).map(function (l) { return Object.assign({}, l, { delay: false }); }); if (d < 4) sy.meas = []; }
    if (v.fram) v.fram.fns = (v.fram.fns || []).map(function (f) { var c = Object.assign({}, f); if (d < 2) { c.P = ''; c.R = ''; } if (d < 3) { c.T = ''; c.C = ''; } if (d < 4) { c.var = 'stable'; delete c.varEv; } return c; });
    if (v.sna) { var sn = v.sna; if (d < 2) sn.ties = []; else sn.ties = (sn.ties || []).filter(function (t) { return d >= 4 || t.kind !== 'watches'; }).map(function (t) { return d < 3 ? Object.assign({}, t, { kind: 'info', w: 1 }) : t; }); }
    if (v.vsm) { var vs = v.vsm; vs.fns = (vs.fns || []).filter(function (f) { return d >= 5 || f.lvl === 'org'; }).map(function (f) { var c = Object.assign({}, f); if (d < 2) { c.ans = ''; c.how = ''; } if (d < 3) c.ev = c.gap ? 'none' : 'stated'; return c; }); if (d < 2) vs.chans = []; }
    if (v.abm) { var ab = v.abm; if (d < 3) { ab.res = []; ab.shocks = []; ab.procs = (ab.procs || []).map(function (x) { return d < 2 ? { id: x.id, p: x.p, cap: 2 } : { id: x.id, p: x.p, cap: 2, arrive: x.arrive }; }); delete ab.cal; delete ab.states; } if (d < 4) { ab.facts = []; } }
    return v;
  }
  var DEPTH_WHAT = [null, 'Depth 1: the sketch from the room', 'Depth 2: from the sponsor, a few people and the key documents', 'Depth 3: from most documents and interviews, the journeys, the rota and the incident log', 'Depth 4: evidence checked across all four forms, every element interrogated', 'Depth 5: everything, up to a full inquiry'];
  function depthRow(md) {
    var N = window.VTNeeds, rd = N ? N.readiness(md.inventory ? 'ibs' : md.id) : { top: 5, short: {} };
    S.mdepth = S.mdepth || {};
    var want = S.mdepth[md.id] || Math.min(N ? N.level() : 5, Math.max(1, rd.top)), cur = Math.max(1, Math.min(want, Math.max(1, rd.top)));
    S.mdepth[md.id] = cur;
    var row = el('div', { class: 'mdepth', role: 'group', 'aria-label': 'Show this model at a depth' }, [el('span', { class: 'muted sm', text: 'Show at depth' })]);
    for (var d = 1; d <= 5; d++) (function (d) {
      var ok = d <= Math.max(1, rd.top), b = el('button', { 'data-md': String(d), 'aria-pressed': String(d === cur), disabled: !ok, class: ok ? '' : 'nodata', title: ok ? DEPTH_WHAT[d] : 'Insufficient data for depth ' + d + ': ' + (rd.short[d] || []).concat(d > rd.top + 1 ? ['the depths below it first'] : []).slice(0, 4).join('; '), onclick: function () { S.mdepth[md.id] = d; X.render(); } }, [el('b', { text: String(d) }), ok ? null : el('span', { text: 'Insufficient data' })]);
      row.appendChild(b);
    })(d);
    row.appendChild(el('span', { class: 'muted sm mdwhat', text: DEPTH_WHAT[cur] }));
    return { el: row, d: cur };
  }

  // =====================================================================
  // The frame every model shares: tabs of models, then views, Edit and Export.
  // =====================================================================
  function modelData(v, md) { return md.key ? (v[md.key] || {}) : {}; }
  function example(md) { var ex = X.D.examples && X.D.examples.maylands && X.D.examples.maylands.inventory; return ex && md.key && ex[md.key] ? ex[md.key] : null; }
  function render(main) {
    var sOn = function (id) { return !window.VTScope || window.VTScope.on(id); };
    var shown = MODELS.filter(function (x) { return !x.hidden && sOn(x.id); });
    X.head(S.data.session.name || 'Diagnose', 'Maps of the system');
    if (!shown.length) { main.appendChild(el('p', { class: 'meta', style: 'margin-top:18px', text: 'No maps of the system are switched on for this engagement. Switch them on in Project, under Used, shown and reported.' })); return; }
    var stepMd = S.mtab && MODELS.filter(function (x) { return x.id === S.mtab && (x.practice === 'model' || x.practice === 'test'); })[0];
    if (stepMd) { location.href = '/' + stepMd.practice + '#' + S.mtab; return; }
    var tabId = S.mtab || 'ibs', md = shown.filter(function (x) { return x.id === tabId; })[0] || shown[0];
    main.appendChild(el('div', { class: 'mtabs', role: 'tablist', 'aria-label': 'Kinds of model' }, shown.map(function (x) { return el('button', { role: 'tab', 'aria-selected': String(x.id === md.id), 'data-mt': x.id, text: x.name, onclick: function () { S.mtab = x.id; X.go('model=' + x.id); } }); })));
    panelFor(md, main, true);
  }
  // One model's panel: header, Edit and Export, the depth row (on the model page), what it needs, its views.
  function panelFor(md, main, withDepth) {
    var N = window.VTNeeds, dr = withDepth ? depthRow(md) : { el: null, d: 5 }, vFull = X.invData();
    if (md.inventory) { var ip = X.inventoryPanel(project(vFull, dr.d)); ip.insertBefore(dr.el, ip.children[1]); if (N) N.panel('ibs', ip, ip.children[2]); main.appendChild(ip); if (N) N.flags('ibs', ip); return; }
    var v = project(vFull, dr.d), m = modelData(v, md), view = (S.mview || {})[md.id] || md.views[0][0];
    var box = el('div', { class: 'glass invp', id: 'mp', 'data-model': md.id });
    box.appendChild(el('div', { class: 'spread' }, [el('div', {}, [el('div', { class: 'flab', text: md.name }), el('h3', { style: 'margin:2px 0 0', text: md.subject(v, m) })]),
      el('div', { class: 'row' }, [el('button', { class: 'btn sm', id: 'mEdit', text: md.editShared ? 'Edit the processes' : md.hidden ? 'Edit' : 'Edit the ' + md.name.replace(/ \(.*\)$/, '').toLowerCase(), onclick: function () { if (md.editShared) X.go('tile=inventory'); else X.go('medit=' + md.id); } }), el('button', { class: 'btn sm', id: 'mExport', text: 'Export', onclick: function () { exportModel(md, v, m); } })])]));
    box.appendChild(el('p', { class: 'meta', style: 'margin:6px 0 0;max-width:90ch', text: md.about }));
    if (dr.el) box.appendChild(dr.el);
    if (N) N.panel(md.id, box);
    box.appendChild(predictBox(md));
    if (X.evqBar && !md.inventory) box.appendChild(X.evqBar(md.id, (md.practice === 'model' ? 'Model' : md.practice === 'test' ? 'Test' : 'Diagnose') + ': ' + md.name, md.practice || 'diagnose'));
    box.appendChild(el('div', { class: 'seg invtabs', style: 'margin-top:12px' }, md.views.map(function (x) { return el('button', { 'aria-pressed': String(view === x[0]), 'data-mv': x[0], text: x[1], onclick: function () { S.mview = S.mview || {}; S.mview[md.id] = x[0]; X.render(); } }); })));
    if (md.empty(v, m)) {
      var ex = example(md);
      box.appendChild(el('div', { style: 'margin-top:14px' }, [note('Nothing in this model yet.' + (md.editShared ? ' It is drawn from the processes in the inventory.' : '')), el('div', { class: 'row' }, [ex && /maylands/i.test(S.data.session.name || '') ? el('button', { class: 'btn sm warm', id: 'mExample', text: 'Add the Maylands worked case to this model', onclick: async function () { var v2 = X.invData(); v2[md.key] = JSON.parse(JSON.stringify(ex)); await X.saveInv(v2); X.render(); } }) : null])]));
      main.appendChild(box); return;
    }
    var host = el('div', { class: 'invview', 'data-view': view });
    md.draw[view].call(md, v, m, host);
    box.appendChild(host); main.appendChild(box);
    if (N) N.flags(md.id, host);
  }
  // Before you run it (31 October 2026): the prediction register. What we expect, and what would change our
  // mind, written before the tool is used; scored afterwards. Never edited once scored.
  var PRES = [['as', 'As we said'], ['better', 'Missed: better'], ['worse', 'Missed: worse'], ['notyet', 'Not yet due']];
  function predictBox(md) {
    var ro = !!S.readonly, all = X.invData().predict || {}, p = all[md.id] || {}, msg = el('span', { class: 'muted sm' });
    var put = async function (fn) { try { var v = X.invData(); v.predict = v.predict || {}; var cur = Object.assign({}, v.predict[md.id] || {}); fn(cur); v.predict[md.id] = cur; await X.saveInv(v); X.render(); } catch (e) { msg.textContent = e.message; } };
    var box = el('details', { class: 'predict', id: 'mPredict', open: (S.predOpen || {})[md.id] != null ? (S.predOpen[md.id] ? true : null) : !p.result && !ro ? true : null, ontoggle: function (e) { S.predOpen = S.predOpen || {}; S.predOpen[md.id] = e.target.open; } }, [el('summary', {}, [el('b', { text: 'Before you run it: what do we expect?' }), p.expect ? el('span', { class: 'muted sm', text: '  · written ' + (p.at ? new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '') + (p.result ? ' · ' + lab(PRES, p.result).toLowerCase() : ' · not scored yet') }) : null])]);
    var fld = function (k, l, ph) { var t = el('textarea', { rows: 2, 'data-predict': k, placeholder: ph, disabled: ro || !!p.result }); t.value = p[k] || ''; t.addEventListener('blur', function () { if (t.value.trim() === (p[k] || '')) return; put(function (c) { c[k] = t.value.trim(); c.by = c.by || X.me && X.me(); c.at = c.at || new Date().toISOString(); }); }); return el('label', { class: 'mef wide2' }, [el('span', { text: l }), t]); };
    box.appendChild(el('div', { class: 'merow' }, [fld('expect', 'What we expect it to show', 'For example: the weekend hand-over is the single point everything passes through'), fld('change', 'What result would change our mind', 'For example: a second route that works without it'), fld('decision', 'Which decision this could change', 'For example: whether to fund a named doctor or a new system')]));
    if (p.expect) box.appendChild(el('div', { class: 'row', style: 'margin-top:8px;align-items:center' }, [el('span', { class: 'sm', text: 'Afterwards, how did it turn out?' })].concat(PRES.map(function (o) { return el('button', { class: 'btn sm' + (p.result === o[0] ? ' solid' : ''), 'data-presult': o[0], disabled: ro, text: o[1], onclick: function () { put(function (c) { c.result = o[0]; c.scoredAt = new Date().toISOString(); }); } }); })).concat([msg])));
    return box;
  }
  function exportModel(md, v, m) {
    var base = (S.data.session.name || 'service').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '-' + md.id, regs = md.registers(v, m);
    X.modal([el('div', { class: 'spread' }, [el('h3', { style: 'margin:0', text: 'Export: ' + md.name }), el('button', { class: 'btn sm', text: 'Close', onclick: X.closeModal })]),
      el('p', { class: 'meta', text: 'Spreadsheet files (CSV) of the model, and the whole model as JSON for another tool to read.' }),
      el('div', { class: 'row', style: 'margin-top:12px' }, regs.map(function (r) { return el('button', { class: 'btn sm', 'data-exp': r.name, text: r.name.charAt(0).toUpperCase() + r.name.slice(1).replace(/-/g, ' ') + ' (CSV)', onclick: function () { X.download(base + '-' + r.name + '.csv', X.csv([r.head].concat(r.rows))); } }); }).concat([el('button', { class: 'btn sm', 'data-exp': 'json', text: 'The model (JSON)', onclick: function () { X.download(base + '.json', JSON.stringify(md.key ? m : { processes: v.processes }, null, 2), 'application/json'); } })]))]);
  }

  // ---------- one editor for every model, built from what each model says it holds ----------
  function renderEdit(main, id) {
    var md = MODELS.filter(function (x) { return x.id === id; })[0]; if (!md || !md.edit) return render(main);
    if (!S.medit || S.medit.id !== id) { var v0 = X.invData(); v0[md.key] = v0[md.key] || {}; S.medit = { id: id, v: v0 }; }
    var v = S.medit.v, m = v[md.key], msg = el('div', { class: 'msg', id: 'meMsg' });
    var save = async function () { try { await X.saveInv(v); S.dirty = false; msg.className = 'msg good'; msg.textContent = 'Saved.'; } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; } };
    var touch = function () { S.dirty = true; msg.className = 'msg dirty'; msg.textContent = 'Unsaved changes'; };
    main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:18px' }, [el('button', { class: 'btn sm', text: md.practice === 'model' ? '← Model' : md.practice === 'test' ? '← Test' : md.hidden ? '← Diagnose' : '← Maps of the system', onclick: function () { if (md.hidden) X.go(md.hidden); else { S.mtab = id; X.go('model=' + id); } } }), el('div', { class: 'row' }, [msg, el('button', { class: 'btn sm solid', id: 'meSave', text: 'Save', onclick: save })])]));
    X.head(S.data.session.name || 'Diagnose', md.name + ': edit');
    var field = function (obj, f) {
      var val = obj[f.k];
      if (f.t === 'long') { var t = el('textarea', { rows: 2, placeholder: f.l, value: val || '' }); t.addEventListener('input', function () { obj[f.k] = t.value; touch(); }); return el('label', { class: 'mef wide2' }, [el('span', { text: f.l }), t]); }
      if (f.t === 'num') { var n = el('input', { type: 'number', step: 'any', value: val == null ? '' : val }); n.addEventListener('input', function () { obj[f.k] = n.value === '' ? null : Number(n.value); touch(); }); return el('label', { class: 'mef' }, [el('span', { text: f.l }), n]); }
      if (f.t === 'bool') { var b = el('input', { type: 'checkbox', checked: !!val }); b.addEventListener('change', function () { obj[f.k] = b.checked; touch(); }); return el('label', { class: 'mef box' }, [b, el('span', { text: f.l })]); }
      if (f.t === 'sel') { var s = el('select', {}, f.o(v).map(function (o) { return el('option', { value: o[0], text: o[1] }); })); s.value = val == null ? '' : String(val); if (s.value !== String(val == null ? '' : val) && s.options.length) { obj[f.k] = s.value; } s.addEventListener('change', function () { obj[f.k] = typeof val === 'number' || f.k === 'lvl' ? Number(s.value) : s.value; touch(); }); return el('label', { class: 'mef' }, [el('span', { text: f.l }), s]); }
      if (f.t === 'multi') { var cur = obj[f.k] = obj[f.k] || []; return el('div', { class: 'mef wide2' }, [el('span', { text: f.l }), el('div', { class: 'ilinks' }, f.o(v).map(function (o) { var c = el('input', { type: 'checkbox', checked: cur.indexOf(o[0]) >= 0 }); c.addEventListener('change', function () { var i = cur.indexOf(o[0]); if (c.checked && i < 0) cur.push(o[0]); if (!c.checked && i >= 0) cur.splice(i, 1); touch(); }); return el('label', {}, [c, document.createTextNode(o[1])]); }))]); }
      var i2 = el('input', { type: 'text', value: val || '', placeholder: f.l }); i2.addEventListener('input', function () { obj[f.k] = i2.value; touch(); }); return el('label', { class: 'mef' + (f.k === 'n' ? ' grow' : '') }, [el('span', { text: f.l }), i2]);
    };
    if (md.edit.root) main.appendChild(el('div', { class: 'panel' }, [el('h4', { text: 'About this model' }), el('div', { class: 'merow' }, md.edit.root.map(function (f) { return field(m, f); }))]));
    (md.edit.lists || []).forEach(function (L) {
      var list = m[L.k] = m[L.k] || [];
      var p = el('div', { class: 'panel', 'data-list': L.k }, [el('h4', { text: L.title + ' (' + list.length + ')' })]);
      list.forEach(function (item, i) {
        p.appendChild(el('div', { class: 'meitem' }, [el('div', { class: 'merow' }, L.fields.map(function (f) { return field(item, f); })), el('div', { class: 'row', style: 'justify-content:flex-end' }, [
          i ? el('button', { class: 'btn sm', text: 'Move up', onclick: function () { list.splice(i - 1, 0, list.splice(i, 1)[0]); touch(); X.render(); } }) : null,
          el('button', { class: 'btn sm', text: 'Remove', onclick: function () { list.splice(i, 1); touch(); X.render(); } })])]));
      });
      p.appendChild(el('button', { class: 'btn sm', 'data-add': L.k, text: 'Add', onclick: function () { var it = L.blank(v); it.id = X.nid(L.k.slice(0, 1), list.concat(allIds(m))); list.push(it); touch(); X.render(); } }));
      main.appendChild(p);
    });
    main.appendChild(el('div', { class: 'row', style: 'margin-top:16px' }, [el('button', { class: 'btn solid', text: 'Save', onclick: save })]));
  }
  // ids are unique across a model's lists, so a barrier can point at a cause or a consequence
  function allIds(m) { var out = []; Object.keys(m).forEach(function (k) { if (Array.isArray(m[k])) m[k].forEach(function (x) { if (x && x.id) out.push({ id: x.id }); }); }); return out; }

  window.VTModel = { twinOf: twinOf, abmResults: function (v) { return scenResults(v, v.abm || {}); }, tolOf: function (v) { return tolOf(v); },
    init: function (x) { X = x; el = x.el; esc = x.esc; S = x.S; x.table = table; x.loops = loops; x.ALEVELS = ALEVELS; x.modelName = function (id) { var md = MODELS.filter(function (y) { return y.id === id; })[0]; return md ? md.name : id; }; },
    render: render, renderEdit: renderEdit, panel: function (main, id) { var md = MODELS.filter(function (x) { return x.id === id; })[0]; if (md) panelFor(md, main, false); }, models: MODELS,
    // exposed for checks
    _cuts: cuts, _loops: loops, _central: central, _sim: sim, _project: project, many: function (v, m, scen) { return many(v, m, scen); }, mesaSpec: function (v, m) { return mesaSpec(v, m); }
  };
})();
