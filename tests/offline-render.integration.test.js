const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const DSP=require('../mix-dsp-core.js');
const Timing=require('../audio-timing-core.js');

class FakeParam{constructor(){this.events=[];this.value=1}cancelScheduledValues(t){this.events.push(['cancel',t])}setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t])}linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t])}}
class FakeGain{constructor(){this.gain=new FakeParam()}connect(n){return n}}
class FakeSource{constructor(log){this.log=log;this.playbackRate=new FakeParam();this.buffer=null}connect(n){return n}start(when,offset,duration){this.log.push({when,offset,duration,rate:this.playbackRate.value})}}
class FakeDecodeContext{async decodeAudioData(){return{duration:120,sampleRate:44100,numberOfChannels:2}}close(){return Promise.resolve()}}
class FakeOfflineContext{constructor(channels,length,sampleRate){this.channels=channels;this.length=length;this.sampleRate=sampleRate;this.destination={};this.starts=[];FakeOfflineContext.last=this}createBufferSource(){return new FakeSource(this.starts)}createGain(){return new FakeGain()}async startRendering(){return{sampleRate:this.sampleRate,length:this.length,numberOfChannels:this.channels,getChannelData(){return new Float32Array(this.length||0)}}}}

const windowObj={AudioContext:FakeDecodeContext,OfflineAudioContext:FakeOfflineContext,CheerMixDSP:DSP,CheerAudioTiming:Timing};windowObj.window=windowObj;
const sandbox={window:windowObj,document:{querySelector(){return null}},console,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}),setTimeout,clearTimeout};sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../offline-render.js'),'utf8'),sandbox,{filename:'offline-render.js'});

(async()=>{
  const spb=60/147,transition=12*spb;
  const project={duration:30,targetBpm:147,tracks:[{name:'a',url:'blob:a'},{name:'b',url:'blob:b'},{name:'v',url:'blob:v'}],trackAnalysis:{a:{bpm:147},b:{bpm:147}},mixSettings:{autoDuck:true,duckDb:-7,duckAttack:.08,duckRelease:.18},audioTimeline:{clips:[
    {id:'a',type:'music',sourceName:'a',start:0,duration:transition,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0},
    {id:'b',type:'music',sourceName:'b',start:transition,duration:4*spb,sourceOffset:2,volume:1,fadeIn:0,fadeOut:0},
    {id:'v',type:'voice',sourceName:'v',start:transition,duration:spb,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0}
  ]}};
  const rendered=await windowObj.CheerOfflineRenderer.renderProject(project);
  const ctx=FakeOfflineContext.last;assert.equal(ctx.channels,2);assert.equal(ctx.sampleRate,48000);assert.equal(ctx.length,30*48000);assert.equal(rendered.sampleRate,48000);
  assert.equal(ctx.starts.length,3,'two music clips and voice must be scheduled');
  const [a,b,v]=ctx.starts;assert.ok(Math.abs((a.when+a.duration)-b.when)<1e-9,'offline music handoff must share exact sample timeline');assert.ok(Math.abs(b.when-v.when)<1e-9,'offline voice must share exact transition time');assert.equal(b.offset,2,'source offset must be preserved');
  console.log('offline-render integration: 48 kHz stereo sample-timed render path passed');
})().catch(err=>{console.error(err);process.exitCode=1});