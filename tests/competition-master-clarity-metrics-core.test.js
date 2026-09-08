const assert=require('assert');
const {PROFILE,measureCompetitionClarity,mergeIntoMasterMetrics}=require('../competition-master-clarity-metrics-core');

function buffer(seconds=4,sampleRate=1000){
  const data=new Float32Array(seconds*sampleRate);
  for(let i=0;i<data.length;i++)data[i]=Math.sin(i*.13)*.08;
  return {sampleRate,numberOfChannels:1,getChannelData:()=>data,data};
}
function amplify(data,sampleRate,start,end,gain){
  for(let i=Math.floor(start*sampleRate);i<Math.min(data.length,Math.ceil(end*sampleRate));i++)data[i]*=gain;
}

{
  const b=buffer();const before=b.data.slice();
  amplify(b.data,b.sampleRate,1,1.6,4);
  amplify(b.data,b.sampleRate,2.2,2.45,3);
  const result=measureCompetitionClarity(b,{voiceoverWindows:[{id:'vo-1',start:1,end:1.6}],fxWindows:[{id:'fx-1',start:2.2,end:2.45}]});
  assert.equal(result.kind,'cheer-competition-master-clarity-metrics');
  assert.equal(result.stage,'post-voiceover-mix');
  assert(result.voiceoverClarityScore>=.72,`voice score ${result.voiceoverClarityScore}`);
  assert(result.fxClarityScore>=.68,`fx score ${result.fxClarityScore}`);
  assert.equal(result.voiceover.windowsMeasured,1);
  assert.equal(result.fx.windowsMeasured,1);
  for(let i=0;i<before.length;i++){
    const expected=(i>=1000&&i<1600)?before[i]*4:(i>=2200&&i<2450)?before[i]*3:before[i];
    assert(Math.abs(b.data[i]-expected)<1e-6);
  }
}
{
  const b=buffer();
  amplify(b.data,b.sampleRate,1,1.5,1.05);
  const result=measureCompetitionClarity(b,{voiceoverWindows:[{start:1,end:1.5}]});
  assert(result.voiceoverClarityScore<.72);
  assert.equal(result.fxClarityScore,null);
}
{
  const b=buffer();
  const result=measureCompetitionClarity(b,{});
  assert.equal(result.voiceoverClarityScore,null);
  assert.equal(result.fxClarityScore,null);
  const merged=mergeIntoMasterMetrics({truePeakDbtp:-2},result);
  assert.equal(merged.voiceoverClarityScore,null);
  assert.equal(merged.clarityMeasurement.voiceoverWindows,0);
}
{
  const merged=mergeIntoMasterMetrics({truePeakDbtp:-2},{kind:'wrong'});
  assert.deepEqual(merged,{truePeakDbtp:-2});
}
assert.equal(PROFILE.id,'fi-cheer-master-clarity-v1');
console.log('competition-master-clarity-metrics-core tests passed');
