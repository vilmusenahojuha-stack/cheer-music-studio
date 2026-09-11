const assert=require('assert');
const core=require('../smart-mix-whole-mix-quality-core.js');

const cheerPlan={
  sections:[
    {id:'intro',type:'intro',energy:'medium'},
    {id:'stunt',type:'stunt',energy:'peak'},
    {id:'transition',type:'transition',energy:'medium'},
    {id:'dance',type:'dance',energy:'high'},
    {id:'ending',type:'ending',energy:'peak'}
  ]
};

function match(sectionId,energy,score=.88,sourceName='A.wav',trackId='A'){
  return {
    sectionId,
    best:{
      sourceName,trackId,score,
      features:{averageEnergy:energy}
    }
  };
}

const balancedMatchPlan={
  matches:[
    match('intro',.58,.88,'A.wav','A'),
    match('stunt',.91,.93,'B.wav','B'),
    match('transition',.56,.86,'A.wav','A'),
    match('dance',.77,.90,'C.wav','C'),
    match('ending',.92,.95,'B.wav','B')
  ]
};

const balancedProposal={
  sequence:[
    {sectionId:'intro',sourceName:'A.wav',trackId:'A'},
    {sectionId:'stunt',sourceName:'B.wav',trackId:'B'},
    {sectionId:'transition',sourceName:'A.wav',trackId:'A'},
    {sectionId:'dance',sourceName:'C.wav',trackId:'C'},
    {sectionId:'ending',sourceName:'B.wav',trackId:'B'}
  ],
  audioTimelinePlan:{clips:[{id:'unchanged'}]},
  summary:{sections:5}
};

const good=core.assessProposalQuality(balancedProposal,cheerPlan,balancedMatchPlan,{availableSources:3});
assert.ok(good.score>.80,'balanced cheer energy arc should score strongly');
assert.ok(['strong','good'].includes(good.rating));
assert.equal(good.risks.length,0);
assert.equal(good.readyForFxReview,true);
assert.ok(good.components.energyArc.range>.30);
assert.equal(good.components.sourceVariety.maxRun,1);
assert.equal(good.components.structure.score,1);

const flatMatchPlan={
  matches:[
    match('intro',.66,.82,'A.wav','A'),
    match('stunt',.66,.80,'A.wav','A'),
    match('transition',.66,.82,'A.wav','A'),
    match('dance',.66,.81,'A.wav','A'),
    match('ending',.66,.80,'A.wav','A')
  ]
};
const flatProposal={
  ...balancedProposal,
  sequence:balancedProposal.sequence.map(row=>({...row,sourceName:'A.wav',trackId:'A'}))
};
const flat=core.assessProposalQuality(flatProposal,cheerPlan,flatMatchPlan,{availableSources:3});
assert.ok(flat.risks.includes('flat-energy-arc'));
assert.ok(flat.risks.includes('weak-ending-energy'));
assert.equal(flat.readyForFxReview,false);
assert.ok(flat.score<good.score);

const badOrderPlan={
  sections:[
    {id:'intro',type:'intro',energy:'medium'},
    {id:'ending',type:'ending',energy:'peak'},
    {id:'dance',type:'dance',energy:'high'}
  ]
};
const badOrderMatch={
  matches:[
    match('intro',.58),
    match('ending',.90),
    match('dance',.76)
  ]
};
const structure=core.structureQuality(badOrderPlan,badOrderMatch);
assert.ok(structure.reasons.includes('ending-not-last'));
assert.ok(structure.score<1);

const attached=core.attachProposalQuality(
  balancedProposal,cheerPlan,balancedMatchPlan,{availableSources:3}
);
assert.notStrictEqual(attached,balancedProposal);
assert.strictEqual(attached.audioTimelinePlan,balancedProposal.audioTimelinePlan);
assert.deepEqual(attached.summary,balancedProposal.summary);
assert.equal(attached.smartMixWholeMixQuality.nonDestructive,true);
assert.equal(attached.smartMixWholeMixQuality.readyForFxReview,true);

const unavailable=core.assessProposalQuality({}, {}, {});
assert.equal(unavailable.nonDestructive,true);
assert.ok(unavailable.score>=0&&unavailable.score<=1);

console.log('smart-mix whole mix quality tests passed');
