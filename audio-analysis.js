(()=>{
  const $q=s=>document.querySelector(s);
  const analysisCache=new Map();
  let busyTrack=null;

  function ensureStore(){
    if(!state.trackAnalysis || typeof state.trackAnalysis!=='object') state.trackAnalysis={};
  }
  function metaFor(track){
    ensureStore();
    if(!state.trackAnalysis[track.name]) state.trackAnalysis[track.name]={bpm:null,autoBpm:null,confidence:0,oneOffset:null,analyzedAt:null};
    return state.trackAnalysis[track.name];
  }
  function formatTime(s){
    if(!Number.isFinite(s))return '—';
    const m=Math.floor(s/60),sec=Math.floor(s%60),ms=Math.floor((s-Math.floor(s))*1000);
    return `${m}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  }
  function stretchText(bpm){
    const target=Number(state.targetBpm)||147;
    if(!Number.isFinite(bpm)||bpm<=0)return 'Tempoero ei laskettavissa';
    const ratio=target/bpm;
    const pct=(ratio-1)*100;
    return `${bpm.toFixed(1)} → ${target} BPM · ${ratio.toFixed(3)}× (${pct>=0?'+':''}${pct.toFixed(1)} %)`;
  }

  async function decodeTrack(track){
    if(analysisCache.has(track.name))return analysisCache.get(track.name);
    if(!track.url)throw new Error('Audiotiedosto ei ole enää saatavilla tässä istunnossa.');
    const bytes=await fetch(track.url).then(r=>r.arrayBuffer());
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    try{
      const buf=await ac.decodeAudioData(bytes.slice(0));
      analysisCache.set(track.name,buf);
      return buf;
    }finally{ac.close().catch(()=>{})}
  }

  function makeMono(buffer,maxSeconds=120){
    const sr=buffer.sampleRate;
    const length=Math.min(buffer.length,Math.floor(sr*maxSeconds));
    const out=new Float32Array(length);
    const channels=Math.min(buffer.numberOfChannels,2);
    for(let c=0;c<channels;c++){
      const data=buffer.getChannelData(c);
      for(let i=0;i<length;i++)out[i]+=data[i]/channels;
    }
    return {data:out,sr};
  }

  function estimateBpm(buffer){
    const {data,sr}=makeMono(buffer,120);
    const hop=1024;
    const n=Math.floor(data.length/hop);
    if(n<100)throw new Error('Tiedosto on liian lyhyt BPM-analyysiin.');
    const env=new Float32Array(n);
    let prev=0;
    for(let f=0;f<n;f++){
      const start=f*hop,end=Math.min(data.length,start+hop);
      let sum=0;
      for(let i=start;i<end;i++){const v=data[i];sum+=v*v}
      const rms=Math.sqrt(sum/Math.max(1,end-start));
      const flux=Math.max(0,rms-prev);
      env[f]=flux;
      prev=rms;
    }
    const smooth=new Float32Array(n);
    let rolling=0,win=24;
    for(let i=0;i<n;i++){
      rolling+=env[i]; if(i>=win)rolling-=env[i-win];
      smooth[i]=rolling/Math.min(win,i+1);
    }
    const peaks=[];
    for(let i=2;i<n-2;i++){
      const threshold=smooth[i]*1.55+0.0004;
      if(env[i]>threshold&&env[i]>=env[i-1]&&env[i]>env[i+1]&&env[i]>=env[i-2]&&env[i]>env[i+2])peaks.push(i);
    }
    if(peaks.length<8)throw new Error('Selkeitä iskuja ei löytynyt tarpeeksi. Syötä BPM käsin.');

    const histogram=new Map();
    const minBpm=70,maxBpm=190;
    for(let a=0;a<peaks.length;a++){
      for(let step=1;step<=4&&a+step<peaks.length;step++){
        const frames=peaks[a+step]-peaks[a];
        if(frames<=0)continue;
        const seconds=frames*hop/sr;
        let bpm=60*step/seconds;
        while(bpm<minBpm)bpm*=2;
        while(bpm>maxBpm)bpm/=2;
        if(bpm<minBpm||bpm>maxBpm)continue;
        const bucket=Math.round(bpm*2)/2;
        histogram.set(bucket,(histogram.get(bucket)||0)+(5-step));
      }
    }
    const ranked=[...histogram.entries()].sort((a,b)=>b[1]-a[1]);
    if(!ranked.length)throw new Error('BPM-arviota ei saatu. Syötä BPM käsin.');
    let [best,score]=ranked[0];
    const total=ranked.slice(0,12).reduce((s,x)=>s+x[1],0)||1;
    const confidence=Math.min(0.99,score/total*2.4);
    return {bpm:best,confidence,peaks:peaks.length};
  }

  function augmentMusicList(){
    ensureStore();
    const list=$q('#musicList');
    if(!list||!state?.tracks)return;
    [...list.querySelectorAll('.music-item')].forEach((item,i)=>{
      const track=state.tracks[i];if(!track)return;
      const old=item.querySelector('.track-analysis');if(old)old.remove();
      const m=metaFor(track);
      const box=document.createElement('div');
      box.className='track-analysis';
      const bpm=Number(m.bpm)||Number(m.autoBpm)||0;
      const conf=m.autoBpm?`${Math.round((m.confidence||0)*100)} %`:'—';
      box.innerHTML=`
        <div class="analysis-grid">
          <label>BPM
            <input class="analysis-bpm" data-track="${i}" type="number" min="50" max="240" step="0.1" value="${bpm?bpm.toFixed(1):''}" placeholder="Analysoi">
          </label>
          <div class="analysis-stat"><span>Automaattinen</span><strong>${m.autoBpm?Number(m.autoBpm).toFixed(1):'—'}</strong></div>
          <div class="analysis-stat"><span>Varmuus</span><strong>${conf}</strong></div>
          <div class="analysis-stat"><span>1-lasku</span><strong>${m.oneOffset!=null?formatTime(m.oneOffset):'ei asetettu'}</strong></div>
        </div>
        <div class="analysis-actions">
          <button class="mini-btn" data-analyze="${i}" ${busyTrack===i?'disabled':''}>${busyTrack===i?'Analysoidaan…':'⚡ Analysoi BPM'}</button>
          <button class="mini-btn" data-markone="${i}">Aseta nykyhetki 1-laskuksi</button>
          <button class="mini-btn" data-jumpone="${i}" ${m.oneOffset==null?'disabled':''}>▶ Mene 1-laskuun</button>
        </div>
        <div class="stretch-preview ${bpm?'':'muted'}">${bpm?stretchText(bpm):'Kun BPM on tiedossa, tässä näkyy sovitus projektin tavoite-BPM:ään.'}</div>`;
      item.appendChild(box);
    });
  }

  async function analyze(i){
    const track=state.tracks?.[i];if(!track||busyTrack!==null)return;
    busyTrack=i;augmentMusicList();
    try{
      const buf=await decodeTrack(track);
      const result=estimateBpm(buf);
      const m=metaFor(track);
      m.autoBpm=result.bpm;m.bpm=result.bpm;m.confidence=result.confidence;m.analyzedAt=Date.now();
      scheduleSave();
    }catch(e){alert(`BPM-analyysi epäonnistui: ${e.message}`)}
    finally{busyTrack=null;augmentMusicList()}
  }

  function markOne(i){
    const track=state.tracks?.[i];if(!track)return;
    if(!player.src||player.src!==track.url){
      alert('Paina ensin tämän kappaleen “▶ Kuuntele” ja siirrä soitin oikeaan 1-laskuun.');return;
    }
    const m=metaFor(track);m.oneOffset=player.currentTime;m.oneSetAt=Date.now();scheduleSave();augmentMusicList();
  }
  function jumpOne(i){
    const track=state.tracks?.[i];if(!track)return;const m=metaFor(track);if(m.oneOffset==null)return;
    if(player.src!==track.url)playTrack(i);
    setTimeout(()=>{player.currentTime=m.oneOffset;player.play().catch(()=>{})},player.src===track.url?0:80);
  }

  function init(){
    ensureStore();
    const list=$q('#musicList');if(!list)return;
    const oldRenderTracks=renderTracks;
    renderTracks=function(){oldRenderTracks();augmentMusicList()};
    augmentMusicList();
    list.addEventListener('click',e=>{
      const a=e.target.closest('[data-analyze]');if(a){e.stopPropagation();analyze(Number(a.dataset.analyze));return}
      const m=e.target.closest('[data-markone]');if(m){e.stopPropagation();markOne(Number(m.dataset.markone));return}
      const j=e.target.closest('[data-jumpone]');if(j){e.stopPropagation();jumpOne(Number(j.dataset.jumpone));}
    });
    list.addEventListener('change',e=>{
      const input=e.target.closest('.analysis-bpm');if(!input)return;
      const track=state.tracks?.[Number(input.dataset.track)];if(!track)return;
      const value=Number(input.value);const m=metaFor(track);m.bpm=Number.isFinite(value)&&value>0?value:null;scheduleSave();augmentMusicList();
    });
    const bpmInput=$q('#targetBpm');if(bpmInput)bpmInput.addEventListener('input',()=>setTimeout(augmentMusicList,0));
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
