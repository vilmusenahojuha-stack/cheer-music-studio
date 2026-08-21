(()=>{
  const $q=s=>document.querySelector(s);
  const analysisCache=new Map();
  const tapState=new Map();
  let busyTrack=null;

  function ensureStore(){
    if(!state.trackAnalysis || typeof state.trackAnalysis!=='object') state.trackAnalysis={};
  }
  function metaFor(track){
    ensureStore();
    if(!state.trackAnalysis[track.name]) state.trackAnalysis[track.name]={bpm:null,autoBpm:null,confidence:0,oneOffset:null,analyzedAt:null,method:null};
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
    if(!track.url)throw new Error('Audiotiedosto ei ole saatavilla. Päivitä sivu tai lisää tiedosto uudelleen.');
    const bytes=await fetch(track.url).then(r=>r.arrayBuffer());
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    try{
      const buf=await ac.decodeAudioData(bytes.slice(0));
      analysisCache.set(track.name,buf);
      return buf;
    }finally{ac.close().catch(()=>{})}
  }

  function makeMono(buffer,maxSeconds=150){
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

  function buildOnsetEnvelope(buffer){
    const {data,sr}=makeMono(buffer,150);
    const hop=1024;
    const frames=Math.floor(data.length/hop);
    if(frames<120)throw new Error('Tiedosto on liian lyhyt BPM-analyysiin.');
    const rms=new Float32Array(frames);
    for(let f=0;f<frames;f++){
      const start=f*hop,end=Math.min(data.length,start+hop);
      let sum=0;
      for(let i=start;i<end;i++){const v=data[i];sum+=v*v}
      rms[f]=Math.sqrt(sum/Math.max(1,end-start));
    }
    const env=new Float32Array(frames);
    let mean=0;
    for(let i=0;i<frames;i++){
      const a=Math.max(0,i-6);let local=0;
      for(let j=a;j<i;j++)local+=rms[j];
      local/=Math.max(1,i-a);
      const rise=Math.max(0,rms[i]-local*.92);
      env[i]=rise;
      mean+=rise;
    }
    mean/=frames;
    let variance=0;
    for(let i=0;i<frames;i++){const d=env[i]-mean;variance+=d*d}
    const sd=Math.sqrt(variance/frames)||1;
    for(let i=0;i<frames;i++)env[i]=Math.max(0,(env[i]-mean*.2)/sd);
    return {env,frameRate:sr/hop};
  }

  function corrAt(env,lag){
    lag=Math.round(lag);
    if(lag<2||lag>=env.length-4)return 0;
    let num=0,a2=0,b2=0;
    for(let i=lag;i<env.length;i++){
      const a=env[i],b=env[i-lag];
      num+=a*b;a2+=a*a;b2+=b*b;
    }
    return num/Math.sqrt(Math.max(1e-9,a2*b2));
  }

  function estimateBpm(buffer){
    const {env,frameRate}=buildOnsetEnvelope(buffer);
    const minBpm=65,maxBpm=200;
    const candidates=[];
    for(let bpm=minBpm;bpm<=maxBpm;bpm+=0.25){
      const lag=frameRate*60/bpm;
      const base=corrAt(env,lag);
      const half=corrAt(env,lag*2);
      const dbl=corrAt(env,lag/2);
      const score=base+half*.38+dbl*.16;
      candidates.push({bpm,score,base});
    }
    candidates.sort((a,b)=>b.score-a.score);
    if(!candidates.length||candidates[0].score<=0)throw new Error('Selkeää tempoa ei löytynyt. Käytä Tap BPM -painiketta.');
    let best=candidates[0];
    const near=candidates.filter(x=>Math.abs(x.bpm-best.bpm)>2).slice(0,20);
    const second=near[0]?.score||0;
    let confidence=Math.max(0,Math.min(.99,(best.score-second+.03)/(Math.abs(best.score)+.12)));

    const octaveOptions=[best.bpm/2,best.bpm*2].filter(x=>x>=minBpm&&x<=maxBpm);
    const target=Number(state.targetBpm)||147;
    for(const bpm of octaveOptions){
      const cand=candidates.reduce((p,c)=>Math.abs(c.bpm-bpm)<Math.abs(p.bpm-bpm)?c:p,candidates[0]);
      if(cand.score>=best.score*.94 && Math.abs(cand.bpm-target)<Math.abs(best.bpm-target))best=cand;
    }
    return {bpm:Math.round(best.bpm*10)/10,confidence};
  }

  function methodText(m){
    if(m.method==='tap')return 'Tap BPM';
    if(m.method==='manual')return 'Käsin';
    if(m.autoBpm)return 'Automaattinen';
    return '—';
  }

  function augmentMusicList(){
    ensureStore();
    const list=$q('#musicList');
    if(!list||!state?.tracks)return;
    [...list.querySelectorAll('.music-item')].forEach((item,i)=>{
      const track=state.tracks[i];if(!track)return;
      item.querySelector('.track-analysis')?.remove();
      const m=metaFor(track);
      const bpm=Number(m.bpm)||Number(m.autoBpm)||0;
      const conf=m.autoBpm?`${Math.round((m.confidence||0)*100)} %`:'—';
      const taps=tapState.get(track.name)?.times?.length||0;
      const box=document.createElement('div');
      box.className='track-analysis';
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
          <button class="mini-btn" data-tap="${i}" title="Paina rytmin mukana vähintään 4 kertaa">🥁 Tap BPM${taps?` (${taps})`:''}</button>
          <button class="mini-btn" data-half="${i}" ${bpm?'':'disabled'}>÷2</button>
          <button class="mini-btn" data-double="${i}" ${bpm?'':'disabled'}>×2</button>
          <button class="mini-btn" data-markone="${i}">Aseta nykyhetki 1-laskuksi</button>
          <button class="mini-btn" data-jumpone="${i}" ${m.oneOffset==null?'disabled':''}>▶ Mene 1-laskuun</button>
        </div>
        <div class="stretch-preview ${bpm?'':'muted'}">${bpm?`${stretchText(bpm)} · ${methodText(m)}`:'Kun BPM on tiedossa, tässä näkyy sovitus projektin tavoite-BPM:ään.'}</div>`;
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
      m.autoBpm=result.bpm;m.bpm=result.bpm;m.confidence=result.confidence;m.analyzedAt=Date.now();m.method='auto';
      scheduleSave();
    }catch(e){alert(`BPM-analyysi epäonnistui: ${e.message}`)}
    finally{busyTrack=null;augmentMusicList()}
  }

  function tapBpm(i){
    const track=state.tracks?.[i];if(!track)return;
    const now=performance.now();
    let s=tapState.get(track.name)||{times:[]};
    if(s.times.length && now-s.times[s.times.length-1]>2200)s={times:[]};
    s.times.push(now);if(s.times.length>10)s.times.shift();tapState.set(track.name,s);
    if(s.times.length>=4){
      const gaps=[];for(let n=1;n<s.times.length;n++)gaps.push(s.times[n]-s.times[n-1]);
      gaps.sort((a,b)=>a-b);
      const median=gaps.length%2?gaps[(gaps.length-1)/2]:(gaps[gaps.length/2-1]+gaps[gaps.length/2])/2;
      let bpm=60000/median;
      while(bpm<65)bpm*=2;while(bpm>200)bpm/=2;
      const m=metaFor(track);m.bpm=Math.round(bpm*10)/10;m.method='tap';m.confidence=1;m.tapAt=Date.now();scheduleSave();
    }
    augmentMusicList();
  }

  function scaleBpm(i,factor){
    const track=state.tracks?.[i];if(!track)return;const m=metaFor(track);
    const current=Number(m.bpm)||Number(m.autoBpm);if(!current)return;
    const next=current*factor;if(next<50||next>240)return;
    m.bpm=Math.round(next*10)/10;m.method='manual';scheduleSave();augmentMusicList();
  }

  function markOne(i){
    const track=state.tracks?.[i];if(!track)return;
    if(!player.src||player.src!==track.url){alert('Paina ensin tämän kappaleen “▶ Kuuntele” ja siirrä soitin oikeaan 1-laskuun.');return}
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
      const t=e.target.closest('[data-tap]');if(t){e.stopPropagation();tapBpm(Number(t.dataset.tap));return}
      const h=e.target.closest('[data-half]');if(h){e.stopPropagation();scaleBpm(Number(h.dataset.half),.5);return}
      const d=e.target.closest('[data-double]');if(d){e.stopPropagation();scaleBpm(Number(d.dataset.double),2);return}
      const m=e.target.closest('[data-markone]');if(m){e.stopPropagation();markOne(Number(m.dataset.markone));return}
      const j=e.target.closest('[data-jumpone]');if(j){e.stopPropagation();jumpOne(Number(j.dataset.jumpone));}
    });
    list.addEventListener('change',e=>{
      const input=e.target.closest('.analysis-bpm');if(!input)return;
      const track=state.tracks?.[Number(input.dataset.track)];if(!track)return;
      const value=Number(input.value);const m=metaFor(track);m.bpm=Number.isFinite(value)&&value>0?value:null;m.method='manual';scheduleSave();augmentMusicList();
    });
    const bpmInput=$q('#targetBpm');if(bpmInput)bpmInput.addEventListener('input',()=>setTimeout(augmentMusicList,0));
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
