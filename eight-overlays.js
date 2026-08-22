(()=>{
  const q=s=>document.querySelector(s);
  let active={type:'voice',row:0};
  let syncing=false;

  function ensure(){
    state.eightOverlayAssignments=state.eightOverlayAssignments||{};
    state.audioTimeline=state.audioTimeline||{clips:[],zoom:1,snap:'beat'};
    state.audioTimeline.clips=Array.isArray(state.audioTimeline.clips)?state.audioTimeline.clips:[];
  }
  function spb(){return 60/(Number(state.targetBpm)||147)}
  function startSec(a){
    let row=state.eights.findIndex(e=>e.id===a.eightId);
    if(row<0)row=Math.max(0,Math.min(state.eights.length-1,Number(a.row)||0));
    const count=Math.max(1,Math.min(8,Number(a.count)||1));
    return row*8*spb()+(count-1)*spb();
  }
  function find(type,row){
    ensure();
    const id=state.eights[row]?.id;
    return Object.values(state.eightOverlayAssignments).find(a=>a.type===type&&(a.eightId===id||Number(a.row)===row))||null;
  }
  function clipFor(a){return state.audioTimeline.clips.find(c=>c.overlayAssignmentId===a.id)}
  function trackFor(name){return (state.tracks||[]).find(t=>t.name===name)}
  function sync({save=false}={}){
    if(syncing||!state?.eights?.length)return;
    syncing=true;
    try{
      ensure();
      const valid=new Set();
      for(const a of Object.values(state.eightOverlayAssignments)){
        if(!['voice','fx'].includes(a.type))continue;
        let row=state.eights.findIndex(e=>e.id===a.eightId);
        if(row<0)row=Math.max(0,Math.min(state.eights.length-1,Number(a.row)||0));
        a.row=row;a.eightId=state.eights[row]?.id||a.eightId;a.count=Math.max(1,Math.min(8,Number(a.count)||1));
        a.sourceOffset=Math.max(0,Number(a.sourceOffset)||0);
        const t=trackFor(a.trackName);
        const maxDur=Number.isFinite(t?.duration)&&t.duration>0?Math.max(.05,t.duration-a.sourceOffset):30;
        a.duration=Math.max(.05,Math.min(maxDur,Number(a.duration)||Math.min(maxDur,a.type==='fx'?1.2:3)));
        valid.add(a.id);
        const field=a.type==='voice'?'voiceover':'fx';
        state.eights[row][field]=a.trackName;
        let c=clipFor(a);
        if(!c){
          c={id:uid(),overlayAssignmentId:a.id,type:a.type,sourceName:a.trackName,name:a.trackName};
          state.audioTimeline.clips.push(c);
        }
        c.type=a.type;c.sourceName=a.trackName;c.name=a.trackName;c.start=startSec(a);c.duration=a.duration;c.sourceOffset=a.sourceOffset;
        if(!Number.isFinite(Number(c.volume)))c.volume=1;
        c.fadeIn=Math.max(0,Math.min(c.duration,Number(c.fadeIn)||0));
        c.fadeOut=Math.max(0,Math.min(c.duration,Number(c.fadeOut)||0));
      }
      state.audioTimeline.clips=state.audioTimeline.clips.filter(c=>!c.overlayAssignmentId||valid.has(c.overlayAssignmentId));
      if(save)scheduleSave();
    }finally{syncing=false}
    window.cheerAudioEditor?.renderTimeline?.();
  }

  function makeDialog(){
    if(q('#overlayEightDlg'))return;
    const d=document.createElement('dialog');d.id='overlayEightDlg';
    d.innerHTML=`<form method="dialog" style="min-width:600px;padding:20px;background:#0d1728;color:#fff">
      <h2 id="oeTitle">Lisää voiceover</h2>
      <p>Valitse audiotiedosto ja tarkka kasi/lasku. Clippi syntyy aikajanalle automaattisesti ja seuraa tavoite-BPM:ää.</p>
      <div style="display:grid;grid-template-columns:2fr .8fr .8fr 1fr;gap:10px">
        <label>Ääni<select id="oeTrack"></select></label>
        <label>Kasi<input id="oeRow" type="number" min="1"></label>
        <label>Lasku<select id="oeCount">${Array.from({length:8},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
        <label>Kesto<input id="oeDuration" type="number" min="0.05" max="30" step="0.05" value="1.5"> s</label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <label>Lähteen alku<input id="oeOffset" type="number" min="0" step="0.01" value="0"> s</label>
        <div id="oeInfo" style="align-self:end;opacity:.8"></div>
      </div>
      <menu style="display:flex;gap:8px;justify-content:flex-end">
        <button value="cancel" class="btn secondary">Peruuta</button>
        <button type="button" id="oeRemove" class="btn secondary">Poista</button>
        <button type="button" id="oeApply" class="btn primary">Lisää aikajanalle</button>
      </menu>
    </form>`;
    document.body.appendChild(d);
    q('#oeApply').onclick=apply;q('#oeRemove').onclick=remove;
    ['oeTrack','oeRow','oeCount','oeDuration','oeOffset'].forEach(id=>q('#'+id).addEventListener('input',info));
  }
  function fillTracks(name=''){
    const s=q('#oeTrack');s.innerHTML='<option value="">Valitse audiotiedosto…</option>';
    for(const t of state.tracks||[]){const o=document.createElement('option');o.value=t.name;o.textContent=t.name;s.appendChild(o)}
    if(name)s.value=name;
  }
  function info(){
    const row=Math.max(1,Math.min(state.eights.length,Number(q('#oeRow').value)||1));
    const count=Math.max(1,Math.min(8,Number(q('#oeCount').value)||1));
    const sec=(row-1)*8*spb()+(count-1)*spb();
    q('#oeInfo').textContent=`Alkaa kohdasta ${sec.toFixed(2)} s · kasi ${row}, lasku ${count}`;
  }
  function open(type,row){
    ensure();sync();makeDialog();active={type,row};
    const a=find(type,row);q('#oeTitle').textContent=type==='voice'?'Lisää voiceover kasiin':'Lisää FX kasiin';
    fillTracks(a?.trackName||'');q('#oeRow').max=state.eights.length;q('#oeRow').value=(a?.row??row)+1;q('#oeCount').value=String(a?.count||1);
    const t=trackFor(a?.trackName);q('#oeDuration').value=String(a?.duration||Math.min(Number(t?.duration)|| (type==='fx'?1.2:3),type==='fx'?1.2:3));
    q('#oeOffset').value=String(a?.sourceOffset||0);q('#oeRemove').disabled=!a;info();q('#overlayEightDlg').showModal();
  }
  function drop(a){
    if(!a)return;delete state.eightOverlayAssignments[a.id];state.audioTimeline.clips=state.audioTimeline.clips.filter(c=>c.overlayAssignmentId!==a.id);
    const row=state.eights.findIndex(e=>e.id===a.eightId);if(row>=0){const field=a.type==='voice'?'voiceover':'fx';if(state.eights[row][field]===a.trackName)state.eights[row][field]=''}
  }
  function apply(){
    ensure();const name=q('#oeTrack').value;if(!name)return alert('Valitse audiotiedosto.');
    const type=active.type;let row=Math.max(0,(Number(q('#oeRow').value)||1)-1);row=Math.min(row,state.eights.length-1);
    const count=Math.max(1,Math.min(8,Number(q('#oeCount').value)||1));const offset=Math.max(0,Number(q('#oeOffset').value)||0);
    const t=trackFor(name);const maxDur=Number.isFinite(t?.duration)&&t.duration>0?Math.max(.05,t.duration-offset):30;
    const duration=Math.max(.05,Math.min(maxDur,Number(q('#oeDuration').value)||Math.min(maxDur,type==='fx'?1.2:3)));
    snapshot();const old=find(type,row);if(old)drop(old);
    const id=uid();state.eightOverlayAssignments[id]={id,type,trackName:name,row,eightId:state.eights[row]?.id,count,duration,sourceOffset:offset};
    const field=type==='voice'?'voiceover':'fx';state.eights[row][field]=name;sync();q('#overlayEightDlg').close();renderAll();scheduleSave();
  }
  function remove(){const a=find(active.type,active.row);if(!a)return;snapshot();drop(a);q('#overlayEightDlg').close();renderAll();scheduleSave()}
  function enhance(){
    ensure();sync();
    document.querySelectorAll('#eightBody tr').forEach((tr,row)=>{
      for(const cfg of [{type:'voice',field:'voiceover',icon:'🎙',empty:'+ Voiceover'},{type:'fx',field:'fx',icon:'⚡',empty:'+ FX'}]){
        const input=tr.querySelector(`.meta-input[data-field="${cfg.field}"]`);if(!input)continue;
        const td=input.closest('td'),a=find(cfg.type,row),b=document.createElement('button');b.type='button';b.className='mini-btn';b.dataset.overlaytype=cfg.type;b.dataset.overlayrow=row;b.style.width='100%';b.style.textAlign='left';
        b.innerHTML=a?`${cfg.icon} ${escapeHtml(a.trackName)}<br><small>lasku ${a.count}</small>`:cfg.empty;td.innerHTML='';td.appendChild(b);
      }
    });
  }
  function init(){
    makeDialog();sync();enhance();
    const old=renderTable;renderTable=function(){sync();old();enhance()};
    q('#eightBody')?.addEventListener('click',e=>{const b=e.target.closest('[data-overlaytype]');if(!b)return;e.preventDefault();e.stopPropagation();open(b.dataset.overlaytype,Number(b.dataset.overlayrow))});
    q('#targetBpm')?.addEventListener('input',()=>setTimeout(()=>sync({save:true}),0));
    document.addEventListener('cheer-audio-restored',()=>{sync();enhance()});
    window.cheerEightOverlays={sync,find};
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
