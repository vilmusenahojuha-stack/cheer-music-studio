const assert=require('node:assert/strict');
const DSP=require('../mix-dsp-core.js');

const clip={type:'music',sourceName:'A',start:10,duration:4,volume:.8,fadeIn:1,fadeOut:1};
assert.equal(DSP.clipEnvelopeAt(clip,9.9),0);
assert.equal(DSP.clipEnvelopeAt(clip,10),0);
assert.ok(Math.abs(DSP.clipEnvelopeAt(clip,10.5)-.4)<1e-9);
assert.ok(Math.abs(DSP.clipEnvelopeAt(clip,11)-.8)<1e-9);
assert.ok(Math.abs(DSP.clipEnvelopeAt(clip,13.5)-.4)<1e-9);
assert.equal(DSP.clipEnvelopeAt(clip,14),0);

const clips=[clip,{type:'voice',start:11,duration:1,volume:1}];
const settings={autoDuck:true,duckDb:-6,duckAttack:.1,duckRelease:.2};
const duck=Math.pow(10,-6/20);
assert.equal(DSP.duckFactorAt(10.8,clips,settings),1);
assert.ok(Math.abs(DSP.duckFactorAt(11,clips,settings)-duck)<1e-9);
assert.ok(Math.abs(DSP.duckFactorAt(11.5,clips,settings)-duck)<1e-9);
assert.ok(Math.abs(DSP.duckFactorAt(12,clips,settings)-duck)<1e-9);
assert.ok(DSP.duckFactorAt(12.1,clips,settings)>duck&&DSP.duckFactorAt(12.1,clips,settings)<1);
assert.equal(DSP.duckFactorAt(12.2,clips,settings),1);

const overlapVoices=[clip,{type:'voice',start:11,duration:1,volume:1},{type:'voice',start:11.5,duration:1,volume:1}];
assert.ok(Math.abs(DSP.duckFactorAt(11.75,overlapVoices,settings)-duck)<1e-9,'overlapping voices must not compound ducking below configured floor');

const envPoints=DSP.clipAutomationPoints(clip,10,14);
assert.deepEqual(envPoints.map(p=>p[0]),[10,11,13,14]);
const duckPoints=DSP.duckAutomationPoints(clip,clips,10,14,settings);
assert.ok(duckPoints.some(p=>Math.abs(p[0]-10.9)<1e-9));
assert.ok(duckPoints.some(p=>Math.abs(p[0]-11)<1e-9));
assert.ok(duckPoints.some(p=>Math.abs(p[0]-12)<1e-9));
assert.ok(duckPoints.some(p=>Math.abs(p[0]-12.2)<1e-9));

// Smart Mix impact-cut uses the same preview/export DSP envelope: a quarter-count anticipation dip
// before the exact section boundary, followed by the existing click-safe microfade to zero.
const impactClip={
  type:'music',sourceName:'Impact source',start:0,duration:480/152*2,volume:1,fadeIn:0,fadeOut:.008,
  smartMix:{sourceStartEight:1,sourceEndEight:2,transitionOut:{type:'impact-cut',countLength:0}}
};
const impactShape=DSP.impactShape(impactClip);
const countSeconds=60/152;
assert.ok(impactShape,'impact-cut should create a DSP anticipation shape');
assert.ok(Math.abs(impactShape.prepSeconds-countSeconds*.25)<1e-9,'impact preparation must be exactly one quarter count');
assert.equal(impactShape.fadeSeconds,.008);
assert.equal(impactShape.floor,.22);
assert.equal(DSP.clipEnvelopeAt(impactClip,impactClip.duration-impactShape.prepSeconds),1);
const midway=impactClip.duration-(impactShape.prepSeconds+impactShape.fadeSeconds)/2;
const midwayGain=DSP.clipEnvelopeAt(impactClip,midway);
assert.ok(midwayGain>.22&&midwayGain<1,'anticipation region should ramp down before the hit');
assert.ok(Math.abs(DSP.clipEnvelopeAt(impactClip,impactClip.duration-impactShape.fadeSeconds)-.22)<1e-9,'microfade starts from the anticipation floor');
assert.equal(DSP.clipEnvelopeAt(impactClip,impactClip.duration),0);
const impactPoints=DSP.clipAutomationPoints(impactClip,0,impactClip.duration);
assert.ok(impactPoints.some(p=>Math.abs(p[0]-(impactClip.duration-impactShape.prepSeconds))<1e-9),'automation includes quarter-count anticipation start');
assert.ok(impactPoints.some(p=>Math.abs(p[0]-(impactClip.duration-impactShape.fadeSeconds))<1e-9),'automation includes impact microfade start');
assert.equal(impactClip.start,0,'DSP must not move the clip start');
assert.ok(Math.abs(impactClip.duration-(480/152*2))<1e-12,'DSP must not change timeline duration');

// Smart Mix flow-blend stays count-safe but softens the outgoing phrase over half a count.
// It deliberately avoids changing clip timing or introducing overlap until the timeline engine
// can support overlap without moving cheer count boundaries.
const flowClip={
  ...impactClip,
  sourceName:'Flow source',
  fadeOut:.020,
  smartMix:{sourceStartEight:1,sourceEndEight:2,transitionOut:{type:'flow-blend',countLength:0}}
};
const flowShape=DSP.flowShape(flowClip);
assert.ok(flowShape,'flow-blend should create a DSP continuity shape');
assert.ok(Math.abs(flowShape.prepSeconds-countSeconds*.5)<1e-9,'flow preparation must span exactly half a count');
assert.equal(flowShape.fadeSeconds,.020);
assert.equal(flowShape.floor,.72);
assert.equal(DSP.clipEnvelopeAt(flowClip,flowClip.duration-flowShape.prepSeconds),1);
const flowMidway=flowClip.duration-(flowShape.prepSeconds+flowShape.fadeSeconds)/2;
const flowMidwayGain=DSP.clipEnvelopeAt(flowClip,flowMidway);
assert.ok(flowMidwayGain>.72&&flowMidwayGain<1,'flow region should soften gradually before the boundary');
assert.ok(Math.abs(DSP.clipEnvelopeAt(flowClip,flowClip.duration-flowShape.fadeSeconds)-.72)<1e-9,'flow microfade starts from continuity floor');
assert.equal(DSP.clipEnvelopeAt(flowClip,flowClip.duration),0);
const flowPoints=DSP.clipAutomationPoints(flowClip,0,flowClip.duration);
assert.ok(flowPoints.some(p=>Math.abs(p[0]-(flowClip.duration-flowShape.prepSeconds))<1e-9),'automation includes half-count flow start');
assert.ok(flowPoints.some(p=>Math.abs(p[0]-(flowClip.duration-flowShape.fadeSeconds))<1e-9),'automation includes flow microfade start');
assert.equal(flowClip.start,0,'flow DSP must not move the clip start');
assert.ok(Math.abs(flowClip.duration-(480/152*2))<1e-12,'flow DSP must not change timeline duration');
assert.equal(flowClip.smartMix.sourceStartEight,1,'flow DSP must not change source count position');

// Risky Smart Mix boundaries get a longer guarded exit instead of pretending the source has a
// strong break/drop. The protection is still count-safe: it only changes gain before the boundary.
const guardedClip={
  ...impactClip,
  sourceName:'Guarded source',
  fadeOut:.032,
  smartMix:{sourceStartEight:1,sourceEndEight:2,transitionOut:{type:'guarded-cut',countLength:0}}
};
const guardedShape=DSP.guardedShape(guardedClip);
assert.ok(guardedShape,'guarded-cut should create a protection shape');
assert.ok(Math.abs(guardedShape.prepSeconds-countSeconds*.75)<1e-9,'guarded protection must span three quarters of a count');
assert.equal(guardedShape.fadeSeconds,.032);
assert.equal(guardedShape.floor,.42);
assert.ok(Math.abs(DSP.clipEnvelopeAt(guardedClip,guardedClip.duration-guardedShape.prepSeconds)-1)<1e-9,'guarded protection starts at unity gain');
const guardedMidway=guardedClip.duration-(guardedShape.prepSeconds+guardedShape.fadeSeconds)/2;
const guardedMidwayGain=DSP.clipEnvelopeAt(guardedClip,guardedMidway);
assert.ok(guardedMidwayGain>.42&&guardedMidwayGain<1,'guarded region should reduce exposed weak-boundary energy gradually');
assert.ok(Math.abs(DSP.clipEnvelopeAt(guardedClip,guardedClip.duration-guardedShape.fadeSeconds)-.42)<1e-9,'guarded microfade starts from protection floor');
assert.equal(DSP.clipEnvelopeAt(guardedClip,guardedClip.duration),0);
const guardedPoints=DSP.clipAutomationPoints(guardedClip,0,guardedClip.duration);
assert.ok(guardedPoints.some(p=>Math.abs(p[0]-(guardedClip.duration-guardedShape.prepSeconds))<1e-9),'automation includes guarded protection start');
assert.ok(guardedPoints.some(p=>Math.abs(p[0]-(guardedClip.duration-guardedShape.fadeSeconds))<1e-9),'automation includes guarded microfade start');
assert.equal(guardedClip.start,0,'guarded DSP must not move the clip start');
assert.ok(Math.abs(guardedClip.duration-(480/152*2))<1e-12,'guarded DSP must not change timeline duration');
assert.equal(guardedClip.smartMix.sourceStartEight,1,'guarded DSP must not change source count position');

const cleanClip={...impactClip,smartMix:{...impactClip.smartMix,transitionOut:{type:'clean-cut'}},fadeOut:.014};
assert.equal(DSP.impactShape(cleanClip),null);
assert.equal(DSP.flowShape(cleanClip),null,'unrelated transition types retain the original microfade envelope');
assert.equal(DSP.guardedShape(cleanClip),null,'clean cuts must not receive guarded protection');
assert.ok(Math.abs(DSP.clipEnvelopeAt(cleanClip,cleanClip.duration-.007)-.5)<1e-9,'clean-cut microfade behavior remains unchanged');

const events=[];const param={cancelScheduledValues:t=>events.push(['cancel',t]),setValueAtTime:(v,t)=>events.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>events.push(['ramp',v,t])};
DSP.scheduleParam(param,[[2,.2],[3,.8],[4,0]],10,2);
assert.deepEqual(events[0],['cancel',10]);
assert.deepEqual(events[1],['set',.2,10]);
assert.deepEqual(events[2],['ramp',.8,11]);
assert.equal(events[3][0],'ramp');assert.equal(events[3][2],12);assert.ok(events[3][1]>0&&events[3][1]<.00001,'zero automation uses a tiny non-zero WebAudio floor');

assert.equal(DSP.rateForClip({type:'music',sourceName:'A'},{A:{bpm:100}},150),1.5);
assert.equal(DSP.rateForClip({type:'voice',sourceName:'A'},{A:{bpm:100}},150),1);
console.log('mix-dsp-core: shared preview/export DSP regression tests passed');