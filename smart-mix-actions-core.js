(()=>{
  'use strict';

  const ACTION_KINDS=Object.freeze(['break','drop','build','cut']);

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function beatSeconds(bpm){
    const n=finiteNumber(bpm);
    if(n<=0)throw new Error('BPM must be greater than zero.');
    return 60/n;
  }

  function eightSeconds(bpm){return beatSeconds(bpm)*8;}

  function clampTime(value){return Math.max(0,finiteNumber(value));}

  function normalizeDecision(decision,index=0){
    if(!decision||!ACTION_KINDS.includes(decision.type))return null;
    const at=clampTime(decision.at);
    return {
      id:String(decision.id||`decision-${index+1}`),
      type:decision.type,
      eight:Math.max(1,Math.round(finiteNumber(decision.eight,1))),
      at,
      confidence:Math.max(0,Math.min(1,finiteNumber(decision.confidence,.5))),
      reason:String(decision.reason||''),
      sectionId:decision.sectionId||null,
      sectionType:decision.sectionType||null,
      plannedEnergy:decision.plannedEnergy||null,
      window:{
        preSeconds:Math.max(0,finiteNumber(decision.window?.preSeconds)),
        postSeconds:Math.max(0,finiteNumber(decision.window?.postSeconds))
      }
    };
  }

  function actionSteps(decision,bpm){
    const beat=beatSeconds(bpm);
    const at=decision.at;
    if(decision.type==='break'){
      return [
        {kind:'gain-ramp',from:Math.max(0,at-Math.max(decision.window.preSeconds,beat*.5)),to:at,valueFrom:1,valueTo:.28},
        {kind:'space',from:at,to:at+Math.max(decision.window.postSeconds,beat*.25),target:'music'}
      ];
    }
    if(decision.type==='drop'){
      return [
        {kind:'prepare-drop',from:Math.max(0,at-Math.max(decision.window.preSeconds,beat*1.5)),to:at,target:'music'},
        {kind:'impact-anchor',at,target:'fx'},
        {kind:'restore-energy',from:at,to:at+Math.max(decision.window.postSeconds,beat*.25),target:'music'}
      ];
    }
    if(decision.type==='build'){
      return [
        {kind:'build-window',from:Math.max(0,at-Math.max(decision.window.preSeconds,beat*4)),to:at,target:'music'},
        {kind:'riser-anchor',from:Math.max(0,at-beat*4),to:at,target:'fx'}
      ];
    }
    if(decision.type==='cut'){
      const half=Math.max(decision.window.preSeconds,beat*.25);
      return [
        {kind:'cut-window',from:Math.max(0,at-half),to:at+Math.max(decision.window.postSeconds,beat*.25),anchor:at,target:'music'}
      ];
    }
    return [];
  }

  function buildEditAction(decision,bpm,index){
    const normalized=normalizeDecision(decision,index);
    if(!normalized)return null;
    return {
      id:`edit-${normalized.id}`,
      sourceDecisionId:normalized.id,
      type:normalized.type,
      eight:normalized.eight,
      at:normalized.at,
      sectionId:normalized.sectionId,
      sectionType:normalized.sectionType,
      plannedEnergy:normalized.plannedEnergy,
      confidence:normalized.confidence,
      reason:normalized.reason,
      snap:{mode:'eight-start',bpm,at:normalized.at},
      steps:actionSteps(normalized,bpm),
      destructive:false,
      executable:false
    };
  }

  function detectConflicts(actions=[]){
    const issues=[];
    const byEight=new Map();
    for(const action of actions){
      const list=byEight.get(action.eight)||[];
      list.push(action);
      byEight.set(action.eight,list);
    }
    for(const [eight,list] of byEight){
      if(list.length<2)continue;
      const types=new Set(list.map(x=>x.type));
      if(types.has('break')&&types.has('drop'))issues.push({type:'opposing-energy-actions',eight,actionIds:list.map(x=>x.id)});
      if(types.has('cut')&&(types.has('build')||types.has('drop')))issues.push({type:'cut-with-energy-action',eight,actionIds:list.map(x=>x.id)});
    }
    return issues;
  }

  function createEditPlan(proposal,{minConfidence=.58}={}){
    if(!proposal||!Array.isArray(proposal.decisions))throw new Error('Smart Mix proposal decisions are required.');
    const bpm=finiteNumber(proposal.bpm);
    if(bpm<=0)throw new Error('Smart Mix proposal BPM is required.');
    const threshold=Math.max(0,Math.min(1,finiteNumber(minConfidence,.58)));
    const actions=proposal.decisions
      .filter(d=>d?.type!=='hold'&&finiteNumber(d?.confidence)>=threshold)
      .map((d,i)=>buildEditAction(d,bpm,i))
      .filter(Boolean)
      .sort((a,b)=>a.at-b.at||b.confidence-a.confidence);
    const conflicts=detectConflicts(actions);
    return {
      version:1,
      bpm,
      beatSeconds:beatSeconds(bpm),
      eightSeconds:eightSeconds(bpm),
      totalEights:finiteNumber(proposal.totalEights),
      executable:false,
      safePreviewOnly:true,
      actions,
      conflicts,
      summary:{
        actions:actions.length,
        conflicts:conflicts.length,
        readyForPreview:actions.length>0&&conflicts.length===0
      }
    };
  }

  const api={ACTION_KINDS,beatSeconds,eightSeconds,normalizeDecision,actionSteps,buildEditAction,detectConflicts,createEditPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixActionsCore=api;
})();
