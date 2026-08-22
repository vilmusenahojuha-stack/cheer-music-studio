(()=>{
  const q=s=>document.querySelector(s);
  let exporting=false;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const fmt=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
  const db=v=>v>0?20*Math.log10(v):-Infinity;

  function ensure(){
    if(!state.audioTimeline) state.audioTimeline={clips:[],zoom:1,snap:'beat'};
    state.audioTimeline.clips=Array.isArray(state.audioTimeline.clips)?state.audioTimeline.clips:[];
  }
  function rateFor(c){return window.cheerTimelineAudioEngine?.rateFor?.(c)||1}
  function trackFor(c){return (state.tracks||[]).find(t=>t.name===c.sourceName)}
  function safeName(){return (state.projectName||'cheer-mix').trim().replace(/[^a-z0-9åäö_-]+/gi,'-').replace(/^-+|-+$/g,'')||'cheer-mix'}
  function projectLength(){return Math.max(1,Number(state.duration)||150)}
  function setStatus(text,pct=null){
    const el=q('#mixExportStatus');if(!el)return;
    el.textContent=text;
    const bar=q('#mixExportProgress');
    if(bar&&pct!=null)bar.style.width=`${clamp(pct,0,100)}%`;
  }
  function mimeType(){
    const options=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
    return options.find(x=>window.MediaRecorder?.isTypeSupported?.(x))||'';
  }
  function validate(){
    ensure();
    const check=window.cheerMixAssistant?.runChecks?.();
    if(check?.errors)return {ok:false,message:`Miksauksessa on ${check.errors} virhettä. Korjaa ne Mix-tarkistuksessa ennen vientiä.`};
    if(!state.audioTimeline.clips.length)return {ok:false,message:'Aikajanalla ei ole clippejä vietäväksi.'};
    const missing=state.audioTimeline.clips.filter(c=>!trackFor(c)?.url);
    if(missing.length)return {ok:false,message:`${missing.length} clipiltä puuttuu ladattu lähdeaudiotiedosto.`};
    if(!window.MediaRecorder)return {ok:false,message:'Tämä selain ei tue miksauksen tallennusta (MediaRecorder puuttuu). Käytä uusinta Chromea tai Edgeä.'};
    return {ok:true,warns:check?.warns||0};
  }
  function applyEnvelope(gain,clip,origin){
    const start=origin+Math.max(0,Number(clip.start)||0);
    const dur=Math.max(.01,Number(clip.duration)||.01);
    const end=start+dur;
    const vol=clamp(Number.isFinite(Number(clip.volume))?Number(clip.volume):1,0,1);
    const fi=clamp(Number(clip.fadeIn)||0,0,dur);
    const fo=clamp(Number(clip.fadeOut)||0,0,dur);
    gain.cancelScheduledValues(start);
    gain.setValueAtTime(fi>0?0:vol,start);
    if(fi>0)gain.linearRampToValueAtTime(vol,start+fi);
    if(fo>0){
      const fadeStart=Math.max(start,end-fo);
      gain.setValueAtTime(vol,fadeStart);
      gain.linearRampToValueAtTime(0,end);
    }else gain.setValueAtTime(vol,end);
  }
  function scheduleClip(ctx,dest,clip,origin,cleanup){
    const track=trackFor(clip);if(!track?.url)return;
    const audio=new Audio();
    audio.preload='auto';audio.src=track.url;audio.playsInline=true;
    try{audio.preservesPitch=true;audio.webkitPreservesPitch=true;audio.mozPreservesPitch=true}catch{}
    const rate=rateFor(clip);audio.playbackRate=rate;
    const source=ctx.createMediaElementSource(audio),gain=ctx.createGain();
    source.connect(gain).connect(dest);
    applyEnvelope(gain,clip,origin);
    const offset=Math.max(0,Number(clip.sourceOffset)||0);
    const delay=Math.max(0,origin-ctx.currentTime+Math.max(0,Number(clip.start)||0));
    const startMs=delay*1000;
    const stopMs=startMs+Math.max(.01,Number(clip.duration)||.01)*1000+80;
    const startTimer=setTimeout(()=>{
      try{audio.currentTime=offset}catch{}
      audio.play().catch(err=>console.warn('Export clip play failed',clip.sourceName,err));
    },startMs);
    const stopTimer=setTimeout(()=>{try{audio.pause()}catch{}},stopMs);
    cleanup.push(()=>{clearTimeout(startTimer);clearTimeout(stopTimer);try{audio.pause();audio.removeAttribute('src');audio.load();source.disconnect();gain.disconnect()}catch{}});
  }
  function analyzeBuffer(buffer){
    let peak=0,sum=0,count=0;
    const channels=Math.min(2,buffer.numberOfChannels);
    for(let c=0;c<channels;c++){
      const data=buffer.getChannelData(c);
      for(let i=0;i<data.length;i++){
        const a=Math.abs(data[i]);if(a>peak)peak=a;
        sum+=data[i]*data[i];count++;
      }
    }
    const rms=count?Math.sqrt(sum/count):0;
    return {peak,rms,peakDb:db(peak),rmsDb:db(rms)};
  }
  function normalizationGain(stats){
    if(!stats?.peak||stats.peak<0.0001)return 1;
    const target=Math.pow(10,-1/20); // -1 dBFS peak ceiling
    const raw=target/stats.peak;
    return clamp(raw,0.25,Math.pow(10,6/20)); // never add more than +6 dB
  }
  function writeString(view,offset,text){for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
  function audioBufferToWav(buffer,gain=1){
    const channels=Math.min(2,buffer.numberOfChannels),sampleRate=buffer.sampleRate,length=buffer.length;
    const bytesPerSample=2,blockAlign=channels*bytesPerSample,dataSize=length*blockAlign;
    const ab=new ArrayBuffer(44+dataSize),view=new DataView(ab);
    writeString(view,0,'RIFF');view.setUint32(4,36+dataSize,true);writeString(view,8,'WAVE');writeString(view,12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate*blockAlign,true);view.setUint16(32,blockAlign,true);view.setUint16(34,16,true);writeString(view,36,'data');view.setUint32(40,dataSize,true);
    const data=[];for(let c=0;c<channels;c++)data.push(buffer.getChannelData(c));
    let p=44;for(let i=0;i<length;i++)for(let c=0;c<channels;c++){const s=clamp(data[c][i]*gain,-1,1);view.setInt16(p,s<0?s*0x8000:s*0x7fff,true);p+=2}
    return new Blob([ab],{type:'audio/wav'});
  }
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  function resultText(stats,gain){
    const finalPeak=stats.peak*gain;
    const finalRms=stats.rms*gain;
    const gdb=db(gain);
    return `Valmis: ${safeName()}.wav · peak ${db(finalPeak).toFixed(1)} dBFS · RMS ${db(finalRms).toFixed(1)} dBFS · master ${gdb>=0?'+':''}${gdb.toFixed(1)} dB`;
  }

  async function exportWav(){
    if(exporting)return;
    const v=validate();if(!v.ok){alert(v.message);return}
    if(v.warns&&!confirm(`Mix-tarkistuksessa on ${v.warns} huomautusta. Haluatko silti tehdä WAV-viennin?`))return;
    exporting=true;
    const btn=q('#btnExportWav');if(btn)btn.disabled=true;
    window.cheerTimelineAudioEngine?.stop?.();
    q('#audioPlayer')?.pause();
    const cleanup=[];
    let ctx=null,recorder=null,progressTimer=null;
    try{
      ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});
      await ctx.resume();
      const dest=ctx.createMediaStreamDestination();
      const master=ctx.createGain();master.gain.value=.98;
      const limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-3;limiter.knee.value=2;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.12;
      master.connect(limiter).connect(dest);
      const mime=mimeType();
      recorder=new MediaRecorder(dest.stream,mime?{mimeType:mime,audioBitsPerSecond:256000}:{audioBitsPerSecond:256000});
      const chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||new Error('Tallennus epäonnistui'))});
      const duration=projectLength(),lead=.30,origin=ctx.currentTime+lead;
      for(const c of state.audioTimeline.clips)scheduleClip(ctx,master,c,origin,cleanup);
      recorder.start(1000);
      const started=performance.now()+lead*1000;
      progressTimer=setInterval(()=>{
        const elapsed=Math.max(0,(performance.now()-started)/1000),pct=Math.min(99,elapsed/duration*100);
        setStatus(`Renderöidään reaaliajassa ${fmt(elapsed)} / ${fmt(duration)}…`,pct);
      },250);
      setStatus(`Valmistellaan WAV-vientiä (${fmt(duration)})…`,0);
      await new Promise(r=>setTimeout(r,(lead+duration+.18)*1000));
      recorder.stop();await done;clearInterval(progressTimer);progressTimer=null;
      setStatus('Analysoidaan peak-taso ja viimeistellään WAV…',99);
      const recorded=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});
      try{
        const decoded=await ctx.decodeAudioData((await recorded.arrayBuffer()).slice(0));
        const stats=analyzeBuffer(decoded);
        const gain=normalizationGain(stats);
        const wav=audioBufferToWav(decoded,gain);download(wav,`${safeName()}.wav`);
        setStatus(resultText(stats,gain),100);
      }catch(err){
        console.warn('WAV conversion failed, downloading recorder format',err);
        const ext=(recorded.type||'').includes('ogg')?'ogg':'webm';download(recorded,`${safeName()}.${ext}`);
        setStatus(`WAV-muunnos ei onnistunut – varatiedosto ${ext.toUpperCase()} ladattiin.`,100);
      }
    }catch(err){
      console.error(err);setStatus('Vienti epäonnistui.',0);alert(`Miksauksen vienti epäonnistui: ${err.message||err}`);
    }finally{
      if(progressTimer)clearInterval(progressTimer);
      cleanup.forEach(fn=>{try{fn()}catch{}});
      if(ctx)ctx.close().catch(()=>{});
      exporting=false;if(btn)btn.disabled=false;
    }
  }

  function addUi(){
    if(q('#mixExport'))return;
    const host=q('#mixAssistant')||q('#audioWorkspace');if(!host)return;
    const panel=document.createElement('section');panel.id='mixExport';panel.className='mix-export';
    panel.innerHTML=`<div class="mix-export-top"><div><h3>Lopullinen vienti</h3><p>48 kHz WAV renderöidään selaimessa reaaliajassa. Master-limiter estää pahimmat yliohjaukset ja lopputulos viimeistellään turvalliseen -1 dBFS peak-tasoon.</p></div><button id="btnExportWav" class="btn primary">⬇ Vie WAV</button></div><div class="mix-export-progress-shell"><div id="mixExportProgress" class="mix-export-progress"></div></div><div id="mixExportStatus" class="mix-export-status">Valmis vientiin.</div>`;
    host.insertAdjacentElement('afterend',panel);
    q('#btnExportWav').addEventListener('click',exportWav);
  }
  const style=document.createElement('style');style.textContent=`.mix-export{margin-top:14px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.42)}.mix-export-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.mix-export h3{margin:0 0 4px}.mix-export p{margin:0;opacity:.75;max-width:800px}.mix-export-progress-shell{height:7px;margin-top:12px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.13)}.mix-export-progress{height:100%;width:0;background:linear-gradient(90deg,#7c3aed,#38bdf8);transition:width .2s}.mix-export-status{margin-top:7px;font-size:.9rem;opacity:.8}@media(max-width:800px){.mix-export-top{align-items:flex-start;flex-direction:column}}`;document.head.appendChild(style);
  function init(){ensure();addUi();window.cheerMixExport={exportWav,validate,audioBufferToWav,analyzeBuffer,normalizationGain}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
