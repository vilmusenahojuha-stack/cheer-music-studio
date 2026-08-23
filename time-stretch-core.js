((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerTimeStretch=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const EPS=1e-6;
  function needsStretch(rate){return Math.abs(num(rate,1)-1)>1e-4}
  function renderedSourceOffset(sourceSeconds,rate){return Math.max(0,num(sourceSeconds))/Math.max(EPS,num(rate,1))}
  function renderedDuration(originalSeconds,rate){return Math.max(0,num(originalSeconds))/Math.max(EPS,num(rate,1))}
  function copyChannels(channels){return channels.map(ch=>Float32Array.from(ch))}
  function normalizeChannels(channels){if(!Array.isArray(channels)||!channels.length)throw new Error('Time-stretch tarvitsee vähintään yhden audiokanavan.');const len=channels[0]?.length||0;if(!len)throw new Error('Time-stretch ei saanut audiodataa.');for(const ch of channels)if(!ch||ch.length!==len)throw new Error('Audiokanavien pituudet eivät täsmää.');return len}
  function correlation(out,channels,outPos,inPos,overlap,step){let dot=0,aa=0,bb=0,count=0;const channelCount=channels.length;for(let j=0;j<overlap;j+=step){let a=0,b=0;for(let ch=0;ch<channelCount;ch++){a+=out[ch][outPos+j]||0;b+=channels[ch][inPos+j]||0}a/=channelCount;b/=channelCount;dot+=a*b;aa+=a*a;bb+=b*b;count++}if(!count||aa<EPS||bb<EPS)return-Infinity;return dot/Math.sqrt(aa*bb)}
  function stretchChannels(channels,sampleRate,rate,options={}){
    const inputLength=normalizeChannels(channels),sr=Math.max(8000,num(sampleRate,48000)),r=clamp(num(rate,1),.5,2);
    if(!needsStretch(r))return copyChannels(channels);
    const outputLength=Math.max(1,Math.round(inputLength/r));
    const frame=Math.max(256,Math.round(sr*num(options.frameSeconds,.04)));
    const overlap=Math.max(64,Math.min(frame-64,Math.round(sr*num(options.overlapSeconds,.012))));
    const synthesisHop=Math.max(64,frame-overlap);
    const search=Math.max(0,Math.round(sr*num(options.searchSeconds,.006)));
    const candidateStep=Math.max(1,Math.round(num(options.candidateStep,8))),correlationStep=Math.max(1,Math.round(num(options.correlationStep,16)));
    const onFrame=typeof options.onFrame==='function'?options.onFrame:null;
    const out=channels.map(()=>new Float32Array(outputLength));
    const firstCount=Math.min(frame,inputLength,outputLength);for(let ch=0;ch<channels.length;ch++)out[ch].set(channels[ch].subarray(0,firstCount),0);
    let synthPos=synthesisHop;const maxStart=Math.max(0,inputLength-1);
    while(synthPos<outputLength){
      const expected=synthPos*r;let best=Math.round(expected),bestScore=-Infinity;const lo=Math.max(0,Math.floor(expected-search)),hi=Math.min(maxStart,Math.ceil(expected+search));
      if(hi>=lo){for(let cand=lo;cand<=hi;cand+=candidateStep){const score=correlation(out,channels,synthPos,cand,Math.min(overlap,outputLength-synthPos,inputLength-cand),correlationStep);if(score>bestScore){bestScore=score;best=cand}}if((hi-lo)%candidateStep!==0){const score=correlation(out,channels,synthPos,hi,Math.min(overlap,outputLength-synthPos,inputLength-hi),correlationStep);if(score>bestScore)best=hi}}
      best=clamp(Math.round(best),0,maxStart);onFrame?.({synthesisPosition:synthPos,expectedInputPosition:expected,inputPosition:best,driftSamples:best-expected,searchSamples:search});
      const remainingOut=outputLength-synthPos,remainingIn=inputLength-best,write=Math.min(frame,remainingOut,remainingIn),ov=Math.min(overlap,write);
      for(let ch=0;ch<channels.length;ch++){const src=channels[ch],dst=out[ch];for(let j=0;j<ov;j++){const w=(j+1)/(ov+1);dst[synthPos+j]=dst[synthPos+j]*(1-w)+src[best+j]*w}if(write>ov)dst.set(src.subarray(best+ov,best+write),synthPos+ov)}
      synthPos+=synthesisHop;if(write<=0)break;
    }
    return out;
  }
  function stretchAudioBuffer(context,inputBuffer,rate,options={}){
    if(!inputBuffer)return null;const r=clamp(num(rate,1),.5,2);if(!needsStretch(r))return inputBuffer;
    const channels=[];for(let ch=0;ch<inputBuffer.numberOfChannels;ch++)channels.push(inputBuffer.getChannelData(ch));
    const stretched=stretchChannels(channels,inputBuffer.sampleRate,r,options),length=stretched[0].length;
    const out=context.createBuffer(inputBuffer.numberOfChannels,length,inputBuffer.sampleRate);for(let ch=0;ch<stretched.length;ch++)out.copyToChannel?out.copyToChannel(stretched[ch],ch):out.getChannelData(ch).set(stretched[ch]);return out;
  }
  return{needsStretch,renderedSourceOffset,renderedDuration,stretchChannels,stretchAudioBuffer};
});