(()=>{
  'use strict';

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clampInt(value,min,max,fallback){const n=Math.trunc(finite(value,fallback));return Math.max(min,Math.min(max,n));}

  function defaultLocalCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-local-reoptimizer-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixLocalReoptimizerCore||null;
    return null;
  }

  function defaultReviewCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-sequence-review-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixSequenceReviewCore||null;
    return null;
  }

  function sequenceSignature(sequence=[]){
    return (Array.isArray(sequence)?sequence:[]).map(step=>{
      const candidate=step?.candidate||{};
      return `${step?.sectionId??''}:${Number(candidate.startEight)}-${Number(candidate.endEight)}`;
    }).join('|');
  }

  function improveIteratively(matchPlan={},optimized={},options={}){
    const localCore=options.localCore||defaultLocalCore();
    const reviewCore=options.reviewCore||defaultReviewCore();
    if(!localCore?.reoptimizeWeakest||!reviewCore?.reviewSequence){
      return {improved:false,reason:'dependency-unavailable',iterations:0,history:[],optimized,nonDestructive:true};
    }

    const maxIterations=clampInt(options.maxIterations,1,8,4);
    const minImprovement=Math.max(0,finite(options.minImprovement,.015));
    const reviewOptions=options.reviewOptions||{};
    const optimizeOptions=options.optimizeOptions||{};
    let current=optimized;
    let currentReview=reviewCore.reviewSequence(current,reviewOptions);
    const initialReview=currentReview;
    const history=[];
    const seen=new Set([sequenceSignature(current?.sequence||[])]);
    let stopReason='max-iterations-reached';

    for(let index=0;index<maxIterations;index++){
      const result=localCore.reoptimizeWeakest(matchPlan,current,{
        reviewCore,
        sequenceCore:options.sequenceCore,
        reviewOptions,
        optimizeOptions,
        minImprovement
      });
      if(!result?.accepted){
        stopReason=result?.reason||'no-further-improvement';
        break;
      }

      const next=result.optimized;
      const nextReview=result.improvedReview||reviewCore.reviewSequence(next,reviewOptions);
      const delta=finite(nextReview?.globalScore)-finite(currentReview?.globalScore);
      if(delta+1e-12<minImprovement){
        stopReason='improvement-below-threshold';
        break;
      }

      const signature=sequenceSignature(next?.sequence||[]);
      if(seen.has(signature)){
        stopReason='cycle-detected';
        break;
      }
      seen.add(signature);

      history.push({
        iteration:index+1,
        changedSectionId:result.changedSectionId||null,
        improvement:delta,
        beforeScore:finite(currentReview?.globalScore),
        afterScore:finite(nextReview?.globalScore),
        weakestTransitionBefore:currentReview?.weakestTransition||null,
        weakestTransitionAfter:nextReview?.weakestTransition||null
      });
      current=next;
      currentReview=nextReview;
    }

    const totalImprovement=finite(currentReview?.globalScore)-finite(initialReview?.globalScore);
    return {
      improved:history.length>0,
      reason:stopReason,
      iterations:history.length,
      maxIterations,
      minImprovement,
      totalImprovement,
      initialReview,
      finalReview:currentReview,
      history,
      optimized:current,
      converged:stopReason!=='max-iterations-reached',
      nonDestructive:true
    };
  }

  const api={sequenceSignature,improveIteratively};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixIterativeReoptimizerCore=api;
})();
