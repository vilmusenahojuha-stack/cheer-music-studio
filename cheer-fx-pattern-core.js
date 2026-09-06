(()=>{
  'use strict';

  const SECTION_PATTERNS=Object.freeze({
    intro:Object.freeze({name:'intro-open',impact:[1,5],transition:[8],maxAccents:2}),
    stunt:Object.freeze({name:'stunt-hit',impact:[1,5],transition:[8],maxAccents:3}),
    tumbling:Object.freeze({name:'tumbling-drive',impact:[1,3,5,7],transition:[8],maxAccents:4}),
    pyramid:Object.freeze({name:'pyramid-build-hit',impact:[1,5,7],transition:[8],maxAccents:3}),
    dance:Object.freeze({name:'dance-pulse',impact:[1,3,5,7],transition:[8],maxAccents:3}),
    ending:Object.freeze({name:'ending-resolution',impact:[1,5,7,8],transition:[8],maxAccents:4}),
    other:Object.freeze({name:'balanced',impact:[1,5],transition:[8],maxAccents:2})
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function sectionKey(value){const key=String(value||'other').toLowerCase();return SECTION_PATTERNS[key]?key:'other';}
  function clampCount(value){return Math.max(1,Math.min(8,Math.round(finite(value,1))));}

  function patternForSection(sectionType){return SECTION_PATTERNS[sectionKey(sectionType)];}

  function rankEvents(events=[]){
    return [...events].sort((a,b)=>finite(b.intensityScore)-finite(a.intensityScore)||finite(b.priority)-finite(a.priority)||finite(a.count)-finite(b.count));
  }

  function assignPatternToEight(events=[]){
    if(!events.length)return {events:[],pattern:null,suggestions:[],risks:[]};
    const section=sectionKey(events[0]?.sectionType);
    const pattern=patternForSection(section);
    const ranked=rankEvents(events);
    const used=new Set();
    const output=[];
    const suggestions=[];
    const impacts=ranked.filter(e=>e.kind==='impact');
    const transitions=ranked.filter(e=>e.kind==='riser'||e.kind==='whoosh');
    const others=ranked.filter(e=>!impacts.includes(e)&&!transitions.includes(e));

    impacts.forEach((event,index)=>{
      const target=pattern.impact[index]??clampCount(event.count);
      if(index>=pattern.maxAccents){
        output.push({...event,patternDecision:'review',patternReason:'accent-density-exceeds-pattern'});
        return;
      }
      used.add(target);
      output.push({...event,count:target,countLabel:String(target),patternDecision:'align',patternName:pattern.name,patternRole:'accent'});
    });

    transitions.forEach((event,index)=>{
      let target=pattern.transition[index]??pattern.transition[0]??8;
      if(used.has(target)){
        const fallback=[8,4,7,6,2].find(c=>!used.has(c));
        if(fallback)target=fallback;
      }
      used.add(target);
      output.push({...event,count:target,countLabel:String(target),patternDecision:'align',patternName:pattern.name,patternRole:'transition'});
    });

    others.forEach(event=>output.push({...event,patternDecision:'keep',patternName:pattern.name,patternRole:'support'}));

    const presentImpactCounts=new Set(output.filter(e=>e.kind==='impact'&&e.patternDecision!=='review').map(e=>e.count));
    for(const target of pattern.impact){
      if(presentImpactCounts.size>=Math.min(pattern.maxAccents,impacts.length))break;
      if(!presentImpactCounts.has(target)&&impacts.length>presentImpactCounts.size)suggestions.push({type:'accent-slot',count:target,reason:'pattern-gap',patternName:pattern.name});
    }

    const risks=[];
    const countUse=new Map();
    for(const event of output){const key=clampCount(event.count);countUse.set(key,(countUse.get(key)||0)+1);}
    for(const [count,total] of countUse)if(total>1)risks.push({type:'pattern-count-collision',count,total});
    if(output.filter(e=>e.kind==='impact'&&e.patternDecision!=='review').length>pattern.maxAccents)risks.push({type:'pattern-too-dense'});

    return {events:output.sort((a,b)=>finite(a.count)-finite(b.count)||finite(b.intensityScore)-finite(a.intensityScore)),pattern:{sectionType:section,...pattern},suggestions,risks};
  }

  function buildPatternGroups(events=[]){
    const groups=new Map();
    for(const event of events){
      const eight=Math.max(1,Math.round(finite(event?.eight,1)));
      if(!groups.has(eight))groups.set(eight,[]);
      groups.get(eight).push(event);
    }
    return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([eight,items])=>({eight,...assignPatternToEight(items)}));
  }

  function createCheerFxPatternPlan(countRhythmPlan){
    if(!countRhythmPlan||countRhythmPlan.kind!=='cheer-fx-count-rhythm-plan')return {version:1,kind:'cheer-fx-pattern-plan',status:'blocked',reason:'cheer-fx-count-rhythm-plan-required',nonDestructive:true,executable:false,groups:[],events:[],riskFlags:[]};
    if(countRhythmPlan.status==='blocked')return {version:1,kind:'cheer-fx-pattern-plan',status:'blocked',reason:'cheer-fx-count-rhythm-plan-blocked',nonDestructive:true,executable:false,groups:[],events:[],riskFlags:[]};
    const groups=buildPatternGroups(Array.isArray(countRhythmPlan.events)?countRhythmPlan.events:[]);
    const events=groups.flatMap(g=>g.events.map(e=>({...e,eight:g.eight})));
    const patternRisks=groups.flatMap(g=>g.risks.map(r=>({...r,eight:g.eight})));
    const riskFlags=[...(Array.isArray(countRhythmPlan.riskFlags)?countRhythmPlan.riskFlags:[])];
    if(patternRisks.length)riskFlags.push('fx-pattern-risk');
    if(!events.length)riskFlags.push('no-fx-events-to-pattern');
    const status=patternRisks.length||countRhythmPlan.status!=='preview-ready'?'review-required':'preview-ready';
    return {
      version:1,kind:'cheer-fx-pattern-plan',status,bpm:countRhythmPlan.bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      groups,events,patternRisks,riskFlags:[...new Set(riskFlags)],
      summary:{groups:groups.length,events:events.length,aligned:events.filter(e=>e.patternDecision==='align').length,review:events.filter(e=>e.patternDecision==='review').length,suggestions:groups.reduce((n,g)=>n+g.suggestions.length,0),readyForPreview:status==='preview-ready'}
    };
  }

  const api={SECTION_PATTERNS,patternForSection,assignPatternToEight,buildPatternGroups,createCheerFxPatternPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxPatternCore=api;
})();
