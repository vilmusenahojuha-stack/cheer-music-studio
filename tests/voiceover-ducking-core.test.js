'use strict';
const assert=require('assert');
const core=require('../voiceover-ducking-core.js');
function rhythm(status='preview-ready',items=[{slotId:'vo-ending-1-1',sectionId:'ending',sectionType:'ending',eight:12,startCount:1,text:'Go Blue!',assignedCounts:2,requiresReview:false}],risks=[]){return {kind:'cheer-voiceover-rhythm-plan',status,bpm:152,items,riskFlags:risks};}
{
 const result=core.buildVoiceoverDuckingPlan({rhythmPlan:rhythm()});
 assert.equal(result.status,'preview-ready'); assert.equal(result.reservations[0].duckDb,-7); assert.equal(result.reservations[0].speechWindow.durationCounts,2); assert.equal(result.executable,false);
}
{
 const item={slotId:'vo-dance-1-5',sectionId:'dance',sectionType:'dance',eight:8,startCount:5,text:'Everybody up',assignedCounts:3,requiresReview:false};
 const result=core.buildVoiceoverDuckingPlan({rhythmPlan:rhythm('preview-ready',[item])});
 assert.equal(result.reservations[0].duckDb,-5); assert.equal(result.reservations[0].duckWindow.startCount,4.5); assert.equal(result.reservations[0].fxAvoidWindow.startCount,4.5);
}
{
 const item={slotId:'vo-stunt-1-1',sectionId:'stunt',sectionType:'stunt',eight:4,startCount:1,text:'Hit now',assignedCounts:4,requiresReview:true};
 const result=core.buildVoiceoverDuckingPlan({rhythmPlan:rhythm('review-required',[item],['voiceover-placement-review-required'])});
 assert.equal(result.status,'review-required'); assert(result.riskFlags.includes('voiceover-source-review-required')); assert(result.riskFlags.includes('voiceover-placement-review-required'));
}
{
 const item={slotId:'vo-ending-1-7',sectionId:'ending',sectionType:'ending',eight:16,startCount:7,text:'Finish',assignedCounts:2,requiresReview:false};
 const result=core.buildVoiceoverDuckingPlan({rhythmPlan:rhythm('preview-ready',[item])});
 assert.equal(result.status,'review-required'); assert(result.riskFlags.includes('voiceover-reservation-crosses-eight-boundary'));
}
{
 const result=core.buildVoiceoverDuckingPlan({rhythmPlan:{kind:'cheer-voiceover-rhythm-plan',status:'preview-ready',bpm:152,items:[]}});
 assert.equal(result.status,'blocked'); assert.equal(result.reason,'voiceover-rhythm-items-required');
}
{
 const result=core.buildVoiceoverDuckingPlan(null); assert.equal(result.status,'blocked'); assert.equal(result.reason,'voiceover-rhythm-plan-required');
}
console.log('voiceover-ducking-core tests passed');
