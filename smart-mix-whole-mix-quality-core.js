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

  const HIGH_IMPACT_TYPES=new Set(['stunt','basket','pyramid','ending']);

  function targetEnergy(section={}){
    const key=String(section.energy||'medium').toLowerCase();
    return ENERGY_TARGETS[key]??ENERGY_TARGETS.medium;
  }

  function selectedCandidateBySection(matchPlan={}){
    const map=new Map();
    for(const match of Array.isArray(matchPlan.matches)?matchPlan.matches:[]){
      if(match?.sectionId)map.set(String(match.sectionId),match.best||match.candidates?.[0]||null);
    }
    return map;
  }

  function actualEnergy(candidate={}){
    const value=candidate?.features?.averageEnergy;
    return Number.isFinite(Number(value))?clamp01(value):null;
  }

  function energyArcQuality(cheerPlan={},matchPlan={}){
    const sections=Array.isArray(cheerPlan.sections)?cheerPlan.sections:[];
    const selected=selectedCandidateBySection(matchPlan);
    const rows=sections.map(section=>{
      const candidate=selected.get(String(section.id))||null;
      const actual=actualEnergy(candidate);
      const target=targetEnergy(section);
      return {
        sectionId:section.id||null,
        sectionType:section.type||'other',
        targetEnergy:target,
        actualEnergy:actual,
        fit:actual==null?null:clamp01(1-Math.abs(actual-target))
      };
    });

    const measured=rows.filter(row=>row.fit!=null);
    if(!measured.length){
      return {score:.5,coverage:0,range:0,rows,reason:'energy-data-unavailable'};
    }

    const fitAverage=measured.reduce((sum,row)=>sum+row.fit,0)/measured.length;
    const values=measured.map(row=>row.actualEnergy);
    const range=Math.max(...values)-Math.min(...values);
    const targetValues=measured.map(row=>row.targetEnergy);
    const targetRange=Math.max(...targetValues)-Math.min(...targetValues);
    const contrastNeed=targetRange>=.18;
    const contrastScore=!contrastNeed?1:clamp01(range/.22);
    const score=clamp01(fitAverage*.78+contrastScore*.22);

    return {
      score,
      coverage:clamp01(measured.length/Math.max(1,sections.length)),
      range:clamp01(range),
      targetRange:clamp01(targetRange),
      fitAverage:clamp01(fitAverage),
      contrastScore,
      rows,
      reason:null
    };
  }

  function sourceVarietyQuality(sequence=[],availableSources=null){
    const rows=Array.isArray(sequence)?sequence:[];
    if(!rows.length)return {score:.5,uniqueSources:0,switches:0,maxRun:0,reason:'sequence-unavailable'};

    const keys=rows.map(row=>String(row?.trackId||row?.sourceName||'unknown'));
    const uniqueSources=new Set(keys.filter(key=>key!=='unknown')).size;
    let switches=0,maxRun=1,run=1;
    for(let i=1;i<keys.length;i++){
      if(keys[i]!==keys[i-1]){switches++;run=1;}
      else{run++;maxRun=Math.max(maxRun,run);}
    }

    const possible=Math.max(1,Math.min(
      rows.length,
      Math.max(uniqueSources,Math.floor(finite(availableSources,uniqueSources)))
    ));
    const diversity=possible<=1?1:clamp01((uniqueSources-1)/(possible-1));
    const switchRate=rows.length<=1?1:clamp01(switches/(rows.length-1));
    const switchBalance=rows.length<4?1:clamp01(1-Math.abs(switchRate-.45)/.45);
    const runPenalty=maxRun<=2?1:maxRun===3?.72:maxRun===4?.42:.18;
    const score=clamp01(diversity*.35+switchBalance*.25+runPenalty*.40);

    return {score,uniqueSources,switches,maxRun,diversity,switchRate,switchBalance,runPenalty,reason:null};
  }

  function structureQuality(cheerPlan={},matchPlan={}){
    const sections=Array.isArray(cheerPlan.sections)?cheerPlan.sections:[];
    if(!sections.length)return {score:.5,reasons:['section-plan-unavailable']};

    const selected=selectedCandidateBySection(matchPlan);
    const reasons=[];
    let score=1;

    const introIndexes=sections.map((s,i)=>String(s.type)==='intro'?i:-1).filter(i=>i>=0);
    const endingIndexes=sections.map((s,i)=>String(s.type)==='ending'?i:-1).filter(i=>i>=0);

    if(introIndexes.some(i=>i>0)){score-=.15;reasons.push('intro-inside-routine');}
    if(endingIndexes.length&&endingIndexes.some(i=>i!==sections.length-1)){score-=.22;reasons.push('ending-not-last');}

    const ending=endingIndexes.length?sections[endingIndexes[endingIndexes.length-1]]:null;
    if(ending){
      const candidate=selected.get(String(ending.id))||null;
      const energy=actualEnergy(candidate);
      if(energy!=null&&energy<.72){score-=.20;reasons.push('weak-ending-energy');}
    }

    const impactIndexes=sections.map((s,i)=>HIGH_IMPACT_TYPES.has(String(s.type))?i:-1).filter(i=>i>=0);
    if(sections.length>=5&&impactIndexes.length>=3){
      let longest=1,run=1;
      for(let i=1;i<impactIndexes.length;i++){
        if(impactIndexes[i]===impactIndexes[i-1]+1){run++;longest=Math.max(longest,run);}
        else run=1;
      }
      if(longest>=4){score-=.12;reasons.push('impact-sections-clustered');}
    }

    return {score:clamp01(score),reasons,endingSectionId:ending?.id||null};
  }

  function matchCoherence(matchPlan={}){
    const matches=Array.isArray(matchPlan.matches)?matchPlan.matches:[];
    const scores=matches.map(row=>finite(row?.best?.score,NaN)).filter(Number.isFinite).map(clamp01);
    if(!scores.length)return {score:.5,average:null,weakest:null};
    const average=scores.reduce((sum,value)=>sum+value,0)/scores.length;
    return {score:clamp01(average),average:clamp01(average),weakest:Math.min(...scores)};
  }

  function qualityRating(score){
    const value=clamp01(score);
    if(value>=.86)return 'strong';
    if(value>=.74)return 'good';
    if(value>=.60)return 'review';
    return 'weak';
  }

  function assessProposalQuality(proposal={},cheerPlan={},matchPlan={},options={}){
    const energy=energyArcQuality(cheerPlan,matchPlan);
    const variety=sourceVarietyQuality(proposal.sequence,options.availableSources);
    const structure=structureQuality(cheerPlan,matchPlan);
    const matches=matchCoherence(matchPlan);

    const score=clamp01(
      energy.score*.42+
      variety.score*.23+
      structure.score*.23+
      matches.score*.12
    );

    const risks=[];
    if(energy.coverage<.75)risks.push('energy-coverage-low');
    if(energy.targetRange>=.18&&energy.range<.10)risks.push('flat-energy-arc');
    if(variety.maxRun>=4&&variety.uniqueSources>1)risks.push('source-overuse');
    if(structure.reasons.includes('ending-not-last'))risks.push('ending-not-last');
    if(structure.reasons.includes('weak-ending-energy'))risks.push('weak-ending-energy');
    if(matches.average!=null&&matches.average<.62)risks.push('match-coherence-low');

    return {
      score,
      rating:qualityRating(score),
      components:{
        energyArc:energy,
        sourceVariety:variety,
        structure,
        matchCoherence:matches
      },
      risks,
      readyForFxReview:score>=.74&&!risks.includes('ending-not-last')&&!risks.includes('flat-energy-arc'),
      nonDestructive:true
    };
  }

  function attachProposalQuality(proposal={},cheerPlan={},matchPlan={},options={}){
    return {
      ...proposal,
      smartMixWholeMixQuality:assessProposalQuality(proposal,cheerPlan,matchPlan,options)
    };
  }

  const api={
    ENERGY_TARGETS,
    targetEnergy,
    selectedCandidateBySection,
    energyArcQuality,
    sourceVarietyQuality,
    structureQuality,
    matchCoherence,
    qualityRating,
    assessProposalQuality,
    attachProposalQuality
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixWholeMixQualityCore=api;
})();
