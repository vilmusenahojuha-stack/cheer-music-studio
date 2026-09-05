(()=>{
  'use strict';

  function requireStructure(){
    if(typeof module!=='undefined'&&module.exports)return require('./cheer-structure-core.js');
    if(typeof window!=='undefined'&&window.CheerStructureCore)return window.CheerStructureCore;
    throw new Error('CheerStructureCore is required before CheerPlanCore.');
  }

  const structure=requireStructure();

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function inferTotalEights(sections=[],fallback=0){
    let max=Math.max(0,Math.floor(finiteNumber(fallback)));
    for(const section of sections){
      const end=Math.floor(finiteNumber(section?.endEight));
      if(end>max)max=end;
    }
    return max;
  }

  function groupCandidates(candidates=[]){
    const byEight=new Map();
    for(const candidate of candidates){
      const eight=Number(candidate?.atEight);
      if(!Number.isFinite(eight))continue;
      if(!byEight.has(eight))byEight.set(eight,[]);
      byEight.get(eight).push(candidate);
    }
    return byEight;
  }

  function strongestCandidate(candidates=[]){
    if(!candidates.length)return null;
    const priority={break:3,drop:2,cut:1};
    return [...candidates].sort((a,b)=>(b.confidence||0)-(a.confidence||0)||(priority[b.type]||0)-(priority[a.type]||0))[0];
  }

  function buildCheerPlan({bpm,oneOffset=0,totalEights=0,sections=[],phraseEights=4,minEnergyStrength=1}={}){
    const validation=structure.validateSections(sections);
    if(!validation.ok){
      const error=new Error('Cheer sections overlap.');
      error.code='SECTION_OVERLAP';
      error.issues=validation.issues;
      throw error;
    }

    const normalizedSections=validation.sections;
    const count=inferTotalEights(normalizedSections,totalEights);
    const eights=structure.buildEightCountMap({bpm,oneOffset,totalEights:count,sections:normalizedSections});
    const phrases=structure.buildPhrases(eights,{phraseEights,splitOnSection:true});
    const energyEvents=structure.detectEnergyEvents(eights);
    const transitionCandidates=structure.detectTransitionCandidates(eights,{minEnergyStrength});
    const transitionsByEight=groupCandidates(transitionCandidates);

    const phraseByEight=new Map();
    for(const phrase of phrases){
      for(let eight=phrase.startEight;eight<=phrase.endEight;eight++)phraseByEight.set(eight,phrase);
    }

    const sectionById=new Map(normalizedSections.map(section=>[section.id,section]));
    const timeline=eights.map(row=>{
      const section=sectionById.get(row.sectionId)||null;
      const phrase=phraseByEight.get(row.eight)||null;
      const candidates=transitionsByEight.get(row.eight)||[];
      const primary=strongestCandidate(candidates);
      return {
        ...row,
        sectionLabel:section?.label||'',
        sectionStartEight:section?.startEight||null,
        sectionEndEight:section?.endEight||null,
        countInSection:section?row.eight-section.startEight+1:null,
        phrase:phrase?.phrase||null,
        phraseStartEight:phrase?.startEight||null,
        phraseEndEight:phrase?.endEight||null,
        phraseEnergyTrend:phrase?.energyTrend||'steady',
        transition:primary?{
          type:primary.type,
          confidence:primary.confidence,
          reason:primary.reason,
          energyDelta:primary.energyDelta
        }:null,
        transitionCandidates:candidates
      };
    });

    const sectionSummaries=normalizedSections.map(section=>{
      const rows=timeline.filter(row=>row.sectionId===section.id);
      const sectionCandidates=transitionCandidates.filter(candidate=>candidate.atEight===section.startEight);
      return {
        ...section,
        durationEights:section.endEight-section.startEight+1,
        start:rows[0]?.start??null,
        end:rows[rows.length-1]?.end??null,
        entryTransition:strongestCandidate(sectionCandidates),
        phraseCount:new Set(rows.map(row=>row.phrase).filter(Boolean)).size
      };
    });

    return {
      version:1,
      bpm:Number(bpm),
      oneOffset:Math.max(0,finiteNumber(oneOffset)),
      totalEights:count,
      eightSeconds:structure.eightCountSeconds(bpm),
      sections:sectionSummaries,
      phrases,
      energyEvents,
      transitionCandidates,
      timeline
    };
  }

  const api={inferTotalEights,groupCandidates,strongestCandidate,buildCheerPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerPlanCore=api;
})();
