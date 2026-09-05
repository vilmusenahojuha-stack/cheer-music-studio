const assert=require('assert');
const planCore=require('../cheer-plan-core.js');

function close(actual,expected,eps=1e-9){assert.ok(Math.abs(actual-expected)<=eps,`${actual} != ${expected}`)}

assert.equal(planCore.inferTotalEights([{endEight:4},{endEight:12}],8),12);
assert.equal(planCore.inferTotalEights([],8),8);

const plan=planCore.buildCheerPlan({
  bpm:148,
  oneOffset:0.05,
  sections:[
    {id:'intro',startEight:1,endEight:4,type:'intro',energy:'medium',label:'Intro'},
    {id:'build',startEight:5,endEight:6,type:'transition',energy:'low',label:'Build'},
    {id:'stunt',startEight:7,endEight:10,type:'stunt',energy:'peak',label:'Stunt'}
  ]
});

assert.equal(plan.version,1);
assert.equal(plan.totalEights,10);
assert.equal(plan.timeline.length,10);
assert.equal(plan.sections.length,3);
assert.equal(plan.sections[0].durationEights,4);
assert.equal(plan.timeline[0].sectionLabel,'Intro');
assert.equal(plan.timeline[0].countInSection,1);
assert.equal(plan.timeline[3].countInSection,4);
assert.equal(plan.timeline[6].sectionType,'stunt');
assert.equal(plan.timeline[6].countInSection,1);
assert.equal(plan.timeline[0].phrase,1);
assert.equal(plan.timeline[3].phraseEndEight,4);
assert.equal(plan.timeline[4].phraseStartEight,5);
assert.equal(plan.timeline[6].phraseStartEight,7);
assert.ok(plan.energyEvents.some(event=>event.atEight===5&&event.type==='energy-drop'));
assert.ok(plan.energyEvents.some(event=>event.atEight===7&&event.type==='energy-rise'));
assert.equal(plan.timeline[4].transition.type,'break');
assert.equal(plan.timeline[6].transition.type,'drop');
assert.ok(plan.timeline[6].transition.confidence>plan.timeline[6].transitionCandidates.find(x=>x.type==='cut').confidence);
assert.equal(plan.sections[2].entryTransition.type,'drop');
assert.equal(plan.sections[0].entryTransition,null);
assert.equal(plan.sections[0].phraseCount,1);
close(plan.timeline[0].start,0.05);
close(plan.timeline[1].start,0.05+480/148);
close(plan.eightSeconds,480/148);

const tie=planCore.strongestCandidate([
  {type:'cut',confidence:.8},
  {type:'drop',confidence:.8},
  {type:'break',confidence:.8}
]);
assert.equal(tie.type,'break');

assert.throws(
  ()=>planCore.buildCheerPlan({bpm:152,sections:[{id:'a',startEight:1,endEight:4},{id:'b',startEight:4,endEight:8}]}),
  error=>error&&error.code==='SECTION_OVERLAP'
);

console.log('cheer-plan-core tests passed');
