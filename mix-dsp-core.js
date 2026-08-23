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

((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports.CheerTimeStretch=api;else root.CheerTimeStretch=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function nextPow2(n){let p=1;while(p<n)p<<=1;return p}
  function chooseWindow(sampleRate){return clamp(nextPow2(Math.round(sampleRate*.07)),2048,8192)}
  function monoAt(channels,index){let s=0;for(let c=0;c<channels.length;c++)s+=channels[c][index]||0;return s/Math.max(1,channels.length)}
  function correlation(channels,prevStart,candStart,overlap,step=16){
    let dot=0,a2=0,b2=0;
    const prevOverlap=prevStart+overlap;
    for(let i=0;i<overlap;i+=step){const a=monoAt(channels,prevOverlap+i),b=monoAt(channels,candStart+i);dot+=a*b;a2+=a*a;b2+=b*b}
    return dot/Math.sqrt(Math.max(1e-12,a2*b2));
  }
  function bestMatch(channels,prevStart,expected,maxStart,overlap,searchRadius){
    const lo=Math.max(0,Math.floor(expected-searchRadius)),hi=Math.min(maxStart,Math.ceil(expected+searchRadius));
    let best=clamp(Math.round(expected),lo,hi),bestScore=-Infinity;
    const searchStep=Math.max(4,Math.floor(searchRadius/40));
    for(let cand=lo;cand<=hi;cand+=searchStep){const score=correlation(channels,prevStart,cand,overlap,16);if(score>bestScore){bestScore=score;best=cand}}
    return best;
  }
  function stretchAudioBuffer(context,input,rate){
    rate=Number(rate);if(!Number.isFinite(rate)||rate<=0)throw new Error('Virheellinen time-stretch nopeus.');
    if(Math.abs(rate-1)<1e-4)return input;
    const sr=input.sampleRate,channels=[];for(let c=0;c<input.numberOfChannels;c++)channels.push(input.getChannelData(c));
    const outLength=Math.max(1,Math.round(input.length/rate)),out=context.createBuffer(input.numberOfChannels,outLength,sr),outs=[];for(let c=0;c<out.numberOfChannels;c++)outs.push(out.getChannelData(c));
    const win=Math.min(chooseWindow(sr),Math.max(512,input.length)),overlap=Math.floor(win/2),synthHop=overlap,analysisHop=synthHop*rate,searchRadius=Math.min(Math.floor(sr*.014),Math.floor(overlap*.45)),maxStart=Math.max(0,input.length-win);
    const firstCount=Math.min(win,outLength,input.length);for(let c=0;c<channels.length;c++)outs[c].set(channels[c].subarray(0,firstCount),0);
    let prevIn=0,outPos=synthHop,frames=1;
    while(outPos<outLength&&prevIn<maxStart){const expected=prevIn+analysisHop,best=bestMatch(channels,prevIn,expected,maxStart,overlap,searchRadius),remain=Math.min(win,outLength-outPos,input.length-best);if(remain<=0)break;
      const blend=Math.min(overlap,remain);
      for(let c=0;c<channels.length;c++){const src=channels[c],dst=outs[c];for(let i=0;i<blend;i++){const x=i/Math.max(1,blend-1),a=Math.cos(x*Math.PI*.5),b=Math.sin(x*Math.PI*.5);dst[outPos+i]=dst[outPos+i]*a+src[best+i]*b}for(let i=blend;i<remain;i++)dst[outPos+i]=src[best+i]}
      prevIn=best;outPos+=synthHop;frames++;
      if(frames>Math.ceil(outLength/Math.max(1,synthHop))+4)break;
    }
    return out;
  }
  function renderedSourceOffset(sourceOffset,rate){return Math.max(0,Number(sourceOffset)||0)/Math.max(.000001,Number(rate)||1)}
  function outputDuration(inputDuration,rate){return Math.max(0,Number(inputDuration)||0)/Math.max(.000001,Number(rate)||1)}
  return{stretchAudioBuffer,renderedSourceOffset,outputDuration,algorithm:'WSOLA-v1'};
});