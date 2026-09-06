const assert=require('assert');
const core=require('../voiceover-fx-conflict-core.js');

function duck(status='preview-ready'){
  return {kind:'cheer-voiceover-ducking-plan',status,riskFlags:[],reservations:[{slotId:'ending-1',sectionId:'ending',sectionType:'ending',eight:12,speechWindow:{startCount:1,endCount:4},fxAvoidWindow:{startCount:0.5,endCount:5}}]};
}
let plan=core.buildVoiceoverFxConflictPlan({duckingPlan:duck(),fxEvents:[{eight:12,type:'impact',count:1,intensity:'strong'}]});
assert.equal(plan.status,'review-required');
assert.equal(plan.conflicts.length,1);
assert.equal(plan.conflicts[0].resolution.action,'move-fx-preview');
assert(plan.riskFlags.includes('voiceover-fx-overlap'));

plan=core.buildVoiceoverFxConflictPlan({duckingPlan:duck(),fxEvents:[{eight:12,type:'hit',count:3,intensity:'light'}]});
assert.equal(plan.conflicts[0].resolution.action,'reduce-fx-preview');
assert.equal(plan.conflicts[0].resolution.amountDb,-3);

plan=core.buildVoiceoverFxConflictPlan({duckingPlan:duck(),fxEvents:[{eight:12,type:'riser',count:4,intensity:'medium'}]});
assert.equal(plan.conflicts[0].resolution.action,'trim-or-move-fx-preview');

plan=core.buildVoiceoverFxConflictPlan({duckingPlan:duck(),fxEvents:[{eight:13,type:'impact',count:1,intensity:'hero'}]});
assert.equal(plan.conflicts.length,0);
assert.equal(plan.status,'preview-ready');

plan=core.buildVoiceoverFxConflictPlan({duckingPlan:duck('review-required'),fxEvents:[{eight:13,type:'impact',count:1}]});
assert.equal(plan.status,'review-required');

plan=core.buildVoiceoverFxConflictPlan({});
assert.equal(plan.status,'blocked');
assert.equal(plan.reason,'voiceover-ducking-plan-required');

plan=core.buildVoiceoverFxConflictPlan({duckingPlan:duck(),fxEvents:[]});
assert.equal(plan.status,'blocked');
assert.equal(plan.reason,'fx-events-required');

console.log('voiceover-fx-conflict-core tests passed');
