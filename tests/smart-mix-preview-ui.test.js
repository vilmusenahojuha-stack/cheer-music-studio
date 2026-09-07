const assert=require('assert');
const ui=require('../smart-mix-preview-ui.js');

const project={
  targetBpm:150,
  tracks:[
    {name:'A.wav',duration:30},
    {name:'B.wav',duration:30}
  ],
  trackAnalysis:{
    'A.wav':{bpm:150},
    'B.wav':{bpm:150}
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
