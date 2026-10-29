/* SUTHER'S CUP — Browser-only tournament control.
   No accounts, no backend, and no secrets. Data is stored in localStorage;
   user-exported JSON is the portable authoritative backup. */
(function () {
  'use strict';
  const Core = window.SuthersCore;
  const EXPECTED_CORE_BUILD = 'suthers-34-mcintyre-hotfix-20261030';
  // Check for a partially deployed update rather than silently rejecting new finals formats.
  if (!Core || Core.BUILD_ID !== EXPECTED_CORE_BUILD) {
    const message = 'The tournament draw engine is not the matching version. Upload index.html, app-20261030-fix.js and tournament-core-20261030-fix.js together, then refresh. Your saved results have not been changed.';
    const error = document.getElementById('setup-error');
    if (error) { error.textContent = message; error.hidden = false; }
    const preview = document.getElementById('draw-preview');
    if (preview) { preview.className = 'draw-preview preview-error'; preview.textContent = message; }
    return;
  }
  const DEFAULT_BRACKET = 'mcintyre8';
  const SETUP_DEFAULTS_VERSION = 2;
  const STORAGE_KEY = 'suthers-cup-edition-34-v1';
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
      setup: { count: 8, names: Array(8).fill(''), maxMatches: 24, minMatches: '', bracket: DEFAULT_BRACKET },
      tournament: null, koResults: {}, seedOverride: null, ui: { subtab: 'round-robin' }, savedAt: null
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
      return Core.isValidSnapshot(parsed) ? normaliseState(parsed.state || parsed) : null;
    } catch (e) { autosaveHealthy = false; return null; }
  }
  const localCopy = loadSaved();
  let state = localCopy || defaultState();

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
    icon.classList.toggle('warning', !autosaveHealthy);
    if (!autosaveHealthy) {
      status.textContent = 'Automatic saving unavailable';
      detail.textContent = 'Download a JSON backup now and avoid refreshing until your progress is secured.';
      return;
    }
    status.textContent = state.savedAt ? 'Saved automatically on this device' : 'Local autosave is ready';
    let time = '';
    if (state.savedAt) {
      try { time = new Date(state.savedAt).toLocaleString('en-NZ', {dateStyle:'medium',timeStyle:'short'}); } catch (e) { /* no-op */ }
    }
    detail.textContent = time ? 'Last saved ' + time + ' · Not synced between devices' : 'Saved separately in each browser; download backups during the event.';
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
    $('home-event-copy').textContent = recent ? recent.winner + ' claimed the 34th Suther’s Cup, with ' + recent.runnerUp + ' as runner-up. Explore the full scorecard.' : 'Create a balanced draw, tap match winners, and watch the knockout bracket take shape automatically.';
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
    saveState();
  }
  function renderManager() {
    const t=state.tournament;
    $('setup-panel').hidden=!!t;
    $('tournament-panel').hidden=!t;
    const isDone=!!currentOutcome();
    $('event-state-label').textContent = isDone?'CHAMPION CROWNED':t?'TOURNAMENT IN PROGRESS':'READY TO SET UP';
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
    $('draw-facts').innerHTML = `<strong>${t.roundRobin.length}</strong> unique group matches · <strong>${escapeHTML(Core.knockoutName(t))}</strong> · <strong>${t.maxMatches}</strong> game cap · <strong>${t.minRoundRobinGames}</strong> minimum per entrant`;
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
    const slot = (name,id) => `<button type="button" class="match-player ${id && m.winnerId===id?'winner':id && m.winnerId?'loser':''}" ${!id || !m.aId || !m.bId?'disabled':''} ${isKO?'data-ko-match':'data-rr-match'}="${mId}" ${isKO?'data-ko-winner':'data-rr-winner'}="${escapeHTML(id||'')}" aria-label="${name?'Select '+escapeHTML(name)+' as winner':'Awaiting player'}" aria-pressed="${!!(id && m.winnerId===id)}"><span class="${name?'':'placeholder'}">${escapeHTML(name || 'To be determined')}</span><span class="win-check" aria-hidden="true">${id && m.winnerId===id?'✓':''}</span></button>`;
    const label = stageName || ('FIXTURE ' + m.id.replace('rr-','').padStart(2,'0'));
    return `<article class="match-card ${m.winnerId?'complete':''}"><div class="match-card-head"><span>${escapeHTML(label)}</span><span class="result-status">${status}</span></div>${slot(a,m.aId)}${slot(b,m.bId)}${m.winnerId?`<div class="match-card-bottom"><button type="button" class="match-clear" ${isKO?'data-ko-clear':'data-rr-clear'}="${mId}">Clear result</button></div>`:''}</article>`;
  }
  function renderStandings(t,bracket) {
    const ranked=Core.statsFor(t), seededIds=bracket.ready?bracket.seeds.slice(0,t.qualifierCount):[];
    return `<section class="panel score-panel"><div class="panel-heading"><div><span class="panel-icon">▦</span><h2>Standings</h2></div><small>${bracket.ready?'FINAL STANDINGS':'LIVE · PROVISIONAL'}</small></div><div class="table-scroll"><table class="data-table standings-table"><thead><tr><th scope="col">#</th><th scope="col">PLAYER</th><th scope="col">P</th><th scope="col">W</th><th scope="col">L</th><th scope="col">WIN %</th></tr></thead><tbody>${ranked.map(p=>`<tr><td><span class="rank-pill ${seededIds.includes(p.id)?'qualified':''}">${p.rank}</span></td><td class="standings-name">${escapeHTML(p.name)}</td><td>${p.played}</td><td>${p.wins}</td><td>${p.losses}</td><td class="rate">${p.played?percent(p.winRate):'—'}</td></tr>`).join('')}</tbody></table></div><div class="qualifier-note"><strong>${bracket.ready?'Top '+t.qualifierCount+' seeded into knockouts.':'All group games must be recorded before the bracket seeds itself.'}</strong><br>Order: win percentage, wins, direct head-to-head for a two-way tie, opponents’ win percentage, then name. Ties may be manually reseeded by agreement.</div></section>`;
  }
  function renderRoundRobin(t,bracket) {
    const done=t.roundRobin.filter(m=>m.winnerId).length, left=t.roundRobin.length-done;
    const html=`<div class="note-block"><strong>How scoring works:</strong> tap the winner in each match card. The standings recalculate instantly. Round-robin opponents are unique and player appearance counts differ by no more than one. Once all <strong>${t.roundRobin.length}</strong> matches have results, the top <strong>${t.qualifierCount}</strong> players automatically appear in the knockout bracket.</div><div class="scoreboard-layout">${renderStandings(t,bracket)}<section class="panel fixtures-panel"><div class="fixtures-toolbar"><div><h3>Round-robin fixtures</h3><small>${done} recorded · ${left} remaining</small></div><button type="button" id="next-unplayed" class="button button-minor" ${!left?'disabled':''}>Next unplayed ↓</button></div><div class="progress-track" aria-hidden="true"><span style="width:${100*done/t.roundRobin.length}%"></span></div><p class="progress-text">${done} of ${t.roundRobin.length} games completed</p><div class="fixtures-grid">${t.roundRobin.map(m=>matchHTML(t,m,null,false)).join('')}</div></section></div>`;
    $('round-robin-view').innerHTML=html;
  }
  function renderKnockout(t, bracket) {
    const el=$('knockout-view');
    if(!bracket.ready) {
      const remaining=t.roundRobin.filter(m=>!m.winnerId).length;
      el.innerHTML=`<div class="empty-state"><div class="empty-icon">8</div><h2>The knockout awaits.</h2><p>Record the remaining <strong>${remaining}</strong> round-robin ${remaining===1?'game':'games'}. The top ${t.qualifierCount} finishers will be seeded automatically, and each winner will advance to the next match.</p><button type="button" class="button button-gold" data-switch-tab="round-robin">Go to round robin ↗</button></div>`;
      return;
    }
    const seedNames=bracket.seeds.map((id,i)=>({id,name:nameById(t,id),rank:i+1}));
    el.innerHTML=`<div class="note-block"><strong>Bracket is live:</strong> tap the winning player to advance them automatically. Changing a previous knockout winner recalculates subsequent pairings and clears any now-invalid later result. The seed order below can be changed by agreement; this resets recorded knockout results. The 9-game finals formats retain their original seedings throughout the series.</div><div class="knockout-screen"><section class="panel bracket-panel"><h2>The road to the Cup</h2><p class="bracket-intro">${escapeHTML(Core.knockoutName(t))} · ${Core.knockoutMatchCount(t)} finals matches · one champion</p><div class="bracket-grid" style="--bracket-columns:${bracket.stages.length===4?2:bracket.stages.length}">${bracket.stages.map(stage=>`<div class="bracket-stage"><h3>${escapeHTML(stage.name)}</h3>${stage.note?`<p class="bracket-intro">${escapeHTML(stage.note)}</p>`:``}${stage.matches.map((m,i)=>matchHTML(t,m,stage.matches.length===1?'THE DECIDER':stage.name.toUpperCase()+' '+(i+1),true)).join('')}</div>`).join('')}</div></section><aside class="knockout-aside"><section class="panel"><h3>Official seeding</h3><p>Based on the completed round robin. Use arrows only if players agree to a different tie-break or seed order.</p><ol class="seeding-list">${seedNames.slice(0,t.qualifierCount).map(p=>`<li><span>#${p.rank} ${escapeHTML(p.name)}</span><span class="seed-move-controls"><button type="button" data-move-seed="${escapeHTML(p.id)}" data-direction="-1" ${p.rank===1?'disabled':''} aria-label="Move ${escapeHTML(p.name)} up">↑</button><button type="button" data-move-seed="${escapeHTML(p.id)}" data-direction="1" aria-label="Move ${escapeHTML(p.name)} down">↓</button></span></li>`).join('')}</ol></section><section class="panel"><h3>${bracket.outcome?'Champion confirmed':'The final prize'}</h3><p>${bracket.outcome?`<strong>${escapeHTML(nameById(t,bracket.outcome.championId))}</strong> takes the 34th Suther's Cup. The runner-up is <strong>${escapeHTML(nameById(t,bracket.outcome.runnerUpId))}</strong>.`:'Win the final to take home the Cup. Results are saved on this device immediately after each selection.'}</p><button class="button button-gold full-width" type="button" data-switch-tab="summary">Results &amp; archive ↗</button></section></aside></div>`;
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
      html+=`<p>Players: ${t.players.length} · Match cap: ${t.maxMatches} · Round robin: ${t.roundRobin.length} · ${escapeHTML(Core.knockoutName(t))}: ${Core.knockoutMatchCount(t)} · Minimum group games: ${t.minRoundRobinGames}</p>`;
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
      if(!Core.isValidSnapshot(json)) throw new Error('This does not look like a valid Suther\'s Cup Edition #34 backup.');
      if(!window.confirm('Restore this backup? It will replace the draw, entered results, and current setup saved on this device. Download a backup first if you need the current version.')) return;
      state=normaliseState(json.state || json);
      saveState();renderAll();goTo('edition');
      toast('Backup restored successfully.');
    } catch(err) {toast('Restore failed: '+err.message,true);}
  }
  function setRRWinner(matchId,winnerId) {
    const t=state.tournament, match=t?.roundRobin.find(m=>m.id===matchId);
    if(!match || (match.aId!==winnerId && match.bId!==winnerId) || match.winnerId===winnerId) return;
    if(filled(state.koResults)>0 && !window.confirm('Changing a group result will reset recorded knockout results and any manual seed order. Continue?')) return;
    if(filled(state.koResults)>0) {state.koResults={};state.seedOverride=null;}
    match.winnerId=winnerId;
    saveState();renderAll();
    if(Core.allRoundRobinFinished(t)) toast('All round-robin results are in. The knockout bracket is ready!');
  }
  function clearRR(matchId) {
    const t=state.tournament,match=t?.roundRobin.find(m=>m.id===matchId);
    if(!match || !match.winnerId) return;
    if(filled(state.koResults)>0 && !window.confirm('Clearing this group result will also clear the knockout scores. Continue?')) return;
    match.winnerId=null;state.koResults={};state.seedOverride=null;
    saveState();renderAll();
  }
  function setKOWinner(matchId,winnerId) {
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
    if(!state.tournament || !Core.allRoundRobinFinished(state.tournament))return;
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
    const analysed=Core.analyseSetup(state.setup);
    if(!analysed.ok){$('setup-error').textContent=analysed.errors.join(' ');$('setup-error').hidden=false;toast('Check the setup fields.',true);return;}
    $('setup-error').hidden=true;
    try {state.tournament=Core.createDraw(state.setup);state.koResults={};state.seedOverride=null;state.ui.subtab='round-robin';saveState();renderAll();toast('Balanced draw created and saved locally.');}
    catch(e){$('setup-error').textContent=e.message;$('setup-error').hidden=false;toast('Could not create draw.',true);}
  }
  function rebuild() {
    const hasResults=!!state.tournament?.roundRobin.some(m=>m.winnerId) || filled(state.koResults)>0;
    if(!window.confirm(hasResults ? 'Return to setup and discard the existing draw and ALL recorded results? Export JSON first if you need a backup.' : 'Discard the existing draw and return to setup?'))return;
    state.tournament=null;state.seedOverride=null;state.koResults={};
    saveState();renderAll();toast('Setup is now editable. Your entered names were retained.');
  }
  async function fetchPublished() {
    // Only passive, static reading: no tokens and no writes from browser.
    try {
      const r=await fetch('data/edition34.json',{cache:'no-store'});
      if(!r.ok)return;
      const data=await r.json();
      if(data && Core.isValidSnapshot(data) && data.state?.tournament) {
        publishedSnapshot=data;
        $('load-published-btn').disabled=false;
        $('published-detail').textContent='A published snapshot is available'+(data.exportedAt?' · '+new Date(data.exportedAt).toLocaleDateString('en-NZ'):'')+'.';
        if(!localCopy) {state=normaliseState(data.state);saveState();renderAll();}
      }
    } catch(e) { /* local file:// testing may not permit fetch; site still works */ }
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
      if(target.dataset.subtab){setTournamentUI(target.dataset.subtab);return;}
      if(target.dataset.switchTab){setTournamentUI(target.dataset.switchTab);return;}
      if(target.dataset.rrMatch){setRRWinner(target.dataset.rrMatch,target.dataset.rrWinner);return;}
      if(target.dataset.rrClear){clearRR(target.dataset.rrClear);return;}
      if(target.dataset.koMatch){setKOWinner(target.dataset.koMatch,target.dataset.koWinner);return;}
      if(target.dataset.koClear){clearKO(target.dataset.koClear);return;}
      if(target.dataset.moveSeed){moveSeed(target.dataset.moveSeed,Number(target.dataset.direction));return;}
      if(target.id==='next-unplayed'){
        const t=state.tournament, first=t?.roundRobin.findIndex(m=>!m.winnerId);
        const matchCards=$('round-robin-view').querySelectorAll('.fixtures-grid .match-card');
        if(first>=0&&matchCards[first])matchCards[first].scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if(target.id==='generate-draw-btn')generate();
      else if(target.id==='rebuild-btn')rebuild();
      else if(['export-json-btn','summary-json'].includes(target.id))exportJSON();
      else if(['export-csv-btn','summary-csv'].includes(target.id))exportCSV();
      else if(['print-btn','summary-pdf'].includes(target.id)){renderPrint();window.print();}
      else if(target.id==='import-json-btn')$('import-file-input').click();
      else if(target.id==='load-published-btn' && publishedSnapshot) {
        if(window.confirm('Load the published snapshot? This overwrites your current browser results. Export JSON first if needed.')){state=normaliseState(publishedSnapshot.state);saveState();renderAll();goTo('edition');toast('Published snapshot loaded.');}
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
