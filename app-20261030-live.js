/* SUTHER'S CUP — Browser-only tournament control.
   No accounts, no backend, and no secrets. Data is stored in localStorage;
   user-exported JSON is the portable authoritative backup. */
(function () {
  'use strict';
  const Core = window.SuthersCore;
  const EXPECTED_CORE_BUILD = 'suthers-34-official-11-20261030';
  // Check for a partially deployed update rather than silently rejecting new finals formats.
  if (!Core || Core.BUILD_ID !== EXPECTED_CORE_BUILD) {
    const message = 'The tournament draw engine is not the matching version. Upload the complete Edition #34 official-draw patch together, then hard-refresh. Your saved results have not been changed.';
    const error = document.getElementById('setup-error');
    if (error) { error.textContent = message; error.hidden = false; }
    const preview = document.getElementById('draw-preview');
    if (preview) { preview.className = 'draw-preview preview-error'; preview.textContent = message; }
    return;
  }
  const DEFAULT_BRACKET = 'mcintyre8';
  const SETUP_DEFAULTS_VERSION = 2;
  // Preserve the old dynamic-draw localStorage key untouched so the builder can be reinstated later.
  const STORAGE_KEY = 'suthers-cup-edition-34-official-11-v2';
  const EDITOR_KEY = 'suthers-cup-edition-34-organiser-mode';
  const PLAYER_KEY = 'suthers-cup-edition-34-selected-player';
  const FILTER_KEY = 'suthers-cup-edition-34-fixtures-filter';
  const FIXED_EVENT_MODE = true;
  const OFFICIAL = window.SUTHERS_34_OFFICIAL;
  if (!OFFICIAL || !Array.isArray(OFFICIAL.players) || OFFICIAL.players.length !== 11 || OFFICIAL.fixtures?.length !== 44) {
    const error = document.getElementById('setup-error');
    if (error) {error.textContent='Official fixture data is missing. Upload edition34-fixtures-20261030.js with the other patch files.';error.hidden=false;}
    return;
  }
  function getPref(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function setPref(key,value) { try { localStorage.setItem(key,value); } catch (e) { /* preferences unavailable */ } }
  let editorMode = getPref(EDITOR_KEY) === '1';
  let selectedPlayerId = getPref(PLAYER_KEY) || '';
  let fixtureListFilter = ['unplayed','all','completed'].includes(getPref(FILTER_KEY)) ? getPref(FILTER_KEY) : 'unplayed';
  function officialTournament() {
    return {
      edition:34, eventDate:'2026-10-30', createdAt:'2026-10-30T00:00:00+13:00',
      fixtureVersion: OFFICIAL.fixtureVersion, fixtureSource:'Suthers Cup 34.xls / RR (11)',
      maxMatches:53, minRoundRobinGames:8, qualifierCount:8, knockoutFormat:'mcintyre8',
      players:OFFICIAL.players.map((name,i)=>({id:'p'+(i+1),name})),
      roundRobin:OFFICIAL.fixtures.map(([aId,bId],i)=>({id:'rr-'+(i+1),aId,bId,winnerId:null}))
    };
  }
  function officialMatchShape(t) {
    return !!t && t.fixtureVersion === OFFICIAL.fixtureVersion && t.knockoutFormat === 'mcintyre8' &&
      t.qualifierCount === 8 && t.players?.length === 11 && t.roundRobin?.length === 44 &&
      t.players.every((p,i)=>p.id === 'p'+(i+1) && p.name === OFFICIAL.players[i]) &&
      t.roundRobin.every((m,i)=>m.id === 'rr-'+(i+1) && m.aId === OFFICIAL.fixtures[i][0] && m.bId === OFFICIAL.fixtures[i][1]);
  }
  function isOfficialSnapshot(value) {
    return Core.isValidSnapshot(value) && officialMatchShape((value.state || value).tournament);
  }
  const BASE_HISTORY = window.SUTHERS_HISTORY || [];
  let historyRows = BASE_HISTORY.slice();
  let publishedSnapshot = null;
  let autosaveHealthy = true;
  let toastTimer = null;
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const nameById = (t, id) => t && t.players.find(p => p.id === id)?.name || '';
  const numberFormat = x => Number(x).toLocaleString('en-NZ');
  const percent = x => (100*x).toFixed(x === 1 || x === 0 ? 0 : 1) + '%';
  const filled = obj => Object.values(obj || {}).filter(Boolean).length;

  function defaultState() {
    return {
      setupDefaultsVersion: SETUP_DEFAULTS_VERSION,
      setup: { count: 11, names: OFFICIAL.players.slice(), maxMatches: 53, minMatches: 8, bracket: DEFAULT_BRACKET },
      tournament: officialTournament(), koResults: {}, seedOverride: null, ui: { subtab: 'round-robin' }, savedAt: null
    };
  }
  function normaliseState(source) {
    const base = defaultState();
    const s = source && typeof source === 'object' ? source : {};
    const count = Math.max(2, Math.min(24, Math.floor(Number(s.setup?.count) || 8)));
    const sourceNames = Array.isArray(s.setup?.names) ? s.setup.names : [];
    const savedBracket = String(s.setup?.bracket ?? '');
    // The former site's default was 'auto'. Migrate older saved setups once.
    // The existing tournament and all scored results remain unchanged.
    const legacyAuto = Number(s.setupDefaultsVersion || 1) < SETUP_DEFAULTS_VERSION && savedBracket === 'auto';
    const recognisedBracket = ['auto', '2', '4', '8', 'mcintyre8', 'nrl8'].includes(savedBracket);
    const selectedBracket = legacyAuto || !recognisedBracket ? DEFAULT_BRACKET : savedBracket;
    base.setup = {
      count, names: Array.from({ length: count }, (_,i) => String(sourceNames[i] || '').slice(0,100)),
      maxMatches: s.setup?.maxMatches ?? 24,
      minMatches: s.setup?.minMatches ?? '',
      bracket: selectedBracket
    };
    base.tournament = s.tournament || null;
    base.koResults = s.koResults && typeof s.koResults === 'object' ? s.koResults : {};
    base.seedOverride = Array.isArray(s.seedOverride) ? s.seedOverride : null;
    base.savedAt = typeof s.savedAt === 'string' ? s.savedAt : null;
    base.ui = { subtab: ['round-robin','knockout','summary'].includes(s.ui?.subtab) ? s.ui.subtab : 'round-robin' };
    return base;
  }
  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isOfficialSnapshot(parsed) ? normaliseState(parsed.state || parsed) : null;
    } catch (e) { autosaveHealthy = false; return null; }
  }
  const localCopy = loadSaved();
  let state = editorMode && localCopy ? localCopy : defaultState();

  function snapshot() {
    return { schemaVersion: 1, event: "Suther's Cup", edition: 34, eventDate: '2026-10-30', exportedAt: new Date().toISOString(), state };
  }
  function saveState() {
    try {
      state.savedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      autosaveHealthy = true;
    } catch (e) { autosaveHealthy = false; }
    showSaveStatus();
  }
  function showSaveStatus() {
    const status = $('save-status'), detail = $('save-detail'), icon = $('save-icon');
    if (!status) return;
    document.body.classList.toggle('scoring-mode', editorMode);
    icon.classList.toggle('warning', editorMode && !autosaveHealthy);
    const editButton = $('edit-mode-btn');
    if (editButton) {
      editButton.textContent = editorMode ? '✓ Scoring mode ON' : '✎ Enter results';
      editButton.setAttribute('aria-pressed',String(editorMode));
      editButton.classList.toggle('is-scoring',editorMode);
    }
    if (!editorMode) {
      status.textContent = publishedSnapshot ? 'Viewing published results' : 'Official draw loaded · view-only';
      detail.textContent = publishedSnapshot ? 'Read-only · press Refresh scores to check for GitHub updates.' : '44 official fixtures ready · awaiting public JSON snapshot.';
      return;
    }
    if (!autosaveHealthy) {
      status.textContent = 'Automatic saving unavailable';
      detail.textContent = 'Download JSON now. Avoid refreshing until your results are backed up.';
      return;
    }
    status.textContent = 'Scoring mode · results saved locally';
    detail.textContent = 'NOT published until you download edition34.json and commit it to GitHub.';
  }
  function toast(message, isError) {
    const el = $('toast');
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3300);
  }
  function goTo(view) {
    const valid = ['home','history','rules','edition'].includes(view) ? view : 'home';
    if (window.location.hash !== '#' + valid) window.location.hash = valid;
    setView(valid);
    window.scrollTo({top: 0, behavior: 'instant'});
  }
  function setView(view) {
    const current = ['home','history','rules','edition'].includes(view) ? view : 'home';
    document.querySelectorAll('.view').forEach(section => {
      section.hidden = section.id !== 'view-' + current;
      section.classList.toggle('active', !section.hidden);
    });
    document.querySelectorAll('.nav-button').forEach(button => {
      const active = button.dataset.nav === current;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    document.title = ({home:"Suther's Cup", history:'Hall of Fame', rules:'Cup Rules', edition:'Edition #34 · Tournament Manager'})[current] + " | Suther's Cup";
  }
  function currentOutcome() {
    if (!state.tournament) return null;
    const bracket = Core.getKnockout(state.tournament, state.koResults, state.seedOverride);
    return bracket.outcome ? {
      edition: 34, date: 'Oct-26',
      winner: nameById(state.tournament, bracket.outcome.championId),
      runnerUp: nameById(state.tournament, bracket.outcome.runnerUpId),
      isCurrent: true
    } : null;
  }
  function allHistory() {
    const current = currentOutcome();
    const all = historyRows.filter(r => !current || r.edition !== 34);
    return current ? [current, ...all].sort((a,b)=>b.edition-a.edition) : all.sort((a,b)=>b.edition-a.edition);
  }
  function leadersFrom(rows) {
    const map = new Map();
    for (const item of rows) {
      if (!map.has(item.winner)) map.set(item.winner, {name:item.winner,wins:0,finals:0});
      if (!map.has(item.runnerUp)) map.set(item.runnerUp, {name:item.runnerUp,wins:0,finals:0});
      map.get(item.winner).wins++;
      map.get(item.winner).finals++;
      map.get(item.runnerUp).finals++;
    }
    return [...map.values()].sort((a,b) => b.wins - a.wins || b.finals - a.finals || a.name.localeCompare(b.name));
  }
  function renderHome() {
    const rows = allHistory(), leaders = leadersFrom(rows);
    const recent = currentOutcome();
    $('hero-intro').textContent = recent ? 'Thirty-four editions in the record books. ' + recent.winner + ' is the latest name to join the legends.' : 'Thirty-three chapters in the record books. One trophy everyone wants. A new name waiting to be etched.';
    $('hero-chapter-label').innerHTML = recent ? 'CHAMPION<br>CROWNED' : 'THE NEXT<br>CHAPTER';
    $('home-event-title').textContent = recent ? 'A new name on the trophy.' : "Who's taking the cup home?";
    $('home-event-copy').textContent = recent ? recent.winner + ' claimed the 34th Suther’s Cup, with ' + recent.runnerUp + ' as runner-up. Explore the full scorecard.' : 'Find your eight opponents, check results, and follow the official McIntyre finals.';
    $('home-event-button').innerHTML = recent ? 'View final results <span aria-hidden="true">↗</span>' : 'Open tournament manager <span aria-hidden="true">↗</span>';
    $('home-stats').innerHTML = [
      ['★', rows.length, 'Recorded editions'],
      ['♛', leaders.length, 'Different finalists'],
      ['8', leaders.filter(p=>p.wins>0).length, 'Different champions'],
      ['↗', '#34', recent ? 'Completed · 30 Oct' : 'Next chapter · 30 Oct']
    ].map(([icon,num,label])=>{
      const symbol = icon === '8'
        ? '<img class="stat-symbol stat-eightball-icon" src="assets/eight-ball-icon.svg" alt="" aria-hidden="true">'
        : `<span class="stat-symbol" aria-hidden="true">${escapeHTML(icon)}</span>`;
      return `<div class="hero-stat">${symbol}<div><strong>${escapeHTML(num)}</strong><small>${escapeHTML(label)}</small></div></div>`;
    }).join('');
    $('home-leaders').innerHTML = leaders.slice(0,3).map((p,i) => `<div class="mini-row"><span>${i+1}. ${escapeHTML(p.name)}</span><strong>${p.wins} ${p.wins===1?'title':'titles'}</strong></div>`).join('');
  }
  function renderHistory() {
    const rows = allHistory(), leaders = leadersFrom(rows), q = $('history-search').value.trim().toLocaleLowerCase();
    const filtered = rows.filter(r => [r.edition, r.date, r.winner,r.runnerUp].some(x=>String(x).toLocaleLowerCase().includes(q)));
    const maxWins = Math.max(...leaders.map(p=>p.wins),1);
    $('history-edition-total').textContent = rows.length;
    $('history-stat-grid').innerHTML = [
      ['RECORD TITLES', leaders[0]?.wins ?? '—', leaders[0]?.name ?? ''],
      ['MOST FINALS', Math.max(...leaders.map(p=>p.finals),0), leaders.slice().sort((a,b)=>b.finals-a.finals)[0]?.name ?? ''],
      ['FIRST RECORDED', 'APR 2004', 'Edition #1'],
      ['LATEST CHAMPION', rows[0]?.winner || '—', 'Edition #'+(rows[0]?.edition || '')]
    ].map(([label,big,small])=>`<div class="history-stat"><span>${escapeHTML(label)}</span><strong>${escapeHTML(big)}</strong><small>${escapeHTML(small)}</small></div>`).join('');
    $('history-body').innerHTML = filtered.length ? filtered.map(r=>`<tr class="${r.isCurrent?'current-edition-row':''}"><td class="edition-cell">#${r.edition}${r.isCurrent?' *':''}</td><td>${escapeHTML(r.date)}</td><td class="winner-cell">${escapeHTML(r.winner)}</td><td>${escapeHTML(r.runnerUp)}</td></tr>`).join('') : '<tr><td colspan="4">No results match your search.</td></tr>';
    $('history-footer').textContent = rows.length + ' editions shown in the archive · ' + filtered.length + ' matching result(s).' + (currentOutcome()?' * Edition #34 is from the active browser/snapshot. Publish your JSON to share it.':' Historical results supplied by the organisers.');
    $('champion-leaderboard').innerHTML = leaders.filter(p=>p.wins>0).slice(0,10).map((p,i)=>`<div class="leader-entry"><div class="leader-header"><span><span class="leader-rank">${String(i+1).padStart(2,'0')}</span>${escapeHTML(p.name)}</span><span class="leader-count">${p.wins} ${p.wins===1?'WIN':'WINS'}</span></div><div class="leader-bar"><span style="width:${(100*p.wins/maxWins).toFixed(1)}%"></span></div></div>`).join('');
  }
  function setupFromForm() { return state.setup; }
  function renderNameInputs() {
    $('name-inputs').innerHTML = state.setup.names.map((name,i)=>`<label class="player-entry"><span aria-hidden="true">${i+1}.</span><span class="sr-only">Player ${i+1} name</span><input data-player-index="${i}" type="text" maxlength="100" autocomplete="off" spellcheck="false" placeholder="Player ${i+1}" value="${escapeHTML(name)}" aria-label="Player ${i+1} name"></label>`).join('');
  }
  function fillSetup() {
    $('player-count').value = state.setup.count;
    $('max-matches').value = state.setup.maxMatches;
    $('min-matches').value = state.setup.minMatches;
    $('bracket-choice').value = state.setup.bracket;
    renderNameInputs();
    updatePreview();
  }
  function previewOnlySetup() {
    const count = Math.max(0,Math.min(30,Number(state.setup.count) || 0));
    return {...setupFromForm(), names: Array.from({length:count},(_,i)=>'Player '+(i+1))};
  }
  function updatePreview() {
    const result = Core.analyseSetup(previewOnlySetup());
    const el = $('draw-preview');
    if (!result.ok) {
      el.className = 'draw-preview preview-error';
      el.innerHTML = '<h3>Adjust your setup</h3><p>' + result.errors.map(escapeHTML).join(' ') + '</p>';
      return;
    }
    const p = result.plan;
    el.className = 'draw-preview';
    const finalsExplanation = p.knockoutFormat === 'mcintyre8'
      ? 'The <b>McIntyre Final Eight</b> has 9 finals: 4 qualifying, 2 semi-finals, 2 preliminary finals and the grand final. Original seedings influence byes and elimination.'
      : p.knockoutFormat === 'nrl8'
      ? 'The <b>NRL-style Final Eight</b> has 9 finals: 4 opening games, 2 semi-finals, 2 preliminary finals and the grand final. Top-four seeds have a double chance.'
      : 'The top <b>' + p.qualifierCount + '</b> then compete in a straight knockout.';
    el.innerHTML = `<h3>Your game plan</h3><div class="preview-counts"><div><strong>${p.roundRobinGames}</strong><span>Round robin</span></div><div><strong>${p.knockoutGames}</strong><span>Knockout</span></div><div><strong>${p.totalGames}</strong><span>Total matches</span></div></div><p>Each player gets <b>${p.minPerPlayer}${p.minPerPlayer===p.maxPerPlayer?'':'–'+p.maxPerPlayer}</b> unique round-robin opponents. ${finalsExplanation} ${p.totalGames<p.budget?'The draw uses fewer than your maximum because all possible round-robin pairings are included.':'The match cap is fully allocated.'}</p>`;
  }
  function setTournamentUI(subtab) {
    const next = ['round-robin','knockout','summary'].includes(subtab) ? subtab : 'round-robin';
    state.ui.subtab = next;
    document.querySelectorAll('[data-subtab]').forEach(b=>b.classList.toggle('active',b.dataset.subtab===next));
    document.querySelectorAll('.subview').forEach(e=>e.hidden=e.id !== 'subview-'+next);
    if (editorMode) saveState();
  }
  function renderManager() {
    const t=state.tournament;
    $('setup-panel').hidden=FIXED_EVENT_MODE || !!t;
    $('tournament-panel').hidden=!t;
    $('rebuild-btn').hidden=FIXED_EVENT_MODE;
    const isDone=!!currentOutcome();
    $('event-state-label').textContent = isDone?'CHAMPION CROWNED':editorMode?'SCORING MODE · LOCAL':publishedSnapshot?'PUBLIC SCOREBOARD':'OFFICIAL DRAW';
    $('event-state').classList.toggle('complete', isDone);
    if (!t) { fillSetup(); showSaveStatus(); return; }
    const rrPlayed=t.roundRobin.filter(m=>!!m.winnerId).length;
    const bracket=Core.getKnockout(t,state.koResults,state.seedOverride);
    const knockoutGames=Core.knockoutMatchCount(t);
    const completed=rrPlayed+bracket.completed;
    const total=t.roundRobin.length+knockoutGames;
    $('live-kpis').innerHTML = [
      ['PLAYERS',t.players.length,'Entered'],
      ['GAMES PLAYED',completed+' / '+total,((100*completed/total)||0).toFixed(0)+'% complete'],
      ['ROUND ROBIN',rrPlayed+' / '+t.roundRobin.length,'Results recorded'],
      ['KNOCKOUT',bracket.completed+' / '+knockoutGames,bracket.outcome?'Champion confirmed':bracket.ready?'Bracket is live':'Awaiting seeding']
    ].map(([label,big,small],i)=>`<div class="live-kpi"><span>${escapeHTML(label)}</span><strong class="${i===1?'accent':''}">${escapeHTML(big)}</strong><small>${escapeHTML(small)}</small></div>`).join('');
    $('draw-facts').innerHTML = `<strong>${t.roundRobin.length}</strong> fixed round-robin matches · <strong>8 per player</strong> · <strong>2 non-opponents each</strong> · <strong>${escapeHTML(Core.knockoutName(t))}</strong> (${Core.knockoutMatchCount(t)} finals)`;
    renderRoundRobin(t,bracket);
    renderKnockout(t,bracket);
    renderSummary(t,bracket);
    document.querySelectorAll('[data-subtab]').forEach(b=>b.classList.toggle('active',b.dataset.subtab===state.ui.subtab));
    document.querySelectorAll('.subview').forEach(e=>e.hidden=e.id !== 'subview-'+state.ui.subtab);
    showSaveStatus();
  }
  function matchHTML(t, m, stageName, isKO) {
    const status=m.winnerId?'COMPLETED':m.aId && m.bId?'AWAITING RESULT':'AWAITING PLAYERS';
    const mId=escapeHTML(m.id), a=m.aId ? nameById(t,m.aId):'', b=m.bId?nameById(t,m.bId):'';
    const slot = (name,id) => {
      const active = !!(editorMode && id && m.aId && m.bId);
      const label = m.winnerId === id ? name+' — winner' : m.winnerId ? name+' — lost' : name + (active ? ' — select as winner' : ' — not played');
      return `<button type="button" class="match-player ${!editorMode?'viewer-only':''} ${id && m.winnerId===id?'winner':id && m.winnerId?'loser':''}" ${!active?'disabled':''} ${isKO?'data-ko-match':'data-rr-match'}="${mId}" ${isKO?'data-ko-winner':'data-rr-winner'}="${escapeHTML(id||'')}" aria-label="${escapeHTML(name ? label : 'Awaiting player')}" aria-pressed="${!!(id && m.winnerId===id)}"><span class="${name?'':'placeholder'}">${escapeHTML(name || 'To be determined')}</span><span class="win-check" aria-hidden="true">${id && m.winnerId===id?'✓':''}</span></button>`;
    };
    const label = stageName || ('MATCH ' + m.id.replace('rr-','').padStart(2,'0'));
    return `<article class="match-card ${m.winnerId?'complete':''}"><div class="match-card-head"><span>${escapeHTML(label)}</span><span class="result-status">${status}</span></div>${slot(a,m.aId)}${slot(b,m.bId)}${m.winnerId&&editorMode?`<div class="match-card-bottom"><button type="button" class="match-clear" ${isKO?'data-ko-clear':'data-rr-clear'}="${mId}">Clear result</button></div>`:''}</article>`;
  }
  function renderStandings(t,bracket) {
    const ranked=Core.statsFor(t), seededIds=bracket.ready?bracket.seeds.slice(0,t.qualifierCount):[];
    return `<section class="panel score-panel"><div class="panel-heading"><div><span class="panel-icon">▦</span><h2>Standings</h2></div><small>${bracket.ready?'FINAL STANDINGS':'LIVE · PROVISIONAL'}</small></div><div class="table-scroll"><table class="data-table standings-table"><thead><tr><th scope="col">#</th><th scope="col">PLAYER</th><th scope="col">P</th><th scope="col">W</th><th scope="col">L</th><th scope="col">LEFT</th><th scope="col">WIN %</th></tr></thead><tbody>${ranked.map(p=>`<tr><td><span class="rank-pill ${seededIds.includes(p.id)?'qualified':''}">${p.rank}</span></td><td class="standings-name">${escapeHTML(p.name)}</td><td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td><td>${8-p.played}</td><td class="rate">${p.played?percent(p.winRate):'—'}</td></tr>`).join('')}</tbody></table></div><div class="qualifier-note"><strong>${bracket.ready?'Top '+t.qualifierCount+' seeded into knockouts.':'All group games must be recorded before the bracket seeds itself.'}</strong><br>Final rankings are by total wins (all players have eight scheduled games). Until everyone finishes, win rate is shown provisionally. Any tie-break or seed-order change must be agreed by the organiser; seed arrows are available in scoring mode.</div></section>`;
  }
  function renderRoundRobin(t,bracket) {
    const done=t.roundRobin.filter(m=>m.winnerId).length, left=t.roundRobin.length-done;
    const byPair = new Map(t.roundRobin.map(m=>[[m.aId,m.bId].sort().join('|'),m]));
    const matchFor=(a,b)=>byPair.get([a,b].sort().join('|'));
    if (!t.players.some(p=>p.id===selectedPlayerId)) selectedPlayerId='';
    const focus=t.players.find(p=>p.id===selectedPlayerId);
    const focusMatches=focus ? t.roundRobin.filter(m=>m.aId===focus.id || m.bId===focus.id) : [];
    const excluded=focus ? t.players.filter(p=>p.id!==focus.id && !matchFor(p.id,focus.id)) : [];
    const focusPlayed=focusMatches.filter(m=>m.winnerId);
    const focusWins=focusPlayed.filter(m=>m.winnerId===focus?.id).length;
    const selectHtml=`<section class="panel player-lookup-panel"><div class="lookup-heading"><div><p class="section-eyebrow">FIND YOUR FIXTURES</p><h2>Who are you playing?</h2><p>Select your name to see all eight fixtures, plus the two players you won’t face.</p></div><label class="player-lookup-input"><span class="sr-only">Choose a player</span><select id="player-filter"><option value="">Choose your name…</option>${t.players.map(p=>`<option value="${escapeHTML(p.id)}" ${p.id===selectedPlayerId?'selected':''}>${escapeHTML(p.name)}</option>`).join('')}</select></label></div><div class="player-chip-row" role="group" aria-label="Quickly select a player">${t.players.map(p=>`<button type="button" data-player-focus="${escapeHTML(p.id)}" class="player-chip ${p.id===selectedPlayerId?'selected':''}" aria-pressed="${p.id===selectedPlayerId}">${escapeHTML(p.name)}</button>`).join('')}</div></section>`;
    let spotlight='';
    if (focus) {
      const fixtures=focusMatches.slice().sort((a,b)=>Number(!!a.winnerId)-Number(!!b.winnerId)||Number(a.id.slice(3))-Number(b.id.slice(3)));
      spotlight=`<section class="player-focus-panel panel"><div class="focus-topline"><div><p class="section-eyebrow">YOUR OFFICIAL DRAW</p><h2>${escapeHTML(focus.name)}'s eight matches</h2></div><div class="focus-score"><strong>${focusWins} W</strong><span>${focusPlayed.length} / 8 played</span></div></div><div class="focus-schedule-grid">${fixtures.map(m=>matchHTML(t,m,'VS '+nameById(t,m.aId===focus.id?m.bId:m.aId).toUpperCase(),false)).join('')}</div><div class="excluded-strip"><div><strong>NOT PLAYING</strong><span>These two opponents are excluded from your round robin.</span></div><div class="excluded-chips">${excluded.map(p=>`<span>${escapeHTML(p.name)}</span>`).join('')}</div></div></section>`;
    } else {
      spotlight='<p class="pick-name-hint">↑ Pick your name above for your personalised eight-match card and two non-opponents.</p>';
    }
    const table=`<details class="matrix-details panel" ${window.innerWidth>=900?'open':''}><summary><span class="matrix-summary"><strong>11-player matchup matrix</strong><small>✔ Scheduled · × Not playing · W / L Recorded result</small></span><span class="matrix-chevron" aria-hidden="true">⌄</span></summary><div class="matrix-legend"><span><i class="legend-scheduled"></i> Scheduled</span><span><i class="legend-win"></i> Win</span><span><i class="legend-loss"></i> Loss</span><span><i class="legend-none"></i> No match</span></div><div class="matrix-scroll" role="region" aria-label="All player matchups; scroll horizontally on a phone" tabindex="0"><table class="fixture-matrix"><thead><tr><th scope="col" class="matrix-label-head">PLAYER ↘</th>${t.players.map(p=>`<th scope="col" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</th>`).join('')}</tr></thead><tbody>${t.players.map(p=>`<tr class="${p.id===selectedPlayerId?'matrix-selected':''}"><th scope="row">${escapeHTML(p.name)}</th>${t.players.map(q=>{if(p.id===q.id)return '<td class="matrix-self" aria-label="Same player">·</td>';const m=matchFor(p.id,q.id);if(!m)return `<td class="matrix-no" title="${escapeHTML(p.name)} does not play ${escapeHTML(q.name)}" aria-label="No match against ${escapeHTML(q.name)}">×</td>`;const won=m.winnerId===p.id, lost=!!m.winnerId&&!won;return `<td class="${won?'matrix-won':lost?'matrix-lost':'matrix-pending'}" title="${escapeHTML(p.name)} vs ${escapeHTML(q.name)}: ${won?'won':lost?'lost':'scheduled'}" aria-label="Against ${escapeHTML(q.name)}: ${won?'won':lost?'lost':'not yet played'}">${won?'W':lost?'L':'●'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="matrix-footnote">Each row has eight scheduled matches (●) and two omitted opponents (×). Choose your name above for an easier mobile view.</p></details>`;
    const visible=t.roundRobin.filter(m=>fixtureListFilter==='all'||(fixtureListFilter==='completed'?!!m.winnerId:!m.winnerId));
    const fullList=`<details class="all-fixtures-details panel" id="all-fixtures-details" ${editorMode?'open':''}><summary><span><strong>All match cards</strong><small>${done} completed · ${left} remaining · match numbers are reference numbers, not a playing order</small></span><span aria-hidden="true">⌄</span></summary><div class="fixtures-toolbar"><label for="fixture-list-filter">Show</label><select id="fixture-list-filter"><option value="unplayed" ${fixtureListFilter==='unplayed'?'selected':''}>Unplayed (${left})</option><option value="all" ${fixtureListFilter==='all'?'selected':''}>All 44</option><option value="completed" ${fixtureListFilter==='completed'?'selected':''}>Completed (${done})</option></select><button type="button" id="next-unplayed" class="button button-minor" ${!left?'disabled':''}>First unplayed ↓</button></div><div class="fixtures-grid">${visible.length?visible.map(m=>matchHTML(t,m,null,false)).join(''):'<p class="no-fixtures-msg">No matches in this filter.</p>'}</div></details>`;
    const intro=`<div class="note-block"><strong>Official spreadsheet draw:</strong> 11 players, 44 fixed round-robin games, eight different opponents each. The two non-opponents for each player are shown above. <strong>${editorMode?'Scoring mode is on: tap a winner to record it.':'Public viewing mode: scores are read-only. The organiser uses Enter results to score games.'}</strong> The top eight finishers qualify for the nine-game McIntyre finals.</div>`;
    $('round-robin-view').innerHTML=intro+selectHtml+spotlight+`<div class="fixed-rr-layout">${renderStandings(t,bracket)}${table}</div>`+fullList;
  }
  function renderKnockout(t, bracket) {
    const el=$('knockout-view');
    if(!bracket.ready) {
      const remaining=t.roundRobin.filter(m=>!m.winnerId).length;
      el.innerHTML=`<div class="panel bracket-panel"><p class="section-eyebrow">FROM THE WORKBOOK · FINALS TAB</p><h2>Original McIntyre Final Eight</h2><p class="bracket-intro">The top eight finishers qualify. Enter the remaining ${remaining} round-robin ${remaining===1?'result':'results'} before names can be seeded automatically.</p><div class="knockout-instruction-grid"><div><strong>ROUND 1 · QUARTER-FINALS</strong><p>1st v 8th · 2nd v 7th · 3rd v 6th · 4th v 5th. The highest-ranked two winners advance directly to preliminary finals; the lowest-ranked two losers are eliminated.</p></div><div><strong>ROUND 2 · SEMI-FINALS</strong><p>4th-highest-ranked winner v 2nd-highest-ranked loser. 3rd-highest-ranked winner v highest-ranked loser. Both winners advance.</p></div><div><strong>ROUND 3 · PRELIMINARY FINALS</strong><p>Highest-ranked quarter-final winner v winner of first semi. Second-highest-ranked quarter-final winner v winner of second semi.</p></div><div><strong>ROUND 4 · GRAND FINAL</strong><p>The two preliminary-final winners meet for the Suther’s Cup.</p></div></div><button type="button" class="button button-gold" data-switch-tab="round-robin">View round-robin fixtures ↗</button></div>`;
      return;
    }
    const seedNames=bracket.seeds.map((id,i)=>({id,name:nameById(t,id),rank:i+1}));
    el.innerHTML=`<div class="note-block"><strong>Spreadsheet finals system:</strong> 1st v 8th, 2nd v 7th, 3rd v 6th, 4th v 5th in the quarter-finals. The two highest-ranked winners receive a bye, two lowest-ranked losers exit, and the remaining four play the semi-finals. ${editorMode?'Tap a match winner to advance them. Changing an earlier result automatically clears incompatible later results.':'The bracket is view-only; only the organiser can record results.'}</div><div class="knockout-screen"><section class="panel bracket-panel"><h2>The road to the Cup</h2><p class="bracket-intro">${escapeHTML(Core.knockoutName(t))} · ${Core.knockoutMatchCount(t)} finals matches · one champion</p><div class="bracket-grid" style="--bracket-columns:${bracket.stages.length===4?2:bracket.stages.length}">${bracket.stages.map(stage=>`<div class="bracket-stage"><h3>${escapeHTML(stage.name)}</h3>${stage.note?`<p class="bracket-intro">${escapeHTML(stage.note)}</p>`:``}${stage.matches.map((m,i)=>matchHTML(t,m,stage.matches.length===1?'THE DECIDER':stage.name.toUpperCase()+' '+(i+1),true)).join('')}</div>`).join('')}</div></section><aside class="knockout-aside"><section class="panel"><h3>Finals seed order</h3><p>Based on the completed round robin. The organiser must settle any tied ranks before finals start.</p><ol class="seeding-list">${seedNames.slice(0,t.qualifierCount).map(p=>`<li><span>#${p.rank} ${escapeHTML(p.name)}</span><span class="seed-move-controls" ${editorMode?'':'hidden'}><button type="button" data-move-seed="${escapeHTML(p.id)}" data-direction="-1" ${p.rank===1?'disabled':''} aria-label="Move ${escapeHTML(p.name)} up">↑</button><button type="button" data-move-seed="${escapeHTML(p.id)}" data-direction="1" aria-label="Move ${escapeHTML(p.name)} down">↓</button></span></li>`).join('')}</ol></section><section class="panel"><h3>${bracket.outcome?'Champion confirmed':'The final prize'}</h3><p>${bracket.outcome?`<strong>${escapeHTML(nameById(t,bracket.outcome.championId))}</strong> takes the 34th Suther's Cup. The runner-up is <strong>${escapeHTML(nameById(t,bracket.outcome.runnerUpId))}</strong>.`:'Win the final to take home the Cup. Results are saved on this device immediately after each selection.'}</p><button class="button button-gold full-width" type="button" data-switch-tab="summary">Results &amp; archive ↗</button></section></aside></div>`;
  }
  function renderSummary(t,bracket) {
    const rrComplete=t.roundRobin.filter(m=>!!m.winnerId).length;
    const total=t.roundRobin.length+Core.knockoutMatchCount(t);
    const done=rrComplete+bracket.completed;
    const outcome=bracket.outcome;
    const downtrou=Core.statsFor(t).filter(p=>p.played>0 && p.wins===0 && t.roundRobin.filter(m=>m.aId===p.id||m.bId===p.id).every(m=>!!m.winnerId)).map(p=>p.name);
    const downtrouNote=downtrou.length ? `<p class="note-block"><strong>Downtrou alert:</strong> ${escapeHTML(downtrou.join(', '))} ${downtrou.length===1?'has':'have'} lost every scheduled round-robin game. This is one trigger in the original Cup rules. The other trigger (losing without potting any ball) cannot be determined from win/loss results alone.</p>` : '';
    const summary=`<section class="panel summary-panel"><h2>Edition #34 scorecard</h2><p>${outcome?'The final is in the books. Save a PDF and JSON backup, then publish the JSON snapshot to update the site for other visitors.':'Your current results can be downloaded at any stage. For a shareable public result, upload the exported JSON to the GitHub repository.'}</p><div class="summary-stats"><div class="summary-stat"><strong>${t.players.length}</strong><span>Competitors</span></div><div class="summary-stat"><strong>${done}/${total}</strong><span>Games finished</span></div><div class="summary-stat"><strong>${t.qualifierCount}</strong><span>Knockout places</span></div></div><div class="summary-actions"><button class="button button-gold" id="summary-json" type="button">↓ Download backup</button><button class="button button-minor" id="summary-pdf" type="button">⎙ Print / PDF</button><button class="button button-minor" id="summary-csv" type="button">↓ CSV</button></div><h2 style="font-size:26px;margin-top:24px">Results overview</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>STAGE</th><th>PLAYED</th><th>REMAINING</th></tr></thead><tbody><tr><td>Round robin</td><td>${rrComplete}</td><td>${t.roundRobin.length-rrComplete}</td></tr><tr><td>Knockout</td><td>${bracket.completed}</td><td>${Core.knockoutMatchCount(t)-bracket.completed}</td></tr></tbody></table></div>${downtrouNote}<p class="summary-small">The source file for the official public archive is <code>data/edition34.json</code>. On GitHub Pages, the site cannot write this file for you; you must commit an exported snapshot manually or add a secure backend later.</p></section>`;
    const aside= outcome ? `<section class="champion-card"><div class="champion-trophy" aria-hidden="true">★</div><p class="eyebrow">2026 SUTHER'S CUP CHAMPION</p><h2>${escapeHTML(nameById(t,outcome.championId))}</h2><p class="runner">Runner-up: <strong>${escapeHTML(nameById(t,outcome.runnerUpId))}</strong></p><button type="button" data-nav="history" class="button button-ghost">See Hall of Fame ↗</button></section>` : `<section class="champion-card"><div class="champion-trophy" aria-hidden="true">8</div><p class="eyebrow">ONE TITLE UP FOR GRABS</p><h2>THE NEXT CHAMPION</h2><p class="runner">The space on the trophy remains unclaimed.</p><button type="button" class="button button-ghost" data-switch-tab="${bracket.ready?'knockout':'round-robin'}">Continue the tournament ↗</button></section>`;
    $('summary-view').innerHTML=`<div class="summary-layout">${summary}${aside}</div>`;
  }
  function renderPrint() {
    const t=state.tournament, rows=allHistory();
    const stamp=new Date().toLocaleString('en-NZ',{dateStyle:'full',timeStyle:'short'});
    let html=`<div class="print-hero"><h1>SUTHER'S CUP</h1><strong>EDITION #34 · FRIDAY 30 OCTOBER 2026</strong><span class="print-label">Record exported ${escapeHTML(stamp)}</span></div>`;
    if(!t) {
      html+='<h2>Draw not yet created</h2><p>Draft setup only. Export JSON to preserve entered names and settings.</p>';
    } else {
      const standings=Core.statsFor(t), ko=Core.getKnockout(t,state.koResults,state.seedOverride);
      html+=`<p>Players: ${t.players.length} · Official draw: ${t.maxMatches} total games · Round robin: ${t.roundRobin.length} · ${escapeHTML(Core.knockoutName(t))}: ${Core.knockoutMatchCount(t)} · Minimum group games: ${t.minRoundRobinGames}</p>`;
      if(ko.outcome) html+=`<p class="print-champion">CHAMPION: ${escapeHTML(nameById(t,ko.outcome.championId))} · RUNNER-UP: ${escapeHTML(nameById(t,ko.outcome.runnerUpId))}</p>`;
      html+='<h2>Final / current standings</h2><table><thead><tr><th>Rank</th><th>Player</th><th>Played</th><th>Wins</th><th>Losses</th><th>Win %</th></tr></thead><tbody>'+
        standings.map(p=>`<tr><td>${p.rank}</td><td>${escapeHTML(p.name)}</td><td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td><td>${p.played?percent(p.winRate):'—'}</td></tr>`).join('')+'</tbody></table>';
      html+='<h2>Round-robin match results</h2><table><thead><tr><th>#</th><th>Player A</th><th>Player B</th><th>Winner</th></tr></thead><tbody>'+t.roundRobin.map((m,i)=>`<tr><td>${i+1}</td><td>${escapeHTML(nameById(t,m.aId))}</td><td>${escapeHTML(nameById(t,m.bId))}</td><td>${escapeHTML(nameById(t,m.winnerId)||'—')}</td></tr>`).join('')+'</tbody></table>';
      if(ko.ready) {
        html+='<h2>Knockout matches</h2><table><thead><tr><th>Round</th><th>Player A</th><th>Player B</th><th>Winner</th></tr></thead><tbody>'+ko.stages.flatMap(st=>st.matches.map(m=>`<tr><td>${escapeHTML(st.name)}</td><td>${escapeHTML(nameById(t,m.aId)||'TBD')}</td><td>${escapeHTML(nameById(t,m.bId)||'TBD')}</td><td>${escapeHTML(nameById(t,m.winnerId)||'—')}</td></tr>`)).join('')+'</tbody></table>';
      }
    }
    html+=`<h2>Champions — recorded history</h2><p>${rows.length} editions in the archive. Full historical breakdown available on the Suther's Cup website.</p><div class="print-foot">This printout is a readable archive, not a recoverable database. Keep the Edition #34 JSON backup to restore the active tournament.</div>`;
    $('print-sheet').innerHTML=html;
  }
  function renderAll() { renderHome();renderHistory();renderManager();renderPrint(); }
  function downloadContent(filename,content,type) {
    const blob=new Blob([content],{type:type||'application/octet-stream'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function exportJSON() {
    if (!isOfficialSnapshot(snapshot())) {toast('The official fixed draw is invalid; export blocked.',true);return;}
    downloadContent('edition34.json',JSON.stringify(snapshot(),null,2)+'\n','application/json;charset=utf-8');
    toast('Portable JSON backup downloaded. Keep it somewhere safe.');
  }
  function csvCell(v) {
    let s=String(v===null||v===undefined?'':v);
    if(/^[\s]*[=+@\-\t\r]/.test(s)) s="'"+s; // prevent spreadsheet formula injection from names
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function exportCSV() {
    const t=state.tournament;
    if(!t) {toast('Create a draw before exporting match results.',true);return;}
    const ko=Core.getKnockout(t,state.koResults,state.seedOverride);
    const rows=[['Stage','Match','Player A','Player B','Winner','Status']];
    t.roundRobin.forEach((m,i)=>rows.push(['Round robin',i+1,nameById(t,m.aId),nameById(t,m.bId),nameById(t,m.winnerId),m.winnerId?'Complete':'Pending']));
    ko.stages.forEach(st=>st.matches.forEach((m,i)=>rows.push([st.name,i+1,nameById(t,m.aId),nameById(t,m.bId),nameById(t,m.winnerId),m.winnerId?'Complete':'Pending'])));
    downloadContent('suthers-cup-34-results.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n','text/csv;charset=utf-8');
    toast('CSV exported. Keep a JSON backup for full recovery.');
  }
  async function importJSON(file) {
    try {
      if(file.size>2_000_000) throw new Error('The file is unexpectedly large.');
      const json=JSON.parse(await file.text());
      if(!isOfficialSnapshot(json)) throw new Error('This is not an Edition #34 official 11-player backup. Other draws cannot replace the fixed spreadsheet fixtures.');
      if(!window.confirm('Restore this backup? It will replace the draw, entered results, and current setup saved on this device. Download a backup first if you need the current version.')) return;
      editorMode=true;setPref(EDITOR_KEY,'1');
      state=normaliseState(json.state || json);
      saveState();renderAll();goTo('edition');
      toast('Backup restored successfully.');
    } catch(err) {toast('Restore failed: '+err.message,true);}
  }
  function setRRWinner(matchId,winnerId) {
    if (!editorMode) return;
    const t=state.tournament, match=t?.roundRobin.find(m=>m.id===matchId);
    if(!match || (match.aId!==winnerId && match.bId!==winnerId) || match.winnerId===winnerId) return;
    if(filled(state.koResults)>0 && !window.confirm('Changing a group result will reset recorded knockout results and any manual seed order. Continue?')) return;
    if(filled(state.koResults)>0) {state.koResults={};state.seedOverride=null;}
    match.winnerId=winnerId;
    saveState();renderAll();
    if(Core.allRoundRobinFinished(t)) toast('All round-robin results are in. The knockout bracket is ready!');
  }
  function clearRR(matchId) {
    if (!editorMode) return;
    const t=state.tournament,match=t?.roundRobin.find(m=>m.id===matchId);
    if(!match || !match.winnerId) return;
    if(filled(state.koResults)>0 && !window.confirm('Clearing this group result will also clear the knockout scores. Continue?')) return;
    match.winnerId=null;state.koResults={};state.seedOverride=null;
    saveState();renderAll();
  }
  function setKOWinner(matchId,winnerId) {
    if (!editorMode) return;
    const t=state.tournament;
    if(!t) return;
    const before=Core.getKnockout(t,state.koResults,state.seedOverride);
    const m=before.stages.flatMap(s=>s.matches).find(m=>m.id===matchId);
    if(!m || !m.aId || !m.bId || ![m.aId,m.bId].includes(winnerId) || m.winnerId===winnerId) return;
    state.koResults[matchId]=winnerId;
    cleanupKnockoutResults();saveState();renderAll();
    if(currentOutcome()) toast('Edition #34 has a champion! Export JSON and save the PDF.');
  }
  function clearKO(matchId) {
    if (!editorMode) return;
    const t=state.tournament;
    if(!t || !state.koResults[matchId]) return;
    delete state.koResults[matchId];
    cleanupKnockoutResults();saveState();renderAll();
  }
  function cleanupKnockoutResults() {
    if(!state.tournament) {state.koResults={};return;}
    const ko=Core.getKnockout(state.tournament,state.koResults,state.seedOverride);
    const valid={};ko.stages.forEach(st=>st.matches.forEach(m=>{if(m.winnerId)valid[m.id]=m.winnerId;}));
    state.koResults=valid;
  }
  function moveSeed(playerId,delta) {
    if(!editorMode || !state.tournament || !Core.allRoundRobinFinished(state.tournament))return;
    const bracket=Core.getKnockout(state.tournament,state.koResults,state.seedOverride),seeds=bracket.seeds;
    const i=seeds.indexOf(playerId),to=i+delta;
    if(i<0||to<0||to>=seeds.length)return;
    if(filled(state.koResults)>0 && !window.confirm('Changing seeding resets all recorded knockout results. Continue?'))return;
    [seeds[i],seeds[to]]=[seeds[to],seeds[i]];
    state.seedOverride=seeds;state.koResults={};
    saveState();renderAll();
    toast('Seed order updated. Knockout matches use the revised order.');
  }
  function generate() {
    if (FIXED_EVENT_MODE) return;
    const analysed=Core.analyseSetup(state.setup);
    if(!analysed.ok){$('setup-error').textContent=analysed.errors.join(' ');$('setup-error').hidden=false;toast('Check the setup fields.',true);return;}
    $('setup-error').hidden=true;
    try {state.tournament=Core.createDraw(state.setup);state.koResults={};state.seedOverride=null;state.ui.subtab='round-robin';saveState();renderAll();toast('Balanced draw created and saved locally.');}
    catch(e){$('setup-error').textContent=e.message;$('setup-error').hidden=false;toast('Could not create draw.',true);}
  }
  function rebuild() {
    if (FIXED_EVENT_MODE) return;
    const hasResults=!!state.tournament?.roundRobin.some(m=>m.winnerId) || filled(state.koResults)>0;
    if(!window.confirm(hasResults ? 'Return to setup and discard the existing draw and ALL recorded results? Export JSON first if you need a backup.' : 'Discard the existing draw and return to setup?'))return;
    state.tournament=null;state.seedOverride=null;state.koResults={};
    saveState();renderAll();toast('Setup is now editable. Your entered names were retained.');
  }
  function enterOrLeaveScoringMode() {
    if (editorMode) {
      if (!window.confirm('Your results remain stored on this device, but they will NOT be visible publicly until you export edition34.json and commit it to GitHub. Leave scoring mode?')) return;
      editorMode=false;setPref(EDITOR_KEY,'0');
      state=publishedSnapshot ? normaliseState(publishedSnapshot.state) : defaultState();
      renderAll();toast('Viewing public results. Your local scoring draft remains saved.');
      return;
    }
    const draft=loadSaved();
    if (draft && (draft.tournament?.roundRobin?.some(m=>m.winnerId) || filled(draft.koResults)>0)) {
      if (!window.confirm('A saved scoring draft exists on this device. Resume it? Choose Cancel to continue viewing published results.')) return;
      state=draft;
    }
    editorMode=true;setPref(EDITOR_KEY,'1');saveState();renderAll();
    toast('Scoring enabled on this device. Download JSON to publish results.');
  }
  async function fetchPublished(showFeedback=false) {
    try {
      const response=await fetch('data/edition34.json?v='+Date.now(),{cache:'no-store'});
      if(!response.ok) throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(!isOfficialSnapshot(data)) throw new Error('The uploaded snapshot does not match the fixed 11-player draw.');
      publishedSnapshot=data;
      $('load-published-btn').disabled=false;
      let stamp='Unknown time';
      try {stamp=new Date(data.exportedAt).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'});} catch(e) { /* display fallback */ }
      $('published-detail').textContent='GitHub snapshot available · '+stamp;
      $('published-timestamp').textContent='PUBLISHED · '+stamp;
      if (!editorMode) {
        const currentTab=state.ui.subtab;
        state=normaliseState(data.state);
        state.ui.subtab=currentTab;
        renderAll();
      } else { showSaveStatus(); }
      if(showFeedback) toast(editorMode ? 'Published snapshot checked; your local scoring draft is unchanged.' : 'Latest published scores loaded.');
      return true;
    } catch(error) {
      $('published-detail').textContent='Could not load the public JSON: '+error.message;
      $('published-timestamp').textContent='OFFICIAL FIXTURES · PUBLIC RESULTS UNAVAILABLE';
      if(showFeedback) toast('Public results could not be loaded. Check the GitHub JSON.',true);
      return false;
    }
  }
  async function fetchHistory() {
    try {
      const r=await fetch('data/history.json',{cache:'no-store'});
      if(!r.ok)return;
      const value=await r.json();
      if(Array.isArray(value) && value.length>=33 && value.length<=100 && value.every(x=>Number.isInteger(x.edition)&&x.edition>=1&&x.edition<=100&&typeof x.date==='string'&&typeof x.winner==='string'&&typeof x.runnerUp==='string')) {
        const numbers=new Set(value.map(v=>v.edition));
        if(numbers.size===value.length) {historyRows=value.slice();renderHome();renderHistory();renderPrint();}
      }
    } catch(e) { /* historical data embedded in history.js is always available */ }
  }
  function hookEvents() {
    window.addEventListener('hashchange',()=>setView(window.location.hash.slice(1)));
    document.addEventListener('click',e=>{
      const target=e.target.closest('button');if(!target)return;
      if(target.dataset.nav){goTo(target.dataset.nav);return;}
      if(target.dataset.playerFocus){
        selectedPlayerId=target.dataset.playerFocus;setPref(PLAYER_KEY,selectedPlayerId);
        renderRoundRobin(state.tournament,Core.getKnockout(state.tournament,state.koResults,state.seedOverride));
        return;
      }
      if(target.dataset.subtab){setTournamentUI(target.dataset.subtab);return;}
      if(target.dataset.switchTab){setTournamentUI(target.dataset.switchTab);return;}
      if(target.dataset.rrMatch){setRRWinner(target.dataset.rrMatch,target.dataset.rrWinner);return;}
      if(target.dataset.rrClear){clearRR(target.dataset.rrClear);return;}
      if(target.dataset.koMatch){setKOWinner(target.dataset.koMatch,target.dataset.koWinner);return;}
      if(target.dataset.koClear){clearKO(target.dataset.koClear);return;}
      if(target.dataset.moveSeed){moveSeed(target.dataset.moveSeed,Number(target.dataset.direction));return;}
      if(target.id==='next-unplayed'){
        if (fixtureListFilter==='completed') {fixtureListFilter='unplayed';setPref(FILTER_KEY,fixtureListFilter);renderRoundRobin(state.tournament,Core.getKnockout(state.tournament,state.koResults,state.seedOverride));}
        const details=$('all-fixtures-details');if(details)details.open=true;
        const firstCard=$('all-fixtures-details')?.querySelector('.fixtures-grid .match-card');
        if(firstCard)firstCard.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if(target.id==='edit-mode-btn'){enterOrLeaveScoringMode();return;}
      if(target.id==='refresh-public-btn'){fetchPublished(true);return;}
      if(target.id==='generate-draw-btn')generate();
      else if(target.id==='rebuild-btn')rebuild();
      else if(['export-json-btn','summary-json'].includes(target.id))exportJSON();
      else if(['export-csv-btn','summary-csv'].includes(target.id))exportCSV();
      else if(['print-btn','summary-pdf'].includes(target.id)){renderPrint();window.print();}
      else if(target.id==='import-json-btn')$('import-file-input').click();
      else if(target.id==='load-published-btn' && publishedSnapshot) {
        if(!editorMode || window.confirm('Replace the local scoring draft with published GitHub results? Download a JSON backup first if needed.')){
          state=normaliseState(publishedSnapshot.state);if(editorMode)saveState();renderAll();goTo('edition');toast('Published snapshot loaded.');
        }
      }
    });
    document.addEventListener('change',e=>{
      if(e.target.id==='player-filter') {
        selectedPlayerId=e.target.value;setPref(PLAYER_KEY,selectedPlayerId);
        renderRoundRobin(state.tournament,Core.getKnockout(state.tournament,state.koResults,state.seedOverride));
      }
      if(e.target.id==='fixture-list-filter') {
        fixtureListFilter=e.target.value;setPref(FILTER_KEY,fixtureListFilter);
        renderRoundRobin(state.tournament,Core.getKnockout(state.tournament,state.koResults,state.seedOverride));
        const all=$('all-fixtures-details');if(all)all.open=true;
      }
    });
    $('player-count').addEventListener('input',e=>{
      const next=Number(e.target.value);
      state.setup.count=next;
      if(Number.isInteger(next)&&next>=2&&next<=Core.MAX_PLAYERS){
        state.setup.names=Array.from({length:next},(_,i)=>state.setup.names[i]||'');
        renderNameInputs();
      }
      saveState();updatePreview();
    });
    $('name-inputs').addEventListener('input',e=>{
      const index=Number(e.target.dataset.playerIndex);
      if(Number.isInteger(index)&&index>=0&&index<state.setup.names.length){state.setup.names[index]=e.target.value;saveState();$('setup-error').hidden=true;}
    });
    $('max-matches').addEventListener('input',e=>{state.setup.maxMatches=e.target.value;saveState();updatePreview();});
    $('min-matches').addEventListener('input',e=>{state.setup.minMatches=e.target.value;saveState();updatePreview();});
    $('bracket-choice').addEventListener('change',e=>{state.setup.bracket=e.target.value;saveState();updatePreview();});
    $('history-search').addEventListener('input',renderHistory);
    $('import-file-input').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(file)await importJSON(file);e.target.value='';
    });
  }
  hookEvents();
  renderAll();
  setView(window.location.hash.slice(1)||'home');
  fetchHistory();fetchPublished();
})();
