/* Suther's Cup: pure tournament planning and ranking functions. No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SuthersCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const MAX_PLAYERS = 24;
  function asInt(x) { return typeof x === 'string' && !x.trim() ? NaN : Number(x); }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(items, random) { const a = items.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function analyseSetup(setup) {
    const errors = [];
    const count = asInt(setup.count);
    const budget = asInt(setup.maxMatches);
    const blankMin = setup.minMatches === '' || setup.minMatches === null || setup.minMatches === undefined;
    const minRR = blankMin ? 1 : asInt(setup.minMatches);
    const bracketChoice = String(setup.bracket || 'auto');
    if (!Number.isInteger(count) || count < 2 || count > MAX_PLAYERS) errors.push('Enter between 2 and ' + MAX_PLAYERS + ' players.');
    if (!Number.isInteger(budget) || budget < 2 || budget > 1000) errors.push('Maximum total games must be a whole number between 2 and 1,000.');
    if (!Number.isInteger(minRR) || minRR < 1 || (Number.isInteger(count) && minRR > count - 1)) errors.push('Minimum round-robin games must be from 1 to the number of opponents available.');
    if (!['auto', '2', '4', '8'].includes(bracketChoice)) errors.push('Choose a valid knockout format.');
    const names = Array.isArray(setup.names) ? setup.names.slice(0, count).map(v => typeof v === 'string' ? v.trim() : '') : [];
    if (Number.isInteger(count) && count >= 2 && count <= MAX_PLAYERS) {
      if (names.length !== count || names.some(n => !n)) errors.push('Enter a name for every player.');
      const duplicates = names.map(s => s.toLocaleLowerCase());
      if (new Set(duplicates).size !== duplicates.length) errors.push('Player names must be unique.');
    }
    if (errors.length) return { ok: false, errors };
    const minFixtures = Math.ceil(count * minRR / 2);
    const potential = count * (count - 1) / 2;
    const candidates = bracketChoice === 'auto' ? (count >= 4 ? [4, 2] : [2]) : [Number(bracketChoice)];
    let k = null;
    for (const candidate of candidates) {
      if (candidate <= count && minFixtures + candidate - 1 <= budget) { k = candidate; break; }
    }
    if (!k) {
      const candidate = bracketChoice === 'auto' ? 2 : Number(bracketChoice);
      const needed = minFixtures + candidate - 1;
      return { ok: false, errors: [
        candidate > count ? 'A top-' + candidate + ' knockout requires at least ' + candidate + ' entrants.' :
        'This format needs at least ' + needed + ' total games (' + minFixtures + ' round robin plus ' + (candidate - 1) + ' knockout). Increase the cap, lower the minimum, or use a smaller knockout.'
      ] };
    }
    const knockoutGames = k - 1;
    const rrGames = Math.min(potential, budget - knockoutGames);
    const low = Math.floor(2 * rrGames / count);
    const high = Math.ceil(2 * rrGames / count);
    return { ok: true, errors: [], plan: {
      names, count, budget, minRR, qualifierCount: k,
      roundRobinGames: rrGames, knockoutGames, totalGames: rrGames + knockoutGames,
      minPerPlayer: low, maxPerPlayer: high, uniquePairs: potential
    } };
  }
  function createDraw(setup, seed) {
    const analysed = analyseSetup(setup);
    if (!analysed.ok) throw new Error(analysed.errors.join(' '));
    const plan = analysed.plan;
    const n = plan.count, total = plan.roundRobinGames;
    const drawSeed = (seed === undefined ? Math.floor(Math.random() * 4294967296) : Number(seed)) >>> 0;
    const random = mulberry32(drawSeed);
    const order = shuffle([...Array(n).keys()], random);
    const base = Math.floor(total * 2 / n);
    const extra = total * 2 % n;
    const nodes = order.map((id, pos) => ({ id, remaining: base + (pos < extra ? 1 : 0), tie: random() }));
    const edges = [];
    // Havel-Hakimi constructs a simple graph with almost perfectly even degrees.
    // Every edge is a distinct 1-v-1 round-robin fixture.
    while (nodes.some(x => x.remaining > 0)) {
      nodes.sort((a, b) => b.remaining - a.remaining || a.tie - b.tie);
      const head = nodes.shift();
      const degree = head.remaining;
      if (degree > nodes.length) throw new Error('Unable to construct a balanced draw.');
      for (let i = 0; i < degree; i++) {
        if (nodes[i].remaining <= 0) throw new Error('Unable to allocate all fixtures.');
        edges.push([head.id, nodes[i].id]);
        nodes[i].remaining--;
      }
      head.remaining = 0;
      nodes.push(head);
    }
    if (edges.length !== total) throw new Error('Fixture allocation did not reconcile.');
    // Order the selected games to distribute appearances across the evening.
    const played = Array(n).fill(0), lastIndex = Array(n).fill(-1000);
    const ordered = [];
    while (edges.length) {
      let best = 0, bestScore = Infinity;
      edges.forEach(([a,b], idx) => {
        const serial = ordered.length;
        const repeatPenalty = (lastIndex[a] === serial - 1 ? 7 : 0) + (lastIndex[b] === serial - 1 ? 7 : 0);
        const score = (played[a] + played[b]) * 10 + repeatPenalty + random() * 0.9;
        if (score < bestScore) { bestScore = score; best = idx; }
      });
      const [a,b] = edges.splice(best, 1)[0];
      ordered.push({ id: 'rr-' + (ordered.length + 1), aId: 'p' + (a + 1), bId: 'p' + (b + 1), winnerId: null });
      played[a]++; played[b]++; lastIndex[a] = lastIndex[b] = ordered.length - 1;
    }
    return {
      edition: 34, eventDate: '2026-10-30', createdAt: new Date().toISOString(), drawSeed,
      maxMatches: plan.budget, minRoundRobinGames: plan.minRR,
      qualifierCount: plan.qualifierCount,
      players: plan.names.map((name, i) => ({ id: 'p' + (i + 1), name })),
      roundRobin: ordered
    };
  }
  function statsFor(tournament) {
    if (!tournament) return [];
    const map = new Map(tournament.players.map(p => [p.id, {
      ...p, played: 0, wins: 0, losses: 0, winRate: 0, sos: 0, opponents: []
    }]));
    for (const m of tournament.roundRobin) {
      if (!m.winnerId) continue;
      const a = map.get(m.aId), b = map.get(m.bId);
      if (!a || !b) continue;
      a.played++; b.played++;
      a.opponents.push(b.id); b.opponents.push(a.id);
      if (m.winnerId === a.id) { a.wins++; b.losses++; }
      else if (m.winnerId === b.id) { b.wins++; a.losses++; }
    }
    for (const entry of map.values()) entry.winRate = entry.played ? entry.wins / entry.played : 0;
    for (const entry of map.values()) entry.sos = entry.played ? entry.opponents.reduce((acc, other) => acc + map.get(other).winRate, 0) / entry.played : 0;
    const entries = [...map.values()];
    entries.sort((a,b) => b.winRate - a.winRate || b.wins - a.wins || b.sos - a.sos || a.name.localeCompare(b.name));
    // Head-to-head applies only to an otherwise-tied pair; not three-way cycles.
    for (let i = 0; i < entries.length;) {
      const group = entries.filter(p => p.winRate === entries[i].winRate && p.wins === entries[i].wins);
      if (group.length === 2) {
        const [a,b] = group;
        const h2h = tournament.roundRobin.find(m => ((m.aId === a.id && m.bId === b.id) || (m.aId === b.id && m.bId === a.id)) && m.winnerId);
        if (h2h) {
          const iA = entries.findIndex(p => p.id === a.id);
          const iB = entries.findIndex(p => p.id === b.id);
          if (iA > iB && h2h.winnerId === a.id) [entries[iA],entries[iB]] = [entries[iB],entries[iA]];
          if (iB > iA && h2h.winnerId === b.id) [entries[iA],entries[iB]] = [entries[iB],entries[iA]];
        }
      }
      i += Math.max(1, group.length);
    }
    return entries.map((p, i) => ({ ...p, rank: i + 1 }));
  }
  function allRoundRobinFinished(t) { return !!t && t.roundRobin.length > 0 && t.roundRobin.every(m => !!m.winnerId); }
  function getKnockout(tournament, storedResults, seedOverride) {
    if (!allRoundRobinFinished(tournament)) return { ready: false, stages: [], seeds: [], completed: 0, outcome: null };
    const ranking = statsFor(tournament).map(p => p.id);
    const validOverride = Array.isArray(seedOverride) && seedOverride.length === ranking.length &&
      new Set(seedOverride).size === ranking.length && seedOverride.every(id => ranking.includes(id));
    const seeds = validOverride ? seedOverride.slice() : ranking;
    const count = tournament.qualifierCount;
    const pairIndexes = count === 8 ? [[0,7], [3,4], [1,6], [2,5]] : count === 4 ? [[0,3],[1,2]] : [[0,1]];
    const stages = [];
    const levelCount = Math.log2(count);
    for (let r = 0; r < levelCount; r++) {
      const stage = { name: count === 8 && r === 0 ? 'Quarter-finals' : r === levelCount - 1 ? 'Final' : 'Semi-finals', matches: [] };
      const matchesCount = count / Math.pow(2, r + 1);
      for (let i = 0; i < matchesCount; i++) {
        const aId = r === 0 ? seeds[pairIndexes[i][0]] : stages[r-1].matches[2*i].winnerId;
        const bId = r === 0 ? seeds[pairIndexes[i][1]] : stages[r-1].matches[2*i+1].winnerId;
        const id = 'ko-r' + r + '-m' + i;
        const selected = storedResults && storedResults[id];
        const winnerId = aId && bId && (selected === aId || selected === bId) ? selected : null;
        stage.matches.push({ id, aId, bId, winnerId, index: i });
      }
      stages.push(stage);
    }
    const finalMatch = stages[stages.length-1].matches[0];
    const outcome = finalMatch && finalMatch.winnerId ? {
      championId: finalMatch.winnerId,
      runnerUpId: finalMatch.aId === finalMatch.winnerId ? finalMatch.bId : finalMatch.aId
    } : null;
    return { ready: true, stages, seeds, completed: stages.reduce((s, r) => s + r.matches.filter(m => m.winnerId).length, 0), outcome };
  }
  function isValidSnapshot(value) {
    if (!value || typeof value !== 'object') return false;
    const s = value.state || value;
    if (!s.setup || typeof s.setup !== 'object') return false;
    if (!Array.isArray(s.setup.names) || s.setup.names.length > MAX_PLAYERS) return false;
    if (s.tournament === null || s.tournament === undefined) return true;
    const t = s.tournament;
    if (!t || t.edition !== 34 || !Array.isArray(t.players) || !Array.isArray(t.roundRobin) || ![2,4,8].includes(t.qualifierCount)) return false;
    if (t.players.length < 2 || t.players.length > MAX_PLAYERS || t.qualifierCount > t.players.length) return false;
    if (t.players.some((p,i) => !p || p.id !== 'p' + (i+1) || typeof p.name !== 'string' || !p.name.trim())) return false;
    const ids = new Set(t.players.map(p => p.id));
    if (t.roundRobin.length > t.players.length * (t.players.length - 1) / 2) return false;
    const pairs = new Set();
    for (let i = 0; i < t.roundRobin.length; i++) {
      const m = t.roundRobin[i];
      if (!m || m.id !== 'rr-' + (i+1) || !ids.has(m.aId) || !ids.has(m.bId) || m.aId === m.bId) return false;
      if (m.winnerId !== null && m.winnerId !== m.aId && m.winnerId !== m.bId) return false;
      const pair = [m.aId,m.bId].sort().join(':');
      if (pairs.has(pair)) return false;
      pairs.add(pair);
    }
    if (s.koResults && (typeof s.koResults !== 'object' || Object.values(s.koResults).some(id => !ids.has(id)))) return false;
    return true;
  }
  return { MAX_PLAYERS, analyseSetup, createDraw, statsFor, allRoundRobinFinished, getKnockout, isValidSnapshot };
});
