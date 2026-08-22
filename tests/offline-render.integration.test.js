const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const DSP=require('../mix-dsp-core.js');
const Timing=require('../audio-timing-core.js');

class FakeParam{constructor(){this.events=[];this.value=1}cancelScheduledValues(t){this.events.push(['cancel',t])}setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t])}linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t])}}
class FakeGain{constructor(log){this.gain=new FakeParam();this.log=log;this.log?.push(this)}connect(n){return n}}
class FakeSource{constructor(log){this.log=log;this.playbackRate=new FakeParam();this.buffer=null}connect(n){return n}start(when,offset,duration){this.log.push({when,offset,duration,rate:this.playbackRate.value})}}
class FakeDecodeContext{async decodeAudioData(){return{duration:120,sampleRate:44100,numberOfChannels:2}}close(){return Promise.resolve()}}
class FakeOfflineContext{constructor(channels,length,sampleRate){this.channels=channels;this.length=length;this.sampleRate=sampleRate;this.destination={};this.starts=[];this.gains=[];FakeOfflineContext.last=this}createBufferSource(){return new FakeSource(this.starts)}createGain(){return new FakeGain(this.gains)}async startRendering(){const len=this.length,ch=this.channels,sr=this.sampleRate;return{sampleRate:sr,length:len,numberOfChannels:ch,getChannelData(){return new Float32Array(len)}}}}

const windowObj={AudioContext:FakeDecodeContext,OfflineAudioContext:FakeOfflineContext,CheerMixDSP:DSP,CheerAudioTiming:Timing};windowObj.window=windowObj;
const sandbox={window:windowObj,document:{querySelector(){return null}},console,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}),setTimeout,clearTimeout};sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../offline-render.js'),'utf8'),sandbox,{filename:'offline-render.js'});

(async()=>{
  const spb=60/147,transition=12*spb;
  const project={duration:30,targetBpm:147,tracks:[{name:'a',url:'blob:a'},{name:'b',url:'blob:b'},{name:'v',url:'blob:v'},{name:'fx',url:'blob:fx'}],trackAnalysis:{a:{bpm:147},b:{bpm:147}},mixSettings:{autoDuck:true,duckDb:-7,duckAttack:.08,duckRelease:.18},audioTimeline:{clips:[
    {id:'a',type:'music',sourceName:'a',start:0,duration:transition,sourceOffset:0,volume:.9,fadeIn:.2,fadeOut:.25},
    {id:'b',type:'music',sourceName:'b',start:transition,duration:4*spb,sourceOffset:2,volume:1,fadeIn:.1,fadeOut:0},
    {id:'v',type:'voice',sourceName:'v',start:transition,duration:spb,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0},
    {id:'fx',type:'fx',sourceName:'fx',start:transition,duration:spb/2,sourceOffset:0,volume:.8,fadeIn:0,fadeOut:.05}
  ]}};
  const rendered=await windowObj.CheerOfflineRenderer.renderProject(project);
  const ctx=FakeOfflineContext.last;assert.equal(ctx.channels,2);assert.equal(ctx.sampleRate,48000);assert.equal(ctx.length,30*48000);assert.equal(rendered.sampleRate,48000);assert.equal(rendered.numberOfChannels,2);
  assert.equal(ctx.starts.length,4,'music, voice and FX must all be scheduled');
  const [a,b,v,fx]=ctx.starts;assert.ok(Math.abs((a.when+a.duration)-b.when)<1e-9,'offline music handoff must share exact timeline');assert.ok(Math.abs(b.when-v.when)<1e-9,'voice must share exact transition time');assert.ok(Math.abs(b.when-fx.when)<1e-9,'FX must share exact transition time');assert.equal(b.offset,2,'source offset must be preserved');
  assert.equal(ctx.gains.length,8,'each clip must have clip-envelope and ducking gain stages');
  const firstClipGain=ctx.gains[0].gain.events,firstDuckGain=ctx.gains[1].gain.events;assert.ok(firstClipGain.some(e=>e[0]==='ramp'),'preview/export shared fade DSP must schedule ramps');assert.ok(firstDuckGain.some(e=>e[0]==='ramp'),'music ducking must schedule automation around voice');

  const tail={...project,duration:5,audioTimeline:{clips:[{id:'tail',type:'fx',sourceName:'fx',start:7,duration:2,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0}]}};
  assert.equal(windowObj.CheerOfflineRenderer.projectLength(tail),9,'renderer must not truncate clips extending past declared project duration');
  await windowObj.CheerOfflineRenderer.renderProject(tail);assert.equal(FakeOfflineContext.last.length,9*48000,'offline buffer must include the complete tail clip');

  const bad={...project,audioTimeline:{clips:[{id:'bad',type:'music',sourceName:'a',start:-1,duration:1,sourceOffset:0}]}};
  await assert.rejects(()=>windowObj.CheerOfflineRenderer.renderProject(bad),/virheellinen ajoitus/,'invalid clip timing must fail before master render');
  console.log('offline-render integration: 48 kHz stereo, shared DSP, VO/FX timing, tail preservation and validation passed');
})().catch(err=>{console.error(err);process.exitCode=1});