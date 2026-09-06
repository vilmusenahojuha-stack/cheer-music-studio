(()=>{
  'use strict';

  const PHASE_PROFILES=Object.freeze({
    build:Object.freeze({density:0.72,impactScale:0.82,transitionScale:1.15,heroAllowed:false}),
    drive:Object.freeze({density:0.9,impactScale:1,transitionScale:1,heroAllowed:true}),
    peak:Object.freeze({density:1,impactScale:1.2,transitionScale:0.9,heroAllowed:true}),
    break:Object.freeze({density:0.45,impactScale:0.55,transitionScale:1.05,heroAllowed:false}),
    release:Object.freeze({density:0.55,impactScale:0.68,transitionScale:0.95,heroAllowed:false}),
    resolve:Object.freeze({density:0.82,impactScale:1.08,transitionScale:0.82,heroAllowed:true})
  });

  const SECTION_PHASE=Object.freeze({
    intro:'build',stunt:'peak',tumbling:'drive',pyramid:'peak',dance:'drive',ending:'resolve',other:'drive'
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value,0)));}
  function phaseKey(value){const key=String(value||'').toLowerCase();return PHASE_PROFILES[key]?key:null;}
  function sectionKey(value){const key=String(value||'other').toLowerCase();return SECTION_PHASE[key]?key:'other';}
  function phraseSlot(eight,phraseStart=1,phraseLength=4){
    const length=Math.max(1,Math.round(finite(phraseLength,4)));
    const start=Math.max(1,Math.round(finite(phraseStart,1)));
    return ((Math.max(1,Math.round(finite(eight,1)))-start)%length+length)%length+1;
  }

  function resolveEnergyWindow(eight,sectionType,windows=[]){
    const n=Math.max(1,Math.round(finite(eight,1)));
    const match=(Array.isArray(windows)?windows:[]).find(window=>{
      const start=Math.max(1,Math.round(finite(window?.startEight,1)));
      const end=Math.max(start,Math.round(finite(window?.endEight,start)));
      return n>=start&&n<=end;
    });
    const inferred=SECTION_PHASE[sectionKey(sectionType)]||'drive';
    const phase=phaseKey(match?.phase)||inferred;
    const energy=match&&Number.isFinite(Number(match.energy))?clamp01(match.energy):null;
    return {phase,energy,source:match?'energy-window':'section-inference',window:match||null};
  }

  function desiredAccentBudget(group,context,options={}){
    const base=Math.max(1,finite(group?.pattern?.maxAccents,2));
    const profile=PHASE_PROFILES[context.phase]||PHASE_PROFILES.drive;
    const slot=phraseSlot(group?.eight,options.phraseStartEight,options.phraseLength||4);
    const phraseLength=Math.max(1,Math.round(finite(options.phraseLength,4)));
    const phraseBoost=slot===phraseLength?0.14:slot===1?0.06:0;
    const energyFactor=context.energy==null?1:0.7+context.energy*0.3;
    return Math.max(1,Math.min(base,Math.round(base*(profile.density+phraseBoost)*energyFactor)));
  }

  function scoreEvent(event,context,slot,phraseLength){
    const profile=PHASE_PROFILES[context.phase]||PHASE_PROFILES.drive;
    const base=finite(event?.intensityScore,finite(event?.priority,0.5));
    const kind=String(event?.kind||'support');
    let scale=1;
    if(kind==='impact')scale=profile.impactScale;
    else if(kind==='riser'||kind==='whoosh'||kind==='downlifter')scale=profile.transitionScale;
    if(context.energy!=null)scale*=0.8+context.energy*0.4;
    if(slot===phraseLength&&kind==='impact'&&(context.phase==='peak'||context.phase==='resolve'))scale*=1.08;
    return Math.max(0,base*scale);
  }

  function shapeGroup(group,windows=[],options={}){
    const sectionType=group?.pattern?.sectionType||group?.events?.[0]?.sectionType||'other';
    const context=resolveEnergyWindow(group?.eight,sectionType,windows);
    const phraseLength=Math.max(1,Math.round(finite(options.phraseLength,4)));
    const slot=phraseSlot(group?.eight,options.phraseStartEight,phraseLength);
    const budget=desiredAccentBudget(group,context,options);
    const impacts=(Array.isArray(group?.events)?group.events:[]).filter(e=>e.kind==='impact'&&e.patternDecision!=='review')
      .map(e=>({...e,phraseEnergyScore:scoreEvent(e,context,slot,phraseLength)}))
      .sort((a,b)=>finite(b.phraseEnergyScore)-finite(a.phraseEnergyScore)||finite(a.count)-finite(b.count));
    const allowedImpacts=new Set(impacts.slice(0,budget));
    const events=(Array.isArray(group?.events)?group.events:[]).map(event=>{
      const scored=scoreEvent(event,context,slot,phraseLength);
      if(event.kind==='impact'&&event.patternDecision!=='review'&&!allowedImpacts.has(event)){
        return {...event,phraseEnergyScore:scored,phraseEnergyDecision:'defer',phraseEnergyReason:'phrase-energy-density-cap',phraseSlot:slot,energyPhase:context.phase};
      }
      const heroCandidate=event.kind==='impact'&&(context.phase==='peak'||context.phase==='resolve')&&(slot===phraseLength||event.count===1);
      return {...event,phraseEnergyScore:scored,phraseEnergyDecision:'keep',phraseEnergyRole:heroCandidate?'hero-candidate':'support',phraseSlot:slot,energyPhase:context.phase};
    });
    const kept=events.filter(e=>e.phraseEnergyDecision!=='defer');
    const deferred=events.filter(e=>e.phraseEnergyDecision==='defer');
    const risks=[];
    if(context.phase==='break'&&kept.filter(e=>e.kind==='impact').length>1)risks.push({type:'break-too-impact-heavy'});
    if(context.phase==='peak'&&kept.filter(e=>e.kind==='impact').length===0)risks.push({type:'peak-missing-impact'});
    return {...group,events,phraseEnergy:{phase:context.phase,energy:context.energy,source:context.source,phraseSlot:slot,phraseLength,accentBudget:budget},deferred,risks};
  }

  function createCheerFxPhraseEnergyPlan(patternPlan,options={}){
    if(!patternPlan||patternPlan.kind!=='cheer-fx-pattern-plan')return {version:1,kind:'cheer-fx-phrase-energy-plan',status:'blocked',reason:'cheer-fx-pattern-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,groups:[],events:[],riskFlags:[]};
    if(patternPlan.status==='blocked')return {version:1,kind:'cheer-fx-phrase-energy-plan',status:'blocked',reason:'cheer-fx-pattern-plan-blocked',nonDestructive:true,executable:false,safePreviewOnly:true,groups:[],events:[],riskFlags:[]};
    const windows=Array.isArray(options.energyWindows)?options.energyWindows:[];
    const groups=(Array.isArray(patternPlan.groups)?patternPlan.groups:[]).map(group=>shapeGroup(group,windows,options));
    const events=groups.flatMap(group=>group.events.map(event=>({...event,eight:group.eight})));
    const activeEvents=events.filter(event=>event.phraseEnergyDecision!=='defer');
    const deferredEvents=events.filter(event=>event.phraseEnergyDecision==='defer');
    const phraseEnergyRisks=groups.flatMap(group=>group.risks.map(risk=>({...risk,eight:group.eight})));
    const riskFlags=[...(Array.isArray(patternPlan.riskFlags)?patternPlan.riskFlags:[])];
    if(phraseEnergyRisks.length)riskFlags.push('fx-phrase-energy-risk');
    if(!activeEvents.length)riskFlags.push('no-active-fx-after-phrase-energy-shaping');
    const status=phraseEnergyRisks.length||patternPlan.status!=='preview-ready'?'review-required':'preview-ready';
    return {
      version:1,kind:'cheer-fx-phrase-energy-plan',status,bpm:patternPlan.bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      groups,events,activeEvents,deferredEvents,phraseEnergyRisks,riskFlags:[...new Set(riskFlags)],
      summary:{groups:groups.length,events:events.length,active:activeEvents.length,deferred:deferredEvents.length,heroCandidates:activeEvents.filter(e=>e.phraseEnergyRole==='hero-candidate').length,readyForPreview:status==='preview-ready'}
    };
  }

  const api={PHASE_PROFILES,SECTION_PHASE,phraseSlot,resolveEnergyWindow,desiredAccentBudget,shapeGroup,createCheerFxPhraseEnergyPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxPhraseEnergyCore=api;
})();
