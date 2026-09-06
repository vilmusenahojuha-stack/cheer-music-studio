const assert=require('assert');
const core=require('../cheer-fx-count-rhythm-core.js');

function basePlan(overrides={}){
  return {
    version:1,kind:'cheer-fx-intensity-plan',status:'preview-ready',bpm:150,
    nonDestructive:true,executable:false,safePreviewOnly:true,riskFlags:[],
    events:[
      {kind:'impact',eight:2,sectionType:'stunt',at:2.8,intensity:'hero',intensityScore:.94,priority:.9},
      {kind:'riser',eight:2,sectionType:'stunt',at:5.6,intensity:'strong',intensityScore:.72,priority:.7},
      {kind:'whoosh',eight:3,sectionType:'dance',at:8.8,intensity:'medium',intensityScore:.6,priority:.6}
    ],...overrides
  };
}

{
  const plan=core.createCheerFxCountRhythmPlan(basePlan());
  assert.equal(plan.status,'preview-ready');
  assert.equal(plan.events[0].count,1);
  assert.equal(plan.events.find(e=>e.kind==='riser').count,8);
  assert.equal(plan.events.find(e=>e.kind==='whoosh').count,8);
  assert.equal(plan.nonDestructive,true);
  assert.equal(plan.executable,false);
}

{
  const plan=core.createCheerFxCountRhythmPlan(basePlan(),{eightStarts:{2:10,3:13.2}});
  const impact=plan.events.find(e=>e.kind==='impact');
  const riser=plan.events.find(e=>e.kind==='riser');
  assert.equal(impact.timingMode,'grid-snapped');
  assert.equal(impact.at,10);
  assert(Math.abs(riser.at-12.8)<1e-9);
  assert.equal(plan.summary.gridSnapped,3);
}

{
  const events=[
    {kind:'impact',eight:4,sectionType:'stunt',intensity:'hero',intensityScore:.95,priority:.95,at:1},
    {kind:'impact',eight:4,sectionType:'stunt',intensity:'strong',intensityScore:.8,priority:.8,at:1.1}
  ];
  const out=core.rhythmizeEvents(events,150);
  assert.deepEqual(out.map(e=>e.count),[1,5]);
  assert.equal(core.detectCountRisks(out).length,0);
}

{
  const plan=core.createCheerFxCountRhythmPlan(basePlan({status:'review-required'}));
  assert.equal(plan.status,'review-required');
}

{
  const plan=core.createCheerFxCountRhythmPlan(null);
  assert.equal(plan.status,'blocked');
  assert.equal(plan.reason,'cheer-fx-intensity-plan-required');
}

{
  const plan=core.createCheerFxCountRhythmPlan(basePlan({bpm:0}));
  assert.equal(plan.status,'blocked');
  assert.equal(plan.reason,'bpm-required');
}

console.log('cheer-fx-count-rhythm-core tests passed');
