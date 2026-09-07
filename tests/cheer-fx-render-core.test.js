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
