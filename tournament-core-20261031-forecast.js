/* Suther's Cup: pure tournament planning and ranking functions. No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SuthersCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const BUILD_ID = 'suthers-34-forecast-20261031';
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
    if (!['auto', '2', '4', '8', 'mcintyre8', 'nrl8'].includes(bracketChoice)) errors.push('Choose a valid knockout format.');
    const names = Array.isArray(setup.names) ? setup.names.slice(0, count).map(v => typeof v === 'string' ? v.trim() : '') : [];
    if (Number.isInteger(count) && count >= 2 && count <= MAX_PLAYERS) {
      if (names.length !== count || names.some(n => !n)) errors.push('Enter a name for every player.');
      const duplicates = names.map(s => s.toLocaleLowerCase());
      if (new Set(duplicates).size !== duplicates.length) errors.push('Player names must be unique.');
    }
    if (errors.length) return { ok: false, errors };
    const minFixtures = Math.ceil(count * minRR / 2);
    const potential = count * (count - 1) / 2;
    const isNineGame = bracketChoice === 'mcintyre8' || bracketChoice === 'nrl8';
    const candidates = bracketChoice === 'auto' ? (count >= 4 ? [4, 2] : [2]) : [isNineGame ? 8 : Number(bracketChoice)];
    const knockoutGamesForCandidate = candidate => isNineGame ? 9 : candidate - 1;
    let k = null;
    for (const candidate of candidates) {
      if (candidate <= count && minFixtures + knockoutGamesForCandidate(candidate) <= budget) { k = candidate; break; }
    }
    if (!k) {
      const candidate = candidates[candidates.length - 1];
      const games = knockoutGamesForCandidate(candidate);
      const needed = minFixtures + games;
      return { ok: false, errors: [
        candidate > count ? 'A top-' + candidate + ' finals format requires at least ' + candidate + ' entrants.' :
        'This format needs at least ' + needed + ' total games (' + minFixtures + ' round robin plus ' + games + ' finals). Increase the cap, lower the minimum, or use a smaller finals format.'
      ] };
    }
    const knockoutGames = knockoutGamesForCandidate(k);
    const rrGames = Math.min(potential, budget - knockoutGames);
    const low = Math.floor(2 * rrGames / count);
    const high = Math.ceil(2 * rrGames / count);
    return { ok: true, errors: [], plan: {
      names, count, budget, minRR, qualifierCount: k,
      knockoutFormat: isNineGame ? bracketChoice : 'standard',
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
      qualifierCount: plan.qualifierCount, knockoutFormat: plan.knockoutFormat,
      players: plan.names.map((name, i) => ({ id: 'p' + (i + 1), name })),
      roundRobin: ordered
    };
  }
  // Ranking policy (2026): W%, wins, complete mini-league, common opponents,
  // strength of victories, strength of schedule, prior champion, prior runner-up,
  // then recorded first-to-three rock-paper-scissors decisions. Never alphabetise
  // a still-tied ranking into a final knockout seed.
  const PAIR_DELIMITER = '|';
  function pairKey(a, b) { return [a, b].sort().join(PAIR_DELIMITER); }
  function roundedMetric(value) { return Math.round(value * 1e10) / 1e10; }
  function rankingDetails(tournament, rpsDecisions, honours) {
    if (!tournament) return {entries:[],complete:false,ready:false,pendingRps:[],audit:[],rpsUsed:[]};
    const players = tournament.players || [];
    const playerIndex = new Map(players.map((p,i) => [p.id,i]));
    const stats = new Map(players.map(p => [p.id, {
      ...p, played:0, wins:0, losses:0, winRate:0,
      sov:0, sos:0, defeated:[], opponents:[], strengthBreakdown:[],
      rank:0, rankLabel:'', rankReason:''
    }]));
    const matches = new Map();
    for (const match of tournament.roundRobin || []) {
      if (!match.winnerId || !stats.has(match.aId) || !stats.has(match.bId)) continue;
      matches.set(pairKey(match.aId, match.bId), match.winnerId);
      const a = stats.get(match.aId), b = stats.get(match.bId);
      a.played++; b.played++;
      a.opponents.push(b.id); b.opponents.push(a.id);
      if (match.winnerId === a.id) {a.wins++;b.losses++;a.defeated.push(b.id);}
      else if (match.winnerId === b.id) {b.wins++;a.losses++;b.defeated.push(a.id);}
    }
    for (const player of stats.values()) player.winRate = player.played ? player.wins / player.played : 0;
    // The beaten opponent's result AGAINST this player is excluded from its
    // adjusted win rate, reducing circularity in SoV and SoS comparisons.
    for (const player of stats.values()) {
      player.strengthBreakdown = player.opponents.map(otherId => {
        const other = stats.get(otherId);
        const otherWon = matches.get(pairKey(player.id,otherId)) === otherId;
        const adjustedPlayed = other.played - 1;
        const adjustedWins = other.wins - Number(otherWon);
        return {id:otherId, won: !otherWon,
          adjustedWins, adjustedPlayed,
          adjustedRate: adjustedPlayed > 0 ? adjustedWins / adjustedPlayed : 0};
      });
      player.sos = player.strengthBreakdown.length
        ? player.strengthBreakdown.reduce((a,v)=>a+v.adjustedRate,0)/player.strengthBreakdown.length : 0;
      const beaten = player.strengthBreakdown.filter(x=>x.won);
      player.sov = beaten.length ? beaten.reduce((a,v)=>a+v.adjustedRate,0)/beaten.length : 0;
    }
    const complete = !!(tournament.roundRobin && tournament.roundRobin.length && tournament.roundRobin.every(m=>!!m.winnerId));
    const entries = [...stats.values()];
    const initialSort = (a,b)=> b.winRate-a.winRate || b.wins-a.wins || playerIndex.get(a.id)-playerIndex.get(b.id);
    entries.sort(initialSort);
    const pendingRps = [], audit = [], rpsUsed = [], pendingGroups = [];
    const decided = (rpsDecisions && typeof rpsDecisions === 'object') ? rpsDecisions : {};
    const honourIds = {
      champion: honours && stats.has(honours.championId) ? honours.championId : null,
      runnerUp: honours && stats.has(honours.runnerUpId) ? honours.runnerUpId : null
    };
    function displayScore(key, score) {
      if (key === 'sov' || key === 'sos') return (score*100).toFixed(3)+'%';
      if (key === 'champion' || key === 'runnerUp') return score ? 'Beat' : 'Lost to';
      return String(score)+' win'+(score===1?'':'s');
    }
    function metric(group, criterion) {
      const values = new Map();
      let why = '';
      if (criterion==='h2h') {
        if (group.some((p,i)=>group.slice(i+1).some(q=>!matches.has(pairKey(p.id,q.id))))) {
          return {applicable:false,why:'Not every tied player faced every other tied player.'};
        }
        for (const p of group) values.set(p.id,group.filter(q=>q.id!==p.id && matches.get(pairKey(p.id,q.id))===p.id).length);
        why = 'All tied entrants played one another; compare wins in that mini-league.';
      } else if(criterion==='common') {
        const common = group[0].opponents.filter(id=>group.every(p=>p.opponents.includes(id)));
        if (!common.length) return {applicable:false,why:'No opponent was faced by every tied player.'};
        for(const p of group) values.set(p.id,common.filter(id=>matches.get(pairKey(p.id,id))===p.id).length);
        why = 'Wins against the '+common.length+' opponent'+(common.length===1?'':'s')+' all tied players faced: '+common.map(id=>stats.get(id).name).join(', ')+'.';
      } else if(criterion==='sov' || criterion==='sos') {
        for (const p of group) values.set(p.id,roundedMetric(p[criterion]));
        why = criterion==='sov'
          ? 'Mean adjusted win percentage of defeated opponents, excluding each opponent’s result against this player.'
          : 'Mean adjusted win percentage of every opponent faced, excluding each opponent’s result against this player.';
      } else {
        const honourId=honourIds[criterion];
        if (!honourId) return {applicable:false,why:'The previous '+(criterion==='champion'?'champion':'runner-up')+' is not in this tournament.'};
        if (group.some(p=>p.id===honourId || !matches.has(pairKey(p.id,honourId)))) {
          return {applicable:false,why:'Not every tied player faced the previous '+(criterion==='champion'?'champion':'runner-up')+'. No one is penalised for an unplayed match.'};
        }
        for(const p of group) values.set(p.id,Number(matches.get(pairKey(p.id,honourId))===p.id));
        why = 'Result against '+stats.get(honourId).name+', the previous '+(criterion==='champion'?'champion':'runner-up')+'.';
      }
      return {applicable:true,values,why};
    }
    const criteria = [
      ['h2h','Head-to-head mini-league'],['common','Common opponents'],
      ['sov','Strength of victories'],['sos','Strength of schedule'],
      ['champion','Previous champion'],['runnerUp','Previous runner-up']
    ];
    function rpsOrder(group) {
      // Insertion ladder: the initial order is the immutable fixture player ID
      // order, NOT a final seed. Each necessary pair settles a first-to-three
      // RPS contest. A decision is required for every comparison performed.
      const ordered = [group[0]];
      for (let i=1;i<group.length;i++) {
        const challenger = group[i];
        let j=ordered.length-1;
        while (j>=0) {
          const incumbent=ordered[j], key=pairKey(challenger.id,incumbent.id);
          const winner=decided[key];
          if (winner!==challenger.id && winner!==incumbent.id) {
            pendingRps.push({key,aId:incumbent.id,bId:challenger.id,
              groupIds:group.map(p=>p.id)});
            pendingGroups.push(new Set(group.map(p=>p.id)));
            return group;
          }
          if(!rpsUsed.some(m=>m.key===key)) rpsUsed.push({key,aId:incumbent.id,bId:challenger.id,winnerId:winner});
          if (winner===challenger.id) j--;
          else break;
        }
        ordered.splice(j+1,0,challenger);
      }
      for(const p of group) p.rankReason='First-to-three rock–paper–scissors playoff';
      return ordered;
    }
    function resolveTie(group) {
      if (group.length <= 1) return group;
      for (const [key,label] of criteria) {
        const data = metric(group,key);
        const values = data.values || new Map();
        const scored = data.applicable ? group.map(p=>({p,score:values.get(p.id)})) : [];
        scored.sort((a,b)=>b.score-a.score || playerIndex.get(a.p.id)-playerIndex.get(b.p.id));
        const partitions=[];
        if (data.applicable) {
          for (const item of scored) {
            const last=partitions[partitions.length-1];
            if(last && last.score===item.score)last.members.push(item.p);
            else partitions.push({score:item.score,members:[item.p]});
          }
        }
        audit.push({groupIds:group.map(p=>p.id),key,label,why:data.why,
          outcome:!data.applicable?'skipped':partitions.length===1?'tied':'decided',
          scores:data.applicable ? group.map(p=>({id:p.id,value:displayScore(key,values.get(p.id))})):[]});
        if (partitions.length > 1) {
          const reason = label;
          for (const p of group) p.rankReason=reason;
          return partitions.flatMap(part=>resolveTie(part.members));
        }
      }
      const byFixtureOrder=group.slice().sort((a,b)=>playerIndex.get(a.id)-playerIndex.get(b.id));
      return rpsOrder(byFixtureOrder);
    }
    const ordered=[];
    for(let i=0;i<entries.length;) {
      let j=i+1;
      while(j<entries.length && roundedMetric(entries[j].winRate)===roundedMetric(entries[i].winRate) && entries[j].wins===entries[i].wins) j++;
      const group=entries.slice(i,j);
      if(complete)ordered.push(...resolveTie(group));
      else ordered.push(...group);
      i=j;
    }
    for (let i=0;i<ordered.length;i++) {
      const entry=ordered[i];
      entry.rank=i+1;
      const pending=pendingGroups.find(group=>group.has(entry.id));
      const groupStart=pending ? ordered.findIndex(p=>pending.has(p.id))+1 : null;
      entry.rankLabel=pending?'T'+groupStart:String(entry.rank);
      if (!complete) entry.rankReason='Provisional: remaining round-robin results may change positions';
      else if (!entry.rankReason) entry.rankReason='Round-robin record';
    }
    return {entries:ordered,complete,ready:complete && pendingRps.length===0,pendingRps,audit,rpsUsed};
  }
  // Read-only cut forecast. Nothing here changes a fixture, a recorded winner,
  // the saved JSON schema or the official tie-break / knockout logic.
  // The Monte Carlo forecast is deliberately separate from mathematical clinching.
  function forecastQualification(tournament, rpsDecisions, honours, options) {
    if (!tournament || !tournament.players || !tournament.roundRobin) return null;
    const players = tournament.players, matches = tournament.roundRobin;
    const n = players.length, spots = Math.max(1,Math.min(n,tournament.qualifierCount || 8));
    const index = new Map(players.map((p,i)=>[p.id,i]));
    const wins = new Array(n).fill(0), played = new Array(n).fill(0);
    const unplayed = [];
    for (let j=0;j<matches.length;j++) {
      const m=matches[j], a=index.get(m.aId), b=index.get(m.bId);
      if(a===undefined || b===undefined) continue;
      if(m.winnerId===m.aId || m.winnerId===m.bId){
        played[a]++;played[b]++;wins[index.get(m.winnerId)]++;
      } else unplayed.push({j,a,b});
    }
    const remaining = new Array(n).fill(0);
    for (const m of unplayed){ remaining[m.a]++;remaining[m.b]++; }
    // Ridge-penalised Bradley–Terry paired-comparison model, started from
    // 50/50. It uses ALL completed opponents instead of only raw win rates.
    const rating = new Array(n).fill(0);
    const lambda=1.8;
    for(let iter=0;iter<75;iter++){
      const gradient=rating.map(v=>-lambda*v);
      for(const m of matches){
        if(m.winnerId!==m.aId && m.winnerId!==m.bId)continue;
        const a=index.get(m.aId),b=index.get(m.bId);
        const pa=1/(1+Math.exp(Math.max(-25,Math.min(25,rating[b]-rating[a]))));
        const delta=(m.winnerId===m.aId?1:0)-pa;
        gradient[a]+=delta;gradient[b]-=delta;
      }
      for(let k=0;k<n;k++)rating[k]+=0.105*gradient[k];
    }
    const logistic=x=>1/(1+Math.exp(-Math.max(-25,Math.min(25,x))));
    const fixtureOdds=Object.fromEntries(players.map(p=>[p.id,[]]));
    const expectedAdditional=new Array(n).fill(0);
    for(const m of unplayed){
      const ab=logistic(rating[m.a]-rating[m.b]);
      fixtureOdds[players[m.a].id].push({opponentId:players[m.b].id,winProbability:ab});
      fixtureOdds[players[m.b].id].push({opponentId:players[m.a].id,winProbability:1-ab});
      expectedAdditional[m.a]+=ab;expectedAdditional[m.b]+=1-ab;
    }
    // Deterministic seed: the same published JSON yields the same forecasts
    // across devices (independent of the current date or rendering order).
    let seed=2166136261;
    const signature=matches.map(m=>m.winnerId||'-').join(',')+';'+JSON.stringify(rpsDecisions||{})+';'+players.map(p=>p.id).join(',');
    for(let j=0;j<signature.length;j++){ seed^=signature.charCodeAt(j);seed=Math.imul(seed,16777619)>>>0; }
    const random=mulberry32(seed);
    function normal(){const u=Math.max(random(),1e-12);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*random());}
    const samples=Math.max(100,Math.min(10000,Number(options&&options.samples)||2400));
    const qualifying=new Array(n).fill(0);
    const addedHistogram=players.map((p,i)=>Array.from({length:remaining[i]+1},()=>({n:0,in:0})));
    const cutline=[];
    const simulationTournament={...tournament,roundRobin:matches.map(m=>({...m}))};
    const priorRps=rpsDecisions&&typeof rpsDecisions==='object'?rpsDecisions:{};
    for(let run=0;run<samples;run++){
      const ability=rating.map((r,i)=>r+normal()*0.6/Math.sqrt(1+played[i]/4));
      const added=new Array(n).fill(0);
      for(const m of unplayed){
        const winA=random()<logistic(ability[m.a]-ability[m.b]);
        simulationTournament.roundRobin[m.j].winnerId=winA?players[m.a].id:players[m.b].id;
        added[winA?m.a:m.b]++;
      }
      const sampledRps={...priorRps};
      let table=rankingDetails(simulationTournament,sampledRps,honours);
      // Statistically model any otherwise unresolved first-to-three RPS
      // as fair, independent contests. The real organiser still decides.
      for(let attempt=0;!table.ready && table.pendingRps.length && attempt<100;attempt++){
        const pending=table.pendingRps[0];
        sampledRps[pending.key]=random()<0.5?pending.aId:pending.bId;
        table=rankingDetails(simulationTournament,sampledRps,honours);
      }
      if(!table.ready)throw new Error('Qualification simulation could not resolve a complete ranking.');
      const top=new Set(table.entries.slice(0,spots).map(p=>p.id));
      cutline.push(table.entries[spots-1].wins);
      for(let i=0;i<n;i++){
        const inCut=top.has(players[i].id);
        if(inCut)qualifying[i]++;
        const h=addedHistogram[i][added[i]];
        h.n++;if(inCut)h.in++;
      }
    }
    cutline.sort((a,b)=>a-b);
    const quantile=q=>cutline[Math.max(0,Math.min(cutline.length-1,Math.floor(q*(cutline.length-1))))];
    const cutlineMedian=quantile(0.5), cutlineLow=quantile(0.2),cutlineHigh=quantile(0.8);
    const finalRanking=unplayed.length===0?rankingDetails(tournament,rpsDecisions,honours):null;
    const finalTop=finalRanking&&finalRanking.ready?new Set(finalRanking.entries.slice(0,spots).map(p=>p.id)):null;
    const byPlayer={};
    for(let i=0;i<n;i++){
      const id=players[i].id, maximumWins=wins[i]+remaining[i];
      const challengers=players.reduce((s,p,k)=>s+Number(k!==i && wins[k]+remaining[k]>=wins[i]),0);
      const alreadyBeyond=players.reduce((s,p,k)=>s+Number(k!==i && wins[k]>maximumWins),0);
      const certainIn=finalTop?finalTop.has(id):challengers<spots;
      const certainOut=finalTop?!finalTop.has(id):alreadyBeyond>=spots;
      const probability=certainIn?1:certainOut?0:qualifying[i]/samples;
      const status=certainIn?'confirmed-in':certainOut?'confirmed-out':probability>=0.82?'likely-in':probability<=0.18?'likely-out':'borderline';
      const why=certainIn?(finalTop?'Round robin and all required tie-breaks are complete; this player has a top-eight seed.':'At most seven other players can still equal or exceed this player’s present wins, even if every remaining result goes against them.')
        :certainOut?(finalTop?'Round robin and all required tie-breaks are complete; this player is outside the top eight.':'At least eight other players already have more wins than this player could reach, even by winning every remaining game.')
        :'Estimate only; the remaining results and tie-breaks can still change this placing.';
      // Sufficient mathematical clinching target, not a claim that every
      // lower win count makes qualification impossible.
      let clinchAdditional=null;
      for(let extra=0;extra<=remaining[i];extra++){
        const competitorCount=players.reduce((s,p,k)=>s+Number(k!==i&&wins[k]+remaining[k]>=wins[i]+extra),0);
        if(competitorCount<spots){clinchAdditional=extra;break;}
      }
      let seventyPercentAdditional=null;
      for(let extra=0;extra<=remaining[i];extra++){
        const h=addedHistogram[i][extra];
        if(h.n>=30 && h.in/h.n>=0.70){seventyPercentAdditional=extra;break;}
      }
      byPlayer[id]={id,wins:wins[i],played:played[i],remaining:remaining[i],maxWins:maximumWins,
        probability, status, why, expectedAdditional:expectedAdditional[i],expectedTotal:wins[i]+expectedAdditional[i],
        fixtures:fixtureOdds[id], toMedianCutline:Math.max(0,cutlineMedian-wins[i]),
        canReachMedian:maximumWins>=cutlineMedian, clinchAdditional,seventyPercentAdditional,
        // The histogram is retained for review/test only, never persisted.
        conditional:addedHistogram[i].map((h,k)=>({extraWins:k,samples:h.n,qualificationRate:h.n?h.in/h.n:null}))};
    }
    return {samples,qualifierCount:spots,completedGames:matches.length-unplayed.length,remainingGames:unplayed.length,
      cutlineMedian,cutlineLow,cutlineHigh,byPlayer};
  }

  function statsFor(tournament,rpsDecisions,honours) {return rankingDetails(tournament,rpsDecisions,honours).entries;}
  function allRoundRobinFinished(t) { return !!t && t.roundRobin.length > 0 && t.roundRobin.every(m => !!m.winnerId); }
  function knockoutMatchCount(tournament) {
    if (!tournament) return 0;
    return ['mcintyre8', 'nrl8'].includes(tournament.knockoutFormat) ? 9 : tournament.qualifierCount - 1;
  }
  function knockoutName(tournament) {
    if (!tournament) return '';
    if (tournament.knockoutFormat === 'mcintyre8') return 'McIntyre Final Eight';
    if (tournament.knockoutFormat === 'nrl8') return 'NRL-style Final Eight';
    return 'Top ' + tournament.qualifierCount + ' knockout';
  }
  function getKnockout(tournament, storedResults, rpsDecisions, honours) {
    const ranking = rankingDetails(tournament, rpsDecisions, honours);
    if (!ranking.ready) return { ready:false, stages:[], seeds:[], completed:0, outcome:null,
      waitingForTiebreak:ranking.complete && ranking.pendingRps.length>0,
      pendingRps:ranking.pendingRps };
    const seeds = ranking.entries.map(p => p.id);
    const count = tournament.qualifierCount;
    const format = tournament.knockoutFormat || 'standard';
    const stages = [];
    const select = (id, aId, bId, index) => {
      const selected = storedResults && storedResults[id];
      const winnerId = aId && bId && (selected === aId || selected === bId) ? selected : null;
      return { id, aId: aId || null, bId: bId || null, winnerId, index };
    };
    const stage = (name, idPairs, note) => {
      const entry = { name, matches: idPairs.map(([id, a, b], i) => select(id, a, b, i)) };
      if (note) entry.note = note;
      stages.push(entry);
      return entry.matches;
    };
    const winner = match => match && match.winnerId;
    const loser = match => match && match.winnerId ? (match.winnerId === match.aId ? match.bId : match.aId) : null;
    if (format === 'nrl8' && count === 8) {
      // NRL top-four double-chance finals, used since 2012. Nine games.
      const first = stage('Qualifying and elimination finals', [
        ['nrl-qf1', seeds[0], seeds[3]], ['nrl-qf2', seeds[1], seeds[2]],
        ['nrl-ef1', seeds[4], seeds[7]], ['nrl-ef2', seeds[5], seeds[6]]
      ], 'Top four have a second chance; 5th to 8th play elimination games.');
      const second = stage('Semi-finals', [
        ['nrl-sf1', loser(first[0]), winner(first[2])],
        ['nrl-sf2', loser(first[1]), winner(first[3])]
      ], 'Qualifying-final losers face elimination-final winners.');
      const third = stage('Preliminary finals', [
        ['nrl-pf1', winner(first[0]), winner(second[1])],
        ['nrl-pf2', winner(first[1]), winner(second[0])]
      ], 'Qualifying-final winners return after a bye.');
      stage('Grand final', [['nrl-gf', winner(third[0]), winner(third[1])]]);
    } else if (format === 'mcintyre8' && count === 8) {
      // Official spreadsheet (Finals tab): 1v8, 2v7, 3v6, 4v5.
      // The best two winners advance straight to preliminary finals; the two
      // lowest-ranked losers are eliminated, while the other four play semis.
      const first = stage('Quarter-finals', [
        ['mc-qf1', seeds[0], seeds[7]], ['mc-qf2', seeds[1], seeds[6]],
        ['mc-qf3', seeds[2], seeds[5]], ['mc-qf4', seeds[3], seeds[4]]
      ], 'Workbook order: 1v8, 2v7, 3v6, 4v5. Two highest-ranked winners have a bye; two lowest-ranked losers are out.');
      const allKnown = first.every(m => m.winnerId);
      // Relative ranking always uses the original round-robin seeds, not week-one results.
      const rankedWinners = allKnown ? first.map(winner).sort((a,b) => seeds.indexOf(a)-seeds.indexOf(b)) : [];
      const rankedLosers = allKnown ? first.map(loser).sort((a,b) => seeds.indexOf(a)-seeds.indexOf(b)) : [];
      const second = stage('Semi-finals', [
        ['mc-sf1', rankedWinners[3], rankedLosers[1]],
        ['mc-sf2', rankedWinners[2], rankedLosers[0]]
      ], 'The top two qualifying-final winners get a bye; 3rd and 4th winners face the two highest-ranked losers.');
      const third = stage('Preliminary finals', [
        ['mc-pf1', rankedWinners[0], winner(second[0])],
        ['mc-pf2', rankedWinners[1], winner(second[1])]
      ]);
      stage('Grand final', [['mc-gf', winner(third[0]), winner(third[1])]]);
    } else {
      // Existing straight knockouts remain unchanged, including old JSON backups.
      const pairIndexes = count === 8 ? [[0,7], [3,4], [1,6], [2,5]] : count === 4 ? [[0,3],[1,2]] : [[0,1]];
      const levelCount = Math.log2(count);
      for (let r = 0; r < levelCount; r++) {
        const prev = stages[r - 1]?.matches;
        const pairs = Array.from({length: count / Math.pow(2, r + 1)}, (_,i) => [
          'ko-r' + r + '-m' + i,
          r === 0 ? seeds[pairIndexes[i][0]] : winner(prev[2*i]),
          r === 0 ? seeds[pairIndexes[i][1]] : winner(prev[2*i+1])
        ]);
        stage(count === 8 && r === 0 ? 'Quarter-finals' : r === levelCount - 1 ? 'Final' : 'Semi-finals', pairs);
      }
    }
    const finalMatch = stages[stages.length - 1].matches[0];
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
    if (t.knockoutFormat !== undefined && !['standard', 'mcintyre8', 'nrl8'].includes(t.knockoutFormat)) return false;
    if (['mcintyre8', 'nrl8'].includes(t.knockoutFormat) && t.qualifierCount !== 8) return false;
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
    if (s.tiebreakRps !== undefined) {
      if (!s.tiebreakRps || typeof s.tiebreakRps !== 'object' || Array.isArray(s.tiebreakRps)) return false;
      for (const [key,winner] of Object.entries(s.tiebreakRps)) {
        const pair=key.split(PAIR_DELIMITER);
        if (pair.length!==2 || pair[0]>=pair[1] || !ids.has(pair[0]) || !ids.has(pair[1]) || !pair.includes(winner)) return false;
      }
    }
    return true;
  }
  return { BUILD_ID, MAX_PLAYERS, analyseSetup, createDraw, statsFor, rankingDetails, forecastQualification, pairKey, allRoundRobinFinished, getKnockout, knockoutMatchCount, knockoutName, isValidSnapshot };
});
