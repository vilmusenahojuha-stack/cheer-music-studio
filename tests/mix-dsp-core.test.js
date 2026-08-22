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

const events=[];const param={cancelScheduledValues:t=>events.push(['cancel',t]),setValueAtTime:(v,t)=>events.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>events.push(['ramp',v,t])};
DSP.scheduleParam(param,[[2,.2],[3,.8],[4,0]],10,2);
assert.deepEqual(events[0],['cancel',10]);
assert.deepEqual(events[1],['set',.2,10]);
assert.deepEqual(events[2],['ramp',.8,11]);
assert.equal(events[3][0],'ramp');assert.equal(events[3][2],12);assert.ok(events[3][1]>0&&events[3][1]<.00001,'zero automation uses a tiny non-zero WebAudio floor');

assert.equal(DSP.rateForClip({type:'music',sourceName:'A'},{A:{bpm:100}},150),1.5);
assert.equal(DSP.rateForClip({type:'voice',sourceName:'A'},{A:{bpm:100}},150),1);
console.log('mix-dsp-core: shared preview/export DSP regression tests passed');