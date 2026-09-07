const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const DSP=require('../mix-dsp-core.js');
const Timing=require('../audio-timing-core.js');
const FxCore=require('../cheer-fx-render-core.js');

class FakeParam{constructor(){this.events=[];this.value=1}cancelScheduledValues(t){this.events.push(['cancel',t])}setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t])}linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t])}exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['exp',v,t])}}
class FakeGain{constructor(){this.gain=new FakeParam()}connect(n){return n}}
class FakeSource{constructor(log){this.log=log;this.playbackRate=new FakeParam();this.buffer=null}connect(n){return n}start(when,offset,duration){this.log.push({when,offset,duration})}}
class FakeOscillator{constructor(log){this.log=log;this.frequency=new FakeParam();this.type='sine';this.started=null;this.stopped=null;log.push(this)}connect(n){return n}start(t){this.started=t}stop(t){this.stopped=t}}
class FakeDecodeContext{async decodeAudioData(){return{duration:120,sampleRate:48000,numberOfChannels:2}}close(){return Promise.resolve()}}
class FakeOfflineContext{constructor(channels,length,sampleRate){this.channels=channels;this.length=length;this.sampleRate=sampleRate;this.destination={};this.starts=[];this.oscillators=[];FakeOfflineContext.last=this}createBufferSource(){return new FakeSource(this.starts)}createGain(){return new FakeGain()}createOscillator(){return new FakeOscillator(this.oscillators)}async startRendering(){return{sampleRate:this.sampleRate,length:this.length,duration:this.length/this.sampleRate,numberOfChannels:this.channels,getChannelData(){return new Float32Array(1)}}}}

const windowObj={AudioContext:FakeDecodeContext,OfflineAudioContext:FakeOfflineContext,CheerMixDSP:DSP,CheerAudioTiming:Timing,CheerFxRenderCore:FxCore};windowObj.window=windowObj;
const sandbox={window:windowObj,document:{querySelector(){return null}},console,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}),setTimeout,clearTimeout};sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../offline-render.js'),'utf8'),sandbox,{filename:'offline-render.js'});

(async()=>{
  const project={duration:20,targetBpm:147,tracks:[{name:'a',url:'blob:a'}],trackAnalysis:{a:{bpm:147}},mixSettings:{},audioTimeline:{clips:[{id:'saved',type:'music',sourceName:'a',start:0,duration:4,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0}]}};
  const before=JSON.stringify(project.audioTimeline);
  const plan={status:'preview-ready',clips:[{id:'mix',type:'music',sourceName:'a',start:0,duration:12,sourceOffset:2,volume:1,fadeIn:0,fadeOut:0}],cheerFxAnchors:[{id:'fx-stunt',kind:'impact',at:6,sectionId:'stunt',sectionType:'stunt',confidence:.9,renderMode:'synth-impact-v1',executable:true,preservesTimelineTiming:true}]};
  const previewProject=windowObj.CheerOfflineRenderer.projectForTimelinePlan(project,plan);
  assert.equal(previewProject.audioTimeline.cheerFxAnchors.length,1,'Smart Mix FX anchors must reach the isolated preview project');
  assert.equal(previewProject.audioTimeline.cheerFxAnchors[0].at,6,'FX anchor timing must stay exact');
  assert.equal(JSON.stringify(project.audioTimeline),before,'FX preview planning must not mutate the saved project');

  await windowObj.CheerOfflineRenderer.renderTimelinePlan(project,plan);
  const ctx=FakeOfflineContext.last;
  assert.equal(ctx.starts.length,1,'music must still use the normal shared renderer');
  assert.equal(ctx.oscillators.length,2,'one structural impact must render low and transient voices');
  assert.equal(ctx.oscillators[0].started,6,'low impact voice must start exactly on the cheer anchor');
  assert.equal(ctx.oscillators[1].started,6,'transient impact voice must start exactly on the cheer anchor');
  assert.ok(ctx.oscillators[0].stopped>6&&ctx.oscillators[0].stopped<=6.16+1e-9,'low impact tail must remain short');
  assert.ok(ctx.oscillators[1].stopped>6&&ctx.oscillators[1].stopped<=6.042+1e-9,'transient tail must remain short');
  assert.equal(JSON.stringify(project.audioTimeline),before,'rendered cheer FX must remain non-destructive');

  const noFx={...plan,cheerFxAnchors:[{kind:'impact',at:6,sectionType:'dance',confidence:1}]};
  await windowObj.CheerOfflineRenderer.renderTimelinePlan(project,noFx);
  assert.equal(FakeOfflineContext.last.oscillators.length,0,'non-structural dance entries must not receive automatic impact synth');

  console.log('offline-render cheer FX integration passed');
})().catch(err=>{console.error(err);process.exitCode=1});
