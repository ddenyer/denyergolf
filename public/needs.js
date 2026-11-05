// What every model needs, and what to ask the client for (spec: 13-model-data-requirements.md).
// Each requirement says which models it serves, the depth level it is needed from, where in the
// method it is gathered, the form of evidence, how it is found out, who supplies it, and the
// question to put to them ("team" items are never sent to the client). Checking a requirement
// against the session gives what we have and, for each gap, a line that can go into the
// evidence request. Also the Diagnose page (the four forms of evidence) and the request pages.
(function () {
  'use strict';
  var X, el, esc, S;

  var FORMS = {
    context: ['Context', 'The organisation, its people and its circumstances: documents, counts, rotas, incidents, the work as done'],
    stake: ['Stakeholders’ views and values', 'What each party wants, fears, would lose and will not tolerate, in their own words'],
    judge: ['Practitioner experience and judgement', 'What experienced staff and the team judge, always marked as judgement'],
    external: ['Evaluated external evidence', 'Research, inquests, inquiries, regulators’ and ombudsman reports, base rates']
  };
  var KIND_FORM = { document: 'context', image: 'context', transcript: 'stake', recording: 'stake', notes: 'judge' };
  var LEVELS = [null, ['', 'up to 1 day'], ['', '2 to 4 days'], ['', '5 to 15 days'], ['', '16 to 50 days'], ['', 'more than 50 days']];
  var OUTCOMES = ['The documents, read', 'The number going through it', 'The work as actually done', 'When it is there', 'The flow map, started', 'The people', 'Dependants and the worst served', 'What has happened', 'The environment', 'The capitals and flows', 'All four forms of evidence'];
  var PARTS = { r: 'Problem: reasons', s: 'Problem: the service', o: 'Problem: stakeholders and outcomes', h: 'Problem: how it works', q: 'Problem: the problem or decision', e: 'Project' };

  // ---------- reading the session ----------
  var tileRow = function (k) { return X.row(k); };
  var content = function (k) { var r = tileRow(k); return (r && r.content) || {}; };
  function level() { var c = content('depth'); return Number(c.level) || 3; }
  function reqState() { var c = content('request'); return { rounds: c.rounds || [], items: c.items || {} }; }
  function answers() {
    var out = {};
    (S.data.sources || []).filter(function (x) { return x.practice === 'request'; }).forEach(function (x) {
      var m = /^request:(.+?)(?::(upload|other|none))?$/.exec(x.file_name || ''); if (m) out[m[1]] = { choice: m[2] || 'other', at: x.created_at, id: x.id };
    });
    return out;
  }
  var tileDone = function (k) { var st = X.stateOf(k); return st === 'done' || st === 'partly' || st === 'skip' || st === 'reopened'; };
  var blank = function (x) { return x == null || String(x).trim() === ''; };

  // ---------- the requirements ----------
  // kind 'one': a single thing that is there or not. kind 'each': one check per element.
  // q may use {n} for the element's name. who(element) gives the holder for that element.
  var REQS = [];
  function R(o) { REQS.push(o); }
  var inv = function () { return X.invData(); };
  var m = function (k) { return inv()[k] || {}; };

  // Problem: the frame every model sits in
  R({ id: 'p-question', models: ['bowtie', 'faulttree', 'accimap'], level: 1, part: 'q', out: null, form: 'stake', how: 'Ask', who: 'The sponsor', q: 'If you had to put it in one sentence, what do you want to know?', label: 'The sponsor’s question, word for word', kind: 'one', has: function () { return tileDone('question') || tileDone('decision') || tileDone('words'); } });
  R({ id: 'p-service', models: ['ibs', 'blueprint', 'vsm', 'journey'], level: 1, part: 's', form: 'context', how: 'Ask', who: 'The sponsor', q: 'What is the service, and who is it for?', label: 'The service in one sentence, confirmed by the sponsor', kind: 'one', has: function () { return tileDone('what') || !blank(inv().service); } });
  R({ id: 'p-boundary', models: ['ibs', 'accimap', 'vsm'], level: 2, part: 's', form: 'judge', how: 'Session', who: 'The room', q: null, label: 'The boundary, declared, with what it includes and leaves out', kind: 'one', has: function () { return tileDone('boundary'); } });
  R({ id: 'p-who', models: ['journey', 'ibs'], level: 1, part: 'o', out: 7, form: 'stake', how: 'Ask', who: 'The sponsor', q: 'Who depends on it most? Where would they go if it stopped tomorrow?', label: 'Who depends on the service, and how they would cope without it', kind: 'one', has: function () { return tileDone('who'); } });
  R({ id: 'p-harm', models: ['bowtie', 'faulttree', 'ibs'], level: 2, part: 'o', form: 'stake', how: 'Ask', who: 'The sponsor', q: 'Could you sign this letter? What could you change in it and still be unable to send it? Has a letter like this already been sent, by you, to anyone?', label: 'The harm thresholds: the organisation’s, the regulator’s and the recipients’, never merged', kind: 'one', has: function () { return tileDone('threshold'); } });
  R({ id: 'p-purpose', models: ['vsm'], level: 2, part: 's', form: 'stake', how: 'Ask', who: 'The board and the sponsor', q: 'What are we for now? What must stay the same, what may change, and what would end it?', label: 'Purpose and identity, as stated and as it actually works', kind: 'one', has: function () { return tileDone('purpose'); } });
  R({ id: 'p-level', models: ['vsm'], level: 1, part: 's', form: 'judge', how: 'Judgement', who: 'The team', q: null, label: 'The level the service sits at, and what it sits within', kind: 'one', has: function () { return tileDone('level') || !blank(m('vsm').recursion); } });
  R({ id: 'p-how', models: ['process', 'journey'], level: 1, part: 'h', form: 'judge', how: 'Each person draws alone', who: 'The core team', q: 'In a sentence or two, how does it work day to day? What helps it, and what gets in the way?', label: 'How it works, sketched by each person', kind: 'one', has: function () { return tileDone('how'); } });
  R({ id: 'p-tolerance', models: ['ibs', 'abm'], level: 1, part: 'o', form: 'context', how: 'Ask, read', who: 'The operational resilience lead', q: 'Within what time must the service be back before the harm becomes intolerable?', label: 'The impact tolerance in hours', kind: 'one', has: function () { var t = inv().tolerance; return !!(t && t.hours); } });

  // The important business service (the dependency inventory)
  R({ id: 'i-processes', models: ['ibs', 'process'], level: 1, part: 'h', out: 5, form: 'context', how: 'Ask', who: 'The service owner', q: 'What are the main steps, in order, from the start of the service to its outcome?', label: 'The main steps of the service, in order (three or more)', kind: 'one', has: function () { return (inv().processes || []).length >= 3; } });
  R({ id: 'i-res-u', models: ['ibs'], level: 1, part: 'h', out: 5, form: 'context', how: 'Ask', who: 'The service owner', q: 'Which steps would stop if {n} were not there?', label: 'Each resource linked to the steps it supports', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return (r.u || []).length > 0; } });
  R({ id: 'i-res-owner', models: ['ibs'], level: 2, part: 's', out: 6, form: 'context', how: 'Read, ask', who: 'The service owner', q: 'Who owns {n}?', label: 'An owner for each resource', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return !blank(r.owner); } });
  R({ id: 'i-res-alt', models: ['ibs', 'abm'], level: 2, part: 'h', out: 5, form: 'context', how: 'Ask', who: function (r) { return r.owner; }, q: 'If {n} were not available, is there another way?', label: 'An alternative (or "none") for each resource', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return !blank(r.alt); } });
  R({ id: 'i-res-rto', models: ['ibs', 'abm'], level: 2, part: 's', out: 8, form: 'context', how: 'Read, ask', who: function (r) { return r.owner; }, q: 'When {n} has failed, how long did it take to get it back?', label: 'A recovery time for each resource', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return !blank(r.rto); } });
  R({ id: 'i-proc-owner', models: ['ibs', 'process'], level: 2, part: 'h', out: 6, form: 'context', how: 'Read, ask', who: 'The service owner', q: 'Who owns the step "{n}"?', label: 'An owner for each step', kind: 'each', list: function () { return inv().processes || []; }, ok: function (p) { return !blank(p.owner); } });
  R({ id: 'i-proc-fails', models: ['ibs', 'process', 'faulttree'], level: 2, part: 'h', out: 8, form: 'context', how: 'Ask (interrogation)', who: function (p) { return p.owner; }, q: 'Has "{n}" ever not happened? How often? How might it not happen?', label: 'How each step fails, written as a class', kind: 'each', list: function () { return inv().processes || []; }, ok: function (p) { return !blank(p.fails); } });
  R({ id: 'i-scen', models: ['ibs', 'abm'], level: 2, part: 'o', form: 'context', how: 'Ask, read', who: 'The business continuity lead', q: 'Which severe but plausible scenarios have you tested, and what did the last test show?', label: 'Severe but plausible scenarios, named', kind: 'one', has: function () { return (inv().scenarios || []).length > 0; } });
  R({ id: 'i-proc-aware', models: ['ibs', 'process', 'vsm'], level: 3, part: 'h', out: 6, form: 'context', how: 'Ask', who: function (p) { return p.owner; }, q: 'Do you know that "{n}" is yours to act on?', label: 'Whether each step’s owner knows it is theirs', kind: 'each', list: function () { return inv().processes || []; }, ok: function (p) { return !blank(p.aware); } });
  R({ id: 'i-proc-time', models: ['process', 'abm', 'fram'], level: 3, part: 'h', out: 4, form: 'context', how: 'Count, ask', who: function (p) { return p.owner; }, q: 'How long does "{n}" usually take, and how long at worst? When is it at its worst?', label: 'A usual time and a long time for each step', kind: 'each', list: function () { return inv().processes || []; }, ok: function (p) { return p.tUsual != null && p.tLong != null && p.tUsual !== '' && p.tLong !== ''; } });
  R({ id: 'i-proc-doc', models: ['process', 'blueprint'], level: 3, part: 'h', out: 3, form: 'context', how: 'Read, observe', who: 'The team', q: null, label: 'Each step marked documented, practised, or both', kind: 'each', list: function () { return inv().processes || []; }, ok: function (p) { return !blank(p.doc); } });
  R({ id: 'i-res-avail', models: ['ibs', 'abm'], level: 3, part: 'h', out: 4, form: 'context', how: 'Read the rota; ask', who: 'The rota holder', q: 'For {n}: who is on the rota at nights, weekends and bank holidays, and who actually answers?', label: 'When each person or team is there, read from the rota and from who actually answers', kind: 'each', list: function () { return (inv().resources || []).filter(function (r) { return r.t === 'people'; }); }, ok: function (r) { return !blank(r.avail); } });
  R({ id: 'i-res-checked', models: ['ibs', 'bowtie', 'vsm'], level: 3, part: 'h', out: 5, form: 'context', how: 'Ask (interrogation)', who: function (r) { return r.owner; }, q: 'Can you establish the actual state of {n}, and how? When was that last done, and by whom?', label: 'When each resource was last checked, and by whom', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return !blank(r.chk); } });
  R({ id: 'i-res-indep', models: ['ibs'], level: 3, part: 'o', out: 7, form: 'context', how: 'Ask', who: function (r) { return r.owner; }, q: 'Does the alternative to {n} depend on the same person, system, place, shift or rule?', label: 'Whether each alternative is independent of what it replaces', kind: 'each', list: function () { return (inv().resources || []).filter(function (r) { return !blank(r.alt) && !/^none$/i.test(String(r.alt).trim()); }); }, ok: function (r) { return !blank(r.indep); } });
  R({ id: 'i-res-grade', models: ['ibs'], level: 3, part: 'h', out: 11, form: 'context', how: 'Team', who: 'The team', q: null, label: 'An evidence grade (observed, stated, assumed) on each resource', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return !blank(r.grade); } });
  R({ id: 'i-res-det', models: ['ibs', 'bowtie'], level: 4, part: 'h', out: 5, form: 'context', how: 'Ask (interrogation)', who: 'People who do the work', q: 'If {n} failed, who would notice, and how soon?', label: 'Who would notice if each resource failed', kind: 'each', list: function () { return inv().resources || []; }, ok: function (r) { return !blank(r.det); } });
  R({ id: 'i-scen-test', models: ['ibs'], level: 4, part: 'o', form: 'context', how: 'Read', who: 'The business continuity lead', q: 'What did the last test of "{n}" show, in hours?', label: 'A test result for each scenario', kind: 'each', list: function () { return inv().scenarios || []; }, ok: function (s2) { return !!s2.last; } });

  // The evidence request by capital (tool 24), financial first; natural capital from public sources
  [['fin', 'Financial', 'Finance', 'What does this pathway consume, and what has been asked for and refused?'],
    ['man', 'Manufactured', 'Estates and assets', 'What does it run on, and what condition is that in now?'],
    ['hum', 'Human', 'HR and rostering', 'Who is there, when, and with what skill? (the rota, establishment against actual, vacancy and locum rates, training records)'],
    ['soc', 'Social', 'HR, and patient or customer relations', 'Will people say when it goes wrong, and does saying so change anything? What have those harmed already said, to whom, and what happened next?'],
    ['inf', 'Information', 'Governance, risk and quality', 'What is written down, and does it agree with itself? (the last serious incident report, the audit that followed it, the current policy, the risk register entry; and where this pathway performs best, and what the people it serves say about it)']].forEach(function (c, i) {
    R({ id: 'c-' + c[0], models: ['ibs'], level: 2, part: 's', out: i === 4 ? 1 : 10, form: 'context', how: 'Upload', who: c[2], q: c[3], label: c[1] + ' capital: the documents asked for', kind: 'one', ask: true, has: function () { var cp = content('evforms').capitals || {}; return !!cp[c[0]]; } });
  });
  R({ id: 'c-nat', models: ['ibs'], level: 3, part: 's', out: 9, form: 'external', how: 'Search public sources', who: 'The team', q: null, label: 'Natural capital: exposure from outside, from public sources (never asked of the organisation)', kind: 'one', has: function () { return !blank(content('evforms').natural); } });
  R({ id: 'c-vol', models: ['abm', 'ibs'], level: 2, part: 's', out: 2, form: 'context', how: 'Count', who: 'The performance or information team', q: 'How many people or cases go through this pathway in a month? (If nobody can produce the figure, that is itself a finding.)', label: 'The number going through it, with its source', kind: 'one', has: function () { return ((m('abm').procs || [])[0] || {}).arrive > 0; } });

  // Customer journey
  R({ id: 'j-persona', models: ['journey'], level: 1, part: 'o', out: 7, form: 'stake', how: 'Ask', who: 'The sponsor', q: 'Who is this service for, and what must it do for them?', label: 'The person the service is for, and their goal', kind: 'one', has: function () { var j = m('journey'); return !blank(j.persona) && !blank(j.goal); } });
  R({ id: 'j-steps', models: ['journey', 'blueprint'], level: 1, part: 'h', out: 3, form: 'stake', how: 'Ask', who: 'The sponsor and core team', q: 'Her journey, in a few stops: what happens to her, step by step?', label: 'Three or more steps of their journey', kind: 'one', has: function () { return (m('journey').stages || []).length >= 3; } });
  R({ id: 'j-proc', models: ['journey'], level: 2, part: 'h', out: 3, form: 'context', how: 'Team', who: 'The team', q: null, label: 'Each journey step linked to the processes behind it', kind: 'each', list: function () { return m('journey').stages || []; }, ok: function (x) { return (x.proc || []).length > 0; } });
  R({ id: 'j-pain', models: ['journey'], level: 2, part: 'h', out: 3, form: 'stake', how: 'Ask', who: 'Front-line staff', q: 'At "{n}", where does it go wrong for the person?', label: 'Where it goes wrong, at each step that feels poor', kind: 'each', list: function () { return (m('journey').stages || []).filter(function (x) { return Number(x.feel) < 0; }); }, ok: function (x) { return !blank(x.pain); } });
  R({ id: 'j-good', models: ['journey', 'blueprint'], level: 3, part: 'h', out: 3, form: 'context', how: 'Ask', who: 'The sponsor', q: 'Which recent case went unexpectedly well, and could we follow it from start to finish?', label: 'A good journey traced, as well as a bad one', kind: 'one', has: function () { return !blank(m('journey').good); } });
  R({ id: 'j-voice', models: ['journey'], level: 3, part: 'o', out: 7, form: 'stake', how: 'Ask, with consent', who: 'The people the service is for, or those who speak for them', q: 'What do you count on this service for? Say it the way you would say it to a friend.', label: 'How it feels, in the words of the people themselves', kind: 'one', has: function () { return !blank(m('journey').voice); } });

  // Service blueprint
  R({ id: 'b-cells', models: ['blueprint'], level: 2, part: 'h', out: 3, form: 'context', how: 'Read, ask', who: 'The team', q: null, label: 'Something in the blueprint at every step', kind: 'each', list: function () { return m('journey').stages || []; }, ok: function (x) { return (m('blueprint').cells || []).some(function (c) { return c.st === x.id; }); } });
  R({ id: 'b-should', models: ['blueprint'], level: 2, part: 'o', out: 3, form: 'stake', how: 'Ask', who: 'The sponsor', q: 'What should have happened at "{n}"?', label: 'What should happen at every step', kind: 'each', list: function () { return m('journey').stages || []; }, ok: function (x) { return (m('blueprint').should || []).some(function (c) { return c.st === x.id && !blank(c.t); }); } });
  R({ id: 'b-failres', models: ['blueprint'], level: 3, part: 'h', out: 8, form: 'context', how: 'Team', who: 'The team', q: null, label: 'The resources involved at each fail point', kind: 'each', list: function () { return (m('blueprint').cells || []).filter(function (c) { return c.fail; }); }, ok: function (c) { return (c.res || []).length > 0; }, name: function (c) { return c.t; } });
  R({ id: 'b-fn', models: ['blueprint', 'vsm'], level: 3, part: 'h', out: 3, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'A Beer function on every blueprint cell', kind: 'each', list: function () { return m('blueprint').cells || []; }, ok: function (c) { return !blank(c.fn); }, name: function (c) { return c.t; } });

  // Timeline
  R({ id: 't-precedent', models: ['timeline'], level: 1, part: 'r', out: 8, form: 'stake', how: 'Ask', who: 'The sponsor', q: 'What happened last time? What did you do about it, and how do you know whether it worked? When did you last feel confident about this, and what changed?', label: 'The precedent and when confidence was last felt', kind: 'one', has: function () { return (m('timeline').events || []).length > 0; } });
  R({ id: 't-log', models: ['timeline', 'abm', 'faulttree'], level: 3, part: 'h', out: 8, form: 'context', how: 'Upload', who: 'The incident system owner', q: 'Could you send the incident log for this pathway for the last three to five years, anonymised before it reaches us?', label: 'The incident log (three or more incidents on the timeline)', kind: 'one', ask: true, has: function () { return (m('timeline').events || []).filter(function (e) { return e.kind === 'incident'; }).length >= 3; } });
  R({ id: 't-src', models: ['timeline'], level: 3, part: 'h', out: 11, form: 'context', how: 'Team', who: 'The team', q: null, label: 'A source on every event', kind: 'each', list: function () { return m('timeline').events || []; }, ok: function (e) { return !blank(e.src); } });
  R({ id: 't-inc', models: ['timeline', 'abm'], level: 4, part: 'h', out: 8, form: 'context', how: 'Read', who: 'The team', q: null, label: 'The resource affected and the hours lost on every incident', kind: 'each', list: function () { return (m('timeline').events || []).filter(function (e) { return e.kind === 'incident'; }); }, ok: function (e) { return !blank(e.res) && !!e.hours; } });

  // Bow tie
  R({ id: 'bt-top', models: ['bowtie'], level: 1, part: 'o', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The central event, written as a class', kind: 'one', has: function () { return !blank(m('bowtie').top); } });
  R({ id: 'bt-sides', models: ['bowtie'], level: 1, part: 'q', form: 'judge', how: 'Ask, each person alone', who: 'The core team', q: 'Where would it go wrong? To whom, how bad, how long?', label: 'At least two causes and two consequences', kind: 'one', has: function () { var b = m('bowtie'); return (b.threats || []).length >= 2 && (b.cons || []).length >= 2; } });
  R({ id: 'bt-bar', models: ['bowtie'], level: 2, part: 'h', out: 1, form: 'context', how: 'Read, ask', who: 'The control owners', q: 'What is meant to stop "{n}" from leading to the event, and what does that rely on?', label: 'A barrier against each cause', kind: 'each', list: function () { return m('bowtie').threats || []; }, ok: function (t) { return (m('bowtie').bars || []).some(function (b) { return b.on === t.id; }); } });
  R({ id: 'bt-state', models: ['bowtie'], level: 3, part: 'h', out: 8, form: 'context', how: 'Read, ask', who: function (b) { var r = X.byRes(b.res); return r ? r.owner : 'The control owners'; }, q: 'When "{n}" was last needed, did it work?', label: 'Whether each barrier held, from evidence', kind: 'each', list: function () { return m('bowtie').bars || []; }, ok: function (b) { return b.state && b.state !== 'untested'; } });
  R({ id: 'bt-kind', models: ['bowtie'], level: 3, part: 'h', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Each barrier’s kind: prevent, detect, contain or recover', kind: 'each', list: function () { return m('bowtie').bars || []; }, ok: function (b) { return !blank(b.kind); } });
  R({ id: 'bt-tested', models: ['bowtie'], level: 4, part: 'h', out: 8, form: 'context', how: 'Ask', who: function (b) { var r = X.byRes(b.res); return r ? r.owner : 'The control owners'; }, q: 'When was "{n}" last tested, and what could get round it?', label: 'When each barrier was last tested', kind: 'each', list: function () { return m('bowtie').bars || []; }, ok: function (b) { return !blank(b.tested); } });

  // Fault tree
  R({ id: 'ft-top', models: ['faulttree'], level: 2, part: 'o', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The outcome at the top', kind: 'one', has: function () { return !blank(m('faulttree').top); } });
  R({ id: 'ft-depth', models: ['faulttree'], level: 3, part: 'h', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Gates at two or more levels', kind: 'one', has: function () { return (m('faulttree').nodes || []).some(function (x) { return x.gate && x.parent !== 'top'; }) || (m('faulttree').nodes || []).filter(function (x) { return x.gate; }).length >= 2; } });
  R({ id: 'ft-seen', models: ['faulttree'], level: 3, part: 'h', out: 8, form: 'context', how: 'Count', who: 'The incident system owner', q: 'How often has "{n}" been seen in the incident log or on the rota?', label: 'How often each basic event has been seen', kind: 'each', list: function () { return (m('faulttree').nodes || []).filter(function (x) { return !x.gate; }); }, ok: function (x) { return !blank(x.seen); } });
  R({ id: 'ft-warrant', models: ['faulttree'], level: 4, part: 'h', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'A warrant for each gate', kind: 'each', list: function () { return (m('faulttree').nodes || []).filter(function (x) { return x.gate; }); }, ok: function (x) { return !blank(x.warrant); } });

  // AcciMap
  R({ id: 'a-levels', models: ['accimap'], level: 3, part: 'h', out: 8, form: 'context', how: 'Read, ask', who: 'The team', q: null, label: 'Every level looked at (an empty level recorded, not left out)', kind: 'each', list: function () { return [0, 1, 2, 3, 4, 5].map(function (i) { return { id: 'lvl' + i, n: X.ALEVELS[i], i: i }; }); }, ok: function (L) { var a = m('accimap'); return (a.factors || []).some(function (f) { return Number(f.lvl) === L.i; }) || (a.none || []).indexOf(L.i) >= 0; } });
  R({ id: 'a-not', models: ['accimap'], level: 3, part: 'h', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The form of failure on each condition', kind: 'each', list: function () { return (m('accimap').factors || []).filter(function (f) { return Number(f.lvl) < 6; }); }, ok: function (f) { return !blank(f.not); } });
  R({ id: 'a-l4', models: ['accimap'], level: 3, part: 'h', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Each condition’s level on the four (institution, organisation, team, person)', kind: 'each', list: function () { return (m('accimap').factors || []).filter(function (f) { return Number(f.lvl) < 6; }); }, ok: function (f) { return !blank(f.l4); } });
  R({ id: 'a-conf', models: ['accimap'], level: 4, part: 'h', form: 'judge', how: 'Two coders', who: 'The team', q: null, label: 'Intent and confidence on each condition, coded by two people', kind: 'each', list: function () { return (m('accimap').factors || []).filter(function (f) { return Number(f.lvl) < 6; }); }, ok: function (f) { return !blank(f.intent) && !blank(f.conf); } });

  // Systems diagram
  R({ id: 's-loop', models: ['systems'], level: 3, part: 'h', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'At least one closed loop', kind: 'one', has: function () { return X.loops(m('systems')).length > 0; } });
  R({ id: 's-meas', models: ['systems', 'abm'], level: 4, part: 'h', out: 8, form: 'context', how: 'Read', who: 'Audit and quality', q: 'When has the main control on this pathway been measured, and what did each measurement show?', label: 'Two or more dated measurements of a control', kind: 'one', ask: true, has: function () { return (m('systems').meas || []).length >= 2; } });

  // FRAM
  R({ id: 'f-io', models: ['fram'], level: 3, part: 'h', out: 3, form: 'context', how: 'Read, ask', who: 'People who do the work', q: 'For "{n}": what does it need before it can start, what does it use, what controls it, and when must it happen?', label: 'An input and an output on every function', kind: 'each', list: function () { return m('fram').fns || []; }, ok: function (f) { return !blank(f.I) && !blank(f.O); } });
  R({ id: 'f-var', models: ['fram'], level: 4, part: 'h', out: 3, form: 'context', how: 'Ask (interrogation)', who: 'People who do the work', q: 'Has "{n}" ever been late, partly done, or done out of order?', label: 'Whether each function’s output varies, from the people who do it', kind: 'each', list: function () { return m('fram').fns || []; }, ok: function (f) { return !blank(f.varEv); } });

  // Social network
  R({ id: 'n-people', models: ['sna'], level: 2, part: 'o', out: 6, form: 'context', how: 'Ask', who: 'The sponsor', q: 'Who else should we talk to? Who holds the facts on this?', label: 'Three or more people or roles', kind: 'one', has: function () { return (m('sna').actors || []).length >= 3; } });
  R({ id: 'n-ties', models: ['sna'], level: 3, part: 'o', out: 6, form: 'context', how: 'Ask', who: function (a) { return a.n; }, q: 'Who do you actually contact at the weekend? And at night?', label: 'The ties of every person seen', kind: 'each', list: function () { return m('sna').actors || []; }, ok: function (a) { return (m('sna').ties || []).some(function (t) { return t.a === a.id || t.b === a.id; }); } });
  R({ id: 'n-watch', models: ['sna', 'vsm'], level: 4, part: 'o', out: 6, form: 'context', how: 'Ask', who: 'Each person seen', q: 'Who checks your work, and whose work do you check?', label: 'Who checks whom', kind: 'one', ask: true, has: function () { return (m('sna').ties || []).some(function (t) { return t.kind === 'watches'; }); } });

  // Agent-based model and the twin
  R({ id: 'ab-cap', models: ['abm'], level: 3, part: 'h', out: 4, form: 'context', how: 'Count, ask', who: function (p) { return p.owner; }, q: 'How many can "{n}" handle in an hour?', label: 'The capacity of each step', kind: 'each', list: function () { return inv().processes || []; }, ok: function (p) { return (m('abm').procs || []).some(function (x) { return x.p === p.id && x.cap; }); } });
  R({ id: 'ab-cover', models: ['abm'], level: 3, part: 'h', out: 4, form: 'context', how: 'Read the rota', who: 'The rota holder', q: 'At the weekend, what share of the usual cover is there for {n}?', label: 'Weekend cover for each person or team', kind: 'each', list: function () { return (inv().resources || []).filter(function (r) { return r.t === 'people'; }); }, ok: function (r) { return (m('abm').res || []).some(function (x) { return x.r === r.id && x.wk != null && x.wk !== ''; }); } });
  R({ id: 'ab-cal', models: ['abm'], level: 3, part: 'h', form: 'context', how: 'Upload', who: 'The team', q: null, label: 'Calibrated: the date and source of the data', kind: 'one', has: function () { return !!(m('abm').cal && m('abm').cal.at); } });
  R({ id: 'ab-states', models: ['abm'], level: 3, part: 'h', out: 4, form: 'stake', how: 'Ask', who: 'Four to six front-line staff, without managers', q: 'What do you call it when you are short? How often is it like that? What do you drop first?', label: 'The operating states in staff’s own words', kind: 'one', ask: true, has: function () { return !blank(m('abm').states); } });
  R({ id: 'ab-facts', models: ['abm'], level: 4, part: 'h', form: 'stake', how: 'Ask', who: 'The service owner', q: 'Before we run the model: where does the backlog build, and how long did the last outage take?', label: 'Three or four things the organisation knows to be true, for the model to reproduce', kind: 'one', ask: true, has: function () { return (m('abm').facts || []).length >= 3; } });
  R({ id: 'ab-from', models: ['abm'], level: 4, part: 'h', out: 11, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Where every number came from (log, organisation, document, inferred, assumed, calibrated)', kind: 'each', list: function () { return (m('abm').procs || []).concat(m('abm').res || []); }, ok: function (x) { return !blank(x.from); }, name: function (x) { var p = X.byProc(x.p), r = X.byRes(x.r); return (p || r || {}).n || 'an entry'; } });

  // Beer's viable system model
  var FNAMES = { s1: 'Operations (System 1)', s2: 'Coordination (System 2)', s3: 'Control (System 3)', s3s: 'Audit (System 3*)', s4: 'Intelligence (System 4)', s5: 'Policy (System 5)' };
  var FQ = { s1: 'What could the front line not absorb or work around, and where has its practice drifted?', s2: 'Where does what one unit knows or does fail to reach the next?', s3: 'What does control reward, where do decisions wait, and what slack has it taken out?', s3s: 'How would we know, other than by being told?', s4: 'What is changing outside that our view of the world would not let us see?', s5: 'What are we for now, and is the present crowding out the future?' };
  R({ id: 'v-recursion', models: ['vsm'], level: 1, part: 's', form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The level of recursion being looked at', kind: 'one', has: function () { return !blank(m('vsm').recursion); } });
  R({ id: 'v-fn', models: ['vsm'], level: 2, part: 's', out: 6, form: 'stake', how: 'Ask', who: 'The service owner', q: '{q}', label: 'Each of the six functions: who performs it, or a recorded gap', kind: 'each', list: function () { return Object.keys(FNAMES).map(function (k) { return { id: k, n: FNAMES[k], q: FQ[k] }; }); }, ok: function (f) { return (m('vsm').fns || []).some(function (x) { return x.f === f.id && (!blank(x.who) || x.gap); }); } });
  R({ id: 'v-obs', models: ['vsm'], level: 4, part: 'h', out: 3, form: 'context', how: 'Observe', who: 'The team', q: null, label: 'Control and audit evidenced by observation, not only documents', kind: 'each', list: function () { return [{ id: 's3', n: FNAMES.s3 }, { id: 's3s', n: FNAMES.s3s }]; }, ok: function (f) { return (m('vsm').fns || []).some(function (x) { return x.f === f.id && x.ev === 'observed'; }); } });

  // ---------- Diagnose's own records: dependants, the outside view, disagreements, the frame tested ----------
  var rec = function (k) { return m(k); };
  var groups = function () { return rec('dependants').groups || []; };
  R({ id: 'a-dep', models: ['dependants'], level: 2, part: 'o', out: 7, form: 'stake', how: 'Ask', who: 'The service owner', q: 'Who depends on the service: which groups of people would be affected if it stopped, including any who are not usually asked?', label: 'The groups who depend on the service, listed from the evidence', kind: 'one', has: function () { return groups().length > 0; } });
  R({ id: 'a-dep-alt', models: ['dependants'], level: 2, part: 'o', out: 7, form: 'stake', how: 'Ask', who: 'The service owner', q: 'For {n}: if the service stopped tomorrow, what would they do instead, and could what they lose be put back?', label: 'Each group: what they would do if it stopped, and whether the loss can be put back', kind: 'each', list: groups, ok: function (g) { return g.alt !== 'unknown' && g.rebuild !== 'unknown'; } });
  R({ id: 'a-dep-roots', models: ['dependants'], level: 3, part: 'o', out: 7, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Each group: whether their alternative shares a root with the service, and who the worst-off are', kind: 'each', list: groups, ok: function (g) { return !blank(g.roots) && !blank(g.worst); } });
  R({ id: 'a-dep-heard', models: ['dependants'], level: 3, part: 'o', out: 6, form: 'stake', how: 'Ask', who: 'The service owner', q: 'Who could speak for {n}: someone who deals with them, speaks for them, or is one of them?', label: 'Each group heard: through someone who deals with them, speaks for them, or is one of them', kind: 'each', list: groups, ok: function (g) { return !blank(g.spoke); } });
  R({ id: 'a-out', models: ['outside'], level: 3, part: 'h', out: 8, form: 'external', how: 'Search', who: 'The team', q: null, label: 'The outside view: inquiries, inquests, regulators’ reports, guidance and research, here and elsewhere', kind: 'one', has: function () { return (rec('outside').items || []).length > 0; } });
  R({ id: 'a-out-prior', models: ['outside'], level: 2, part: 'h', out: 8, form: 'context', how: 'Ask', who: 'The risk and compliance lead', q: 'Please send any earlier investigations, reviews or audits of this service, or tell us there are none.', label: 'Earlier internal investigations of this service', kind: 'one', has: function () { return (rec('outside').items || []).some(function (x) { return x.kind === 'internal'; }); } });
  R({ id: 'a-out-asat', models: ['outside'], level: 3, part: 'e', out: 8, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The as-at date, so later reports are kept apart from the evidence', kind: 'one', has: function () { return !blank(rec('outside').asat); } });
  R({ id: 'a-out-appraised', models: ['outside'], level: 4, part: 'h', out: 11, form: 'external', how: 'Team', who: 'The team', q: null, label: 'Each item appraised: fact, judgement or recommendation, and whether hindsight shaped it', kind: 'each', list: function () { return rec('outside').items || []; }, ok: function (x) { return !blank(x.reads) && !blank(x.applies) && !blank(x.says); } });
  R({ id: 'a-dis', models: ['disagree'], level: 2, part: 'h', out: 1, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The sources cross-read: where they disagree, or a record that nothing was found', kind: 'one', has: function () { return (rec('disagree').items || []).length > 0 || !blank(rec('disagree').none); } });
  R({ id: 'a-dis-prac', models: ['disagree'], level: 3, part: 'h', out: 3, form: 'context', how: 'Observe', who: 'People who do the work', q: 'Where the written rule and what happens differ ({n}): what do people actually do?', label: 'Each disagreement: what practice has chosen', kind: 'each', list: function () { return (rec('disagree').items || []).map(function (x) { return { id: x.id, n: x.about, x: x }; }); }, ok: function (e) { return !blank(e.x.practice); } });
  var FR = function (k, lv, lab, o) { R(Object.assign({ id: 'a-' + k, models: ['evframe'], level: lv, kind: 'one', label: lab, has: function () { return !blank(rec('evframe')[k]); } }, o)); };
  FR('purposeWorks', 3, 'Purpose as it actually works, from what people do', { part: 's', out: 3, form: 'context', how: 'Observe', who: 'The team', q: null });
  FR('demand', 3, 'Demand counted: what the service exists to meet, against demand its own failures cause', { part: 's', out: 2, form: 'context', how: 'Count', who: 'The service owner', q: 'Over a typical month, how many requests come in, and how many of those are chasing, repeats or putting something right?' });
  FR('register', 2, 'The organisation’s own register of important business services, read', { part: 's', out: 1, form: 'context', how: 'Ask', who: 'The risk and compliance lead', q: 'Please send your register of important business services, with impact tolerances, mapping and the latest test results, or tell us you do not have one.' });
  FR('revealed', 4, 'Harm thresholds revealed by what has been tolerated', { part: 'o', out: 8, form: 'context', how: 'Read', who: 'The risk and compliance lead', q: 'Please send the risk register with the date each entry was first raised, and tell us when the organisation last stopped something because it was unsafe.' });
  FR('typeRevised', 3, 'The type of challenge, revised now the evidence is in', { part: 'r', out: 11, form: 'judge', how: 'Team', who: 'The team', q: null });
  FR('works', 3, 'What already works unusually well, from front-line staff', { part: 'h', out: 3, form: 'stake', how: 'Ask, each alone', who: 'People who do the work', q: 'What works unusually well here, that you would not want anyone to change?' });

  // ---------- the analysis tools: risk, continuity, causes and change ----------
  var items = function (k) { return rec(k).items || []; };
  var procList = function () { return inv().processes || []; };
  R({ id: 'a-forces', models: ['forcefield'], level: 2, part: 'r', out: 11, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'What drives change and what holds things as they are', kind: 'one', has: function () { return (rec('forcefield').drive || []).length > 0 && (rec('forcefield').hold || []).length > 0; } });
  R({ id: 'a-bia', models: ['bia'], level: 2, part: 's', out: 4, form: 'stake', how: 'Ask', who: 'The service owner', q: 'For “{n}”: if it stopped, how bad would it be after an hour, a day and a week, and how long could it stop before the harm is unacceptable?', label: 'Each process: how the harm grows if it stops, and the longest disruption that could be tolerated', kind: 'each', list: procList, ok: function (p) { return items('bia').some(function (x) { return x.proc === p.id && !blank(x.mtpd); }); } });
  R({ id: 'a-bia-rto', models: ['bia'], level: 3, part: 's', out: 4, form: 'context', how: 'Ask', who: 'The service owner', q: 'What recovery time has been set for “{n}”, if any, and what does it rest on?', label: 'Each process: its recovery target and the resources it rests on', kind: 'each', list: procList, ok: function (p) { return items('bia').some(function (x) { return x.proc === p.id && !blank(x.rto) && (x.deps || []).length; }); } });
  R({ id: 'a-risk-theirs', models: ['risk'], level: 2, part: 'o', out: 8, form: 'context', how: 'Ask', who: 'The risk and compliance lead', q: 'Please send the current risk register for this service, with the date each entry was first raised.', label: 'The organisation’s own risk register, read', kind: 'one', has: function () { return !blank(rec('risk').theirs); } });
  R({ id: 'a-risk', models: ['risk'], level: 3, part: 'o', out: 8, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The risks to the service, scored before and after controls', kind: 'one', has: function () { return items('risk').length > 0; } });
  R({ id: 'a-scen', models: ['scentest'], level: 3, part: 'q', out: 9, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Each scenario tested against the impact tolerance', kind: 'each', list: function () { return inv().scenarios || []; }, ok: function (s2) { return items('scentest').some(function (x) { return x.scen === s2.id && x.within !== 'unknown'; }); } });
  R({ id: 'a-plans', models: ['plans'], level: 2, part: 's', out: 1, form: 'context', how: 'Ask', who: 'The risk and compliance lead', q: 'Please send your business continuity, disaster recovery and incident plans for this service, with the date each was last tested, or tell us there are none.', label: 'The organisation’s continuity, recovery and incident plans', kind: 'one', has: function () { return items('plans').length > 0; } });
  R({ id: 'a-plans-judged', models: ['plans'], level: 3, part: 's', out: 1, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'Each plan judged against the model: are its recovery times believable?', kind: 'each', list: function () { return items('plans'); }, ok: function (x) { return x.believable !== 'unknown'; } });
  R({ id: 'a-exlog', models: ['exlog', 'plans'], level: 3, part: 'h', out: 8, form: 'context', how: 'Ask', who: 'The risk and compliance lead', q: 'Please send records of exercises and tests of these plans over the last three years, and any times a plan was used for real.', label: 'Exercises, tests and real uses of the plans', kind: 'one', has: function () { return items('exlog').length > 0; } });
  R({ id: 'a-exlog-done', models: ['exlog'], level: 4, part: 'h', out: 8, form: 'context', how: 'Ask', who: 'The risk and compliance lead', q: 'After “{n}”, what was done about what failed?', label: 'Each failure in an exercise or test: what was done about it', kind: 'each', list: function () { return items('exlog').filter(function (x) { return !blank(x.failed); }); }, ok: function (x) { return !blank(x.done) || x.closed; } });
  R({ id: 'a-rca', models: ['rca'], level: 3, part: 'h', out: 8, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'One incident taken apart: causes under each heading, and at least three steps of asking why', kind: 'one', has: function () { return !blank(rec('rca').incident) && (rec('rca').whys || []).length >= 3; } });
  R({ id: 'a-horizon', models: ['horizon'], level: 3, part: 'h', out: 9, form: 'external', how: 'Search', who: 'The team', q: null, label: 'Changes coming from outside, and what they would do to the service', kind: 'one', has: function () { return items('horizon').length > 0; } });
  R({ id: 'a-self', models: ['selfassess'], level: 4, part: 'e', out: 11, form: 'context', how: 'Team', who: 'The team', q: null, label: 'The organisation scored against a chosen standard, with evidence for each score', kind: 'one', has: function () { return !blank(rec('selfassess').standard) && items('selfassess').length > 0; } });

  // ---------- Evaluate: how viability is lost and kept, and what the change should leave behind ----------
  R({ id: 'e-nots', models: ['nots'], level: 3, part: 'h', out: 8, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The twelve nots: findings coded from incidents, near misses and interviews, with their mechanisms', kind: 'one', has: function () { return items('nots').length > 0; } });
  R({ id: 'e-nots-lv', models: ['nots'], level: 4, part: 'h', out: 8, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'The twelve nots at all four levels, from institutional to intrapersonal', kind: 'one', has: function () { var l = {}; items('nots').forEach(function (x) { l[x.lvl] = 1; }); return Object.keys(l).length >= 4; } });
  R({ id: 'e-nots-val', models: ['nots'], level: 4, part: 'h', out: 3, form: 'stake', how: 'Ask', who: 'People who do the work', q: 'What works unusually well here that the rest of the organisation has not taken up?', label: 'The twelve nots read for what could go better, not only for what could go wrong', kind: 'one', has: function () { return items('nots').some(function (x) { return x.side === 'value'; }); } });
  R({ id: 'e-tech', models: ['techmech'], level: 3, part: 's', out: 10, form: 'context', how: 'Read', who: 'The team', q: null, label: 'Technical mechanisms judged for each capital: too little, about right or too much', kind: 'one', has: function () { return items('techmech').length > 0; } });
  R({ id: 'e-tech-caps', models: ['techmech'], level: 4, part: 's', out: 10, form: 'context', how: 'Read', who: 'The team', q: null, label: 'Technical mechanisms across at least four of the six capitals', kind: 'one', has: function () { var c = {}; items('techmech').forEach(function (x) { c[x.cap] = 1; }); return Object.keys(c).length >= 4; } });
  R({ id: 'e-pace', models: ['pace'], level: 2, part: 'q', out: 11, form: 'stake', how: 'Ask', who: 'The service owner', q: 'How well does the organisation now share a purpose, see what is coming, coordinate across functions, and engage the people who will carry the change?', label: 'PACE² outcomes scored now', kind: 'one', has: function () { return (rec('pace').tasks || []).some(function (x) { return x.now !== '' && x.now != null; }); } });
  R({ id: 'e-pace-all', models: ['pace'], level: 3, part: 'q', out: 11, form: 'judge', how: 'Team', who: 'The team', q: null, label: 'All sixteen PACE² tasks scored, now and after the change', kind: 'one', has: function () { return (rec('pace').tasks || []).filter(function (x) { return x.now !== '' && x.after !== ''; }).length >= 16; } });

  // Checks the team records by hand: depth 4 and 5 need more than the data in the models.
  var checks = function () { return content('evforms').checks || {}; };
  function M(o) { o.kind = 'one'; o.mark = true; o.q = null; o.has = function () { return !blank(checks()[o.id]); }; R(o); }
  M({ id: 'k-harm', models: ['journey', 'blueprint', 'timeline'], level: 4, part: 'h', out: 3, form: 'context', how: 'Ask, read', who: 'The team', label: 'One case followed all the way to harm (or to the success), with every step dated' });
  M({ id: 'k-corrected', models: ['process', 'blueprint', 'journey', 'ibs'], level: 4, part: 'h', out: 5, form: 'context', how: 'Ask, each alone', who: 'The team', label: 'The map corrected by two people who do the work, each seen alone' });
  M({ id: 'k-retest', models: ['journey', 'blueprint', 'process', 'timeline', 'ibs', 'bowtie', 'faulttree', 'accimap', 'systems', 'fram', 'sna', 'abm', 'vsm'], level: 5, part: 'e', out: 11, form: 'external', how: 'Retest', who: 'The team', label: 'A second, independent check of the model: a retest, a held-back measurement, or a review against a later event' });

  // ---------- checking ----------
  var holderOf = function (q2, e) { var w = typeof q2.who === 'function' ? q2.who(e) : q2.who; return blank(w) ? 'The service owner' : w; };
  var nameOf = function (q2, e) { return q2.name ? q2.name(e) : (e.n || e.label || ''); };
  // One result per requirement: lines are the gaps; each gap that can be asked carries its question.
  function check(q2) {
    var A = answers(), RS = reqState().items, lines = [], total = 1, have = 0;
    var mk = function (e) {
      var key = q2.id + (e ? ':' + e.id : ''), qt = q2.q ? q2.q.replace('{n}', e ? nameOf(q2, e) : '').replace('{q}', e && e.q ? e.q : '') : null;
      var a = A[key], it = RS[key];
      return { key: key, req: q2, at: e ? e.id : null, name: e ? nameOf(q2, e) : '', q: qt, holder: e ? holderOf(q2, e) : holderOf(q2, null), team: !q2.q, absent: !!(a && a.choice === 'none'), answered: !!(a && a.choice !== 'none'), asked: !!it, round: it && it.round };
    };
    if (q2.kind === 'each') {
      var list = q2.list() || []; total = list.length;
      list.forEach(function (e) { if (q2.ok(e)) have++; else lines.push(mk(e)); });
      if (!total) { total = 0; }
    } else {
      if (q2.has()) have = 1; else lines.push(mk(null));
    }
    // a "we don't have this" answer is a finding: it counts as dealt with
    var settled = lines.filter(function (l) { return l.absent; }).length;
    return { req: q2, total: total, have: have, absent: settled, lines: lines, state: !total ? 'na' : have === total ? 'have' : have + settled === total ? 'absent' : have || settled ? 'part' : 'miss' };
  }
  function forModel(id, lv) { var L = lv || level(); return REQS.filter(function (q2) { return q2.models.indexOf(id) >= 0 && q2.level <= L; }).map(check); }
  // Which depths the evidence supports for a model. A depth is supported when every item it needs
  // (at that depth and below) is at least half there, counting "we don't have this" as dealt with.
  // Returns the highest supported depth, and for each depth what is short.
  function readiness(id) {
    var cs = REQS.filter(function (q2) { return q2.models.indexOf(id) >= 0; }).map(check), out = { top: 0, short: {} };
    for (var d = 1; d <= 5; d++) {
      var short = cs.filter(function (c) { return c.req.level === d && c.state !== 'na' && c.total && (c.have + c.absent) / c.total < 0.5; }).map(function (c) { return c.req.label; });
      out.short[d] = short;
      if (!short.length && out.top === d - 1) out.top = d;
    }
    return out;
  }
  var inScope = function (q2) { return !window.VTScope || q2.models.some(function (m) { return window.VTScope.on(m); }); };
  function all() { var L = level(); return REQS.filter(function (q2) { return q2.level <= L && inScope(q2); }).map(check); }
  function askable() { var out = []; all().forEach(function (c) { c.lines.forEach(function (l) { if (!l.team && !l.absent) out.push(l); }); }); return out; }

  // ---------- the panel on each model ----------
  var WORDS = { have: 'Have', part: 'Partly', miss: 'Missing', absent: 'Recorded as not held', na: 'Not applicable yet' };
  function panel(id, box, before) {
    var cs = forModel(id).filter(function (c) { return c.state !== 'na'; }), gaps = cs.filter(function (c) { return c.state === 'miss' || c.state === 'part'; }).length;
    var open = S.needsOpen === id;
    var btn = el('button', { class: 'btn sm needbtn' + (gaps ? ' warm' : ''), id: 'mNeeds', 'aria-expanded': String(open), text: gaps ? 'What this model needs: ' + gaps + ' to find' : 'What this model needs: complete at depth ' + level(), onclick: function () { S.needsOpen = open ? null : id; X.render(); } });
    var bar = el('div', { class: 'needs' }, [btn]);
    if (open) {
      var t = el('div', { class: 'needlist' });
      t.appendChild(el('p', { class: 'meta', text: 'At depth ' + level() + ' (set on the hub). Items needed only at a greater depth are not shown. A "?" on the drawing marks where something is missing.' }));
      cs.forEach(function (c) {
        var q2 = c.req;
        t.appendChild(el('div', { class: 'need ' + c.state }, [
          el('div', { class: 'nh' }, [el('i', { class: 'nd ' + c.state }), el('b', { text: q2.label }), el('span', { class: 'muted sm', text: '  ' + (c.total > 1 || q2.kind === 'each' ? c.have + ' of ' + c.total : WORDS[c.state]) + (c.absent ? ', ' + c.absent + ' not held' : '') })]),
          el('div', { class: 'sm muted', text: [PARTS[q2.part] || '', q2.out ? 'Diagnose: ' + OUTCOMES[q2.out - 1].toLowerCase() : '', FORMS[q2.form][0], q2.how, 'from depth ' + q2.level].filter(Boolean).join('  ·  ') }),
          q2.mark ? markRow(q2) : null,
          c.lines.length && !q2.mark ? el('ul', { class: 'tl' }, c.lines.slice(0, 12).map(function (l) { return el('li', {}, [document.createTextNode((l.name ? l.name + ': ' : '') + (l.team ? 'for the team to work out' : 'ask ' + l.holder.replace(/^The /, 'the ') + (l.asked ? ' (in round ' + l.round + ')' : ''))), l.answered ? el('span', { class: 'chipok', text: 'answered' }) : null, l.absent ? el('span', { class: 'chipno', text: 'not held' }) : null]); }).concat(c.lines.length > 12 ? [el('li', { class: 'muted', text: 'and ' + (c.lines.length - 12) + ' more' })] : [])) : null]));
      });
      t.appendChild(el('div', { class: 'row', style: 'margin-top:10px' }, [el('a', { class: 'btn sm', href: '/diagnose#request', text: 'Open the evidence request' })]));
      bar.appendChild(t);
    }
    if (before) box.insertBefore(bar, before); else box.appendChild(bar);
  }
  function markRow(q2) {
    var cur = checks()[q2.id], inp = el('input', { type: 'text', value: cur || '', placeholder: 'What was done, by whom, when' });
    return el('div', { class: 'row', style: 'margin-top:6px' }, [inp, el('button', { class: 'btn sm', 'data-mark': q2.id, text: cur ? 'Update' : 'Record it', onclick: async function () { var c = content('evforms'); c.checks = c.checks || {}; c.checks[q2.id] = inp.value.trim(); await X.saveRow('evforms', c, 'partly'); X.render(); } })]);
  }
  // A "?" on each part of the drawing that is missing something.
  function flags(id, root) {
    var at = {};
    forModel(id).forEach(function (c) { c.lines.forEach(function (l) { if (l.at && !l.absent) (at[l.at] = at[l.at] || []).push(c.req.label); }); });
    Object.keys(at).forEach(function (k) {
      Array.prototype.forEach.call(root.querySelectorAll('[data-id="' + k + '"]'), function (n) {
        if (n.namespaceURI === 'http://www.w3.org/2000/svg') {
          var b; try { b = n.getBBox(); } catch (e) { return; }
          var g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'qflag'); g.setAttribute('pointer-events', 'none');
          g.innerHTML = '<title>' + esc(at[k].join('; ')) + '</title><circle cx="' + (b.x + 6) + '" cy="' + (b.y + 6) + '" r="8"/><text x="' + (b.x + 6) + '" y="' + (b.y + 10) + '" text-anchor="middle">?</text>';
          n.parentNode.insertBefore(g, n.nextSibling);
        } else if (!n.querySelector('.qflagh')) { n.style.position = n.style.position || 'relative'; n.appendChild(el('span', { class: 'qflagh', title: at[k].join('; '), text: '?' })); }
      });
    });
  }

  // =====================================================================
  // Diagnose: the four forms of evidence, with the records and the gaps in each.
  // =====================================================================
  function formOf(src) { var c = content('evforms'), t = c.map && c.map[src.id]; if (t && typeof t === 'object') t = t.form; return t || KIND_FORM[src.kind] || 'context'; }
  async function saveEvforms(c) { await X.saveRow('evforms', c, 'partly'); }
  function renderAnalyse(main) {
    var srcs = (S.data.sources || []), counts = {}, gapsBy = {};
    Object.keys(FORMS).forEach(function (f) { counts[f] = 0; gapsBy[f] = 0; });
    srcs.forEach(function (x) { counts[formOf(x)]++; });
    all().forEach(function (c) { c.lines.forEach(function (l) { if (!l.absent) gapsBy[c.req.form]++; }); });
    X.head(S.data.session.name || 'Diagnose', 'Diagnose', null);
    var wrap = el('div', { class: 'anlay' });
    // the graphic: four circles round the model, after Briner, Denyer and Rousseau (2009), Figure 1
    var W = 640, H = 520, cx = W / 2, cy = H / 2, d = 92, pos = { context: [cx - d, cy - d * .7], stake: [cx + d, cy - d * .7], judge: [cx - d, cy + d * .7], external: [cx + d, cy + d * .7] }, mx = Math.max(1, Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; })));
    var s = '';
    Object.keys(FORMS).forEach(function (f) { var r = 92 + 30 * counts[f] / mx, p = pos[f]; s += '<a href="#evidence=' + f + '" class="evc f-' + f + (counts[f] ? '' : ' none') + '" data-form="' + f + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '"/></a>'; });
    // labels sit in the outer part of each circle, on a pill of their own so they are easy to click
    Object.keys(FORMS).forEach(function (f) { var p = pos[f], ox = (p[0] < cx ? -1 : 1) * 48, oy = (p[1] < cy ? -1 : 1) * 46, lx = p[0] + ox, ly = p[1] + oy, nm = FORMS[f][0].replace(' and judgement', '').replace(' and values', '').replace('Evaluated external', 'External'), w = Math.max(nm.length * 7.6, 120) + 18;
      s += '<a href="#evidence=' + f + '" class="evl" data-form="' + f + '"><rect class="evp" x="' + (lx - w / 2) + '" y="' + (ly - 22) + '" width="' + w + '" height="40" rx="12"/><text class="mt b" x="' + lx + '" y="' + (ly - 4) + '" text-anchor="middle">' + esc(nm) + '</text><text class="mt sm" x="' + lx + '" y="' + (ly + 12) + '" text-anchor="middle">' + counts[f] + (counts[f] === 1 ? ' record · ' : ' records · ') + gapsBy[f] + ' to find</text></a>'; });
    s += '<a href="#model"><circle class="evm" cx="' + cx + '" cy="' + cy + '" r="52"/><text class="mt b" x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle">The models</text></a>';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'msvg evsvg'); svg.innerHTML = s;
    var L = el('div', { class: 'glass evbox' }, [el('div', { class: 'flab', text: 'The four forms of evidence' }), svg, el('p', { class: 'meta', text: 'After Briner, Denyer and Rousseau (2009). The model sits where the four meet. Each circle is sized by how many records the team holds in that form; a dashed circle means none yet. Click a circle to see its records and what is still to find.' })]);
    wrap.appendChild(L); main.appendChild(wrap);
  }
  function outcomesBox() {
    var cs = all(), box = el('div', { class: 'glass evbox' }, [el('div', { class: 'flab', text: 'Is it good enough? The eleven outcomes' })]);
    var ul = el('ol', { class: 'outs' });
    OUTCOMES.forEach(function (o, i) {
      var mine = cs.filter(function (c) { return c.req.out === i + 1 && c.state !== 'na'; }), done = mine.filter(function (c) { return c.state === 'have' || c.state === 'absent'; }).length;
      var st = !mine.length ? 'na' : done === mine.length ? 'have' : done ? 'part' : 'miss';
      ul.appendChild(el('li', { class: 'out ' + st }, [el('i', { class: 'nd ' + st }), document.createTextNode(o), el('span', { class: 'muted sm', text: mine.length ? '  ' + done + ' of ' + mine.length : '  nothing needed at this depth' })]));
    });
    box.appendChild(ul); return box;
  }
  function renderEvidence(main, f) {
    X.head(S.data.session.name || 'Diagnose', FORMS[f][0], FORMS[f][1]);
    main.insertBefore(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: '#analyse', text: '← The four forms' })]), main.firstChild);
    var srcs = (S.data.sources || []).filter(function (x) { return formOf(x) === f; });
    var box = el('div', { class: 'glass evbox' }, [el('div', { class: 'flab', text: 'Records in this form (' + srcs.length + ')' })]);
    if (!srcs.length) box.appendChild(el('p', { class: 'meta', text: 'None yet.' }));
    srcs.forEach(function (x) {
      var sel = el('select', { 'data-src': x.id }, Object.keys(FORMS).map(function (k) { return el('option', { value: k, text: FORMS[k][0] }); })); sel.value = f;
      sel.addEventListener('change', async function () { var c = content('evforms'); c.map = c.map || {}; var t = c.map[x.id]; if (t && typeof t === 'object') t.form = sel.value; else c.map[x.id] = sel.value; await saveEvforms(c); X.render(); });
      box.appendChild(el('div', { class: 'evrow' }, [el('a', { href: '/frame#source=' + x.id, text: x.title }), el('span', { class: 'muted sm', text: (x.speaker || '') + (x.source_date ? ' · ' + x.source_date : '') }), sel]));
    });
    main.appendChild(box);
    var gaps = []; all().forEach(function (c) { if (c.req.form === f) c.lines.forEach(function (l) { if (!l.absent) gaps.push(l); }); });
    var g = el('div', { class: 'glass evbox' }, [el('div', { class: 'flab', text: 'Still to find in this form (' + gaps.length + ')' })]);
    g.appendChild(X.table(['What', 'For', 'Ask', 'Models'], gaps.map(function (l) { return [l.req.label + (l.name ? ': ' + l.name : ''), l.q || 'The team works this out', l.team ? 'The team' : l.holder, l.req.models.map(function (id) { var md = X.modelName(id); return md; }).join(', ')]; })));
    main.appendChild(g);
  }

  // =====================================================================
  // The evidence request: generated from the gaps, grouped by who answers, sent in rounds.
  // =====================================================================
  function renderRequest(main) {
    var rs = reqState(), A = answers(), pending = askable().filter(function (l) { return !rs.items[l.key]; });
    var nextN = (rs.rounds.reduce(function (a, r) { return Math.max(a, r.n); }, 0)) + 1;
    X.head(S.data.session.name || 'Diagnose', 'The evidence request', 'Worked out from what the models still need at depth ' + level() + ', not from a standard checklist. Grouped by who should answer, sent in numbered rounds. Each item can be answered three ways: upload it, we have something else, or we don’t have this. A "we don’t have this" is kept as a finding.');
    main.insertBefore(el('div', { class: 'spread no-print', style: 'margin-bottom:12px' }, [el('a', { class: 'btn sm', href: '#analyse', text: '← Diagnose' })]), main.firstChild);
    var msg = el('span', { class: 'msg', id: 'rqMsg' });
    main.appendChild(el('div', { class: 'row no-print', style: 'margin-top:14px' }, [
      el('button', { class: 'btn sm warm', id: 'rqSend', disabled: !pending.length, text: pending.length ? 'Send round ' + nextN + ' (' + pending.length + (pending.length === 1 ? ' item)' : ' items)') : 'Nothing new to send', onclick: async function () {
        var c = reqState(); c.rounds = c.rounds.concat([{ n: nextN, sent_at: new Date().toISOString() }]);
        pending.forEach(function (l) { c.items[l.key] = { text: l.q, holder: l.holder, round: nextN, label: l.req.label, name: l.name, models: l.req.models, status: 'asked' }; });
        try { await X.saveRow('request', c, 'partly'); X.render(); } catch (e) { msg.className = 'msg bad'; msg.textContent = e.message; }
      } }),
      el('button', { class: 'btn sm', id: 'rqDoc', text: 'Download for the sponsor (Word)', onclick: function () { wordDoc(); } }),
      el('button', { class: 'btn sm', id: 'rqCsv', text: 'Spreadsheet (CSV)', onclick: function () { var it = reqState().items; X.download('evidence-request.csv', X.csv([['Round', 'Who should answer', 'What we need', 'Status']].concat(Object.keys(it).map(function (k) { var a = A[k]; return [it[k].round, it[k].holder, it[k].text, statusWord(it[k], a)]; })))); } }), msg]));
    main.appendChild(el('p', { class: 'meta', text: 'Answers can also be given inside the Lab: anyone who joins the session with its code can open "The evidence request" from the joining screen and answer each item there.' }));
    // what is out with the client, by holder
    var by = {}; Object.keys(rs.items).forEach(function (k) { var it = rs.items[k]; (by[it.holder] = by[it.holder] || []).push([k, it]); });
    Object.keys(by).sort().forEach(function (h) {
      var p = el('div', { class: 'glass evbox rqgroup', 'data-holder': h }, [el('div', { class: 'flab', text: h + ' (' + by[h].length + ')' })]);
      by[h].sort(function (a, b) { return a[1].round - b[1].round; }).forEach(function (kv) {
        var k = kv[0], it = kv[1], a = A[k];
        p.appendChild(el('div', { class: 'rqi' }, [el('div', {}, [el('span', { class: 'rnd', text: 'Round ' + it.round }), el('span', { text: it.text })]), el('div', { class: 'row' }, [el('span', { class: 'st2 ' + (a ? a.choice : it.status), text: statusWord(it, a) }), a ? el('a', { class: 'btn sm', href: '/frame#source=' + a.id, text: 'Read the answer' }) : null,
          it.status !== 'closed' ? el('button', { class: 'btn sm', text: 'Entered in the model', onclick: async function () { var c = reqState(); c.items[k].status = 'closed'; await X.saveRow('request', c, 'partly'); X.render(); } }) : null])]));
      });
      main.appendChild(p);
    });
    if (pending.length) {
      var q = el('div', { class: 'glass evbox' }, [el('div', { class: 'flab', text: 'Not yet sent (' + pending.length + ')' })]);
      q.appendChild(X.table(['Who should answer', 'What we need', 'For'], pending.map(function (l) { return [l.holder, l.q, l.req.models.map(X.modelName).join(', ')]; })));
      main.appendChild(q);
    }
  }
  function statusWord(it, a) { if (it.status === 'closed') return 'Entered in the model'; if (!a) return 'Asked, not yet answered'; return a.choice === 'upload' ? 'Uploaded' : a.choice === 'none' ? 'We don’t have this (a finding)' : 'Something else offered'; }
  function wordDoc() {
    var rs = reqState(), by = {}, nm = S.data.session.name || '';
    Object.keys(rs.items).forEach(function (k) { var it = rs.items[k]; if (it.status === 'closed') return; (by[it.holder] = by[it.holder] || []).push(it); });
    var h = '<html><head><meta charset="utf-8"><title>Evidence request</title><style>body{font-family:Arial,sans-serif;color:#000;font-size:11pt}h1{font-size:16pt}h2{font-size:12pt;margin-top:18pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:4pt;vertical-align:top;font-size:10pt}th{background:#ddd;text-align:left}</style></head><body>';
    h += '<h1>Evidence request: ' + esc(nm) + '</h1><p>These are the documents and facts we need for the work. They are grouped by who is likely to hold them. For each item, please do one of three things: send it, tell us what you have instead, or tell us you don’t have it. "We don’t have this" is a useful answer, and we record it as one. Please do not send anything that names patients, customers or members of staff unless we have asked for it with a reason.</p><p>You can also answer each item online: go to lab.viabilitythinking.com, join with the session code you were given, and open "The evidence request".</p>';
    Object.keys(by).sort().forEach(function (k) { h += '<h2>' + esc(k) + '</h2><table><tr><th style="width:8%">Round</th><th>What we need</th><th style="width:28%">Your answer</th></tr>' + by[k].map(function (it) { return '<tr><td>' + it.round + '</td><td>' + esc(it.text) + '</td><td>&#9744; Sent &nbsp; &#9744; Something else &nbsp; &#9744; We don’t have this</td></tr>'; }).join('') + '</table>'; });
    h += '<p>Please reply within ten working days. Thank you.</p></body></html>';
    X.download('evidence-request-' + nm.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() + '.doc', h, 'application/msword');
  }

  window.VTNeeds = { init: function (x) { X = x; el = x.el; esc = x.esc; S = x.S; }, panel: panel, flags: flags, forModel: forModel, readiness: readiness, all: all, askable: askable, level: level, renderAnalyse: renderAnalyse, renderEvidence: renderEvidence, renderRequest: renderRequest, formOf: formOf, outcomesBox: outcomesBox, OUTCOMES: OUTCOMES, FORMS: FORMS, LEVELS: LEVELS, REQS: REQS };
})();
