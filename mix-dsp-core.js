((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerMixDSP=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  function rateForClip(clip,trackAnalysis={},targetBpm=147){
    const c=clip||{};if(c.type!=='music')return 1;
    const a=trackAnalysis?.[c.sourceName]||{},bpm=num(a.bpm||a.autoBpm),target=Math.max(1,num(targetBpm,147));
    return bpm>0?clamp(target/bpm,.5,2):1;
  }
  function clipEnvelopeAt(clip,t){
    const c=clip||{},start=num(c.start),dur=Math.max(0,num(c.duration)),local=num(t)-start;
    if(local<0||local>dur)return 0;
    const base=clamp(num(c.volume,1),0,1),fi=clamp(num(c.fadeIn),0,dur),fo=clamp(num(c.fadeOut),0,dur);let env=1;
    if(fi>0&&local<fi)env=Math.min(env,local/fi);
    const remain=Math.max(0,dur-local);if(fo>0&&remain<fo)env=Math.min(env,remain/fo);
    return clamp(base*env,0,1);
  }
  function voiceWindows(clips=[],settings={}){
    if(settings?.autoDuck===false)return[];
    const attack=clamp(num(settings?.duckAttack,.08),.01,1),release=clamp(num(settings?.duckRelease,.18),.01,2),duck=Math.pow(10,clamp(num(settings?.duckDb,-7),-18,0)/20);
    return(clips||[]).filter(v=>v?.type==='voice'&&clamp(num(v.volume,1),0,1)>0&&num(v.duration)>0).map(v=>{const s=num(v.start),d=Math.max(0,num(v.duration));return{start:s-attack,voiceStart:s,voiceEnd:s+d,end:s+d+release,attack,release,duck}}).sort((a,b)=>a.start-b.start);
  }
  function duckFactorAt(t,clips=[],settings={}){
    if(settings?.autoDuck===false)return 1;let f=1;
    for(const w of voiceWindows(clips,settings)){
      if(t<=w.start||t>=w.end)continue;let x=w.duck;
      if(t<w.voiceStart)x=1-(1-w.duck)*clamp((t-w.start)/Math.max(.000001,w.attack),0,1);
      else if(t>w.voiceEnd)x=w.duck+(1-w.duck)*clamp((t-w.voiceEnd)/Math.max(.000001,w.release),0,1);
      f=Math.min(f,x);
    }
    return clamp(f,0,1);
  }
  function uniqueTimes(values,start,end){return[...new Set(values.filter(v=>Number.isFinite(v)&&v>=start&&v<=end).map(v=>Math.round(v*1e9)/1e9))].sort((a,b)=>a-b)}
  function clipAutomationPoints(clip,start,end){
    const c=clip||{},cs=num(c.start),dur=Math.max(0,num(c.duration)),ce=cs+dur,fi=clamp(num(c.fadeIn),0,dur),fo=clamp(num(c.fadeOut),0,dur),s=Math.max(start,cs),e=Math.min(end,ce);
    if(!(e>s))return[];const times=uniqueTimes([s,e,cs,cs+fi,ce-fo,ce],s,e);return times.map(t=>[t,clipEnvelopeAt(c,t)]);
  }
  function duckAutomationPoints(clip,clips,start,end,settings={}){
    if(clip?.type!=='music'||settings?.autoDuck===false)return[[start,1],[end,1]];
    const times=[start,end];for(const w of voiceWindows(clips,settings))times.push(w.start,w.voiceStart,w.voiceEnd,w.end);
    return uniqueTimes(times,start,end).map(t=>[t,duckFactorAt(t,clips,settings)]);
  }
  function scheduleParam(param,points,contextOrigin,timelineOrigin,floor=0.000001){
    if(!param||!Array.isArray(points)||!points.length)return;
    const sorted=[...points].sort((a,b)=>a[0]-b[0]);const at=t=>num(contextOrigin)+(t-num(timelineOrigin));
    param.cancelScheduledValues?.(Math.max(0,at(sorted[0][0])));
    sorted.forEach((p,i)=>{const ct=Math.max(0,at(p[0])),v=Math.max(floor,num(p[1]));if(i===0)param.setValueAtTime(v,ct);else param.linearRampToValueAtTime(v,ct)});
  }
  return{clamp,num,rateForClip,clipEnvelopeAt,voiceWindows,duckFactorAt,clipAutomationPoints,duckAutomationPoints,scheduleParam};
});