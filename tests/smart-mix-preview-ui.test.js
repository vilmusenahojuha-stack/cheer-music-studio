const assert=require('assert');
const ui=require('../smart-mix-preview-ui.js');

const project={
  targetBpm:150,
  tracks:[
    {name:'A.wav',duration:30},
    {name:'B.wav',duration:30},
    {name:'C.wav',duration:30}
  ],
  trackAnalysis:{
    'A.wav':{bpm:150},
    'B.wav':{bpm:150},
    'C.wav':{bpm:150}
  },
  audioTimeline:{clips:[
    {id:'a',type:'music',sourceName:'A.wav',start:0,sourceOffset:4,duration:4,fadeIn:0,fadeOut:0},
    {id:'b',type:'music',sourceName:'B.wav',start:4.1,sourceOffset:6,duration:4,fadeIn:0,fadeOut:0}
  ]}
};
const original=JSON.stringify(project.audioTimeline.clips);
const plans=[{
  a:{id:'a'},b:{id:'b'},transition:4.1,gap:.1,style:'smart-overlap',overlap:.2
}];

const preview=ui.buildSuggestedTimelinePlan(project,plans);
assert.equal(preview.status,'preview-ready');
assert.equal(preview.nonDestructive,true);
assert.equal(preview.safePreviewOnly,true);
assert.equal(preview.executable,false);
assert.equal(preview.transitionsApplied,1);
assert.equal(preview.clips.length,2);
assert.equal(preview.clips[0].sourceName,'A.wav');
assert.equal(preview.clips[1].sourceName,'B.wav');
assert.equal(preview.clips[0].sourceOffset,4);
assert.equal(preview.clips[1].sourceOffset,6);
assert.ok(preview.clips[0].duration>4.1,'smart overlap should extend outgoing clone');
assert.ok(preview.clips[0].fadeOut>0);
assert.ok(preview.clips[1].fadeIn>0);
assert.equal(JSON.stringify(project.audioTimeline.clips),original,'preview must not mutate project timeline');

const wholePackage={
  kind:'smart-mix-2-proposal-package',
  status:'preview-ready',
  audioTimelinePlan:{
    status:'preview-ready',duration:9.6,clips:[
      {id:'sm1',type:'music',sourceName:'C.wav',sourceTrackId:'c',start:0,sourceOffset:2,duration:3.2,volume:1,fadeIn:0,fadeOut:.05},
      {id:'sm2',type:'music',sourceName:'A.wav',sourceTrackId:'a',start:3.2,sourceOffset:8,duration:3.2,volume:1,fadeIn:.04,fadeOut:.05},
      {id:'sm3',type:'music',sourceName:'B.wav',sourceTrackId:'b',start:6.4,sourceOffset:10,duration:3.2,volume:1,fadeIn:.04,fadeOut:0}
    ]
  }
};
const whole=ui.buildWholeMixTimelinePlan(project,wholePackage);
assert.equal(whole.status,'preview-ready');
assert.equal(whole.kind,'smart-mix-whole-sequence-audible-preview-plan');
assert.equal(whole.clips.length,3);
assert.equal(whole.clips[0].sourceName,'C.wav');
assert.equal(whole.clips[1].sourceOffset,8);
assert.equal(whole.clips[2].start,6.4);
assert.equal(whole.duration,9.6);
assert.equal(whole.transitionsApplied,2);
assert.equal(whole.nonDestructive,true);
assert.equal(whole.executable,false);
assert.equal(JSON.stringify(project.audioTimeline.clips),original,'whole sequence preview must not mutate project timeline');

const missingSource=JSON.parse(JSON.stringify(wholePackage));
missingSource.audioTimelinePlan.clips[1].sourceName='Missing.wav';
const blocked=ui.buildWholeMixTimelinePlan(project,missingSource);
assert.equal(blocked.status,'review-required');
assert.equal(blocked.reason,'whole-mix-source-validation-failed');
assert.deepEqual(blocked.clips,[]);
assert.ok(blocked.risks.some(r=>r.reason==='source-track-missing'));

const invalidOffset=JSON.parse(JSON.stringify(wholePackage));
invalidOffset.audioTimelinePlan.clips[0].sourceOffset=99;
const invalid=ui.buildWholeMixTimelinePlan(project,invalidOffset);
assert.equal(invalid.status,'review-required');
assert.ok(invalid.risks.some(r=>r.reason==='source-offset-out-of-range'));

const notReady=ui.buildWholeMixTimelinePlan(project,{audioTimelinePlan:{status:'review-required',clips:wholePackage.audioTimelinePlan.clips}});
assert.equal(notReady.status,'review-required');
assert.equal(notReady.reason,'whole-mix-proposal-not-preview-ready');

const cut=ui.buildSuggestedTimelinePlan(project,plans,{0:'impact-cut'});
assert.equal(cut.status,'preview-ready');
assert.ok(cut.clips[0].fadeOut>0&&cut.clips[0].fadeOut<.05);
assert.ok(Math.abs(cut.clips[0].duration-4.1)<1e-9);
assert.equal(JSON.stringify(project.audioTimeline.clips),original,'style preview must remain non-destructive');

const missing=ui.buildSuggestedTimelinePlan(project,[]);
assert.equal(missing.status,'review-required');
assert.equal(missing.reason,'smart-mix-analysis-missing');
assert.deepEqual(missing.clips,[]);

const mismatch=ui.buildSuggestedTimelinePlan(project,[{a:{id:'missing'},b:{id:'b'},style:'beat-cut'}]);
assert.equal(mismatch.status,'review-required');
assert.equal(mismatch.reason,'smart-mix-plan-mismatch');

console.log('smart-mix-preview-ui tests passed');
