const assert=require('assert');
const core=require('../smart-mix-transition-flow-quality-core.js');

const cheerPlan={
  sections:[
    {id:'intro',type:'intro',energy:'medium'},
    {id:'stunt',type:'stunt',energy:'peak'},
    {id:'dance',type:'dance',energy:'high'},
    {id:'ending',type:'ending',energy:'peak'}
  ]
};

function candidate({
  trackId='A',
  sourceName=`${trackId}.wav`,
  energy=.58,
  boundary=.85,
  phrase=.88,
  transition=.84
}={}){
  return {
    trackId,
    sourceName,
    features:{averageEnergy:energy},
    structuralBoundary:{score:boundary},
    phraseBoundary:{score:phrase},
    components:{transition}
  };
}

const goodPlan={
  matches:[
    {sectionId:'intro',best:candidate({trackId:'A',energy:.58})},
    {sectionId:'stunt',best:candidate({trackId:'B',energy:.90,boundary:.92,phrase:.94,transition:.93})},
    {sectionId:'dance',best:candidate({trackId:'C',energy:.76,boundary:.88,phrase:.90,transition:.86})},
    {sectionId:'ending',best:candidate({trackId:'D',energy:.90,boundary:.95,phrase:.96,transition:.91})}
  ]
};

const good=core.assessTransitionFlow(cheerPlan,goodPlan);
assert.equal(good.rows.length,3);
assert.equal(good.coverage,1);
assert.ok(good.score>.85,'well aligned section handoffs should score strongly');
assert.deepEqual(good.risks,[]);
assert.equal(good.weakest.nonDestructive,true);
assert.equal(good.rows[0].sourceSwitch,true);
assert.ok(good.rows[0].energyDelta.score>.95);

const badPlan={
  matches:[
    {sectionId:'intro',best:candidate({trackId:'A',energy:.58})},
    {sectionId:'stunt',best:candidate({trackId:'B',energy:.40,boundary:.25,phrase:.30,transition:.20})},
    {sectionId:'dance',best:candidate({trackId:'B',energy:.82,boundary:.80,phrase:.82,transition:.78})},
    {sectionId:'ending',best:candidate({trackId:'C',energy:.55,boundary:.32,phrase:.35,transition:.28})}
  ]
};

const bad=core.assessTransitionFlow(cheerPlan,badPlan);
assert.ok(bad.score<good.score);
assert.ok(bad.risks.includes('weak-section-transition'));
const introToStunt=bad.rows.find(row=>row.fromSectionId==='intro'&&row.toSectionId==='stunt');
assert.ok(introToStunt.reasons.includes('energy-jump-mismatch'));
assert.ok(introToStunt.reasons.includes('weak-boundary'));
assert.ok(introToStunt.reasons.includes('weak-transition-entry'));
assert.ok(introToStunt.reasons.includes('source-switch-weak-handoff'));
assert.ok(introToStunt.score<=.58);

const energyOnlyPlan={
  matches:[
    {sectionId:'intro',best:{trackId:'A',features:{averageEnergy:.58}}},
    {sectionId:'stunt',best:{trackId:'B',features:{averageEnergy:.90}}},
    {sectionId:'dance',best:{trackId:'B',features:{averageEnergy:.76}}},
    {sectionId:'ending',best:{trackId:'C',features:{averageEnergy:.90}}}
  ]
};
const energyOnly=core.assessTransitionFlow(cheerPlan,energyOnlyPlan);
assert.equal(energyOnly.coverage,1);
assert.ok(energyOnly.rows[0].reasons.includes('source-switch-unverified'));
assert.ok(energyOnly.rows[0].score<=.68,'source switch without boundary evidence must not be treated as fully verified');
assert.equal(energyOnly.rows[1].sourceSwitch,false);

const missing=core.assessTransitionFlow(
  {sections:[{id:'a',energy:'medium'},{id:'b',energy:'high'}]},
  {matches:[]}
);
assert.equal(missing.score,.5);
assert.equal(missing.coverage,0);
assert.equal(missing.reason,'transition-data-unavailable');
assert.deepEqual(missing.risks,[]);
assert.equal(missing.nonDestructive,true);

const exact=core.energyDeltaFit(
  {energy:'medium'},
  {energy:'peak'},
  {features:{averageEnergy:.58}},
  {features:{averageEnergy:.90}}
);
assert.ok(exact.score>.99);

const noMutationCandidate=candidate({trackId:'Z',energy:.76});
const snapshot=JSON.stringify(noMutationCandidate);
core.assessTransition(
  {id:'a',energy:'medium'},
  {id:'b',energy:'high'},
  candidate({trackId:'Y',energy:.58}),
  noMutationCandidate
);
assert.equal(JSON.stringify(noMutationCandidate),snapshot);

console.log('smart-mix transition flow quality tests passed');
