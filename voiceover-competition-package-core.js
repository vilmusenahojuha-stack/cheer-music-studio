(()=>{
  'use strict';

  const REQUIRED_KINDS=Object.freeze({
    placement:'cheer-voiceover-placement-plan',
    rhythm:'cheer-voiceover-rhythm-plan',
    ducking:'cheer-voiceover-ducking-plan',
    conflict:'cheer-voiceover-fx-conflict-plan',
    priority:'cheer-voiceover-competition-priority-plan'
  });

  function array(value){return Array.isArray(value)?value:[];}
  function byId(items,key='slotId'){
    const map=new Map();
    for(const item of array(items)){
      const id=String(item?.[key]??item?.id??'');
      if(id)map.set(id,item);
    }
    return map;
  }
  function getPlan(input,name){
    return input?.[`${name}Plan`]||input?.[name]||null;
  }
  function planItems(plan,name){
    if(name==='ducking')return array(plan?.reservations).length?array(plan.reservations):array(plan?.items);
    if(name==='placement')return array(plan?.slots);
    if(name==='conflict')return array(plan?.conflicts);
    return array(plan?.items);
  }
  function cloneWindow(value){
    if(!value||typeof value!=='object')return null;
    return {...value};
  }
  function cloneRhythm(value){
    if(!value||typeof value!=='object')return null;
    return {
      shape:value?.rhythm?.shape??value?.shape??null,
      assignedCounts:value?.assignedCounts??value?.countLength??value?.counts??null,
      requiredCounts:value?.requiredCounts??null,
      attackCount:value?.rhythm?.attackCount??value?.attackCount??null,
      releaseCount:value?.rhythm?.releaseCount??value?.releaseCount??null,
      accentCounts:array(value?.rhythm?.accentCounts??value?.accentCounts).slice(),
      estimatedSeconds:value?.estimatedSeconds??value?.durationSec??value?.speechWindow?.durationSeconds??null,
      availableSeconds:value?.availableSeconds??null
    };
  }
  function buildVoiceoverCompetitionPackage(input={}){
    input=input||{};
    const base={version:1,kind:'cheer-voiceover-competition-package',status:'blocked',reason:'voiceover-plans-required',nonDestructive:true,executable:false,safePreviewOnly:true,selected:[],deferred:[],riskFlags:[],summary:{selected:0,deferred:0,ready:0,review:0}};
    const plans={};
    for(const name of Object.keys(REQUIRED_KINDS)){
      const plan=getPlan(input,name);
      if(!plan||plan.kind!==REQUIRED_KINDS[name])return {...base,reason:`${name}-plan-required`};
      if(plan.status==='blocked')return {...base,reason:`${name}-plan-blocked`};
      plans[name]=plan;
    }

    const prioritySelections=array(plans.priority.selections);
    if(!prioritySelections.length)return {...base,reason:'priority-selections-required'};
    const placement=byId(planItems(plans.placement,'placement'),'id');
    const rhythm=byId(planItems(plans.rhythm,'rhythm'));
    const ducking=byId(planItems(plans.ducking,'ducking'));
    const conflict=byId(planItems(plans.conflict,'conflict'));
    const selected=[];
    const riskFlags=new Set();

    for(const upstream of Object.values(plans)){
      for(const risk of array(upstream.riskFlags))riskFlags.add(risk);
    }

    for(const choice of prioritySelections){
      const slotId=String(choice?.slotId||'');
      if(!slotId)continue;
      const slot=placement.get(slotId)||null;
      const rhythmItem=rhythm.get(slotId)||null;
      const duckingItem=ducking.get(slotId)||null;
      const conflictItem=conflict.get(slotId)||null;
      const missing=[];
      if(!slot)missing.push('placement');
      if(!rhythmItem)missing.push('rhythm');
      if(!duckingItem)missing.push('ducking');
      const itemRisks=new Set();
      for(const risk of array(slot?.risks))itemRisks.add(risk);
      for(const risk of array(rhythmItem?.risks))itemRisks.add(risk);
      for(const risk of array(duckingItem?.risks))itemRisks.add(risk);
      if(conflictItem)itemRisks.add('voiceover-fx-conflict');
      if(missing.length)itemRisks.add('voiceover-package-incomplete');

      const ready=!missing.length&&!conflictItem&&!choice?.requiresReview&&itemRisks.size===0;
      selected.push({
        slotId,
        sectionId:choice?.sectionId??slot?.sectionId??null,
        sectionType:choice?.sectionType??slot?.sectionType??'other',
        role:choice?.role||'support-callout',
        score:Number(choice?.score)||0,
        status:ready?'preview-ready':'review-required',
        placement:slot?{eight:slot.eight??null,count:slot.count??null}:null,
        rhythm:cloneRhythm(rhythmItem),
        ducking:duckingItem?{
          eight:duckingItem.eight??slot?.eight??null,
          musicGainDb:duckingItem.musicGainDb??duckingItem.duckDb??null,
          attackCounts:duckingItem.attackCounts??null,
          releaseCounts:duckingItem.releaseCounts??null,
          speechWindow:cloneWindow(duckingItem.speechWindow),
          duckWindow:cloneWindow(duckingItem.duckWindow)
        }:null,
        conflict:conflictItem?{fxId:conflictItem.fxId??null,resolution:conflictItem.resolution??null}:null,
        risks:[...itemRisks],
        missing
      });
      for(const risk of itemRisks)riskFlags.add(risk);
    }

    const deferred=array(plans.priority.deferred).map(item=>({...item,status:'deferred'}));
    const ready=selected.filter(item=>item.status==='preview-ready').length;
    const review=selected.length-ready;
    if(review)riskFlags.add('voiceover-package-review-required');
    const upstreamReview=Object.values(plans).some(plan=>plan.status==='review-required');
    const status=upstreamReview||review||riskFlags.size?'review-required':'preview-ready';
    return {
      version:1,
      kind:'cheer-voiceover-competition-package',
      status,
      reason:null,
      bpm:plans.ducking.bpm??plans.rhythm.bpm??null,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      selected,
      deferred,
      riskFlags:[...riskFlags],
      preview:{
        rule:'package only competition-prioritized voiceovers with placement, rhythm, ducking and FX-conflict context; never render automatically',
        topVoiceover:selected[0]||null
      },
      summary:{selected:selected.length,deferred:deferred.length,ready,review}
    };
  }

  const api={REQUIRED_KINDS,planItems,cloneRhythm,buildVoiceoverCompetitionPackage};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverCompetitionPackageCore=api;
})();
