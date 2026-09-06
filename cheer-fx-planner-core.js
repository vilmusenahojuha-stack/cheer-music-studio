(()=>{
  'use strict';

  const FX_KINDS=Object.freeze(['impact','riser','downlifter','whoosh']);
  const SECTION_PRIORITY=Object.freeze({ending:1,pyramid:.95,stunt:.92,tumbling:.82,dance:.74,intro:.68,other:.6});

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}
  function positive(value,fallback=0){return Math.max(0,finite(value,fallback));}

  function fxForAction(action,bpm){
    const beat=60/finite(bpm);
    const at=positive(action?.at);
    const sectionType=String(action?.sectionType||'other').toLowerCase();
    const priority=SECTION_PRIORITY[sectionType]??SECTION_PRIORITY.other;
    const confidence=clamp01(action?.confidence??.5);
    const base={
      sourceActionId:action?.id||null,
      sourceDecisionId:action?.sourceDecisionId||null,
      eight:Math.max(1,Math.round(finite(action?.eight,1))),
      sectionId:action?.sectionId||null,
      sectionType,
      confidence,
      priority:clamp01(priority*confidence),
      destructive:false,
      executable:false
    };

    if(action?.type==='drop')return [{...base,kind:'impact',at,role:'accent',window:{from:Math.max(0,at-beat*.05),to:at+beat*.12}}];
    if(action?.type==='build')return [{...base,kind:'riser',at,role:'build-to-hit',window:{from:Math.max(0,at-beat*4),to:at}}];
    if(action?.type==='break')return [{...base,kind:'downlifter',at,role:'clear-space',window:{from:at,to:at+beat*.75}}];
    if(action?.type==='cut')return [{...base,kind:'whoosh',at,role:'mask-cut',window:{from:Math.max(0,at-beat*.35),to:at+beat*.2}}];
    return [];
  }

  function dedupeAndLimit(events,{minSpacingBeats=.5,maxPerEight=2,bpm}={}){
    const beat=60/finite(bpm);
    const minSpacing=Math.max(0,finite(minSpacingBeats,.5))*beat;
    const perEight=new Map();
    const kept=[];
    const sorted=[...events].sort((a,b)=>b.priority-a.priority||b.confidence-a.confidence||a.at-b.at);
    for(const event of sorted){
      const count=perEight.get(event.eight)||0;
      if(count>=Math.max(1,Math.round(finite(maxPerEight,2))))continue;
      const tooClose=kept.some(existing=>Math.abs(existing.at-event.at)<minSpacing&&existing.kind===event.kind);
      if(tooClose)continue;
      kept.push(event);
      perEight.set(event.eight,count+1);
    }
    return kept.sort((a,b)=>a.at-b.at||b.priority-a.priority);
  }

  function detectConflicts(events=[]){
    const conflicts=[];
    for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
      const a=events[i],b=events[j];
      if(a.eight!==b.eight)continue;
      if(a.kind==='impact'&&b.kind==='downlifter'||a.kind==='downlifter'&&b.kind==='impact'){
        if(Math.abs(a.at-b.at)<.12)conflicts.push({type:'opposing-fx-at-same-anchor',eight:a.eight,eventKinds:[a.kind,b.kind]});
      }
    }
    return conflicts;
  }

  function createCheerFxPlan(proposalPackage,options={}){
    if(!proposalPackage||proposalPackage.kind!=='smart-mix-2-proposal-package'){
      return {version:1,kind:'cheer-fx-plan',status:'blocked',reason:'smart-mix-package-required',nonDestructive:true,executable:false,events:[],conflicts:[]};
    }
    if(proposalPackage.status==='blocked'){
      return {version:1,kind:'cheer-fx-plan',status:'blocked',reason:'smart-mix-package-blocked',nonDestructive:true,executable:false,events:[],conflicts:[]};
    }
    const bpm=finite(proposalPackage.bpm);
    if(bpm<=0){
      return {version:1,kind:'cheer-fx-plan',status:'blocked',reason:'bpm-required',nonDestructive:true,executable:false,events:[],conflicts:[]};
    }
    const actions=Array.isArray(proposalPackage?.editPlan?.actions)?proposalPackage.editPlan.actions:[];
    const minConfidence=clamp01(options.minConfidence??.62);
    const raw=actions.filter(a=>clamp01(a?.confidence)>=minConfidence).flatMap(a=>fxForAction(a,bpm));
    const events=dedupeAndLimit(raw,{bpm,minSpacingBeats:options.minSpacingBeats??.5,maxPerEight:options.maxPerEight??2});
    const conflicts=detectConflicts(events);
    const riskFlags=[];
    if(proposalPackage.status!=='preview-ready')riskFlags.push('source-package-review-required');
    if(events.length===0)riskFlags.push('no-confident-fx-anchors');
    if(conflicts.length)riskFlags.push('fx-conflict');
    const status=conflicts.length?'review-required':(events.length&&proposalPackage.status==='preview-ready'?'preview-ready':'review-required');
    return {
      version:1,
      kind:'cheer-fx-plan',
      status,
      bpm,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      events,
      conflicts,
      riskFlags,
      summary:{
        events:events.length,
        impacts:events.filter(e=>e.kind==='impact').length,
        risers:events.filter(e=>e.kind==='riser').length,
        downlifters:events.filter(e=>e.kind==='downlifter').length,
        whooshes:events.filter(e=>e.kind==='whoosh').length,
        conflicts:conflicts.length,
        readyForPreview:status==='preview-ready'
      }
    };
  }

  const api={FX_KINDS,SECTION_PRIORITY,fxForAction,dedupeAndLimit,detectConflicts,createCheerFxPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxPlannerCore=api;
})();
