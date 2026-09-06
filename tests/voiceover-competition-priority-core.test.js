const assert=require('assert');
const core=require('../voiceover-competition-priority-core.js');
function placement(status='preview-ready'){
  return {kind:'cheer-voiceover-placement-plan',status,riskFlags:[],slots:[
    {id:'vo-intro-1',sectionId:'intro',sectionType:'intro',eight:1,count:1,priority:90,risks:[],requiresReview:false},
    {id:'vo-intro-5',sectionId:'intro',sectionType:'intro',eight:1,count:5,priority:90,risks:[],requiresReview:false},
    {id:'vo-stunt',sectionId:'stunt',sectionType:'stunt',eight:5,count:1,priority:70,risks:[],requiresReview:false},
    {id:'vo-tumbling',sectionId:'tumbling',sectionType:'tumbling',eight:9,count:1,priority:55,risks:[],requiresReview:false},
    {id:'vo-dance',sectionId:'dance',sectionType:'dance',eight:13,count:1,priority:80,risks:[],requiresReview:false},
    {id:'vo-ending',sectionId:'ending',sectionType:'ending',eight:17,count:1,priority:95,risks:[],requiresReview:false}
  ]};
}
let plan=core.buildVoiceoverCompetitionPriorityPlan({placementPlan:placement()});
assert.equal(plan.status,'preview-ready');
assert(plan.selections.some(x=>x.sectionType==='ending'));
assert.equal(plan.selections.filter(x=>x.sectionType==='intro').length,1);
assert(plan.deferred.some(x=>x.slotId==='vo-intro-5'&&x.reason==='section-voiceover-limit'));
assert(plan.deferred.some(x=>x.slotId==='vo-tumbling'&&x.reason==='low-competition-priority'));

plan=core.buildVoiceoverCompetitionPriorityPlan({placementPlan:placement()},{maxVoiceovers:2});
assert.equal(plan.selections.length,2);
assert(plan.selections.some(x=>x.sectionType==='ending'));
assert(plan.riskFlags.includes('voiceover-density-reduced'));

const conflict={kind:'cheer-voiceover-fx-conflict-plan',status:'review-required',conflicts:[{slotId:'vo-ending',resolution:{action:'move-fx-preview'}}]};
plan=core.buildVoiceoverCompetitionPriorityPlan({placementPlan:placement(),conflictPlan:conflict});
assert.equal(plan.status,'review-required');
assert(!plan.selections.some(x=>x.slotId==='vo-ending'));
assert(plan.deferred.some(x=>x.slotId==='vo-ending'&&x.reason==='strong-fx-conflict'));
assert(plan.riskFlags.includes('ending-voiceover-not-selected'));

plan=core.buildVoiceoverCompetitionPriorityPlan({placementPlan:{...placement(),status:'review-required',riskFlags:['upstream-review']}});
assert.equal(plan.status,'review-required');
assert(plan.riskFlags.includes('upstream-review'));

plan=core.buildVoiceoverCompetitionPriorityPlan({});
assert.equal(plan.status,'blocked');
assert.equal(plan.reason,'voiceover-placement-plan-required');
plan=core.buildVoiceoverCompetitionPriorityPlan({placementPlan:{kind:'cheer-voiceover-placement-plan',status:'blocked',slots:[]}});
assert.equal(plan.reason,'voiceover-placement-plan-blocked');

console.log('voiceover-competition-priority-core tests passed');
