(()=>{
  const q=s=>document.querySelector(s);
  let session=null,observer=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const spb=()=>60/(Number(state.targetBpm)||147);
  const trackFor=c=>(state.tracks||[]).find(t=>t.name===c.sourceName);
  const rateFor=c=>window.cheerTimelineAudioEngine?.rateFor?.(c)||1;
  function stopPreview(){
    if(!session)return;
    cancelAnimationFrame(session.raf||0);
    clearTimeout(session.startB);clearTimeout(session.endTimer);
    for(const a of [session.a,session.b]){try{a.pause();a.removeAttribute('src');a.load()}catch{}}
    session=null;
    document.querySelectorAll('.im-ab-btn.playing').forEach(b=>b.classList.remove('playing'));
    const s=q('#imPreviewStatus');if(s)s.textContent='';
  }
  function makeAudio(c,startSource){
    const t=trackFor(c);if(!t?.url)return null;
    const a=new Audio();a.preload='auto';a.src=t.url;a.playsInline=true;
    try{a.preservesPitch=true;a.webkitPreservesPitch=true;a.mozPreservesPitch=true}catch{}
    a.playbackRate=rateFor(c);a.volume=clamp(Number.isFinite(Number(c.volume))?Number(c.volume):1,0,1);
    const seek=()=>{try{a.currentTime=Math.max(0,startSource)}catch{}};
    a.readyState>=1?seek():a.addEventListener('loadedmetadata',seek,{once:true});
    return a;
  }
  function audition(plan,overlap,button){
    stopPreview();
    if(!plan?.a||!plan?.b)return;
    const beat=spb(),pre=beat*4,post=beat*4,transition=Number(plan.transition)||Number(plan.b.start)||0;
    const from=Math.max(Number(plan.a.start)||0,transition-pre),lead=Math.max(0,transition-from);
    const aSource=(Number(plan.a.sourceOffset)||0)+(from-(Number(plan.a.start)||0))*rateFor(plan.a);
    const bSource=Number(plan.b.sourceOffset)||0;
    const a=makeAudio(plan.a,aSource),b=makeAudio(plan.b,bSource);if(!a||!b)return alert('Esikuunteluun tarvittavaa audiota ei löytynyt.');
    const baseA=clamp(Number.isFinite(Number(plan.a.volume))?Number(plan.a.volume):1,0,1),baseB=clamp(Number.isFinite(Number(plan.b.volume))?Number(plan.b.volume):1,0,1);
    const started=performance.now(),ov=Math.max(0,Number(overlap)||0);
    session={a,b,raf:0,startB:0,endTimer:0};button?.classList.add('playing');
    const status=q('#imPreviewStatus');if(status)status.textContent=`Esikuunnellaan ${ov.toFixed(2)} s päällekkäisyys…`;
    a.play().catch(()=>{});
    session.startB=setTimeout(()=>{if(!session)return;b.volume=ov>0?0:baseB;b.play().catch(()=>{})},lead*1000);
    const tick=()=>{
      if(!session)return;const elapsed=(performance.now()-started)/1000,after=elapsed-lead;
      if(after>=0){if(ov<=.005){a.volume=0;try{a.pause()}catch{};b.volume=baseB}else{const f=clamp(after/ov,0,1),ga=Math.cos(f*Math.PI*.5),gb=Math.sin(f*Math.PI*.5);a.volume=baseA*ga;b.volume=baseB*gb;if(f>=1){try{a.pause()}catch{}}}}
      session.raf=requestAnimationFrame(tick);
    };tick();
    session.endTimer=setTimeout(()=>{stopPreview();if(status)status.textContent='Esikuuntelu valmis. Valitse paras tai käytä suositusta.'},(lead+Math.max(ov,.05)+post)*1000);
  }
  function enhance(){
    const host=q('#intelligentMixResults'),plans=state.intelligentMix?._plans;if(!host||!Array.isArray(plans))return;
    host.querySelectorAll('.im-card').forEach((card,i)=>{
      if(card.querySelector('.im-ab-preview'))return;const p=plans[i];if(!p)return;
      const candidates=(p.overlapCandidates||[]).slice(0,3);if(!candidates.length)return;
      const wrap=document.createElement('div');wrap.className='im-ab-preview';
      wrap.innerHTML=`<span class="im-ab-label">A/B/C-esikuuntelu</span>${candidates.map((c,j)=>`<button type="button" class="mini-btn im-ab-btn${j===0?' recommended':''}" data-ab="${j}">${String.fromCharCode(65+j)} · ${Number(c.overlap).toFixed(2)} s${j===0?' ★':''}</button>`).join('')}`;
      wrap.querySelectorAll('[data-ab]').forEach(btn=>btn.addEventListener('click',()=>{const c=candidates[Number(btn.dataset.ab)];audition(p,c.overlap,btn)}));
      const actions=card.querySelector('.im-actions');actions?actions.before(wrap):card.appendChild(wrap);
    });
    if(host.querySelector('.im-ab-preview')&&!q('#imPreviewStatus')){const status=document.createElement('div');status.id='imPreviewStatus';status.className='im-preview-status';host.prepend(status)}
  }
  function init(){
    const style=document.createElement('style');style.textContent=`.im-ab-preview{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 0;padding:8px;border-radius:8px;background:rgba(30,41,59,.34)}.im-ab-label{font-size:12px;font-weight:700;opacity:.8;margin-right:2px}.im-ab-btn.recommended{font-weight:800}.im-ab-btn.playing{outline:2px solid currentColor;outline-offset:2px}.im-preview-status{min-height:18px;margin:5px 0;font-size:12px;opacity:.78}`;document.head.appendChild(style);
    const panel=q('#mixAssistant');if(!panel)return;observer=new MutationObserver(()=>enhance());observer.observe(panel,{childList:true,subtree:true});setTimeout(enhance,100);window.addEventListener('beforeunload',stopPreview);document.addEventListener('cheer-audio-restored',stopPreview);window.cheerSmartPreview={stop:stopPreview,audition};
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();