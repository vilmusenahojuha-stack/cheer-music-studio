'use strict';
const assert=require('assert');
const core=require('../competition-master-clarity-windows-core.js');

const project={
  duration:30,
  audioTimeline:{
    clips:[
      {id:'music-1',type:'music',start:0,duration:30},
      {id:'voice-1',type:'voice',voiceoverSlotId:'slot-intro',start:2,duration:1.2},
      {id:'voice-2',type:'voice',start:10,duration:.6},
      {id:'bad-voice',type:'voice',start:-1,duration:1}
    ],
    cheerFxAnchors:[{id:'anchor-1',kind:'impact',at:5},{id:'anchor-2',kind:'impact',at:20}]
  }
};

const fxCore={
  buildRenderEvents(anchors,duration){
    assert.strictEqual(anchors,project.audioTimeline.cheerFxAnchors);
    assert.strictEqual(duration,30);
    return [
      {kind:'impact',id:'render-1',at:5,low:{duration:.18},transient:{duration:.06}},
      {kind:'impact',anchorId:'anchor-2',at:20,low:{duration:.04},transient:{duration:.11}},
      {kind:'riser',id:'riser-ignored',at:15,duration:1}
    ];
  }
};

assert.strictEqual(core.projectDuration(project),30);
const voices=core.voiceoverWindows(project);
assert.deepStrictEqual(voices,[
  {id:'slot-intro',start:2,end:3.2,source:'timeline-voice'},
  {id:'voice-2',start:10,end:10.6,source:'timeline-voice'}
]);
const fx=core.fxWindows(project,fxCore);
assert.deepStrictEqual(fx,[
  {id:'render-1',start:5,end:5.18,source:'rendered-cheer-fx'},
  {id:'anchor-2',start:20,end:20.11,source:'rendered-cheer-fx'}
]);
const result=core.buildCompetitionClarityWindows(project,fxCore);
assert.strictEqual(result.kind,'cheer-competition-master-clarity-windows');
assert.strictEqual(result.stage,'post-voiceover-mix');
assert.strictEqual(result.nonDestructive,true);
assert.deepStrictEqual(result.counts,{voiceover:2,fx:2});
assert.deepStrictEqual(result.voiceoverWindows,voices);
assert.deepStrictEqual(result.fxWindows,fx);

const fallbackProject={audioTimeline:{clips:[{type:'voice',start:3,duration:2}],cheerFxAnchors:[]}};
assert.strictEqual(core.projectDuration(fallbackProject),5);
assert.deepStrictEqual(core.fxWindows(fallbackProject,null),[],'missing FX renderer must remain safe');

console.log('competition-master-clarity-windows-core tests passed');
