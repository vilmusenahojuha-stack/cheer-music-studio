(()=>{
  'use strict';

  const SECTION_INTENSITY=Object.freeze({intro:.62,stunt:.88,tumbling:.82,pyramid:.96,dance:.76,ending:1,other:.68});
  const KIND_WEIGHT=Object.freeze({impact:1,riser:.76,downlifter:.58,whoosh:.54});

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}

  function classifyIntensity(score){
    if(score>=.86)return 'hero';
    if(score>=.68)return 'strong';
    if(score>=.48)return 'medium';
    return 'light';
  }

  function scoreEvent(event){
    const section=SECTION_INTENSITY[String(event?.sectionType||'other').toLowerCase()]??SECTION_INTENSITY.other;
    const kind=KIND_WEIGHT[event?.kind]??.5;
    const confidence=clamp01(event?.confidence??.5);
    const priority=clamp01(event?.priority??.5);
    return clamp01(section*.38+kind*.26+confidence*.2+priority*.16);
  }

  function applyIntensity(events=[]){
    return events.map(event=>{
      const intensityScore=scoreEvent(event);
      return {...event,intensityScore,intensity:classifyIntensity(intensityScore)};
    });
  }

  function enforceDensity(events,{maxPerEight=2,maxHeroPerFourEights=2,minSpacingSeconds=.12}={}){
    const sorted=[...events].sort((a,b)=>b.intensityScore-a.intensityScore||b.priority-a.priority||a.at-b.at);
    const kept=[];
    const dropped=[];
    const perEight=new Map();
    const heroWindows=new Map();
    for(const event of sorted){
      const eight=Math.max(1,Math.round(finite(event?.eight,1)));
      const group=Math.floor((eight-1)/4);
      const count=perEight.get(eight)||0;
      const heroCount=heroWindows.get(group)||0;
      let reason=null;
      if(count>=Math.max(1,Math.round(finite(maxPerEight,2))))reason='eight-density-limit';
      else if(event.intensity==='hero'&&heroCount>=Math.max(1,Math.round(finite(maxHeroPerFourEights,2))))reason='hero-density-limit';
      else if(kept.some(existing=>Math.abs(finite(existing.at)-finite(event.at))<Math.max(0,finite(minSpacingSeconds,.12))&&existing.kind===event.kind))reason='same-fx-too-close';
      if(reason){dropped.push({...event,densityDecision:'drop',densityReason:reason});continue;}
      kept.push({...event,densityDecision:'keep'});
      perEight.set(eight,count+1);
      if(event.intensity==='hero')heroWindows.set(group,heroCount+1);
    }
    return {kept:kept.sort((a,b)=>a.at-b.at||b.intensityScore-a.intensityScore),dropped:dropped.sort((a,b)=>a.at-b.at)};
  }

  function createCheerFxIntensityPlan(fxPlan,options={}){
    if(!fxPlan||fxPlan.kind!=='cheer-fx-plan')return {version:1,kind:'cheer-fx-intensity-plan',status:'blocked',reason:'cheer-fx-plan-required',nonDestructive:true,executable:false,events:[],dropped:[]};
    if(fxPlan.status==='blocked')return {version:1,kind:'cheer-fx-intensity-plan',status:'blocked',reason:'cheer-fx-plan-blocked',nonDestructive:true,executable:false,events:[],dropped:[]};
    const scored=applyIntensity(Array.isArray(fxPlan.events)?fxPlan.events:[]);
    const density=enforceDensity(scored,options);
    const hero=density.kept.filter(e=>e.intensity==='hero').length;
    const riskFlags=[...(Array.isArray(fxPlan.riskFlags)?fxPlan.riskFlags:[])];
    if(density.dropped.length)riskFlags.push('fx-density-reduced');
    if(hero>0&&density.kept.length>0&&hero/density.kept.length>.5)riskFlags.push('hero-fx-heavy');
    const status=fxPlan.status==='preview-ready'?'preview-ready':'review-required';
    return {
      version:1,kind:'cheer-fx-intensity-plan',status,bpm:fxPlan.bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      events:density.kept,dropped:density.dropped,riskFlags:[...new Set(riskFlags)],
      summary:{events:density.kept.length,dropped:density.dropped.length,hero,strong:density.kept.filter(e=>e.intensity==='strong').length,medium:density.kept.filter(e=>e.intensity==='medium').length,light:density.kept.filter(e=>e.intensity==='light').length,readyForPreview:status==='preview-ready'}
    };
  }

  const api={SECTION_INTENSITY,KIND_WEIGHT,classifyIntensity,scoreEvent,applyIntensity,enforceDensity,createCheerFxIntensityPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxIntensityCore=api;
})();
