((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerTimeStretch=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const EPS=1e-9;
  function needsStretch(rate){return Math.abs(num(rate,1)-1)>1e-4}
  function renderedSourceOffset(sourceSeconds,rate){return Math.max(0,num(sourceSeconds))/Math.max(EPS,num(rate,1))}
  function renderedDuration(originalSeconds,rate){return Math.max(0,num(originalSeconds))/Math.max(EPS,num(rate,1))}
  function normalizeChannels(channels){if(!Array.isArray(channels)||!channels.length)throw new Error('Time-stretch tarvitsee vähintään yhden audiokanavan.');const len=channels[0]?.length||0;if(!len)throw new Error('Time-stretch ei saanut audiodataa.');for(const ch of channels)if(!ch||ch.length!==len)throw new Error('Audiokanavien pituudet eivät täsmää.');return len}
  function copyChannels(channels){return channels.map(ch=>Float32Array.from(ch))}
  function monoAt(channels,i){let s=0;for(let c=0;c<channels.length;c++)s+=channels[c][i]||0;return s/Math.max(1,channels.length)}
  function correlation(channels,prevStart,candStart,overlap,step,inputLength){const refStart=prevStart+overlap,available=Math.min(overlap,inputLength-refStart,inputLength-candStart);if(available<64)return-Infinity;let dot=0,a2=0,b2=0,count=0;for(let i=0;i<available;i+=step){const a=monoAt(channels,refStart+i),b=monoAt(channels,candStart+i);dot+=a*b;a2+=a*a;b2+=b*b;count++}if(!count||a2<EPS||b2<EPS)return-Infinity;return dot/Math.sqrt(a2*b2)}
  function bestCandidate(channels,prevStart,ideal,predicted,maxStart,overlap,searchRadius,driftLimit,candidateStep,correlationStep,inputLength){
    const center=clamp(predicted,ideal-driftLimit,ideal+driftLimit),lo=Math.max(0,Math.floor(Math.max(center-searchRadius,ideal-driftLimit))),hi=Math.min(maxStart,Math.ceil(Math.min(center+searchRadius,ideal+driftLimit)));let best=clamp(Math.round(center),Math.min(lo,hi),Math.max(lo,hi)),score=-Infinity;
    if(hi<lo)return{index:clamp(Math.round(ideal),0,maxStart),score};
    for(let c=lo;c<=hi;c+=candidateStep){const s=correlation(channels,prevStart,c,overlap,correlationStep,inputLength);if(s>score+1e-9||(Math.abs(s-score)<=1e-9&&Math.abs(c-center)<Math.abs(best-center))){score=s;best=c}}
    for(const c of [clamp(Math.round(center),lo,hi),hi]){const s=correlation(channels,prevStart,c,overlap,correlationStep,inputLength);if(s>score+1e-9||(Math.abs(s-score)<=1e-9&&Math.abs(c-center)<Math.abs(best-center))){score=s;best=c}}
    return{index:best,score};
  }
  function stretchChannels(channels,sampleRate,rate,options={}){
    const inputLength=normalizeChannels(channels),sr=Math.max(8000,num(sampleRate,48000)),r=clamp(num(rate,1),.5,2);
    if(!needsStretch(r))return copyChannels(channels);
    const outputLength=Math.max(1,Math.round(inputLength/r));
    const frame=Math.max(1024,Math.min(8192,Math.pow(2,Math.ceil(Math.log2(sr*num(options.frameSeconds,.07))))));
    const overlap=Math.floor(frame/2),synthesisHop=overlap,analysisHop=synthesisHop*r;
    const searchRadius=Math.min(Math.floor(sr*num(options.searchSeconds,.014)),Math.floor(overlap*.45)),driftLimit=Math.min(searchRadius,Math.max(1,Math.floor(sr*num(options.driftSeconds,.006))));
    const candidateStep=Math.max(4,Math.floor(num(options.candidateStep,Math.max(8,searchRadius/40)))),correlationStep=Math.max(4,Math.floor(num(options.correlationStep,16))),onFrame=typeof options.onFrame==='function'?options.onFrame:null;
    const maxStart=Math.max(0,inputLength-1),out=channels.map(()=>new Float32Array(outputLength));
    const first=Math.min(frame,inputLength,outputLength);for(let ch=0;ch<channels.length;ch++)out[ch].set(channels[ch].subarray(0,first),0);
    let prevIn=0,outPos=synthesisHop,frames=1;
    while(outPos<outputLength){
      const ideal=outPos*r,predicted=prevIn+analysisHop,{index:best,score}=bestCandidate(channels,prevIn,ideal,predicted,maxStart,overlap,searchRadius,driftLimit,candidateStep,correlationStep,inputLength),write=Math.min(frame,outputLength-outPos,inputLength-best);if(write<=0)break;
      const ov=Math.min(overlap,write),rho=clamp(Number.isFinite(score)?score:0,0,1);
      for(let ch=0;ch<channels.length;ch++){const src=channels[ch],dst=out[ch];for(let i=0;i<ov;i++){const x=i/Math.max(1,ov-1),a=Math.cos(x*Math.PI*.5),b=Math.sin(x*Math.PI*.5),power=Math.sqrt(Math.max(EPS,a*a+b*b+2*rho*a*b));dst[outPos+i]=(dst[outPos+i]*a+src[best+i]*b)/power}if(write>ov)dst.set(src.subarray(best+ov,best+write),outPos+ov)}
      onFrame?.({synthesisPosition:outPos,idealInputPosition:ideal,predictedInputPosition:predicted,inputPosition:best,driftSamples:best-ideal,searchSamples:searchRadius,driftLimitSamples:driftLimit,correlation:score});
      prevIn=best;outPos+=synthesisHop;frames++;if(frames>Math.ceil(outputLength/Math.max(1,synthesisHop))+8)break;
    }
    return out;
  }
  function stretchAudioBuffer(context,inputBuffer,rate,options={}){
    if(!inputBuffer)return null;const r=clamp(num(rate,1),.5,2);if(!needsStretch(r))return inputBuffer;
    const channels=[];for(let ch=0;ch<inputBuffer.numberOfChannels;ch++)channels.push(inputBuffer.getChannelData(ch));
    const stretched=stretchChannels(channels,inputBuffer.sampleRate,r,options),length=stretched[0].length,out=context.createBuffer(inputBuffer.numberOfChannels,length,inputBuffer.sampleRate);
    for(let ch=0;ch<stretched.length;ch++)out.copyToChannel?out.copyToChannel(stretched[ch],ch):out.getChannelData(ch).set(stretched[ch]);
    return out;
  }
  return{needsStretch,renderedSourceOffset,renderedDuration,stretchChannels,stretchAudioBuffer,algorithm:'WSOLA-v3-adaptive-power'};
});