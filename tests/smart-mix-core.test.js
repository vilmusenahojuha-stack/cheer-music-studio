const assert=require('assert');
const smart=require('../smart-mix-core.js');

const plan={
  bpm:152,
  totalEights:5,
  timeline:[
    {eight:1,start:.04,sectionId:'intro',sectionType:'intro',energy:'medium',transition:null,energyAlignment:{status:'match',distance:.04}},
    {eight:2,start:3.197,sectionId:'intro',sectionType:'intro',energy:'low',transition:{type:'break',confidence:.88,reason:'audio-energy-drop'},energyAlignment:{status:'match',distance:.03}},
    {eight:3,start:6.355,sectionId:'stunt',sectionType:'stunt',energy:'peak',transition:{type:'drop',confidence:.94,reason:'audio-energy-rise'},energyAlignment:{status:'match',distance:.02}},
    {eight:4,start:9.513,sectionId:'stunt',sectionType:'stunt',energy:'peak',transition:null,energyAlignment:{status:'much-lower',distance:.48}},
    {eight:5,start:12.671,sectionId:'transition',sectionType:'transition',energy:'low',transition:{type:'cut',confidence:.71,reason:'section-boundary'},energyAlignment:{status:'much-higher',distance:.42}}
  ]
};

const proposal=smart.createSmartMixProposal(plan,{minConfidence:.58,maxActionsPerEight:2});
assert.equal(proposal.version,1);
assert.equal(proposal.bpm,152);
assert.equal(proposal.totalEights,5);

const at2=proposal.decisions.filter(x=>x.eight===2);
assert.equal(at2[0].type,'break');
assert.ok(at2[0].confidence>=.88);

const at3=proposal.decisions.filter(x=>x.eight===3);
assert.equal(at3[0].type,'drop');
assert.ok(at3[0].window.preSeconds>0);

const at4=proposal.decisions.filter(x=>x.eight===4);
assert.equal(at4[0].type,'build');
assert.equal(at4[0].reason,'audio-below-planned-energy');

const at5=proposal.decisions.filter(x=>x.eight===5);
assert.equal(at5[0].type,'break');
assert.ok(at5.some(x=>x.type==='cut'));

assert.ok(proposal.summary.actionable>=5);
assert.ok(proposal.summary.counts.break>=2);
assert.ok(proposal.summary.counts.drop>=1);
assert.ok(proposal.summary.counts.build>=1);
assert.ok(proposal.summary.counts.cut>=1);
assert.ok(proposal.summary.averageActionConfidence>.6);

const holdPlan={bpm:148,totalEights:1,timeline:[{eight:1,start:0,energy:'medium',transition:null,energyAlignment:{status:'match',distance:.02}}]};
const hold=smart.createSmartMixProposal(holdPlan);
assert.equal(hold.decisions.length,1);
assert.equal(hold.decisions[0].type,'hold');
assert.equal(hold.summary.actionable,0);
assert.equal(hold.summary.averageActionConfidence,null);

assert.throws(()=>smart.createSmartMixProposal({bpm:148}),/timeline/);

console.log('smart-mix-core tests passed');
