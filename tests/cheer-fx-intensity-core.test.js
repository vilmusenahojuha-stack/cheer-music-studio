const assert=require('assert');
const core=require('../cheer-fx-intensity-core.js');

const baseEvent={confidence:.9,priority:.9,destructive:false,executable:false};

assert.equal(core.classifyIntensity(.9),'hero');
assert.equal(core.classifyIntensity(.7),'strong');
assert.equal(core.classifyIntensity(.5),'medium');
assert.equal(core.classifyIntensity(.2),'light');

const endingImpact=core.scoreEvent({...baseEvent,kind:'impact',sectionType:'ending'});
const introWhoosh=core.scoreEvent({...baseEvent,kind:'whoosh',sectionType:'intro'});
assert(endingImpact>introWhoosh,'ending impact should be stronger than intro whoosh');

const fxPlan={
  kind:'cheer-fx-plan',status:'preview-ready',bpm:152,riskFlags:[],events:[
    {...baseEvent,kind:'impact',sectionType:'ending',eight:20,at:40},
    {...baseEvent,kind:'impact',sectionType:'ending',eight:20,at:40.3,priority:.86},
    {...baseEvent,kind:'riser',sectionType:'pyramid',eight:19,at:38},
    {...baseEvent,kind:'whoosh',sectionType:'dance',eight:18,at:36},
    {...baseEvent,kind:'impact',sectionType:'stunt',eight:17,at:34}
  ]
};

const plan=core.createCheerFxIntensityPlan(fxPlan,{maxPerEight:1,maxHeroPerFourEights:2,minSpacingSeconds:.12});
assert.equal(plan.kind,'cheer-fx-intensity-plan');
assert.equal(plan.status,'preview-ready');
assert.equal(plan.nonDestructive,true);
assert.equal(plan.executable,false);
assert.equal(plan.safePreviewOnly,true);
assert.equal(plan.bpm,152);
assert(plan.events.every(e=>['hero','strong','medium','light'].includes(e.intensity)));
assert.equal(plan.events.filter(e=>e.eight===20).length,1,'density must keep only one FX in eight 20');
assert(plan.dropped.some(e=>e.densityReason==='eight-density-limit'));
assert(plan.riskFlags.includes('fx-density-reduced'));

const heroDense=core.enforceDensity(core.applyIntensity([
  {...baseEvent,kind:'impact',sectionType:'ending',eight:1,at:1},
  {...baseEvent,kind:'impact',sectionType:'ending',eight:2,at:2},
  {...baseEvent,kind:'impact',sectionType:'ending',eight:3,at:3}
]),{maxPerEight:2,maxHeroPerFourEights:2,minSpacingSeconds:0});
assert.equal(heroDense.kept.filter(e=>e.intensity==='hero').length,2);
assert(heroDense.dropped.some(e=>e.densityReason==='hero-density-limit'));

const review=core.createCheerFxIntensityPlan({...fxPlan,status:'review-required'});
assert.equal(review.status,'review-required');

const blocked=core.createCheerFxIntensityPlan({kind:'cheer-fx-plan',status:'blocked'});
assert.equal(blocked.status,'blocked');
assert.equal(blocked.reason,'cheer-fx-plan-blocked');

const missing=core.createCheerFxIntensityPlan(null);
assert.equal(missing.status,'blocked');
assert.equal(missing.reason,'cheer-fx-plan-required');

console.log('cheer-fx-intensity-core tests passed');
