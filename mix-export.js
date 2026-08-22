(()=>{
  const q=s=>document.querySelector(s);let exporting=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const db=v=>v>0?20*Math.log10(v):-Infinity;
  function ensure(){if(!state.audioTimeline)state.audioTimeline={clips:[],zoom:1,snap:'beat'};state.audioTimeline.clips=Array.isArray(state.audioTimeline.clips)?state.audioTimeline.clips:[];if(!state.mixSettings)state.mixSettings={autoDuck:true,duckDb:-7,duckAttack:.08,duckRelease:.18}}
  function trackFor(c){return(state.tracks||[]).find(t=>t.name===c.sourceName)}
  function safeName(){return(state.projectName||'cheer-mix').trim().replace(/[^a-z0-9åäö_-]+/gi,'-').replace(/^-+|-+$/g,'')||'cheer-mix'}
  function setStatus(text,pct=null){const el=q('#mixExportStatus');if(el)el.textContent=text;const bar=q('#mixExportProgress');if(bar&&pct!=null)bar.style.width=`${clamp(pct,0,100)}%`}
  function validate(){
    ensure();const check=window.cheerMixAssistant?.runChecks?.();if(check?.errors)return{ok:false,message:`Miksauksessa on ${check.errors} virhettä. Korjaa ne ennen vientiä.`};
    if(!state.audioTimeline.clips.length)return{ok:false,message:'Aikajanalla ei ole clippejä vietäväksi.'};
    const missing=state.audioTimeline.clips.filter(c=>!trackFor(c)?.url);if(missing.length)return{ok:false,message:`${missing.length} clipiltä puuttuu ladattu lähdeaudiotiedosto.`};
    if(!window.CheerOfflineRenderer)return{ok:false,message:'Lossless offline-renderöinti ei ole latautunut. Päivitä sivu.'};
    if(!window.CheerWav24)return{ok:false,message:'24-bit WAV -enkooderi ei ole latautunut. Päivitä sivu.'};
    return{ok:true,warns:check?.warns||0};
  }
  function analyzeBuffer(buffer){let peak=0,sum=0,count=0;const channels=Math.min(2,buffer.numberOfChannels);for(let c=0;c<channels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i++){const x=data[i],a=Math.abs(x);if(a>peak)peak=a;sum+=x*x;count++}}const rms=count?Math.sqrt(sum/count):0;return{peak,rms,peakDb:db(peak),rmsDb:db(rms)}}
  function downloadArrayBuffer(ab,name){const blob=new Blob([ab],{type:'audio/wav'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
  function progress(info){if(info.phase==='decode'){const pct=info.total?Math.round(info.done/info.total*45):5;setStatus(`Dekoodataan lossless-renderiä ${info.done}/${info.total}${info.name?` · ${info.name}`:''}…`,pct)}else if(info.phase==='render')setStatus(info.done?'Offline-render valmis, kirjoitetaan 24-bit PCM WAV…':'Renderöidään 48 kHz PCM offline…',info.done?90:55);else setStatus('Valmistellaan lossless-renderöintiä…',2)}
  async function exportWav(){
    if(exporting)return;const v=validate();if(!v.ok){alert(v.message);return}if(v.warns&&!confirm(`Mix-tarkistuksessa on ${v.warns} huomautusta. Haluatko silti tehdä WAV-viennin?`))return;
    exporting=true;const btn=q('#btnExportWav');if(btn)btn.disabled=true;window.cheerTimelineAudioEngine?.stop?.();q('#audioPlayer')?.pause();
    try{
      setStatus('Valmistellaan 48 kHz / 24-bit lossless-masteria…',1);
      const rendered=await window.CheerOfflineRenderer.renderProject(state,progress),stats=analyzeBuffer(rendered);
      if(stats.peak>1.000001){setStatus(`Vienti pysäytettiin: peak ${stats.peakDb.toFixed(1)} dBFS ylittää 0 dBFS. Laske tasoja ennen masteria.`,0);alert('Masterissa on clippingiä. Lossless WAV -vienti pysäytettiin, jotta ääntä ei leikata hiljaa 24-bittiseen tiedostoon. Laske clip-tasoja ja yritä uudelleen.');return}
      const wav=window.CheerWav24.fromAudioBuffer(rendered);downloadArrayBuffer(wav,`${safeName()}.wav`);
      setStatus(`Valmis: ${safeName()}.wav · 48 kHz · 24-bit PCM · stereo · peak ${stats.peakDb.toFixed(1)} dBFS · RMS ${stats.rmsDb.toFixed(1)} dBFS`,100);
    }catch(err){console.error(err);setStatus('Lossless WAV -vienti epäonnistui.',0);alert(`WAV-vienti epäonnistui: ${err?.message||err}`)}finally{exporting=false;if(btn)btn.disabled=false}
  }
  function addUi(){if(q('#mixExport'))return;const host=q('#mixAssistant')||q('#audioWorkspace');if(!host)return;const panel=document.createElement('section');panel.id='mixExport';panel.className='mix-export';panel.innerHTML=`<div class="mix-export-top"><div><h3>Lossless master</h3><p>OfflineAudioContext renderöi koko aikajanan suoraan 48 kHz stereoksi. WAV kirjoitetaan 24-bit PCM:nä ilman MediaRecorderia, Opusia, MP3:a tai muuta häviöllistä välivaihetta.</p></div><button id="btnExportWav" class="btn primary">⬇ Vie 24-bit WAV</button></div><div class="mix-export-progress-shell"><div id="mixExportProgress" class="mix-export-progress"></div></div><div id="mixExportStatus" class="mix-export-status">Valmis lossless-vientiin.</div>`;host.insertAdjacentElement('afterend',panel);q('#btnExportWav').addEventListener('click',exportWav)}
  const style=document.createElement('style');style.textContent=`.mix-export{margin-top:14px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.42)}.mix-export-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.mix-export h3{margin:0 0 4px}.mix-export p{margin:0;opacity:.75;max-width:820px}.mix-export-progress-shell{height:7px;margin-top:12px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.13)}.mix-export-progress{height:100%;width:0;background:linear-gradient(90deg,#7c3aed,#38bdf8);transition:width .2s}.mix-export-status{margin-top:7px;font-size:.9rem;opacity:.8}@media(max-width:800px){.mix-export-top{align-items:flex-start;flex-direction:column}}`;document.head.appendChild(style);
  function init(){ensure();addUi();window.cheerMixExport={exportWav,validate,analyzeBuffer}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();