(()=>{
  'use strict';

  const LEVELS=Object.freeze(['strong','review','manual']);

  function normalizeLevel(value){
    const level=String(value||'manual').toLowerCase();
    return LEVELS.includes(level)?level:'manual';
  }

  function trackName(profile,index){
    if(Array.isArray(profile)&&profile.length){
      const named=profile.find(row=>row?.sourceName)?.sourceName;
      if(named)return String(named);
    }
    return `Kappale ${index+1}`;
  }

  function summarizeProfiles(profiles=[]){
    const rows=Array.isArray(profiles)?profiles:[];
    const tracks=rows.map((profile,index)=>{
      const alignment=profile?.eightAlignment||{};
      const level=normalizeLevel(alignment.reliabilityLevel);
      return {
        index,
        name:trackName(profile,index),
        level,
        confidence:Number.isFinite(Number(alignment.confidence))?Number(alignment.confidence):0,
        support:Number.isFinite(Number(alignment.support))?Number(alignment.support):0,
        canAutoUse:alignment.canAutoUse===true&&level==='strong',
        needsReview:level==='review'||alignment.needsReview===true,
        useManualCountOne:level==='manual'||alignment.useManualCountOne===true,
        reanalyzed:alignment.reanalyzed===true,
        originalOneOffset:Number.isFinite(Number(alignment.originalOneOffset))?Number(alignment.originalOneOffset):null,
        oneOffset:Number.isFinite(Number(alignment.oneOffset))?Number(alignment.oneOffset):null
      };
    });

    const counts={strong:0,review:0,manual:0};
    for(const track of tracks)counts[track.level]++;

    return {
      kind:'smart-mix-eight-alignment-summary',
      nonDestructive:true,
      total:tracks.length,
      counts,
      tracks,
      allStrong:tracks.length>0&&counts.strong===tracks.length,
      hasReview:counts.review>0,
      hasManual:counts.manual>0
    };
  }

  function statusText(summary){
    if(!summary||!summary.total)return '8-count-kohdistusta ei ole vielä analysoitu.';
    const {strong=0,review=0,manual=0}=summary.counts||{};
    const parts=[];
    if(strong)parts.push(`${strong} vahva`);
    if(review)parts.push(`${review} tarkistettava`);
    if(manual)parts.push(`${manual} manuaalinen`);
    return `8-count-kohdistus: ${parts.join(' · ')}.`;
  }

  function trackStatusText(track){
    if(!track)return '';
    if(track.level==='strong')return `${track.name}: vahva 8-count-kohdistus`;
    if(track.level==='review')return `${track.name}: tarkista 1-lasku`;
    return `${track.name}: käytä manuaalista 1-laskua`;
  }

  const api={LEVELS,normalizeLevel,summarizeProfiles,statusText,trackStatusText};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixAlignmentSummaryCore=api;
})();