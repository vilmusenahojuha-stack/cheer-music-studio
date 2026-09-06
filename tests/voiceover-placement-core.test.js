'use strict';
const assert=require('assert');
const core=require('../voiceover-placement-core.js');

function smart(sequence,status='preview-ready',risks=[]){return {kind:'smart-mix-2-proposal-package',status,bpm:152,risks,sequence};}
function step(type,start,end){return {sectionId:type,sectionType:type,startEight:start,endEight:end};}
function fx(status='preview-ready',recommendations=[]){return {kind:'cheer-fx-competition-package',status,recommendations};}

{
 const result=core.buildVoiceoverPlacementPlan({smartMixPackage:smart([step('intro',0,3),step('stunt',4,7),step('dance',8,11),step('ending',12,15)]),fxPackage:fx()});
 assert.equal(result.status,'preview-ready');
 assert.equal(result.executable,false);
 assert.equal(result.safePreviewOnly,true);
 assert.equal(result.summary.sections,4);
 assert.equal(result.summary.slots,6);
 assert.equal(result.preview.topSlot.sectionType,'ending');
 assert(result.slots.some(s=>s.sectionType==='intro'&&s.count===5));
 assert(result.slots.some(s=>s.sectionType==='dance'&&s.count===5));
}
{
 const result=core.buildVoiceoverPlacementPlan({smartMixPackage:smart([step('stunt',0,3)]),fxPackage:fx('review-required',[{section:'stunt',directive:'reduce-section-fx',requiresReview:true}])});
 assert.equal(result.status,'review-required');
 assert.equal(result.summary.reviewSlots,1);
 assert(result.riskFlags.includes('voiceover-fx-package-review-required'));
 assert(result.riskFlags.includes('voiceover-heavy-fx-section'));
}
{
 const result=core.buildVoiceoverPlacementPlan({smartMixPackage:smart([step('ending',0,3)]),fxPackage:fx('blocked')});
 assert.equal(result.status,'review-required');
 assert.equal(result.reason,'fx-package-blocked-review-placement');
 assert(result.riskFlags.includes('voiceover-fx-package-blocked'));
}
{
 const result=core.buildVoiceoverPlacementPlan({smartMixPackage:smart([{sectionId:'intro',sectionType:'intro',startEight:null,endEight:null}])});
 assert.equal(result.status,'review-required');
 assert(result.riskFlags.includes('voiceover-eight-range-missing'));
}
{
 const missing=core.buildVoiceoverPlacementPlan(null);
 assert.equal(missing.status,'blocked');
 assert.equal(missing.reason,'smart-mix-package-required');
}
{
 const inherited=core.buildVoiceoverPlacementPlan({smartMixPackage:smart([step('intro',0,1)],'blocked')});
 assert.equal(inherited.status,'blocked');
 assert.equal(inherited.reason,'smart-mix-package-blocked');
}
console.log('voiceover-placement-core tests passed');
