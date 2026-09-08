((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerCompetitionMasterMetricsCore=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';

  const DEFAULTS=Object.freeze({
    blockSeconds:.4,
    hopSeconds:.1,
    shortTermSeconds:3,
    shortTermHopSeconds:1,
    absoluteGateLufs:-70,
    integratedRelativeGateLu:-10,
    lraRelativeGateLu:-20,
    truePeakOversample:4,
    maxSeconds:180
  });

  const finite=(value,fallback=null)=>{
    if(value===null||value===undefined||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=(value,digits=1)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
  const linearToDb=value=>20*Math.log10(Math.max(1e-12,value));
  const lufsFromMeanSquare=meanSquare=>meanSquare>0?-0.691+10*Math.log10(meanSquare):-Infinity;

  function channelsFromBuffer(buffer){
    if(!buffer||!Number.isFinite(buffer.sampleRate)||buffer.sampleRate<=0||typeof buffer.getChannelData!=='function'){
      throw new Error('Invalid audio buffer');
    }
    const channelCount=Math.max(1,Math.min(2,Number(buffer.numberOfChannels)||1));
    const channels=[];
    for(let channel=0;channel<channelCount;channel++)channels.push(buffer.getChannelData(channel));
    return channels;
  }

  function monoSample(channels,index){
    let sum=0;
    for(const channel of channels)sum+=finite(channel[index],0);
    return sum/channels.length;
  }

  function meanSquare(channels,start,end){
    let sum=0,count=0;
    for(let index=start;index<end;index++){
      const sample=monoSample(channels,index);
      sum+=sample*sample;
      count++;
    }
    return count?sum/count:0;
  }

  function energyBlocks(channels,sampleRate,length,blockSeconds,hopSeconds){
    const block=Math.max(1,Math.floor(sampleRate*blockSeconds));
    const hop=Math.max(1,Math.floor(sampleRate*hopSeconds));
    const blocks=[];
    for(let start=0;start+block<=length;start+=hop){
      const energy=meanSquare(channels,start,start+block);
      blocks.push({start,energy,lufs:lufsFromMeanSquare(energy)});
    }
    return blocks;
  }

  function integratedLufs(channels,sampleRate,length,options){
    const blocks=energyBlocks(channels,sampleRate,length,options.blockSeconds,options.hopSeconds)
      .filter(block=>block.lufs>=options.absoluteGateLufs);
    if(!blocks.length){
      const energy=meanSquare(channels,0,length);
      const loudness=lufsFromMeanSquare(energy);
      return Number.isFinite(loudness)?loudness:-Infinity;
    }
    const ungatedEnergy=blocks.reduce((sum,block)=>sum+block.energy,0)/blocks.length;
    const relativeGate=lufsFromMeanSquare(ungatedEnergy)+options.integratedRelativeGateLu;
    const gated=blocks.filter(block=>block.lufs>=relativeGate);
    const selected=gated.length?gated:blocks;
    return lufsFromMeanSquare(selected.reduce((sum,block)=>sum+block.energy,0)/selected.length);
  }

  function percentile(sortedValues,p){
    if(!sortedValues.length)return null;
    if(sortedValues.length===1)return sortedValues[0];
    const position=(sortedValues.length-1)*clamp(p,0,1);
    const lower=Math.floor(position),upper=Math.ceil(position);
    if(lower===upper)return sortedValues[lower];
    const weight=position-lower;
    return sortedValues[lower]*(1-weight)+sortedValues[upper]*weight;
  }

  function loudnessRangeLu(channels,sampleRate,length,integrated,options){
    const blocks=energyBlocks(channels,sampleRate,length,options.shortTermSeconds,options.shortTermHopSeconds);
    const relativeGate=Number.isFinite(integrated)?integrated+options.lraRelativeGateLu:-Infinity;
    const gated=blocks
      .map(block=>block.lufs)
      .filter(value=>Number.isFinite(value)&&value>=options.absoluteGateLufs&&value>=relativeGate)
      .sort((a,b)=>a-b);
    if(gated.length<2)return 0;
    const low=percentile(gated,.1),high=percentile(gated,.95);
    return Math.max(0,high-low);
  }

  function peakBetween(channels,start,end,oversample){
    let peak=0;
    for(const channel of channels){
      for(let index=start;index<Math.max(start,end-1);index++){
        const a=finite(channel[index],0),b=finite(channel[index+1],a);
        peak=Math.max(peak,Math.abs(a));
        for(let step=1;step<oversample;step++){
          const t=step/oversample;
          peak=Math.max(peak,Math.abs(a+(b-a)*t));
        }
      }
      if(end>start)peak=Math.max(peak,Math.abs(finite(channel[end-1],0)));
    }
    return peak;
  }

  function normalizeSection(section,index,durationSeconds){
    const start=clamp(finite(section?.start,finite(section?.startSeconds,0)),0,durationSeconds);
    const fallbackEnd=start+Math.max(0,finite(section?.duration,finite(section?.durationSeconds,0)));
    const end=clamp(finite(section?.end,finite(section?.endSeconds,fallbackEnd)),start,durationSeconds);
    return {
      id:String(section?.id||section?.sectionId||`section-${index+1}`),
      type:section?.type||section?.sectionType||null,
      start,
      end
    };
  }

  function measurePostVoiceoverMix(buffer,sections=[],options={}){
    const o={...DEFAULTS,...options};
    const channels=channelsFromBuffer(buffer);
    const sampleRate=buffer.sampleRate;
    const availableLength=Math.min(...channels.map(channel=>channel.length));
    const maxLength=Math.max(1,Math.floor(sampleRate*clamp(finite(o.maxSeconds,DEFAULTS.maxSeconds),1,600)));
    const length=Math.min(availableLength,maxLength);
    const durationSeconds=length/sampleRate;
    const oversample=Math.round(clamp(finite(o.truePeakOversample,DEFAULTS.truePeakOversample),1,8));
    const normalizedOptions={
      ...o,
      blockSeconds:clamp(finite(o.blockSeconds,DEFAULTS.blockSeconds),.1,1),
      hopSeconds:clamp(finite(o.hopSeconds,DEFAULTS.hopSeconds),.025,.5),
      shortTermSeconds:clamp(finite(o.shortTermSeconds,DEFAULTS.shortTermSeconds),1,5),
      shortTermHopSeconds:clamp(finite(o.shortTermHopSeconds,DEFAULTS.shortTermHopSeconds),.25,2),
      absoluteGateLufs:finite(o.absoluteGateLufs,DEFAULTS.absoluteGateLufs),
      integratedRelativeGateLu:finite(o.integratedRelativeGateLu,DEFAULTS.integratedRelativeGateLu),
      lraRelativeGateLu:finite(o.lraRelativeGateLu,DEFAULTS.lraRelativeGateLu)
    };

    const integrated=integratedLufs(channels,sampleRate,length,normalizedOptions);
    const lra=loudnessRangeLu(channels,sampleRate,length,integrated,normalizedOptions);
    const truePeakLinear=peakBetween(channels,0,length,oversample);
    const truePeakDbtp=linearToDb(truePeakLinear);

    const sectionMeasurements=(Array.isArray(sections)?sections:[])
      .map(normalizeSection)
      .map((section,index)=>normalizeSection(section,index,durationSeconds))
      .filter(section=>section.end>section.start)
      .map(section=>{
        const startSample=Math.floor(section.start*sampleRate);
        const endSample=Math.min(length,Math.ceil(section.end*sampleRate));
        const peak=peakBetween(channels,startSample,endSample,oversample);
        return {...section,peakDbtp:round(linearToDb(peak),1)};
      });

    return {
      kind:'cheer-competition-master-metrics',
      version:1,
      stage:'post-voiceover-mix',
      method:'gated-energy-lra-truepeak-v1',
      nonDestructive:true,
      sampleRate,
      durationSeconds:round(durationSeconds,3),
      truePeakDbtp:round(truePeakDbtp,1),
      integratedLufs:Number.isFinite(integrated)?round(integrated,1):null,
      loudnessRangeLu:round(lra,1),
      sectionPeaksDb:sectionMeasurements.map(section=>section.peakDbtp),
      sections:sectionMeasurements
    };
  }

  function toMasterInputMetrics(measurement){
    if(measurement?.kind!=='cheer-competition-master-metrics'||measurement.stage!=='post-voiceover-mix')return null;
    return {
      stage:'post-voiceover-mix',
      truePeakDbtp:measurement.truePeakDbtp,
      integratedLufs:measurement.integratedLufs,
      loudnessRangeLu:measurement.loudnessRangeLu,
      sectionPeaksDb:Array.isArray(measurement.sectionPeaksDb)?[...measurement.sectionPeaksDb]:[]
    };
  }

  return {DEFAULTS,lufsFromMeanSquare,measurePostVoiceoverMix,toMasterInputMetrics};
});
