(()=>{
  'use strict';

  const SECTION_TYPES=Object.freeze(['intro','stunt','tumbling','pyramid','dance','transition','ending','other']);
  const ENERGY_LEVELS=Object.freeze(['low','medium','high','peak']);
  const ENERGY_SCORES=Object.freeze({low:1,medium:2,high:3,peak:4});

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function beatSeconds(bpm){
    bpm=finiteNumber(bpm);
    if(bpm<=0)throw new Error('BPM must be greater than zero.');
    return 60/bpm;
  }

  function eightCountSeconds(bpm){return beatSeconds(bpm)*8;}

  function normalizeSection(section,index=0){
    const startEight=Math.max(1,Math.round(finiteNumber(section?.startEight,index+1)));
    const endEight=Math.max(startEight,Math.round(finiteNumber(section?.endEight,startEight)));
    const type=SECTION_TYPES.includes(section?.type)?section.type:'other';
    const energy=ENERGY_LEVELS.includes(section?.energy)?section.energy:'medium';
    return {
      id:String(section?.id||`section-${index+1}`),
      startEight,
      endEight,
      type,
      energy,
      label:String(section?.label||''),
      notes:String(section?.notes||'')
    };
  }

  function buildEightCountMap({bpm,oneOffset=0,totalEights=0,sections=[]}={}){
    const duration=eightCountSeconds(bpm);
    const offset=Math.max(0,finiteNumber(oneOffset));
    const count=Math.max(0,Math.floor(finiteNumber(totalEights)));
    const normalized=sections.map(normalizeSection);
    const result=[];
    for(let i=0;i<count;i++){
      const eight=i+1;
      const section=normalized.find(s=>eight>=s.startEight&&eight<=s.endEight)||null;
      result.push({
        eight,
        start:offset+i*duration,
        end:offset+(i+1)*duration,
        sectionId:section?.id||null,
        sectionType:section?.type||null,
        energy:section?.energy||null
      });
    }
    return result;
  }

  function buildPhrases(eightCountMap=[],options={}){
    const phraseEights=Math.max(1,Math.round(finiteNumber(options.phraseEights,4)));
    const splitOnSection=options.splitOnSection!==false;
    const phrases=[];
    let current=null;
    for(const row of eightCountMap){
      if(!row||!Number.isFinite(Number(row.eight)))continue;
      const sectionChanged=current&&splitOnSection&&row.sectionId!==current.sectionId;
      const full=current&&current.eights.length>=phraseEights;
      if(!current||sectionChanged||full){
        current={
          phrase:phrases.length+1,
          startEight:Number(row.eight),
          endEight:Number(row.eight),
          start:finiteNumber(row.start),
          end:finiteNumber(row.end),
          sectionId:row.sectionId||null,
          sectionType:row.sectionType||null,
          eights:[],
          energyTrend:'steady'
        };
        phrases.push(current);
      }
      current.eights.push(row);
      current.endEight=Number(row.eight);
      current.end=finiteNumber(row.end,current.end);
      if(!current.sectionType&&row.sectionType)current.sectionType=row.sectionType;
    }
    for(const phrase of phrases)phrase.energyTrend=classifyEnergyTrend(phrase.eights);
    return phrases;
  }

  function energyScore(value){
    if(typeof value==='number'&&Number.isFinite(value))return value;
    return ENERGY_SCORES[value]||0;
  }

  function classifyEnergyTrend(eights=[]){
    const values=eights.map(row=>energyScore(row?.energy)).filter(v=>v>0);
    if(values.length<2)return 'steady';
    const delta=values[values.length-1]-values[0];
    if(delta>=1)return 'rising';
    if(delta<=-1)return 'falling';
    return 'steady';
  }

  function detectEnergyEvents(eightCountMap=[]){
    const events=[];
    for(let i=1;i<eightCountMap.length;i++){
      const previous=eightCountMap[i-1],current=eightCountMap[i];
      const from=energyScore(previous?.energy),to=energyScore(current?.energy);
      if(!from||!to||from===to)continue;
      const delta=to-from;
      events.push({
        atEight:Number(current.eight),
        time:finiteNumber(current.start),
        type:delta>0?'energy-rise':'energy-drop',
        strength:Math.abs(delta),
        from:previous.energy,
        to:current.energy,
        sectionChanged:(previous.sectionId||null)!==(current.sectionId||null)
      });
    }
    return events;
  }

  function clamp01(value){return Math.max(0,Math.min(1,finiteNumber(value)));}

  function detectTransitionCandidates(eightCountMap=[],options={}){
    const minEnergyStrength=Math.max(1,Math.round(finiteNumber(options.minEnergyStrength,1)));
    const candidates=[];
    for(let i=1;i<eightCountMap.length;i++){
      const previous=eightCountMap[i-1],current=eightCountMap[i];
      if(!previous||!current)continue;
      const from=energyScore(previous.energy),to=energyScore(current.energy);
      const delta=(from&&to)?to-from:0;
      const sectionChanged=(previous.sectionId||null)!==(current.sectionId||null);
      const atEight=Number(current.eight);
      const time=finiteNumber(current.start);

      if(sectionChanged){
        const strength=Math.abs(delta);
        candidates.push({
          atEight,time,type:'cut',
          confidence:clamp01(.62+Math.min(3,strength)*.08),
          reason:'section-boundary',
          fromSection:previous.sectionType||null,
          toSection:current.sectionType||null,
          energyDelta:delta
        });
      }

      if(delta<=-minEnergyStrength){
        candidates.push({
          atEight,time,type:'break',
          confidence:clamp01(.58+Math.min(3,Math.abs(delta))*.1+(sectionChanged?.08:0)),
          reason:sectionChanged?'energy-drop+section-boundary':'energy-drop',
          fromSection:previous.sectionType||null,
          toSection:current.sectionType||null,
          energyDelta:delta
        });
      }

      if(delta>=minEnergyStrength){
        candidates.push({
          atEight,time,type:'drop',
          confidence:clamp01(.58+Math.min(3,delta)*.1+(sectionChanged?.08:0)),
          reason:sectionChanged?'energy-rise+section-boundary':'energy-rise',
          fromSection:previous.sectionType||null,
          toSection:current.sectionType||null,
          energyDelta:delta
        });
      }
    }
    return candidates.sort((a,b)=>a.time-b.time||({break:0,cut:1,drop:2}[a.type]-({break:0,cut:1,drop:2}[b.type])));
  }

  function circularDistance(a,b,period){
    const raw=Math.abs(a-b)%period;
    return Math.min(raw,period-raw);
  }

  function normalizePhase(time,period){
    const value=finiteNumber(time);
    return ((value%period)+period)%period;
  }

  function alignEightCountPhase({bpm,anchors=[],oneOffset=0,maxResidualBeats=1}={}){
    const beat=beatSeconds(bpm);
    const period=beat*8;
    const fallback=Math.max(0,finiteNumber(oneOffset));
    const usable=anchors
      .map((anchor,index)=>{
        const time=Number(anchor?.time);
        if(!Number.isFinite(time)||time<0)return null;
        const confidence=clamp01(anchor?.confidence===undefined?1:anchor.confidence);
        if(confidence<=0)return null;
        return {index,time,confidence,phase:normalizePhase(time,period),type:String(anchor?.type||'anchor')};
      })
      .filter(Boolean);
    if(!usable.length){
      return {
        oneOffset:fallback,
        phase:normalizePhase(fallback,period),
        confidence:0,
        support:0,
        residualSeconds:null,
        source:'fallback'
      };
    }

    const candidates=[
      normalizePhase(fallback,period),
      ...usable.map(anchor=>anchor.phase)
    ];
    let best=null;
    for(const phase of candidates){
      let weightedResidual=0;
      let weight=0;
      let support=0;
      for(const anchor of usable){
        const distance=circularDistance(anchor.phase,phase,period);
        const normalized=Math.min(1,distance/(beat*Math.max(.25,finiteNumber(maxResidualBeats,1))));
        const fit=1-normalized;
        weightedResidual+=distance*anchor.confidence;
        weight+=anchor.confidence;
        support+=fit*anchor.confidence;
      }
      const residual=weight?weightedResidual/weight:period;
      const score=weight?support/weight:0;
      const fallbackDistance=circularDistance(phase,normalizePhase(fallback,period),period);
      const candidate={phase,residual,score,support,weight,fallbackDistance};
      if(!best
        ||candidate.score>best.score+1e-12
        ||(Math.abs(candidate.score-best.score)<=1e-12&&candidate.residual<best.residual-1e-12)
        ||(Math.abs(candidate.score-best.score)<=1e-12&&Math.abs(candidate.residual-best.residual)<=1e-12&&candidate.fallbackDistance<best.fallbackDistance)){
        best=candidate;
      }
    }

    const cycle=Math.floor(fallback/period);
    let aligned=cycle*period+best.phase;
    while(aligned>fallback+period/2)aligned-=period;
    while(aligned<Math.max(0,fallback-period/2))aligned+=period;
    if(aligned<0)aligned=best.phase;

    return {
      oneOffset:aligned,
      phase:best.phase,
      confidence:clamp01(best.score),
      support:usable.length,
      residualSeconds:best.residual,
      source:'structural-anchors'
    };
  }

  function snapToCount(time,{bpm,oneOffset=0,mode='beat'}={}){
    const unit=mode==='eight'?eightCountSeconds(bpm):beatSeconds(bpm);
    const offset=Math.max(0,finiteNumber(oneOffset));
    const relative=finiteNumber(time)-offset;
    return Math.max(offset,offset+Math.round(relative/unit)*unit);
  }

  function validateSections(sections=[]){
    const normalized=sections.map(normalizeSection).sort((a,b)=>a.startEight-b.startEight);
    const issues=[];
    for(let i=1;i<normalized.length;i++){
      if(normalized[i].startEight<=normalized[i-1].endEight){
        issues.push({type:'overlap',left:normalized[i-1].id,right:normalized[i].id});
      }
    }
    return {ok:issues.length===0,sections:normalized,issues};
  }

  const api={SECTION_TYPES,ENERGY_LEVELS,ENERGY_SCORES,beatSeconds,eightCountSeconds,normalizeSection,buildEightCountMap,buildPhrases,energyScore,classifyEnergyTrend,detectEnergyEvents,detectTransitionCandidates,alignEightCountPhase,snapToCount,validateSections};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerStructureCore=api;
})();
