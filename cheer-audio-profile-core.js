(()=>{
  'use strict';

  function finite(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}

  function percentile(values,p){
    if(!values.length)return 0;
    const sorted=[...values].sort((a,b)=>a-b);
    const index=(sorted.length-1)*clamp01(p);
    const lo=Math.floor(index),hi=Math.ceil(index);
    if(lo===hi)return sorted[lo];
    const t=index-lo;
    return sorted[lo]*(1-t)+sorted[hi]*t;
  }

  function frameStats(samples,start,end){
    start=Math.max(0,Math.floor(start));
    end=Math.min(samples.length,Math.max(start+1,Math.floor(end)));
    let sumSquares=0,peak=0,absFlux=0,previous=samples[start]||0;
    for(let i=start;i<end;i++){
      const v=finite(samples[i]);
      const av=Math.abs(v);
      sumSquares+=v*v;
      if(av>peak)peak=av;
      if(i>start)absFlux+=Math.max(0,av-Math.abs(previous));
      previous=v;
    }
    const length=Math.max(1,end-start);
    const rms=Math.sqrt(sumSquares/length);
    return {rms,peak,crestDb:rms>1e-9?20*Math.log10(Math.max(rms,peak)/rms):0,onsetFlux:absFlux/length};
  }

  function analyzeEightCountEnergy(samples,{sampleRate,bpm,oneOffset=0,totalEights=0}={}){
    const sr=finite(sampleRate);
    const tempo=finite(bpm);
    if(!samples||typeof samples.length!=='number')throw new Error('PCM samples are required.');
    if(sr<=0)throw new Error('sampleRate must be greater than zero.');
    if(tempo<=0)throw new Error('bpm must be greater than zero.');
    const eightSeconds=480/tempo;
    const offset=Math.max(0,finite(oneOffset));
    const available=Math.max(0,samples.length/sr-offset);
    const sampleRoundingTolerance=4/sr;
    const inferred=Math.floor((available+sampleRoundingTolerance)/eightSeconds);
    const count=Math.max(0,Math.min(inferred,Math.floor(finite(totalEights,inferred)||inferred)));
    const rows=[];
    for(let i=0;i<count;i++){
      const startTime=offset+i*eightSeconds;
      const endTime=startTime+eightSeconds;
      const stats=frameStats(samples,startTime*sr,endTime*sr);
      rows.push({eight:i+1,start:startTime,end:endTime,...stats});
    }
    if(!rows.length)return [];

    const rmsValues=rows.map(row=>row.rms);
    const fluxValues=rows.map(row=>row.onsetFlux);
    const low=percentile(rmsValues,.15),high=percentile(rmsValues,.85);
    const fluxHigh=Math.max(1e-9,percentile(fluxValues,.85));
    const span=Math.max(1e-9,high-low);

    return rows.map((row,index)=>{
      const loudness=clamp01((row.rms-low)/span);
      const activity=clamp01(row.onsetFlux/fluxHigh);
      const score=clamp01(loudness*.8+activity*.2);
      let energy='medium';
      if(score<.24)energy='low';
      else if(score<.55)energy='medium';
      else if(score<.82)energy='high';
      else energy='peak';
      const previous=index?rows[index-1]:null;
      return {...row,energyScore:score,energy,loudness,activity,rawDelta:previous?row.rms-previous.rms:0};
    }).map((row,index,all)=>({...row,energyDelta:index?row.energyScore-all[index-1].energyScore:0}));
  }

  function detectAudioEnergyEvents(profile=[],options={}){
    const breakThreshold=Math.max(.05,finite(options.breakThreshold,.22));
    const dropThreshold=Math.max(.05,finite(options.dropThreshold,.22));
    const events=[];
    for(let i=1;i<profile.length;i++){
      const previous=profile[i-1],current=profile[i];
      const delta=finite(current.energyScore)-finite(previous.energyScore);
      if(delta<=-breakThreshold){
        events.push({type:'break',atEight:current.eight,time:current.start,delta,confidence:clamp01(.55+Math.abs(delta)*.7)});
      }else if(delta>=dropThreshold){
        events.push({type:'drop',atEight:current.eight,time:current.start,delta,confidence:clamp01(.55+delta*.7)});
      }
    }
    return events;
  }

  const api={percentile,frameStats,analyzeEightCountEnergy,detectAudioEnergyEvents};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerAudioProfileCore=api;
})();
