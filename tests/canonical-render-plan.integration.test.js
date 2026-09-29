const assert=require('assert');
const core=require('../smart-mix-proposal-package-core.js');

const bpm=150;
const countSeconds=60/bpm;
const timeline=core.buildAudioTimelinePlan([
  {order:1,sectionId:'intro',sectionType:'intro',sourceName:'song-a.wav',trackId:'a',sourceStart:4,sourceEnd:10.4,startEight:1,endEight:2,matchScore:.9,transition:null},
  {order:2,sectionId:'stunt',sectionType:'stunt',sourceName:'song-b.wav',trackId:'b',sourceStart:12,sourceEnd:18.4,startEight:3,endEight:4,matchScore:.92,transition:{qualityRating:'strong',qualityComponents:{structure:.9,cut:.85}}}
],bpm);

const input={
  bpm,
  skillHits:[{id:'hit-1',sectionId:'stunt',sectionType:'stunt',at:8*countSeconds,eight:2,count:1,duration:.2,metadata:{importance:'high',hitType:'impact'}}],
  cheerFxAnchors:[{id:'fx-1',sectionId:'stunt',sectionType:'stunt',at:16*countSeconds,duration:.15,metadata:{fxType:'impact'}}],
  voiceoverClips:[{id:'vo-1',sectionId:'intro',sectionType:'intro',sourceName:'voice.wav',start:2*countSeconds,duration:2*countSeconds,sourceOffset:0,volume:.9,processing:{preset:'competition'}}],
  duckingRegions:[{id:'duck-1',sectionId:'intro',sectionType:'intro',start:1.5*countSeconds,duration:3*countSeconds,gain:.45,metadata:{attack:.08,release:.18}}],
  automation:[{id:'auto-1',sectionId:'stunt',sectionType:'stunt',at:16*countSeconds,duration:countSeconds,metadata:{parameter:'musicGain'}}]
};
const original=JSON.stringify({timeline,input});
const plan=core.buildCanonicalRenderPlan(timeline,input);

assert.equal(plan.kind,'cheer-canonical-render-plan');
assert.equal(plan.status,'preview-ready');
assert.equal(plan.bpm,bpm);
assert.equal(plan.nonDestructive,true);
assert.equal(plan.timingBasis,'eight-count/count/subdivision/seconds');
assert.equal(plan.lanes.music.length,2);
assert.equal(plan.lanes.transitions.length,1);
assert.equal(plan.lanes.skillHits.length,1);
assert.equal(plan.lanes.cheerFx.length,1);
assert.equal(plan.lanes.voiceover.length,1);
assert.equal(plan.lanes.ducking.length,1);
assert.equal(plan.lanes.automation.length,1);

// Music must remain exactly aligned with the existing audioTimelinePlan.
for(let i=0;i<timeline.clips.length;i++){
  const source=timeline.clips[i],event=plan.lanes.music[i];
  assert.equal(event.sourceName,source.sourceName);
  assert.equal(event.sourceOffset,source.sourceOffset);
  assert.equal(event.at,source.start);
  assert.equal(event.duration,source.duration);
  assert.equal(event.fadeIn,source.fadeIn);
  assert.equal(event.fadeOut,source.fadeOut);
  assert.equal(event.sourceEightStart,source.smartMix.sourceStartEight);
  assert.equal(event.sourceEightEnd,source.smartMix.sourceEndEight);
}

// Transition boundary must land on the incoming section's exact count-safe start.
const transition=plan.lanes.transitions[0];
assert.equal(transition.at,timeline.clips[1].start);
assert.equal(transition.eight,3);
assert.equal(transition.count,1);
assert.equal(transition.subdivision,0);
assert.equal(transition.toSectionId,'stunt');

// VO, FX, hit and ducking all share the same count/eight -> seconds coordinate system.
const vo=plan.lanes.voiceover[0];
assert.equal(vo.eight,1); assert.equal(vo.count,3); assert.equal(vo.at,2*countSeconds);
const hit=plan.lanes.skillHits[0];
assert.equal(hit.eight,2); assert.equal(hit.count,1); assert.equal(hit.at,8*countSeconds);
const fx=plan.lanes.cheerFx[0];
assert.equal(fx.eight,3); assert.equal(fx.count,1); assert.equal(fx.at,16*countSeconds);
const duck=plan.lanes.ducking[0];
assert.equal(duck.eight,1); assert.equal(duck.count,2); assert.equal(duck.subdivision,.5);

// Building the canonical plan must not mutate any existing proposal/timeline data.
assert.equal(JSON.stringify({timeline,input}),original);

console.log('canonical render plan integration: music + transitions + hits + FX + VO + ducking share one timeline');
