(()=>{
  'use strict';

  function requireStructure(){
    if(typeof module!=='undefined'&&module.exports)return require('./cheer-structure-core.js');
    if(typeof window!=='undefined'&&window.CheerStructureCore)return window.CheerStructureCore;
    throw new Error('CheerStructureCore is required before CheerPlanCore.');
  }

  const structure=requireStructure();
  const ENERGY_TARGETS=Object.freeze({low:.15,medium:.42,high:.70,peak:.93});

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp01(value){return Math.max(0,Math.min(1,finiteNumber(value)));}

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

  function indexAudioProfile(audioProfile=[]){
    const byEight=new Map();
    for(const row of audioProfile){
      const eight=Math.round(finiteNumber(row?.eight));
      if(eight<1)continue;
      byEight.set(eight,row);
    }
    return byEight;
  }

  function audioTransitionCandidates(audioProfile=[],{breakThreshold=.22,dropThreshold=.22}={}){
    const sorted=[...indexAudioProfile(audioProfile).values()].sort((a,b)=>a.eight-b.eight);
    const candidates=[];
    for(let i=1;i<sorted.length;i++){
      const previous=sorted[i-1],current=sorted[i];
      if(current.eight!==previous.eight+1)continue;
      const delta=finiteNumber(current.energyScore)-finiteNumber(previous.energyScore);
      let type=null;
      if(delta<=-Math.max(.05,finiteNumber(breakThreshold,.22)))type='break';
      else if(delta>=Math.max(.05,finiteNumber(dropThreshold,.22)))type='drop';
      if(!type)continue;
      candidates.push({
        type,
        atEight:current.eight,
        time:finiteNumber(current.start),
        confidence:clamp01(.55+Math.abs(delta)*.7),
        reason:type==='break'?'audio-energy-drop':'audio-energy-rise',
        energyDelta:delta,
        source:'audio'
      });
    }
    return candidates;
  }

  function energyAlignment(plannedEnergy,audioRow){
    if(!audioRow||!Object.prototype.hasOwnProperty.call(ENERGY_TARGETS,plannedEnergy))return null;
    const target=ENERGY_TARGETS[plannedEnergy];
    const actual=clamp01(audioRow.energyScore);
    const delta=actual-target;
    const distance=Math.abs(delta);
    let status='match';
    if(distance>.32)status=delta>0?'much-higher':'much-lower';
    else if(distance>.18)status=delta>0?'higher':'lower';
    return {
      targetScore:target,
      actualScore:actual,
      delta,
      distance,
      score:clamp01(1-distance),
      status,
      actualEnergy:audioRow.energy||null
    };
  }

  function summarizeAlignment(timeline=[]){
    const rows=timeline.filter(row=>row.energyAlignment);
    if(!rows.length)return {measuredEights:0,matchEights:0,alignmentRate:null,averageScore:null,mismatches:[]};
    const matching=rows.filter(row=>row.energyAlignment.status==='match');
    const average=rows.reduce((sum,row)=>sum+row.energyAlignment.score,0)/rows.length;
    return {
      measuredEights:rows.length,
      matchEights:matching.length,
      alignmentRate:matching.length/rows.length,
      averageScore:average,
      mismatches:rows
        .filter(row=>row.energyAlignment.status!=='match')
        .map(row=>({
          eight:row.eight,
          sectionId:row.sectionId,
          sectionType:row.sectionType,
          plannedEnergy:row.energy,
          actualEnergy:row.energyAlignment.actualEnergy,
          status:row.energyAlignment.status,
          delta:row.energyAlignment.delta
        }))
    };
  }

  function buildCheerPlan({bpm,oneOffset=0,totalEights=0,sections=[],phraseEights=4,minEnergyStrength=1,audioProfile=[],audioBreakThreshold=.22,audioDropThreshold=.22}={}){
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
    const structuralCandidates=structure.detectTransitionCandidates(eights,{minEnergyStrength}).map(candidate=>({...candidate,source:'structure'}));
    const audioCandidates=audioTransitionCandidates(audioProfile,{breakThreshold:audioBreakThreshold,dropThreshold:audioDropThreshold});
    const transitionCandidates=[...structuralCandidates,...audioCandidates];
    const transitionsByEight=groupCandidates(transitionCandidates);
    const audioByEight=indexAudioProfile(audioProfile);

    const phraseByEight=new Map();
    for(const phrase of phrases){
      for(let eight=phrase.startEight;eight<=phrase.endEight;eight++)phraseByEight.set(eight,phrase);
    }

    const sectionById=new Map(normalizedSections.map(section=>[section.id,section]));
    const timeline=eights.map(row=>{
      const section=sectionById.get(row.sectionId)||null;
      const phrase=phraseByEight.get(row.eight)||null;
      const audio=audioByEight.get(row.eight)||null;
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
        audioEnergy:audio?{
          score:clamp01(audio.energyScore),
          energy:audio.energy||null,
          rms:finiteNumber(audio.rms),
          peak:finiteNumber(audio.peak),
          crestDb:finiteNumber(audio.crestDb),
          activity:finiteNumber(audio.activity),
          delta:finiteNumber(audio.energyDelta)
        }:null,
        energyAlignment:energyAlignment(row.energy,audio),
        transition:primary?{
          type:primary.type,
          confidence:primary.confidence,
          reason:primary.reason,
          energyDelta:primary.energyDelta,
          source:primary.source||'structure'
        }:null,
        transitionCandidates:candidates
      };
    });

    const sectionSummaries=normalizedSections.map(section=>{
      const rows=timeline.filter(row=>row.sectionId===section.id);
      const sectionCandidates=transitionCandidates.filter(candidate=>candidate.atEight===section.startEight);
      const measured=rows.filter(row=>row.energyAlignment);
      return {
        ...section,
        durationEights:section.endEight-section.startEight+1,
        start:rows[0]?.start??null,
        end:rows[rows.length-1]?.end??null,
        entryTransition:strongestCandidate(sectionCandidates),
        phraseCount:new Set(rows.map(row=>row.phrase).filter(Boolean)).size,
        audioAlignmentScore:measured.length?measured.reduce((sum,row)=>sum+row.energyAlignment.score,0)/measured.length:null
      };
    });

    return {
      version:2,
      bpm:Number(bpm),
      oneOffset:Math.max(0,finiteNumber(oneOffset)),
      totalEights:count,
      eightSeconds:structure.eightCountSeconds(bpm),
      sections:sectionSummaries,
      phrases,
      energyEvents,
      structuralTransitionCandidates:structuralCandidates,
      audioTransitionCandidates:audioCandidates,
      transitionCandidates,
      audioAlignment:summarizeAlignment(timeline),
      timeline
    };
  }

  const api={ENERGY_TARGETS,inferTotalEights,groupCandidates,strongestCandidate,indexAudioProfile,audioTransitionCandidates,energyAlignment,summarizeAlignment,buildCheerPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerPlanCore=api;
})();
