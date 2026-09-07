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
assert.equal(core.eightSecondsFor(proposal),3.2);
assert.equal(core.routineEightAt(6,proposal),2);
assert.equal(core.structuralPriority('ending','impact'),1);
assert.equal(core.structuralPriority('stunt','riser'),.54);
assert.equal(core.sectionArcFor('riser','peak',2,4,'stunt'),'build');
assert.equal(core.sectionArcFor('impact','peak',4,4,'stunt'),'peak');
assert.equal(core.sectionArcFor('impact','release',4,4,'stunt'),'release');
assert.ok(core.sectionArcScale('peak','impact')>core.sectionArcScale('drive','impact'));
assert.ok(core.sectionArcScale('release','impact')<core.sectionArcScale('drive','impact'));
assert.deepEqual(core.DEFAULT_DENSITY_POLICY,{maxPerEight:1,maxHeroPerFourEights:1,minSpacingSeconds:.12});

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
assert.equal(anchors[0].routineEight,2);
assert.equal(anchors[0].phraseSlot,2);
assert.equal(anchors[0].energyPhase,'peak');
assert.equal(anchors[0].sectionArcStage,'build');
assert.equal(anchors[1].sectionArcStage,'drive');
assert.equal(anchors[0].intensity,'strong','stunt riser should stay supportive');
assert.equal(anchors[1].intensity,'strong','early-phrase stunt entry must not automatically become a hero impact');
assert.equal(anchors[1].phraseHeroEligible,false);
assert.equal(anchors[0].densityDecision,'keep');
assert.equal(anchors[1].densityDecision,'keep');
assert.equal(anchors[2].sectionArcStage,'build');
assert.equal(anchors[3].sectionArcStage,'peak');
assert.equal(anchors[2].intensity,'strong','ending riser should prepare the ending impact');
assert.equal(anchors[3].intensity,'hero','ending impact may remain hero even when section entry is not at the phrase boundary');
assert.equal(anchors[3].phraseHeroEligible,true);
assert.ok(anchors[1].prePhraseIntensityScore>anchors[0].prePhraseIntensityScore);
assert.ok(anchors[3].intensityScore>anchors[2].intensityScore);

const attached=core.attachStructuralCheerFx(proposal);
assert.equal(attached.cheerFx.version,7);
assert.equal(attached.cheerFx.status,'preview-executable');
assert.equal(attached.cheerFx.mode,'structural-riser-impact-section-arc-density-synth-v1');
assert.equal(attached.cheerFx.executable,true);
assert.deepEqual(attached.cheerFx.densityPolicy,core.DEFAULT_DENSITY_POLICY);
assert.equal(attached.cheerFx.summary.anchors,4);
assert.equal(attached.cheerFx.summary.executableAnchors,4);
assert.equal(attached.cheerFx.summary.densityDropped,0);
assert.equal(attached.cheerFx.summary.densityDroppedImpacts,0);
assert.equal(attached.cheerFx.summary.impacts,2);
assert.equal(attached.cheerFx.summary.risers,2);
assert.equal(attached.cheerFx.summary.hero,1);
assert.equal(attached.cheerFx.summary.strong,3);
assert.equal(attached.cheerFx.summary.phraseHeroEligible,1);
assert.equal(attached.cheerFx.summary.arcBuild,2);
assert.equal(attached.cheerFx.summary.arcPeak,1);
assert.equal(attached.cheerFx.summary.arcRelease,0);
assert.equal(attached.summary.cheerFxAnchors,4);
assert.equal(attached.summary.cheerFxExecutableAnchors,4);
assert.equal(attached.summary.cheerFxDensityDropped,0);
assert.equal(attached.summary.cheerFxDensityDroppedImpacts,0);
assert.equal(attached.summary.cheerFxImpacts,2);
assert.equal(attached.summary.cheerFxRisers,2);
assert.equal(attached.summary.cheerFxHero,1);
assert.equal(attached.summary.cheerFxStrong,3);
assert.equal(attached.summary.cheerFxPhraseHeroEligible,1);
assert.equal(attached.summary.cheerFxArcBuild,2);
assert.equal(attached.summary.cheerFxArcPeak,1);
assert.equal(attached.summary.cheerFxArcRelease,0);
assert.equal(attached.audioTimelinePlan.cheerFxAnchors.length,4);
assert.equal(attached.audioTimelinePlan.clips[1].start,6);
assert.equal(attached.audioTimelinePlan.clips[3].start,18);
assert.equal(JSON.stringify(proposal),before,'integration must not mutate the Smart Mix proposal');

const denseInput=[
  {id:'a-riser',kind:'riser',sectionId:'a',sectionType:'stunt',at:9.2,endAt:9.6,routineEight:4,intensityScore:.8,intensity:'strong',priority:.54,executable:true},
  {id:'a-impact',kind:'impact',sectionId:'a',sectionType:'stunt',at:9.6,routineEight:4,intensityScore:.94,intensity:'hero',priority:.9,executable:true},
  {id:'b-riser',kind:'riser',sectionId:'b',sectionType:'pyramid',at:9.4,endAt:9.8,routineEight:4,intensityScore:.78,intensity:'strong',priority:.576,executable:true},
  {id:'b-impact',kind:'impact',sectionId:'b',sectionType:'pyramid',at:9.8,routineEight:4,intensityScore:.82,intensity:'strong',priority:.96,executable:true}
];
const denseBefore=JSON.stringify(denseInput);
const dense=core.applyDensityPolicy(denseInput);
assert.equal(dense.find(a=>a.id==='a-impact').densityDecision,'keep','strongest impact in the eight must remain executable');
assert.equal(dense.find(a=>a.id==='a-impact').executable,true);
assert.equal(dense.find(a=>a.id==='b-impact').densityDecision,'drop','second impact in the same eight must be density-reduced');
assert.equal(dense.find(a=>a.id==='b-impact').densityReason,'eight-density-limit');
assert.equal(dense.find(a=>a.id==='b-impact').executable,false);
assert.equal(dense.find(a=>a.id==='b-riser').densityDecision,'drop','riser must follow its dropped impact so the dense section gets breathing room');
assert.equal(dense.find(a=>a.id==='b-riser').densityReason,'paired-impact-dropped');
assert.equal(dense.find(a=>a.id==='b-riser').executable,false);
assert.equal(dense.find(a=>a.id==='b-impact').at,9.8,'density policy must not move impact timing');
assert.equal(dense.find(a=>a.id==='b-riser').at,9.4,'density policy must not move riser timing');
assert.equal(JSON.stringify(denseInput),denseBefore,'density policy must not mutate source anchors');

const heroWindow=core.applyDensityPolicy([
  {id:'hero-a',kind:'impact',sectionId:'hero-a',sectionType:'stunt',at:6.4,routineEight:3,intensityScore:.9,intensity:'hero',priority:.9,executable:true},
  {id:'hero-b',kind:'impact',sectionId:'hero-b',sectionType:'ending',at:9.6,routineEight:4,intensityScore:.98,intensity:'hero',priority:1,executable:true}
]);
assert.equal(heroWindow.find(a=>a.id==='hero-b').densityDecision,'keep','stronger hero should own the four-eight phrase peak');
assert.equal(heroWindow.find(a=>a.id==='hero-a').densityDecision,'drop','only one hero impact may execute in a four-eight phrase');
assert.equal(heroWindow.find(a=>a.id==='hero-a').densityReason,'hero-density-limit');

const phraseBoundaryStunt=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',bpm:150,audioTimelinePlan:{status:'preview-ready',bpm:150,eightSeconds:3.2,startAt:0,clips:[{start:9.6,smartMix:{sectionId:'stunt-peak',sectionType:'stunt'}}],transitions:[{toSectionId:'stunt-peak',type:'impact-cut',qualityScore:.92}]}});
const boundaryImpact=phraseBoundaryStunt.find(a=>a.kind==='impact');
assert.equal(boundaryImpact.routineEight,4);
assert.equal(boundaryImpact.phraseSlot,4);
assert.equal(boundaryImpact.energyPhase,'peak');
assert.equal(boundaryImpact.sectionArcStage,'peak');
assert.equal(boundaryImpact.phraseHeroEligible,true);
assert.equal(boundaryImpact.intensity,'hero','phrase-boundary stunt impact may become hero');

const buildWindow=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',bpm:150,audioTimelinePlan:{status:'preview-ready',bpm:150,eightSeconds:3.2,startAt:0,clips:[{start:9.6,smartMix:{sectionId:'stunt-build',sectionType:'stunt'}}],transitions:[{toSectionId:'stunt-build',type:'impact-cut',qualityScore:.92}]}},{energyWindows:[{startEight:4,endEight:4,phase:'build',energy:.55}]});
const buildImpact=buildWindow.find(a=>a.kind==='impact');
assert.equal(buildImpact.energySource,'energy-window');
assert.equal(buildImpact.energyPhase,'build');
assert.equal(buildImpact.sectionArcStage,'build');
assert.equal(buildImpact.sectionArcScale,.9);
assert.equal(buildImpact.phraseHeroEligible,false);
assert.notEqual(buildImpact.intensity,'hero','build-phase impact must stay below hero even at phrase boundary');

const releaseWindow=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',bpm:150,audioTimelinePlan:{status:'preview-ready',bpm:150,eightSeconds:3.2,startAt:0,clips:[{start:9.6,smartMix:{sectionId:'pyramid-release',sectionType:'pyramid'}}],transitions:[{toSectionId:'pyramid-release',type:'impact-cut',qualityScore:.92}]}},{energyWindows:[{startEight:4,endEight:4,phase:'release',energy:.6}]});
const releaseImpact=releaseWindow.find(a=>a.kind==='impact');
assert.equal(releaseImpact.energyPhase,'release');
assert.equal(releaseImpact.sectionArcStage,'release');
assert.equal(releaseImpact.sectionArcScale,.78);
assert.equal(releaseImpact.phraseHeroEligible,false);
assert.ok(releaseImpact.intensityScore<boundaryImpact.intensityScore,'release-stage impact must be quieter than a comparable peak impact');

const basket=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',bpm:150,audioTimelinePlan:{status:'preview-ready',clips:[{start:8,smartMix:{sectionId:'basket',sectionType:'basket'}}],transitions:[{toSectionId:'basket',type:'impact-cut',qualityScore:.9}]}});
assert.equal(basket.length,2);
assert.equal(basket[0].intensity,'strong');
assert.equal(basket[1].intensity,'strong','basket entry inside a phrase should not automatically become hero');

const tooEarly=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',bpm:150,audioTimelinePlan:{status:'preview-ready',clips:[{start:.2,smartMix:{sectionId:'stunt',sectionType:'stunt'}}],transitions:[{toSectionId:'stunt',type:'impact-cut',qualityScore:.9}]}});
assert.deepEqual(tooEarly.map(a=>a.kind),['impact'],'riser must be skipped rather than crossing timeline zero');

const flowOnly=core.attachStructuralCheerFx({kind:'smart-mix-2-proposal-package',bpm:150,summary:{},audioTimelinePlan:{status:'preview-ready',clips:[{start:0,smartMix:{sectionId:'dance',sectionType:'dance'}}],transitions:[]}});
assert.equal(flowOnly.cheerFx.status,'no-structural-impact-anchors');
assert.equal(flowOnly.cheerFx.executable,false);
assert.equal(flowOnly.audioTimelinePlan.cheerFxAnchors.length,0);

const blocked=core.buildStructuralFxAnchors({kind:'smart-mix-2-proposal-package',audioTimelinePlan:{status:'blocked',clips:[],transitions:[]}});
assert.deepEqual(blocked,[]);

console.log('smart-mix-cheer-fx-integration-core tests passed');
