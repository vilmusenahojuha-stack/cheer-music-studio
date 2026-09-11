(()=>{
  'use strict';

  const finite=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const clamp01=value=>Math.max(0,Math.min(1,finite(value)));

  function sourceIdentity(profile=[]){
    const row=(Array.isArray(profile)?profile:[]).find(Boolean)||{};
    return {
      sourceName:row.sourceName==null?null:String(row.sourceName),
      trackId:row.trackId==null?null:String(row.trackId)
    };
  }

  function sameSource(a={},b={}){
    if(a.trackId&&b.trackId)return a.trackId===b.trackId;
    return (a.sourceName||null)===(b.sourceName||null);
  }

  function normalizeProfile(profile=[]){
    return (Array.isArray(profile)?profile:[])
      .filter(row=>row&&Number.isFinite(Number(row.eight)))
      .map(row=>({...row,eight:Math.max(1,Math.round(finite(row.eight,1))) }))
      .sort((a,b)=>a.eight-b.eight);
  }

  function trustedEnergyEvents(profile=[],profileCore,options={}){
    if(!profileCore?.detectAudioEnergyEvents)return [];
    const minConfidence=clamp01(options.minEventConfidence===undefined?.72:options.minEventConfidence);
    const events=profileCore.detectAudioEnergyEvents(profile,{
      breakThreshold:options.breakThreshold,
      dropThreshold:options.dropThreshold
    });
    const source=sourceIdentity(profile);
    const bestByEight=new Map();
    for(const event of Array.isArray(events)?events:[]){
      if(!event||!sameSource(source,event))continue;
      const atEight=Math.max(1,Math.round(finite(event.atEight,0)));
      const confidence=clamp01(event.confidence);
      if(!atEight||confidence<minConfidence)continue;
      const normalized={...event,atEight,confidence,...source};
      const previous=bestByEight.get(atEight);
      if(!previous||confidence>previous.confidence||(confidence===previous.confidence&&event.type==='drop'&&previous.type!=='drop')){
        bestByEight.set(atEight,normalized);
      }
    }
    return [...bestByEight.values()].sort((a,b)=>a.atEight-b.atEight);
  }

  function sectionEnergy(rows=[],startEight=1,endEight=startEight){
    const selected=(Array.isArray(rows)?rows:[]).filter(row=>row.eight>=startEight&&row.eight<=endEight);
    if(!selected.length)return {average:0,start:0,end:0,delta:0,peak:0};
    const values=selected.map(row=>clamp01(row.energyScore));
    const average=values.reduce((sum,value)=>sum+value,0)/values.length;
    const start=values[0];
    const end=values[values.length-1];
    return {average,start,end,delta:end-start,peak:Math.max(...values)};
  }

  function classifySection(section={},rows=[],options={}){
    const energy=sectionEnergy(rows,section.startEight,section.endEight);
    const highEnergy=clamp01(options.highEnergyThreshold===undefined?.72:options.highEnergyThreshold);
    const lowEnergy=clamp01(options.lowEnergyThreshold===undefined?.34:options.lowEnergyThreshold);
    const trendThreshold=Math.max(.01,finite(options.energyTrendThreshold,.12));
    let purpose='steady';

    if(section.incomingEvent==='drop'&&energy.average>=highEnergy)purpose='peak';
    else if(section.incomingEvent==='break'&&energy.average<=lowEnergy)purpose='reset';
    else if(energy.delta>=trendThreshold)purpose='buildup';
    else if(energy.average>=highEnergy)purpose='peak';
    else if(energy.average<=lowEnergy)purpose='reset';
    else if(section.incomingEvent==='drop')purpose='impact';
    else if(section.incomingEvent==='break')purpose='transition';

    return {
      purpose,
      energyAverage:energy.average,
      energyStart:energy.start,
      energyEnd:energy.end,
      energyDelta:energy.delta,
      energyPeak:energy.peak
    };
  }

  function inferSections(rows,events,options={}){
    if(!rows.length||!events.length)return [];
    const source=sourceIdentity(rows);
    const firstEight=rows[0].eight;
    const lastEight=rows[rows.length-1].eight;
    const boundaries=[firstEight,...events.map(event=>event.atEight).filter(eight=>eight>firstEight&&eight<=lastEight)];
    const unique=[...new Set(boundaries)].sort((a,b)=>a-b);
    const eventByEight=new Map(events.map(event=>[event.atEight,event]));
    const sections=[];
    for(let i=0;i<unique.length;i++){
      const startEight=unique[i];
      const endEight=(i+1<unique.length?unique[i+1]-1:lastEight);
      if(endEight<startEight)continue;
      const incoming=eventByEight.get(startEight)||null;
      const next=eventByEight.get(endEight+1)||null;
      const confidence=clamp01(incoming?.confidence??next?.confidence??options.edgeConfidence??.72);
      const base={
        id:`source-section-${sections.length+1}`,
        startEight,
        endEight,
        confidence,
        boundaryType:incoming?.type||'track-start',
        incomingEvent:incoming?.type||null,
        outgoingEvent:next?.type||null,
        source:'energy-transitions',
        ...source
      };
      sections.push({...base,...classifySection(base,rows,options)});
    }
    return sections;
  }

  function inferPhrases(sections=[],options={}){
    const phraseEights=Math.max(1,Math.round(finite(options.phraseEights,4)));
    const phrases=[];
    for(const section of Array.isArray(sections)?sections:[]){
      for(let startEight=section.startEight;startEight<=section.endEight;startEight+=phraseEights){
        const endEight=Math.min(section.endEight,startEight+phraseEights-1);
        const full=endEight-startEight+1===phraseEights;
        const confidence=clamp01(section.confidence*(full?1:.88));
        phrases.push({
          phrase:phrases.length+1,
          startEight,
          endEight,
          confidence,
          sectionId:section.id,
          sectionPurpose:section.purpose||'steady',
          source:full?'section-anchored-phrase':'section-edge-phrase',
          sourceName:section.sourceName||null,
          trackId:section.trackId||null
        });
      }
    }
    return phrases;
  }

  function inferSourceStructure(profile=[],options={},cores={}){
    const rows=normalizeProfile(profile);
    const source=sourceIdentity(rows);
    if(rows.length<2){
      return {phrases:[],sections:[],events:[],source:'fallback',confidence:0,...source,nonDestructive:true};
    }
    const profileCore=cores.profileCore||options.profileCore;
    const events=trustedEnergyEvents(rows,profileCore,options);
    if(!events.length){
      return {phrases:[],sections:[],events:[],source:'fallback',confidence:0,...source,nonDestructive:true};
    }
    const sections=inferSections(rows,events,options);
    const phrases=inferPhrases(sections,options);
    const confidence=events.reduce((sum,event)=>sum+event.confidence,0)/events.length;
    return {
      phrases,
      sections,
      events,
      source:'energy-transitions',
      confidence:clamp01(confidence),
      ...source,
      nonDestructive:true
    };
  }

  const api={sourceIdentity,normalizeProfile,trustedEnergyEvents,sectionEnergy,classifySection,inferSections,inferPhrases,inferSourceStructure};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixSourceStructureCore=api;
})();