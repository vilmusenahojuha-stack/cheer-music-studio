(()=>{
  'use strict';

  const ALLOWED_SECTIONS=new Set(['stunt','basket','pyramid','ending']);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};

  function impactRenderSpec(anchor={}){
    const sectionType=String(anchor.sectionType||'').toLowerCase();
    if(anchor.kind!=='impact'||!ALLOWED_SECTIONS.has(sectionType))return null;
    const at=finite(anchor.at,NaN);
    if(!Number.isFinite(at)||at<0)return null;
    const confidence=clamp(finite(anchor.confidence,.72),0,1);
    const sectionWeight=sectionType==='basket'?1:sectionType==='ending'?.96:sectionType==='stunt'?.92:.88;
    const strength=clamp((.62+.38*confidence)*sectionWeight,.45,1);
    return{
      id:String(anchor.id||`cheer-impact-${Math.round(at*1000)}`),
      kind:'impact',
      at,
      duration:.16,
      sectionId:anchor.sectionId||null,
      sectionType,
      confidence,
      strength,
      low:{wave:'sine',startHz:72,endHz:46,duration:.16,gain:.085*strength},
      transient:{wave:'triangle',startHz:920,endHz:210,duration:.042,gain:.038*strength},
      preservesTimelineTiming:true,
      nonDestructive:true
    };
  }

  function riserRenderSpec(anchor={}){
    const sectionType=String(anchor.sectionType||'').toLowerCase();
    if(anchor.kind!=='riser'||!ALLOWED_SECTIONS.has(sectionType))return null;
    const at=finite(anchor.at,NaN),duration=finite(anchor.duration,0),endAt=finite(anchor.endAt,at+duration);
    if(!Number.isFinite(at)||at<0||!(duration>0)||!Number.isFinite(endAt)||endAt<=at)return null;
    const confidence=clamp(finite(anchor.confidence,.72),0,1);
    const strength=clamp(.45+.35*confidence,.35,.8);
    return{
      id:String(anchor.id||`cheer-riser-${Math.round(at*1000)}`),
      kind:'riser',
      at,
      endAt,
      duration:Math.min(duration,endAt-at),
      sectionId:anchor.sectionId||null,
      sectionType,
      confidence,
      strength,
      sweep:{wave:'sawtooth',startHz:220,endHz:1450,duration:Math.min(duration,endAt-at),gain:.018*strength},
      preservesTimelineTiming:true,
      nonDestructive:true
    };
  }

  function renderSpec(anchor={}){
    return anchor?.kind==='riser'?riserRenderSpec(anchor):impactRenderSpec(anchor);
  }

  function buildRenderEvents(anchors=[],duration=Infinity){
    const limit=Number.isFinite(Number(duration))?Math.max(0,Number(duration)):Infinity;
    return(Array.isArray(anchors)?anchors:[])
      .map(renderSpec)
      .filter(Boolean)
      .filter(event=>event.at<=limit&&event.at+event.duration<=limit+1e-9)
      .sort((a,b)=>a.at-b.at||(a.kind==='riser'?-1:1));
  }

  const api={ALLOWED_SECTIONS,impactRenderSpec,riserRenderSpec,renderSpec,buildRenderEvents};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxRenderCore=api;
})();
