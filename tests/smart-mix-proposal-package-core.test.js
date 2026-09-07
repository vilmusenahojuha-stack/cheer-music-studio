const assert=require('assert');
const core=require('../smart-mix-proposal-package-core.js');

const baseSequence={
  sequence:[
    {sectionId:'intro',sectionType:'intro',candidate:{sourceName:'song-a.wav',trackId:'track-a',start:.5,end:6.82,startEight:1,endEight:2,score:.82}},
    {sectionId:'stunt',sectionType:'stunt',candidate:{sourceName:'song-b.wav',trackId:'track-b',start:12.4,end:18.72,startEight:3,endEight:4,score:.88},transition:{qualityScore:.8,qualityRating:'strong'}},
    {sectionId:'dance',sectionType:'dance',candidate:{sourceName:'song-a.wav',trackId:'track-a',start:25,end:31.32,startEight:5,endEight:6,score:.85},transition:{qualityScore:.78,qualityRating:'strong'}}
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
  transitions:[
    {index:1,fromSectionId:'intro',toSectionId:'stunt',score:.8,rating:'strong',reasons:[],components:{timing:.9,energy:.84,structure:.82,cut:.76}},
    {index:2,fromSectionId:'stunt',toSectionId:'dance',score:.78,rating:'good',reasons:[],components:{timing:.9,energy:.8,structure:.62,cut:.7}}
  ],
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
assert.equal(packaged.sequence[1].sourceName,'song-b.wav');
assert.equal(packaged.sequence[1].trackId,'track-b');
assert.equal(packaged.sequence[1].transition.qualityRating,'strong');
assert.equal(packaged.sequence[1].transition.qualityComponents.structure,.82);
assert.equal(packaged.sequence[2].transition.qualityRating,'good');
assert.equal(packaged.summary.sections,3);
assert.equal(packaged.summary.transitions,2);
assert.equal(packaged.summary.renderedTransitions,2);
assert.equal(packaged.summary.transitionTypes['impact-cut'],1);
assert.equal(packaged.summary.transitionTypes['flow-blend'],1);
assert.equal(packaged.summary.editActions,1);
assert.equal(packaged.summary.timelineClips,3);
assert.equal(packaged.summary.readyForPreview,true);
assert.equal(packaged.optimization.improved,true);
assert.equal(packaged.optimization.iterations,1);
assert.equal(packaged.quality.globalScore,.84);
assert.equal(packaged.weakestTransition.toSectionId,'dance');

const eightSeconds=480/152;
assert.equal(packaged.audioTimelinePlan.status,'preview-ready');
assert.equal(packaged.audioTimelinePlan.compatibleWith,'audioTimeline.clips');
assert.equal(packaged.audioTimelinePlan.nonDestructive,true);
assert.equal(packaged.audioTimelinePlan.executable,false);
assert.equal(packaged.audioTimelinePlan.clips.length,3);
assert.equal(packaged.audioTimelinePlan.sourceName,undefined);
assert.equal(packaged.audioTimelinePlan.clips[0].sourceName,'song-a.wav');
assert.equal(packaged.audioTimelinePlan.clips[0].sourceTrackId,'track-a');
assert.equal(packaged.audioTimelinePlan.clips[0].sourceOffset,.5);
assert.ok(Math.abs(packaged.audioTimelinePlan.clips[0].duration-eightSeconds*2)<1e-9);
assert.ok(Math.abs(packaged.audioTimelinePlan.clips[1].start-eightSeconds*2)<1e-9);
assert.ok(Math.abs(packaged.audioTimelinePlan.clips[2].start-eightSeconds*4)<1e-9);
assert.ok(Math.abs(packaged.audioTimelinePlan.duration-eightSeconds*6)<1e-9);
assert.equal(packaged.audioTimelinePlan.clips[1].smartMix.sectionId,'stunt');

// Transition quality review now drives an explicit audio decision while keeping exact cheer timing.
assert.equal(packaged.audioTimelinePlan.transitions.length,2);
const impactBoundary=packaged.audioTimelinePlan.transitions[0];
const flowBoundary=packaged.audioTimelinePlan.transitions[1];
assert.equal(impactBoundary.type,'impact-cut');
assert.equal(impactBoundary.renderMode,'count-safe-microfade');
assert.equal(impactBoundary.decisionReason,'high-impact-entry');
assert.equal(impactBoundary.fromSectionId,'intro');
assert.equal(impactBoundary.toSectionId,'stunt');
assert.equal(impactBoundary.fadeSeconds,.008);
assert.equal(impactBoundary.qualityRating,'strong');
assert.equal(impactBoundary.qualityComponents.structure,.82);
assert.equal(flowBoundary.type,'flow-blend');
assert.equal(flowBoundary.decisionReason,'flow-continuity');
assert.equal(flowBoundary.fadeSeconds,.020);
assert.equal(flowBoundary.qualityRating,'good');
assert.equal(packaged.audioTimelinePlan.clips[0].fadeOut,.008);
assert.equal(packaged.audioTimelinePlan.clips[1].fadeIn,.008);
assert.equal(packaged.audioTimelinePlan.clips[1].fadeOut,.020);
assert.equal(packaged.audioTimelinePlan.clips[2].fadeIn,.020);
assert.equal(packaged.audioTimelinePlan.clips[1].smartMix.transitionIn.preservesTimelineStart,true);
assert.equal(packaged.audioTimelinePlan.clips[2].smartMix.transitionIn.preservesSourceOffset,true);

// Weak/risky boundaries are deliberately guarded instead of pretending to be a musical impact/flow transition.
const guarded=core.transitionDecision({sectionType:'stunt',transition:{qualityRating:'weak',qualityReasons:['weak-cut-point'],qualityComponents:{structure:.8,cut:.3}}});
assert.equal(guarded.type,'guarded-cut');
assert.equal(guarded.reason,'quality-protection');
assert.equal(core.transitionFadeSeconds({sectionType:'stunt',transition:{qualityRating:'weak',qualityReasons:['weak-cut-point']}},152),Math.min(.032,(60/152)*.10));

// Fade policy never consumes a meaningful fraction of a cheer count.
assert.ok(core.transitionFadeSeconds({sectionType:'dance',transition:{qualityRating:'risky'}},152)<=((60/152)*.10)+1e-12);
assert.ok(core.transitionFadeSeconds({sectionType:'ending',transition:{qualityRating:'strong',qualityComponents:{structure:.8}}},152)<core.transitionFadeSeconds({sectionType:'dance',transition:{qualityRating:'strong',qualityComponents:{energy:.8}}},152));

const directPlan=core.buildAudioTimelinePlan(core.normalizeSequence(baseSequence.sequence),152,{startAt:3});
assert.equal(directPlan.clips.length,3);
assert.equal(directPlan.clips[0].start,3);
assert.ok(Math.abs(directPlan.duration-eightSeconds*6)<1e-9);
assert.equal(directPlan.clips[1].start,3+eightSeconds*2);
assert.equal(directPlan.clips[1].sourceOffset,12.4);
assert.equal(directPlan.transitions.length,2);

const conflictActions={createEditPlan(){return {
  actions:[{id:'a'},{id:'b'}],conflicts:[{type:'opposing-energy-actions'}],
  summary:{actions:2,conflicts:1,readyForPreview:false},safePreviewOnly:true,executable:false
};}};
const blocked=core.createProposalPackage({optimized:baseSequence,smartMixProposal:{bpm:152,decisions:[]}},{reoptimize:false,reviewCore,actionsCore:conflictActions});
assert.equal(blocked.status,'blocked');
assert(blocked.risks.includes('edit-action-conflict'));
assert.equal(blocked.summary.readyForPreview,false);

const riskyReviewCore={reviewSequence(){return {...review,riskFlags:['weak-segment-fit'],readyForPreview:false,globalScore:.59,quality:'weak'};}};
const reviewRequired=core.createProposalPackage({optimized:baseSequence,bpm:152},{reoptimize:false,reviewCore:riskyReviewCore,actionsCore:{}});
assert.equal(reviewRequired.status,'review-required');
assert(reviewRequired.risks.includes('weak-segment-fit'));
assert.equal(reviewRequired.summary.editActions,0);

const badProposalActions={createEditPlan(){throw new Error('Smart Mix proposal BPM is required.');}};
const badProposal=core.createProposalPackage({optimized:baseSequence,smartMixProposal:{bpm:152,decisions:[]}},{reoptimize:false,reviewCore,actionsCore:badProposalActions});
assert.equal(badProposal.status,'review-required');
assert.equal(badProposal.editPlan.summary.readyForPreview,false);
assert(badProposal.risks.includes('edit-plan-not-preview-ready'));
assert.equal(badProposal.executable,false);

const missingSourceSequence={...baseSequence,sequence:[
  baseSequence.sequence[0],
  {sectionId:'stunt',sectionType:'stunt',candidate:{startEight:3,endEight:4,score:.88}},
  baseSequence.sequence[2]
]};
const incomplete=core.createProposalPackage({optimized:missingSourceSequence,bpm:152},{reoptimize:false,reviewCore,actionsCore:{}});
assert.equal(incomplete.status,'review-required');
assert.equal(incomplete.audioTimelinePlan.status,'review-required');
assert(incomplete.risks.includes('audio-timeline-plan-incomplete'));
assert.equal(incomplete.audioTimelinePlan.clips.length,2);
assert.equal(incomplete.audioTimelinePlan.risks[0].sectionId,'stunt');

const noBpm=core.buildAudioTimelinePlan(core.normalizeSequence(baseSequence.sequence),0);
assert.equal(noBpm.status,'blocked');
assert.equal(noBpm.reason,'bpm-required');
assert.equal(noBpm.clips.length,0);

const missingReview=core.createProposalPackage({optimized:baseSequence,bpm:152},{reviewCore:{},actionsCore:{},iterativeCore:{}});
assert.equal(missingReview.status,'blocked');
assert.equal(missingReview.reason,'review-core-unavailable');
assert.equal(missingReview.nonDestructive,true);

console.log('smart-mix-proposal-package-core tests passed');
