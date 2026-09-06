(()=>{
  'use strict';

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}
  function average(values=[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}

  function transitionQualityCore(){
    if(typeof module!=='undefined'&&module.exports){
      try{return require('./smart-mix-transition-quality-core.js');}catch(_){return null;}
    }
    if(typeof window!=='undefined')return window.SmartMixTransitionQualityCore||null;
    return null;
  }

  function qualityBand(score){
    const s=clamp01(score);
    return s>=.86?'excellent':s>=.74?'strong':s>=.62?'usable':s>=.5?'weak':'risky';
  }

  function normalizeTransition(step,index){
    const transition=step?.transition||{};
    const score=transition.qualityScore==null?null:clamp01(transition.qualityScore);
    return {
      index,
      fromSectionId:index>0?step?.__previous?.sectionId||null:null,
      toSectionId:step?.sectionId||null,
      fromSectionType:index>0?step?.__previous?.sectionType||'other':'entry',
      toSectionType:step?.sectionType||'other',
      fromEight:index>0?step?.__previous?.candidate?.endEight??null:null,
      toEight:step?.candidate?.startEight??null,
      score,
      rating:transition.qualityRating||'unavailable',
      reasons:Array.isArray(transition.qualityReasons)?transition.qualityReasons:[],
      components:transition.qualityComponents||null,
      combinedScore:transition.combinedScore==null?null:clamp01(transition.combinedScore)
    };
  }

  function collectTransitions(sequence=[]){
    const linked=sequence.map((step,index)=>({...step,__previous:index>0?sequence[index-1]:null}));
    const stored=linked.slice(1).map((step,index)=>normalizeTransition(step,index+1));
    if(stored.every(t=>t.score!=null))return stored;

    const core=transitionQualityCore();
    if(!core?.evaluateSequence)return stored;
    const evaluated=core.evaluateSequence(sequence);
    return (evaluated.transitions||[]).map((item,index)=>({
      index:index+1,
      fromSectionId:item.fromSectionId,
      toSectionId:item.toSectionId,
      fromSectionType:item.fromSectionType,
      toSectionType:item.toSectionType,
      fromEight:item.fromEight,
      toEight:item.toEight,
      score:item.rating==='unavailable'?null:clamp01(item.score),
      rating:item.rating,
      reasons:item.reasons||[],
      components:item.components||null,
      combinedScore:stored[index]?.combinedScore??null
    }));
  }

  function weakestTransition(transitions=[]){
    const scored=transitions.filter(t=>t.score!=null);
    if(!scored.length)return null;
    return [...scored].sort((a,b)=>a.score-b.score||a.index-b.index)[0];
  }

  function recommendationFor(weakest){
    if(!weakest)return null;
    const reasons=new Set(weakest.reasons||[]);
    let action='review-transition';
    if(reasons.has('energy-mismatch'))action='replace-or-realign-next-segment';
    else if(reasons.has('weak-break-drop-structure'))action='seek-stronger-break-or-drop-entry';
    else if(reasons.has('weak-cut-point'))action='seek-cleaner-cut-boundary';
    else if(reasons.has('timing-gap'))action='reduce-eight-count-gap';
    return {
      action,
      fromSectionId:weakest.fromSectionId,
      toSectionId:weakest.toSectionId,
      boundaryEight:{from:weakest.fromEight,to:weakest.toEight},
      reasons:[...(weakest.reasons||[])],
      preserveOtherSections:true,
      nonDestructive:true
    };
  }

  function reviewSequence(optimized={}, {
    matchWeight=.38,
    transitionWeight=.34,
    coverageWeight=.18,
    weakestWeight=.10
  }={}){
    const sequence=Array.isArray(optimized?.sequence)?optimized.sequence:[];
    const transitions=collectTransitions(sequence);
    const scored=transitions.filter(t=>t.score!=null);
    const transitionAverage=scored.length?average(scored.map(t=>t.score)):1;
    const weakest=weakestTransition(transitions);
    const weakestScore=weakest?.score??1;
    const matchScore=clamp01(optimized?.matchScore??optimized?.score??0);
    const coverage=clamp01(optimized?.coverage??(sequence.length?1:0));
    const weights=[Math.max(0,finite(matchWeight,.38)),Math.max(0,finite(transitionWeight,.34)),Math.max(0,finite(coverageWeight,.18)),Math.max(0,finite(weakestWeight,.10))];
    const sum=Math.max(.0001,weights.reduce((a,b)=>a+b,0));
    const globalScore=clamp01((matchScore*weights[0]+transitionAverage*weights[1]+coverage*weights[2]+weakestScore*weights[3])/sum);
    const riskFlags=[];
    if(coverage<1)riskFlags.push('incomplete-coverage');
    if(transitionAverage<.62)riskFlags.push('weak-transition-average');
    if(weakestScore<.5)riskFlags.push('risky-weakest-transition');
    if(matchScore<.62)riskFlags.push('weak-segment-fit');

    return {
      globalScore,
      quality:qualityBand(globalScore),
      matchScore,
      transitionAverage,
      coverage,
      weakestTransition:weakest,
      weakestScore,
      transitions,
      riskFlags,
      recommendation:recommendationFor(weakest),
      readyForPreview:riskFlags.length===0,
      nonDestructive:true
    };
  }

  const api={qualityBand,collectTransitions,weakestTransition,recommendationFor,reviewSequence};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixSequenceReviewCore=api;
})();
