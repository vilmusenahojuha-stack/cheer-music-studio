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
  function correlation(channels,prevStart,candStart,overlap,step){let dot=0,a2=0,b2=0;const refStart=prevStart+overlap;for(let i=0;i<overlap;i+=step){const a=monoAt(channels,refStart+i),b=monoAt(channels,candStart+i);dot+=a*b;a2+=a*a;b2+=b*b}if(a2<EPS||b2<EPS)return-Infinity;return dot/Math.sqrt(a2*b2)}
  function bestCandidate(channels,prevStart,expected,maxStart,overlap,searchRadius,candidateStep,correlationStep){const lo=Math.max(0,Math.floor(expected-searchRadius)),hi=Math.min(maxStart,Math.ceil(expected+searchRadius));let best=clamp(Math.round(expected),lo,hi),score=-Infinity;for(let c=lo;c<=hi;c+=candidateStep){const s=correlation(channels,prevStart,c,overlap,correlationStep);if(s>score){score=s;best=c}}if(best!==hi&&hi>=lo){const s=correlation(channels,prevStart,hi,overlap,correlationStep);if(s>score)best=hi}return best}
  function stretchChannels(channels,sampleRate,rate,options={}){
    const inputLength=normalizeChannels(channels),sr=Math.max(8000,num(sampleRate,48000)),r=clamp(num(rate,1),.5,2);
    if(!needsStretch(r))return copyChannels(channels);
    const outputLength=Math.max(1,Math.round(inputLength/r));
    const frame=Math.max(1024,Math.min(8192,Math.pow(2,Math.ceil(Math.log2(sr*num(options.frameSeconds,.07))))));
    const overlap=Math.floor(frame/2),synthesisHop=overlap,analysisHop=synthesisHop*r;
    const searchRadius=Math.min(Math.floor(sr*num(options.searchSeconds,.014)),Math.floor(overlap*.45));
    const candidateStep=Math.max(4,Math.floor(num(options.candidateStep,Math.max(8,searchRadius/40)))),correlationStep=Math.max(4,Math.floor(num(options.correlationStep,16)));
    const maxStart=Math.max(0,inputLength-frame),out=channels.map(()=>new Float32Array(outputLength));
    const first=Math.min(frame,inputLength,outputLength);for(let ch=0;ch<channels.length;ch++)out[ch].set(channels[ch].subarray(0,first),0);
    let prevIn=0,outPos=synthesisHop,frames=1;
    while(outPos<outputLength&&prevIn<=maxStart){
      const expected=prevIn+analysisHop,best=bestCandidate(channels,prevIn,expected,maxStart,overlap,searchRadius,candidateStep,correlationStep),write=Math.min(frame,outputLength-outPos,inputLength-best);if(write<=0)break;
      const ov=Math.min(overlap,write);
      for(let ch=0;ch<channels.length;ch++){const src=channels[ch],dst=out[ch];for(let i=0;i<ov;i++){const x=i/Math.max(1,ov-1),a=Math.cos(x*Math.PI*.5),b=Math.sin(x*Math.PI*.5);dst[outPos+i]=dst[outPos+i]*a+src[best+i]*b}if(write>ov)dst.set(src.subarray(best+ov,best+write),outPos+ov)}
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
  return{needsStretch,renderedSourceOffset,renderedDuration,stretchChannels,stretchAudioBuffer,algorithm:'WSOLA-v2'};
});