(()=>{
  'use strict';

  const ACTION_PRIORITY=Object.freeze({break:5,drop:4,build:3,cut:2,hold:1});
  const ENERGY_ORDER=Object.freeze({low:0,medium:1,high:2,peak:3});

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp01(value){return Math.max(0,Math.min(1,finiteNumber(value)));}

  function normalizeConfidence(value,fallback=.5){
    const n=Number(value);
    return Number.isFinite(n)?clamp01(n):fallback;
  }

  function energyRank(value){
    return Object.prototype.hasOwnProperty.call(ENERGY_ORDER,value)?ENERGY_ORDER[value]:1;
  }

  function actionForRow(row,previousRow){
    const transition=row?.transition||null;
    const plannedRank=energyRank(row?.energy);
    const previousRank=energyRank(previousRow?.energy);
    const alignment=row?.energyAlignment||null;
    const actions=[];

    if(transition?.type==='break'){
      actions.push({type:'break',confidence:normalizeConfidence(transition.confidence,.72),reason:transition.reason||'planned-break'});
    }
    if(transition?.type==='drop'){
      actions.push({type:'drop',confidence:normalizeConfidence(transition.confidence,.72),reason:transition.reason||'planned-drop'});
    }
    if(transition?.type==='cut'){
      actions.push({type:'cut',confidence:normalizeConfidence(transition.confidence,.64),reason:transition.reason||'section-boundary'});
    }

    if(previousRow && plannedRank>previousRank && (!transition || transition.type!=='drop')){
      const strength=Math.min(3,plannedRank-previousRank);
      actions.push({type:'build',confidence:clamp01(.55+strength*.12),reason:'planned-energy-rise'});
    }

    if(alignment?.status==='much-lower'){
      actions.push({type:'build',confidence:clamp01(.68+finiteNumber(alignment.distance)*.35),reason:'audio-below-planned-energy'});
    }else if(alignment?.status==='much-higher' && plannedRank<=1){
      actions.push({type:'break',confidence:clamp01(.66+finiteNumber(alignment.distance)*.3),reason:'audio-above-planned-low-energy'});
    }

    if(!actions.length){
      actions.push({type:'hold',confidence:.5,reason:'no-strong-edit-needed'});
    }

    actions.sort((a,b)=>b.confidence-a.confidence||(ACTION_PRIORITY[b.type]||0)-(ACTION_PRIORITY[a.type]||0));
    return actions;
  }

  function recommendedWindow(type,bpm){
    const beat=60/Math.max(1,finiteNumber(bpm,148));
    if(type==='break')return {preSeconds:beat*.5,postSeconds:beat*.25};
    if(type==='drop')return {preSeconds:beat*1.5,postSeconds:beat*.25};
    if(type==='build')return {preSeconds:beat*4,postSeconds:0};
    if(type==='cut')return {preSeconds:beat*.25,postSeconds:beat*.25};
    return {preSeconds:0,postSeconds:0};
  }

  function buildSmartMixDecisions(plan,{minConfidence=.58,maxActionsPerEight=2}={}){
    if(!plan||!Array.isArray(plan.timeline))throw new Error('Cheer plan timeline is required.');
    const threshold=clamp01(minConfidence);
    const limit=Math.max(1,Math.floor(finiteNumber(maxActionsPerEight,2)));
    const decisions=[];

    for(let i=0;i<plan.timeline.length;i++){
      const row=plan.timeline[i];
      const previous=i?plan.timeline[i-1]:null;
      const actions=actionForRow(row,previous)
        .filter(action=>action.type==='hold'||action.confidence>=threshold)
        .slice(0,limit)
        .map((action,index)=>({
          id:`eight-${row.eight}-${action.type}-${index+1}`,
          eight:row.eight,
          at:finiteNumber(row.start),
          sectionId:row.sectionId||null,
          sectionType:row.sectionType||null,
          plannedEnergy:row.energy||null,
          type:action.type,
          confidence:action.confidence,
          reason:action.reason,
          priority:ACTION_PRIORITY[action.type]||0,
          window:recommendedWindow(action.type,plan.bpm)
        }));
      decisions.push(...actions);
    }

    return decisions;
  }

  function summarizeSmartMix(decisions=[]){
    const counts={break:0,drop:0,build:0,cut:0,hold:0};
    let actionable=0;
    let confidenceSum=0;
    for(const decision of decisions){
      if(Object.prototype.hasOwnProperty.call(counts,decision.type))counts[decision.type]++;
      if(decision.type!=='hold'){
        actionable++;
        confidenceSum+=normalizeConfidence(decision.confidence,0);
      }
    }
    return {
      total:decisions.length,
      actionable,
      counts,
      averageActionConfidence:actionable?confidenceSum/actionable:null
    };
  }

  function createSmartMixProposal(plan,options={}){
    const decisions=buildSmartMixDecisions(plan,options);
    return {
      version:1,
      bpm:Number(plan?.bpm)||null,
      totalEights:Number(plan?.totalEights)||plan?.timeline?.length||0,
      summary:summarizeSmartMix(decisions),
      decisions
    };
  }

  const api={ACTION_PRIORITY,ENERGY_ORDER,energyRank,actionForRow,recommendedWindow,buildSmartMixDecisions,summarizeSmartMix,createSmartMixProposal};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixCore=api;
})();
