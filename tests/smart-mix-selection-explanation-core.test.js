const assert=require('assert');
const core=require('../smart-mix-selection-explanation-core.js');

const peak={
  sourceName:'purpose.wav',
  trackId:'purpose-track',
  startEight:5,
  endEight:8,
  score:.91,
  transitionIntent:'drop',
  features:{
    entryTransitionType:'drop',
    entryTransitionStrength:.9,
    averageEnergy:.76
  },
  components:{
    transition:.96,
    energy:.94,
    continuity:.82
  },
  phraseBoundary:{
    phraseEights:4,
    startAligned:true,
    endAligned:true,
    score:1
  },
  boundarySource:'detected',
  structuralBoundary:{
    source:'detected',
    score:.98,
    confidence:.95,
    kind:'section',
    startAligned:true,
    endAligned:true
  },
  sectionPurpose:{
    source:'detected',
    score:.99,
    purpose:'peak',
    compatibility:1,
    confidence:.96,
    coverage:1,
    sectionId:'peak-section'
  }
};

const runnerUp={
  ...peak,
  startEight:1,
  endEight:4,
  score:.84,
  sectionPurpose:{
    ...peak.sectionPurpose,
    score:.72,
    purpose:'steady',
    compatibility:.66
  }
};

const reasons=core.reasonCandidates({type:'stunt',energy:'high'},peak);
assert.ok(reasons.length>=4);
assert.equal(reasons[0].code,'purpose','strong detected purpose fit should be the clearest reason');
assert.ok(reasons.some(row=>row.code==='boundary'));
assert.ok(reasons.some(row=>row.code==='transition'));
assert.ok(reasons.some(row=>row.code==='energy'));

const explanation=core.explainCandidate(
  {id:'stunt',type:'stunt',energy:'high'},
  peak,
  {runnerUp,maxReasons:3}
);
assert.equal(explanation.selected,true);
assert.equal(explanation.primaryReason.code,'purpose');
assert.equal(explanation.reasons.length,3);
assert.ok(Math.abs(explanation.margin-.07)<1e-9);
assert.ok(explanation.confidence>.8);
assert.equal(explanation.nonDestructive,true);

const noCandidate=core.explainCandidate({type:'stunt'},null);
assert.equal(noCandidate.selected,false);
assert.equal(noCandidate.confidence,0);
assert.equal(noCandidate.primaryReason,null);

const fallback={
  ...peak,
  sectionPurpose:{source:'fallback',score:null,purpose:null,confidence:0,coverage:0},
  boundarySource:'fixed-phrase',
  structuralBoundary:null,
  transitionIntent:'neutral',
  components:{energy:.93,continuity:.9},
  phraseBoundary:{phraseEights:4,startAligned:true,endAligned:true,score:1}
};
const fallbackReasons=core.reasonCandidates({type:'dance',energy:'high'},fallback);
assert.ok(!fallbackReasons.some(row=>row.code==='purpose'));
assert.ok(!fallbackReasons.some(row=>row.code==='boundary'));
assert.ok(fallbackReasons.some(row=>row.code==='phrase'));
assert.ok(fallbackReasons.some(row=>row.code==='energy'));

const plan=core.explainPlanMatches({
  matchedSections:1,
  totalSections:1,
  matches:[{
    sectionId:'stunt',
    sectionType:'stunt',
    best:peak,
    candidates:[peak,runnerUp]
  }]
});
assert.equal(plan.matches.length,1);
assert.equal(plan.matches[0].sectionId,'stunt');
assert.equal(plan.matches[0].explanation.primaryReason.code,'purpose');
assert.equal(plan.nonDestructive,true);

console.log('smart-mix selection explanation tests passed');