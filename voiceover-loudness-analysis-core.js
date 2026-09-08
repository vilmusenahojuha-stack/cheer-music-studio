((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerVoiceoverLoudnessAnalysisCore=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const db=v=>20*Math.log10(Math.max(1e-12,v));
  const DEFAULTS=Object.freeze({blockSeconds:.4,hopSeconds:.1,absoluteGateLufs:-70,relativeGateLu:-10,maxSeconds:30,truePeakOversample:4});
  function channelData(buffer){
    if(!buffer||!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<=0)throw new Error('Invalid audio buffer');
    const count=Math.max(1,Math.min(2,Number(buffer.numberOfChannels)||1));
    const channels=[];
    for(let c=0;c<count;c++)channels.push(buffer.getChannelData(c));
    return channels;
  }
  function monoSample(channels,i){let sum=0;for(const ch of channels)sum+=finite(ch[i],0);return sum/channels.length;}
  function meanSquare(channels,start,end){
    let sum=0,n=0;
    for(let i=start;i<end;i++){const s=monoSample(channels,i);sum+=s*s;n++;}
    return n?sum/n:0;
  }
  function lufsFromMeanSquare(ms){return ms>0?-0.691+10*Math.log10(ms):-Infinity;}
  function integratedLufs(buffer,options={}){
    const o={...DEFAULTS,...options},channels=channelData(buffer),sr=buffer.sampleRate;
    const length=Math.min(channels[0].length,Math.floor(sr*clamp(finite(o.maxSeconds,DEFAULTS.maxSeconds),1,120)));
    const block=Math.max(1,Math.floor(sr*clamp(finite(o.blockSeconds,DEFAULTS.blockSeconds),.1,1)));
    const hop=Math.max(1,Math.floor(sr*clamp(finite(o.hopSeconds,DEFAULTS.hopSeconds),.025,.5)));
    const energies=[];
    for(let start=0;start+block<=length;start+=hop){const ms=meanSquare(channels,start,start+block);if(lufsFromMeanSquare(ms)>=o.absoluteGateLufs)energies.push(ms);}
    if(!energies.length){const ms=meanSquare(channels,0,length);return Number.isFinite(lufsFromMeanSquare(ms))?lufsFromMeanSquare(ms):-Infinity;}
    const ungated=energies.reduce((a,b)=>a+b,0)/energies.length;
    const relativeGate=lufsFromMeanSquare(ungated)+finite(o.relativeGateLu,DEFAULTS.relativeGateLu);
    const gated=energies.filter(ms=>lufsFromMeanSquare(ms)>=relativeGate);
    const finalMs=(gated.length?gated:energies).reduce((a,b)=>a+b,0)/(gated.length?gated.length:energies.length);
    return lufsFromMeanSquare(finalMs);
  }
  function truePeak(buffer,options={}){
    const o={...DEFAULTS,...options},channels=channelData(buffer),sr=buffer.sampleRate;
    const length=Math.min(channels[0].length,Math.floor(sr*clamp(finite(o.maxSeconds,DEFAULTS.maxSeconds),1,120)));
    const os=Math.round(clamp(finite(o.truePeakOversample,DEFAULTS.truePeakOversample),1,8));
    let peak=0;
    for(const ch of channels){
      for(let i=0;i<length-1;i++){
        const a=finite(ch[i],0),b=finite(ch[i+1],0);peak=Math.max(peak,Math.abs(a));
        for(let k=1;k<os;k++){const t=k/os;peak=Math.max(peak,Math.abs(a+(b-a)*t));}
      }
      if(length)peak=Math.max(peak,Math.abs(finite(ch[length-1],0)));
    }
    return {linear:peak,dbtp:db(peak)};
  }
  function measureAudioBuffer(buffer,options={}){
    const integrated=integratedLufs(buffer,options),peak=truePeak(buffer,options);
    return {kind:'cheer-voiceover-loudness-measurement',version:1,integratedLufs:Number.isFinite(integrated)?Math.round(integrated*10)/10:null,truePeakDb:Number.isFinite(peak.dbtp)?Math.round(peak.dbtp*10)/10:null,truePeakLinear:peak.linear,durationSeconds:finite(buffer?.duration,(buffer?.length||0)/Math.max(1,buffer?.sampleRate||1)),sampleRate:finite(buffer?.sampleRate,null),method:'gated-energy-v1',nonDestructive:true};
  }
  function metadataPatch(measurement){
    if(measurement?.kind!=='cheer-voiceover-loudness-measurement')return {};
    return {voiceoverIntegratedLufs:measurement.integratedLufs,voiceoverTruePeakDb:measurement.truePeakDb,voiceoverLoudnessMeasurement:{...measurement}};
  }
  return {DEFAULTS,lufsFromMeanSquare,integratedLufs,truePeak,measureAudioBuffer,metadataPatch};
});
