const assert=require('assert');
const {PROFILE,measureCompetitionClarity,recheckFocusedClarity,mergeIntoMasterMetrics}=require('../competition-master-clarity-metrics-core');

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
  const result=measureCompetitionClarity(b,{
    voiceoverWindows:[{id:'vo-1',start:1,end:1.6}],
    fxWindows:[{id:'fx-1',start:2.2,end:2.45}],
    sections:[
      {id:'stunt',label:'Stunt',type:'stunt',start:0,end:2,energy:.9},
      {id:'ending',label:'Ending',type:'ending',start:2,end:4,energy:1}
    ]
  });
  assert.equal(result.kind,'cheer-competition-master-clarity-metrics');
  assert.equal(result.version,2);
  assert.equal(result.stage,'post-voiceover-mix');
  assert(result.voiceoverClarityScore>=.72,`voice score ${result.voiceoverClarityScore}`);
  assert(result.fxClarityScore>=.68,`fx score ${result.fxClarityScore}`);
  assert.equal(result.voiceover.windowsMeasured,1);
  assert.equal(result.fx.windowsMeasured,1);
  assert.equal(result.sectionClarity.kind,'cheer-competition-master-section-clarity');
  assert.equal(result.sectionClarity.sections.find(section=>section.id==='stunt').voiceover.itemsMeasured,1);
  assert.equal(result.sectionClarity.sections.find(section=>section.id==='ending').fx.itemsMeasured,1);
  const merged=mergeIntoMasterMetrics({truePeakDbtp:-2},result);
  assert.strictEqual(merged.sectionClarity,result.sectionClarity,'section-aware clarity must survive master metrics merge');
  for(let i=0;i<before.length;i++){
    const expected=(i>=1000&&i<1600)?before[i]*4:(i>=2200&&i<2450)?before[i]*3:before[i];
    assert(Math.abs(b.data[i]-expected)<1e-6);
  }
}
{
  const b=buffer();
  amplify(b.data,b.sampleRate,1,1.5,1.05);
  const result=measureCompetitionClarity(b,{
    voiceoverWindows:[{start:1,end:1.5}],
    sections:[{id:'dance',label:'Dance',type:'dance',start:0,end:4}]
  });
  assert(result.voiceoverClarityScore<.72);
  assert.equal(result.fxClarityScore,null);
  assert.equal(result.sectionClarity.summary.status,'review-required');
  assert.equal(result.sectionClarity.summary.weakestSectionLabel,'Dance');
}
{
  const b=buffer();
  const original=b.data.slice();
  amplify(b.data,b.sampleRate,1,1.5,1.05);
  const before=measureCompetitionClarity(b,{voiceoverWindows:[{start:1,end:1.5}]});
  const previousScore=before.voiceover.items[0].score;
  amplify(b.data,b.sampleRate,1,1.5,4);
  const recheck=recheckFocusedClarity(b,{kind:'voiceover',startSeconds:1,endSeconds:1.5,score:previousScore,minScore:.72});
  assert.equal(recheck.kind,'cheer-competition-master-clarity-recheck');
  assert.equal(recheck.version,1);
  assert.equal(recheck.sameWindow,true);
  assert.equal(recheck.focusKind,'voiceover');
  assert.equal(recheck.startSeconds,1);
  assert.equal(recheck.endSeconds,1.5);
  assert.equal(recheck.previousScore,previousScore);
  assert(recheck.currentScore>previousScore,`${recheck.currentScore} <= ${previousScore}`);
  assert(recheck.improvement>0);
  assert.equal(recheck.ready,true);
  assert.equal(recheck.verdict,'passed');
  assert.equal(recheck.measurement.windowsMeasured,1);
  assert.equal(recheck.measurement.items[0].start,1);
  assert.equal(recheck.measurement.items[0].end,1.5);
  assert.equal(recheck.nonDestructive,true);
  for(let i=0;i<original.length;i++){
    const expected=(i>=1000&&i<1500)?original[i]*1.05*4:original[i];
    assert(Math.abs(b.data[i]-expected)<1e-6,'recheck must not modify rendered PCM');
  }
}
{
  const b=buffer();
  amplify(b.data,b.sampleRate,2,2.4,1.02);
  const first=recheckFocusedClarity(b,{kind:'fx',startSeconds:2,endSeconds:2.4,score:.4,minScore:.68});
  assert.equal(first.focusKind,'fx');
  assert.equal(first.ready,false);
  assert(['improved','still-below-target','regressed'].includes(first.verdict));
  assert.equal(first.measurement.items[0].id,'clarity-recheck-focus');
}
{
  const b=buffer();
  const unavailable=recheckFocusedClarity(b,{kind:'voiceover',startSeconds:1,endSeconds:1});
  assert.equal(unavailable.verdict,'unavailable');
  assert.equal(unavailable.measurement,null);
  assert.equal(unavailable.sameWindow,true);
}
{
  const b=buffer();
  const result=measureCompetitionClarity(b,{});
  assert.equal(result.voiceoverClarityScore,null);
  assert.equal(result.fxClarityScore,null);
  assert.equal(result.sectionClarity,null);
  const merged=mergeIntoMasterMetrics({truePeakDbtp:-2},result);
  assert.equal(merged.voiceoverClarityScore,null);
  assert.equal(merged.clarityMeasurement.voiceoverWindows,0);
  assert.equal(merged.sectionClarity,null);
}
{
  const merged=mergeIntoMasterMetrics({truePeakDbtp:-2},{kind:'wrong'});
  assert.deepEqual(merged,{truePeakDbtp:-2});
}
assert.equal(PROFILE.id,'fi-cheer-master-clarity-v1');
console.log('competition-master-clarity-metrics-core tests passed');
