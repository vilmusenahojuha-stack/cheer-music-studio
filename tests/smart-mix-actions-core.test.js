const assert=require('assert');
const actions=require('../smart-mix-actions-core.js');

const proposal={
  version:1,
  bpm:152,
  totalEights:5,
  decisions:[
    {id:'eight-2-break-1',eight:2,at:3.197,type:'break',confidence:.88,reason:'audio-energy-drop',window:{preSeconds:.2,postSeconds:.1},sectionType:'intro',plannedEnergy:'low'},
    {id:'eight-3-drop-1',eight:3,at:6.355,type:'drop',confidence:.94,reason:'audio-energy-rise',window:{preSeconds:.6,postSeconds:.1},sectionType:'stunt',plannedEnergy:'peak'},
    {id:'eight-4-build-1',eight:4,at:9.513,type:'build',confidence:.84,reason:'audio-below-planned-energy',window:{preSeconds:1.5,postSeconds:0},sectionType:'stunt',plannedEnergy:'peak'},
    {id:'eight-5-cut-1',eight:5,at:12.671,type:'cut',confidence:.71,reason:'section-boundary',window:{preSeconds:.1,postSeconds:.1},sectionType:'transition',plannedEnergy:'low'},
    {id:'eight-1-hold-1',eight:1,at:.04,type:'hold',confidence:.5,reason:'no-strong-edit-needed',window:{preSeconds:0,postSeconds:0}}
  ]
};

const plan=actions.createEditPlan(proposal,{minConfidence:.58});
assert.equal(plan.version,1);
assert.equal(plan.bpm,152);
assert.equal(plan.executable,false);
assert.equal(plan.safePreviewOnly,true);
assert.equal(plan.actions.length,4);
assert.equal(plan.conflicts.length,0);
assert.equal(plan.summary.readyForPreview,true);
assert.ok(Math.abs(plan.beatSeconds-(60/152))<1e-12);
assert.ok(Math.abs(plan.eightSeconds-(480/152))<1e-12);

const breakAction=plan.actions.find(x=>x.type==='break');
assert.equal(breakAction.destructive,false);
assert.equal(breakAction.executable,false);
assert.equal(breakAction.snap.mode,'eight-start');
assert.ok(breakAction.steps.some(x=>x.kind==='gain-ramp'));
assert.ok(breakAction.steps.some(x=>x.kind==='space'));

const dropAction=plan.actions.find(x=>x.type==='drop');
assert.ok(dropAction.steps.some(x=>x.kind==='impact-anchor'));
assert.ok(dropAction.steps.some(x=>x.kind==='prepare-drop'));

const buildAction=plan.actions.find(x=>x.type==='build');
assert.ok(buildAction.steps.some(x=>x.kind==='build-window'));
assert.ok(buildAction.steps.some(x=>x.kind==='riser-anchor'));

const cutAction=plan.actions.find(x=>x.type==='cut');
assert.equal(cutAction.steps.length,1);
assert.equal(cutAction.steps[0].kind,'cut-window');
assert.equal(cutAction.steps[0].anchor,12.671);

const lowConfidence=actions.createEditPlan({...proposal,decisions:[...proposal.decisions,{id:'weak',eight:5,at:12.7,type:'build',confidence:.2,window:{}}]},{minConfidence:.58});
assert.equal(lowConfidence.actions.some(x=>x.sourceDecisionId==='weak'),false);

const conflictProposal={bpm:148,totalEights:2,decisions:[
  {id:'a',eight:2,at:3.24,type:'break',confidence:.9,window:{}},
  {id:'b',eight:2,at:3.24,type:'drop',confidence:.9,window:{}}
]};
const conflictPlan=actions.createEditPlan(conflictProposal);
assert.equal(conflictPlan.conflicts.length,1);
assert.equal(conflictPlan.conflicts[0].type,'opposing-energy-actions');
assert.equal(conflictPlan.summary.readyForPreview,false);

assert.throws(()=>actions.createEditPlan({bpm:148}),/decisions/);
assert.throws(()=>actions.createEditPlan({bpm:0,decisions:[]}),/BPM/);
assert.throws(()=>actions.beatSeconds(0),/greater than zero/);

console.log('smart-mix-actions-core tests passed');
