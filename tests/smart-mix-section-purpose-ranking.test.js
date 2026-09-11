const assert=require('assert');
const core=require('../smart-mix-segment-matcher-core.js');

const uniform=Array.from({length:8},(_,i)=>({
  sourceName:'purpose.wav',
  trackId:'purpose-track',
  eight:i+1,
  start:i*3.2,
  end:(i+1)*3.2,
  energyScore:.72,
  activity:.62,
  crestDb:12,
  energyDelta:0
}));

const detectedSections=[
  {
    id:'reset-section',
    sourceName:'purpose.wav',
    trackId:'purpose-track',
    startEight:1,
    endEight:4,
    confidence:.96,
    purpose:'reset'
  },
  {
    id:'peak-section',
    sourceName:'purpose.wav',
    trackId:'purpose-track',
    startEight:5,
    endEight:8,
    confidence:.96,
    purpose:'peak'
  }
];

assert.ok(core.SECTION_PURPOSE_TARGETS,'purpose target map must be exported');
assert.ok(core.purposeTargetScore({type:'stunt'},'peak')>core.purposeTargetScore({type:'stunt'},'reset'));
assert.ok(core.purposeTargetScore({type:'transition'},'reset')>core.purposeTargetScore({type:'transition'},'peak'));

const peakCandidate={sourceName:'purpose.wav',trackId:'purpose-track',startEight:5,endEight:8,score:.8};
const resetCandidate={sourceName:'purpose.wav',trackId:'purpose-track',startEight:1,endEight:4,score:.8};

const peakFit=core.sectionPurposeFit({type:'stunt'},peakCandidate,detectedSections,.72);
const resetFit=core.sectionPurposeFit({type:'stunt'},resetCandidate,detectedSections,.72);
assert.equal(peakFit.source,'detected');
assert.equal(peakFit.purpose,'peak');
assert.ok(peakFit.score>resetFit.score,'stunt should prefer a peak source section over a reset section');

const stuntRanks=core.rankSegments(
  {id:'stunt',type:'stunt',energy:'high',energyTrend:'steady',durationEights:4},
  uniform,
  {
    limit:5,
    preferPhraseBoundaries:false,
    preferDetectedBoundaries:false,
    sections:detectedSections,
    preferSectionPurpose:true,
    minPurposeConfidence:.72
  }
);
assert.equal(stuntRanks[0].startEight,5,'section purpose should break an otherwise equal stunt ranking in favor of peak');
assert.equal(stuntRanks[0].sectionPurpose.purpose,'peak');

const transitionRanks=core.rankSegments(
  {id:'transition',type:'transition',energy:'high',energyTrend:'steady',durationEights:4},
  uniform,
  {
    limit:5,
    preferPhraseBoundaries:false,
    preferDetectedBoundaries:false,
    sections:detectedSections,
    preferSectionPurpose:true,
    minPurposeConfidence:.72
  }
);
assert.equal(transitionRanks[0].startEight,1,'transition should prefer reset over peak when other candidate features are equal');
assert.equal(transitionRanks[0].sectionPurpose.purpose,'reset');

const disabledRanks=core.rankSegments(
  {id:'stunt',type:'stunt',energy:'high',energyTrend:'steady',durationEights:4},
  uniform,
  {
    limit:5,
    preferPhraseBoundaries:false,
    preferDetectedBoundaries:false,
    sections:detectedSections,
    preferSectionPurpose:false
  }
);
assert.equal(disabledRanks[0].startEight,1,'purpose preference must be opt-out and preserve legacy tie ordering');
assert.equal(disabledRanks[0].sectionPurpose,null);

const lowConfidenceRanks=core.rankSegments(
  {id:'stunt',type:'stunt',energy:'high',energyTrend:'steady',durationEights:4},
  uniform,
  {
    limit:5,
    preferPhraseBoundaries:false,
    preferDetectedBoundaries:false,
    sections:detectedSections.map(row=>({...row,confidence:.60})),
    preferSectionPurpose:true,
    minPurposeConfidence:.72
  }
);
assert.equal(lowConfidenceRanks[0].startEight,1,'low-confidence purpose data must fall back to legacy tie ordering');
assert.equal(lowConfidenceRanks[0].sectionPurpose.source,'fallback');

const foreignRanks=core.rankSegments(
  {id:'stunt',type:'stunt',energy:'high',energyTrend:'steady',durationEights:4},
  uniform,
  {
    limit:5,
    preferPhraseBoundaries:false,
    preferDetectedBoundaries:false,
    sections:[{...detectedSections[1],trackId:'other-track',sourceName:'other.wav'}],
    preferSectionPurpose:true
  }
);
assert.equal(foreignRanks[0].startEight,1,'purpose from another source track must not affect ranking');

const plan=core.matchPlanSections(
  [{id:'stunt',type:'stunt',energy:'high',energyTrend:'steady',durationEights:4}],
  uniform,
  {
    avoidReuse:true,
    preferPhraseBoundaries:false,
    preferDetectedBoundaries:false,
    detectedSections,
    preferSectionPurpose:true,
    minPurposeConfidence:.72
  }
);
assert.equal(plan.matches[0].best.startEight,5,'purpose metadata must flow through plan matching');
assert.equal(plan.preferSectionPurpose,true);
assert.equal(plan.minPurposeConfidence,.72);
assert.equal(plan.nonDestructive,true);

console.log('smart-mix section purpose ranking tests passed');
