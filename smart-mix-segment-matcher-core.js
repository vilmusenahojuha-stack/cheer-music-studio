(()=>{
  'use strict';

  const ENERGY_TARGETS=Object.freeze({low:.15,medium:.42,high:.70,peak:.93});
  const SECTION_WEIGHTS=Object.freeze({
    intro:{energy:.28,trend:.12,transition:.20,activity:.12,crest:.08,continuity:.20},
    stunt:{energy:.30,trend:.10,transition:.25,activity:.15,crest:.10,continuity:.10},
    tumbling:{energy:.32,trend:.12,transition:.15,activity:.18,crest:.08,continuity:.15},
    pyramid:{energy:.28,trend:.12,transition:.22,activity:.12,crest:.10,continuity:.16},
    dance:{energy:.30,trend:.16,transition:.12,activity:.20,crest:.06,continuity:.16},
    transition:{energy:.24,trend:.16,transition:.26,activity:.08,crest:.06,continuity:.20},
    ending:{energy:.30,trend:.10,transition:.28,activity:.12,crest:.10,continuity:.10},
    other:{energy:.30,trend:.14,transition:.18,activity:.14,crest:.08,continuity:.16}
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}
  function average(values=[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
  function sourceKey(row={}){return row.trackId?`id:${row.trackId}`:row.sourceName?`name:${row.sourceName}`:'unknown';}

  function normalizeProfile(profile=[]){
    return profile
      .map((row,index)=>({
        eight:Math.max(1,Math.round(finite(row?.eight,index+1))),
        start:finite(row?.start),
        end:finite(row?.end),
        sourceName:row?.sourceName==null?null:String(row.sourceName),
        trackId:row?.trackId==null?null:String(row.trackId),
        energyScore:clamp01(row?.energyScore),
        activity:clamp01(row?.activity),
        crestDb:finite(row?.crestDb),
        energyDelta:finite(row?.energyDelta)
      }))
      .sort((a,b)=>sourceKey(a).localeCompare(sourceKey(b))||a.eight-b.eight||a.start-b.start);
  }

  function targetTrend(section){
    const trend=String(section?.energyTrend||section?.phraseEnergyTrend||'steady');
    return ['rising','falling','steady'].includes(trend)?trend:'steady';
  }

  function classifyEntryTransition(rows=[]){
    if(!rows.length)return {type:'none',strength:0,delta:0};
    const delta=finite(rows[0]?.energyDelta);
    const strength=clamp01(Math.abs(delta)/.5);
    if(delta>=.22)return {type:'drop',strength,delta};
    if(delta<=-.22)return {type:'break',strength,delta};
    return {type:'none',strength,delta};
  }

  function transitionIntent(section={}){
    const type=SECTION_WEIGHTS[section?.type]?section.type:'other';
    if(['stunt','pyramid','ending'].includes(type))return 'drop';
    if(type==='transition')return 'break';
    return 'neutral';
  }

  function transitionIntentScore(section,entry){
    const intent=transitionIntent(section);
    if(intent==='neutral')return clamp01(.55+finite(entry?.strength)*.45);
    if(entry?.type===intent)return clamp01(.70+finite(entry?.strength)*.30);
    if(entry?.type==='none')return .45;
    return clamp01(.18*(1-finite(entry?.strength)*.5));
  }

  function segmentFeatures(rows=[]){
    if(!rows.length)return null;
    const energies=rows.map(r=>r.energyScore);
    const first=energies[0],last=energies[energies.length-1];
    const delta=last-first;
    const transition=Math.max(0,...rows.slice(1).map(r=>Math.abs(r.energyDelta)));
    const entryTransition=classifyEntryTransition(rows);
    const activity=average(rows.map(r=>r.activity));
    const crest=average(rows.map(r=>Math.max(0,Math.min(20,r.crestDb))/20));
    return {
      averageEnergy:average(energies),
      minEnergy:Math.min(...energies),
      maxEnergy:Math.max(...energies),
      energyDelta:delta,
      trend:delta>.12?'rising':delta<-.12?'falling':'steady',
      transitionStrength:clamp01(transition/.5),
      entryTransitionStrength:entryTransition.strength,
      entryTransitionType:entryTransition.type,
      entryTransitionDelta:entryTransition.delta,
      activity:clamp01(activity),
      crest:clamp01(crest),
      continuity:clamp01(1-Math.max(...rows.slice(1).map((r,i)=>Math.abs(r.energyScore-rows[i].energyScore)),0))
    };
  }

  function scoreSegment(section,rows=[]){
    const features=segmentFeatures(rows);
    if(!features)return null;
    const type=SECTION_WEIGHTS[section?.type]?section.type:'other';
    const weights=SECTION_WEIGHTS[type];
    const targetEnergy=ENERGY_TARGETS[section?.energy]??ENERGY_TARGETS.medium;
    const energy=clamp01(1-Math.abs(features.averageEnergy-targetEnergy));
    const wantedTrend=targetTrend(section);
    const trend=features.trend===wantedTrend?1:(wantedTrend==='steady'?.55:.35);
    const entryTransition={type:features.entryTransitionType,strength:features.entryTransitionStrength,delta:features.entryTransitionDelta};
    const transition=transitionIntentScore(section,entryTransition);
    const activityTarget=type==='dance'?.82:type==='tumbling'?.75:type==='intro'?.48:.62;
    const activity=clamp01(1-Math.abs(features.activity-activityTarget));
    const crestTarget=['stunt','pyramid','ending'].includes(type)?.72:.52;
    const crest=clamp01(1-Math.abs(features.crest-crestTarget));
    const continuity=features.continuity;
    const score=energy*weights.energy+trend*weights.trend+transition*weights.transition+activity*weights.activity+crest*weights.crest+continuity*weights.continuity;
    return {score:clamp01(score),features,components:{energy,trend,transition,activity,crest,continuity},transitionIntent:transitionIntent(section)};
  }

  function phraseBoundaryFit(startEight,endEight,{phraseEights=4}={}){
    const size=Math.max(1,Math.round(finite(phraseEights,4)));
    const startAligned=((Math.max(1,Math.round(finite(startEight,1)))-1)%size)===0;
    const endAligned=(Math.max(1,Math.round(finite(endEight,1)))%size)===0;
    return {
      phraseEights:size,
      startAligned,
      endAligned,
      aligned:startAligned&&endAligned,
      score:startAligned&&endAligned?1:(startAligned||endAligned?.55:.2)
    };
  }

  function applyPhraseBoundaryPreference(scoredCandidates=[],options={}){
    const phraseEights=Math.max(1,Math.round(finite(options.phraseEights,4)));
    const prefer=options.preferPhraseBoundaries!==false;
    return scoredCandidates.map(candidate=>{
      const phraseBoundary=phraseBoundaryFit(candidate.startEight,candidate.endEight,{phraseEights});
      const baseScore=clamp01(candidate.score);
      const multiplier=prefer?(.80+.20*phraseBoundary.score):1;
      return {
        ...candidate,
        baseScore,
        score:clamp01(baseScore*multiplier),
        phraseBoundary
      };
    });
  }

  function resolveStructuralBoundaryCore(explicitCore=null){
    if(explicitCore&&typeof explicitCore.structuralBoundaryFit==='function')return explicitCore;
    if(typeof window!=='undefined'&&window.SmartMixStructuralBoundaryCore&&typeof window.SmartMixStructuralBoundaryCore.structuralBoundaryFit==='function'){
      return window.SmartMixStructuralBoundaryCore;
    }
    if(typeof module!=='undefined'&&module.exports&&typeof require==='function'){
      try{
        const core=require('./smart-mix-structural-boundary-core.js');
        if(core&&typeof core.structuralBoundaryFit==='function')return core;
      }catch(_error){}
    }
    return null;
  }

  function applyStructuralBoundaryPreference(scoredCandidates=[],options={}){
    const phraseScored=applyPhraseBoundaryPreference(scoredCandidates,options);
    if(options.preferDetectedBoundaries===false)return phraseScored.map(candidate=>({
      ...candidate,
      boundarySource:'fixed-phrase',
      structuralBoundary:null
    }));

    const structuralCore=resolveStructuralBoundaryCore(options.structuralBoundaryCore);
    if(!structuralCore)return phraseScored.map(candidate=>({
      ...candidate,
      boundarySource:'fixed-phrase',
      structuralBoundary:null
    }));

    return phraseScored.map(candidate=>{
      const structuralBoundary=structuralCore.structuralBoundaryFit(candidate,{
        phrases:options.phrases,
        sections:options.sections,
        minConfidence:options.minBoundaryConfidence
      });
      if(structuralBoundary?.source!=='detected'||!Number.isFinite(Number(structuralBoundary.score))){
        return {...candidate,boundarySource:'fixed-phrase',structuralBoundary};
      }
      const baseScore=clamp01(candidate.baseScore);
      const multiplier=.80+.20*clamp01(structuralBoundary.score);
      return {
        ...candidate,
        score:clamp01(baseScore*multiplier),
        boundarySource:'detected',
        structuralBoundary
      };
    });
  }

  function candidateSegments(profile=[],durationEights=1){
    const rows=normalizeProfile(profile);
    const duration=Math.max(1,Math.floor(finite(durationEights,1)));
    const out=[];
    for(let i=0;i+duration<=rows.length;i++){
      const slice=rows.slice(i,i+duration);
      const key=sourceKey(slice[0]);
      let contiguous=key!=='unknown';
      for(let j=1;j<slice.length;j++){
        if(sourceKey(slice[j])!==key||slice[j].eight!==slice[j-1].eight+1){contiguous=false;break;}
      }
      if(!contiguous)continue;
      out.push({
        sourceName:slice[0].sourceName,
        trackId:slice[0].trackId,
        startEight:slice[0].eight,
        endEight:slice[slice.length-1].eight,
        start:slice[0].start,
        end:slice[slice.length-1].end,
        rows:slice
      });
    }
    return out;
  }

  function rangeKey(range={}){return range.trackId?`id:${range.trackId}`:range.sourceName?`name:${range.sourceName}`:null;}

  function rankSegments(section,profile=[],{
    limit=5,
    minScore=0,
    excludeRanges=[],
    phraseEights=4,
    preferPhraseBoundaries=true,
    preferDetectedBoundaries=true,
    phrases=[],
    sections=[],
    minBoundaryConfidence=.72,
    structuralBoundaryCore=null
  }={}){
    const duration=Math.max(1,Math.floor(finite(section?.durationEights,finite(section?.endEight)-finite(section?.startEight)+1)));
    const overlapsExcluded=(candidate)=>excludeRanges.some(range=>{
      const rk=rangeKey(range),ck=rangeKey(candidate);
      if(rk&&ck&&rk!==ck)return false;
      return candidate.startEight<=finite(range?.endEight)&&candidate.endEight>=finite(range?.startEight);
    });
    const scored=candidateSegments(profile,duration)
      .filter(candidate=>!overlapsExcluded(candidate))
      .map(candidate=>({...candidate,...scoreSegment(section,candidate.rows)}));
    return applyStructuralBoundaryPreference(scored,{
      phraseEights,
      preferPhraseBoundaries,
      preferDetectedBoundaries,
      phrases,
      sections,
      minBoundaryConfidence,
      structuralBoundaryCore
    })
      .filter(candidate=>candidate.score>=clamp01(minScore))
      .sort((a,b)=>b.score-a.score
        ||finite(b.structuralBoundary?.score,-1)-finite(a.structuralBoundary?.score,-1)
        ||b.phraseBoundary.score-a.phraseBoundary.score
        ||String(a.sourceName||'').localeCompare(String(b.sourceName||''))
        ||a.startEight-b.startEight)
      .slice(0,Math.max(1,Math.floor(finite(limit,5))))
      .map(({rows,...candidate})=>candidate);
  }

  function matchPlanSections(sections=[],profile=[],{
    limitPerSection=3,
    minScore=.45,
    avoidReuse=true,
    phraseEights=4,
    preferPhraseBoundaries=true,
    preferDetectedBoundaries=true,
    phrases=[],
    detectedSections=[],
    minBoundaryConfidence=.72,
    structuralBoundaryCore=null
  }={}){
    const matches=[];
    const used=[];
    for(const section of sections){
      const candidates=rankSegments(section,profile,{
        limit:limitPerSection,
        minScore,
        excludeRanges:avoidReuse?used:[],
        phraseEights,
        preferPhraseBoundaries,
        preferDetectedBoundaries,
        phrases,
        sections:detectedSections,
        minBoundaryConfidence,
        structuralBoundaryCore
      });
      const best=candidates[0]||null;
      if(best&&avoidReuse)used.push({sourceName:best.sourceName,trackId:best.trackId,startEight:best.startEight,endEight:best.endEight});
      matches.push({sectionId:section?.id||null,sectionType:section?.type||'other',durationEights:section?.durationEights||null,best,candidates});
    }
    const matched=matches.filter(m=>m.best);
    return {
      matches,
      matchedSections:matched.length,
      totalSections:matches.length,
      coverage:matches.length?matched.length/matches.length:1,
      averageScore:matched.length?average(matched.map(m=>m.best.score)):null,
      avoidReuse:Boolean(avoidReuse),
      phraseEights:Math.max(1,Math.round(finite(phraseEights,4))),
      preferPhraseBoundaries:preferPhraseBoundaries!==false,
      preferDetectedBoundaries:preferDetectedBoundaries!==false,
      minBoundaryConfidence:clamp01(minBoundaryConfidence),
      nonDestructive:true
    };
  }

  const api={
    ENERGY_TARGETS,SECTION_WEIGHTS,sourceKey,normalizeProfile,targetTrend,classifyEntryTransition,
    transitionIntent,transitionIntentScore,segmentFeatures,scoreSegment,phraseBoundaryFit,
    applyPhraseBoundaryPreference,resolveStructuralBoundaryCore,applyStructuralBoundaryPreference,
    candidateSegments,rankSegments,matchPlanSections
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixSegmentMatcherCore=api;
})();
