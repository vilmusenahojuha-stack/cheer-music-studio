const assert=require('assert');
const core=require('../voiceover-competition-package-core.js');

function validInput(){
  return {
    placementPlan:{kind:'cheer-voiceover-placement-plan',status:'preview-ready',riskFlags:[],slots:[
      {id:'vo-intro',sectionId:'intro',sectionType:'intro',eight:1,count:1,risks:[]},
      {id:'vo-ending',sectionId:'ending',sectionType:'ending',eight:17,count:1,risks:[]}
    ]},
    rhythmPlan:{kind:'cheer-voiceover-rhythm-plan',status:'preview-ready',riskFlags:[],items:[
      {slotId:'vo-intro',countLength:2,durationSec:0.8,risks:[]},
      {slotId:'vo-ending',countLength:4,durationSec:1.6,risks:[]}
    ]},
    duckingPlan:{kind:'cheer-voiceover-ducking-plan',status:'preview-ready',riskFlags:[],items:[
      {slotId:'vo-intro',musicGainDb:-4,attackCounts:0.5,releaseCounts:0.5,risks:[]},
      {slotId:'vo-ending',musicGainDb:-6,attackCounts:0.5,releaseCounts:1,risks:[]}
    ]},
    conflictPlan:{kind:'cheer-voiceover-fx-conflict-plan',status:'preview-ready',riskFlags:[],conflicts:[]},
    priorityPlan:{kind:'cheer-voiceover-competition-priority-plan',status:'preview-ready',riskFlags:[],selections:[
      {slotId:'vo-ending',sectionId:'ending',sectionType:'ending',role:'final-callout',score:127,requiresReview:false},
      {slotId:'vo-intro',sectionId:'intro',sectionType:'intro',role:'identity-callout',score:110,requiresReview:false}
    ],deferred:[{slotId:'vo-tumbling',reason:'low-competition-priority'}]}
  };
}

let plan=core.buildVoiceoverCompetitionPackage(validInput());
assert.equal(plan.status,'preview-ready');
assert.equal(plan.summary.selected,2);
assert.equal(plan.summary.ready,2);
assert.equal(plan.selected[0].slotId,'vo-ending');
assert.equal(plan.selected[0].role,'final-callout');
assert.equal(plan.selected[0].ducking.musicGainDb,-6);
assert.equal(plan.deferred[0].status,'deferred');
assert.equal(plan.nonDestructive,true);
assert.equal(plan.executable,false);
assert.equal(plan.safePreviewOnly,true);

let input=validInput();
input.conflictPlan={kind:'cheer-voiceover-fx-conflict-plan',status:'review-required',riskFlags:['fx-review'],conflicts:[
  {slotId:'vo-ending',fxId:'fx-hero',resolution:{action:'move-fx-preview'}}
]};
plan=core.buildVoiceoverCompetitionPackage(input);
assert.equal(plan.status,'review-required');
assert.equal(plan.selected.find(x=>x.slotId==='vo-ending').status,'review-required');
assert(plan.selected.find(x=>x.slotId==='vo-ending').risks.includes('voiceover-fx-conflict'));
assert(plan.riskFlags.includes('fx-review'));

input=validInput();
input.duckingPlan.items=input.duckingPlan.items.filter(x=>x.slotId!=='vo-intro');
plan=core.buildVoiceoverCompetitionPackage(input);
const incomplete=plan.selected.find(x=>x.slotId==='vo-intro');
assert.equal(incomplete.status,'review-required');
assert(incomplete.missing.includes('ducking'));
assert(plan.riskFlags.includes('voiceover-package-incomplete'));

input=validInput();
input.priorityPlan.status='review-required';
input.priorityPlan.riskFlags=['priority-review'];
plan=core.buildVoiceoverCompetitionPackage(input);
assert.equal(plan.status,'review-required');
assert(plan.riskFlags.includes('priority-review'));

plan=core.buildVoiceoverCompetitionPackage({});
assert.equal(plan.status,'blocked');
assert.equal(plan.reason,'placement-plan-required');

input=validInput();
input.rhythmPlan.status='blocked';
plan=core.buildVoiceoverCompetitionPackage(input);
assert.equal(plan.status,'blocked');
assert.equal(plan.reason,'rhythm-plan-blocked');

input=validInput();
input.priorityPlan.selections=[];
plan=core.buildVoiceoverCompetitionPackage(input);
assert.equal(plan.status,'blocked');
assert.equal(plan.reason,'priority-selections-required');

console.log('voiceover-competition-package-core tests passed');
