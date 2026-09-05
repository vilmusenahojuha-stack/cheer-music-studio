const assert=require('assert');
const core=require('../cheer-audio-profile-core.js');

function makeEight(sr,bpm,amplitude,activity=1){
  const length=Math.round(sr*(480/bpm));
  const out=new Float32Array(length);
  for(let i=0;i<length;i++){
    const carrier=Math.sin(2*Math.PI*8*i/sr);
    const pulse=(i%Math.max(2,Math.floor(sr/(4*activity))))<2?1:0;
    out[i]=amplitude*(carrier*.85+pulse*.15);
  }
  return out;
}

function concat(parts){
  const length=parts.reduce((sum,p)=>sum+p.length,0);
  const out=new Float32Array(length);
  let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}
  return out;
}

const sr=2000,bpm=148;
const pcm=concat([
  makeEight(sr,bpm,.18,1),
  makeEight(sr,bpm,.20,1),
  makeEight(sr,bpm,.04,.5),
  makeEight(sr,bpm,.55,2),
  makeEight(sr,bpm,.52,2)
]);

const profile=core.analyzeEightCountEnergy(pcm,{sampleRate:sr,bpm,totalEights:5});
assert.equal(profile.length,5);
assert.equal(profile[0].eight,1);
assert.ok(profile[2].energyScore<profile[1].energyScore,'quiet eight should score lower');
assert.ok(profile[3].energyScore>profile[2].energyScore,'drop eight should score higher');
assert.ok(['low','medium'].includes(profile[2].energy),'quiet eight should be low/medium');
assert.ok(['high','peak'].includes(profile[3].energy),'loud eight should be high/peak');

const events=core.detectAudioEnergyEvents(profile,{breakThreshold:.2,dropThreshold:.2});
assert.ok(events.some(e=>e.type==='break'&&e.atEight===3),'expected break at eight 3');
assert.ok(events.some(e=>e.type==='drop'&&e.atEight===4),'expected drop at eight 4');
assert.ok(events.every(e=>e.confidence>=0&&e.confidence<=1));

const offsetProfile=core.analyzeEightCountEnergy(concat([new Float32Array(sr),pcm]),{sampleRate:sr,bpm,oneOffset:1,totalEights:2});
assert.equal(offsetProfile.length,2);
assert.ok(Math.abs(offsetProfile[0].start-1)<1e-9);

assert.throws(()=>core.analyzeEightCountEnergy(pcm,{sampleRate:0,bpm}),/sampleRate/);
assert.throws(()=>core.analyzeEightCountEnergy(pcm,{sampleRate:sr,bpm:0}),/bpm/);
assert.deepEqual(core.analyzeEightCountEnergy(new Float32Array(0),{sampleRate:sr,bpm}),[]);

console.log('cheer-audio-profile-core tests passed');
