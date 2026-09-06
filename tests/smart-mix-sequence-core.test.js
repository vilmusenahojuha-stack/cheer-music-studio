const assert=require('assert');
const core=require('../smart-mix-sequence-core.js');

const matches=[
  {sectionId:'intro',sectionType:'intro',candidates:[
    {startEight:1,endEight:4,score:.82},
    {startEight:9,endEight:12,score:.94}
  ]},
  {sectionId:'stunt',sectionType:'stunt',candidates:[
    {startEight:5,endEight:8,score:.91},
    {startEight:13,endEight:16,score:.89}
  ]},
  {sectionId:'dance',sectionType:'dance',candidates:[
    {startEight:9,endEight:12,score:.90},
    {startEight:17,endEight:20,score:.86}
  ]}
];

const optimized=core.optimizeSequence(matches,{matchWeight:.7,transitionWeight:.3});
assert.equal(optimized.matchedSections,3);
assert.equal(optimized.coverage,1);
assert.deepEqual(optimized.sequence.map(s=>s.candidate.startEight),[9,13,17]);
assert.equal(optimized.sequence[1].transition.gapEights,0);
assert.equal(optimized.sequence[2].transition.gapEights,0);
assert.ok(optimized.transitionScore>0);
assert.ok(optimized.transitionQualityScore>0);
assert.equal(optimized.nonDestructive,true);

const overlap=core.transitionCompatibility({startEight:1,endEight:4},{startEight:4,endEight:7});
assert.equal(overlap.overlap,true);
assert.equal(overlap.ordered,false);
assert.equal(overlap.score,0);

const gap=core.transitionCompatibility({startEight:1,endEight:4},{startEight:7,endEight:10},{idealGapEights:0,maxGapEights:8});
assert.equal(gap.gapEights,2);
assert.ok(gap.score<1&&gap.score>0);

const impossible=core.optimizeSequence([
  {sectionId:'a',candidates:[{startEight:10,endEight:12,score:.9}]},
  {sectionId:'b',candidates:[{startEight:1,endEight:3,score:.95}]}
]);
assert.equal(impossible.reason,'no-valid-ordered-sequence');
assert.equal(impossible.coverage,0);

const partial=core.optimizeSequence([
  {sectionId:'a',candidates:[{startEight:1,endEight:3,score:.9}]},
  {sectionId:'b',candidates:[]},
  {sectionId:'c',candidates:[{startEight:4,endEight:6,score:.85}]}
],{allowUnmatched:true});
assert.equal(partial.matchedSections,2);
assert.equal(partial.totalSections,3);
assert.ok(Math.abs(partial.coverage-2/3)<1e-9);
assert.equal(partial.sequence[1].candidate,null);

const wrapped=core.optimizeMatchedPlan({coverage:1,averageScore:.88,matches});
assert.equal(wrapped.sourceCoverage,1);
assert.equal(wrapped.sourceAverageScore,.88);
assert.equal(wrapped.matchedSections,3);

const qualityDriven=core.optimizeSequence([
  {sectionId:'intro',sectionType:'intro',candidates:[
    {startEight:1,endEight:4,score:.9,features:{averageEnergy:.35}}
  ]},
  {sectionId:'stunt',sectionType:'stunt',candidates:[
    {startEight:5,endEight:8,score:.96,features:{averageEnergy:.34,entryTransitionStrength:.05}},
    {startEight:9,endEight:12,score:.89,dropConfidence:.95,features:{averageEnergy:.78,entryTransitionStrength:.95}}
  ]}
],{
  matchWeight:.45,
  transitionWeight:.55,
  maxGapEights:8,
  transitionTimingShare:.25,
  transitionQualityShare:.75
});
assert.equal(qualityDriven.sequence[1].candidate.startEight,9);
assert.equal(qualityDriven.sequence[1].transition.qualityRating,'good');
assert.ok(qualityDriven.sequence[1].transition.qualityScore>.7);
assert.ok(qualityDriven.sequence[1].transition.combinedScore>qualityDriven.sequence[1].transition.score*.5);
assert.ok(qualityDriven.transitionQualityScore>.8);

console.log('smart-mix-sequence-core tests passed');
