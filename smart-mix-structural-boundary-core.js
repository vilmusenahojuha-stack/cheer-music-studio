(()=>{
  'use strict';

  function finite(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp01(value){
    return Math.max(0,Math.min(1,finite(value)));
  }

  function sourceKey(row={}){
    return row.trackId?`id:${row.trackId}`:row.sourceName?`name:${row.sourceName}`:null;
  }

  function sameSource(a={},b={}){
    const ak=sourceKey(a),bk=sourceKey(b);
    return !ak||!bk||ak===bk;
  }

  function normalizeBoundary(row={},kind='phrase'){
    const startEight=Math.max(1,Math.round(finite(row.startEight,row.eight)));
    const endEight=Math.max(startEight,Math.round(finite(row.endEight,startEight)));
    const confidence=clamp01(row.confidence===undefined?1:row.confidence);
    return {
      kind,
      startEight,
      endEight,
      confidence,
      sourceName:row.sourceName==null?null:String(row.sourceName),
      trackId:row.trackId==null?null:String(row.trackId),
      id:row.id==null?(row.phrase==null?null:String(row.phrase)):String(row.id)
    };
  }

  function detectedBoundaries({phrases=[],sections=[],minConfidence=.72}={}){
    const threshold=clamp01(minConfidence);
    const out=[];
    for(const row of Array.isArray(phrases)?phrases:[]){
      const boundary=normalizeBoundary(row,'phrase');
      if(boundary.confidence>=threshold)out.push(boundary);
    }
    for(const row of Array.isArray(sections)?sections:[]){
      const boundary=normalizeBoundary(row,'section');
      if(boundary.confidence>=threshold)out.push(boundary);
    }
    return out.sort((a,b)=>a.startEight-b.startEight||a.endEight-b.endEight||a.kind.localeCompare(b.kind));
  }

  function edgeConfidence(candidate,boundaries,edge){
    const eight=edge==='start'
      ?Math.max(1,Math.round(finite(candidate.startEight,1)))
      :Math.max(1,Math.round(finite(candidate.endEight,1)));
    let best=0;
    let kind=null;
    for(const boundary of boundaries){
      if(!sameSource(candidate,boundary))continue;
      const matches=edge==='start'?boundary.startEight===eight:boundary.endEight===eight;
      if(!matches)continue;
      const kindBoost=boundary.kind==='section'?1:.92;
      const score=clamp01(boundary.confidence*kindBoost);
      if(score>best){best=score;kind=boundary.kind;}
    }
    return {score:best,kind,matched:best>0};
  }

  function structuralBoundaryFit(candidate={},options={}){
    const boundaries=detectedBoundaries(options);
    if(!boundaries.length){
      return {
        source:'fallback',
        score:null,
        start:{score:0,kind:null,matched:false},
        end:{score:0,kind:null,matched:false},
        usableBoundaries:0
      };
    }
    const sourceBoundaries=boundaries.filter(row=>sameSource(candidate,row));
    if(!sourceBoundaries.length){
      return {
        source:'fallback',
        score:null,
        start:{score:0,kind:null,matched:false},
        end:{score:0,kind:null,matched:false},
        usableBoundaries:0
      };
    }
    const start=edgeConfidence(candidate,sourceBoundaries,'start');
    const end=edgeConfidence(candidate,sourceBoundaries,'end');
    const score=start.matched&&end.matched
      ?clamp01((start.score+end.score)/2)
      :(start.matched||end.matched?clamp01(Math.max(start.score,end.score)*.58):.15);
    return {source:'detected',score,start,end,usableBoundaries:sourceBoundaries.length};
  }

  const api={sourceKey,sameSource,normalizeBoundary,detectedBoundaries,edgeConfidence,structuralBoundaryFit};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixStructuralBoundaryCore=api;
})();
