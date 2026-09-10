const assert=require('assert');
const fs=require('fs');
const workflow=require('../smart-mix-workflow.js');

const source=fs.readFileSync(require.resolve('../smart-mix-workflow.js'),'utf8');
assert.doesNotMatch(source,/meta\.oneOffset\s*=(?!=)/,'Smart Mix must not overwrite the saved manual count-one');

assert.deepEqual(workflow.resolveAlignmentUse({
  accepted:true,
  reliability:{level:'strong',canAutoUse:true,needsReview:false,useManualCountOne:false,reason:'strong-structural-alignment'}
}),{
  level:'strong',canAutoUse:true,needsReview:false,useManualCountOne:false,reason:'strong-structural-alignment'
});

assert.equal(workflow.resolveAlignmentUse({
  accepted:true,
  reliability:{level:'review',canAutoUse:false,needsReview:true,useManualCountOne:false,reason:'alignment-needs-review'}
}).canAutoUse,false,'review alignment must never change count-one automatically');

assert.equal(workflow.resolveAlignmentUse({
  accepted:false,
  reliability:{level:'manual',canAutoUse:false,needsReview:false,useManualCountOne:true,reason:'use-manual-count-one'}
}).useManualCountOne,true);

assert.equal(workflow.resolveAlignmentUse({accepted:true}).canAutoUse,false,'legacy accepted result without reliability must fail safe');

(async()=>{
  const project={
    targetBpm:120,
    eights:[{part:'Intro'},{part:'Intro'},{part:'Stunt'},{part:'Stunt'}],
    tracks:[{id:'track-a',name:'Track.wav',url:'blob:track'}],
    trackAnalysis:{'Track.wav':{bpm:120,confidence:.9,method:'auto',oneOffset:.1}}
  };
  const ready=workflow.validateTrackReadiness(project).ready;
  const decoded={samples:new Float32Array(48000),sampleRate:48000,duration:20.5};
  const offsets=[];
  const profileCore={
    analyzeEightCountEnergy:(samples,opts)=>{
      offsets.push(opts.oneOffset);
      return Array.from({length:opts.totalEights},(_,i)=>({
        sourceName:opts.sourceName,
        trackId:opts.trackId,
        startEight:i+1,
        endEight:i+1,
        start:opts.oneOffset+i*4,
        end:opts.oneOffset+(i+1)*4
      }));
    }
  };
  const structureCore={buildIntelligentEightCountMap:()=>({})};

  const run=async reliability=>{
    offsets.length=0;
    const profiles=await workflow.analyzeReadyTracks(project,ready,()=>{}, {
      decodeMono:async()=>decoded,
      cores:{
        profile:profileCore,
        structure:structureCore,
        alignment:{alignProfileEightCounts:()=>({
          accepted:true,
          reason:'alignment-accepted',
          source:'structural-anchors',
          oneOffset:.5,
          alignment:{confidence:reliability.level==='strong'?.9:.7,support:3},
          reliability
        })}
      }
    });
    return profiles[0].eightAlignment;
  };

  const strong=await run({level:'strong',canAutoUse:true,needsReview:false,useManualCountOne:false,reason:'strong-structural-alignment'});
  assert.deepEqual(offsets,[.1,.5],'strong alignment may re-analyze at the refined count-one');
  assert.equal(strong.reliabilityLevel,'strong');
  assert.equal(strong.canAutoUse,true);
  assert.equal(strong.reanalyzed,true);
  assert.equal(strong.oneOffset,.5);

  const review=await run({level:'review',canAutoUse:false,needsReview:true,useManualCountOne:false,reason:'alignment-needs-review'});
  assert.deepEqual(offsets,[.1],'review alignment must preserve manual count-one');
  assert.equal(review.reliabilityLevel,'review');
  assert.equal(review.needsReview,true);
  assert.equal(review.reanalyzed,false);
  assert.equal(review.oneOffset,.1);

  const manual=await run({level:'manual',canAutoUse:false,needsReview:false,useManualCountOne:true,reason:'use-manual-count-one'});
  assert.deepEqual(offsets,[.1],'manual alignment must preserve manual count-one');
  assert.equal(manual.reliabilityLevel,'manual');
  assert.equal(manual.useManualCountOne,true);
  assert.equal(manual.reanalyzed,false);
  assert.equal(manual.oneOffset,.1);

  assert.equal(project.trackAnalysis['Track.wav'].oneOffset,.1,'Smart Mix must leave stored count-one untouched');
  console.log('smart-mix-alignment-reliability tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
