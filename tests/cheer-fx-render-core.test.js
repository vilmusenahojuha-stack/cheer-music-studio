const assert=require('assert');
const core=require('../cheer-fx-render-core.js');

const stunt=core.impactRenderSpec({id:'fx-stunt',kind:'impact',at:6,sectionId:'stunt-1',sectionType:'stunt',confidence:.9});
assert.ok(stunt);
assert.equal(stunt.at,6);
assert.equal(stunt.sectionType,'stunt');
assert.equal(stunt.preservesTimelineTiming,true);
assert.equal(stunt.nonDestructive,true);
assert.ok(stunt.low.gain>0&&stunt.low.gain<.1);
assert.ok(stunt.transient.gain>0&&stunt.transient.gain<.05);
assert.ok(stunt.low.startHz>stunt.low.endHz);
assert.ok(stunt.transient.startHz>stunt.transient.endHz);
assert.equal(stunt.duration,.16);

const ending=core.impactRenderSpec({kind:'impact',at:18,sectionType:'ending',confidence:.75});
assert.ok(ending);
assert.equal(ending.at,18);
assert.ok(ending.strength<=1);

assert.equal(core.impactRenderSpec({kind:'impact',at:4,sectionType:'dance'}),null,'dance must not get structural impact synth');
assert.equal(core.impactRenderSpec({kind:'riser',at:4,sectionType:'stunt'}),null,'non-impact FX must not use impact synth');
assert.equal(core.impactRenderSpec({kind:'impact',at:-1,sectionType:'stunt'}),null,'negative timeline positions must be rejected');

const events=core.buildRenderEvents([
  {id:'late',kind:'impact',at:18,sectionType:'ending',confidence:.8},
  {id:'flow',kind:'impact',at:12,sectionType:'dance',confidence:.9},
  {id:'early',kind:'impact',at:6,sectionType:'stunt',confidence:.9},
  {id:'outside',kind:'impact',at:31,sectionType:'basket',confidence:.9}
],24);
assert.deepEqual(events.map(e=>[e.id,e.at,e.sectionType]),[
  ['early',6,'stunt'],['late',18,'ending']
]);

const before={kind:'impact',at:6,sectionType:'pyramid',confidence:.7};
const snapshot=JSON.stringify(before);
core.impactRenderSpec(before);
assert.equal(JSON.stringify(before),snapshot,'render planning must not mutate FX anchors');

console.log('cheer-fx-render-core tests passed');
