const assert=require('node:assert/strict');
const fs=require('node:fs');
const {classifyRemaining,classifyOverallDirection,summarizeComparison}=require('../competition-master-final-check-progress-summary.js');

const remaining=[
  {progress:{deltaDistance:0.26}},
  {progress:{deltaDistance:-0.04}},
  {progress:{deltaDistance:0}},
  {progress:null}
];
assert.deepEqual(classifyRemaining(remaining),{improved:1,worsened:1,unchanged:1,unmeasured:1});
assert.deepEqual(classifyOverallDirection({improved:2,worsened:1,removed:1,added:0}),{direction:'improving',label:'Kokonaisuus paranee',positive:3,negative:1});
assert.deepEqual(classifyOverallDirection({improved:0,worsened:2,removed:0,added:1}),{direction:'worsening',label:'Kokonaisuus heikkenee',positive:0,negative:3});
assert.deepEqual(classifyOverallDirection({improved:1,worsened:0,removed:0,added:1}),{direction:'stable',label:'Kokonaisuus ennallaan',positive:1,negative:1});

const summary=summarizeComparison({
  advisoryOnly:true,
  nonDestructive:true,
  removed:[{key:'a'},{key:'b'}],
  remaining,
  added:[{key:'c'}]
});
assert.equal(summary.improved,1);
assert.equal(summary.worsened,1);
assert.equal(summary.unchanged,1);
assert.equal(summary.unmeasured,1);
assert.equal(summary.removed,2);
assert.equal(summary.added,1);
assert.equal(summary.totalCompared,3);
assert.equal(summary.overallDirection,'improving');
assert.equal(summary.overallLabel,'Kokonaisuus paranee');
assert.equal(summary.positiveSignals,3);
assert.equal(summary.negativeSignals,2);
assert.equal(summary.text,'Kokonaisuus paranee. Kehitys: 1 parani · 1 heikkeni · 2 poistui · 1 uusi · 1 ennallaan · 1 ilman vertailumittausta.');

const worsening=summarizeComparison({advisoryOnly:true,nonDestructive:true,removed:[],remaining:[{progress:{deltaDistance:-0.1}}],added:[{key:'new'}]});
assert.equal(worsening.overallDirection,'worsening');
assert.match(worsening.text,/^Kokonaisuus heikkenee\./);

const stable=summarizeComparison({advisoryOnly:true,nonDestructive:true,removed:[{key:'fixed'}],remaining:[],added:[{key:'new'}]});
assert.equal(stable.overallDirection,'stable');
assert.match(stable.text,/^Kokonaisuus ennallaan\./);

assert.equal(summarizeComparison(null),null);
assert.equal(summarizeComparison({advisoryOnly:false,nonDestructive:true}),null,'summary must reject non-advisory data');
assert.equal(summarizeComparison({advisoryOnly:true,nonDestructive:false}),null,'summary must reject destructive data');

const source=fs.readFileSync('competition-master-final-check-progress-summary.js','utf8');
assert.ok(/getLastComparison/.test(source),'summary must consume the already-derived final-check comparison rather than reimplementing audio checks');
assert.ok(/queueMicrotask\(refresh\)/.test(source),'summary must refresh after the history listener has consumed the same final-check event');
assert.ok(/textContent=summary\.text/.test(source),'summary must render plain text safely');
assert.ok(/dataset\.direction=summary\.overallDirection/.test(source),'summary should expose the diagnostic direction without mutating final-check state');
assert.ok(!/innerHTML\s*=/.test(source),'summary must not inject HTML');
assert.ok(!/renderProject|measureCompetitionMaster|evaluateCompetitionMasterReadiness|normalize|DynamicsCompressor|createGain|encodeWav/i.test(source),'summary must stay purely diagnostic and non-destructive');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(source),'summary must not mutate final-check decisions');

console.log('competition-master-final-check-progress-summary: overall direction stays advisory and non-destructive');
