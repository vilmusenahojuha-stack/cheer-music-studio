const assert=require('assert');
const core=require('../voiceover-competition-package-core.js');

function validInput(){
  return {
    placementPlan:{kind:'cheer-voiceover-placement-plan',status:'preview-ready',riskFlags:[],slots:[
      {id:'vo-intro',sectionId:'intro',sectionType:'intro',eight:1,count:1,risks:[]},
      {id:'vo-ending',sectionId:'ending',sectionType:'ending',eight:17,count:1,risks:[]}
    ]},
    rhythmPlan:{kind:'cheer-voiceover-rhythm-plan',status:'preview-ready',bpm:150,riskFlags:[],items:[
      {slotId:'vo-intro',assignedCounts:2,requiredCounts:2,estimatedSeconds:.8,availableSeconds:.8,rhythm:{shape:'hit',attackCount:1,releaseCount:2,accentCounts:[1]},risks:[]},
      {slotId:'vo-ending',assignedCounts:4,requiredCounts:4,estimatedSeconds:1.6,availableSeconds:1.6,rhythm:{shape:'phrase',attackCount:1,releaseCount:4,accentCounts:[1,3]},risks:[]}
    ]},
    duckingPlan:{kind:'cheer-voiceover-ducking-plan',status:'preview-ready',bpm:150,riskFlags:[],reservations:[
      {slotId:'vo-intro',eight:1,duckDb:-4,attackCounts:0.5,releaseCounts:0.5,speechWindow:{startCount:1,endCount:3},duckWindow:{startCount:0.5,endCount:3.5},risks:[]},
      {slotId:'vo-ending',eight:17,duckDb:-6,attackCounts:0.5,releaseCounts:1,speechWindow:{startCount:1,endCount:5},duckWindow:{startCount:0.5,endCount:6},risks:[]}
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
assert.equal(plan.bpm,150);
assert.equal(plan.summary.selected,2);
assert.equal(plan.summary.ready,2);
assert.equal(plan.selected[0].slotId,'vo-ending');
assert.equal(plan.selected[0].role,'final-callout');
assert.equal(plan.selected[0].rhythm.shape,'phrase');
assert.equal(plan.selected[0].rhythm.assignedCounts,4);
assert.equal(plan.selected[0].rhythm.requiredCounts,4);
assert.equal(plan.selected[0].rhythm.estimatedSeconds,1.6);
assert.deepEqual(plan.selected[0].rhythm.accentCounts,[1,3]);
assert.equal(plan.selected[1].rhythm.shape,'hit');
assert.equal(plan.selected[1].rhythm.assignedCounts,2);
assert.equal(plan.selected[0].ducking.musicGainDb,-6);
assert.equal(plan.selected[0].ducking.eight,17);
assert.deepEqual(plan.selected[0].ducking.speechWindow,{startCount:1,endCount:5});
assert.deepEqual(plan.selected[0].ducking.duckWindow,{startCount:0.5,endCount:6});
assert.equal(plan.deferred[0].status,'deferred');
assert.equal(plan.nonDestructive,true);
assert.equal(plan.executable,false);
assert.equal(plan.safePreviewOnly,true);

// Backward compatibility: older hand-built rhythm and ducking plans still map into the package.
let legacy=validInput();
legacy.rhythmPlan.items=[
  {slotId:'vo-intro',countLength:2,durationSec:.8,shape:'hit',risks:[]},
  {slotId:'vo-ending',countLength:4,durationSec:1.6,shape:'phrase',risks:[]}
];
legacy.duckingPlan.items=legacy.duckingPlan.reservations;
delete legacy.duckingPlan.reservations;
plan=core.buildVoiceoverCompetitionPackage(legacy);
assert.equal(plan.status,'preview-ready');
assert.equal(plan.selected.find(x=>x.slotId==='vo-intro').ducking.musicGainDb,-4);
assert.equal(plan.selected.find(x=>x.slotId==='vo-intro').rhythm.assignedCounts,2);
assert.equal(plan.selected.find(x=>x.slotId==='vo-intro').rhythm.shape,'hit');

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
input.duckingPlan.reservations=input.duckingPlan.reservations.filter(x=>x.slotId!=='vo-intro');
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
