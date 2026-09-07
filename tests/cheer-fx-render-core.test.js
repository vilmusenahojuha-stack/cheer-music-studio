const assert=require('assert');
const core=require('../cheer-fx-render-core.js');

const stunt=core.impactRenderSpec({id:'fx-stunt',kind:'impact',at:6,sectionId:'stunt-1',sectionType:'stunt',confidence:.9,intensityScore:.92,intensity:'hero'});
assert.ok(stunt);
assert.equal(stunt.at,6);
assert.equal(stunt.fxKind,'impact');
assert.equal(stunt.sectionType,'stunt');
assert.equal(stunt.intensity,'hero');
assert.equal(stunt.intensityScore,.92);
assert.equal(stunt.preservesTimelineTiming,true);
assert.equal(stunt.nonDestructive,true);
assert.ok(stunt.low.gain>0&&stunt.low.gain<.1);
assert.ok(stunt.transient.gain>0&&stunt.transient.gain<.05);
assert.ok(stunt.low.startHz>stunt.low.endHz);
assert.ok(stunt.transient.startHz>stunt.transient.endHz);
assert.equal(stunt.duration,.16);

const lowerIntensity=core.impactRenderSpec({id:'fx-stunt-light',kind:'impact',at:6,sectionId:'stunt-1',sectionType:'stunt',confidence:.9,intensityScore:.5,intensity:'medium'});
assert.ok(lowerIntensity.strength<stunt.strength,'lower intensity score must lower rendered impact strength');
assert.equal(lowerIntensity.at,stunt.at,'intensity must not move the impact timing');
assert.equal(lowerIntensity.duration,stunt.duration,'intensity must not stretch the impact event');

const riser=core.riserRenderSpec({id:'fx-riser',kind:'riser',at:5.6,endAt:6,duration:.4,sectionType:'stunt',confidence:.9,intensityScore:.8,intensity:'strong'});
assert.ok(riser);
assert.equal(riser.kind,'impact','riser render events must reuse the shared two-voice FX scheduler');
assert.equal(riser.fxKind,'riser');
assert.equal(riser.at,5.6);
assert.equal(riser.endAt,6);
assert.equal(riser.duration,.4);
assert.equal(riser.intensity,'strong');
assert.equal(riser.intensityScore,.8);
assert.ok(riser.low.startHz<riser.low.endHz,'riser low voice must sweep upward');
assert.ok(riser.transient.startHz<riser.transient.endHz,'riser transient voice must sweep upward');
assert.ok(riser.low.gain<.02&&riser.transient.gain<.01,'riser must stay deliberately subtle');
assert.equal(riser.preservesTimelineTiming,true);
assert.equal(riser.nonDestructive,true);

const ending=core.impactRenderSpec({kind:'impact',at:18,sectionType:'ending',confidence:.75,intensityScore:.97,intensity:'hero'});
assert.ok(ending);
assert.equal(ending.at,18);
assert.ok(ending.strength<=1);

const legacy=core.impactRenderSpec({kind:'impact',at:10,sectionType:'pyramid',confidence:.8});
assert.ok(legacy,'anchors without intensity metadata must remain renderable for backward compatibility');
assert.equal(legacy.intensityScore,null);

assert.equal(core.intensityFactor({intensityScore:1}),1);
assert.equal(core.intensityFactor({intensityScore:0}),.68);
assert.equal(core.impactRenderSpec({kind:'impact',at:4,sectionType:'dance'}),null,'dance must not get structural impact synth');
assert.equal(core.riserRenderSpec({kind:'riser',at:4,endAt:4.4,duration:.4,sectionType:'dance'}),null,'dance must not get structural riser synth');
assert.equal(core.riserRenderSpec({kind:'riser',at:4,endAt:4,duration:.4,sectionType:'stunt'}),null,'riser must end after it starts');
assert.equal(core.impactRenderSpec({kind:'impact',at:-1,sectionType:'stunt'}),null,'negative timeline positions must be rejected');
assert.equal(core.impactRenderSpec({id:'density-drop-impact',kind:'impact',at:6,sectionType:'stunt',executable:false,densityDecision:'drop'}),null,'density-dropped impact must not render');
assert.equal(core.riserRenderSpec({id:'density-drop-riser',kind:'riser',at:5.6,endAt:6,duration:.4,sectionType:'stunt',executable:false,densityDecision:'drop'}),null,'riser paired with a density-dropped impact must not render');

const phraseAnchors=[
  {id:'build-riser',kind:'riser',at:2.8,endAt:3.2,duration:.4,sectionId:'stunt-build',sectionType:'stunt',routineEight:2,sectionArcStage:'build',confidence:.85,intensityScore:.74},
  {id:'build-hit',kind:'impact',at:3.2,sectionId:'stunt-build',sectionType:'stunt',routineEight:2,sectionArcStage:'build',confidence:.85,intensityScore:.74},
  {id:'drive-riser',kind:'riser',at:5.6,endAt:6,duration:.4,sectionId:'basket-drive',sectionType:'basket',routineEight:3,sectionArcStage:'drive',confidence:.9,intensityScore:.86},
  {id:'drive-hit',kind:'impact',at:6,sectionId:'basket-drive',sectionType:'basket',routineEight:3,sectionArcStage:'drive',confidence:.9,intensityScore:.86},
  {id:'peak-riser',kind:'riser',at:8.8,endAt:9.2,duration:.4,sectionId:'pyramid-peak',sectionType:'pyramid',routineEight:4,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.93,intensityScore:.96},
  {id:'peak-hit',kind:'impact',at:9.2,sectionId:'pyramid-peak',sectionType:'pyramid',routineEight:4,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.93,intensityScore:.96}
];
const phraseSnapshot=JSON.stringify(phraseAnchors);
const selected=core.selectPatternHits(phraseAnchors);
const selectedById=id=>selected.find(a=>a.id===id);
assert.equal(selectedById('peak-hit').hitRole,'principal','peak hit should become the principal phrase hit');
assert.equal(selectedById('drive-hit').hitRole,'support','drive hit should remain as a quieter support hit');
assert.equal(selectedById('build-hit').hitRole,'omit','stunt build-stage secondary impact should be intentionally omitted');
assert.equal(selectedById('build-hit').executable,false,'omitted build impact must not render');
assert.equal(selectedById('build-riser').hitRole,'omit','paired riser must follow an omitted impact');
assert.equal(selectedById('build-riser').executable,false);
assert.equal(selectedById('peak-riser').hitRole,'principal-build');
assert.equal(selectedById('drive-riser').hitRole,'support-build');
assert.ok(core.principalHitScore(selectedById('peak-hit'))>core.principalHitScore(selectedById('drive-hit')));
assert.equal(JSON.stringify(phraseAnchors),phraseSnapshot,'hit selection must not mutate source anchors');

const selectedEvents=core.buildRenderEvents(phraseAnchors,12);
assert.deepEqual(selectedEvents.map(e=>e.id),['drive-riser','drive-hit','peak-riser','peak-hit'],'omitted stunt build pair must stay out of rendered audio');
const supportEvent=selectedEvents.find(e=>e.id==='drive-hit');
const principalEvent=selectedEvents.find(e=>e.id==='peak-hit');
assert.equal(supportEvent.hitRole,'support');
assert.equal(supportEvent.supportPolicy,'basket-snap-support');
assert.equal(principalEvent.hitRole,'principal');
assert.ok(principalEvent.strength>supportEvent.strength,'principal phrase hit should render stronger than support hit');
assert.equal(principalEvent.at,9.2,'principal selection must not move impact timing');
assert.equal(supportEvent.at,6,'support selection must not move impact timing');

assert.equal(core.supportPolicyFor('pyramid').allowBuildSupport,true,'pyramid may keep a restrained build support hit');
assert.equal(core.supportPolicyFor('ending').omitSecondary,true,'ending should focus secondary FX away from the final principal hit');
assert.equal(core.resolveSecondaryRole({sectionType:'pyramid',sectionArcStage:'build'}),'support');
assert.equal(core.resolveSecondaryRole({sectionType:'stunt',sectionArcStage:'build'}),'omit');
assert.equal(core.resolveSecondaryRole({sectionType:'basket',sectionArcStage:'release'}),'omit');
assert.equal(core.resolveSecondaryRole({sectionType:'ending',sectionArcStage:'drive'}),'omit');

const sectionPolicyAnchors=[
  {id:'pyr-build-riser',kind:'riser',at:20,endAt:20.6,duration:.6,sectionId:'pyr-build',sectionType:'pyramid',routineEight:5,sectionArcStage:'build',confidence:.86,intensityScore:.76},
  {id:'pyr-build-hit',kind:'impact',at:20.6,sectionId:'pyr-build',sectionType:'pyramid',routineEight:5,sectionArcStage:'build',confidence:.86,intensityScore:.76},
  {id:'pyr-peak-riser',kind:'riser',at:23.4,endAt:24,duration:.6,sectionId:'pyr-peak',sectionType:'pyramid',routineEight:8,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.95,intensityScore:.97},
  {id:'pyr-peak-hit',kind:'impact',at:24,sectionId:'pyr-peak',sectionType:'pyramid',routineEight:8,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.95,intensityScore:.97},
  {id:'ending-drive-riser',kind:'riser',at:30.6,endAt:31,duration:.4,sectionId:'ending-drive',sectionType:'ending',routineEight:9,sectionArcStage:'drive',confidence:.9,intensityScore:.88},
  {id:'ending-drive-hit',kind:'impact',at:31,sectionId:'ending-drive',sectionType:'ending',routineEight:9,sectionArcStage:'drive',confidence:.9,intensityScore:.88},
  {id:'ending-peak-riser',kind:'riser',at:33.6,endAt:34,duration:.4,sectionId:'ending-peak',sectionType:'ending',routineEight:12,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.96,intensityScore:.99},
  {id:'ending-peak-hit',kind:'impact',at:34,sectionId:'ending-peak',sectionType:'ending',routineEight:12,sectionArcStage:'peak',phraseHeroEligible:true,confidence:.96,intensityScore:.99}
];
const sectionPolicySnapshot=JSON.stringify(sectionPolicyAnchors);
const policySelected=core.selectPatternHits(sectionPolicyAnchors);
const policyById=id=>policySelected.find(a=>a.id===id);
assert.equal(policyById('pyr-build-hit').hitRole,'support','pyramid build should support the later phrase peak');
assert.equal(policyById('pyr-build-hit').supportPolicy,'pyramid-build-support');
assert.equal(policyById('pyr-build-riser').hitRole,'support-build');
assert.equal(policyById('pyr-peak-hit').hitRole,'principal');
assert.equal(policyById('ending-drive-hit').hitRole,'omit','ending secondary hit should be removed so focus stays on the final hit');
assert.equal(policyById('ending-drive-riser').hitRole,'omit');
assert.equal(policyById('ending-peak-hit').hitRole,'principal');
assert.equal(JSON.stringify(sectionPolicyAnchors),sectionPolicySnapshot,'section support selection must not mutate source anchors');
const policyEvents=core.buildRenderEvents(sectionPolicyAnchors,40);
assert.ok(policyEvents.some(e=>e.id==='pyr-build-hit'),'pyramid build support must remain renderable');
assert.ok(policyEvents.some(e=>e.id==='pyr-build-riser'),'pyramid support riser must remain renderable');
assert.ok(!policyEvents.some(e=>e.id==='ending-drive-hit'),'ending secondary impact must stay out of rendered audio');
assert.ok(!policyEvents.some(e=>e.id==='ending-drive-riser'),'ending secondary riser must stay out of rendered audio');
const pyrBuildEvent=policyEvents.find(e=>e.id==='pyr-build-hit');
const pyrPeakEvent=policyEvents.find(e=>e.id==='pyr-peak-hit');
assert.ok(pyrPeakEvent.strength>pyrBuildEvent.strength,'pyramid peak must remain stronger than its build support');
assert.equal(pyrBuildEvent.at,20.6,'support policy must not move pyramid build timing');
assert.equal(pyrPeakEvent.at,24,'support policy must not move pyramid peak timing');

const events=core.buildRenderEvents([
  {id:'late',kind:'impact',at:18,sectionType:'ending',confidence:.8,intensityScore:.96,intensity:'hero'},
  {id:'late-riser',kind:'riser',at:17.6,endAt:18,duration:.4,sectionType:'ending',confidence:.8,intensityScore:.84,intensity:'strong'},
  {id:'flow',kind:'impact',at:12,sectionType:'dance',confidence:.9,intensityScore:.8,intensity:'strong'},
  {id:'density-drop-riser',kind:'riser',at:8.6,endAt:9,duration:.4,sectionType:'pyramid',confidence:.9,intensityScore:.8,intensity:'strong',executable:false,densityDecision:'drop'},
  {id:'density-drop-impact',kind:'impact',at:9,sectionType:'pyramid',confidence:.9,intensityScore:.9,intensity:'hero',executable:false,densityDecision:'drop'},
  {id:'early-riser',kind:'riser',at:5.6,endAt:6,duration:.4,sectionType:'stunt',confidence:.9,intensityScore:.8,intensity:'strong'},
  {id:'early',kind:'impact',at:6,sectionType:'stunt',confidence:.9,intensityScore:.92,intensity:'hero'},
  {id:'outside',kind:'impact',at:31,sectionType:'basket',confidence:.9,intensityScore:.95,intensity:'hero'}
],24);
assert.deepEqual(events.map(e=>[e.id,e.fxKind,Number(e.at.toFixed(3)),e.sectionType]),[
  ['early-riser','riser',5.6,'stunt'],['early','impact',6,'stunt'],['late-riser','riser',17.6,'ending'],['late','impact',18,'ending']
]);

const before={kind:'riser',at:5.6,endAt:6,duration:.4,sectionType:'pyramid',confidence:.7,intensityScore:.82,intensity:'strong'};
const snapshot=JSON.stringify(before);
core.riserRenderSpec(before);
assert.equal(JSON.stringify(before),snapshot,'render planning must not mutate FX anchors');

console.log('cheer-fx-render-core tests passed');
