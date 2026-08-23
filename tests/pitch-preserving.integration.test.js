const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const DSP=require('../mix-dsp-core.js');
const Timing=require('../audio-timing-core.js');
const Stretch=require('../time-stretch-core.js');

class FakeParam{constructor(v=1){this.value=v;this.events=[]}cancelScheduledValues(t){this.events.push(['cancel',t])}setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);return this}linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);return this}}
class FakeGain{constructor(){this.gain=new FakeParam()}connect(n){return n}disconnect(){}}
class FakeBuffer{constructor(channels,length,sampleRate){this.numberOfChannels=channels;this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.data=Array.from({length:channels},()=>new Float32Array(length));for(let i=0;i<length;i++){const x=Math.sin(2*Math.PI*440*i/sampleRate);for(let ch=0;ch<channels;ch++)this.data[ch][i]=x}}getChannelData(ch){return this.data[ch]}copyToChannel(data,ch){this.data[ch].set(data)}}
class FakeSource{constructor(log){this.log=log;this.playbackRate=new FakeParam(1);this.buffer=null;this.stopped=false}connect(n){return n}disconnect(){}start(when,offset,duration){this.log.push({source:this,when,offset,duration,rate:this.playbackRate.value,buffer:this.buffer})}stop(){this.stopped=true}}
class FakeAudioContext{constructor(){this.currentTime=10;this.baseLatency=0;this.outputLatency=0;this.state='running';this.destination={};this.starts=[];FakeAudioContext.last=this}createGain(){return new FakeGain()}createBufferSource(){return new FakeSource(this.starts)}createBuffer(channels,length,sampleRate){return new FakeBuffer(channels,length,sampleRate)}async decodeAudioData(){return new FakeBuffer(2,8*8000,8000)}async resume(){}getOutputTimestamp(){return{contextTime:this.currentTime,performanceTime:0}}close(){return Promise.resolve()}}
class FakeOfflineContext extends FakeAudioContext{constructor(channels,length,sampleRate){super();this.channels=channels;this.length=length;this.sampleRate=sampleRate;FakeOfflineContext.last=this}async startRendering(){const len=this.length,ch=this.channels,sr=this.sampleRate;return{sampleRate:sr,length:len,numberOfChannels:ch,getChannelData(){return new Float32Array(len)}}}}

function makeProject(){return{duration:6,targetBpm:150,tracks:[{name:'tempo',url:'blob:tempo',duration:8}],trackAnalysis:{tempo:{bpm:120}},mixSettings:{autoDuck:false},audioTimeline:{zoom:1,snap:'beat',clips:[{id:'tempo',type:'music',sourceName:'tempo',start:0,duration:2,sourceOffset:1,volume:1,fadeIn:0,fadeOut:0}]}}}

(async()=>{
  const state=makeProject(),elements={'#audioPlayer':{pause(){}},'#timelineContent':{addEventListener(){}}},document={readyState:'complete',querySelector:s=>elements[s]||null,addEventListener(){}};
  const previewWindow={AudioContext:FakeAudioContext,webkitAudioContext:null,CheerMixDSP:DSP,CheerAudioTiming:Timing,CheerTimeStretch:Stretch,addEventListener(){}};previewWindow.window=previewWindow;
  const previewSandbox={window:previewWindow,document,state,console,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}),setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},alert(){},snapshot(){},scheduleSave(){}};previewSandbox.globalThis=previewSandbox;
  vm.createContext(previewSandbox);vm.runInContext(fs.readFileSync(require.resolve('../timeline-audio-engine.js'),'utf8'),previewSandbox,{filename:'timeline-audio-engine.js'});await previewWindow.cheerTimelineAudioEngine.startAt(0);
  const preview=FakeAudioContext.last.starts[0],rate=1.25;assert.equal(preview.rate,1,'preview must not use playbackRate for BPM matching');assert.ok(Math.abs(preview.offset-(1/rate))<1e-9);assert.equal(preview.duration,2);assert.ok(Math.abs(preview.buffer.duration-(8/rate))<1e-6);

  const offlineWindow={AudioContext:FakeAudioContext,OfflineAudioContext:FakeOfflineContext,CheerMixDSP:DSP,CheerAudioTiming:Timing,CheerTimeStretch:Stretch};offlineWindow.window=offlineWindow;
  const offlineSandbox={window:offlineWindow,document:{querySelector(){return null}},console,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)}),setTimeout,clearTimeout};offlineSandbox.globalThis=offlineSandbox;
  vm.createContext(offlineSandbox);vm.runInContext(fs.readFileSync(require.resolve('../offline-render.js'),'utf8'),offlineSandbox,{filename:'offline-render.js'});await offlineWindow.CheerOfflineRenderer.renderProject(makeProject());
  const rendered=FakeOfflineContext.last.starts[0];assert.equal(rendered.rate,1,'export must not use playbackRate for BPM matching');assert.ok(Math.abs(rendered.offset-preview.offset)<1e-9,'preview/export must map source offset identically');assert.equal(rendered.duration,preview.duration,'preview/export must use the same timeline duration');assert.ok(Math.abs(rendered.buffer.duration-preview.buffer.duration)<1e-6,'preview/export must use the same time-stretch ratio');assert.equal(FakeOfflineContext.last.sampleRate,48000,'offline master must remain 48 kHz');
  console.log('pitch-preserving integration: preview/export share tempo mapping with playbackRate 1');
})().catch(err=>{console.error(err);process.exitCode=1});
