const assert=require('assert');
const core=require('../smart-mix-cheer-fx-integration-core.js');

const proposal={
  kind:'smart-mix-2-proposal-package',status:'preview-ready',summary:{sections:4},
  audioTimelinePlan:{
    status:'preview-ready',duration:24,clips:[
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
const anchors=core.buildStructuralFxAnchors(proposal);
assert.equal(anchors.length,2);
assert.deepEqual(anchors.map(a=>[a.kind,a.at,a.sectionId,a.sectionType]),[
  ['impact',6,'stunt','stunt'],['impact',18,'ending','ending']
]);
assert.equal(anchors[0].sourceTransitionType,'impact-cut');
assert.equal(anchors[0].confidence,.91);
assert.equal(anchors[0].nonDestructive,true);
assert.equal(anchors[0].executable,false);
assert.equal(anchors[0].preservesTimelineTiming,true);

const attached=core.attachStructuralCheerFx(proposal);
assert.equal(attached.cheerFx.status,'preview-planned');
assert.equal(attached.cheerFx.mode,'structural-impact-anchors');
assert.equal(attached.cheerFx.summary.impacts,2);
assert.equal(attached.summary.cheerFxAnchors,2);
assert.equal(attached.audioTimelinePlan.cheerFxAnchors.length,2);
assert.equal(attached.audioTimelinePlan.clips[1].start,6);
assert.equal(attached.audioTimelinePlan.clips[3].start,18);
assert.equal(JSON.stringify(proposal),before,'integration must not mutate the Smart Mix proposal');

const flowOnly=core.attachStructuralCheerFx({kind:'smart-mix-2-proposal-package',summary:{},audioTimelinePlan:{status:'preview-ready',clips:[{start:0,smartMix:{sectionId:'dance',sectionType:'dance'}}],transitions:[]}});
assert.equal(flowOnly.cheerFx.status,'no-structural-impact-anchors');
assert.equal(flowOnly.audioTimelinePlan.cheerFxAnchors.length,0);

const blocked=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',audioTimelinePlan:{status:'blocked',clips:[],transitions:[]}});
assert.deepEqual(blocked,[]);

console.log('smart-mix-cheer-fx-integration-core tests passed');
