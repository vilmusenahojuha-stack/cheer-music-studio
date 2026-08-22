const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Timing=require('../audio-timing-core.js');

class FakeParam{
  constructor(v=1){this.value=v;this.events=[]}
  setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);return this}
  linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);return this}
  cancelScheduledValues(t){this.events.push(['cancel',t]);return this}
}
class FakeGain{
  constructor(){this.gain=new FakeParam(1);this.connected=[]}
  connect(n){this.connected.push(n);return n}
  disconnect(){}
}
class FakeSource{
  constructor(log){this.log=log;this.playbackRate=new FakeParam(1);this.buffer=null;this.onended=null;this.connected=[];this.stopped=false}
  connect(n){this.connected.push(n);return n}
  disconnect(){}
  start(when,offset,duration){this.log.starts.push({source:this,when,offset,duration,rate:this.playbackRate.value})}
  stop(){this.stopped=true;this.log.stops++}
}
class FakeAudioContext{
  constructor(){this.currentTime=10;this.baseLatency=.01;this.outputLatency=.02;this.state='running';this.destination={};this.log={starts:[],stops:0};FakeAudioContext.last=this}
  createGain(){return new FakeGain()}
  createBufferSource(){return new FakeSource(this.log)}
  async decodeAudioData(){return{duration:120,sampleRate:48000,numberOfChannels:2}}
  async resume(){this.state='running'}
  getOutputTimestamp(){return{contextTime:this.currentTime,performanceTime:0}}
}

const elements={
  '#audioPlayer':{pause(){}},
  '#timelineContent':{addEventListener(){}},
};
const document={
  readyState:'complete',
  querySelector(sel){return elements[sel]||null},
  addEventListener(){},
};
const windowObj={
  AudioContext:FakeAudioContext,
  webkitAudioContext:null,
  CheerAudioTiming:Timing,
  addEventListener(){},
};
windowObj.window=windowObj;
const state={
  targetBpm:147,
  tracks:[
    {name:'music-a',url:'blob:a',duration:120},
    {name:'music-b',url:'blob:b',duration:120},
    {name:'voice',url:'blob:v',duration:120},
    {name:'fx',url:'blob:f',duration:120},
  ],
  trackAnalysis:{'music-a':{bpm:147},'music-b':{bpm:147}},
  mixSettings:{autoDuck:true,duckDb:-7,duckAttack:.08,duckRelease:.18},
  audioTimeline:{zoom:1,snap:'beat',clips:[]},
};
const sandbox={
  window:windowObj,document,state,console,
  fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(32)}),
  setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  alert(){},snapshot(){},scheduleSave(){},
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require.resolve('../timeline-audio-engine.js'),'utf8'),sandbox,{filename:'timeline-audio-engine.js'});
const engine=windowObj.cheerTimelineAudioEngine;
assert.ok(engine,'engine should initialize');

(async()=>{
  const spb=60/147;
  const transition=44*spb; // kasi 6 / lasku 5
  state.audioTimeline.clips=[
    {id:'a',type:'music',sourceName:'music-a',start:0,duration:transition,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0},
    {id:'b',type:'music',sourceName:'music-b',start:transition,duration:8*spb,sourceOffset:2,volume:1,fadeIn:0,fadeOut:0},
    {id:'v',type:'voice',sourceName:'voice',start:transition,duration:2*spb,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0},
    {id:'f',type:'fx',sourceName:'fx',start:transition,duration:spb,sourceOffset:0,volume:.8,fadeIn:0,fadeOut:0},
  ];

  await engine.startAt(0);
  const ac=FakeAudioContext.last;
  assert.equal(ac.log.starts.length,4,'music + incoming music + VO + FX must all be scheduled');
  const [outgoing,incoming,voice,fx]=ac.log.starts;
  const handoff=outgoing.when+outgoing.duration; // rate = 1
  assert.ok(Math.abs(handoff-incoming.when)<1e-9,'mid-eight music handoff must share one AudioContext instant');
  assert.ok(Math.abs(incoming.when-voice.when)<1e-9,'voice must share the same AudioContext clock');
  assert.ok(Math.abs(incoming.when-fx.when)<1e-9,'FX must share the same AudioContext clock');

  // UI/playhead time must follow the audio context clock, not performance.now().
  const info0=engine.getClockInfo();
  assert.equal(info0.currentTime,0,'playhead holds at timeline anchor during scheduling lead-in');
  ac.currentTime=info0.contextAnchor+.375;
  assert.ok(Math.abs(engine.currentTime()-.375)<1e-9,'playhead must advance from AudioContext time');

  // Seek while running: old sources are stopped and a fresh schedule starts at the seek point.
  const oldSources=ac.log.starts.map(x=>x.source);
  await engine.seekTo(transition+.5*spb);
  assert.ok(oldSources.every(s=>s.stopped),'seek must stop every previously scheduled source');
  const seekInfo=engine.getClockInfo();
  assert.ok(Math.abs(seekInfo.timelineAnchor-(transition+.5*spb))<1e-9,'seek anchor must equal requested timeline position');

  // Pause/resume must preserve the audible timeline position and not revive stale sources.
  ac.currentTime=seekInfo.contextAnchor+.25;
  const pausedAt=engine.currentTime();
  engine.stop();
  assert.ok(Math.abs(engine.currentTime()-pausedAt)<1e-9,'pause must retain current timeline position');
  const startsBeforeResume=ac.log.starts.length;
  await engine.startAt(pausedAt);
  assert.ok(ac.log.starts.length>startsBeforeResume,'resume must create a fresh AudioContext schedule');

  // Project/audio restore safety: clearing buffers and stopping leaves no active sources.
  engine.stop();
  engine.clearBuffers();
  const finalInfo=engine.getClockInfo();
  assert.equal(finalInfo.activeSources,0,'stop must leave no active sources');
  assert.equal(finalInfo.bufferCount,0,'buffer cache must be clearable on project restore');

  console.log('audio engine integration: all regression tests passed');
})().catch(err=>{console.error(err);process.exitCode=1});
