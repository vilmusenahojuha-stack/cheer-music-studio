(()=>{
  'use strict';

  const KIND_COUNT_RULES=Object.freeze({
    impact:Object.freeze({preferred:[1,5],fallback:1,role:'hit'}),
    riser:Object.freeze({preferred:[8],fallback:8,role:'lead-in'}),
    downlifter:Object.freeze({preferred:[1,5],fallback:1,role:'release'}),
    whoosh:Object.freeze({preferred:[8,4],fallback:8,role:'transition'})
  });
  const SECTION_COUNT_BIAS=Object.freeze({
    intro:Object.freeze({impact:[1,5],riser:[8],downlifter:[1],whoosh:[8,4]}),
    stunt:Object.freeze({impact:[1,5,3,7],riser:[8,4],downlifter:[1,5],whoosh:[8]}),
    tumbling:Object.freeze({impact:[1,3,5,7],riser:[8,4],downlifter:[1,5],whoosh:[8,4]}),
    pyramid:Object.freeze({impact:[1,5,3,7],riser:[8,4],downlifter:[1,5],whoosh:[8]}),
    dance:Object.freeze({impact:[1,5,3,7],riser:[8,4],downlifter:[5,1],whoosh:[8,4]}),
    ending:Object.freeze({impact:[1,5,7,8],riser:[8,4],downlifter:[1,5],whoosh:[8]}),
    other:Object.freeze({impact:[1,5],riser:[8],downlifter:[1],whoosh:[8,4]})
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clampCount(value){return Math.max(1,Math.min(8,Math.round(finite(value,1))));}
  function normalizeSection(value){const key=String(value||'other').toLowerCase();return SECTION_COUNT_BIAS[key]?key:'other';}

  function preferredCounts(event){
    const section=normalizeSection(event?.sectionType);
    const kind=String(event?.kind||'');
    return [...(SECTION_COUNT_BIAS[section]?.[kind]||KIND_COUNT_RULES[kind]?.preferred||[1])];
  }

  function chooseCount(event,occupied=new Set()){
    const candidates=preferredCounts(event);
    for(const count of candidates)if(!occupied.has(count))return count;
    return clampCount(KIND_COUNT_RULES[event?.kind]?.fallback||candidates[0]||1);
  }

  function eventTiming(event,count,bpm,eightStarts){
    const beat=60/finite(bpm);
    const eight=Math.max(1,Math.round(finite(event?.eight,1)));
    const starts=eightStarts&&typeof eightStarts==='object'?eightStarts:null;
    const start=starts?finite(starts[eight],NaN):NaN;
    if(Number.isFinite(start)&&beat>0)return {timingMode:'grid-snapped',at:start+(clampCount(count)-1)*beat,offsetFromCount:0};
    return {timingMode:'recommended-count',at:finite(event?.at),offsetFromCount:null};
  }

  function rhythmizeEvents(events,bpm,{eightStarts=null,maxPerCount=1}={}){
    const byEight=new Map();
    const ordered=[...events].sort((a,b)=>a.eight-b.eight||b.intensityScore-a.intensityScore||b.priority-a.priority||a.at-b.at);
    const out=[];
    for(const event of ordered){
      const eight=Math.max(1,Math.round(finite(event?.eight,1)));
      if(!byEight.has(eight))byEight.set(eight,new Map());
      const occupancy=byEight.get(eight);
      const blocked=new Set([...occupancy.entries()].filter(([,n])=>n>=Math.max(1,Math.round(finite(maxPerCount,1)))).map(([count])=>count));
      const count=chooseCount(event,blocked);
      occupancy.set(count,(occupancy.get(count)||0)+1);
      const timing=eventTiming(event,count,bpm,eightStarts);
      out.push({...event,count,countLabel:String(count),countRole:KIND_COUNT_RULES[event?.kind]?.role||'accent',preferredCounts:preferredCounts(event),rhythmDecision:'keep',...timing});
    }
    return out.sort((a,b)=>a.eight-b.eight||a.count-b.count||b.intensityScore-a.intensityScore);
  }

  function detectCountRisks(events=[]){
    const risks=[];
    const perEightCount=new Map();
    for(const event of events){
      const key=`${event.eight}:${event.count}`;
      perEightCount.set(key,(perEightCount.get(key)||0)+1);
    }
    for(const [key,total] of perEightCount)if(total>1)risks.push({type:'fx-count-collision',anchor:key,total});
    for(const event of events){
      if(event.kind==='impact'&&event.intensity==='hero'&&![1,5,7,8].includes(event.count))risks.push({type:'hero-impact-off-strong-count',eight:event.eight,count:event.count});
      if(event.kind==='riser'&&event.count!==8&&event.count!==4)risks.push({type:'riser-off-lead-in-count',eight:event.eight,count:event.count});
    }
    return risks;
  }

  function createCheerFxCountRhythmPlan(intensityPlan,options={}){
    if(!intensityPlan||intensityPlan.kind!=='cheer-fx-intensity-plan')return {version:1,kind:'cheer-fx-count-rhythm-plan',status:'blocked',reason:'cheer-fx-intensity-plan-required',nonDestructive:true,executable:false,events:[],riskFlags:[]};
    if(intensityPlan.status==='blocked')return {version:1,kind:'cheer-fx-count-rhythm-plan',status:'blocked',reason:'cheer-fx-intensity-plan-blocked',nonDestructive:true,executable:false,events:[],riskFlags:[]};
    const bpm=finite(intensityPlan.bpm);
    if(bpm<=0)return {version:1,kind:'cheer-fx-count-rhythm-plan',status:'blocked',reason:'bpm-required',nonDestructive:true,executable:false,events:[],riskFlags:[]};
    const events=rhythmizeEvents(Array.isArray(intensityPlan.events)?intensityPlan.events:[],bpm,options);
    const countRisks=detectCountRisks(events);
    const riskFlags=[...(Array.isArray(intensityPlan.riskFlags)?intensityPlan.riskFlags:[])];
    if(countRisks.length)riskFlags.push('fx-count-rhythm-risk');
    if(!events.length)riskFlags.push('no-fx-events-to-rhythmize');
    const status=countRisks.length||intensityPlan.status!=='preview-ready'?'review-required':'preview-ready';
    return {
      version:1,kind:'cheer-fx-count-rhythm-plan',status,bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      events,countRisks,riskFlags:[...new Set(riskFlags)],
      summary:{events:events.length,eights:new Set(events.map(e=>e.eight)).size,strongCountHits:events.filter(e=>e.kind==='impact'&&[1,5].includes(e.count)).length,leadIns:events.filter(e=>['riser','whoosh'].includes(e.kind)&&[4,8].includes(e.count)).length,gridSnapped:events.filter(e=>e.timingMode==='grid-snapped').length,readyForPreview:status==='preview-ready'}
    };
  }

  const api={KIND_COUNT_RULES,SECTION_COUNT_BIAS,preferredCounts,chooseCount,eventTiming,rhythmizeEvents,detectCountRisks,createCheerFxCountRhythmPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxCountRhythmCore=api;
})();
