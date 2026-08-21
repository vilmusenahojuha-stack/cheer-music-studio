(()=>{
const q=s=>document.querySelector(s);let row=0;let syncing=false;
function ensure(){state.eightMusicAssignments=state.eightMusicAssignments||{};state.audioTimeline=state.audioTimeline||{clips:[],zoom:1,snap:'beat'};state.audioTimeline.clips=state.audioTimeline.clips||[]}
function spe(){return 8*60/(Number(state.targetBpm)||147)}
function rowsFor(a){
  let s=-1,e=-1;
  if(a.startEightId)s=state.eights.findIndex(x=>x.id===a.startEightId);
  if(a.endEightId)e=state.eights.findIndex(x=>x.id===a.endEightId);
  if(s<0)s=Math.max(0,Math.min(state.eights.length-1,Number(a.startRow)||0));
  if(e<0)e=Math.max(s,Math.min(state.eights.length-1,Number(a.endRow)||s));
  if(e<s)[s,e]=[e,s];
  return [s,e];
}
function migrate(a){
  const [s,e]=rowsFor(a);a.startRow=s;a.endRow=e;
  a.startEightId=state.eights[s]?.id||a.startEightId||null;
  a.endEightId=state.eights[e]?.id||a.endEightId||null;
  if(a.followOne==null)a.followOne=true;
  return [s,e];
}
function find(r){ensure();return Object.values(state.eightMusicAssignments).find(a=>{const [s,e]=rowsFor(a);return r>=s&&r<=e})}
function clipFor(a){return state.audioTimeline.clips.find(c=>c.assignmentId===a.id)}
function syncAssignments({save=false}={}){
  if(syncing||!state?.eights?.length)return;syncing=true;
  try{
    ensure();
    const valid=new Set();
    for(const a of Object.values(state.eightMusicAssignments)){
      const [s,e]=migrate(a);valid.add(a.id);
      const analysis=state.trackAnalysis?.[a.trackName];
      if(a.followOne!==false&&Number.isFinite(Number(analysis?.oneOffset)))a.sourceOffset=Math.max(0,Number(analysis.oneOffset));
      a.sourceOffset=Math.max(0,Number(a.sourceOffset)||0);
      for(let i=s;i<=e;i++)state.eights[i].music=a.trackName;
      let c=clipFor(a);
      if(!c){c={id:uid(),assignmentId:a.id,type:'music',sourceName:a.trackName,name:a.trackName};state.audioTimeline.clips.push(c)}
      c.type='music';c.sourceName=a.trackName;c.name=a.trackName;c.start=s*spe();c.duration=(e-s+1)*spe();c.sourceOffset=a.sourceOffset;
      if(!Number.isFinite(Number(c.volume)))c.volume=1;
      c.fadeIn=Math.max(0,Math.min(c.duration,Number(c.fadeIn)||0));c.fadeOut=Math.max(0,Math.min(c.duration,Number(c.fadeOut)||0));
    }
    state.audioTimeline.clips=state.audioTimeline.clips.filter(c=>!c.assignmentId||valid.has(c.assignmentId));
    if(save)scheduleSave();
  }finally{syncing=false}
  window.cheerAudioEditor?.renderTimeline?.();
}
function dialog(){if(q('#musicEightDlg'))return;const d=document.createElement('dialog');d.id='musicEightDlg';d.innerHTML=`<form method="dialog" style="min-width:560px;padding:20px;background:#0d1728;color:#fff"><h2>Lisää musiikki kaseihin</h2><p>Valitse kappale ja kasiväli. Aikajanan clippi tehdään automaattisesti ja seuraa kasien paikkaa sekä tavoite-BPM:ää.</p><div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px"><label>Kappale<select id="meTrack"></select></label><label>Alkukasi<input id="meStart" type="number" min="1"></label><label>Loppukasi<input id="meEnd" type="number" min="1"></label></div><p id="meInfo"></p><menu style="display:flex;gap:8px;justify-content:flex-end"><button value="cancel" class="btn secondary">Peruuta</button><button type="button" id="meRemove" class="btn secondary">Poista</button><button type="button" id="meApply" class="btn primary">Lisää kaseihin</button></menu></form>`;document.body.appendChild(d);q('#meApply').onclick=apply;q('#meRemove').onclick=remove;q('#meTrack').onchange=info;q('#meStart').oninput=info;q('#meEnd').oninput=info}
function fill(name=''){const s=q('#meTrack');s.innerHTML='<option value="">Valitse musiikki…</option>';for(const t of(state.tracks||[])){const o=document.createElement('option');o.value=t.name;o.textContent=t.name;s.appendChild(o)}if(name)s.value=name}
function info(){const s=Number(q('#meStart').value)||1,e=Math.max(s,Number(q('#meEnd').value)||s),n=e-s+1,name=q('#meTrack').value,a=state.trackAnalysis?.[name];q('#meInfo').textContent=`${n} kasia · ${(n*spe()).toFixed(2)} s${a?.bpm?` · ${Number(a.bpm).toFixed(1)} → ${state.targetBpm} BPM`:''}`}
function open(r){ensure();syncAssignments();dialog();row=r;const a=find(r);fill(a?.trackName);const [s,e]=a?rowsFor(a):[r,r];q('#meStart').max=q('#meEnd').max=state.eights.length;q('#meStart').value=s+1;q('#meEnd').value=e+1;q('#meRemove').disabled=!a;info();q('#musicEightDlg').showModal()}
function drop(a){if(!a)return;const [s,e]=rowsFor(a);delete state.eightMusicAssignments[a.id];state.audioTimeline.clips=state.audioTimeline.clips.filter(c=>c.assignmentId!==a.id);for(let i=s;i<=e&&i<state.eights.length;i++)if(state.eights[i].music===a.trackName)state.eights[i].music=''}
function apply(){ensure();const name=q('#meTrack').value;if(!name)return alert('Valitse kappale.');let s=Math.max(0,(Number(q('#meStart').value)||1)-1),e=Math.max(s,(Number(q('#meEnd').value)||s+1)-1);s=Math.min(s,state.eights.length-1);e=Math.min(e,state.eights.length-1);snapshot();Object.values(state.eightMusicAssignments).filter(a=>{const [as,ae]=rowsFor(a);return!(ae<s||as>e)}).forEach(drop);const id=uid(),an=state.trackAnalysis?.[name],offset=Math.max(0,Number(an?.oneOffset)||0);state.eightMusicAssignments[id]={id,trackName:name,startRow:s,endRow:e,startEightId:state.eights[s]?.id,endEightId:state.eights[e]?.id,sourceOffset:offset,followOne:true};for(let i=s;i<=e;i++)state.eights[i].music=name;syncAssignments();q('#musicEightDlg').close();renderAll();scheduleSave()}
function remove(){const a=find(row);if(!a)return;snapshot();drop(a);q('#musicEightDlg').close();renderAll();scheduleSave()}
function enhance(){ensure();syncAssignments();document.querySelectorAll('#eightBody tr').forEach((tr,r)=>{const input=tr.querySelector('.meta-input[data-field="music"]');if(!input)return;const a=find(r),td=input.closest('td'),b=document.createElement('button');b.type='button';b.dataset.musiceight=r;b.className='mini-btn';b.style.width='100%';b.style.textAlign='left';if(a){const [s,e]=rowsFor(a);b.innerHTML=`🎵 ${a.trackName}<br><small>kasit ${s+1}–${e+1}</small>`}else b.textContent='+ Valitse musiikki';td.innerHTML='';td.appendChild(b)})}
function init(){dialog();syncAssignments();enhance();const old=renderTable;renderTable=function(){syncAssignments();old();enhance()};q('#eightBody')?.addEventListener('click',e=>{const b=e.target.closest('[data-musiceight]');if(b){e.preventDefault();e.stopPropagation();open(Number(b.dataset.musiceight))}});q('#targetBpm')?.addEventListener('input',()=>setTimeout(()=>syncAssignments({save:true}),0));document.addEventListener('cheer-audio-restored',()=>{syncAssignments();enhance()});q('#musicList')?.addEventListener('click',e=>{if(e.target.closest('[data-markone]'))setTimeout(()=>syncAssignments({save:true}),30)});window.addEventListener('cheer-track-analysis-changed',()=>syncAssignments({save:true}));window.cheerEightMusic={sync:syncAssignments,find,rowsFor}}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
