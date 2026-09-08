((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerVoiceoverProcessingCore=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const dbToGain=db=>Math.pow(10,finite(db,0)/20);
  const DEFAULT_PROFILE=Object.freeze({
    id:'competition-voice-clarity-v1',
    highpassHz:95,
    highpassQ:.707,
    presenceHz:3000,
    presenceDb:2,
    presenceQ:.8,
    compressorThresholdDb:-18,
    compressorKneeDb:10,
    compressorRatio:3,
    compressorAttackSeconds:.006,
    compressorReleaseSeconds:.12,
    speechGainDb:1.5,
    outputHeadroomDb:-1
  });
  function competitionVoiceoverActive(project){
    return project?.mixSettings?.voiceoverCompetitionPackage?.kind==='cheer-voiceover-competition-package';
  }
  function normalizeProfile(overrides={}){
    const p={...DEFAULT_PROFILE,...(overrides||{})};
    return {
      id:String(p.id||DEFAULT_PROFILE.id),
      highpassHz:clamp(finite(p.highpassHz,DEFAULT_PROFILE.highpassHz),60,180),
      highpassQ:clamp(finite(p.highpassQ,DEFAULT_PROFILE.highpassQ),.3,2),
      presenceHz:clamp(finite(p.presenceHz,DEFAULT_PROFILE.presenceHz),1800,5000),
      presenceDb:clamp(finite(p.presenceDb,DEFAULT_PROFILE.presenceDb),0,4),
      presenceQ:clamp(finite(p.presenceQ,DEFAULT_PROFILE.presenceQ),.3,2),
      compressorThresholdDb:clamp(finite(p.compressorThresholdDb,DEFAULT_PROFILE.compressorThresholdDb),-30,-8),
      compressorKneeDb:clamp(finite(p.compressorKneeDb,DEFAULT_PROFILE.compressorKneeDb),0,20),
      compressorRatio:clamp(finite(p.compressorRatio,DEFAULT_PROFILE.compressorRatio),1,6),
      compressorAttackSeconds:clamp(finite(p.compressorAttackSeconds,DEFAULT_PROFILE.compressorAttackSeconds),.001,.05),
      compressorReleaseSeconds:clamp(finite(p.compressorReleaseSeconds,DEFAULT_PROFILE.compressorReleaseSeconds),.04,.4),
      speechGainDb:clamp(finite(p.speechGainDb,DEFAULT_PROFILE.speechGainDb),0,3),
      outputHeadroomDb:clamp(finite(p.outputHeadroomDb,DEFAULT_PROFILE.outputHeadroomDb),-3,-.5)
    };
  }
  function processingPlan(project,clip){
    if(clip?.type!=='voice'||!competitionVoiceoverActive(project))return {active:false,reason:'legacy-or-non-voice'};
    if(project?.mixSettings?.competitionVoiceProcessing===false)return {active:false,reason:'disabled'};
    const profile=normalizeProfile(project?.mixSettings?.competitionVoiceProcessingProfile);
    return {
      active:true,
      nonDestructive:true,
      timingSafe:true,
      profile,
      speechGain:dbToGain(profile.speechGainDb),
      outputGain:dbToGain(profile.outputHeadroomDb),
      stages:['highpass','presence','compressor','speech-gain','output-headroom']
    };
  }
  function configureWebAudioNodes(context,plan){
    if(!plan?.active||!context?.createBiquadFilter||!context?.createDynamicsCompressor||!context?.createGain)return null;
    const p=plan.profile;
    const highpass=context.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=p.highpassHz;highpass.Q.value=p.highpassQ;
    const presence=context.createBiquadFilter();presence.type='peaking';presence.frequency.value=p.presenceHz;presence.Q.value=p.presenceQ;presence.gain.value=p.presenceDb;
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=p.compressorThresholdDb;compressor.knee.value=p.compressorKneeDb;compressor.ratio.value=p.compressorRatio;compressor.attack.value=p.compressorAttackSeconds;compressor.release.value=p.compressorReleaseSeconds;
    const speechGain=context.createGain();speechGain.gain.value=plan.speechGain;
    const outputGain=context.createGain();outputGain.gain.value=plan.outputGain;
    highpass.connect(presence).connect(compressor).connect(speechGain).connect(outputGain);
    return {input:highpass,output:outputGain,highpass,presence,compressor,speechGain,outputGain,plan};
  }
  return {DEFAULT_PROFILE,dbToGain,competitionVoiceoverActive,normalizeProfile,processingPlan,configureWebAudioNodes};
});
