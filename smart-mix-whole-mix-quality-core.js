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

  function defaultTransitionFlowCore(){
    if(typeof module!=='undefined'&&module.exports){
      try{return require('./smart-mix-transition-flow-quality-core.js');}catch(_){return null;}
    }
    if(typeof window!=='undefined')return window.SmartMixTransitionFlowQualityCore||null;
    return null;
  }

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

  function selectedMatchBySection(matchPlan={}){
    const map=new Map();
    for(const match of Array.isArray(matchPlan.matches)?matchPlan.matches:[]){
      if(match?.sectionId)map.set(String(match.sectionId),match);
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

  function transitionFlowQuality(cheerPlan={},matchPlan={},options={}){
    const core=options.transitionFlowCore||defaultTransitionFlowCore();
    if(!core?.assessTransitionFlow)return null;
    try{
      const result=core.assessTransitionFlow(cheerPlan,matchPlan);
      return result&&typeof result==='object'?result:null;
    }catch(_){
      return null;
    }
  }

  function addReviewTarget(targets,target){
    const key=[
      target.kind||'section',
      target.sectionId||'',
      target.fromSectionId||'',
      target.toSectionId||'',
      target.reason||''
    ].join('|');
    const existing=targets.find(row=>row._key===key);
    if(existing){
      existing.severity=Math.max(existing.severity,clamp01(target.severity));
      return;
    }
    targets.push({...target,severity:clamp01(target.severity),_key:key});
  }

  function identifyReviewTargets(proposal={},cheerPlan={},matchPlan={},components={}){
    const sections=Array.isArray(cheerPlan.sections)?cheerPlan.sections:[];
    const matches=selectedMatchBySection(matchPlan);
    const energyRows=new Map(
      (Array.isArray(components?.energyArc?.rows)?components.energyArc.rows:[])
        .filter(row=>row?.sectionId)
        .map(row=>[String(row.sectionId),row])
    );
    const targets=[];

    for(let index=0;index<sections.length;index++){
      const section=sections[index]||{};
      const sectionId=section.id==null?null:String(section.id);
      if(!sectionId)continue;

      const energy=energyRows.get(sectionId);
      if(energy?.fit!=null&&energy.fit<.78){
        const mismatch=clamp01(1-energy.fit);
        addReviewTarget(targets,{
          kind:'section',
          sectionId,
          sectionType:section.type||'other',
          reason:'energy-mismatch',
          severity:clamp01(.48+mismatch*.52),
          evidence:{
            targetEnergy:energy.targetEnergy,
            actualEnergy:energy.actualEnergy,
            fit:energy.fit
          }
        });
      }

      const match=matches.get(sectionId);
      const matchScore=Number(match?.best?.score);
      if(Number.isFinite(matchScore)&&matchScore<.70){
        addReviewTarget(targets,{
          kind:'section',
          sectionId,
          sectionType:section.type||'other',
          reason:'weak-match',
          severity:clamp01(.52+(.70-clamp01(matchScore))*.9),
          evidence:{matchScore:clamp01(matchScore)}
        });
      }

      if(String(section.type)==='ending'){
        const actual=energy?.actualEnergy;
        if(actual!=null&&actual<.72){
          addReviewTarget(targets,{
            kind:'section',
            sectionId,
            sectionType:'ending',
            reason:'weak-ending-energy',
            severity:clamp01(.72+(.72-actual)),
            evidence:{
              actualEnergy:actual,
              minimumRecommended:.72
            }
          });
        }
        if(index!==sections.length-1){
          addReviewTarget(targets,{
            kind:'section',
            sectionId,
            sectionType:'ending',
            reason:'ending-not-last',
            severity:1,
            evidence:{sectionIndex:index,lastIndex:sections.length-1}
          });
        }
      }
    }

    const sequence=Array.isArray(proposal.sequence)?proposal.sequence:[];
    let runStart=0;
    for(let index=1;index<=sequence.length;index++){
      const prev=sequence[index-1];
      const current=sequence[index];
      const prevKey=String(prev?.trackId||prev?.sourceName||'unknown');
      const currentKey=String(current?.trackId||current?.sourceName||'unknown');
      const ended=index===sequence.length||currentKey!==prevKey;
      if(!ended)continue;
      const runLength=index-runStart;
      if(runLength>=4&&prevKey!=='unknown'){
        for(let cursor=runStart+1;cursor<index;cursor++){
          addReviewTarget(targets,{
            kind:'transition',
            fromSectionId:sequence[cursor-1]?.sectionId||null,
            toSectionId:sequence[cursor]?.sectionId||null,
            reason:'source-overuse',
            severity:clamp01(.58+(runLength-4)*.09),
            evidence:{sourceKey:prevKey,runLength}
          });
        }
      }
      runStart=index;
    }

    const transitionRows=Array.isArray(components?.transitionFlow?.rows)?components.transitionFlow.rows:[];
    for(const row of transitionRows){
      if(row?.score==null||row.score>=.68)continue;
      const gap=clamp01((.68-clamp01(row.score))/.68);
      addReviewTarget(targets,{
        kind:'transition',
        fromSectionId:row.fromSectionId||null,
        toSectionId:row.toSectionId||null,
        reason:'weak-section-transition',
        severity:clamp01(.62+gap*.34),
        evidence:{
          score:clamp01(row.score),
          energyDelta:row.energyDelta||null,
          boundarySupport:row.boundarySupport??null,
          transitionSupport:row.transitionSupport??null,
          sourceSwitch:row.sourceSwitch===true,
          fromSource:row.fromSource||null,
          toSource:row.toSource||null,
          reasons:Array.isArray(row.reasons)?row.reasons:[]
        }
      });
    }

    if(components?.energyArc?.targetRange>=.18&&components?.energyArc?.range<.10){
      const candidates=[...energyRows.values()]
        .filter(row=>row.actualEnergy!=null)
        .sort((a,b)=>(a.fit??1)-(b.fit??1))
        .slice(0,Math.min(2,energyRows.size));
      for(const row of candidates){
        addReviewTarget(targets,{
          kind:'section',
          sectionId:String(row.sectionId),
          sectionType:row.sectionType||'other',
          reason:'flat-energy-arc',
          severity:.74,
          evidence:{
            actualEnergy:row.actualEnergy,
            targetEnergy:row.targetEnergy,
            fit:row.fit
          }
        });
      }
    }

    return targets
      .sort((a,b)=>b.severity-a.severity || String(a.sectionId||a.toSectionId||'').localeCompare(String(b.sectionId||b.toSectionId||'')))
      .map(({_key,...target})=>target);
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
    const transitionFlow=transitionFlowQuality(cheerPlan,matchPlan,options);

    const legacyScore=clamp01(
      energy.score*.42+
      variety.score*.23+
      structure.score*.23+
      matches.score*.12
    );
    const score=transitionFlow?.score==null
      ?legacyScore
      :clamp01(legacyScore*.82+clamp01(transitionFlow.score)*.18);

    const risks=[];
    if(energy.coverage<.75)risks.push('energy-coverage-low');
    if(energy.targetRange>=.18&&energy.range<.10)risks.push('flat-energy-arc');
    if(variety.maxRun>=4&&variety.uniqueSources>1)risks.push('source-overuse');
    if(structure.reasons.includes('ending-not-last'))risks.push('ending-not-last');
    if(structure.reasons.includes('weak-ending-energy'))risks.push('weak-ending-energy');
    if(matches.average!=null&&matches.average<.62)risks.push('match-coherence-low');
    for(const risk of Array.isArray(transitionFlow?.risks)?transitionFlow.risks:[]){
      if(!risks.includes(risk))risks.push(risk);
    }

    const components={
      energyArc:energy,
      sourceVariety:variety,
      structure,
      matchCoherence:matches,
      transitionFlow
    };
    const reviewTargets=identifyReviewTargets(proposal,cheerPlan,matchPlan,components);

    return {
      score,
      rating:qualityRating(score),
      components,
      risks,
      reviewTargets,
      readyForFxReview:
        score>=.74&&
        !risks.includes('ending-not-last')&&
        !risks.includes('flat-energy-arc')&&
        !risks.includes('weak-section-transition'),
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
    defaultTransitionFlowCore,
    targetEnergy,
    selectedCandidateBySection,
    selectedMatchBySection,
    energyArcQuality,
    sourceVarietyQuality,
    structureQuality,
    matchCoherence,
    transitionFlowQuality,
    identifyReviewTargets,
    qualityRating,
    assessProposalQuality,
    attachProposalQuality
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixWholeMixQualityCore=api;
})();
