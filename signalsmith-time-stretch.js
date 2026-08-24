((root,factory)=>{const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerHighQualityStretch=api})(typeof globalThis!=='undefined'?globalThis:this,root=>{
  const CDN='https://cdn.jsdelivr.net/npm/signalsmith-stretch@1.3.2/SignalsmithStretch.js';
  const VERSION='1.3.2';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  let libraryPromise=null,lastEngine='none',lastError=null;

  function base(){return root.CheerTimeStretch||null}
  function offlineCtor(){return root.OfflineAudioContext||root.webkitOfflineAudioContext||null}
  function libraryReady(){return typeof root.SignalsmithStretch==='function'}
  function platformReady(){const Offline=offlineCtor();if(!Offline)return false;try{return !!Offline.prototype?.startRendering}catch{return true}}

  function loadLibrary(){
    if(libraryReady())return Promise.resolve(root.SignalsmithStretch);
    if(libraryPromise)return libraryPromise;
    if(!root.document?.createElement) return Promise.reject(new Error('Signalsmith Stretch ei ole ladattavissa tässä ympäristössä.'));
    libraryPromise=new Promise((resolve,reject)=>{
      let script=root.document.querySelector?.('script[data-cheer-signalsmith]');
      const done=()=>libraryReady()?resolve(root.SignalsmithStretch):reject(new Error('Signalsmith Stretch latautui ilman käyttöliittymää.'));
      const fail=()=>reject(new Error('Signalsmith Stretch -kirjaston lataus epäonnistui.'));
      if(script){script.addEventListener?.('load',done,{once:true});script.addEventListener?.('error',fail,{once:true});return}
      script=root.document.createElement('script');script.src=CDN;script.async=true;script.crossOrigin='anonymous';script.dataset.cheerSignalsmith='1';script.addEventListener('load',done,{once:true});script.addEventListener('error',fail,{once:true});(root.document.head||root.document.documentElement).appendChild(script);
    }).catch(err=>{libraryPromise=null;throw err});
    return libraryPromise;
  }

  function copyInputChannels(inputBuffer){const channels=[];for(let ch=0;ch<inputBuffer.numberOfChannels;ch++)channels.push(Float32Array.from(inputBuffer.getChannelData(ch)));return channels}

  async function renderSignalsmith(inputBuffer,rate){
    const Offline=offlineCtor();if(!Offline)throw new Error('OfflineAudioContext puuttuu.');
    const r=clamp(num(rate,1),.5,2),length=Math.max(1,Math.round(inputBuffer.length/r)),offline=new Offline(inputBuffer.numberOfChannels,length,inputBuffer.sampleRate);
    if(!offline.audioWorklet)throw new Error('AudioWorklet ei ole käytettävissä OfflineAudioContextissa.');
    const createStretch=await loadLibrary(),node=await createStretch(offline,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[inputBuffer.numberOfChannels]});
    if(!node?.addBuffers||!node?.start)throw new Error('Signalsmith Stretch -node ei alustunut oikein.');
    node.connect(offline.destination);
    if(node.configure)await node.configure({preset:'default'});
    await node.addBuffers(copyInputChannels(inputBuffer));
    const outputSeconds=length/inputBuffer.sampleRate;
    await node.start(0,0,outputSeconds,r,0);
    const rendered=await offline.startRendering();
    try{await node.dropBuffers?.()}catch{}
    if(!rendered||rendered.length!==length)throw new Error('Signalsmith-renderin pituus ei täsmää.');
    if(rendered.numberOfChannels!==inputBuffer.numberOfChannels)throw new Error('Signalsmith-renderin kanavamäärä ei täsmää.');
    return rendered;
  }

  async function stretchAudioBuffer(context,inputBuffer,rate,options={}){
    if(!inputBuffer)return null;const b=base(),r=clamp(num(rate,1),.5,2),needs=b?.needsStretch?b.needsStretch(r):Math.abs(r-1)>1e-4;if(!needs){lastEngine='none';lastError=null;return inputBuffer}
    try{
      const rendered=await renderSignalsmith(inputBuffer,r);lastEngine='signalsmith';lastError=null;try{rendered.cheerStretchEngine='signalsmith'}catch{}return rendered;
    }catch(err){
      lastError=err?.message||String(err);if(options.requireSignalsmith)throw err;if(!b?.stretchAudioBuffer)throw err;console.warn('Signalsmith HQ ei ollut käytettävissä, käytetään WSOLA-varajärjestelmää.',err);const rendered=b.stretchAudioBuffer(context,inputBuffer,r,options);lastEngine='wsola-fallback';try{rendered.cheerStretchEngine='wsola-fallback'}catch{}return rendered;
    }
  }

  function status(){return{engine:lastEngine,lastError,libraryReady:libraryReady(),platformReady:platformReady(),version:VERSION,cdn:CDN}}
  return{stretchAudioBuffer,renderSignalsmith,loadLibrary,status,libraryReady,platformReady,algorithm:`Signalsmith Stretch ${VERSION}`,fallback:'WSOLA-v3-adaptive-power',CDN,VERSION};
});