(()=>{
  'use strict';

  function finite(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp01(value){
    return Math.max(0,Math.min(1,finite(value)));
  }

  const REASON_LABELS=Object.freeze({
    purpose:'sopii osuuden tarkoitukseen',
    boundary:'osuu luotettavaan fraasi- tai section-rajaan',
    transition:'sisääntulo tukee break/drop-rakennetta',
    energy:'energiataso sopii osuuteen',
    phrase:'osuu 8-count-fraasirajaan',
    continuity:'energia jatkuu hallitusti'
  });

  function reasonCandidates(section={},candidate={}){
    const reasons=[];

    if(candidate.sectionPurpose?.source==='detected' && Number.isFinite(Number(candidate.sectionPurpose?.score))){
      const reliability=clamp01(
        finite(candidate.sectionPurpose?.confidence,1) *
        finite(candidate.sectionPurpose?.coverage,1)
      );
      reasons.push({
        code:'purpose',
        label:REASON_LABELS.purpose,
        score:clamp01(candidate.sectionPurpose.score),
        reliability,
        detail:{
          purpose:candidate.sectionPurpose.purpose||null,
          compatibility:Number.isFinite(Number(candidate.sectionPurpose.compatibility))
            ? clamp01(candidate.sectionPurpose.compatibility)
            : null,
          sectionId:candidate.sectionPurpose.sectionId||null
        }
      });
    }

    if(candidate.boundarySource==='detected' && Number.isFinite(Number(candidate.structuralBoundary?.score))){
      const confidence=Number.isFinite(Number(candidate.structuralBoundary?.confidence))
        ? clamp01(candidate.structuralBoundary.confidence)
        : 1;
      reasons.push({
        code:'boundary',
        label:REASON_LABELS.boundary,
        score:clamp01(candidate.structuralBoundary.score),
        reliability:confidence,
        detail:{
          kind:candidate.structuralBoundary.kind||candidate.structuralBoundary.type||null,
          startAligned:Boolean(candidate.structuralBoundary.startAligned),
          endAligned:Boolean(candidate.structuralBoundary.endAligned)
        }
      });
    }

    const wanted=String(candidate.transitionIntent||'neutral');
    const actual=String(candidate.features?.entryTransitionType||'none');
    if(wanted!=='neutral'){
      const component=clamp01(candidate.components?.transition);
      const matched=actual===wanted;
      reasons.push({
        code:'transition',
        label:REASON_LABELS.transition,
        score:component,
        reliability:matched?clamp01(.65+finite(candidate.features?.entryTransitionStrength)*.35):.45,
        detail:{wanted,actual,matched}
      });
    }

    if(Number.isFinite(Number(candidate.components?.energy))){
      reasons.push({
        code:'energy',
        label:REASON_LABELS.energy,
        score:clamp01(candidate.components.energy),
        reliability:1,
        detail:{
          target:section.energy||null,
          averageEnergy:Number.isFinite(Number(candidate.features?.averageEnergy))
            ? clamp01(candidate.features.averageEnergy)
            : null
        }
      });
    }

    if(candidate.phraseBoundary){
      reasons.push({
        code:'phrase',
        label:REASON_LABELS.phrase,
        score:clamp01(candidate.phraseBoundary.score),
        reliability:candidate.boundarySource==='detected'?.65:1,
        detail:{
          phraseEights:candidate.phraseBoundary.phraseEights||null,
          startAligned:Boolean(candidate.phraseBoundary.startAligned),
          endAligned:Boolean(candidate.phraseBoundary.endAligned)
        }
      });
    }

    if(Number.isFinite(Number(candidate.components?.continuity))){
      reasons.push({
        code:'continuity',
        label:REASON_LABELS.continuity,
        score:clamp01(candidate.components.continuity),
        reliability:1,
        detail:{}
      });
    }

    return reasons
      .map(reason=>({...reason,weight:clamp01(reason.score*reason.reliability)}))
      .sort((a,b)=>b.weight-a.weight || b.score-a.score || a.code.localeCompare(b.code));
  }

  function summarizeCandidate(section={},candidate=null){
    if(!candidate)return null;
    const reasons=reasonCandidates(section,candidate);
    return {
      sourceName:candidate.sourceName||null,
      trackId:candidate.trackId||null,
      startEight:candidate.startEight??null,
      endEight:candidate.endEight??null,
      score:Number.isFinite(Number(candidate.score))?clamp01(candidate.score):null,
      primaryReason:reasons[0]||null,
      reasons:reasons.slice(0,3),
      nonDestructive:true
    };
  }

  function buildRunnerUpComparison(section={},candidate=null,runnerUp=null){
    if(!candidate||!runnerUp)return null;
    const selected=summarizeCandidate(section,candidate);
    const alternative=summarizeCandidate(section,runnerUp);
    const selectedScore=selected?.score;
    const alternativeScore=alternative?.score;
    return {
      selected,
      runnerUp:alternative,
      scoreMargin:Number.isFinite(selectedScore)&&Number.isFinite(alternativeScore)
        ? Math.max(0,selectedScore-alternativeScore)
        : null,
      sameSource:Boolean(
        selected?.trackId && alternative?.trackId
          ? selected.trackId===alternative.trackId
          : selected?.sourceName && alternative?.sourceName && selected.sourceName===alternative.sourceName
      ),
      nonDestructive:true
    };
  }

  function selectionConfidence(candidate={},runnerUp=null){
    const score=clamp01(candidate.score);
    const margin=runnerUp?Math.max(0,score-clamp01(runnerUp.score)):score;
    const evidence=reasonCandidates({},candidate);
    const evidenceStrength=evidence.length
      ? evidence.slice(0,3).reduce((sum,row)=>sum+row.weight,0)/Math.min(3,evidence.length)
      : score;
    return clamp01(score*.55+Math.min(1,margin*5)*.20+evidenceStrength*.25);
  }

  function explainCandidate(section={},candidate=null,{runnerUp=null,maxReasons=3}={}){
    if(!candidate){
      return {
        selected:false,
        confidence:0,
        score:null,
        margin:null,
        primaryReason:null,
        reasons:[],
        evidence:[],
        comparison:null,
        nonDestructive:true
      };
    }

    const reasons=reasonCandidates(section,candidate);
    const limit=Math.max(1,Math.floor(finite(maxReasons,3)));
    const score=clamp01(candidate.score);
    const margin=runnerUp?Math.max(0,score-clamp01(runnerUp.score)):null;

    return {
      selected:true,
      confidence:selectionConfidence(candidate,runnerUp),
      score,
      margin,
      primaryReason:reasons[0]||null,
      reasons:reasons.slice(0,limit),
      evidence:reasons,
      comparison:buildRunnerUpComparison(section,candidate,runnerUp),
      sourceName:candidate.sourceName||null,
      trackId:candidate.trackId||null,
      startEight:candidate.startEight??null,
      endEight:candidate.endEight??null,
      nonDestructive:true
    };
  }

  function explainMatch(match={}){
    const candidates=Array.isArray(match.candidates)?match.candidates:[];
    const best=match.best||candidates[0]||null;
    const runnerUp=candidates.find(candidate=>candidate!==best) || null;
    return {
      sectionId:match.sectionId||null,
      sectionType:match.sectionType||'other',
      explanation:explainCandidate(
        {id:match.sectionId||null,type:match.sectionType||'other',energy:match.energy||null},
        best,
        {runnerUp}
      ),
      nonDestructive:true
    };
  }

  function explainPlanMatches(plan={}){
    return {
      matches:(Array.isArray(plan.matches)?plan.matches:[]).map(explainMatch),
      matchedSections:finite(plan.matchedSections,0),
      totalSections:finite(plan.totalSections,Array.isArray(plan.matches)?plan.matches.length:0),
      nonDestructive:true
    };
  }

  function attachExplanationsToProposal(proposal={},matchPlan={}){
    const explanation=explainPlanMatches(matchPlan);
    return {
      ...proposal,
      smartMixSelectionExplanation:{
        ...explanation,
        source:'smart-mix-match-plan',
        nonDestructive:true
      }
    };
  }

  const api={
    REASON_LABELS,
    reasonCandidates,
    summarizeCandidate,
    buildRunnerUpComparison,
    selectionConfidence,
    explainCandidate,
    explainMatch,
    explainPlanMatches,
    attachExplanationsToProposal
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixSelectionExplanationCore=api;
})();