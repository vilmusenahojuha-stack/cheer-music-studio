const assert=require('assert');
const core=require('../smart-mix-iterative-reoptimizer-core.js');

function makeSequence(stuntStart,danceStart){
  return {sequence:[
    {sectionId:'intro',candidate:{startEight:1,endEight:2}},
    {sectionId:'stunt',candidate:{startEight:stuntStart,endEight:stuntStart+1}},
    {sectionId:'dance',candidate:{startEight:danceStart,endEight:danceStart+1}}
  ],coverage:1,nonDestructive:true};
}

const scores=new Map([
  ['intro:1-2|stunt:3-4|dance:7-8',.60],
  ['intro:1-2|stunt:5-6|dance:7-8',.74],
  ['intro:1-2|stunt:5-6|dance:9-10',.81]
]);
const reviewCore={reviewSequence(result){
  const signature=core.sequenceSignature(result.sequence);
  const globalScore=scores.get(signature)??.5;
  return {
    globalScore,
    coverage:1,
    weakestTransition:globalScore<.7?{fromSectionId:'intro',toSectionId:'stunt'}:
      globalScore<.8?{fromSectionId:'stunt',toSectionId:'dance'}:null,
    nonDestructive:true
  };
}};

let calls=0;
const localCore={reoptimizeWeakest(matchPlan,current,options){
  calls++;
  const signature=core.sequenceSignature(current.sequence);
  if(signature==='intro:1-2|stunt:3-4|dance:7-8'){
    const optimized=makeSequence(5,7);
    return {accepted:true,changedSectionId:'stunt',optimized,improvedReview:reviewCore.reviewSequence(optimized),nonDestructive:true};
  }
  if(signature==='intro:1-2|stunt:5-6|dance:7-8'){
    const optimized=makeSequence(5,9);
    return {accepted:true,changedSectionId:'dance',optimized,improvedReview:reviewCore.reviewSequence(optimized),nonDestructive:true};
  }
  return {accepted:false,reason:'no-quality-improving-single-swap',nonDestructive:true};
}};

const initial=makeSequence(3,7);
const result=core.improveIteratively({},initial,{localCore,reviewCore,minImprovement:.01,maxIterations:6});
assert.equal(result.improved,true);
assert.equal(result.iterations,2);
assert.equal(result.reason,'no-quality-improving-single-swap');
assert.equal(result.converged,true);
assert.equal(result.history[0].changedSectionId,'stunt');
assert.equal(result.history[1].changedSectionId,'dance');
assert(Math.abs(result.totalImprovement-.21)<1e-12);
assert.equal(core.sequenceSignature(result.optimized.sequence),'intro:1-2|stunt:5-6|dance:9-10');
assert.equal(result.nonDestructive,true);
assert.equal(calls,3);

const capped=core.improveIteratively({},initial,{localCore,reviewCore,minImprovement:.01,maxIterations:1});
assert.equal(capped.iterations,1);
assert.equal(capped.reason,'max-iterations-reached');
assert.equal(capped.converged,false);

const cycleLocal={reoptimizeWeakest(matchPlan,current){
  const optimized=core.sequenceSignature(current.sequence).includes('stunt:3-4')?makeSequence(5,7):makeSequence(3,7);
  return {accepted:true,changedSectionId:'stunt',optimized,improvedReview:{globalScore:.9,coverage:1,weakestTransition:{fromSectionId:'intro',toSectionId:'stunt'}}};
}};
const cycle=core.improveIteratively({},initial,{localCore:cycleLocal,reviewCore,minImprovement:0,maxIterations:8});
assert.equal(cycle.reason,'cycle-detected');
assert(cycle.iterations>=1);
assert(cycle.iterations<8);

const unavailable=core.improveIteratively({},initial,{localCore:{},reviewCore});
assert.equal(unavailable.improved,false);
assert.equal(unavailable.reason,'dependency-unavailable');

console.log('smart-mix-iterative-reoptimizer-core tests passed');
