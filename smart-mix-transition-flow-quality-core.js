(()=>{
  'use strict';

  const finite=(value,fallback=0)=>{
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  };
  const clamp01=value=>Math.max(0,Math.min(1,finite(value)));

  const ENERGY_TARGETS=Object.freeze({
    low:.38,
    medium:.58,
    high:.76,
    peak:.90
  });

  function targetEnergy(section={}){
    const key=String(section.energy||'medium').toLowerCase();
    return ENERGY_TARGETS[key]??ENERGY_TARGETS.medium;
  }

  function selectedCandidateBySection(matchPlan={}){
    const map=new Map();
    for(const match of Array.isArray(matchPlan.matches)?matchPlan.matches:[]){
      if(!match?.sectionId)continue;
      map.set(String(match.sectionId),match.best||match.candidates?.[0]||null);
    }
    return map;
  }

  function actualEnergy(candidate={}){
    const value=candidate?.features?.averageEnergy;
    return Number.isFinite(Number(value))?clamp01(value):null;
  }

  function sourceKey(candidate={}){
    return candidate?.trackId||candidate?.sourceName||null;
  }

  function boundarySupport(candidate={}){
    const values=[];
    if(Number.isFinite(Number(candidate?.structuralBoundary?.score))){
      values.push(clamp01(candidate.structuralBoundary.score));
    }
    if(Number.isFinite(Number(candidate?.phraseBoundary?.score))){
      values.push(clamp01(candidate.phraseBoundary.score));
    }
    if(!values.length)return null;
    return Math.max(...values);
  }

  function transitionSupport(candidate={}){
    const value=candidate?.components?.transition;
    return Number.isFinite(Number(value))?clamp01(value):null;
  }

  function energyDeltaFit(fromSection={},toSection={},fromCandidate={},toCandidate={}){
    const fromActual=actualEnergy(fromCandidate);
    const toActual=actualEnergy(toCandidate);
    if(fromActual==null||toActual==null)return null;

    const targetDelta=targetEnergy(toSection)-targetEnergy(fromSection);
    const actualDelta=toActual-fromActual;
    const error=Math.abs(actualDelta-targetDelta);
    return {
      score:clamp01(1-error/.35),
      targetDelta,
      actualDelta,
      error
    };
  }

  function weightedScore(parts=[]){
    const usable=parts.filter(row=>row&&Number.isFinite(Number(row.score))&&finite(row.weight)>0);
    if(!usable.length)return null;
    const weight=usable.reduce((sum,row)=>sum+row.weight,0);
    return clamp01(usable.reduce((sum,row)=>sum+clamp01(row.score)*row.weight,0)/weight);
  }

  function assessTransition(fromSection={},toSection={},fromCandidate=null,toCandidate=null){
    const energy=energyDeltaFit(fromSection,toSection,fromCandidate,toCandidate);
    const boundary=boundarySupport(toCandidate);
    const transition=transitionSupport(toCandidate);
    const fromSource=sourceKey(fromCandidate);
    const toSource=sourceKey(toCandidate);
    const sourceSwitch=Boolean(fromSource&&toSource&&fromSource!==toSource);

    const score=weightedScore([
      energy&&{score:energy.score,weight:.55},
      boundary!=null&&{score:boundary,weight:.20},
      transition!=null&&{score:transition,weight:.25}
    ]);

    let adjusted=score;
    const reasons=[];

    if(energy&&energy.score<.62)reasons.push('energy-jump-mismatch');
    if(boundary!=null&&boundary<.55)reasons.push('weak-boundary');
    if(transition!=null&&transition<.55)reasons.push('weak-transition-entry');

    if(sourceSwitch){
      const handoffEvidence=[boundary,transition].filter(value=>value!=null);
      if(!handoffEvidence.length){
        reasons.push('source-switch-unverified');
        if(adjusted!=null)adjusted=Math.min(adjusted,.68);
      }else if(Math.max(...handoffEvidence)<.58){
        reasons.push('source-switch-weak-handoff');
        if(adjusted!=null)adjusted=Math.min(adjusted,.58);
      }
    }

    return {
      fromSectionId:fromSection.id||null,
      toSectionId:toSection.id||null,
      fromSectionType:fromSection.type||'other',
      toSectionType:toSection.type||'other',
      score:adjusted,
      energyDelta:energy,
      boundarySupport:boundary,
      transitionSupport:transition,
      sourceSwitch,
      fromSource,
      toSource,
      reasons,
      measured:Boolean(energy||boundary!=null||transition!=null),
      nonDestructive:true
    };
  }

  function assessTransitionFlow(cheerPlan={},matchPlan={}){
    const sections=Array.isArray(cheerPlan.sections)?cheerPlan.sections:[];
    const selected=selectedCandidateBySection(matchPlan);
    const rows=[];

    for(let index=1;index<sections.length;index++){
      const fromSection=sections[index-1]||{};
      const toSection=sections[index]||{};
      rows.push(assessTransition(
        fromSection,
        toSection,
        selected.get(String(fromSection.id))||null,
        selected.get(String(toSection.id))||null
      ));
    }

    const measured=rows.filter(row=>row.score!=null);
    if(!measured.length){
      return {
        score:.5,
        coverage:0,
        weakest:null,
        rows,
        risks:[],
        reason:'transition-data-unavailable',
        nonDestructive:true
      };
    }

    const average=measured.reduce((sum,row)=>sum+row.score,0)/measured.length;
    const weakest=measured.reduce((min,row)=>!min||row.score<min.score?row:min,null);
    const risks=[];
    if(measured.length<rows.length)risks.push('transition-coverage-low');
    if(weakest?.score<.58)risks.push('weak-section-transition');

    return {
      score:clamp01(average),
      coverage:clamp01(measured.length/Math.max(1,rows.length)),
      weakest,
      rows,
      risks,
      reason:null,
      nonDestructive:true
    };
  }

  const api={
    ENERGY_TARGETS,
    targetEnergy,
    selectedCandidateBySection,
    actualEnergy,
    sourceKey,
    boundarySupport,
    transitionSupport,
    energyDeltaFit,
    weightedScore,
    assessTransition,
    assessTransitionFlow
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixTransitionFlowQualityCore=api;
})();