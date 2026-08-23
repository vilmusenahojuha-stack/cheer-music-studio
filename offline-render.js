(()=>{
  const SAMPLE_RATE=48000;
  const CHANNELS=2;
  const dsp=()=>window.CheerMixDSP;
  const timing=()=>window.CheerAudioTiming;
  const stretch=()=>window.CheerTimeStretch;
  const trackFor=(project,c)=>(project.tracks||[]).find(t=>t.name===c.sourceName);
  const clipEnd=c=>(Number(c?.start)||0)+Math.max(0,Number(c?.duration)||0);
  const projectLength=project=>{
    const declared=Math.max(0,Number(project?.duration)||0);
    const lastClip=(project?.audioTimeline?.clips||[]).reduce((m,c)=>Math.max(m,clipEnd(c)),0);
    return Math.max(1,declared,lastClip);
  };
  function trackKey(t){return`${t.name}::${t.size||''}::${t.duration||''}::${t.url||''}`}
  function stretchKey(t,rate){return`${trackKey(t)}::tempo=${Number(rate).toFixed(6)}`}
  function needsPitchStretch(rate){return Math.abs(Number(rate)-1)>1e-4}
  async function decodeTracks(project,onProgress=()=>{}){
    const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Web Audio API ei ole käytettävissä.');
    const ctx=new C();const unique=new Map();for(const c of project.audioTimeline?.clips||[]){const t=trackFor(project,c);if(t?.url)unique.set(trackKey(t),t)}
    const buffers=new Map(),items=[...unique.entries()];let done=0;
    try{
      for(const[key,t]of items){onProgress({phase:'decode',done,total:items.length,name:t.name});const bytes=await fetch(t.url).then(r=>{if(!r.ok)throw new Error(`Audiota ei voitu lukea: ${t.name}`);return r.arrayBuffer()});const decoded=await ctx.decodeAudioData(bytes.slice(0));if(!decoded||!(decoded.duration>0))throw new Error(`Audiotiedoston dekoodaus epäonnistui: ${t.name}`);buffers.set(key,decoded);done++;onProgress({phase:'decode',done,total:items.length,name:t.name})}
      return buffers;
    }finally{ctx.close().catch(()=>{})}
  }
  function prepareStretchedBuffers(offline,project,buffers,onProgress=()=>{}){
    const ts=stretch(),prepared=new Map(),jobs=new Map();
    for(const clip of project.audioTimeline?.clips||[]){if(clip.type!=='music')continue;const t=trackFor(project,clip),original=t&&buffers.get(trackKey(t)),rate=dsp()?.rateForClip?.(clip,project.trackAnalysis||{},project.targetBpm||147)||1;if(!t||!original||!needsPitchStretch(rate))continue;jobs.set(stretchKey(t,rate),{t,original,rate})}
    const items=[...jobs.entries()];if(items.length&&!ts?.stretchAudioBuffer)throw new Error('Pitch-preserving time-stretch -ydin ei ole latautunut.');items.forEach(([key,job],i)=>{onProgress({phase:'stretch',done:i,total:items.length,name:job.t.name});prepared.set(key,ts.stretchAudioBuffer(offline,job.original,job.rate));onProgress({phase:'stretch',done:i+1,total:items.length,name:job.t.name})});return prepared;
  }
  function scheduleClip(offline,project,clip,buffers,stretched,duration){
    const t=trackFor(project,clip);if(!t?.url)return false;const original=buffers.get(trackKey(t));if(!original)return false;
    const rate=dsp()?.rateForClip?.(clip,project.trackAnalysis||{},project.targetBpm||147)||1,ts=stretch(),pitchPreserved=clip.type==='music'&&needsPitchStretch(rate),buffer=pitchPreserved?stretched.get(stretchKey(t,rate)):original;if(!buffer)return false;
    const plan=timing()?.computeClipSchedule?.({clip,playFrom:0,contextStart:0,bufferDuration:original.duration,rate});if(!plan)return false;
    const timelineDuration=Math.min(plan.timelineDuration,Math.max(0,duration-plan.timelineStart));if(!(timelineDuration>.001))return false;
    const source=offline.createBufferSource(),clipGain=offline.createGain(),duckGain=offline.createGain();source.buffer=buffer;source.playbackRate.setValueAtTime(1,plan.when);
    const end=plan.timelineStart+timelineDuration,clips=project.audioTimeline?.clips||[],settings=project.mixSettings||{};
    const envPoints=dsp()?.clipAutomationPoints?.(clip,plan.timelineStart,end)||[[plan.timelineStart,1],[end,1]];
    const duckPoints=dsp()?.duckAutomationPoints?.(clip,clips,plan.timelineStart,end,settings)||[[plan.timelineStart,1],[end,1]];
    dsp()?.scheduleParam?.(clipGain.gain,envPoints,plan.when,plan.timelineStart);
    dsp()?.scheduleParam?.(duckGain.gain,duckPoints,plan.when,plan.timelineStart);
    source.connect(clipGain).connect(duckGain).connect(offline.destination);
    const renderedOffset=pitchPreserved?ts.renderedSourceOffset(plan.sourceOffset,rate):plan.sourceOffset;source.start(plan.when,renderedOffset,timelineDuration);return true;
  }
  async function renderProject(project,onProgress=()=>{}){
    if(!project?.audioTimeline?.clips?.length)throw new Error('Aikajanalla ei ole clippejä.');
    if(!window.OfflineAudioContext&&!window.webkitOfflineAudioContext)throw new Error('OfflineAudioContext ei ole käytettävissä tässä selaimessa.');
    if(!dsp()||!timing())throw new Error('DSP- tai ajoitusydin ei ole latautunut.');
    const invalid=project.audioTimeline.clips.filter(c=>!Number.isFinite(Number(c.start))||Number(c.start)<0||!Number.isFinite(Number(c.duration))||Number(c.duration)<=0||!Number.isFinite(Number(c.sourceOffset||0))||Number(c.sourceOffset||0)<0);if(invalid.length)throw new Error(`${invalid.length} clipillä on virheellinen ajoitus tai lähdekohta.`);
    const missing=project.audioTimeline.clips.filter(c=>!trackFor(project,c)?.url);if(missing.length)throw new Error(`${missing.length} clipiltä puuttuu lähdeaudiotiedosto.`);
    const duration=projectLength(project),length=Math.ceil(duration*SAMPLE_RATE),Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    onProgress({phase:'prepare',done:0,total:1});const buffers=await decodeTracks(project,onProgress);const offline=new Offline(CHANNELS,length,SAMPLE_RATE),stretched=prepareStretchedBuffers(offline,project,buffers,onProgress);let scheduled=0;
    for(const c of project.audioTimeline.clips)if(scheduleClip(offline,project,c,buffers,stretched,duration))scheduled++;
    if(!scheduled)throw new Error('Yhtään audioclippiä ei voitu ajoittaa renderöintiin.');
    onProgress({phase:'render',done:0,total:1});const rendered=await offline.startRendering();onProgress({phase:'render',done:1,total:1});
    if(rendered.sampleRate!==SAMPLE_RATE)throw new Error(`Offline-renderin sample rate oli ${rendered.sampleRate}, odotettiin ${SAMPLE_RATE}.`);
    if(rendered.numberOfChannels!==CHANNELS)throw new Error(`Offline-renderissä oli ${rendered.numberOfChannels} kanavaa, odotettiin stereota.`);
    return rendered;
  }
  window.CheerOfflineRenderer={renderProject,SAMPLE_RATE,CHANNELS,projectLength,trackKey};
})();
