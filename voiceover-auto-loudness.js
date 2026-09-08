((root,factory)=>{const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.CheerVoiceoverAutoLoudness=api;api.installBrowser();}})(typeof globalThis!=='undefined'?globalThis:this,root=>{
  'use strict';
  const cache=new Map();
  const finite=v=>Number.isFinite(Number(v));
  function isVoiceClip(clip){return String(clip?.type||'').toLowerCase()==='voice';}
  function needsAnalysis(clip){return isVoiceClip(clip)&&clip?.voiceoverLoudnessMeasurement?.kind!=='cheer-voiceover-loudness-measurement';}
  function currentState(){try{return typeof state!=='undefined'?state:null;}catch{return null;}}
  function findSourceTrack(project,clip){return(project?.tracks||[]).find(t=>t?.name===clip?.sourceName)||null;}
  async function decodeBrowserTrack(track){
    if(!track?.url)throw new Error('Voiceover source URL is unavailable');
    const AC=root.AudioContext||root.webkitAudioContext;if(!AC)throw new Error('AudioContext is unavailable');
    const ac=new AC();
    try{const data=await root.fetch(track.url).then(r=>{if(!r.ok&&typeof r.status==='number')throw new Error(`Audio fetch failed: ${r.status}`);return r.arrayBuffer();});return await ac.decodeAudioData(data);}finally{try{await ac.close();}catch{}}
  }
  function cacheKey(track){return String(track?.url||track?.name||'');}
  async function analyzeClipSource(clip,track,deps={}){
    if(!needsAnalysis(clip))return{status:'skipped',reason:isVoiceClip(clip)?'already-measured':'not-voice',clip};
    if(!track)return{status:'skipped',reason:'source-track-missing',clip};
    const core=deps.loudnessCore||root.CheerVoiceoverLoudnessAnalysisCore;if(!core?.measureAudioBuffer||!core?.metadataPatch)return{status:'skipped',reason:'loudness-core-missing',clip};
    const key=cacheKey(track);let measurement=key?cache.get(key):null;
    if(!measurement){const decode=deps.decodeTrack||decodeBrowserTrack,buffer=await decode(track);measurement=core.measureAudioBuffer(buffer);if(key)cache.set(key,measurement);}
    const patch=core.metadataPatch(measurement);Object.assign(clip,patch,{voiceoverLoudnessSource:'automatic-source-analysis'});
    return{status:'analyzed',clip,measurement,patch};
  }
  async function analyzeSelectedVoiceClip(deps={}){
    const project=deps.state||currentState(),clip=deps.clip||root.cheerAudioEditor?.getSelectedClip?.();
    if(!clip)return{status:'skipped',reason:'clip-missing'};
    return analyzeClipSource(clip,deps.track||findSourceTrack(project,clip),deps);
  }
  function persistAnalysis(result){if(result?.status!=='analyzed')return;try{if(typeof scheduleSave==='function')scheduleSave();else root.scheduleSave?.();}catch{}root.cheerTimelineAudioEngine?.refreshSchedule?.();}
  function installBrowser(){
    if(!root.document||root.__cheerVoiceoverAutoLoudnessInstalled)return false;
    const install=()=>{const button=root.document.querySelector('#btnAddClip');if(!button)return false;root.__cheerVoiceoverAutoLoudnessInstalled=true;button.addEventListener('click',()=>root.setTimeout(()=>{analyzeSelectedVoiceClip().then(persistAnalysis).catch(err=>console.warn('Voiceover loudness analysis skipped:',err?.message||err));},0));return true;};
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();return true;
  }
  function clearCache(){cache.clear();}
  return{isVoiceClip,needsAnalysis,findSourceTrack,analyzeClipSource,analyzeSelectedVoiceClip,installBrowser,clearCache,_cache:cache};
});
