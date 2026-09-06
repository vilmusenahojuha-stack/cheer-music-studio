'use strict';
const assert=require('assert');
const core=require('../voiceover-rhythm-core.js');
function placement(status='preview-ready',slots=[{id:'vo-ending-1-1',sectionId:'ending',sectionType:'ending',eight:12,count:1,maxDurationCounts:4,requiresReview:false}],risks=[]){return {kind:'cheer-voiceover-placement-plan',status,bpm:152,slots,riskFlags:risks};}
{
 const result=core.buildVoiceoverRhythmPlan({placementPlan:placement(),entries:[{slotId:'vo-ending-1-1',text:'Go Blue!'}]});
 assert.equal(result.status,'preview-ready'); assert.equal(result.items[0].assignedCounts,2); assert.equal(result.items[0].rhythm.shape,'hit'); assert.equal(result.executable,false);
}
{
 const slot={id:'vo-dance-1-5',sectionId:'dance',sectionType:'dance',eight:8,count:5,maxDurationCounts:3,requiresReview:false};
 const result=core.buildVoiceoverRhythmPlan({placementPlan:placement('preview-ready',[slot]),entries:[{slotId:slot.id,text:'Everybody get up and show them who we are'}]});
 assert.equal(result.status,'review-required'); assert(result.items[0].requiredCounts>3); assert.equal(result.items[0].assignedCounts,3); assert.equal(result.items[0].recommendation,'shorten-text'); assert(result.riskFlags.includes('voiceover-text-too-long'));
}
{
 const result=core.buildVoiceoverRhythmPlan({placementPlan:placement(),entries:[]});
 assert.equal(result.status,'review-required'); assert(result.riskFlags.includes('voiceover-text-required'));
}
{
 const slot={id:'vo-stunt-1-1',sectionId:'stunt',sectionType:'stunt',eight:4,count:1,maxDurationCounts:4,requiresReview:true};
 const result=core.buildVoiceoverRhythmPlan({placementPlan:placement('review-required',[slot]),entries:[{slotId:slot.id,text:'Hit it now'}]});
 assert.equal(result.status,'review-required'); assert(result.riskFlags.includes('voiceover-placement-review-required'));
}
{
 const result=core.buildVoiceoverRhythmPlan({placementPlan:{kind:'cheer-voiceover-placement-plan',status:'preview-ready',bpm:null,slots:[{id:'x'}]}});
 assert.equal(result.status,'blocked'); assert.equal(result.reason,'voiceover-bpm-required');
}
{
 const result=core.buildVoiceoverRhythmPlan(null); assert.equal(result.status,'blocked'); assert.equal(result.reason,'voiceover-placement-plan-required');
}
console.log('voiceover-rhythm-core tests passed');
