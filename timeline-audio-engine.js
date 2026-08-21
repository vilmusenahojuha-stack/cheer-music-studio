(()=>{
  const q=s=>document.querySelector(s);
  const players=new Map();
  let raf=0;
  let running=false;

  function ensure(){
    if(!state.audioTimeline) state.audioTimeline={clips:[],zoom:1,snap:'beat'};
    state.audioTimeline.clips=Array.isArray(state.audioTimeline.clips)?state.audioTimeline.clips:[];
  }
  function secPerEight(){return 8*60/(Number(state.targetBpm)||147)}
  function pxPerSec(){return 82*(Number(state.audioTimeline?.zoom)||1)/secPerEight()}
  function playheadSec(){
    const left=parseFloat(q('#playhead')?.style.left||'0')||0;
    return Math.max(0,left/Math.max(.0001,pxPerSec()));
  }
  function trackFor(c){return (state.tracks||[]).find(t=>t.name===c.sourceName)}
  function rateFor(c){
    if(c.type!=='music')return 1;
    const bpm=Number(state.trackAnalysis?.[c.sourceName]?.bpm||state.trackAnalysis?.[c.sourceName]?.autoBpm);
    const target=Number(state.targetBpm)||147;
    if(!Number.isFinite(bpm)||bpm<=0)return 1;
    return Math.max(.5,Math.min(2,target/bpm));
  }
  function maxDurationFor(c,offset=c.sourceOffset||0){
    const t=trackFor(c),rate=rateFor(c);
    if(!Number.isFinite(t?.duration)||t.duration<=0)return Infinity;
    return Math.max(0,(t.duration-Math.max(0,offset))/Math.max(.0001,rate));
  }
  function volumeFor(c,local){
    const base=Math.max(0,Math.min(1,Number.isFinite(Number(c.volume))?Number(c.volume):1));
    const fi=Math.max(0,Number(c.fadeIn)||0),fo=Math.max(0,Number(c.fadeOut)||0);
    let env=1;
    if(fi>0&&local<fi)env=Math.min(env,local/fi);
    const remain=Math.max(0,(Number(c.duration)||0)-local);
    if(fo>0&&remain<fo)env=Math.min(env,remain/fo);
    return Math.max(0,Math.min(1,base*env));
  }
  function stopOne(id){
    const p=players.get(id);if(!p)return;
    try{p.audio.pause();p.audio.removeAttribute('src');p.audio.load()}catch{}
    players.delete(id);
  }
  function stopAll(){for(const id of [...players.keys()])stopOne(id)}
  function makePlayer(c,t,now){
    const audio=new Audio();
    audio.preload='auto';audio.src=t.url;audio.playsInline=true;
    try{audio.preservesPitch=true;audio.webkitPreservesPitch=true;audio.mozPreservesPitch=true}catch{}
    const rate=rateFor(c);audio.playbackRate=rate;
    const local=Math.max(0,now-c.start),desired=(Number(c.sourceOffset)||0)+local*rate;
    const seek=()=>{try{audio.currentTime=Math.max(0,desired)}catch{}};
    if(audio.readyState>=1)seek();else audio.addEventListener('loadedmetadata',seek,{once:true});
    audio.volume=volumeFor(c,local);
    audio.play().catch(()=>{});
    const p={audio,rate,sourceName:c.sourceName};players.set(c.id,p);return p;
  }
  function sync(){
    if(!running)return;
    ensure();const now=playheadSec();const wanted=new Set();
    for(const c of state.audioTimeline.clips){
      const start=Number(c.start)||0,dur=Math.max(0,Number(c.duration)||0);
      if(now<start||now>=start+dur)continue;
      const t=trackFor(c);if(!t?.url)continue;
      wanted.add(c.id);
      const local=now-start,rate=rateFor(c),desired=(Number(c.sourceOffset)||0)+local*rate;
      let p=players.get(c.id);
      if(!p||p.sourceName!==c.sourceName){if(p)stopOne(c.id);p=makePlayer(c,t,now)}
      if(Math.abs(p.rate-rate)>.001){p.rate=rate;p.audio.playbackRate=rate}
      p.audio.volume=volumeFor(c,local);
      if(p.audio.readyState>=1&&Math.abs((p.audio.currentTime||0)-desired)>.12){try{p.audio.currentTime=Math.max(0,desired)}catch{}}
      if(p.audio.paused)p.audio.play().catch(()=>{});
    }
    for(const id of [...players.keys()])if(!wanted.has(id))stopOne(id);
    raf=requestAnimationFrame(sync);
  }
  function start(){
    if(running)return;running=true;
    q('#audioPlayer')?.pause();
    sync();
  }
  function stop(){if(!running&&players.size===0)return;running=false;cancelAnimationFrame(raf);stopAll()}
  function transportPlaying(){return (q('#btnTimelinePlay')?.textContent||'').includes('⏸')}
  function followTransport(){transportPlaying()?start():stop()}

  function selectedClip(){
    if(window.cheerAudioEditor?.getSelectedClip)return window.cheerAudioEditor.getSelectedClip();
    const id=q('.audio-clip.selected')?.dataset.clip;
    return id?(state.audioTimeline?.clips||[]).find(c=>c.id===id):null;
  }
  function redraw(){
    if(window.cheerAudioEditor?.renderTimeline)window.cheerAudioEditor.renderTimeline();
    else if(typeof renderAll==='function')renderAll();
    setTimeout(refreshInspector,0);
  }
  function nextMusicClip(c){
    return (state.audioTimeline?.clips||[]).filter(x=>x.type==='music'&&x.id!==c.id&&Number(x.start)>=Number(c.start)).sort((a,b)=>a.start-b.start)[0]||null;
  }
  function autoCrossfade(){
    const c=selectedClip();if(!c||c.type!=='music'){alert('Valitse ensin musiikkiclippi.');return}
    const next=nextMusicClip(c);if(!next){alert('Tämän clipin jälkeen ei ole seuraavaa musiikkiclippiä.');return}
    snapshot();
    const overlap=Math.min(.45,Math.max(.18,8*60/(Number(state.targetBpm)||147)/8*.8));
    const boundary=Math.max(c.start,next.start);
    const wantedDuration=(next.start-c.start)+overlap;
    c.duration=Math.max(.05,Math.min(wantedDuration,maxDurationFor(c,c.sourceOffset||0)));
    const actualOverlap=Math.max(0,c.start+c.duration-next.start);
    c.fadeOut=Math.max(.05,actualOverlap||overlap);
    next.fadeIn=Math.max(.05,actualOverlap||overlap);
    scheduleSave();redraw();
  }
  function addInspector(){
    if(q('#clipInspector'))return;
    const host=q('#audioWorkspace .audio-status');if(!host)return;
    const box=document.createElement('div');box.id='clipInspector';
    box.style.cssText='display:none;align-items:end;gap:10px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(15,23,42,.45)';
    box.innerHTML=`<strong style="margin-right:4px">Clipin säätö</strong><label>Voimakkuus <input id="clipVolume" type="range" min="0" max="1" step="0.01" value="1"><span id="clipVolumeText">100 %</span></label><label>Lähteen alku <input id="clipSourceOffset" type="number" min="0" step="0.01" value="0" style="width:82px"> s</label><label>Fade in <input id="clipFadeIn" type="number" min="0" max="10" step="0.05" value="0" style="width:70px"> s</label><label>Fade out <input id="clipFadeOut" type="number" min="0" max="10" step="0.05" value="0" style="width:70px"> s</label><button id="btnAutoCrossfade" class="mini-btn">↔ Siirtymä seuraavaan</button><span id="clipTempoInfo" style="opacity:.8"></span>`;
    host.insertAdjacentElement('afterend',box);
    const save=()=>{
      const c=selectedClip();if(!c)return;
      c.volume=Math.max(0,Math.min(1,Number(q('#clipVolume').value)||0));
      c.sourceOffset=Math.max(0,Number(q('#clipSourceOffset').value)||0);
      c.duration=Math.min(Number(c.duration)||0,maxDurationFor(c,c.sourceOffset));
      c.fadeIn=Math.max(0,Math.min(Number(c.duration)||0,Number(q('#clipFadeIn').value)||0));
      c.fadeOut=Math.max(0,Math.min(Number(c.duration)||0,Number(q('#clipFadeOut').value)||0));
      q('#clipVolumeText').textContent=`${Math.round(c.volume*100)} %`;
      scheduleSave();redraw();
    };
    q('#clipVolume').addEventListener('input',save);
    q('#clipSourceOffset').addEventListener('change',save);
    q('#clipFadeIn').addEventListener('change',save);
    q('#clipFadeOut').addEventListener('change',save);
    q('#btnAutoCrossfade').addEventListener('click',autoCrossfade);
  }
  function refreshInspector(){
    addInspector();const box=q('#clipInspector'),c=selectedClip();if(!box)return;
    if(!c){box.style.display='none';return}box.style.display='flex';
    const volume=Number.isFinite(Number(c.volume))?Number(c.volume):1;q('#clipVolume').value=String(volume);q('#clipVolumeText').textContent=`${Math.round(volume*100)} %`;
    q('#clipSourceOffset').value=String(Math.max(0,Number(c.sourceOffset)||0));
    q('#clipFadeIn').value=String(Math.max(0,Number(c.fadeIn)||0));q('#clipFadeOut').value=String(Math.max(0,Number(c.fadeOut)||0));
    q('#btnAutoCrossfade').style.display=c.type==='music'?'inline-flex':'none';
    const rate=rateFor(c),a=state.trackAnalysis?.[c.sourceName],bpm=Number(a?.bpm||a?.autoBpm);
    q('#clipTempoInfo').textContent=c.type==='music'&&bpm?`${bpm.toFixed(1)} → ${state.targetBpm} BPM · ${rate.toFixed(3)}× · pitch säilytetään`:`${c.type==='music'?'Tempo: alkuperäinen':'Nopeus 1.000×'}`;
  }

  function init(){
    ensure();addInspector();
    const btn=q('#btnTimelinePlay');if(btn)new MutationObserver(followTransport).observe(btn,{childList:true,characterData:true,subtree:true});
    q('#timelineContent')?.addEventListener('pointerdown',()=>setTimeout(refreshInspector,0));
    window.addEventListener('pointerup',()=>setTimeout(refreshInspector,0));
    window.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace')setTimeout(refreshInspector,0)});
    document.addEventListener('cheer-audio-restored',()=>{if(running){stop();setTimeout(()=>{if(transportPlaying())start()},20)}});
    window.addEventListener('beforeunload',stopAll);
    refreshInspector();followTransport();
    window.cheerTimelineAudioEngine={start,stop,rateFor,refreshInspector,autoCrossfade};
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();