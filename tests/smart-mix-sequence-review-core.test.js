const assert=require('assert');
const core=require('../smart-mix-sequence-review-core.js');

const sequence=[
  {sectionId:'intro',sectionType:'intro',candidate:{startEight:1,endEight:4,score:.9},transition:{qualityRating:'entry'}},
  {sectionId:'stunt',sectionType:'stunt',candidate:{startEight:5,endEight:8,score:.91},transition:{qualityScore:.84,qualityRating:'strong',qualityReasons:[],combinedScore:.9}},
  {sectionId:'tumbling',sectionType:'tumbling',candidate:{startEight:9,endEight:12,score:.88},transition:{qualityScore:.71,qualityRating:'good',qualityReasons:[],combinedScore:.82}},
  {sectionId:'pyramid',sectionType:'pyramid',candidate:{startEight:13,endEight:16,score:.87},transition:{qualityScore:.42,qualityRating:'risky',qualityReasons:['energy-mismatch','weak-break-drop-structure'],combinedScore:.62}},
  {sectionId:'dance',sectionType:'dance',candidate:{startEight:17,endEight:20,score:.86},transition:{qualityScore:.79,qualityRating:'good',qualityReasons:[],combinedScore:.85}}
];

const review=core.reviewSequence({sequence,matchScore:.884,coverage:1});
assert.equal(review.nonDestructive,true);
assert.equal(review.transitions.length,4);
assert.equal(review.weakestTransition.fromSectionId,'tumbling');
assert.equal(review.weakestTransition.toSectionId,'pyramid');
assert.equal(review.weakestScore,.42);
assert.ok(review.transitionAverage>.68&&review.transitionAverage<.7);
assert.ok(review.globalScore>0&&review.globalScore<1);
assert.equal(review.recommendation.action,'replace-or-realign-next-segment');
assert.equal(review.recommendation.preserveOtherSections,true);
assert.ok(review.riskFlags.includes('risky-weakest-transition'));
assert.equal(review.readyForPreview,false);

const clean=core.reviewSequence({
  matchScore:.9,
  coverage:1,
  sequence:[
    {sectionId:'intro',sectionType:'intro',candidate:{startEight:1,endEight:4},transition:{qualityRating:'entry'}},
    {sectionId:'stunt',sectionType:'stunt',candidate:{startEight:5,endEight:8},transition:{qualityScore:.9,qualityRating:'strong',qualityReasons:[]}},
    {sectionId:'dance',sectionType:'dance',candidate:{startEight:9,endEight:12},transition:{qualityScore:.82,qualityRating:'strong',qualityReasons:[]}}
  ]
});
assert.equal(clean.readyForPreview,true);
assert.deepEqual(clean.riskFlags,[]);
assert.equal(clean.quality,'excellent');
assert.equal(clean.weakestTransition.toSectionId,'dance');

const incomplete=core.reviewSequence({sequence:sequence.slice(0,2),matchScore:.9,coverage:.5});
assert.ok(incomplete.riskFlags.includes('incomplete-coverage'));
assert.equal(incomplete.readyForPreview,false);

assert.equal(core.qualityBand(.49),'risky');
assert.equal(core.qualityBand(.5),'weak');
assert.equal(core.qualityBand(.62),'usable');
assert.equal(core.qualityBand(.74),'strong');
assert.equal(core.qualityBand(.86),'excellent');

console.log('smart-mix-sequence-review-core tests passed');
