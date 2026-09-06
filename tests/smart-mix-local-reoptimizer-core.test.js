const assert=require('assert');
const core=require('../smart-mix-local-reoptimizer-core.js');

const matches=[
 {sectionId:'intro',sectionType:'intro',candidates:[{startEight:1,endEight:2,score:.9}]},
 {sectionId:'stunt',sectionType:'stunt',candidates:[
   {startEight:3,endEight:4,score:.95,quality:.42},
   {startEight:5,endEight:6,score:.88,quality:.82}
 ]},
 {sectionId:'dance',sectionType:'dance',candidates:[
   {startEight:7,endEight:8,score:.9,quality:.7},
   {startEight:9,endEight:10,score:.84,quality:.75}
 ]}
];
const optimized={sequence:[
 {sectionId:'intro',sectionType:'intro',candidate:matches[0].candidates[0]},
 {sectionId:'stunt',sectionType:'stunt',candidate:matches[1].candidates[0]},
 {sectionId:'dance',sectionType:'dance',candidate:matches[2].candidates[0]}
],coverage:1,matchScore:.91};

const sequenceCore={optimizeSequence(constrained){
 const sequence=constrained.map(match=>({sectionId:match.sectionId,sectionType:match.sectionType,candidate:match.candidates[0]}));
 if(sequence.some(step=>!step.candidate))return {sequence:[],coverage:0};
 return {sequence,coverage:1,matchScore:sequence.reduce((sum,step)=>sum+(step.candidate.score||0),0)/sequence.length,nonDestructive:true};
}};
const reviewCore={reviewSequence(result){
 const sequence=result.sequence||[];
 const stunt=sequence.find(step=>step.sectionId==='stunt')?.candidate;
 const dance=sequence.find(step=>step.sectionId==='dance')?.candidate;
 const globalScore=.45*(result.matchScore||.91)+.4*(stunt?.quality||.42)+.15*(dance?.quality||.7);
 return {globalScore,coverage:result.coverage??1,weakestTransition:{fromSectionId:'intro',toSectionId:'stunt'},nonDestructive:true};
}};

const improved=core.reoptimizeWeakest({matches},optimized,{sequenceCore,reviewCore,minImprovement:.01});
assert.equal(improved.accepted,true);
assert.equal(improved.changedSectionId,'stunt');
assert.equal(improved.afterCandidate.startEight,5);
assert.equal(improved.preservedOtherSections,true);
assert.equal(improved.optimized.sequence.find(step=>step.sectionId==='intro').candidate.startEight,1);
assert.equal(improved.optimized.sequence.find(step=>step.sectionId==='dance').candidate.startEight,7);
assert(improved.improvement>.1);

const rejected=core.reoptimizeWeakest({matches},optimized,{sequenceCore,reviewCore,minImprovement:.5});
assert.equal(rejected.accepted,false);
assert.equal(rejected.reason,'no-quality-improving-single-swap');
assert(rejected.attempted>=1);

assert(core.sameCandidate({startEight:2,endEight:3},{startEight:2,endEight:3}));
assert.deepEqual(core.changedSections(optimized.sequence,improved.optimized.sequence),['stunt']);
console.log('smart-mix-local-reoptimizer-core tests passed');
