(()=>{
  'use strict';

  const PREVIEW_KINDS=Object.freeze(['gain-ramp','space','prepare-drop','impact-anchor','restore-energy','build-window','riser-anchor','cut-window']);

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp(value,min,max){return Math.min(max,Math.max(min,value));}

  function normalizeStep(step,action){
    if(!step||!PREVIEW_KINDS.includes(step.kind))return null;
    const base={
      kind:step.kind,
      actionId:action.id,
      actionType:action.type,
      eight:action.eight,
      confidence:clamp(finiteNumber(action.confidence,.5),0,1),
      target:step.target||null
    };
    if(Number.isFinite(Number(step.at))){
      const at=Math.max(0,finiteNumber(step.at));
      return {...base,from:at,to:at,at};
    }
    const from=Math.max(0,finiteNumber(step.from,action.at));
    const to=Math.max(from,finiteNumber(step.to,from));
    const extra={};
    if(Number.isFinite(Number(step.anchor)))extra.anchor=Math.max(0,finiteNumber(step.anchor));
    if(Number.isFinite(Number(step.valueFrom)))extra.valueFrom=finiteNumber(step.valueFrom);
    if(Number.isFinite(Number(step.valueTo)))extra.valueTo=finiteNumber(step.valueTo);
    return {...base,from,to,...extra};
  }

  function severityFor(action){
    const confidence=clamp(finiteNumber(action?.confidence,.5),0,1);
    const base=action?.type==='cut'?.72:action?.type==='drop'?.68:action?.type==='break'?.56:.48;
    return clamp(base+(confidence-.5)*.35,0,1);
  }

  function buildPreviewEvents(editPlan){
    if(!editPlan||!Array.isArray(editPlan.actions))throw new Error('Edit plan actions are required.');
    if(editPlan.conflicts?.length)throw new Error('Edit plan contains conflicts and cannot be previewed safely.');
    const events=[];
    for(const action of editPlan.actions){
      for(const step of action.steps||[]){
        const normalized=normalizeStep(step,action);
        if(!normalized)continue;
        events.push({...normalized,severity:severityFor(action)});
      }
    }
    return events.sort((a,b)=>a.from-b.from||b.severity-a.severity||String(a.kind).localeCompare(String(b.kind)));
  }

  function samplePreview(events,{from=0,to=null,resolution=.05}={}){
    if(!Array.isArray(events))throw new Error('Preview events are required.');
    const start=Math.max(0,finiteNumber(from));
    const inferredEnd=events.reduce((m,e)=>Math.max(m,finiteNumber(e.to,e.from)),start);
    const end=Math.max(start,to==null?inferredEnd:finiteNumber(to,inferredEnd));
    const step=Math.max(.01,finiteNumber(resolution,.05));
    const samples=[];
    for(let t=start;t<=end+step*.25;t+=step){
      const time=Math.min(end,t);
      let musicGain=1;
      let space=false;
      let build=0;
      let dropPrep=0;
      let restore=0;
      const markers=[];
      for(const e of events){
        const instant=Math.abs(e.to-e.from)<1e-9;
        if(instant){
          if(Math.abs(time-e.from)<=step*.5)markers.push(e.kind);
          continue;
        }
        if(time<e.from||time>e.to)continue;
        const p=clamp((time-e.from)/Math.max(1e-9,e.to-e.from),0,1);
        if(e.kind==='gain-ramp'){
          const a=Number.isFinite(e.valueFrom)?e.valueFrom:1;
          const b=Number.isFinite(e.valueTo)?e.valueTo:.28;
          musicGain=Math.min(musicGain,a+(b-a)*p);
        }else if(e.kind==='space'){
          space=true;musicGain=Math.min(musicGain,.18);
        }else if(e.kind==='build-window')build=Math.max(build,p*e.severity);
        else if(e.kind==='prepare-drop')dropPrep=Math.max(dropPrep,p*e.severity);
        else if(e.kind==='restore-energy')restore=Math.max(restore,(1-p)*e.severity);
        else if(e.kind==='cut-window'&&Math.abs(time-(e.anchor??e.from))<=step)markers.push('cut-anchor');
      }
      samples.push({time,musicGain,space,build,dropPrep,restore,markers:[...new Set(markers)]});
      if(time===end)break;
    }
    return samples;
  }

  function createPreview(editPlan,options={}){
    if(editPlan?.safePreviewOnly!==true)throw new Error('Edit plan must be marked safePreviewOnly.');
    const events=buildPreviewEvents(editPlan);
    const samples=samplePreview(events,options);
    const actionTypes={};
    for(const action of editPlan.actions||[])actionTypes[action.type]=(actionTypes[action.type]||0)+1;
    return {
      version:1,
      bpm:finiteNumber(editPlan.bpm),
      nonDestructive:true,
      executable:false,
      events,
      samples,
      summary:{actions:(editPlan.actions||[]).length,events:events.length,actionTypes,previewStart:samples[0]?.time??0,previewEnd:samples.at(-1)?.time??0}
    };
  }

  const api={PREVIEW_KINDS,normalizeStep,severityFor,buildPreviewEvents,samplePreview,createPreview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixPreviewCore=api;
})();
