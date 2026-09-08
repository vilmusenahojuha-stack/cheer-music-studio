'use strict';
const assert=require('assert');
const auto=require('../voiceover-auto-loudness.js');
const loudness=require('../voiceover-loudness-analysis-core.js');
const processing=require('../voiceover-processing-core.js');

function buffer(amplitude=.05,seconds=1,sampleRate=48000){
  const n=Math.floor(seconds*sampleRate),ch=new Float32Array(n);
  for(let i=0;i<n;i++)ch[i]=amplitude*Math.sin(2*Math.PI*1000*i/sampleRate);
  return{sampleRate,numberOfChannels:1,length:n,duration:seconds,getChannelData(){return ch;}};
}

(async()=>{
  auto.clearCache();
  const clip={
    id:'voice-slot-1',
    type:'voice',
    sourceName:'team-callout.wav',
    start:18.25,
    duration:1.75,
    sourceOffset:.25,
    volume:.9,
    voiceoverSlotId:'slot-1'
  };
  const timingBefore={start:clip.start,duration:clip.duration,sourceOffset:clip.sourceOffset,volume:clip.volume};
  const track={name:'team-callout.wav',url:'blob:team-callout'};
  const project={
    tracks:[track],
    mixSettings:{
      voiceoverCompetitionPackage:{
        kind:'cheer-voiceover-competition-package',
        selected:[{slotId:'slot-1',sectionType:'ending',role:'final-callout',rhythm:{shape:'hit',assignedCounts:2}}]
      }
    }
  };

  const analyzed=await auto.analyzeClipSource(clip,track,{loudnessCore:loudness,decodeTrack:async()=>buffer(.05)});
  assert.strictEqual(analyzed.status,'analyzed');
  assert(Number.isFinite(clip.voiceoverIntegratedLufs),'automatic analysis must write integrated loudness');
  assert(Number.isFinite(clip.voiceoverTruePeakDb),'automatic analysis must write true peak');

  const plan=processing.processingPlan(project,clip);
  assert.strictEqual(plan.active,true,'competition voiceover processing must activate');
  assert.strictEqual(plan.loudnessAware,true);
  assert.strictEqual(plan.loudness.active,true,'automatic measurement must activate loudness balancing');
  assert.strictEqual(plan.loudness.integratedLufs,clip.voiceoverIntegratedLufs);
  assert.strictEqual(plan.loudness.truePeakDb,clip.voiceoverTruePeakDb);
  assert(plan.loudness.adjustmentDb>0,'quiet analyzed voiceover should receive a safe boost');
  assert(plan.loudness.adjustmentDb<=processing.LOUDNESS_POLICY.maxBoostDb,'boost must respect policy maximum');
  assert(plan.loudnessGain>1,'render gain plan must reflect automatic loudness analysis');
  assert(plan.stages.includes('loudness-balance'),'render processing stages must include loudness balance');
  assert.deepStrictEqual({start:clip.start,duration:clip.duration,sourceOffset:clip.sourceOffset,volume:clip.volume},timingBefore,'analysis + processing planning must not alter voiceover timing or clip volume');

  const legacyClip={type:'voice',sourceName:'legacy.wav',start:3,duration:1};
  await auto.analyzeClipSource(legacyClip,{name:'legacy.wav',url:'blob:legacy'},{loudnessCore:loudness,decodeTrack:async()=>buffer(.05)});
  const legacyPlan=processing.processingPlan({mixSettings:{}},legacyClip);
  assert.strictEqual(legacyPlan.active,false,'automatic loudness metadata must not opt legacy voiceovers into competition processing');

  console.log('voiceover loudness -> competition processing integration checks passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
