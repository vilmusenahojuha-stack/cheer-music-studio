const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  buildRepairCandidates,
  findPriorityRepairTarget,
  summarizeComparison
}=require('../competition-master-final-check-progress-summary.js');

const comparison={
  advisoryOnly:true,
  nonDestructive:true,
  removed:[
    {key:'fixed',label:'Voiceover clarity',guidance:'Ei enää korjattava.'}
  ],
  remaining:[
    {
      key:'peak',
      label:'True peak / headroom',
      guidance:'Tarkista headroom ja kovimmat transientit ennen uutta final-checkiä.',
      progress:{beforeDistance:0.4,afterDistance:0.2,deltaDistance:0.2}
    },
    {
      key:'fx',
      label:'Ending · FX',
      guidance:'Säädä tämän osion cheer-FX:n ja musiikin suhdetta, sitten mittaa sama aikajakso uudelleen.',
      progress:{beforeDistance:0.1,afterDistance:0.5,deltaDistance:-0.4}
    }
  ],
  added:[
    {
      key:'balance',
      label:'Osioiden tasapaino',
      guidance:'Tarkista osioiden keskinäiset voimakkuudet ja energiasiirtymät.'
    }
  ]
};

const candidates=buildRepairCandidates(comparison);
assert.equal(candidates.length,3,'removed risks must never become repair candidates');
assert.ok(!candidates.some(item=>item.label==='Voiceover clarity'),'fixed risk must stay out of repair queue');
assert.ok(candidates.some(item=>item.kind==='added'&&item.label==='Osioiden tasapaino'));
assert.ok(candidates.some(item=>item.kind==='worsened'&&item.label==='Ending · FX'));

const target=findPriorityRepairTarget(comparison);
assert.equal(target.label,'Osioiden tasapaino','a newly introduced active blocker should be prioritized over already-known risks');
assert.equal(target.kind,'added');
assert.equal(target.guidance,'Tarkista osioiden keskinäiset voimakkuudet ja energiasiirtymät.');

const worseningOnly=findPriorityRepairTarget({
  remaining:[
    {key:'a',label:'Paraneva riski',guidance:'A',progress:{beforeDistance:1,afterDistance:0.4,deltaDistance:0.6}},
    {key:'b',label:'Heikkenevä riski',guidance:'B',progress:{beforeDistance:0.2,afterDistance:0.8,deltaDistance:-0.6}}
  ],
  added:[]
});
assert.equal(worseningOnly.label,'Heikkenevä riski','worsening active risk must outrank an improving active risk');
assert.equal(worseningOnly.kind,'worsened');

const improvingButBlocked=findPriorityRepairTarget({
  remaining:[
    {key:'a',label:'Vielä estävä riski',guidance:'Korjaa tämä.',progress:{beforeDistance:1,afterDistance:0.25,deltaDistance:0.75}}
  ],
  added:[]
});
assert.equal(improvingButBlocked.label,'Vielä estävä riski','an improving risk is still a valid repair target while it remains active');

assert.equal(findPriorityRepairTarget({remaining:[],added:[],removed:[{label:'Korjattu'}]}),null,'fixed-only comparison must not invent a repair target');

const summary=summarizeComparison(comparison);
assert.equal(summary.priorityRepairTarget.label,'Osioiden tasapaino');
assert.match(summary.priorityRepairText,/^Korjaa ensin: Osioiden tasapaino/);
assert.match(summary.priorityRepairText,/Tarkista osioiden keskinäiset voimakkuudet/);
assert.match(summary.text,/Korjaa ensin: Osioiden tasapaino/);
assert.equal(summary.advisoryOnly,true);
assert.equal(summary.nonDestructive,true);

const clean=summarizeComparison({advisoryOnly:true,nonDestructive:true,removed:[{label:'Korjattu'}],remaining:[],added:[]});
assert.equal(clean.priorityRepairTarget,null);
assert.equal(clean.priorityRepairText,null);
assert.doesNotMatch(clean.text,/Korjaa ensin:/,'no active risks means no repair instruction');

const source=fs.readFileSync('competition-master-final-check-progress-summary.js','utf8');
assert.ok(/findPriorityRepairTarget/.test(source),'summary must derive one active priority repair target');
assert.ok(/Korjaa ensin:/.test(source),'summary must expose a direct Finnish next action');
assert.ok(/item\?\.guidance/.test(source),'priority repair must reuse existing risk guidance instead of inventing audio processing');
assert.ok(!/renderProject|measureCompetitionMaster|evaluateCompetitionMasterReadiness|DynamicsCompressor|createGain|encodeWav/i.test(source),'priority repair must stay advisory and non-destructive');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(source),'priority repair must not mutate final-check decisions');

console.log('competition-master-final-check-priority-repair: active blocker guidance stays advisory and non-destructive');
