const assert=require('assert');
const core=require('../smart-mix-whole-mix-quality-core.js');

const cheerPlan={
  sections:[
    {id:'intro',type:'intro',energy:'medium'},
    {id:'stunt',type:'stunt',energy:'peak'},
    {id:'ending',type:'ending',energy:'peak'}
  ]
};

function match(sectionId,energy,score=.9,trackId='A'){
  return {
    sectionId,
    best:{
      trackId,
      sourceName:`${trackId}.wav`,
      score,
      features:{averageEnergy:energy}
    }
  };
}

const matchPlan={
  matches:[
    match('intro',.58,.9,'A'),
    match('stunt',.90,.92,'B'),
    match('ending',.91,.94,'C')
  ]
};

const proposal={
  sequence:[
    {sectionId:'intro',trackId:'A',sourceName:'A.wav'},
    {sectionId:'stunt',trackId:'B',sourceName:'B.wav'},
    {sectionId:'ending',trackId:'C',sourceName:'C.wav'}
  ],
  audioTimelinePlan:{clips:[{id:'keep'}]}
};

let calls=0;
const strongTransitionCore={
  assessTransitionFlow(plan,passedMatchPlan){
    calls++;
    assert.strictEqual(plan,cheerPlan);
    assert.strictEqual(passedMatchPlan,matchPlan);
    return {
      score:.91,
      coverage:1,
      weakest:{fromSectionId:'intro',toSectionId:'stunt',score:.88},
      rows:[
        {fromSectionId:'intro',toSectionId:'stunt',score:.88,reasons:[],sourceSwitch:true,nonDestructive:true},
        {fromSectionId:'stunt',toSectionId:'ending',score:.94,reasons:[],sourceSwitch:true,nonDestructive:true}
      ],
      risks:[],
      nonDestructive:true
    };
  }
};

const strong=core.assessProposalQuality(
  proposal,cheerPlan,matchPlan,
  {availableSources:3,transitionFlowCore:strongTransitionCore}
);
assert.equal(calls,1);
assert.equal(strong.components.transitionFlow.score,.91);
assert.equal(strong.components.transitionFlow.coverage,1);
assert.ok(strong.score>.8);
assert.equal(strong.risks.includes('weak-section-transition'),false);
assert.equal(strong.reviewTargets.some(row=>row.reason==='weak-section-transition'),false);
assert.equal(strong.readyForFxReview,true);

const weakTransitionCore={
  assessTransitionFlow(){
    return {
      score:.53,
      coverage:1,
      weakest:{fromSectionId:'stunt',toSectionId:'ending',score:.31},
      rows:[
        {
          fromSectionId:'intro',
          toSectionId:'stunt',
          score:.75,
          reasons:[],
          sourceSwitch:true,
          nonDestructive:true
        },
        {
          fromSectionId:'stunt',
          toSectionId:'ending',
          score:.31,
          energyDelta:{score:.42,targetDelta:0,actualDelta:-.3,error:.3},
          boundarySupport:.29,
          transitionSupport:.24,
          sourceSwitch:true,
          fromSource:'B',
          toSource:'C',
          reasons:['energy-jump-mismatch','weak-boundary','weak-transition-entry','source-switch-weak-handoff'],
          nonDestructive:true
        }
      ],
      risks:['weak-section-transition'],
      nonDestructive:true
    };
  }
};

const weak=core.assessProposalQuality(
  proposal,cheerPlan,matchPlan,
  {availableSources:3,transitionFlowCore:weakTransitionCore}
);
assert.equal(weak.components.transitionFlow.score,.53);
assert.ok(weak.risks.includes('weak-section-transition'));
assert.equal(weak.readyForFxReview,false);
const target=weak.reviewTargets.find(row=>
  row.kind==='transition'&&
  row.fromSectionId==='stunt'&&
  row.toSectionId==='ending'&&
  row.reason==='weak-section-transition'
);
assert.ok(target,'weak transition must become an exact review target');
assert.equal(target.evidence.score,.31);
assert.equal(target.evidence.boundarySupport,.29);
assert.equal(target.evidence.transitionSupport,.24);
assert.equal(target.evidence.sourceSwitch,true);
assert.deepEqual(
  target.evidence.reasons,
  ['energy-jump-mismatch','weak-boundary','weak-transition-entry','source-switch-weak-handoff']
);
assert.ok(target.severity>=.62&&target.severity<=.96);

const unavailable=core.assessProposalQuality(
  proposal,cheerPlan,matchPlan,
  {availableSources:3,transitionFlowCore:{}}
);
assert.equal(unavailable.components.transitionFlow,null);
assert.equal(unavailable.risks.includes('weak-section-transition'),false);
assert.equal(unavailable.nonDestructive,true);

const attached=core.attachProposalQuality(
  proposal,cheerPlan,matchPlan,
  {availableSources:3,transitionFlowCore:weakTransitionCore}
);
assert.notStrictEqual(attached,proposal);
assert.strictEqual(attached.audioTimelinePlan,proposal.audioTimelinePlan);
assert.equal(attached.smartMixWholeMixQuality.components.transitionFlow.score,.53);
assert.ok(attached.smartMixWholeMixQuality.reviewTargets.some(row=>row.reason==='weak-section-transition'));
assert.equal(attached.smartMixWholeMixQuality.nonDestructive,true);

console.log('smart-mix whole quality transition integration tests passed');
