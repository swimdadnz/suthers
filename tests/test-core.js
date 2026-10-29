const assert = require('assert/strict');
const C = require('../tournament-core.js');
let verified = 0;
for (let n=2; n<=24; n++) {
  const maxPairs = n*(n-1)/2;
  for(let k of [2,4,8].filter(k=>k<=n)) {
    for (let min=1; min<n; min++) {
      const minCount=Math.ceil(n*min/2);
      for (let rrBudget=minCount; rrBudget<=maxPairs; rrBudget++) {
        const setup={count:n,names:Array.from({length:n},(_,i)=>'Player '+i),maxMatches:rrBudget+k-1,minMatches:min,bracket:String(k)};
        const test=C.analyseSetup(setup);
        assert(test.ok,JSON.stringify({n,min,rrBudget,k,errors:test.errors}));
        const t=C.createDraw(setup, n*100000+min*1000+k*100+rrBudget);
        assert.equal(t.roundRobin.length,rrBudget);
        const counts=Array(n).fill(0),pairSet=new Set();
        for(const m of t.roundRobin){
          const a=Number(m.aId.slice(1))-1,b=Number(m.bId.slice(1))-1;
          assert(a!==b);
          counts[a]++;counts[b]++;
          const key=[a,b].sort((x,y)=>x-y).join(',');
          assert(!pairSet.has(key));pairSet.add(key);
        }
        assert(Math.max(...counts)-Math.min(...counts)<=1);
        assert(Math.min(...counts)>=min);
        assert(rrBudget+k-1<=setup.maxMatches);
        const {stages,ready}=C.getKnockout(t,{},null);
        assert(!ready);assert.equal(stages.length,0);
        verified++;
      }
    }
  }
}
const t=C.createDraw({count:4,names:['A','B','C','D'],maxMatches:9,minMatches:3,bracket:'4'},99);
for(const m of t.roundRobin) m.winnerId=m.aId;
let ko=C.getKnockout(t,{},null);
assert(ko.ready);assert.equal(ko.stages.length,2);
let res={};
for(let m of ko.stages[0].matches) res[m.id]=m.aId;
ko=C.getKnockout(t,res,null);
res[ko.stages[1].matches[0].id]=ko.stages[1].matches[0].aId;
ko=C.getKnockout(t,res,null);
assert(ko.outcome && ko.outcome.championId);
assert(C.isValidSnapshot({state:{setup:{names:[]},tournament:t,koResults:res}}));
assert(!C.analyseSetup({count:8,names:Array(8).fill('x'),maxMatches:30,minMatches:3,bracket:'auto'}).ok);
console.log('PASS '+verified+' balanced fixture configurations + knockout progression + validation');
