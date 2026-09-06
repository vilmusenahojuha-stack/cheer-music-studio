const assert=require('assert');
const core=require('../smart-mix-proposal-package-core.js');

const baseSequence={
  sequence:[
    {sectionId:'intro',sectionType:'intro',candidate:{startEight:1,endEight:2,score:.82}},
    {sectionId:'stunt',sectionType:'stunt',candidate:{startEight:3,endEight:4,score:.88},transition:{qualityScore:.8,qualityRating:'strong'}},
    {sectionId:'dance',sectionType:'dance',candidate:{startEight:5,endEight:6,score:.85},transition:{qualityScore:.78,qualityRating:'strong'}}
  ],
  coverage:1,
  matchScore:.85,
  nonDestructive:true
};

const review={
  globalScore:.84,
  quality:'strong',
  matchScore:.85,
  transitionAverage:.79,
  weakestScore:.78,
  coverage:1,
  transitions:[{fromSectionId:'intro',toSectionId:'stunt',score:.8},{fromSectionId:'stunt',toSectionId:'dance',score:.78}],
  weakestTransition:{fromSectionId:'stunt',toSectionId:'dance',score:.78,reasons:[]},
  recommendation:{action:'review-transition'},
  riskFlags:[],
  readyForPreview:true,
  nonDestructive:true
};

const reviewCore={reviewSequence(){return review;}};
const iterativeCore={improveIteratively(){return {
  improved:true,converged:true,iterations:1,totalImprovement:.05,reason:'no-quality-improving-single-swap',
  optimized:baseSequence,finalReview:review,history:[{iteration:1,changedSectionId:'stunt'}],nonDestructive:true
};}};
const actionsCore={createEditPlan(){return {
  bpm:152,actions:[{id:'edit-drop-1',type:'drop',eight:3}],conflicts:[],
  summary:{actions:1,conflicts:0,readyForPreview:true},safePreviewOnly:true,executable:false
};}};

const packaged=core.createProposalPackage({
  matchPlan:{sections:[{id:'intro'},{id:'stunt'},{id:'dance'}]},
  optimized:baseSequence,
  smartMixProposal:{bpm:152,decisions:[{type:'drop',eight:3,at:6.3,confidence:.9}]}
},{iterativeCore,reviewCore,actionsCore});

assert.equal(packaged.kind,'smart-mix-2-proposal-package');
assert.equal(packaged.status,'preview-ready');
assert.equal(packaged.nonDestructive,true);
assert.equal(packaged.executable,false);
assert.equal(packaged.safePreviewOnly,true);
assert.equal(packaged.bpm,152);
assert.equal(packaged.sequence.length,3);
assert.equal(packaged.sequence[1].sectionId,'stunt');
assert.equal(packaged.summary.sections,3);
assert.equal(packaged.summary.transitions,2);
assert.equal(packaged.summary.editActions,1);
assert.equal(packaged.summary.readyForPreview,true);
assert.equal(packaged.optimization.improved,true);
assert.equal(packaged.optimization.iterations,1);
assert.equal(packaged.quality.globalScore,.84);
assert.equal(packaged.weakestTransition.toSectionId,'dance');

const conflictActions={createEditPlan(){return {
  actions:[{id:'a'},{id:'b'}],conflicts:[{type:'opposing-energy-actions'}],
  summary:{actions:2,conflicts:1,readyForPreview:false},safePreviewOnly:true,executable:false
};}};
const blocked=core.createProposalPackage({optimized:baseSequence,smartMixProposal:{bpm:152,decisions:[]}},{reoptimize:false,reviewCore,actionsCore:conflictActions});
assert.equal(blocked.status,'blocked');
assert(blocked.risks.includes('edit-action-conflict'));
assert.equal(blocked.summary.readyForPreview,false);

const riskyReviewCore={reviewSequence(){return {...review,riskFlags:['weak-segment-fit'],readyForPreview:false,globalScore:.59,quality:'weak'};}};
const reviewRequired=core.createProposalPackage({optimized:baseSequence},{reoptimize:false,reviewCore:riskyReviewCore,actionsCore:{}});
assert.equal(reviewRequired.status,'review-required');
assert(reviewRequired.risks.includes('weak-segment-fit'));
assert.equal(reviewRequired.summary.editActions,0);

const badProposalActions={createEditPlan(){throw new Error('Smart Mix proposal BPM is required.');}};
const badProposal=core.createProposalPackage({optimized:baseSequence,smartMixProposal:{decisions:[]}},{reoptimize:false,reviewCore,actionsCore:badProposalActions});
assert.equal(badProposal.status,'review-required');
assert.equal(badProposal.editPlan.summary.readyForPreview,false);
assert(badProposal.risks.includes('edit-plan-not-preview-ready'));
assert.equal(badProposal.executable,false);

const missingReview=core.createProposalPackage({optimized:baseSequence},{reviewCore:{},actionsCore:{},iterativeCore:{}});
assert.equal(missingReview.status,'blocked');
assert.equal(missingReview.reason,'review-core-unavailable');
assert.equal(missingReview.nonDestructive,true);

console.log('smart-mix-proposal-package-core tests passed');
