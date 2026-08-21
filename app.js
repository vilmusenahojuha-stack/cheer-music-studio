const STORAGE_KEY='cheerMusicStudioProjectV1';
const parts=['Intro','Jumps','Tumbling','Stunt','Basket','Pyramid','Dance','Transition','Ending'];

const state={
  projectName:'Uusi cheer mix', teamName:'', duration:150, targetBpm:147,
  eights:[], tracks:[]
};
let activeCell=null;
let objectUrls=[];

const $=s=>document.querySelector(s);
const eightBody=$('#eightBody');
const beatRow=$('#beatRow');
const player=$('#audioPlayer');

function newEight(index){return {id:crypto.randomUUID?.()||String(Date.now()+Math.random()),part:index===0?'Intro':'Stunt',counts:Array.from({length:8},()=>({text:'',hit:false})),music:'',voiceover:'',fx:''}}
function ensureRows(){if(!state.eights.length){for(let i=0;i<8;i++) state.eights.push(newEight(i));}}
function escapeHtml(v=''){return v.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function render(){
  $('#projectName').value=state.projectName; $('#teamName').value=state.teamName; $('#duration').value=String(state.duration); $('#targetBpm').value=state.targetBpm;
  eightBody.innerHTML='';
  state.eights.forEach((e,row)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="sticky sticky-1 row-index">${row+1}</td><td class="sticky sticky-2 part-cell"><select class="part-select" data-row="${row}">${parts.map(p=>`<option ${p===e.part?'selected':''}>${p}</option>`).join('')}</select></td>${e.counts.map((c,col)=>`<td class="count-cell ${c.hit?'hit':''}" data-row="${row}" data-col="${col}">${escapeHtml(c.text)}</td>`).join('')}<td><input class="meta-input" data-field="music" data-row="${row}" value="${escapeHtml(e.music)}" placeholder="Kappale / kohta"></td><td><input class="meta-input" data-field="voiceover" data-row="${row}" value="${escapeHtml(e.voiceover)}" placeholder="Voiceover"></td><td><input class="meta-input" data-field="fx" data-row="${row}" value="${escapeHtml(e.fx)}" placeholder="FX"></td><td><button class="row-delete" data-delete="${row}" title="Poista kasi">×</button></td>`;
    eightBody.appendChild(tr);
  });
  $('#countSummary').textContent=`${state.eights.length} kasia`;
}
function markDirty(){ $('#saveStatus').textContent='Tallentamaton'; }
function save(){
  state.projectName=$('#projectName').value.trim()||'Uusi cheer mix'; state.teamName=$('#teamName').value.trim(); state.duration=Number($('#duration').value); state.targetBpm=Number($('#targetBpm').value)||147;
  const serial={...state,tracks:state.tracks.map(t=>({name:t.name,type:t.type,size:t.size,duration:t.duration||0}))};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(serial)); $('#saveStatus').textContent='Tallennettu';
}
function load(){
  try{const raw=localStorage.getItem(STORAGE_KEY); if(raw){const s=JSON.parse(raw); Object.assign(state,s); state.tracks=[];}}
  catch(e){console.warn('Tallennuksen lataus epäonnistui',e)} ensureRows(); render(); renderTracks();
}
function renderBeats(){beatRow.innerHTML=''; for(let i=1;i<=8;i++){const el=document.createElement('div');el.className='beat';el.textContent=i;beatRow.appendChild(el)}}
function openCell(row,col){activeCell={row,col}; const c=state.eights[row].counts[col]; $('#cellTitle').textContent=`Kasi ${row+1} / lasku ${col+1}`; $('#cellText').value=c.text; $('#cellHit').checked=c.hit; $('#cellDialog').showModal(); setTimeout(()=>$('#cellText').focus(),50)}
function renderTracks(){
  const list=$('#musicList');
  if(!state.tracks.length){list.className='music-list empty-state';list.textContent='Ei musiikkia lisätty. Audiotiedostot lisätään uudelleen sivun lataamisen jälkeen.';return}
  list.className='music-list'; list.innerHTML='';
  state.tracks.forEach((t,i)=>{const div=document.createElement('div');div.className='music-item'; const dur=t.duration?formatTime(t.duration):'analysoidaan…'; div.innerHTML=`<div><div class="music-title">${escapeHtml(t.name)}</div><div class="music-meta">${escapeHtml(t.type||'audio')} · ${dur} · ${formatBytes(t.size)}</div></div><div class="music-actions"><button class="mini-btn" data-playtrack="${i}">▶ Kuuntele</button><button class="mini-btn" data-removetrack="${i}">Poista</button></div>`;list.appendChild(div)})
}
function formatTime(sec){sec=Math.max(0,Math.floor(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
function formatBytes(n){if(!Number.isFinite(n))return '';if(n<1024*1024)return `${Math.round(n/1024)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
function addAudioFiles(files){
  [...files].forEach(file=>{if(!file.type.startsWith('audio/'))return; const url=URL.createObjectURL(file);objectUrls.push(url); const track={name:file.name,type:file.type,size:file.size,url,duration:0}; state.tracks.push(track); const a=new Audio();a.preload='metadata';a.src=url;a.addEventListener('loadedmetadata',()=>{track.duration=a.duration;renderTracks()},{once:true});}); renderTracks();markDirty();
}
function playTrack(index){const t=state.tracks[index];if(!t)return;player.src=t.url;player.play().catch(()=>{});$('#playerMeta').textContent=t.name}
function updateBeatIndicator(){
  const bpm=Number($('#targetBpm').value)||147; const secPerBeat=60/bpm; const beat=Math.floor(player.currentTime/secPerBeat)%8; const eight=Math.floor(player.currentTime/(secPerBeat*8))+1; $('#currentEight').textContent=eight; [...beatRow.children].forEach((el,i)=>el.classList.toggle('active',i===beat));
}

eightBody.addEventListener('click',e=>{const cell=e.target.closest('.count-cell');if(cell)openCell(Number(cell.dataset.row),Number(cell.dataset.col));const del=e.target.closest('[data-delete]');if(del){const r=Number(del.dataset.delete);if(confirm(`Poistetaanko kasi ${r+1}?`)){state.eights.splice(r,1);render();markDirty()}}});
eightBody.addEventListener('change',e=>{if(e.target.matches('.part-select')){state.eights[Number(e.target.dataset.row)].part=e.target.value;markDirty()} if(e.target.matches('.meta-input')){state.eights[Number(e.target.dataset.row)][e.target.dataset.field]=e.target.value;markDirty()}});
eightBody.addEventListener('input',e=>{if(e.target.matches('.meta-input')){state.eights[Number(e.target.dataset.row)][e.target.dataset.field]=e.target.value;markDirty()}});
$('#btnAddEight').addEventListener('click',()=>{state.eights.push(newEight(state.eights.length));render();markDirty();eightBody.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'})});
$('#btnReset').addEventListener('click',()=>{if(confirm('Tyhjennetäänkö koko 8-count-suunnitelma?')){state.eights=[];ensureRows();render();markDirty()}});
$('#cellSave').addEventListener('click',e=>{e.preventDefault();if(!activeCell)return;const c=state.eights[activeCell.row].counts[activeCell.col];c.text=$('#cellText').value.trim();c.hit=$('#cellHit').checked;$('#cellDialog').close();render();markDirty()});
$('#cellClear').addEventListener('click',e=>{e.preventDefault();if(!activeCell)return;state.eights[activeCell.row].counts[activeCell.col]={text:'',hit:false};$('#cellDialog').close();render();markDirty()});
$('#btnSave').addEventListener('click',save);
['projectName','teamName','duration','targetBpm'].forEach(id=>$('#'+id).addEventListener('input',markDirty));
$('#audioInput').addEventListener('change',e=>{addAudioFiles(e.target.files);e.target.value=''});
$('#musicList').addEventListener('click',e=>{const p=e.target.closest('[data-playtrack]');if(p)playTrack(Number(p.dataset.playtrack));const r=e.target.closest('[data-removetrack]');if(r){const i=Number(r.dataset.removetrack);const t=state.tracks[i];if(t?.url)URL.revokeObjectURL(t.url);state.tracks.splice(i,1);renderTracks();}});
$('#btnPlay').addEventListener('click',()=>{if(!player.src&&state.tracks.length)playTrack(0);else if(player.paused)player.play().catch(()=>{});else player.pause()});
player.addEventListener('timeupdate',updateBeatIndicator);player.addEventListener('play',()=>$('#btnPlay').textContent='⏸ Tauko');player.addEventListener('pause',()=>$('#btnPlay').textContent='▶ Toista');
window.addEventListener('beforeunload',()=>objectUrls.forEach(u=>URL.revokeObjectURL(u)));
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderBeats();load();
