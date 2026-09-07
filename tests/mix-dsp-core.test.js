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

const flowClip={...impactClip,smartMix:{...impactClip.smartMix,transitionOut:{type:'flow-blend'}},fadeOut:.020};
assert.equal(DSP.impactShape(flowClip),null,'non-impact transition types retain their existing envelope');
assert.ok(Math.abs(DSP.clipEnvelopeAt(flowClip,flowClip.duration-.010)-.5)<1e-9,'flow microfade behavior remains unchanged');

const events=[];const param={cancelScheduledValues:t=>events.push(['cancel',t]),setValueAtTime:(v,t)=>events.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>events.push(['ramp',v,t])};
DSP.scheduleParam(param,[[2,.2],[3,.8],[4,0]],10,2);
assert.deepEqual(events[0],['cancel',10]);
assert.deepEqual(events[1],['set',.2,10]);
assert.deepEqual(events[2],['ramp',.8,11]);
assert.equal(events[3][0],'ramp');assert.equal(events[3][2],12);assert.ok(events[3][1]>0&&events[3][1]<.00001,'zero automation uses a tiny non-zero WebAudio floor');

assert.equal(DSP.rateForClip({type:'music',sourceName:'A'},{A:{bpm:100}},150),1.5);
assert.equal(DSP.rateForClip({type:'voice',sourceName:'A'},{A:{bpm:100}},150),1);
console.log('mix-dsp-core: shared preview/export DSP regression tests passed');