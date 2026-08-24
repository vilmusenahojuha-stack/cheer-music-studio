const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Timing=require('../audio-timing-core.js');

class FakeParam{constructor(v=1){this.value=v;this.events=[]}setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);return this}linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);return this}cancelScheduledValues(t){this.events.push(['cancel',t]);return this}}
class FakeGain{constructor(){this.gain=new FakeParam(1);this.connected=[]}connect(n){this.connected.push(n);return n}disconnect(){}}
class FakeSource{constructor(log){this.log=log;this.playbackRate=new FakeParam(1);this.buffer=null;this.onended=null;this.connected=[];this.stopped=false}connect(n){this.connected.push(n);return n}disconnect(){}start(when,offset,duration){this.log.starts.push({source:this,when,offset,duration,rate:this.playbackRate.value})}stop(){this.stopped=true;this.log.stops++}}
class FakeAudioContext{constructor(){this.currentTime=10;this.baseLatency=.01;this.outputLatency=.02;this.state='running';this.destination={};this.log={starts:[],stops:0};FakeAudioContext.last=this}createGain(){return new FakeGain()}createBufferSource(){return new FakeSource(this.log)}async decodeAudioData(){return{duration:120,sampleRate:48000,numberOfChannels:2}}async resume(){this.state='running'}getOutputTimestamp(){return{contextTime:this.currentTime,performanceTime:0}}}

const elements={'#audioPlayer':{pause(){}},'#timelineContent':{addEventListener(){}}};
const document={readyState:'complete',querySelector(sel){return elements[sel]||null},addEventListener(){}};
const windowObj={AudioContext:FakeAudioContext,webkitAudioContext:null,CheerAudioTiming:Timing,addEventListener(){}};windowObj.window=windowObj;
const state={targetBpm:147,tracks:[{name:'music-a',url:'blob:a',duration:120},{name:'music-b',url:'blob:b',duration:120},{name:'voice',url:'blob:v',duration:120},{name:'voice2',url:'blob:v2',duration:120},{name:'fx',url:'blob:f',duration:120},{name:'fx2',url:'blob:f2',duration:120}],trackAnalysis:{'music-a':{bpm:147},'music-b':{bpm:147}},mixSettings:{autoDuck:true,duckDb:-7,duckAttack:.08,duckRelease:.18},audioTimeline:{zoom:1,snap:'beat',clips:[]}};
let fetchGate=null;
const sandbox={window:windowObj,document,state,console,fetch:async()=>{if(fetchGate)await fetchGate;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(32)}},setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},alert(){},snapshot(){},scheduleSave(){}};sandbox.globalThis=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../timeline-audio-engine.js'),'utf8'),sandbox,{filename:'timeline-audio-engine.js'});
const engine=windowObj.cheerTimelineAudioEngine;assert.ok(engine,'engine should initialize');

(async()=>{
  const spb=60/147,transition=44*spb;
  state.audioTimeline.clips=[
    {id:'a',type:'music',sourceName:'music-a',start:0,duration:transition,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0},
    {id:'b',type:'music',sourceName:'music-b',start:transition,duration:8*spb,sourceOffset:2,volume:1,fadeIn:0,fadeOut:0},
    {id:'v',type:'voice',sourceName:'voice',start:transition,duration:2*spb,sourceOffset:0,volume:1,fadeIn:0,fadeOut:0},
    {id:'f',type:'fx',sourceName:'fx',start:transition,duration:spb,sourceOffset:0,volume:.8,fadeIn:0,fadeOut:0},
  ];
  await engine.startAt(0);const ac=FakeAudioContext.last;
  assert.equal(ac.log.starts.length,1,'look-ahead scheduler should initially create only the clip near the playhead');
  const outgoing=ac.log.starts[0],info0=engine.getClockInfo();assert.equal(info0.currentTime,0,'playhead holds at timeline anchor during scheduling lead-in');
  assert.equal(info0.lookaheadSeconds,6,'sequential playback must use a bounded look-ahead window');
  ac.currentTime=info0.contextAnchor+(transition-4);engine.runSchedulerNow();
  assert.equal(ac.log.starts.length,4,'incoming music + VO + FX must be scheduled before the handoff enters the look-ahead window');
  const incoming=ac.log.starts[1],voice=ac.log.starts[2],fx=ac.log.starts[3],handoff=outgoing.when+outgoing.duration;
  assert.ok(Math.abs(handoff-incoming.when)<1e-9,'mid-eight music handoff must share one AudioContext instant');
  assert.ok(Math.abs(incoming.when-voice.when)<1e-9,'voice must share the same AudioContext clock');
  assert.ok(Math.abs(incoming.when-fx.when)<1e-9,'FX must share the same AudioContext clock');
  ac.currentTime=info0.contextAnchor+.375;assert.ok(Math.abs(engine.currentTime()-.375)<1e-9,'playhead must advance from AudioContext time');

  const oldSources=ac.log.starts.map(x=>x.source);await engine.seekTo(transition+.5*spb);assert.ok(oldSources.every(s=>s.stopped),'seek must stop every previously scheduled source');const seekInfo=engine.getClockInfo();assert.ok(Math.abs(seekInfo.timelineAnchor-(transition+.5*spb))<1e-9,'seek anchor must equal requested timeline position');
  ac.currentTime=seekInfo.contextAnchor+.25;const pausedAt=engine.currentTime();engine.stop();assert.ok(Math.abs(engine.currentTime()-pausedAt)<1e-9,'pause must retain current timeline position');const startsBeforeResume=ac.log.starts.length;await engine.startAt(pausedAt);assert.ok(ac.log.starts.length>startsBeforeResume,'resume must create a fresh AudioContext schedule');

  engine.stop();state.audioTimeline.clips.push(
    {id:'v2',type:'voice',sourceName:'voice2',start:transition,duration:spb,sourceOffset:0,volume:.7,fadeIn:0,fadeOut:0},
    {id:'f2',type:'fx',sourceName:'fx2',start:transition,duration:spb,sourceOffset:0,volume:.6,fadeIn:0,fadeOut:0}
  );
  const beforeLayered=ac.log.starts.length;await engine.startAt(transition);const layered=ac.log.starts.slice(beforeLayered);assert.equal(layered.length,5,'incoming music + 2 VO + 2 FX should schedule together');const common=layered[0].when;assert.ok(layered.every(x=>Math.abs(x.when-common)<1e-9),'all layered sources must use one AudioContext instant');

  const rapidOld=layered.map(x=>x.source);await engine.seekTo(transition+spb);const afterFirstSeek=ac.log.starts.slice(beforeLayered+layered.length);await engine.seekTo(transition+2*spb);assert.ok(rapidOld.every(s=>s.stopped),'first rapid seek must stop old layered sources');assert.ok(afterFirstSeek.every(x=>x.source.stopped),'second rapid seek must stop first seek schedule');const rapidInfo=engine.getClockInfo();assert.ok(Math.abs(rapidInfo.timelineAnchor-(transition+2*spb))<1e-9,'rapid seek must end at newest requested position');

  engine.stop();engine.clearBuffers();let release;fetchGate=new Promise(r=>{release=r});const startsBeforeCancel=ac.log.starts.length;const pending=engine.startAt(0);assert.equal(engine.isStarting(),true,'engine should expose pending preload state');engine.stop();release();await pending;fetchGate=null;assert.equal(ac.log.starts.length,startsBeforeCancel,'cancelled preload must not schedule any late sources');assert.equal(engine.getClockInfo().activeSources,0,'cancelled preload must leave no active sources');

  engine.stop();engine.clearBuffers();const finalInfo=engine.getClockInfo();assert.equal(finalInfo.activeSources,0,'stop must leave no active sources');assert.equal(finalInfo.scheduledClipCount,0,'stop must clear rolling scheduler state');assert.equal(finalInfo.bufferCount,0,'buffer cache must be clearable on project restore');
  console.log('audio engine integration: look-ahead scheduling, exact handoffs and cancellation passed');
})().catch(err=>{console.error(err);process.exitCode=1});
