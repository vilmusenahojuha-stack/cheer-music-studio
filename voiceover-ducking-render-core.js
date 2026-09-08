(()=>{
  'use strict';

  function finite(value,fallback=null){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function dbToGain(db){return Math.pow(10,finite(db,0)/20);}
  function secondsForCount(eight,count,bpm){
    const e=Math.max(1,finite(eight,1));
    const c=finite(count,1);
    const beatSeconds=60/bpm;
    return Math.max(0,(((e-1)*8)+(c-1))*beatSeconds);
  }
  function normalizePackageReservations(pkg){
    if(!pkg||pkg.kind!=='cheer-voiceover-competition-package')return [];
    const selected=Array.isArray(pkg.selected)?pkg.selected:[];
    return selected.filter(item=>item?.status==='preview-ready'&&item?.ducking).map(item=>({
      slotId:item.slotId||null,
      sectionType:item.sectionType||'other',
      eight:finite(item.ducking.eight,finite(item.placement?.eight)),
      duckDb:finite(item.ducking.musicGainDb),
      speechWindow:item.ducking.speechWindow||null,
      duckWindow:item.ducking.duckWindow||null
    })).filter(item=>item.eight!=null&&item.duckDb!=null&&item.speechWindow&&item.duckWindow);
  }
  function envelopeForReservation(item,bpm){
    if(!(bpm>0)||!item)return null;
    const eight=finite(item.eight);
    const duckDb=finite(item.duckDb,finite(item.musicGainDb));
    const duckWindow=item.duckWindow||null;
    const speechWindow=item.speechWindow||null;
    if(eight==null||duckDb==null||!duckWindow||!speechWindow)return null;
    const duckStart=secondsForCount(eight,duckWindow.startCount,bpm);
    const speechStart=secondsForCount(eight,speechWindow.startCount,bpm);
    const speechEnd=secondsForCount(eight,speechWindow.endCount,bpm);
    const duckEnd=secondsForCount(eight,duckWindow.endCount,bpm);
    if(!(duckEnd>duckStart))return null;
    return {slotId:item.slotId||null,duckStart,speechStart:Math.max(duckStart,speechStart),speechEnd:Math.max(speechStart,speechEnd),duckEnd,targetGain:clamp(dbToGain(duckDb),0.01,1)};
  }
  function gainAt(envelope,time){
    if(time<=envelope.duckStart||time>=envelope.duckEnd)return 1;
    if(time<envelope.speechStart){
      const span=Math.max(1e-9,envelope.speechStart-envelope.duckStart);
      const x=(time-envelope.duckStart)/span;
      return 1+(envelope.targetGain-1)*x;
    }
    if(time<=envelope.speechEnd)return envelope.targetGain;
    const span=Math.max(1e-9,envelope.duckEnd-envelope.speechEnd);
    const x=(time-envelope.speechEnd)/span;
    return envelope.targetGain+(1-envelope.targetGain)*x;
  }
  function automationPointsForClip(pkg,clipStart,clipEnd,bpm){
    const start=Math.max(0,finite(clipStart,0));
    const end=Math.max(start,finite(clipEnd,start));
    const envelopes=normalizePackageReservations(pkg).map(item=>envelopeForReservation(item,bpm)).filter(Boolean).filter(env=>env.duckEnd>start&&env.duckStart<end);
    if(!envelopes.length)return [[start,1],[end,1]];
    const times=new Set([start,end]);
    for(const env of envelopes){for(const t of [env.duckStart,env.speechStart,env.speechEnd,env.duckEnd])if(t>start&&t<end)times.add(t);}
    return [...times].sort((a,b)=>a-b).map(time=>[time,Number(Math.min(1,...envelopes.map(env=>gainAt(env,time))).toFixed(6))]);
  }

  const api={dbToGain,secondsForCount,normalizePackageReservations,envelopeForReservation,automationPointsForClip};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverDuckingRenderCore=api;
})();
