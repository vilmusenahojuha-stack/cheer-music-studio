const assert=require('node:assert/strict');
const Stretch=require('../time-stretch-core.js');

function sine(freq,sampleRate,seconds,phase=0){const n=Math.round(sampleRate*seconds),out=new Float32Array(n);for(let i=0;i<n;i++)out[i]=Math.sin(2*Math.PI*freq*i/sampleRate+phase);return out}
function risingCrossings(data,limit){let n=0;const end=Math.min(data.length,limit);for(let i=1;i<end;i++)if(data[i-1]<=0&&data[i]>0)n++;return n}

const sr=48000,input=sine(440,sr,2),right=sine(440,sr,2,Math.PI/4);
for(const rate of [.8,1,1.2]){
  const out=Stretch.stretchChannels([input,right],sr,rate,{candidateStep:16,correlationStep:32});
  assert.equal(out.length,2,'stereo channel count must be preserved');
  assert.ok(Math.abs(out[0].length-Math.round(input.length/rate))<=1,'output duration must follow tempo ratio');
  assert.equal(out[0].length,out[1].length,'stereo channels must stay sample-aligned');
  const crossings=risingCrossings(out[0],sr);assert.ok(crossings>=430&&crossings<=450,`pitch must remain near 440 Hz at ${rate}x, got ${crossings} crossings`);
}
assert.equal(Stretch.needsStretch(1),false);assert.equal(Stretch.needsStretch(1.1),true);
assert.equal(Stretch.renderedSourceOffset(4,1.25),3.2,'original-source seconds must map to stretched-buffer seconds');
assert.equal(Stretch.renderedDuration(10,1.25),8,'stretched buffer duration must contract without changing pitch');
console.log('time-stretch-core: duration, stereo alignment, pitch preservation and source mapping passed');
