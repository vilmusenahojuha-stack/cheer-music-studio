let gridCursor={row:0,col:0};
let copiedCells=null;

function gridCell(row,col){return eightBody.querySelector(`.count-cell[data-row="${row}"][data-col="${col}"]`)}
function clampGridCursor(row,col){return{row:Math.max(0,Math.min(state.eights.length-1,row)),col:Math.max(0,Math.min(7,col))}}
function paintGridCursor(scroll=true){
  eightBody.querySelectorAll('.count-cell.grid-active').forEach(el=>el.classList.remove('grid-active'));
  const pos=clampGridCursor(gridCursor.row,gridCursor.col);gridCursor=pos;
  const cell=gridCell(pos.row,pos.col);if(!cell)return;
  cell.classList.add('grid-active');cell.setAttribute('tabindex','0');
  if(scroll)cell.scrollIntoView({block:'nearest',inline:'nearest'});
}
function setGridCursor(row,col,scroll=true){gridCursor=clampGridCursor(row,col);paintGridCursor(scroll)}
function dialogOpen(){return $('#cellDialog')?.open||$('#projectsDialog')?.open}
function isTextControl(el){return el&&(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.isContentEditable)}
function editGridCell(initialText=null){
  const {row,col}=gridCursor;openCell(row,col);
  if(initialText!==null){$('#cellText').value=initialText;setTimeout(()=>{$('#cellText').setSelectionRange?.(initialText.length,initialText.length)},0)}
}
function clearGridCell(){
  const c=state.eights[gridCursor.row]?.counts?.[gridCursor.col];if(!c||(c.text===''&&!c.hit))return;
  snapshot();state.eights[gridCursor.row].counts[gridCursor.col]={text:'',hit:false};renderTable();scheduleSave();paintGridCursor(false);
}
function toggleGridHit(){
  const c=state.eights[gridCursor.row]?.counts?.[gridCursor.col];if(!c)return;
  snapshot();c.hit=!c.hit;renderTable();scheduleSave();paintGridCursor(false);
}
function matrixFromClipboard(text){return String(text).replace(/\r/g,'').split('\n').filter((line,i,a)=>!(i===a.length-1&&line==='')).map(line=>line.split('\t'))}
function pasteMatrix(matrix){
  if(!matrix.length)return;
  snapshot();let changed=false;
  matrix.forEach((line,dr)=>line.forEach((value,dc)=>{const r=gridCursor.row+dr,c=gridCursor.col+dc;if(r<state.eights.length&&c<8){state.eights[r].counts[c].text=value.trim();changed=true}}));
  if(changed){renderTable();scheduleSave();paintGridCursor(false)}
}
async function copyCurrentCell(){
  const c=state.eights[gridCursor.row]?.counts?.[gridCursor.col];if(!c)return;
  copiedCells=[[c.text||'']];
  try{await navigator.clipboard.writeText(c.text||'')}catch{}
  flashGridMessage('Solu kopioitu');
}
async function pasteClipboard(){
  let text='';try{text=await navigator.clipboard.readText()}catch{}
  if(text){pasteMatrix(matrixFromClipboard(text));return}
  if(copiedCells)pasteMatrix(copiedCells);
}
function flashGridMessage(text){
  const info=$('#selectionInfo');if(!info)return;const old=info.textContent;info.textContent=text;setTimeout(()=>{if(info.textContent===text)updateSelectionToolbar()},900)
}

// Estetään vanha yhden klikkauksen muokkaus vain 1–8-soluissa. Yksi klikkaus valitsee, tuplaklikkaus muokkaa.
eightBody.addEventListener('click',e=>{
  const cell=e.target.closest('.count-cell');if(!cell)return;
  e.stopImmediatePropagation();setGridCursor(Number(cell.dataset.row),Number(cell.dataset.col));
},true);
eightBody.addEventListener('dblclick',e=>{
  const cell=e.target.closest('.count-cell');if(!cell)return;
  e.preventDefault();e.stopPropagation();setGridCursor(Number(cell.dataset.row),Number(cell.dataset.col));editGridCell();
},true);

// Kun taulukko renderöidään uudelleen, pidetään aktiivinen solu näkyvänä.
const gridObserver=new MutationObserver(()=>requestAnimationFrame(()=>paintGridCursor(false)));
gridObserver.observe(eightBody,{childList:true});

// Excel-tyylinen näppäimistöohjaus.
document.addEventListener('keydown',async e=>{
  if(dialogOpen())return;
  const target=e.target;
  if(isTextControl(target)&&!target.closest('.count-cell'))return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(ctrl&&e.key.toLowerCase()==='c'){e.preventDefault();await copyCurrentCell();return}
  if(ctrl&&e.key.toLowerCase()==='v'){e.preventDefault();await pasteClipboard();return}
  if(ctrl)return;
  const k=e.key;
  if(k==='ArrowLeft'){e.preventDefault();setGridCursor(gridCursor.row,gridCursor.col-1);return}
  if(k==='ArrowRight'){e.preventDefault();setGridCursor(gridCursor.row,gridCursor.col+1);return}
  if(k==='ArrowUp'){e.preventDefault();setGridCursor(gridCursor.row-1,gridCursor.col);return}
  if(k==='ArrowDown'){e.preventDefault();setGridCursor(gridCursor.row+1,gridCursor.col);return}
  if(k==='Tab'){e.preventDefault();let r=gridCursor.row,c=gridCursor.col+(e.shiftKey?-1:1);if(c>7){c=0;r++}if(c<0){c=7;r--}setGridCursor(r,c);return}
  if(k==='Enter'||k==='F2'){e.preventDefault();editGridCell();return}
  if(k==='Delete'||k==='Backspace'){e.preventDefault();clearGridCell();return}
  if(k.toLowerCase()==='h'){e.preventDefault();toggleGridHit();return}
  if(k.length===1&&!e.altKey){e.preventDefault();editGridCell(k);return}
});

$('#cellDialog').addEventListener('close',()=>requestAnimationFrame(()=>paintGridCursor(false)));
requestAnimationFrame(()=>paintGridCursor(false));
