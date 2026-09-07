const assert=require('assert');
const core=require('../smart-mix-cheer-fx-integration-core.js');

const proposal={
  kind:'smart-mix-2-proposal-package',status:'preview-ready',bpm:150,summary:{sections:4},
  audioTimelinePlan:{
    status:'preview-ready',bpm:150,duration:24,clips:[
      {start:0,duration:6,smartMix:{sectionId:'intro',sectionType:'intro'}},
      {start:6,duration:6,smartMix:{sectionId:'stunt',sectionType:'stunt'}},
      {start:12,duration:6,smartMix:{sectionId:'dance',sectionType:'dance'}},
      {start:18,duration:6,smartMix:{sectionId:'ending',sectionType:'ending'}}
    ],
    transitions:[
      {fromSectionId:'intro',toSectionId:'stunt',type:'impact-cut',qualityScore:.91},
      {fromSectionId:'stunt',toSectionId:'dance',type:'flow-blend',qualityScore:.84},
      {fromSectionId:'dance',toSectionId:'ending',type:'impact-cut',qualityScore:.88}
    ]
  }
};

const before=JSON.stringify(proposal);
assert.equal(core.countSecondsFor(proposal),.4);
const anchors=core.buildStructuralFxAnchors(proposal);
assert.equal(anchors.length,4);
assert.deepEqual(anchors.map(a=>[a.kind,Number(a.at.toFixed(3)),a.sectionId,a.sectionType]),[
  ['riser',5.6,'stunt','stunt'],['impact',6,'stunt','stunt'],['riser',17.6,'ending','ending'],['impact',18,'ending','ending']
]);
assert.equal(anchors[0].duration,.4);
assert.equal(anchors[0].endAt,6);
assert.equal(anchors[0].countLength,1);
assert.equal(anchors[0].renderMode,'synth-riser-v1');
assert.equal(anchors[1].sourceTransitionType,'impact-cut');
assert.equal(anchors[1].confidence,.91);
assert.equal(anchors[1].renderMode,'synth-impact-v1');
assert.equal(anchors[0].nonDestructive,true);
assert.equal(anchors[0].executable,true);
assert.equal(anchors[0].preservesTimelineTiming,true);

const attached=core.attachStructuralCheerFx(proposal);
assert.equal(attached.cheerFx.version,3);
assert.equal(attached.cheerFx.status,'preview-executable');
assert.equal(attached.cheerFx.mode,'structural-riser-impact-synth-v1');
assert.equal(attached.cheerFx.executable,true);
assert.equal(attached.cheerFx.summary.impacts,2);
assert.equal(attached.cheerFx.summary.risers,2);
assert.equal(attached.summary.cheerFxAnchors,4);
assert.equal(attached.summary.cheerFxImpacts,2);
assert.equal(attached.summary.cheerFxRisers,2);
assert.equal(attached.audioTimelinePlan.cheerFxAnchors.length,4);
assert.equal(attached.audioTimelinePlan.clips[1].start,6);
assert.equal(attached.audioTimelinePlan.clips[3].start,18);
assert.equal(JSON.stringify(proposal),before,'integration must not mutate the Smart Mix proposal');

const tooEarly=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',bpm:150,audioTimelinePlan:{status:'preview-ready',clips:[{start:.2,smartMix:{sectionId:'stunt',sectionType:'stunt'}}],transitions:[{toSectionId:'stunt',type:'impact-cut',qualityScore:.9}]}});
assert.deepEqual(tooEarly.map(a=>a.kind),['impact'],'riser must be skipped rather than crossing timeline zero');

const flowOnly=core.attachStructuralCheerFx({kind:'smart-mix-2-proposal-package',bpm:150,summary:{},audioTimelinePlan:{status:'preview-ready',clips:[{start:0,smartMix:{sectionId:'dance',sectionType:'dance'}}],transitions:[]}});
assert.equal(flowOnly.cheerFx.status,'no-structural-impact-anchors');
assert.equal(flowOnly.cheerFx.executable,false);
assert.equal(flowOnly.audioTimelinePlan.cheerFxAnchors.length,0);

const blocked=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',audioTimelinePlan:{status:'blocked',clips:[],transitions:[]}});
assert.deepEqual(blocked,[]);

console.log('smart-mix-cheer-fx-integration-core tests passed');
