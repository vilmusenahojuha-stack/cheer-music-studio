(()=>{
  const DB_NAME='cheerMusicStudioAudioV1';
  const STORE='files';
  let lastProjectId=null;
  let restoreToken=0;

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store=db.createObjectStore(STORE,{keyPath:'key'});
          store.createIndex('projectId','projectId',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('IndexedDB ei auennut'));
    });
  }

  function fileKey(projectId,file){
    return `${projectId}::${file.name}::${file.size}::${file.lastModified||0}`;
  }

  async function putFiles(projectId,files){
    if(!projectId||!files.length)return;
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      const store=tx.objectStore(STORE);
      files.forEach(file=>store.put({
        key:fileKey(projectId,file),
        projectId,
        name:file.name,
        type:file.type||'audio/*',
        size:file.size,
        lastModified:file.lastModified||0,
        blob:file,
        savedAt:Date.now()
      }));
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Audiotiedoston tallennus epäonnistui'));
      tx.onabort=()=>reject(tx.error||new Error('Audiotiedoston tallennus keskeytyi'));
    });
    db.close();
  }

  async function getProjectFiles(projectId){
    if(!projectId)return[];
    const db=await openDb();
    const rows=await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const idx=tx.objectStore(STORE).index('projectId');
      const req=idx.getAll(IDBKeyRange.only(projectId));
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error||new Error('Audiotiedostojen luku epäonnistui'));
    });
    db.close();
    return rows.sort((a,b)=>(a.savedAt||0)-(b.savedAt||0));
  }

  async function deleteStoredTrack(projectId,track){
    if(!projectId||!track)return;
    const db=await openDb();
    const rows=await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).index('projectId').getAll(IDBKeyRange.only(projectId));
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
    const matches=rows.filter(r=>r.name===track.name&&Number(r.size)===Number(track.size));
    if(matches.length){
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        const store=tx.objectStore(STORE);
        matches.forEach(r=>store.delete(r.key));
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
    }
    db.close();
  }

  function revokeCurrentTrackUrls(){
    (state?.tracks||[]).forEach(t=>{
      if(t?.url){
        try{URL.revokeObjectURL(t.url)}catch{}
        const i=objectUrls.indexOf(t.url);
        if(i>=0)objectUrls.splice(i,1);
      }
    });
  }

  async function restoreProjectAudio(force=false){
    if(!state?.id)return;
    const projectId=state.id;
    if(!force&&lastProjectId===projectId&&state.tracks?.length)return;
    const token=++restoreToken;
    const rows=await getProjectFiles(projectId).catch(e=>{console.warn('Musiikkien palautus epäonnistui',e);return[]});
    if(token!==restoreToken||state?.id!==projectId)return;

    revokeCurrentTrackUrls();
    state.tracks=[];
    for(const row of rows){
      const blob=row.blob;
      if(!(blob instanceof Blob))continue;
      const url=URL.createObjectURL(blob);
      objectUrls.push(url);
      const track={name:row.name,type:row.type,size:row.size,url,duration:0,persistent:true};
      state.tracks.push(track);
      const a=new Audio();
      a.preload='metadata';
      a.src=url;
      a.addEventListener('loadedmetadata',()=>{
        track.duration=Number.isFinite(a.duration)?a.duration:0;
        renderTracks();
      },{once:true});
    }
    lastProjectId=projectId;
    renderTracks();
    document.dispatchEvent(new CustomEvent('cheer-audio-restored',{detail:{projectId,count:state.tracks.length}}));
  }

  function showPersistNote(){
    const panel=document.querySelector('.music-panel .section-head p');
    if(panel)panel.textContent='Lisätyt audiotiedostot tallentuvat tämän tietokoneen selaimeen projektikohtaisesti ja palautuvat sivun päivityksen jälkeen.';
  }

  function init(){
    const input=document.querySelector('#audioInput');
    const list=document.querySelector('#musicList');
    if(!input||!list||typeof state==='undefined')return;
    showPersistNote();

    // Capture files before app.js clears the file input.
    input.addEventListener('change',e=>{
      const files=[...(e.target.files||[])].filter(f=>f.type.startsWith('audio/')||/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name));
      const projectId=state?.id;
      if(!files.length||!projectId)return;
      putFiles(projectId,files).then(()=>{
        (state.tracks||[]).forEach(t=>{if(files.some(f=>f.name===t.name&&f.size===t.size))t.persistent=true});
        renderTracks();
      }).catch(err=>{
        console.error(err);
        alert('Musiikin pysyvä tallennus epäonnistui. Selaimen tallennustila voi olla täynnä.');
      });
    },true);

    // Delete the stored blob when the user removes a track.
    list.addEventListener('click',e=>{
      const btn=e.target.closest('[data-removetrack]');
      if(!btn)return;
      const track=state.tracks?.[Number(btn.dataset.removetrack)];
      const projectId=state?.id;
      if(track&&projectId)deleteStoredTrack(projectId,track).catch(console.warn);
    },true);

    // Existing project/new project handlers run first; restore after they finish.
    document.querySelector('#btnNewProject')?.addEventListener('click',()=>setTimeout(()=>restoreProjectAudio(true),0));
    document.querySelector('#projectsList')?.addEventListener('click',e=>{
      if(e.target.closest('[data-openproject]'))setTimeout(()=>restoreProjectAudio(true),0);
    });

    document.addEventListener('cheer-audio-restored',()=>{
      if(typeof renderTracks==='function')renderTracks();
    });

    // Detect project changes made by any future code path as well.
    setInterval(()=>{
      if(state?.id&&state.id!==lastProjectId)restoreProjectAudio(true);
    },600);

    restoreProjectAudio(true);
  }

  window.cheerAudioStorage={restore:()=>restoreProjectAudio(true),getProjectFiles,deleteStoredTrack};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
