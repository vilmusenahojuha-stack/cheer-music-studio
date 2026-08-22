((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerAudioTiming=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  function timelineTime(contextTime,timelineAnchor,contextAnchor){
    const ta=Math.max(0,n(timelineAnchor)),ca=n(contextAnchor,-1),ct=n(contextTime,ca);
    if(ca<0||ct<=ca)return ta;
    return ta+(ct-ca);
  }
  function computeClipSchedule({clip,playFrom=0,contextStart=0,bufferDuration=Infinity,rate=1}){
    const c=clip||{},clipStart=Math.max(0,n(c.start)),clipDuration=Math.max(0,n(c.duration)),clipEnd=clipStart+clipDuration;
    const from=Math.max(0,n(playFrom)),r=Math.max(.000001,n(rate,1)),buf=Math.max(0,n(bufferDuration,Infinity));
    if(clipDuration<=0||clipEnd<=from)return null;
    const timelineStart=Math.max(from,clipStart),localTimeline=Math.max(0,timelineStart-clipStart);
    const sourceOffset=Math.max(0,n(c.sourceOffset)+localTimeline*r);
    if(sourceOffset>=buf)return null;
    const availableTimeline=(buf-sourceOffset)/r;
    const timelineDuration=Math.min(clipEnd-timelineStart,availableTimeline);
    if(!(timelineDuration>.001))return null;
    return{
      clipStart,clipEnd,timelineStart,
      when:n(contextStart)+Math.max(0,timelineStart-from),
      sourceOffset,timelineDuration,
      bufferPlayDuration:timelineDuration*r,
      rate:r
    };
  }
  function envelopeAt(clip,timelineTimeValue){
    const c=clip||{},start=n(c.start),dur=Math.max(0,n(c.duration)),local=n(timelineTimeValue)-start;
    if(local<0||local>dur)return 0;
    const base=Math.max(0,Math.min(1,n(c.volume,1))),fi=Math.max(0,n(c.fadeIn)),fo=Math.max(0,n(c.fadeOut));
    let env=1;if(fi>0&&local<fi)env=Math.min(env,local/fi);const remain=Math.max(0,dur-local);if(fo>0&&remain<fo)env=Math.min(env,remain/fo);
    return Math.max(0,Math.min(1,base*env));
  }
  return{timelineTime,computeClipSchedule,envelopeAt};
});