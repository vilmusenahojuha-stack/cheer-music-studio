const assert=require('assert');
const core=require('../smart-mix-cheer-fx-integration-core.js');

const proposal={
  kind:'smart-mix-2-proposal-package',
  bpm:150,
  audioTimelinePlan:{
    status:'preview-ready',
    bpm:150,
    eightSeconds:3.2,
    startAt:0,
    clips:[
      {start:6.4,smartMix:{sectionId:'stunt-a',sectionType:'stunt'}},
      {start:12.8,smartMix:{sectionId:'basket-a',sectionType:'basket'}},
      {start:19.2,smartMix:{sectionId:'pyramid-a',sectionType:'pyramid'}},
      {start:25.6,smartMix:{sectionId:'ending-a',sectionType:'ending'}}
    ],
    transitions:[
      {toSectionId:'stunt-a',type:'impact-cut',qualityScore:.9},
      {toSectionId:'basket-a',type:'impact-cut',qualityScore:.9},
      {toSectionId:'pyramid-a',type:'impact-cut',qualityScore:.9},
      {toSectionId:'ending-a',type:'impact-cut',qualityScore:.9}
    ]
  }
};

assert.equal(core.sectionPatternFor('stunt').id,'stunt-build-hit');
assert.equal(core.sectionPatternFor('basket').anticipationCounts,.5);
assert.equal(core.sectionPatternFor('pyramid').anticipationCounts,1.5);
assert.equal(core.sectionPatternFor('ending').impactScale,1.12);

const before=JSON.stringify(proposal);
const anchors=core.buildStructuralFxAnchors(proposal,{densityPolicy:{maxPerEight:2,maxHeroPerFourEights:4,minSpacingSeconds:0}});
const byId=id=>anchors.find(a=>a.sectionId===id&&a.kind==='riser');
const impact=id=>anchors.find(a=>a.sectionId===id&&a.kind==='impact');

assert.equal(Number(byId('stunt-a').duration.toFixed(3)),.4,'stunt should keep a one-count anticipation');
assert.equal(byId('stunt-a').countLength,1);
assert.equal(Number(byId('basket-a').duration.toFixed(3)),.2,'basket should use a fast half-count anticipation');
assert.equal(byId('basket-a').countLength,.5);
assert.equal(Number(byId('pyramid-a').duration.toFixed(3)),.6,'pyramid should use a longer one-and-a-half-count rise');
assert.equal(byId('pyramid-a').countLength,1.5);
assert.equal(Number(byId('ending-a').duration.toFixed(3)),.4,'ending should retain one-count setup');
assert.equal(byId('ending-a').countLength,1);

for(const id of ['stunt-a','basket-a','pyramid-a','ending-a']){
  const riser=byId(id);
  const hit=impact(id);
  assert.ok(riser,'section must have a riser');
  assert.ok(hit,'section must have an impact');
  assert.equal(riser.endAt,hit.at,'section pattern must always land exactly on its impact');
  assert.equal(riser.preservesTimelineTiming,true);
  assert.equal(hit.preservesTimelineTiming,true);
  assert.equal(riser.sectionFxPattern,hit.sectionFxPattern,'paired FX must share one section pattern');
}

assert.equal(impact('stunt-a').sectionFxPattern,'stunt-build-hit');
assert.equal(impact('basket-a').sectionFxPattern,'basket-snap-hit');
assert.equal(impact('pyramid-a').sectionFxPattern,'pyramid-rise-hit');
assert.equal(impact('ending-a').sectionFxPattern,'ending-final-hit');
assert.ok(impact('basket-a').sectionPatternScale>impact('stunt-a').sectionPatternScale,'basket impact should be slightly sharper than stunt impact');
assert.ok(byId('basket-a').sectionPatternScale<byId('stunt-a').sectionPatternScale,'basket riser should stay lighter than stunt riser');
assert.ok(impact('ending-a').sectionPatternScale>impact('stunt-a').sectionPatternScale,'ending impact should carry the strongest section-pattern emphasis');

const attached=core.attachStructuralCheerFx(proposal,{densityPolicy:{maxPerEight:2,maxHeroPerFourEights:4,minSpacingSeconds:0}});
assert.equal(attached.cheerFx.version,8);
assert.equal(attached.cheerFx.mode,'section-pattern-riser-impact-energy-arc-density-synth-v1');
assert.deepEqual(attached.cheerFx.sectionPatterns,['stunt-build-hit','basket-snap-hit','pyramid-rise-hit','ending-final-hit']);
assert.equal(attached.cheerFx.summary.sectionPatterns,4);
assert.equal(attached.summary.cheerFxSectionPatterns,4);
assert.equal(JSON.stringify(proposal),before,'section pattern policy must not mutate Smart Mix timeline input');

console.log('smart-mix cheer FX section pattern tests passed');
