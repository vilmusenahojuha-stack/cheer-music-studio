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

  function normalizeProfile(profile=[]){
    return profile
      .map((row,index)=>({
        eight:Math.max(1,Math.round(finite(row?.eight,index+1))),
        start:finite(row?.start),
        end:finite(row?.end),
        energyScore:clamp01(row?.energyScore),
        activity:clamp01(row?.activity),
        crestDb:finite(row?.crestDb),
        energyDelta:finite(row?.energyDelta)
      }))
      .sort((a,b)=>a.eight-b.eight);
  }

  function targetTrend(section){
    const trend=String(section?.energyTrend||section?.phraseEnergyTrend||'steady');
    return ['rising','falling','steady'].includes(trend)?trend:'steady';
  }

  function segmentFeatures(rows=[]){
    if(!rows.length)return null;
    const energies=rows.map(r=>r.energyScore);
    const first=energies[0],last=energies[energies.length-1];
    const delta=last-first;
    const transition=Math.max(0,...rows.slice(1).map(r=>Math.abs(r.energyDelta)));
    const entryTransition=Math.abs(finite(rows[0]?.energyDelta));
    const activity=average(rows.map(r=>r.activity));
    const crest=average(rows.map(r=>Math.max(0,Math.min(20,r.crestDb))/20));
    return {
      averageEnergy:average(energies),
      minEnergy:Math.min(...energies),
      maxEnergy:Math.max(...energies),
      energyDelta:delta,
      trend:delta>.12?'rising':delta<-.12?'falling':'steady',
      transitionStrength:clamp01(transition/.5),
      entryTransitionStrength:clamp01(entryTransition/.5),
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
    const highImpact=['stunt','pyramid','ending'].includes(type);
    const transition=highImpact?features.entryTransitionStrength:clamp01(.55+features.transitionStrength*.45);
    const activityTarget=type==='dance'?.82:type==='tumbling'?.75:type==='intro'?.48:.62;
    const activity=clamp01(1-Math.abs(features.activity-activityTarget));
    const crestTarget=highImpact?.72:.52;
    const crest=clamp01(1-Math.abs(features.crest-crestTarget));
    const continuity=features.continuity;
    const score=energy*weights.energy+trend*weights.trend+transition*weights.transition+activity*weights.activity+crest*weights.crest+continuity*weights.continuity;
    return {score:clamp01(score),features,components:{energy,trend,transition,activity,crest,continuity}};
  }

  function candidateSegments(profile=[],durationEights=1){
    const rows=normalizeProfile(profile);
    const duration=Math.max(1,Math.floor(finite(durationEights,1)));
    const out=[];
    for(let i=0;i+duration<=rows.length;i++){
      const slice=rows.slice(i,i+duration);
      let contiguous=true;
      for(let j=1;j<slice.length;j++)if(slice[j].eight!==slice[j-1].eight+1){contiguous=false;break;}
      if(!contiguous)continue;
      out.push({startEight:slice[0].eight,endEight:slice[slice.length-1].eight,start:slice[0].start,end:slice[slice.length-1].end,rows:slice});
    }
    return out;
  }

  function rankSegments(section,profile=[],{limit=5,minScore=0,excludeRanges=[]}={}){
    const duration=Math.max(1,Math.floor(finite(section?.durationEights,finite(section?.endEight)-finite(section?.startEight)+1)));
    const overlapsExcluded=(candidate)=>excludeRanges.some(range=>candidate.startEight<=finite(range?.endEight)&&candidate.endEight>=finite(range?.startEight));
    return candidateSegments(profile,duration)
      .filter(candidate=>!overlapsExcluded(candidate))
      .map(candidate=>({...candidate,...scoreSegment(section,candidate.rows)}))
      .filter(candidate=>candidate.score>=clamp01(minScore))
      .sort((a,b)=>b.score-a.score||a.startEight-b.startEight)
      .slice(0,Math.max(1,Math.floor(finite(limit,5))))
      .map(({rows,...candidate})=>candidate);
  }

  function matchPlanSections(sections=[],profile=[],{limitPerSection=3,minScore=.45,avoidReuse=true}={}){
    const matches=[];
    const used=[];
    for(const section of sections){
      const candidates=rankSegments(section,profile,{limit:limitPerSection,minScore,excludeRanges:avoidReuse?used:[]});
      const best=candidates[0]||null;
      if(best&&avoidReuse)used.push({startEight:best.startEight,endEight:best.endEight});
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
      nonDestructive:true
    };
  }

  const api={ENERGY_TARGETS,SECTION_WEIGHTS,normalizeProfile,segmentFeatures,scoreSegment,candidateSegments,rankSegments,matchPlanSections};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixSegmentMatcherCore=api;
})();
