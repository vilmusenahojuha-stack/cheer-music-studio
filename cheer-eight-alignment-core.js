(()=>{
  'use strict';

  const ALLOWED_TYPES=new Set(['break','drop','cut']);

  function finite(value,fallback=null){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp01(value){
    const n=finite(value,0);
    return Math.max(0,Math.min(1,n));
  }

  function normalizeTransitionAnchors(events=[]){
    const rows=Array.isArray(events)?events:[];
    return rows
      .map((event,index)=>{
        const type=String(event?.type||'').toLowerCase();
        const time=finite(event?.time);
        if(!ALLOWED_TYPES.has(type)||time===null||time<0)return null;
        const confidence=event?.confidence===undefined?1:clamp01(event.confidence);
        if(confidence<=0)return null;
        return {
          type,
          time,
          confidence,
          source:event?.source||event?.reason||'analysis',
          index
        };
      })
      .filter(Boolean)
      .sort((a,b)=>a.time-b.time||a.index-b.index);
  }

  function collectProfileTransitionAnchors(profile=[],options={},cores={}){
    const profileCore=cores.profileCore||(typeof window!=='undefined'?window.CheerAudioProfileCore:null);
    const detector=options.detectEvents||profileCore?.detectAudioEnergyEvents;
    const detected=typeof detector==='function'
      ?detector(profile,options.eventOptions||{})
      :[];
    const additional=Array.isArray(options.additionalEvents)?options.additionalEvents:[];
    return normalizeTransitionAnchors([...(Array.isArray(detected)?detected:[]),...additional]);
  }

  function alignProfileEightCounts(profile=[],options={},cores={}){
    const structureCore=cores.structureCore||(typeof window!=='undefined'?window.CheerStructureCore:null);
    if(typeof structureCore?.buildIntelligentEightCountMap!=='function'){
      return {
        accepted:false,
        source:'unavailable',
        reason:'structure-core-unavailable',
        anchors:[],
        alignment:null,
        map:[]
      };
    }

    const bpm=finite(options.bpm);
    if(!(bpm>0))throw new Error('bpm must be greater than zero.');

    const oneOffset=Math.max(0,finite(options.oneOffset,0));
    const anchors=collectProfileTransitionAnchors(profile,options,cores);
    const result=structureCore.buildIntelligentEightCountMap({
      bpm,
      oneOffset,
      totalEights:Array.isArray(profile)?profile.length:0,
      sections:Array.isArray(options.sections)?options.sections:[],
      anchors,
      minAlignmentConfidence:options.minAlignmentConfidence,
      minAlignmentSupport:options.minAlignmentSupport,
      maxResidualBeats:options.maxResidualBeats
    });

    return {
      ...result,
      anchors,
      diagnosticOnly:true,
      nonDestructive:true
    };
  }

  const api={normalizeTransitionAnchors,collectProfileTransitionAnchors,alignProfileEightCounts};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerEightAlignmentCore=api;
})();