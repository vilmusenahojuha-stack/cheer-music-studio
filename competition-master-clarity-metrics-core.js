((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerCompetitionMasterClarityMetricsCore=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';

  const PROFILE=Object.freeze({
    id:'fi-cheer-master-clarity-v1',
    contextSeconds:.35,
    minWindowSeconds:.08,
    maxWindowSeconds:12,
    voiceoverFloorDb:-6,
    voiceoverSpanDb:10,
    fxFloorDb:-5,
    fxSpanDb:9
  });

  const finite=(value,fallback=null)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=(value,digits=3)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
  const rmsToDb=value=>value>0?20*Math.log10(value):-120;

  function channelsFromBuffer(buffer){
    if(!buffer||!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<=0||typeof buffer.getChannelData!=='function')throw new Error('Invalid audio buffer');
    const count=Math.max(1,Math.min(2,Number(buffer.numberOfChannels)||1));
    return Array.from({length:count},(_,index)=>buffer.getChannelData(index));
  }

  function normalizeWindow(window,index,durationSeconds){
    const start=clamp(finite(window?.start,finite(window?.startSeconds,0)),0,durationSeconds);
    const fallbackEnd=start+Math.max(0,finite(window?.duration,finite(window?.durationSeconds,0)));
    const end=clamp(finite(window?.end,finite(window?.endSeconds,fallbackEnd)),start,durationSeconds);
    return {id:String(window?.id||window?.slotId||window?.fxId||`window-${index+1}`),start,end};
  }

  function meanSquare(channels,start,end){
    let sum=0,count=0;
    for(let i=start;i<end;i++){
      let sample=0;
      for(const channel of channels)sample+=finite(channel[i],0);
      sample/=channels.length;
      sum+=sample*sample;count++;
    }
    return count?sum/count:0;
  }

  function contextMeanSquare(channels,start,end,contextSamples,length){
    const leftStart=Math.max(0,start-contextSamples),leftEnd=start;
    const rightStart=end,rightEnd=Math.min(length,end+contextSamples);
    let weighted=0,count=0;
    if(leftEnd>leftStart){const n=leftEnd-leftStart;weighted+=meanSquare(channels,leftStart,leftEnd)*n;count+=n}
    if(rightEnd>rightStart){const n=rightEnd-rightStart;weighted+=meanSquare(channels,rightStart,rightEnd)*n;count+=n}
    return count?weighted/count:0;
  }

  function scoreContrast(contrastDb,floorDb,spanDb){return clamp((contrastDb-floorDb)/spanDb,0,1)}

  function measureWindowSet(buffer,windows=[],kind='voiceover',options={}){
    const channels=channelsFromBuffer(buffer),sampleRate=buffer.sampleRate;
    const length=Math.min(...channels.map(channel=>channel.length));
    const durationSeconds=length/sampleRate;
    const contextSeconds=clamp(finite(options.contextSeconds,PROFILE.contextSeconds),.1,1.5);
    const contextSamples=Math.max(1,Math.round(contextSeconds*sampleRate));
    const minWindow=clamp(finite(options.minWindowSeconds,PROFILE.minWindowSeconds),.02,1);
    const maxWindow=clamp(finite(options.maxWindowSeconds,PROFILE.maxWindowSeconds),1,30);
    const isFx=kind==='fx';
    const floorDb=finite(options.floorDb,isFx?PROFILE.fxFloorDb:PROFILE.voiceoverFloorDb);
    const spanDb=Math.max(1,finite(options.spanDb,isFx?PROFILE.fxSpanDb:PROFILE.voiceoverSpanDb));
    const items=[];

    for(const [index,raw] of (Array.isArray(windows)?windows:[]).entries()){
      const window=normalizeWindow(raw,index,durationSeconds);
      const seconds=window.end-window.start;
      if(seconds<minWindow)continue;
      const limitedEnd=Math.min(window.end,window.start+maxWindow);
      const startSample=Math.floor(window.start*sampleRate),endSample=Math.max(startSample+1,Math.ceil(limitedEnd*sampleRate));
      const targetMs=meanSquare(channels,startSample,Math.min(length,endSample));
      const contextMs=contextMeanSquare(channels,startSample,Math.min(length,endSample),contextSamples,length);
      const targetDb=rmsToDb(Math.sqrt(targetMs)),contextDb=rmsToDb(Math.sqrt(contextMs));
      const contrastDb=targetDb-contextDb;
      items.push({...window,end:limitedEnd,targetRmsDb:round(targetDb,2),contextRmsDb:round(contextDb,2),contrastDb:round(contrastDb,2),score:round(scoreContrast(contrastDb,floorDb,spanDb),3)});
    }

    const score=items.length?items.reduce((sum,item)=>sum+item.score,0)/items.length:null;
    return {kind:`cheer-${kind}-clarity-measurement`,version:1,method:'post-mix-local-rms-contrast-v1',nonDestructive:true,score:round(score,3),windowsMeasured:items.length,items};
  }

  function measureCompetitionClarity(buffer,input={},options={}){
    const voiceover=measureWindowSet(buffer,input.voiceoverWindows||input.voiceovers||[],'voiceover',options.voiceover||{});
    const fx=measureWindowSet(buffer,input.fxWindows||input.fx||[],'fx',options.fx||{});
    return {
      kind:'cheer-competition-master-clarity-metrics',version:1,stage:'post-voiceover-mix',profile:PROFILE.id,nonDestructive:true,
      voiceoverClarityScore:voiceover.score,fxClarityScore:fx.score,voiceover,fx
    };
  }

  function mergeIntoMasterMetrics(metrics,clarity){
    if(!metrics||typeof metrics!=='object')return metrics;
    if(!clarity||clarity.kind!=='cheer-competition-master-clarity-metrics')return {...metrics};
    return {...metrics,voiceoverClarityScore:clarity.voiceoverClarityScore,fxClarityScore:clarity.fxClarityScore,clarityMeasurement:{method:'post-mix-local-rms-contrast-v1',voiceoverWindows:clarity.voiceover?.windowsMeasured||0,fxWindows:clarity.fx?.windowsMeasured||0}};
  }

  return {PROFILE,measureWindowSet,measureCompetitionClarity,mergeIntoMasterMetrics};
});
