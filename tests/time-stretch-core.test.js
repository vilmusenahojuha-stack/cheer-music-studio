const assert=require('node:assert/strict');
const Stretch=require('../time-stretch-core.js');

function sine(freq,sampleRate,seconds,phase=0,amp=1){const n=Math.round(sampleRate*seconds),out=new Float32Array(n);for(let i=0;i<n;i++)out[i]=amp*Math.sin(2*Math.PI*freq*i/sampleRate+phase);return out}
function complexSignal(sampleRate,seconds){const n=Math.round(sampleRate*seconds),out=new Float32Array(n);for(let i=0;i<n;i++){const t=i/sampleRate;out[i]=.42*Math.sin(2*Math.PI*110*t)+.28*Math.sin(2*Math.PI*223*t)+.18*Math.sin(2*Math.PI*443*t);if(i%(Math.round(sampleRate*.37))<28)out[i]+=.55*(1-(i%(Math.round(sampleRate*.37)))/28)}return out}
function risingCrossings(data,limit){let n=0;const end=Math.min(data.length,limit);for(let i=1;i<end;i++)if(data[i-1]<=0&&data[i]>0)n++;return n}
function rms(data,start=0,end=data.length){let sum=0,n=0;for(let i=start;i<end;i++){sum+=data[i]*data[i];n++}return Math.sqrt(sum/Math.max(1,n))}
function blockRmsDb(data,sampleRate,seconds=.04){const n=Math.max(64,Math.round(sampleRate*seconds)),vals=[];for(let i=n;i+n<data.length;i+=n){const v=rms(data,i,i+n);if(v>1e-7)vals.push(20*Math.log10(v))}return vals}

const sr=48000,input=sine(440,sr,2),right=sine(440,sr,2,Math.PI/4);
for(const rate of [.8,1,1.2]){
  const out=Stretch.stretchChannels([input,right],sr,rate,{candidateStep:16,correlationStep:32});
  assert.equal(out.length,2,'stereo channel count must be preserved');
  assert.ok(Math.abs(out[0].length-Math.round(input.length/rate))<=1,'output duration must follow tempo ratio');
  assert.equal(out[0].length,out[1].length,'stereo channels must stay sample-aligned');
  const crossings=risingCrossings(out[0],sr);assert.ok(crossings>=430&&crossings<=450,`pitch must remain near 440 Hz at ${rate}x, got ${crossings} crossings`);
}

const stress=complexSignal(sr,8),diagnostics=[],stressRate=1.42;
const stressed=Stretch.stretchChannels([stress,stress],sr,stressRate,{candidateStep:16,correlationStep:32,onFrame:frame=>diagnostics.push(frame)});
assert.ok(diagnostics.length>100,'stress test must inspect enough WSOLA frames');
const driftLimit=Math.round(sr*.006)+16,interior=diagnostics.filter(frame=>frame.idealInputPosition<stress.length-8192);
assert.ok(interior.length>90,'drift test must cover the long-running interior of the source');
assert.ok(interior.every(frame=>Math.abs(frame.driftSamples)<=driftLimit),`WSOLA source position must stay tied to the absolute timeline within ${driftLimit} samples`);
assert.ok(stressed[0].subarray(Math.max(0,stressed[0].length-128)).some(v=>Math.abs(v)>1e-6),'time-stretch must preserve the final audio tail');

// A near-1x tempo correction used to pump because equal-power overlap boosts highly correlated audio.
// Correlation-normalized overlap should keep coherent material at essentially constant loudness.
const coherent=sine(173,sr,6,0,.65),nearRate=147/143.6;
const coherentOut=Stretch.stretchChannels([coherent,coherent],sr,nearRate,{candidateStep:8,correlationStep:16})[0];
const inputRms=rms(coherent,Math.round(sr*.5),Math.round(sr*5.5)),outputRms=rms(coherentOut,Math.round(sr*.5),Math.min(coherentOut.length,Math.round(sr*5.2))),gainDb=20*Math.log10(outputRms/inputRms);
assert.ok(Math.abs(gainDb)<.25,`near-1x coherent stretch must not change average level, got ${gainDb.toFixed(3)} dB`);
const envelope=blockRmsDb(coherentOut,sr),spread=Math.max(...envelope)-Math.min(...envelope);
assert.ok(spread<.45,`near-1x coherent stretch must not create pumping, got ${spread.toFixed(3)} dB envelope spread`);

assert.equal(Stretch.needsStretch(1),false);assert.equal(Stretch.needsStretch(1.1),true);
assert.equal(Stretch.renderedSourceOffset(4,1.25),3.2,'original-source seconds must map to stretched-buffer seconds');
assert.equal(Stretch.renderedDuration(10,1.25),8,'stretched buffer duration must contract without changing pitch');
assert.equal(Stretch.algorithm,'WSOLA-v3-adaptive-power');
console.log('time-stretch-core: duration, stereo alignment, pitch preservation, bounded drift and pumping control passed');
