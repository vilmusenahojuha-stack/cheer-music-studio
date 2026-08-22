(()=>{
  const q=s=>document.querySelector(s);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const bufferCache=new Map();
  const activeSources=new Set();
  let ctx=null;
  let running=false;
  let timelineAnchor=0;
  let contextAnchor=0;
  let generation=0;

  function ensure(){
    if(!state.audioTimeline)state.audioTimeline={clips:[],zoom:1,snap:'beat'};
    state.audioTimeline.clips=Array.isArray(state.audioTimeline.clips)?state.audioTimeline.clips:[];
    if(!state.mixSettings)state.mixSettings={autoDuck:true,duckDb:-7,duckAttack:.08,duckRelease:.18};
  }

  function audioContext(){
    if(!ctx){
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)throw new Error('Web Audio API ei ole käytettävissä tässä selaimessa.');
      ctx=new C({latencyHint:'interactive'});
    }
    return ctx;
  }

  function trackFor(c){return(state.tracks||[]).find(t=>t.name===c.sourceName)}
  function rateFor(c){
    if(c.type!=='music')return 1;
    const bpm=Number(state.trackAnalysis?.[c.sourceName]?.bpm||state.trackAnalysis?.[c.sourceName]?.autoBpm);
    const target=Number(state.targetBpm)||147;
    return Number.isFinite(bpm)&&bpm>0?clamp(target/bpm,.5,2):1;
  }
  function maxDurationFor(c,offset=c.sourceOffset||0){
    const t=trackFor(c),rate=rateFor(c);
    return Number.isFinite(t?.duration)&&t.duration>0?Math.max(0,(t.duration-Math.max(0,offset))/Math.max(.0001,rate)):Infinity;
  }

  async function decodeTrack(t){
    if(!t?.url)throw new Error(`Audiotiedosto puuttuu: ${t?.name||'tuntematon'}`);
    const key=`${t.name}::${t.size||''}::${t.duration||''}`;
    if(bufferCache.has(key))return bufferCache.get(key);
    const ac=audioContext();
    const bytes=await fetch(t.url).then(r=>{if(!r.ok)throw new Error(`Audiota ei voitu lukea: ${t.name}`);return r.arrayBuffer()});
    const buffer=await ac.decodeAudioData(bytes.slice(0));
    bufferCache.set(key,buffer);
    return buffer;
  }

  function voiceWindows(){
    ensure();
    if(state.mixSettings.autoDuck===false)return[];
    const attack=clamp(Number(state.mixSettings.duckAttack)||.08,.01,1);
    const release=clamp(Number(state.mixSettings.duckRelease)||.18,.01,2);
    const duck=Math.pow(10,clamp(Number(state.mixSettings.duckDb)||-7,-18,0)/20);
    return state.audioTimeline.clips.filter(v=>v.type==='voice'&&(Number(v.volume)||1)>0).map(v=>({start:(Number(v.start)||0)-attack,voiceStart:Number(v.start)||0,voiceEnd:(Number(v.start)||0)+Math.max(0,Number(v.duration)||0),end:(Number(v.start)||0)+Math.max(0,Number(v.duration)||0)+release,attack,release,duck}));
  }

  function clipEnvelopeAt(c,timelineTime){
    const local=timelineTime-(Number(c.start)||0);
    if(local<0||local>Number(c.duration)||0)return 0;
    const base=clamp(Number.isFinite(Number(c.volume))?Number(c.volume):1,0,1);
    const fi=Math.max(0,Number(c.fadeIn)||0),fo=Math.max(0,Number(c.fadeOut)||0);
    let env=1;
    if(fi>0&&local<fi)env=Math.min(env,local/fi);
    const remain=Math.max(0,(Number(c.duration)||0)-local);
    if(fo>0&&remain<fo)env=Math.min(env,remain/fo);
    return clamp(base*env,0,1);
  }

  function addEnvelopeAutomation(gain,c,startTimeline,endTimeline,when){
    const g=gain.gain;
    const base=clamp(Number.isFinite(Number(c.volume))?Number(c.volume):1,0,1);
    const cStart=Number(c.start)||0,cEnd=cStart+Math.max(0,Number(c.duration)||0);
    const fi=Math.max(0,Number(c.fadeIn)||0),fo=Math.max(0,Number(c.fadeOut)||0);
    g.cancelScheduledValues(when);
    g.setValueAtTime(Math.max(0.00001,clipEnvelopeAt(c,startTimeline)),when);
    if(fi>0){
      const fadeEnd=cStart+fi;
      if(fadeEnd>startTimeline&&fadeEnd<endTimeline)g.linearRampToValueAtTime(base,when+(fadeEnd-startTimeline));
    }
    if(fo>0){
      const fadeStart=cEnd-fo;
      if(fadeStart>startTimeline&&fadeStart<endTimeline){
        g.setValueAtTime(base,when+(fadeStart-startTimeline));
        g.linearRampToValueAtTime(0.00001,when+(cEnd-startTimeline));
      }
    }
  }

  function addDuckingAutomation(gain,c,startTimeline,endTimeline,when){
    if(c.type!=='music'||state.mixSettings.autoDuck===false)return;
    const base=clamp(Number.isFinite(Number(c.volume))?Number(c.volume):1,0,1);
    const windows=voiceWindows();
    for(const w of windows){
      if(w.end<=startTimeline||w.start>=endTimeline)continue;
      const a=Math.max(startTimeline,w.start),vs=Math.max(startTimeline,w.voiceStart),ve=Math.min(endTimeline,w.voiceEnd),e=Math.min(endTimeline,w.end);
      const tA=when+(a-startTimeline),tVS=when+(vs-startTimeline),tVE=when+(ve-startTimeline),tE=when+(e-startTimeline);
      const current=Math.max(0.00001,clipEnvelopeAt(c,a));
      gain.gain.setValueAtTime(current,tA);
      if(tVS>tA)gain.gain.linearRampToValueAtTime(Math.max(0.00001,current*w.duck),tVS);
      else gain.gain.setValueAtTime(Math.max(0.00001,current*w.duck),tVS);
      if(tVE>=tVS)gain.gain.setValueAtTime(Math.max(0.00001,base*w.duck),tVE);
      if(tE>tVE)gain.gain.linearRampToValueAtTime(Math.max(0.00001,clipEnvelopeAt(c,e)),tE);
    }
  }

  function stopAllSources(){
    for(const item of [...activeSources]){
      try{item.source.stop()}catch{}
      try{item.source.disconnect()}catch{}
      try{item.gain.disconnect()}catch{}
      activeSources.delete(item);
    }
  }

  async function scheduleClip(c,playFrom,ctxStart,myGeneration){
    const clipStart=Number(c.start)||0;
    const clipEnd=clipStart+Math.max(0,Number(c.duration)||0);
    if(clipEnd<=playFrom)return;
    const t=trackFor(c);if(!t?.url)return;
    const buffer=await decodeTrack(t);
    if(myGeneration!==generation||!running)return;
    const ac=audioContext();
    const rate=rateFor(c);
    const timelineStart=Math.max(playFrom,clipStart);
    const localTimeline=Math.max(0,timelineStart-clipStart);
    const sourceOffset=Math.max(0,(Number(c.sourceOffset)||0)+localTimeline*rate);
    if(sourceOffset>=buffer.duration)return;
    const timelineDuration=Math.min(clipEnd-timelineStart,(buffer.duration-sourceOffset)/Math.max(.0001,rate));
    if(timelineDuration<=.001)return;
    const when=ctxStart+Math.max(0,timelineStart-playFrom);
    const source=ac.createBufferSource();
    source.buffer=buffer;
    source.playbackRate.setValueAtTime(rate,when);
    const gain=ac.createGain();
    addEnvelopeAutomation(gain,c,timelineStart,timelineStart+timelineDuration,when);
    addDuckingAutomation(gain,c,timelineStart,timelineStart+timelineDuration,when);
    source.connect(gain).connect(ac.destination);
    const item={source,gain,clipId:c.id,generation:myGeneration};
    activeSources.add(item);
    source.onended=()=>{activeSources.delete(item);try{source.disconnect();gain.disconnect()}catch{}};
    source.start(when,sourceOffset,timelineDuration*rate);
  }

  async function scheduleAll(playFrom){
    ensure();
    const ac=audioContext();
    if(ac.state==='suspended')await ac.resume();
    const myGeneration=++generation;
    stopAllSources();
    const lead=.06;
    contextAnchor=ac.currentTime+lead;
    timelineAnchor=Math.max(0,Number(playFrom)||0);
    const tasks=state.audioTimeline.clips.map(c=>scheduleClip(c,timelineAnchor,contextAnchor,myGeneration));
    await Promise.allSettled(tasks);
  }

  async function startAt(playFrom=0){
    if(running)stop();
    q('#audioPlayer')?.pause();
    running=true;
    try{await scheduleAll(playFrom)}catch(err){running=false;console.error(err);throw err}
  }
  function currentTime(){
    if(!running||!ctx)return timelineAnchor;
    return Math.max(0,timelineAnchor+(ctx.currentTime-contextAnchor));
  }
  function stop(){
    if(running&&ctx)timelineAnchor=currentTime();
    running=false;
    generation++;
    stopAllSources();
  }
  async function seekTo(sec){
    const was=running;
    stop();
    timelineAnchor=Math.max(0,Number(sec)||0);
    if(was)await startAt(timelineAnchor);
  }
  function isRunning(){return running}
  function clearBuffers(){bufferCache.clear()}

  function selectedClip(){if(window.cheerAudioEditor?.getSelectedClip)return window.cheerAudioEditor.getSelectedClip();const id=q('.audio-clip.selected')?.dataset.clip;return id?(state.audioTimeline?.clips||[]).find(c=>c.id===id):null}
  function redraw(){window.cheerAudioEditor?.renderTimeline?.();setTimeout(refreshInspector,0)}
  function nextMusicClip(c){return(state.audioTimeline?.clips||[]).filter(x=>x.type==='music'&&x.id!==c.id&&Number(x.start)>=Number(c.start)).sort((a,b)=>a.start-b.start)[0]||null}
  function autoCrossfade(){
    const c=selectedClip();if(!c||c.type!=='music'){alert('Valitse ensin musiikkiclippi.');return}const next=nextMusicClip(c);if(!next){alert('Tämän clipin jälkeen ei ole seuraavaa musiikkiclippiä.');return}
    snapshot();const overlap=Math.min(.45,Math.max(.18,60/(Number(state.targetBpm)||147)*.8)),wantedDuration=(next.start-c.start)+overlap;
    c.duration=Math.max(.05,Math.min(wantedDuration,maxDurationFor(c,c.sourceOffset||0)));const actual=Math.max(0,c.start+c.duration-next.start);c.fadeOut=Math.max(.05,actual||overlap);next.fadeIn=Math.max(.05,actual||overlap);scheduleSave();redraw();
  }
  function duckFactor(now,c){
    ensure();if(c.type!=='music'||state.mixSettings.autoDuck===false)return 1;
    const duck=Math.pow(10,clamp(Number(state.mixSettings.duckDb)||-7,-18,0)/20),attack=clamp(Number(state.mixSettings.duckAttack)||.08,.01,1),release=clamp(Number(state.mixSettings.duckRelease)||.18,.01,2);let factor=1;
    for(const v of state.audioTimeline.clips){if(v.type!=='voice'||(Number(v.volume)||1)<=0)continue;const s=Number(v.start)||0,e=s+Math.max(0,Number(v.duration)||0);if(now<s-attack||now>e+release)continue;let f=duck;if(now<s)f=1-(1-duck)*clamp((now-(s-attack))/attack,0,1);else if(now>e)f=duck+(1-duck)*clamp((now-e)/release,0,1);factor=Math.min(factor,f)}return factor;
  }

  function addInspector(){
    if(q('#clipInspector'))return;const host=q('#audioWorkspace .audio-status');if(!host)return;const box=document.createElement('div');box.id='clipInspector';box.style.cssText='display:none;align-items:end;gap:10px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(15,23,42,.45)';
    box.innerHTML=`<strong style="margin-right:4px">Clipin säätö</strong><label>Voimakkuus <input id="clipVolume" type="range" min="0" max="1" step="0.01" value="1"><span id="clipVolumeText">100 %</span></label><label>Lähteen alku <input id="clipSourceOffset" type="number" min="0" step="0.01" value="0" style="width:82px"> s</label><label>Fade in <input id="clipFadeIn" type="number" min="0" max="10" step="0.05" value="0" style="width:70px"> s</label><label>Fade out <input id="clipFadeOut" type="number" min="0" max="10" step="0.05" value="0" style="width:70px"> s</label><button id="btnAutoCrossfade" class="mini-btn">↔ Siirtymä seuraavaan</button><span id="clipTempoInfo" style="opacity:.8"></span>`;host.insertAdjacentElement('afterend',box);
    const save=()=>{const c=selectedClip();if(!c)return;c.volume=clamp(Number(q('#clipVolume').value)||0,0,1);c.sourceOffset=Math.max(0,Number(q('#clipSourceOffset').value)||0);c.duration=Math.min(Number(c.duration)||0,maxDurationFor(c,c.sourceOffset));c.fadeIn=clamp(Number(q('#clipFadeIn').value)||0,0,Number(c.duration)||0);c.fadeOut=clamp(Number(q('#clipFadeOut').value)||0,0,Number(c.duration)||0);q('#clipVolumeText').textContent=`${Math.round(c.volume*100)} %`;scheduleSave();redraw()};
    q('#clipVolume').addEventListener('input',save);q('#clipSourceOffset').addEventListener('change',save);q('#clipFadeIn').addEventListener('change',save);q('#clipFadeOut').addEventListener('change',save);q('#btnAutoCrossfade').addEventListener('click',autoCrossfade);
  }
  function refreshInspector(){
    addInspector();const box=q('#clipInspector'),c=selectedClip();if(!box)return;if(!c){box.style.display='none';return}box.style.display='flex';
    const volume=Number.isFinite(Number(c.volume))?Number(c.volume):1;q('#clipVolume').value=String(volume);q('#clipVolumeText').textContent=`${Math.round(volume*100)} %`;q('#clipSourceOffset').value=String(Math.max(0,Number(c.sourceOffset)||0));q('#clipFadeIn').value=String(Math.max(0,Number(c.fadeIn)||0));q('#clipFadeOut').value=String(Math.max(0,Number(c.fadeOut)||0));q('#btnAutoCrossfade').style.display=c.type==='music'?'inline-flex':'none';
    const r=rateFor(c),a=state.trackAnalysis?.[c.sourceName],bpm=Number(a?.bpm||a?.autoBpm);q('#clipTempoInfo').textContent=c.type==='music'&&bpm?`${bpm.toFixed(1)} → ${state.targetBpm} BPM · ${r.toFixed(3)}× · AudioContext-kello`:(c.type==='music'?'Tempo: alkuperäinen · AudioContext-kello':'Nopeus 1.000× · AudioContext-kello');
  }

  function init(){
    ensure();addInspector();
    q('#timelineContent')?.addEventListener('pointerdown',()=>setTimeout(refreshInspector,0));
    window.addEventListener('pointerup',()=>setTimeout(refreshInspector,0));
    window.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace')setTimeout(refreshInspector,0)});
    document.addEventListener('cheer-audio-restored',()=>{stop();clearBuffers()});
    window.addEventListener('beforeunload',stop);
    refreshInspector();
    window.cheerTimelineAudioEngine={startAt,start:startAt,stop,seekTo,currentTime,isRunning,rateFor,refreshInspector,autoCrossfade,duckFactor,clearBuffers,getAudioContext:audioContext};
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
