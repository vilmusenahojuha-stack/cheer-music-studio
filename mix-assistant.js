(()=>{
  const q=s=>document.querySelector(s);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const fmt=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;

  function ensure(){
    if(!state.audioTimeline) state.audioTimeline={clips:[],zoom:1,snap:'beat'};
    state.audioTimeline.clips=Array.isArray(state.audioTimeline.clips)?state.audioTimeline.clips:[];
  }
  function projectLength(){return Number(state.duration)||150}
  function rateFor(c){return window.cheerTimelineAudioEngine?.rateFor?.(c)||1}
  function analysisFor(name){return state.trackAnalysis?.[name]||{}}
  function musicClips(){return state.audioTimeline.clips.filter(c=>c.type==='music').sort((a,b)=>Number(a.start)-Number(b.start))}

  function runChecks(){
    ensure();
    const issues=[];
    const clips=state.audioTimeline.clips;
    const tracks=state.tracks||[];
    const trackNames=new Set(tracks.map(t=>t.name));
    const music=musicClips();

    if(!tracks.length) issues.push({level:'error',text:'Audiokirjasto on tyhjä.'});
    if(!music.length) issues.push({level:'error',text:'Aikajanalla ei ole yhtään musiikkiclippiä.'});

    for(const c of clips){
      if(!trackNames.has(c.sourceName)) issues.push({level:'error',text:`Clipiltä puuttuu lähdetiedosto: ${c.sourceName||'nimetön'}.`});
      if(!Number.isFinite(Number(c.start))||Number(c.start)<0) issues.push({level:'error',text:`Clipin ${c.sourceName||'nimetön'} aloitusaika on virheellinen.`});
      if(!Number.isFinite(Number(c.duration))||Number(c.duration)<=0) issues.push({level:'error',text:`Clipin ${c.sourceName||'nimetön'} kesto on virheellinen.`});
      if(Number(c.start)+Number(c.duration)>projectLength()+0.05) issues.push({level:'warn',text:`${c.sourceName} jatkuu projektin (${fmt(projectLength())}) yli.`});
      const vol=Number.isFinite(Number(c.volume))?Number(c.volume):1;
      if(vol>1) issues.push({level:'warn',text:`${c.sourceName}: voimakkuus ylittää 100 %.`});
      if((Number(c.fadeIn)||0)+(Number(c.fadeOut)||0)>Number(c.duration)+0.01) issues.push({level:'warn',text:`${c.sourceName}: fadejen yhteiskesto on clipin kestoa pidempi.`});
      if(c.type==='music'){
        const a=analysisFor(c.sourceName);
        const bpm=Number(a.bpm||a.autoBpm);
        if(!Number.isFinite(bpm)||bpm<=0) issues.push({level:'warn',text:`${c.sourceName}: BPM puuttuu, joten tempoa ei voida sovittaa luotettavasti.`});
        if(a.oneOffset==null) issues.push({level:'warn',text:`${c.sourceName}: 1-laskua ei ole asetettu.`});
        const r=rateFor(c);
        if(r<=0.55||r>=1.8) issues.push({level:'warn',text:`${c.sourceName}: temposovitus ${r.toFixed(2)}× on hyvin suuri ja kannattaa kuunnella tarkasti.`});
      }
    }

    for(let i=0;i<music.length-1;i++){
      const a=music[i],b=music[i+1];
      const end=Number(a.start)+Number(a.duration),gap=Number(b.start)-end;
      if(gap>0.08) issues.push({level:'warn',text:`Musiikkiin jää ${gap.toFixed(2)} s tyhjä kohta ennen kappaletta ${b.sourceName}.`});
      if(gap<-1.2) issues.push({level:'warn',text:`Musiikkiclipit ${a.sourceName} ja ${b.sourceName} ovat päällekkäin ${Math.abs(gap).toFixed(2)} s.`});
      if(gap<=0&&gap>-1.2){
        const overlap=Math.abs(gap);
        if(overlap>.06&&((Number(a.fadeOut)||0)<overlap*.5||(Number(b.fadeIn)||0)<overlap*.5)) issues.push({level:'info',text:`Siirtymä ${a.sourceName} → ${b.sourceName}: päällekkäisyys on olemassa, mutta crossfadea voi vielä pehmentää.`});
      }
    }

    const errors=issues.filter(x=>x.level==='error').length;
    const warns=issues.filter(x=>x.level==='warn').length;
    return {issues,errors,warns,ok:errors===0&&warns===0};
  }

  function autoImprove(){
    ensure();
    const music=musicClips();
    if(music.length<2){alert('Automaattinen siirtymien parannus tarvitsee vähintään kaksi musiikkiclippiä.');return}
    if(typeof snapshot==='function')snapshot();
    let changed=0;
    const beat=60/(Number(state.targetBpm)||147);
    const wanted=clamp(beat*.75,.18,.45);
    for(let i=0;i<music.length-1;i++){
      const a=music[i],b=music[i+1];
      const gap=Number(b.start)-(Number(a.start)+Number(a.duration));
      if(gap>0.02&&gap<=wanted+.25){
        a.duration+=gap+wanted;
        a.fadeOut=wanted;b.fadeIn=wanted;changed++;
      }else if(gap<=0&&gap>=-1.2){
        const overlap=Math.abs(gap);
        const fade=clamp(overlap||wanted,.12,.6);
        a.fadeOut=Math.max(Number(a.fadeOut)||0,fade);
        b.fadeIn=Math.max(Number(b.fadeIn)||0,fade);changed++;
      }
    }
    if(changed){scheduleSave();window.cheerAudioEditor?.renderTimeline?.();window.cheerTimelineAudioEngine?.refreshInspector?.()}
    renderReport(runChecks());
  }

  function renderReport(result){
    const host=q('#mixAssistantReport');if(!host)return;
    const badge=result.errors?`⛔ ${result.errors} virhettä`:result.warns?`⚠ ${result.warns} huomautusta`:'✅ Valmis tarkistukseen';
    host.innerHTML=`<div class="mix-report-head"><strong>${badge}</strong><span>${state.audioTimeline.clips.length} clippiä · ${musicClips().length} musiikkiclippiä</span></div>${result.issues.length?`<div class="mix-issues">${result.issues.map(x=>`<div class="mix-issue ${x.level}">${x.level==='error'?'⛔':x.level==='warn'?'⚠':'ℹ'} ${escapeHtml(x.text)}</div>`).join('')}</div>`:'<div class="mix-ok">Perusrakenne, lähdetiedostot, BPM/1-laskut ja musiikkisiirtymät ovat kunnossa.</div>'}`;
  }

  function addUi(){
    if(q('#mixAssistant'))return;
    const workspace=q('#audioWorkspace');if(!workspace)return;
    const panel=document.createElement('section');panel.id='mixAssistant';panel.className='mix-assistant';
    panel.innerHTML=`<div class="mix-assistant-top"><div><h3>Mix-tarkistus</h3><p>Tarkistaa miksauksen ennen vientiä: puuttuvat audiot, BPM/1-laskut, aikajanan aukot, päällekkäisyydet ja fade-riskit.</p></div><div class="mix-assistant-actions"><button id="btnMixCheck" class="mini-btn">✓ Tarkista miksaus</button><button id="btnMixImprove" class="mini-btn">✨ Paranna siirtymät</button></div></div><div id="mixAssistantReport" class="mix-assistant-report"></div>`;
    workspace.appendChild(panel);
    q('#btnMixCheck').addEventListener('click',()=>renderReport(runChecks()));
    q('#btnMixImprove').addEventListener('click',autoImprove);
    renderReport(runChecks());
  }

  const style=document.createElement('style');
  style.textContent=`.mix-assistant{margin-top:16px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.42)}.mix-assistant-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.mix-assistant h3{margin:0 0 4px}.mix-assistant p{margin:0;opacity:.75}.mix-assistant-actions{display:flex;gap:8px;flex-wrap:wrap}.mix-assistant-report{margin-top:12px}.mix-report-head{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border-radius:9px;background:rgba(30,41,59,.65)}.mix-issues{display:grid;gap:6px;margin-top:8px}.mix-issue{padding:8px 10px;border-radius:8px;background:rgba(30,41,59,.45)}.mix-issue.error{border-left:3px solid #ef4444}.mix-issue.warn{border-left:3px solid #f59e0b}.mix-issue.info{border-left:3px solid #38bdf8}.mix-ok{padding:10px;margin-top:8px;border-radius:8px;background:rgba(16,185,129,.10)}@media(max-width:800px){.mix-assistant-top,.mix-report-head{align-items:flex-start;flex-direction:column}}`;
  document.head.appendChild(style);

  function init(){ensure();addUi();document.addEventListener('cheer-audio-restored',()=>setTimeout(()=>renderReport(runChecks()),50));window.cheerMixAssistant={runChecks,renderReport,autoImprove}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();