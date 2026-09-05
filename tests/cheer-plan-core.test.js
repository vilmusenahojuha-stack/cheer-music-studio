const assert=require('assert');
const planCore=require('../cheer-plan-core.js');

function close(actual,expected,eps=1e-9){assert.ok(Math.abs(actual-expected)<=eps,`${actual} != ${expected}`)}

assert.equal(planCore.inferTotalEights([{endEight:4},{endEight:12}],8),12);
assert.equal(planCore.inferTotalEights([],8),8);

const audioProfile=[
  {eight:1,start:.05,energyScore:.42,energy:'medium',rms:.20,peak:.70,crestDb:10.9,activity:.40,energyDelta:0},
  {eight:2,start:3.29,energyScore:.45,energy:'medium',rms:.21,peak:.72,crestDb:10.7,activity:.42,energyDelta:.03},
  {eight:3,start:6.54,energyScore:.40,energy:'medium',rms:.19,peak:.68,crestDb:11.1,activity:.38,energyDelta:-.05},
  {eight:4,start:9.78,energyScore:.43,energy:'medium',rms:.20,peak:.70,crestDb:10.9,activity:.41,energyDelta:.03},
  {eight:5,start:13.02,energyScore:.12,energy:'low',rms:.08,peak:.42,crestDb:14.4,activity:.20,energyDelta:-.31},
  {eight:6,start:16.27,energyScore:.16,energy:'low',rms:.09,peak:.45,crestDb:14.0,activity:.22,energyDelta:.04},
  {eight:7,start:19.51,energyScore:.93,energy:'peak',rms:.34,peak:.96,crestDb:9.0,activity:.88,energyDelta:.77},
  {eight:8,start:22.75,energyScore:.90,energy:'peak',rms:.33,peak:.95,crestDb:9.2,activity:.84,energyDelta:-.03},
  {eight:9,start:26.00,energyScore:.89,energy:'peak',rms:.32,peak:.94,crestDb:9.4,activity:.82,energyDelta:-.01},
  {eight:10,start:29.24,energyScore:.92,energy:'peak',rms:.34,peak:.97,crestDb:9.1,activity:.87,energyDelta:.03}
];

const plan=planCore.buildCheerPlan({
  bpm:148,
  oneOffset:0.05,
  audioProfile,
  sections:[
    {id:'intro',startEight:1,endEight:4,type:'intro',energy:'medium',label:'Intro'},
    {id:'build',startEight:5,endEight:6,type:'transition',energy:'low',label:'Build'},
    {id:'stunt',startEight:7,endEight:10,type:'stunt',energy:'peak',label:'Stunt'}
  ]
});

assert.equal(plan.version,2);
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
assert.equal(plan.timeline[4].audioEnergy.energy,'low');
assert.equal(plan.timeline[6].audioEnergy.energy,'peak');
assert.equal(plan.timeline[6].energyAlignment.status,'match');
assert.ok(plan.timeline[6].energyAlignment.score>.95);
assert.equal(plan.audioAlignment.measuredEights,10);
assert.equal(plan.audioAlignment.matchEights,10);
assert.equal(plan.audioAlignment.alignmentRate,1);
assert.equal(plan.audioAlignment.mismatches.length,0);
assert.ok(plan.audioTransitionCandidates.some(candidate=>candidate.atEight===5&&candidate.type==='break'));
assert.ok(plan.audioTransitionCandidates.some(candidate=>candidate.atEight===7&&candidate.type==='drop'));
assert.ok(plan.transitionCandidates.some(candidate=>candidate.source==='audio'));
assert.ok(plan.sections[2].audioAlignmentScore>.95);
close(plan.timeline[0].start,0.05);
close(plan.timeline[1].start,0.05+480/148);
close(plan.eightSeconds,480/148);

const mismatch=planCore.buildCheerPlan({
  bpm:152,
  totalEights:2,
  audioProfile:[
    {eight:1,energyScore:.12,energy:'low'},
    {eight:2,energyScore:.15,energy:'low'}
  ],
  sections:[{id:'peak',startEight:1,endEight:2,type:'stunt',energy:'peak'}]
});
assert.equal(mismatch.audioAlignment.measuredEights,2);
assert.equal(mismatch.audioAlignment.matchEights,0);
assert.equal(mismatch.timeline[0].energyAlignment.status,'much-lower');
assert.equal(mismatch.audioAlignment.mismatches[0].plannedEnergy,'peak');

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
