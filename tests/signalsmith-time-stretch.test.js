const assert=require('node:assert/strict');

class FakeBuffer{
  constructor(channels,length,sampleRate){this.numberOfChannels=channels;this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.data=Array.from({length:channels},(_,c)=>Float32Array.from({length},(_,i)=>Math.sin((i+c)*.01)))}
  getChannelData(ch){return this.data[ch]}
}
class FakeOfflineAudioContext{
  static active=0;static maxActive=0;
  constructor(channels,length,sampleRate){this.channels=channels;this.length=length;this.sampleRate=sampleRate;this.destination={};this.audioWorklet={};FakeOfflineAudioContext.last=this}
  async startRendering(){FakeOfflineAudioContext.active++;FakeOfflineAudioContext.maxActive=Math.max(FakeOfflineAudioContext.maxActive,FakeOfflineAudioContext.active);await new Promise(r=>setTimeout(r,5));FakeOfflineAudioContext.active--;return new FakeBuffer(this.channels,this.length,this.sampleRate)}
}

let calls=[];
global.CheerTimeStretch={
  needsStretch:rate=>Math.abs(rate-1)>1e-4,
  stretchAudioBuffer(context,input,rate){calls.push(['fallback',rate]);return{fallback:true,numberOfChannels:input.numberOfChannels,length:Math.round(input.length/rate),sampleRate:input.sampleRate}}
};
global.OfflineAudioContext=FakeOfflineAudioContext;
global.webkitOfflineAudioContext=null;
global.SignalsmithStretch=async(ctx,options)=>{
  const rec={ctx,options,configured:null,buffers:null,start:null,connected:false,dropped:false};calls.push(['factory',rec]);
  return{
    connect(dest){rec.connected=dest===ctx.destination},
    async configure(config){rec.configured=config},
    async addBuffers(buffers){rec.buffers=buffers},
    async start(...args){rec.start=args},
    async dropBuffers(){rec.dropped=true}
  };
};

delete require.cache[require.resolve('../signalsmith-time-stretch.js')];
const HQ=require('../signalsmith-time-stretch.js');

(async()=>{
  const input=new FakeBuffer(2,48000,48000),context={};
  const untouched=await HQ.stretchAudioBuffer(context,input,1);assert.equal(untouched,input,'1.0x must bypass processing');
  const rate=147/104.3,rendered=await HQ.stretchAudioBuffer(context,input,rate,{requireSignalsmith:true});
  const expected=Math.round(input.length/rate);assert.equal(rendered.length,expected,'Signalsmith output length must follow the tempo ratio');assert.equal(rendered.sampleRate,48000);assert.equal(rendered.numberOfChannels,2);assert.equal(rendered.cheerStretchEngine,'signalsmith');
  const factoryCall=calls.find(x=>x[0]==='factory')?.[1];assert.ok(factoryCall,'Signalsmith factory must be used');assert.deepEqual(factoryCall.options,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});assert.equal(factoryCall.connected,true);assert.deepEqual(factoryCall.configured,{preset:'default'});assert.equal(factoryCall.buffers.length,2);assert.notEqual(factoryCall.buffers[0],input.getChannelData(0),'input channels must be copied before transfer to the worklet');assert.ok(Math.abs(factoryCall.start[3]-rate)<1e-12,'Signalsmith playback rate must match target/source BPM');assert.equal(factoryCall.start[4],0,'pitch shift must stay at zero semitones');assert.equal(HQ.status().engine,'signalsmith');

  FakeOfflineAudioContext.maxActive=0;await Promise.all([HQ.stretchAudioBuffer(context,input,1.1,{requireSignalsmith:true}),HQ.stretchAudioBuffer(context,input,1.2,{requireSignalsmith:true})]);assert.equal(FakeOfflineAudioContext.maxActive,1,'HQ renders must be serialized to avoid concurrent long-track WASM memory spikes');

  global.SignalsmithStretch=async()=>{throw new Error('worklet unavailable')};calls=[];const fallback=await HQ.stretchAudioBuffer(context,input,1.2);assert.equal(fallback.fallback,true,'WSOLA must remain a safe fallback');assert.equal(fallback.cheerStretchEngine,'wsola-fallback');assert.equal(calls[0][0],'fallback');assert.equal(HQ.status().engine,'wsola-fallback');assert.match(HQ.status().lastError,/worklet unavailable/);
  console.log('Signalsmith HQ adapter: high-quality path, serialized rendering and WSOLA fallback passed');
})().catch(err=>{console.error(err);process.exitCode=1});
