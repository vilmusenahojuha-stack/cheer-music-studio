const assert=require('assert');
const core=require('../smart-mix-selection-explanation-core.js');

const peak={
  sourceName:'purpose.wav',
  trackId:'purpose-track',
  startEight:5,
  endEight:8,
  score:.91,
  transitionIntent:'drop',
  features:{entryTransitionType:'drop',entryTransitionStrength:.9,averageEnergy:.76},
  components:{transition:.96,energy:.94,continuity:.82},
  phraseBoundary:{phraseEights:4,startAligned:true,endAligned:true,score:1},
  boundarySource:'detected',
  structuralBoundary:{source:'detected',score:.98,confidence:.95,kind:'section',startAligned:true,endAligned:true},
  sectionPurpose:{source:'detected',score:.99,purpose:'peak',compatibility:1,confidence:.96,coverage:1,sectionId:'peak-section'}
};

const runnerUp={...peak,startEight:1,endEight:4,score:.84,sectionPurpose:{...peak.sectionPurpose,score:.72,purpose:'steady',compatibility:.66}};

const proposal={
  status:'preview-ready',
  audioTimelinePlan:{clips:[{sourceName:'purpose.wav',start:0,duration:12}]},
  summary:{sections:1,timelineClips:1}
};
const matchPlan={
  coverage:1,
  matchedSections:1,
  totalSections:1,
  matches:[{
    sectionId:'stunt',
    sectionType:'stunt',
    energy:'peak',
    best:peak,
    candidates:[peak,runnerUp]
  }]
};

const enriched=core.attachExplanationsToProposal(proposal,matchPlan);
assert.notStrictEqual(enriched,proposal,'proposal enrichment must return a new object');
assert.strictEqual(enriched.audioTimelinePlan,proposal.audioTimelinePlan,'audio timeline must remain untouched');
assert.strictEqual(enriched.summary,proposal.summary,'existing proposal summary must remain untouched');
assert.equal(enriched.status,'preview-ready');
assert.equal(enriched.smartMixSelectionExplanation.source,'smart-mix-match-plan');
assert.equal(enriched.smartMixSelectionExplanation.nonDestructive,true);
assert.equal(enriched.smartMixSelectionExplanation.matches.length,1);
assert.equal(enriched.smartMixSelectionExplanation.matches[0].sectionId,'stunt');
assert.equal(enriched.smartMixSelectionExplanation.matches[0].explanation.primaryReason.code,'purpose');
assert.ok(enriched.smartMixSelectionExplanation.matches[0].explanation.confidence>.8);

const empty=core.attachExplanationsToProposal({status:'review-required'},{matches:[],matchedSections:0,totalSections:2});
assert.equal(empty.status,'review-required');
assert.equal(empty.smartMixSelectionExplanation.matches.length,0);
assert.equal(empty.smartMixSelectionExplanation.totalSections,2);
assert.equal(empty.smartMixSelectionExplanation.nonDestructive,true);

console.log('smart-mix proposal explanation attachment tests passed');
