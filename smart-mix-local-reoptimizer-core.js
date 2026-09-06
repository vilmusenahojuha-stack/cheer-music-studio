(()=>{
  'use strict';

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}

  function defaultSequenceCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-sequence-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixSequenceCore||null;
    return null;
  }

  function defaultReviewCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-sequence-review-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixSequenceReviewCore||null;
    return null;
  }

  function sameCandidate(a,b){
    if(!a||!b)return a===b;
    return Number(a.startEight)===Number(b.startEight)&&Number(a.endEight)===Number(b.endEight);
  }

  function sequenceBySection(sequence=[]){
    const map=new Map();
    for(const step of sequence){if(step?.sectionId!=null)map.set(step.sectionId,step);}
    return map;
  }

  function candidateAlternatives(match,current){
    return (Array.isArray(match?.candidates)?match.candidates:[])
      .filter(candidate=>candidate&&Number.isFinite(Number(candidate.startEight))&&Number.isFinite(Number(candidate.endEight)))
      .filter(candidate=>!sameCandidate(candidate,current));
  }

  function lockedMatches(matchPlan={},optimized={},targetSectionId,targetCandidate){
    const selected=sequenceBySection(optimized?.sequence||[]);
    return (matchPlan?.matches||[]).map(match=>{
      const sectionId=match?.sectionId||null;
      if(sectionId===targetSectionId)return {...match,candidates:[targetCandidate]};
      const current=selected.get(sectionId)?.candidate||null;
      return {...match,candidates:current?[current]:[]};
    });
  }

  function changedSections(before=[],after=[]){
    const previous=sequenceBySection(before),next=sequenceBySection(after);
    const ids=new Set([...previous.keys(),...next.keys()]);
    return [...ids].filter(id=>!sameCandidate(previous.get(id)?.candidate||null,next.get(id)?.candidate||null));
  }

  function reoptimizeWeakest(matchPlan={},optimized={},options={}){
    const sequenceCore=options.sequenceCore||defaultSequenceCore();
    const reviewCore=options.reviewCore||defaultReviewCore();
    if(!sequenceCore?.optimizeSequence||!reviewCore?.reviewSequence){
      return {accepted:false,reason:'dependency-unavailable',attempted:0,nonDestructive:true};
    }

    const reviewOptions=options.reviewOptions||{};
    const optimizeOptions=options.optimizeOptions||{};
    const minImprovement=Math.max(0,finite(options.minImprovement,.015));
    const baselineReview=reviewCore.reviewSequence(optimized,reviewOptions);
    const weakest=baselineReview?.weakestTransition||null;
    if(!weakest){
      return {accepted:false,reason:'no-weakest-transition',attempted:0,baselineReview,nonDestructive:true};
    }

    const matches=Array.isArray(matchPlan?.matches)?matchPlan.matches:[];
    const currentBySection=sequenceBySection(optimized?.sequence||[]);
    const targetIds=[weakest.toSectionId,weakest.fromSectionId].filter((id,index,all)=>id!=null&&all.indexOf(id)===index);
    let attempted=0,best=null;

    for(const sectionId of targetIds){
      const match=matches.find(item=>item?.sectionId===sectionId);
      const current=currentBySection.get(sectionId)?.candidate||null;
      if(!match||!current)continue;
      for(const alternative of candidateAlternatives(match,current)){
        attempted++;
        const constrained=lockedMatches(matchPlan,optimized,sectionId,alternative);
        const candidateResult=sequenceCore.optimizeSequence(constrained,{...optimizeOptions,allowUnmatched:false});
        if(!candidateResult?.sequence?.length||candidateResult.coverage<(baselineReview.coverage??0))continue;
        const changes=changedSections(optimized.sequence||[],candidateResult.sequence||[]);
        if(changes.length!==1||changes[0]!==sectionId)continue;
        const candidateReview=reviewCore.reviewSequence(candidateResult,reviewOptions);
        const improvement=finite(candidateReview?.globalScore)-finite(baselineReview?.globalScore);
        if(improvement+1e-12<minImprovement)continue;
        if(!best||candidateReview.globalScore>best.review.globalScore||
          (candidateReview.globalScore===best.review.globalScore&&alternative.score>best.alternative.score)){
          best={sectionId,alternative,result:candidateResult,review:candidateReview,improvement};
        }
      }
    }

    if(!best){
      return {accepted:false,reason:'no-quality-improving-single-swap',attempted,baselineReview,minImprovement,nonDestructive:true};
    }
    const before=currentBySection.get(best.sectionId)?.candidate||null;
    return {
      accepted:true,
      reason:'global-quality-improved',
      attempted,
      changedSectionId:best.sectionId,
      beforeCandidate:before,
      afterCandidate:best.alternative,
      improvement:best.improvement,
      baselineReview,
      improvedReview:best.review,
      optimized:best.result,
      preservedOtherSections:true,
      nonDestructive:true
    };
  }

  const api={sameCandidate,sequenceBySection,candidateAlternatives,lockedMatches,changedSections,reoptimizeWeakest};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixLocalReoptimizerCore=api;
})();
