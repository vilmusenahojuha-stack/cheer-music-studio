((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerWav24=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const writeAscii=(view,offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
  function normalizeChannels(channels){
    if(!Array.isArray(channels)||!channels.length)throw new Error('PCM-kanavat puuttuvat.');
    const src=channels.map(ch=>ch instanceof Float32Array?ch:Float32Array.from(ch||[]));
    const length=src[0].length;if(!length)throw new Error('PCM-audio on tyhjä.');
    if(src.some(ch=>ch.length!==length))throw new Error('PCM-kanavien pituudet eivät täsmää.');
    if(src.length===1)return[src[0],src[0]];
    return[src[0],src[1]];
  }
  function floatToInt24(v){
    const x=clamp(Number.isFinite(v)?v:0,-1,1);
    if(x<=-1)return-0x800000;if(x>=1)return 0x7fffff;
    return x<0?Math.round(x*0x800000):Math.round(x*0x7fffff);
  }
  function writeInt24LE(view,offset,value){
    let v=value;if(v<0)v+=0x1000000;
    view.setUint8(offset,v&0xff);view.setUint8(offset+1,(v>>>8)&0xff);view.setUint8(offset+2,(v>>>16)&0xff);
  }
  function encodeWav24(channels,sampleRate=48000){
    const [left,right]=normalizeChannels(channels),sr=Math.round(Number(sampleRate));
    if(!Number.isFinite(sr)||sr<8000||sr>384000)throw new Error('Virheellinen sample rate.');
    const numChannels=2,bitsPerSample=24,bytesPerSample=3,blockAlign=numChannels*bytesPerSample,byteRate=sr*blockAlign,dataSize=left.length*blockAlign;
    const ab=new ArrayBuffer(44+dataSize),view=new DataView(ab);
    writeAscii(view,0,'RIFF');view.setUint32(4,36+dataSize,true);writeAscii(view,8,'WAVE');writeAscii(view,12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,numChannels,true);view.setUint32(24,sr,true);view.setUint32(28,byteRate,true);view.setUint16(32,blockAlign,true);view.setUint16(34,bitsPerSample,true);writeAscii(view,36,'data');view.setUint32(40,dataSize,true);
    let p=44;for(let i=0;i<left.length;i++){writeInt24LE(view,p,floatToInt24(left[i]));p+=3;writeInt24LE(view,p,floatToInt24(right[i]));p+=3}
    return ab;
  }
  function fromAudioBuffer(buffer){
    if(!buffer||!Number.isFinite(buffer.sampleRate)||!Number.isFinite(buffer.length))throw new Error('Virheellinen AudioBuffer.');
    const channels=[];for(let c=0;c<Math.min(2,buffer.numberOfChannels||0);c++)channels.push(buffer.getChannelData(c));
    return encodeWav24(channels,buffer.sampleRate);
  }
  return{encodeWav24,fromAudioBuffer,floatToInt24,normalizeChannels};
});