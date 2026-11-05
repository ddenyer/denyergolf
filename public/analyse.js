// Diagnose: what has been found, read, counted or checked. Frame declares and guesses before the
// evidence; Diagnose holds the evidence. Views: the overview (the four forms), the sources, by level,
// by capital, by model, where the sources disagree, the dependants, the outside view, the frame
// tested, the eleven outcomes, and the evidence request.
(function () {
  'use strict';
  var X, el, esc, S, N, M;

  // Two parts: collecting the evidence, and analysing it.
  var GROUPS = [['c', 'Data collection', 'analyse'], ['a', 'Data analysis', 'tools']];
  var VIEWS = [['analyse', 'Evidence', 'c'], ['sources', 'Sources', 'c'], ['levels', 'By level', 'c'], ['capitals', 'By capital', 'c'], ['outside', 'The outside view', 'c'], ['models', 'By model', 'c'], ['outcomes', 'Is it enough?', 'c'], ['request', 'The evidence request', 'c'],
    ['tools', 'Analysis', 'a'], ['model', 'Maps of the system', 'a'], ['formulation', 'The formulation', 'a']];
  // The analysis tools open from the Tools page; they are not tabs of their own.
  var TOOLIDS = { rivals: 'rivals', people: 'people', futures: 'futures', goright: 'goright', disagree: 'disagree', dependants: 'dependants', frame: 'evframe', bia: 'bia', risk: 'risk', scentest: 'scentest', plans: 'plans', rca: 'rca', exlog: 'exlog', selfassess: 'selfassess', horizon: 'horizon', forcefield: 'forcefield', abm: 'abm', nots: 'nots', techmech: 'techmech', pace: 'pace', mvc: 'mvc', bcp: 'bcp', dr: 'dr', steer: 'steer', interrogate: 'interrogate', combos: 'combos' };
  var groupOf = function (v) { if (TOOLIDS[v]) return 'a'; var x = VIEWS.filter(function (y) { return y[0] === v; })[0]; return x ? x[2] : 'c'; };
  var L4 = [['institution', 'Institution', 'Government, regulators, professional bodies, the sector'], ['organisation', 'Organisation', 'The board, policy, budgets, structures'], ['team', 'Team', 'Wards, departments, functions and how they hand over'], ['person', 'Person', 'The individuals who do the work and what they know']];
  var CAPK = ['financial', 'manufactured', 'human', 'social', 'natural', 'information'];
  var VLV4 = { field: 'institution', org: 'organisation', team: 'team', act: 'person' };
  var ARRIVED = function (x) { return x.practice === 'request' ? 'The organisation, answering the request' : 'Added by the team'; };
  var fmtD = function (d) { if (!d) return ''; var x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  var content = function (k) { var r = X.row(k); return (r && r.content) || {}; };
  var props = function () { return S.data.proposals || []; };
  var tileG = function (k) { var t = (X.D.tiles || []).filter(function (x) { return x.id === k; })[0]; return t ? t.g : null; };
  var PARTN = { r: 'Reasons', s: 'The service', o: 'Stakeholders', h: 'How it works', q: 'The problem', e: 'Project' };

  // ---------- source tags: form, capitals, levels, read ----------
  function tagOf(x) {
    var c = content('evforms'), t = (c.map || {})[x.id];
    if (typeof t === 'string') t = { form: t };
    t = Object.assign({ caps: [], levels: [], read: false }, t || {});
    if (!t.form) t.form = N.formOf(x);
    return t;
  }
  async function setTag(x, patch) {
    var c = JSON.parse(JSON.stringify(content('evforms'))); c.map = c.map || {};
    c.map[x.id] = Object.assign(tagOf(x), patch);
    await X.saveRow('evforms', c, 'partly'); X.render();
  }
  function taken(x) { return props().filter(function (p) { return p.source_id === x.id && p.status === 'accepted'; }); }
  function partsOf(x) { var o = {}; props().filter(function (p) { return p.source_id === x.id && p.status !== 'rejected'; }).forEach(function (p) { var g = tileG(p.tile_key); if (g) o[g] = 1; }); return Object.keys(o); }
  function sources() { return (S.data.sources || []).slice().sort(function (a, b) { return String(a.source_date || a.created_at || '').localeCompare(String(b.source_date || b.created_at || '')); }); }

  // ---------- the page: tabs, then the view ----------
  function tabs(on) {
    var sub = document.getElementById('subtabs'); if (!sub) return;
    var g = groupOf(on === 'evidence' ? 'analyse' : on);
    Array.prototype.forEach.call(sub.querySelectorAll('button[data-g]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.g === g)); });
    Array.prototype.forEach.call(sub.querySelectorAll('button[data-in]'), function (b) { b.hidden = b.dataset.in !== g; b.setAttribute('aria-selected', String(b.dataset.v === on || (on === 'evidence' && b.dataset.v === 'analyse') || (TOOLIDS[on] && b.dataset.v === 'tools'))); });
  }
  function subtabsHtml() {
    return '<div class="sgroups" role="tablist" aria-label="Diagnose">' + GROUPS.map(function (g, i) { return '<button role="tab" class="sgrp" data-g="' + g[0] + '" data-v="' + g[2] + '" aria-selected="' + (i ? 'false' : 'true') + '">' + g[1] + '</button>'; }).join('') + '</div>'
      + VIEWS.filter(function (v) { return v[0] === 'model' ? sOn('model') : v[2] !== 'c' || sOn(vid(v[0])); }).map(function (v, i) { return '<button role="tab" data-in="' + v[2] + '" data-v="' + v[0] + '" aria-selected="' + (i ? 'false' : 'true') + '"' + (v[2] === 'c' ? '' : ' hidden') + '>' + v[1] + '</button>'; }).join('');
  }
  function render(main, view, key) {
    // a view switched off for this engagement: go to the first that is on
    var cv = VIEWS.filter(function (v) { return v[2] === 'c'; });
    if (cv.some(function (v) { return v[0] === view; }) && !sOn(vid(view))) { var first = cv.filter(function (v) { return sOn(vid(v[0])); })[0]; view = first ? first[0] : 'tools'; }
    if (TOOLIDS[view] && !EIDS[view] && !sOn(TOOLIDS[view])) view = 'tools';
    tabs(view);
    if (view === 'model') { if (!sOn('model')) return main.appendChild(el('p', { class: 'meta', style: 'margin-top:18px', text: 'The maps of the system are switched off for this engagement. Switch them on in Project, under What’s shown.' })); return M.render(main); }
    if (view === 'formulation') return renderFormulation(main);
    if (view === 'analyse') return N.renderAnalyse(main);
    if (view === 'tools') return renderTools(main);
    if (view === 'evidence') return N.renderEvidence(main, key);
    if (view === 'request') return N.renderRequest(main);
    if (view === 'sources') return renderSources(main, key);
    if (view === 'levels') return renderLevels(main);
    if (view === 'capitals') return renderCapitals(main);
    if (view === 'models') return renderModels(main);
    if (view === 'outcomes') return renderOutcomes(main);
    if (view === 'outside') { X.head(S.data.session.name || 'Diagnose', 'The outside view', null); return M.panel(main, 'outside'); }
    if (TOOLIDS[view] && !EIDS[view]) {
      var md = M.models.filter(function (x) { return x.id === TOOLIDS[view]; })[0];
      main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: '#tools', text: '← Tools' })]));
      X.head(S.data.session.name || 'Diagnose', md ? md.name : view, null);
      return M.panel(main, TOOLIDS[view]);
    }
  }

  // ---------- data analysis: the tools that work on the evidence ----------
  // Each tool opens its own screen. Tools with no screen yet are shown as prompts for a session, and say so.
  // Diagnose (29 October 2026): the analysis grouped under the formulation's two headings, in this order.
  // How it works comes first, and is not crowded out by the failure analysis. Each group: [name, tools, heading].
  // A tool with view: opens a view of Diagnose; with href: opens a page; otherwise its own screen.
  var TOOLS = [
    ['Protective: what goes right every day, and why', [
      { id: 'goright', n: 'What goes right', by: 'Work as it is really done', does: 'What goes right every day, how often, the everyday adjustments that make it go right, and the evidence. Things go right far more often than they go wrong, because people adjust their work to the conditions they meet. Capture this first.' }], 'How it works'],
    ['Predisposing: what made it vulnerable', [
      { id: 'nots', n: 'The conditions: the twelve nots', by: 'Twelve forms of failure, at four levels, with their social mechanisms', does: 'Not imagined, not searched for, not noticed, not told, not integrated, not understood, not owned, not willing, not able, not acted on, not corrected, not renewed: where each shows up, at which level, and what produced it. Always shown.' },
      { id: 'capitals', n: 'The six capitals', by: 'What the service runs on', does: 'What the evidence says about each of the six capitals the service draws on. A capital with no evidence is held on trust. Always shown.', view: 'capitals' },
      { id: 'levels', n: 'The levels', by: 'From the sector to the person', does: 'The evidence sorted by the level it speaks to. Failures usually cross levels; evidence all at one level usually means the others were not looked at.', view: 'levels' },
      { id: 'dependants', n: 'Profiling the dependants', by: 'Who is hurt, and how badly', does: 'For each group who depends on the service: what they would do if it stopped, whether the loss can be put back, and who the worst-off are.' }], 'How it fails'],
    ['Precipitating: what triggers failure', [
      { id: 'horizon', n: 'Horizon scan', by: 'Political, economic, social, technological, legal, environmental', does: 'Changes coming from outside, when they will arrive and what they would do to the service.' },
      { id: 'outside', n: 'Outside reports', by: 'Inquiries, inquests, regulators’ reports and research', does: 'What happened elsewhere, read for what it says about this service.', view: 'outside' },
      { id: 'isnot', n: 'Is and is not', by: 'Kepner and Tregoe', does: 'Where, when and for whom it happens, and where it does not: the edges of the problem.' }], 'How it fails'],
    ['Perpetuating: what keeps the problem going', [
      { id: 'rca', n: 'Root cause analysis', by: 'Fishbone and asking why', does: 'One incident taken apart: contributing causes under six headings, and the chain of "why?" beneath it.' },
      { id: 'techmech', n: 'The mechanisms', by: 'Stocks, flows and feedback, by the six capitals', does: 'Buffer, redundancy, flexibility, variety, options; connectivity, centrality, coupling, modularity; balancing and reinforcing feedback, delay. Each judged too little, about right or too much, for each capital. Always shown.' },
      { id: 'people', n: 'Capability, load and competing commitments', by: 'The people side of the change', does: 'For each group the change depends on: what it asks of them, whether they could do it if they had to, what they already carry, and what they are protecting. An absent capability looks like resistance.' },
      { id: 'disagree', n: 'Differing accounts', by: 'Where the sources disagree', does: 'Set two accounts of the same thing side by side, never merged, with what practice has quietly chosen.' },
      { id: 'howsaid', n: 'How it was said', by: 'Readings of the sources', does: 'How sure people sound, what they take for granted, who acts, and what is offered as the answer.' }], 'How it fails'],
    ['Rival explanations: what else could explain it', [
      { id: 'rivals', n: 'Rival explanations', by: 'Ranked by the evidence each explains', does: 'Every explanation that could account for it, ranked by how much of the evidence it explains, with what else we would see if it were true. The one that would be serious if missed is kept open.' },
      { id: 'combos', n: 'Combinations across cases', by: 'Combinational Regularity Analysis (CORA)', does: 'Several cases side by side, each marked for which conditions were present. Finds the smallest combinations of conditions that are enough, together, for the outcome, allowing for more than one route to it.' },
      { id: 'futures', n: 'Futures letters (optional)', by: 'If it failed, and if it worked', does: 'Each person alone writes the opening of the inquiry report after it failed, and a thank-you letter after it worked, each with what would show it to be wrong.' }], 'How it fails'],
    ['What Frame declared, against what the evidence shows', [
      { id: 'frame', n: 'Testing the frame', by: 'Declared against found', does: 'Set what Frame declared against what the evidence shows, and send questions back where they differ.' }], 'Checking the frame against the evidence']];
  // Model: designed and tested offline, in the model, under pressure (the alpha test).
  var MTOOLS = [
    ['The model, run forward', [
      { id: 'tharm', n: 'More throughput, no intolerable harm', by: 'Which changes give more throughput without crossing the threshold?', does: 'A flow model run hour by hour. Each candidate change is run through every severe but plausible scenario and placed on one chart: gain in throughput against worst harm as a share of the intolerable threshold. Social conditions, such as not noticed, enter as delays.', href: '#tharm' },
      { id: 'cmap', n: 'The connected map', by: 'One map, over time and by level, with layers revealed one at a time', does: 'The service drawn once and unfolded from decades to minutes across the six phases of an event, opened level by level (Beer), with buttons to reveal the route of the event, the threshold and barriers, the twelve nots, the technical mechanisms, single points, and each kind of flow.', href: '#cmap' },
      { id: 'abm', n: 'Agent-based model', by: 'The map run over time, many times, on numbers from data where there are any', does: 'Work arrives, passes through the processes and waits when a resource is down; resources fail and recover as the calibration says. Run it once to watch a week, or many times to see how often the impact tolerance is breached.' }]]];
  // Test: tried in use, live, in this service, by the people who run it (the beta test, stage 3).
  var TTOOLS = [
    ['Testing the model (alpha): the changes tried in the model', [
      { id: 'scentest', n: 'Scenario testing', by: 'Against the impact tolerance', does: 'Severe but plausible scenarios run against the tolerance: does the service stay within it, and what breaks first?' },
      { id: 'bia', n: 'Impact analysis', by: 'Business impact analysis: harm over time, and recovery targets', does: 'How fast the harm grows if each process stops, the longest disruption that could be tolerated, and whether the recovery targets are possible given what the process rests on.' },
      { id: 'risk', n: 'Risk assessment', by: 'Likelihood and impact, before and after controls', does: 'A register of risks to the service, scored and drawn as a heat map, with the organisation’s own register read alongside.' }]],
    ['Tests of disruption, in the model', [
      { id: 'mvc', n: 'The minimum viable company', by: 'Can the organisation run as a minimum viable company?', does: 'If everything stops: the least that keeps the people it serves within the threshold, how long it lasts on what it holds, and whether each part comes back before the threshold is crossed.' },
      { id: 'bcp', n: 'Business continuity plan', by: 'Drawn from the model, process by process', does: 'The longest disruption each process can take, how it carries on meanwhile, and whether the workaround shares the failure.' },
      { id: 'dr', n: 'Disaster recovery plan', by: 'The technology, and how it comes back', does: 'Target times to restore against what happened last time, and whether the backup sits apart.' }]],
    ['Plans and exercises', [
      { id: 'plans', n: 'Review of existing plans', by: 'Continuity, recovery and incident plans', does: 'The organisation’s own plans read against the model: believable recovery times, people still in post, when last tested.' },
      { id: 'exlog', n: 'Exercise and test log', by: 'Evidence that the plans work', does: 'Every exercise, test and real use of a plan, what failed, and what was done about it.' },
      { id: 'selfassess', n: 'Self-assessment against a standard', by: 'Clause by clause', does: 'The organisation scored against a chosen standard or set of rules, with the evidence for each score and the gap.' }]],
    ['What the change leaves behind', [
      { id: 'pace', n: 'Purpose, Awareness, Coordination and Engagement', by: 'The four outcomes the change should improve', does: 'What the change should leave behind in the organisation: sixteen core tasks, each scored now and as expected after the change, with the evidence.' },
      { id: 'steer', n: 'Measures that give warning in time', by: 'Warning against the time to act', does: 'Whether each measure shows trouble sooner than it takes to act, and the half-life of what wears away, which sets the review date.' },
      { id: 'forcefield', n: 'Force field', by: 'Lewin', does: 'What drives change and what holds things as they are, each scored, with where it came from.' }]]];
  var ETOOLS = MTOOLS.concat(TTOOLS);
  var STEPOF = {}; MTOOLS.forEach(function (g) { g[1].forEach(function (t) { STEPOF[t.id] = 'model'; }); }); TTOOLS.forEach(function (g) { g[1].forEach(function (t) { STEPOF[t.id] = 'test'; }); });
  var EIDS = { mvc: 1, bcp: 1, dr: 1, steer: 1, interrogate: 1, tharm: 1, cmap: 1, abm: 1, bia: 1, risk: 1, scentest: 1, plans: 1, exlog: 1, selfassess: 1, forcefield: 1, pace: 1 };
  var sOn = function (id) { return !window.VTScope || window.VTScope.on(id); };
  var vid = function (v) { return v === 'outside' ? 'outside' : 'v.' + v; };
  var toolOn = function (t) { return t.view ? sOn(vid(t.view)) : t.id === 'cmap' || t.id === 'tharm' ? sOn(t.id) : t.href ? sOn('model') : sOn(TOOLIDS[t.id] || EIDS[t.id] && t.id || 't.' + t.id); };
  function toolGrid(main, list) {
    var orig = list.map(function (g) { return g; }).filter(function (g) { return g[1].filter(toolOn).length; });
    list = list.map(function (g) { return [g[0], g[1].filter(toolOn)]; }).filter(function (g) { return g[1].length; });
    if (!list.length) main.appendChild(el('p', { class: 'meta', style: 'margin-top:18px', text: 'None of these tools is switched on for this engagement. Switch them on in Project, under What’s included.' }));
    var lastHead = null;
    list.forEach(function (grp, gi) {
      var hd = (orig[gi] || [])[2];
      if (hd && hd !== lastHead) { main.appendChild(el('h2', { class: 'fmhead', 'data-heading': hd, text: hd })); lastHead = hd; }
      main.appendChild(el('h3', { style: 'margin:' + (hd ? '12px' : '26px') + ' 0 10px', text: grp[0] }));
      var grid = el('div', { class: 'tkgrid' });
      grp[1].forEach(function (t) {
        var md = TOOLIDS[t.id] ? M.models.filter(function (x) { return x.id === TOOLIDS[t.id]; })[0] : null, v = X.invData(), used = md && md.key && v[md.key] && !md.empty(v, v[md.key]); if (t.id === 'cmap' || t.id === 'tharm') { var cr = X.row(t.id); used = !!(cr && cr.content && (cr.content.map || cr.content.model)); }
        var open = t.view ? el('a', { class: 'btn sm solid', href: '#' + t.view, text: 'Open' }) : t.href ? el('a', { class: 'btn sm solid', href: t.href, text: 'Open' }) : TOOLIDS[t.id] ? el('a', { class: 'btn sm solid', href: '#' + t.id, text: 'Open' }) : el('span', { class: 'muted sm', text: 'Not built yet. For now, use the question in a session.' });
        grid.appendChild(el('div', { class: 'glass tool' + (t.view || t.href || TOOLIDS[t.id] ? '' : ' soon'), 'data-tool': t.id }, [el('div', { class: 'spread' }, [el('h4', { text: t.n }), used ? el('span', { class: 'pill ok', text: 'In use' }) : null]), el('div', { class: 'muted sm', text: t.by }), el('p', { class: 'sm', style: 'margin:10px 0 12px', text: t.does }), open]));
      });
      main.appendChild(grid);
    });
  }
  function renderEvaluate(main, view, step) {
    step = step || 'model';
    var STEPN = step === 'test' ? 'Test' : 'Model';
    document.body.classList.toggle('cm-wide', view === 'cmap' || view === 'tharm' || view === 'evidence');
    // a tool that belongs to the other step opens there
    if (STEPOF[view] && STEPOF[view] !== step) { location.replace('/' + STEPOF[view] + location.search + '#' + view); return; }
    if (view === 'evidence' && window.VTEvidence) return window.VTEvidence.render(main, X);
    if ((view === 'props' || view === 'handon') && window.VTProps) return window.VTProps.render(main, X, view === 'handon' ? 'handon' : 'list');
    if (view === 'beta' && window.VTBeta) return window.VTBeta.render(main, X);
    if (view === 'cmap' && sOn('cmap') && window.VTCMap) return window.VTCMap.render(main, X);
    if (view === 'tharm' && sOn('tharm') && window.VTTharm) {
      main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: '#tools', text: '← Model' })]));
      X.head(S.data.session.name || 'Model', 'More throughput, no intolerable harm', null);
      return window.VTTharm.render(main, X);
    }
    if (EIDS[view] && sOn(view)) {
      var md = M.models.filter(function (x) { return x.id === view; })[0];
      main.appendChild(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: '#tools', text: '← ' + STEPN })]));
      X.head(S.data.session.name || STEPN, md ? md.name : view, null);
      return M.panel(main, view);
    }
    if (step === 'test') {
      X.head(S.data.session.name || 'Test', 'Test', null);
      main.appendChild(el('p', { class: 'lead', text: 'Do the changes work in use, for the people who run the service? Test is the trial in the organisation (beta): the design propositions tried live, in this service, by the people who run it, and compared with what the model predicted. The trial in the organisation has its own tab; these tools hold the plans, the exercises and the outcomes the change should improve.' }));
      main.appendChild(el('p', {}, [el('a', { class: 'btn solid', href: '#beta', text: 'Open the trial in the organisation (beta)' })]));
      return toolGrid(main, TTOOLS);
    }
    X.head(S.data.session.name || 'Model', 'Model', null);
    // David's line, set as a short lead in Newsreader (moved here from Evaluate, 29 October 2026)
    main.appendChild(el('p', { class: 'evdrift', text: 'No organisation should discover how it could drift into a crisis by having one.' }));
    main.appendChild(el('p', { class: 'lead', text: 'What changes would make the service work better and fail better, and do they hold up under pressure? Build a model of the flow and run it forward under severe but plausible scenarios, against the tolerances. The design propositions are designed here and tested in the model (alpha), by the design team.' }));
    toolGrid(main, MTOOLS);
  }
  // on the beta test's page, until stage 3: the propositions Model has handed on
  function readyList(main) {
    var P = window.VTProps; if (!P) return;
    var xs = P.items().filter(function (p) { return p.status === 'ready'; });
    main.appendChild(el('h3', { style: 'margin:24px 0 8px', text: 'Ready to try in use, from Model' }));
    if (!xs.length) return main.appendChild(el('p', { class: 'meta', id: 'betaNone', text: 'No design proposition is marked ready to try in use yet.' }));
    main.appendChild(el('ul', { class: 'tl', id: 'betaReady' }, xs.map(function (p) { return el('li', {}, [el('b', { text: P.label(p) + ' ' + p.n }), document.createTextNode((p.alpha && p.alpha.holds ? '. Holds when: ' + p.alpha.holds : ''))]); })));
  }
  // a clear, empty place for what comes in stages 2 and 3
  function renderPlace(main, stepName, title, text, links) {
    X.head(S.data.session.name || stepName, title, null);
    main.appendChild(el('div', { class: 'glass evbox placebox', 'data-place': title }, [el('span', { class: 'pill', text: 'Not built yet' }), el('p', { style: 'margin:10px 0 0', text: text }),
      el('div', { class: 'row', style: 'margin-top:14px' }, links.map(function (l) { return el('a', { class: 'btn sm', href: l[1], text: l[0] }); }))]));
  }
  function renderTools(main) {
    X.head(S.data.session.name || 'Diagnose', 'Data analysis', 'How does this system work and fail now, and why? The analysis is grouped under the two headings of the formulation: how it works, then how it fails. Start with how it works. Each tool opens its own screen, with its own editor and export. The summary is on The formulation tab.');
    toolGrid(main, TOOLS);
  }



  // ---------- sources: the repository ----------
  function renderSources(main, part) {
    var F = S.srcFilter = S.srcFilter || {}; if (part && S.srcFrom !== location.hash) { F.part = part; S.srcFrom = location.hash; }
    X.head(S.data.session.name || 'Diagnose', 'Sources', 'Everything gathered for the engagement: transcripts, documents, notes and the organisation’s answers to the evidence request. Sources belong to the whole engagement, and are kept as they arrived, never edited. Tag each with its form of evidence, the capitals it tells us about and the levels it speaks to; the other views are built from these tags.');
    var waiting = props().filter(function (p) { return p.status === 'waiting'; }).length;
    main.appendChild(el('div', { class: 'row no-print', style: 'margin-top:14px' }, [el('a', { class: 'btn sm', href: '/frame#guide=r', text: 'First-call guide' }), el('a', { class: 'btn sm' + (waiting ? ' warm' : ''), id: 'toReview', href: '/frame#review', text: waiting ? 'Review ' + waiting + (waiting === 1 ? ' entry' : ' entries') + ' taken into Frame' : 'Nothing to review' })]));
    if (X.sourcesBox) main.appendChild(X.sourcesBox(true));
    var all = sources();
    var sel = function (k, opts, lab) { var s2 = el('select', { 'data-filter': k, 'aria-label': lab }, [el('option', { value: '', text: lab })].concat(opts.map(function (o) { return el('option', { value: o[0], text: o[1] }); }))); s2.value = F[k] || ''; s2.onchange = function () { F[k] = s2.value; X.render(); }; return s2; };
    var search = el('input', { type: 'search', id: 'srcSearch', placeholder: 'Search titles and text', value: F.q || '' });
    search.addEventListener('change', function () { F.q = search.value; X.render(); });
    var KINDS = { transcript: 'Transcript', document: 'Document', notes: 'Team notes', recording: 'Recording', image: 'Photo' };
    main.appendChild(el('div', { class: 'row srcfilters no-print', style: 'margin-top:16px' }, [search,
      sel('kind', Object.keys(KINDS).map(function (k) { return [k, KINDS[k]]; }), 'Any kind'),
      sel('form', Object.keys(N.FORMS).map(function (k) { return [k, N.FORMS[k][0]]; }), 'Any form'),
      sel('part', Object.keys(PARTN).map(function (k) { return [k, 'Used in ' + PARTN[k]]; }), 'Any part of Frame'),
      sel('level', L4.map(function (l) { return [l[0], l[1]]; }), 'Any level'),
      sel('cap', CAPK.map(function (k) { return [k, X.CAPS[k][0]]; }), 'Any capital'),
      sel('read', [['yes', 'Read'], ['no', 'Not yet read']], 'Read or not'),
      el('button', { class: 'btn sm', text: 'Clear', onclick: function () { S.srcFilter = {}; X.render(); } })]));
    var rows = all.filter(function (x) {
      var t = tagOf(x);
      if (F.kind && x.kind !== F.kind) return false;
      if (F.form && t.form !== F.form) return false;
      if (F.part && partsOf(x).indexOf(F.part) < 0) return false;
      if (F.level && t.levels.indexOf(F.level) < 0) return false;
      if (F.cap && t.caps.indexOf(F.cap) < 0) return false;
      if (F.read && (F.read === 'yes') !== !!t.read) return false;
      if (F.q && (x.title + ' ' + (x.body || '') + ' ' + (x.speaker || '')).toLowerCase().indexOf(F.q.toLowerCase()) < 0) return false;
      return true;
    });
    main.appendChild(el('p', { class: 'meta', id: 'srcCount', text: rows.length + ' of ' + all.length + (all.length === 1 ? ' source' : ' sources') + (F.part ? ', used in ' + PARTN[F.part] : '') }));
    var tb = el('table', { class: 'itab srcrepo' });
    tb.appendChild(el('thead', {}, [el('tr', {}, ['Source', 'Kind', 'From', 'Date', 'How it arrived', 'Form', 'Capitals', 'Levels', 'Entries taken', 'Read'].map(function (h) { return el('th', { text: h }); }))]));
    var body = el('tbody');
    rows.forEach(function (x) {
      var t = tagOf(x), n = taken(x).length;
      var fsel = el('select', { 'data-tag': 'form', 'aria-label': 'Form of evidence' }, Object.keys(N.FORMS).map(function (k) { return el('option', { value: k, text: N.FORMS[k][0] }); })); fsel.value = t.form;
      fsel.onchange = function () { setTag(x, { form: fsel.value }); };
      var chips = function (list, all2, key, word) { return el('div', { class: 'tagchips' }, all2.map(function (o) { var on = list.indexOf(o[0]) >= 0; return el('button', { class: 'tchip' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-tag': key + ':' + o[0], title: word + ': ' + o[1], text: o[1], onclick: function () { var nl = on ? list.filter(function (y) { return y !== o[0]; }) : list.concat([o[0]]); var pt = {}; pt[key] = nl; setTag(x, pt); } }); })); };
      var rd = el('input', { type: 'checkbox', 'data-tag': 'read', 'aria-label': 'Read' }); rd.checked = !!t.read; rd.onchange = function () { setTag(x, { read: rd.checked }); };
      body.appendChild(el('tr', { class: 'srcrow', 'data-source': x.id }, [
        el('td', {}, [el('a', { href: '#source=' + x.id, text: x.title })]), el('td', { text: KINDS[x.kind] || x.kind }), el('td', { text: [x.speaker, x.role].filter(Boolean).join(', ') }), el('td', { text: fmtD(x.source_date) }), el('td', { text: ARRIVED(x) }),
        el('td', {}, [fsel]), el('td', {}, [chips(t.caps, CAPK.map(function (k) { return [k, X.CAPS[k][0]]; }), 'caps', 'Capital')]), el('td', {}, [chips(t.levels, L4.map(function (l) { return [l[0], l[1]]; }), 'levels', 'Level')]),
        el('td', { text: n ? String(n) + (partsOf(x).length ? ' (' + partsOf(x).map(function (g) { return PARTN[g]; }).join(', ') + ')' : '') : 'None' }), el('td', {}, [rd])]));
    });
    tb.appendChild(body);
    main.appendChild(el('div', { class: 'dscroll' }, [tb]));
    if (!rows.length) main.appendChild(el('p', { class: 'meta', text: all.length ? 'No source matches these filters.' : 'No sources yet.' }));
  }

  // ---------- by level: institution, organisation, team, person ----------
  function renderLevels(main) {
    X.head(S.data.session.name || 'Diagnose', 'By level', 'The evidence sorted by the level it speaks to: the institution, the organisation, the team and the person. Failures usually cross levels; evidence that sits all at one level usually means the others were not looked at. An empty band is a finding, not a gap to hide.');
    var v = X.invData(), am = (v.accimap || {}).factors || [], fns = (v.vsm || {}).fns || [], srcs = sources();
    var bands = L4.map(function (l) {
      var ss = srcs.filter(function (x) { return tagOf(x).levels.indexOf(l[0]) >= 0; });
      var en = am.filter(function (f) { return f.l4 === l[0]; }).map(function (f) { return ['AcciMap', f.n]; }).concat(fns.filter(function (f) { return VLV4[f.lvl] === l[0]; }).map(function (f) { return ['Viable system model', (f.who || 'Nobody') + ' (' + f.f.toUpperCase().replace('S3S', 'S3*') + ')']; }));
      return { l: l, ss: ss, en: en };
    });
    var tot = bands.reduce(function (a, b) { return a + b.ss.length + b.en.length; }, 0), top = bands.slice().sort(function (a, b) { return (b.ss.length + b.en.length) - (a.ss.length + a.en.length); })[0];
    if (tot && (top.ss.length + top.en.length) / tot > 0.6) main.appendChild(el('div', { class: 'glass evbox warnbox', id: 'lvlSkew', text: 'Most of the evidence (' + Math.round(100 * (top.ss.length + top.en.length) / tot) + '%) sits at one level: ' + top.l[1].toLowerCase() + '. Look for what the other levels would show before drawing conclusions.' }));
    bands.forEach(function (b) {
      var counts = {}; Object.keys(N.FORMS).forEach(function (f) { counts[f] = 0; }); b.ss.forEach(function (x) { counts[tagOf(x).form]++; });
      var box = el('div', { class: 'glass evbox lband' + (b.ss.length + b.en.length ? '' : ' empty'), 'data-level': b.l[0] }, [el('div', { class: 'spread' }, [el('div', {}, [el('div', { class: 'flab', text: b.l[1] }), el('div', { class: 'muted sm', text: b.l[2] })]), el('div', { class: 'muted sm', text: Object.keys(N.FORMS).map(function (f) { return N.FORMS[f][0].split(' ')[0] + ' ' + counts[f]; }).join('  ·  ') })])]);
      if (!b.ss.length && !b.en.length) box.appendChild(el('p', { class: 'meta', text: 'Nothing at this level yet. Record this as a finding if it was looked for and not found; otherwise it is the next place to look.' }));
      if (b.ss.length) box.appendChild(el('ul', { class: 'tl' }, b.ss.map(function (x) { return el('li', {}, [el('a', { href: '#source=' + x.id, text: x.title }), el('span', { class: 'muted sm', text: '  ' + N.FORMS[tagOf(x).form][0] })]); })));
      if (b.en.length) box.appendChild(el('ul', { class: 'tl' }, b.en.map(function (e) { return el('li', {}, [el('span', { class: 'muted sm', text: e[0] + ': ' }), document.createTextNode(e[1])]); })));
      main.appendChild(box);
    });
    main.appendChild(el('p', { class: 'meta', text: 'Sources are placed by their tags (on the Sources tab). Entries come from the AcciMap (its "level on the four") and the viable system model (each function’s level).' }));
  }

  // ---------- by capital ----------
  function renderCapitals(main) {
    X.head(S.data.session.name || 'Diagnose', 'By capital', 'What the evidence tells us about each of the six capitals the service draws on, by form of evidence, with how many resources in the model carry each capital. A capital with resources but no evidence is held on trust.');
    var srcs = sources(), res = (X.invData().resources || []), c = content('evforms'), said = c.capitals || {}, SK = { financial: 'fin', manufactured: 'man', human: 'hum', social: 'soc', information: 'inf' };
    var capsOfR = function (r) { var D2 = { people: ['human'], tech: ['manufactured', 'information'], fac: ['manufactured'], info: ['information'], third: [], other: [] }; return r.cap && r.cap.length ? r.cap : (D2[r.t] || []); };
    var tb = el('table', { class: 'itab capgrid' });
    tb.appendChild(el('thead', {}, [el('tr', {}, ['Capital'].concat(Object.keys(N.FORMS).map(function (f) { return N.FORMS[f][0]; })).concat(['Resources in the model', 'What the team holds']).map(function (h) { return el('th', { text: h }); }))]));
    var b = el('tbody');
    CAPK.forEach(function (k) {
      var nres = res.filter(function (r) { return capsOfR(r).indexOf(k) >= 0; }).length, any = 0;
      var cells = Object.keys(N.FORMS).map(function (f) { var n = srcs.filter(function (x) { var t = tagOf(x); return t.form === f && t.caps.indexOf(k) >= 0; }).length; any += n; return el('td', { class: n ? 'have' : 'none', text: String(n) }); });
      var held = k === 'natural' ? (c.natural || '') : (said[SK[k]] || '');
      b.appendChild(el('tr', { 'data-cap': k, class: nres && !any && !held ? 'sp' : '' }, [el('td', {}, [el('i', { class: 'capdot', style: 'background:' + X.CAPS[k][1] }), document.createTextNode(' ' + X.CAPS[k][0])])].concat(cells).concat([el('td', { text: String(nres) }), el('td', { class: 'sm', text: held || (nres ? 'Nothing recorded: held on trust' : '') + (k === 'natural' && !held ? ' Usually from public sources: weather, seasons, the site.' : '') })])));
    });
    tb.appendChild(b); main.appendChild(el('div', { class: 'dscroll' }, [tb]));
    main.appendChild(el('p', { class: 'meta', text: 'Counts are of sources tagged with each capital on the Sources tab. "What the team holds" is recorded with the capitals requirement in each model’s needs list.' }));
  }

  // ---------- by model ----------
  function renderModels(main) {
    var lv = N.level();
    X.head(S.data.session.name || 'Diagnose', 'By model', 'For each model, and each record kept here, the depth the evidence supports now against the depth of the engagement (' + lv + '), and what is most short.');
    var rows = M.models.filter(function (md) { return md.practice !== 'evaluate'; }).map(function (md) {
      var r = N.readiness(md.id), miss = N.forModel(md.id, lv).filter(function (c) { return c.state === 'miss' || c.state === 'part'; });
      return { md: md, top: r.top, miss: miss };
    });
    var tb = el('table', { class: 'itab bymodel' });
    tb.appendChild(el('thead', {}, [el('tr', {}, ['Model or record', 'Supported depth', 'Engagement depth', 'Short at this depth', 'Most short', ''].map(function (h) { return el('th', { text: h }); }))]));
    var b = el('tbody');
    rows.forEach(function (x) {
      var href = x.md.practice === 'evaluate' ? '/evaluate#' + x.md.id : x.md.hidden ? '#' + x.md.hidden : '#model=' + x.md.id;
      b.appendChild(el('tr', { 'data-model': x.md.id, class: x.top < lv ? 'short' : '' }, [el('td', { text: x.md.name }), el('td', {}, [el('span', { class: 'dpill d' + x.top, text: x.top ? String(x.top) : 'None yet' })]), el('td', { text: String(lv) }), el('td', { text: String(x.miss.length) }),
        el('td', { class: 'sm', text: x.miss.slice(0, 2).map(function (c) { return c.req.label; }).join('; ') }), el('td', {}, [el('a', { class: 'btn sm', href: href, text: 'Open' })])]));
    });
    tb.appendChild(b); main.appendChild(el('div', { class: 'dscroll' }, [tb]));
  }

  // ---------- the eleven outcomes, with what serves each ----------
  function renderOutcomes(main) {
    X.head(S.data.session.name || 'Diagnose', 'Is it good enough?', 'The eleven outcomes of Diagnose, at depth ' + N.level() + '. Each is met when everything it needs is in, or recorded as not held.');
    main.appendChild(N.outcomesBox());
    var cs = N.all();
    N.OUTCOMES.forEach(function (o, i) {
      var mine = cs.filter(function (c) { return c.req.out === i + 1 && c.state !== 'na'; }); if (!mine.length) return;
      main.appendChild(el('div', { class: 'glass evbox', 'data-out': String(i + 1) }, [el('div', { class: 'flab', text: (i + 1) + '. ' + o }), el('ul', { class: 'tl' }, mine.map(function (c) { return el('li', {}, [el('i', { class: 'nd ' + c.state }), document.createTextNode(' ' + c.req.label), el('span', { class: 'muted sm', text: '  ' + c.req.models.map(X.modelName).join(', ') })]); }))]));
    });
  }

  // ---------- the formulation: what Diagnose hands on to Model ----------
  // Two headings and four sub-headings. Each entry is read from the record it was written in, with its evidence
  // (linked to the source when the evidence names one) and a link to the record. Nothing is typed twice.
  var FORM = [
    ['How it works', 'Protective', 'What goes right every day, and why, looking at work as it is really done.', [
      ['goright', ['What goes right', 'Why'], null],
      ['techmech', ['Mechanism', 'Capital', 'What was found'], function (r, h) { return r[h.indexOf('Balance')] === 'About right'; }]]],
    ['How it fails', 'Predisposing', 'What made the system vulnerable: the conditions, the capitals, the levels and the dependants.', [
      ['nots', ['Not', 'Level', 'What was found'], null],
      ['dependants', ['Group', 'If it stopped'], null]]],
    ['How it fails', 'Precipitating', 'What triggers failure: changes coming from outside, what happened elsewhere, and incidents.', [
      ['horizon', ['Change', 'When', 'Effect'], null],
      ['outside', ['Title', 'What it says'], null, 'Kind'],
      ['rca', ['The incident'], 'incident']]],
    ['How it fails', 'Perpetuating', 'What keeps the problem going: the causes beneath it, the mechanisms, and differing accounts.', [
      ['rca', ['Cause', 'Because'], null],
      ['techmech', ['Mechanism', 'Capital', 'Balance', 'What was found'], function (r, h) { var b = r[h.indexOf('Balance')]; return b === 'Too little' || b === 'Too much'; }],
      ['disagree', ['About', 'What practice has chosen'], null]]]];
  function formEntries(spec) {
    var md = M.models.filter(function (x) { return x.id === spec[0]; })[0]; if (!md || !md.registers) return [];
    var v = X.invData(), m = v[md.key] || {};
    if (spec[2] === 'incident') return m.incident ? [{ md: md, text: 'The incident: ' + m.incident + (m.when ? ' (' + m.when + ')' : ''), ev: '' }] : [];
    var out = [];
    (md.registers(v, m) || []).forEach(function (reg) {
      var h = reg.head || [], cols = spec[1].map(function (c) { return h.indexOf(c); }).filter(function (i) { return i >= 0; });
      if (!cols.length) return;
      var evi = -1; h.forEach(function (c, i) { if (spec[3] ? c === spec[3] : (c === 'Source' || c === 'Evidence')) evi = i; });
      (reg.rows || []).forEach(function (r) {
        if (typeof spec[2] === 'function' && !spec[2](r, h)) return;
        var parts = cols.map(function (i) { return r[i] == null ? '' : String(r[i]).trim(); }).filter(Boolean); if (!parts.length) return;
        out.push({ md: md, text: parts[0] + (parts.length > 1 ? ': ' + parts.slice(1).join(', ') : ''), ev: evi >= 0 && r[evi] ? String(r[evi]) + (spec[3] && h.indexOf('Published') >= 0 && r[h.indexOf('Published')] ? ', ' + r[h.indexOf('Published')] : '') : '' });
      });
    });
    return out;
  }
  function evLink(t) {
    if (!t) return el('span', { class: 'fmnoev', text: 'No evidence recorded' });
    var lt = t.toLowerCase(), hit = sources().filter(function (x) { var tt = String(x.title || '').toLowerCase(); return tt && (lt.indexOf(tt) >= 0 || tt.indexOf(lt) >= 0); })[0];
    return hit ? el('a', { href: '#source=' + hit.id, text: t }) : el('span', { text: t });
  }
  function renderFormulation(main) {
    X.head(S.data.session.name || 'Diagnose', 'The formulation', 'How this system works and how it fails, and why. It always starts with how it works. Each entry comes from the record it was written in, with its evidence. This is what Diagnose hands on to Model, where each design proposition points back to the heading it answers.');
    var backs = window.VTProps ? window.VTProps.items().filter(function (p) { return p.back && p.back.to === 'diagnose'; }) : [];
    if (backs.length) main.appendChild(el('div', { class: 'glass evbox warnbox', id: 'fmBack', style: 'margin-top:14px' }, [el('b', { text: 'Sent back from Test: the formulation may have missed something' }), el('ul', { class: 'tl sm', style: 'margin:6px 0 0' }, backs.map(function (p) { return el('li', { text: window.VTProps.label(p) + ' ' + p.n + ': ' + (p.back.learnt || '') + (p.back.ask ? ' We now need to ask: ' + p.back.ask : '') }); }))]));
    // assumptions from Frame not yet checked: Diagnose tests them (30 October 2026)
    var fa = ((X.row('frame') || {}).content || {}).answers || {}, asm = (fa.assume && fa.assume.items) || [], un = asm.filter(function (x) { return !x.mark || x.mark === 'unchecked'; });   // Not tested yet; Holds and Does not hold are settled
    if (!asm.length && fa.assume && fa.assume.fields && String(fa.assume.fields.text || '').trim()) un = [{ t: String(fa.assume.fields.text).trim() }];
    if (un.length) main.appendChild(el('div', { class: 'glass evbox', id: 'fmAssume', style: 'margin-top:14px' }, [el('div', { class: 'spread' }, [el('div', { class: 'flab', text: 'Assumptions from Frame, still to test' }), el('a', { class: 'btn sm', href: '/frame' + location.search + '#work', text: 'Open in Frame' })]),
      el('p', { class: 'muted sm', style: 'margin:4px 0 8px', text: 'What the evidence shows about each one belongs below. When one is shown to be sound, or wrong, mark it in Frame.' }),
      el('ul', { class: 'tl' }, un.map(function (x) { return el('li', { text: 'We are assuming that ' + String(x.t).replace(/^we are assuming that\s*/i, '') }); }))]));
    var lastHead = null, total = 0;
    FORM.forEach(function (f) {
      if (f[0] !== lastHead) { main.appendChild(el('h2', { class: 'fmhead', 'data-heading': f[0], text: f[0] })); lastHead = f[0]; }
      var es = []; f[3].forEach(function (spec) { if (!toolOn({ id: spec[0] })) return; es = es.concat(formEntries(spec)); });
      total += es.length;
      var box = el('div', { class: 'glass evbox fmbox', 'data-sub': f[1].toLowerCase() }, [el('div', { class: 'spread' }, [el('div', { class: 'flab', text: f[1] }), el('span', { class: 'muted sm', text: es.length + (es.length === 1 ? ' entry' : ' entries') })]), el('p', { class: 'muted sm', style: 'margin:4px 0 8px', text: f[2] })]);
      if (!es.length) box.appendChild(el('p', { class: 'meta', text: f[1] === 'Protective' ? 'Nothing recorded yet. Start here: open What goes right and record what goes right every day, and why.' : 'Nothing recorded yet under this heading.' }));
      else box.appendChild(el('ul', { class: 'tl fmlist' }, es.map(function (e) {
        var ans = window.VTProps ? window.VTProps.forEntry(f[1].toLowerCase(), e.md.id, e.text) : [];
        return el('li', {}, [el('span', { text: e.text }), el('span', { class: 'fmev muted sm' }, [document.createTextNode('Evidence: '), evLink(e.ev), document.createTextNode(' · '), el('a', { href: '#' + (e.md.hidden || ('model=' + e.md.id)), text: e.md.name })]),
          ans.length ? el('span', { class: 'fmans sm' }, [document.createTextNode('Answered by '), el('a', { href: '/model' + location.search + '#props', text: ans.map(function (p) { return window.VTProps.label(p) + ' ' + p.n; }).join('; ') })]) : null]); })));
      var whole = window.VTProps ? window.VTProps.forEntry(f[1].toLowerCase(), '', '') : [];
      if (whole.length) box.appendChild(el('p', { class: 'fmans sm', text: 'Answering the heading as a whole: ' + whole.map(function (p) { return window.VTProps.label(p) + ' ' + p.n; }).join('; ') }));
      main.appendChild(box);
    });
    if (!total) main.appendChild(el('p', { class: 'meta', text: 'The formulation fills as the analysis is done. Each heading lists what has been recorded in the tools under it on the Analysis tab.' }));
  }

  // the tools switched on for this project, and whether each has work in it, for the "Where we are" page
  function status() {
    var out = [];
    [['analyse', TOOLS, '/diagnose'], ['model', MTOOLS, '/model'], ['test', TTOOLS, '/test']].forEach(function (pr) {
      pr[1].forEach(function (grp) {
        grp[1].filter(toolOn).forEach(function (t) {
          var built = !!(t.href || TOOLIDS[t.id] || EIDS[t.id]); if (!built || t.view) return;
          var md = TOOLIDS[t.id] ? M.models.filter(function (x) { return x.id === TOOLIDS[t.id]; })[0] : null, used = false;
          try { var v = X.invData(); used = !!(md && md.key && v[md.key] && !md.empty(v, v[md.key])); if (t.id === 'cmap' || t.id === 'tharm') { var cr = X.row(t.id); used = !!(cr && cr.content && (cr.content.map || cr.content.model)); } } catch (e) {}
          out.push({ practice: pr[0], group: grp[0], heading: grp[2] || '', id: t.id, name: t.n, by: t.by, used: used, href: pr[2] + (t.href || ('#' + t.id)) });
        });
      });
    });
    return out;
  }
  // ---------- for the three Diagnose part pages (31 October 2026) ----------
  // what the evidence covers: sources, the levels and the capitals they speak to
  function coverage() {
    var ss = sources(), lv = {}, cp = {}, read = 0;
    ss.forEach(function (x) { var t = tagOf(x); (t.levels || []).forEach(function (l) { lv[l] = 1; }); (t.caps || []).forEach(function (c) { cp[c] = 1; }); if (t.read) read++; });
    return { n: ss.length, read: read, levels: Object.keys(lv), caps: Object.keys(cp), L4: L4, CAPK: CAPK };
  }
  // the analysis tools, grouped, each with whether it is built and in use
  function toolUsed(t) {
    try {
      var v = X.invData();
      if (t.view === 'capitals') return coverage().caps.length > 0;
      if (t.view === 'levels') return coverage().levels.length > 0;
      if (t.view === 'outside') return formEntries(['outside', ['Title'], null]).length > 0;
      if (t.id === 'models') return M.models.some(function (md) { return !md.practice && !md.hidden && md.key && v[md.key] && !md.empty(v, v[md.key]); });
      if (t.id === 'bowtie') return M.models.some(function (md) { return (md.id === 'bowtie' || md.id === 'fta') && md.key && v[md.key] && !md.empty(v, v[md.key]); });
      var md = TOOLIDS[t.id] ? M.models.filter(function (x) { return x.id === TOOLIDS[t.id]; })[0] : null;
      return !!(md && md.key && v[md.key] && !md.empty(v, v[md.key]));
    } catch (e) { return false; }
  }
  function analysisGroups() {
    return TOOLS.map(function (g) {
      var nm = g[0].split(':'), tools = g[1].filter(toolOn).map(function (t) { var built = !!(t.view || t.href || TOOLIDS[t.id]); return { id: t.id, n: t.n, by: t.by, does: t.does, built: built, used: built && toolUsed(t), href: t.view ? '#' + t.view : t.href || ('#' + t.id) }; });
      return { key: g[2] === 'Checking the frame against the evidence' ? 'check' : nm[0].trim().toLowerCase(), name: nm[0].trim(), line: nm.length > 1 ? nm.slice(1).join(':').trim() : '', heading: g[2] || '', tools: tools };
    }).filter(function (g) { return g.tools.length; });
  }
  // the Model (or Test) tools, grouped, each with whether it is in use (31 October 2026)
  function stepGroups(step) {
    return (step === 'test' ? TTOOLS : MTOOLS).map(function (g) {
      return { name: g[0], tools: g[1].filter(toolOn).map(function (t) {
        var md = M.models.filter(function (x) { return x.id === (TOOLIDS[t.id] || t.id); })[0], used = false;
        try { var v = X.invData(); used = !!(md && md.key && v[md.key] && !md.empty(v, v[md.key])); if (t.id === 'cmap' || t.id === 'tharm') { var cr = X.row(t.id); used = !!(cr && cr.content && (cr.content.map || cr.content.model)); } } catch (e) {}
        return { id: t.id, n: t.n, by: t.by, does: t.does, built: true, used: used, href: t.href || ('#' + t.id) };
      }) };
    }).filter(function (g) { return g.tools.length; });
  }
  // the formulation's four headings, with their entries
  function formAll() {
    var o = {};
    FORM.forEach(function (f) { var es = []; f[3].forEach(function (spec) { if (!toolOn({ id: spec[0] })) return; es = es.concat(formEntries(spec)); }); o[f[1].toLowerCase()] = { head: f[0], name: f[1], line: f[2], entries: es }; });
    return o;
  }
  window.VTAnalyse = { status: status, stepGroups: stepGroups, coverage: coverage, analysisGroups: analysisGroups, formAll: formAll, renderFormulation: renderFormulation, evLink: evLink, FORM: FORM, formEntries: formEntries, MTOOLS: MTOOLS, TTOOLS: TTOOLS, STEPOF: STEPOF, init: function (x) { X = x; el = x.el; esc = x.esc; S = x.S; N = window.VTNeeds; M = window.VTModel; }, render: render, renderEvaluate: renderEvaluate, EIDS: EIDS, tabs: tabs, subtabsHtml: subtabsHtml, VIEWS: VIEWS, TOOLS: TOOLS, ETOOLS: ETOOLS, TOOLIDS: TOOLIDS, tagOf: tagOf, L4: L4 };
})();
