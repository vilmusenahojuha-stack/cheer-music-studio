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
  const SECTION_PROFILES=Object.freeze({
    intro:Object.freeze({id:'competition-voice-intro-v1',presenceDb:2.4,compressorThresholdDb:-19,compressorRatio:3,speechGainDb:1.8}),
    dance:Object.freeze({id:'competition-voice-dance-v1',presenceDb:1.5,compressorThresholdDb:-16,compressorRatio:2.6,speechGainDb:1}),
    stunt:Object.freeze({id:'competition-voice-stunt-v1',presenceDb:1.4,compressorThresholdDb:-16,compressorRatio:2.5,speechGainDb:1}),
    basket:Object.freeze({id:'competition-voice-basket-v1',presenceDb:1.6,compressorThresholdDb:-17,compressorRatio:2.7,speechGainDb:1.1}),
    pyramid:Object.freeze({id:'competition-voice-pyramid-v1',presenceDb:1.8,compressorThresholdDb:-18,compressorRatio:2.8,speechGainDb:1.2}),
    ending:Object.freeze({id:'competition-voice-ending-v1',presenceDb:2.8,compressorThresholdDb:-20,compressorRatio:3.2,speechGainDb:2})
  });
  const ROLE_ADJUSTMENTS=Object.freeze({
    'identity-callout':Object.freeze({presenceDb:.3,compressorThresholdDb:-1,compressorRatio:.1,speechGainDb:.2}),
    'energy-callout':Object.freeze({presenceDb:.2,compressorThresholdDb:1,compressorRatio:-.2,compressorAttackSeconds:-.001,compressorReleaseSeconds:-.02,speechGainDb:.1}),
    'support-callout':Object.freeze({presenceDb:-.3,compressorThresholdDb:1,compressorRatio:-.3,speechGainDb:-.2}),
    'final-callout':Object.freeze({presenceDb:.4,compressorThresholdDb:-1,compressorRatio:.2,speechGainDb:.3,outputHeadroomDb:-.2})
  });
  function competitionVoiceoverActive(project){
    return project?.mixSettings?.voiceoverCompetitionPackage?.kind==='cheer-voiceover-competition-package';
  }
  function canonicalSectionType(value){
    const key=String(value||'').trim().toLowerCase();
    if(!key)return 'other';
    if(key==='end'||key==='finale'||key==='finish')return 'ending';
    if(key==='pyr')return 'pyramid';
    return SECTION_PROFILES[key]?key:'other';
  }
  function canonicalRole(value){
    const key=String(value||'').trim().toLowerCase();
    if(!key)return 'other';
    if(key==='identity'||key==='intro-callout'||key==='team-callout')return 'identity-callout';
    if(key==='energy'||key==='dance-callout'||key==='hype-callout')return 'energy-callout';
    if(key==='support'||key==='supporting-callout')return 'support-callout';
    if(key==='final'||key==='ending-callout'||key==='finale-callout'||key==='tag')return 'final-callout';
    return ROLE_ADJUSTMENTS[key]?key:'other';
  }
  function selectedVoiceoverForClip(project,clip){
    const selected=Array.isArray(project?.mixSettings?.voiceoverCompetitionPackage?.selected)?project.mixSettings.voiceoverCompetitionPackage.selected:[];
    const ids=[clip?.voiceoverSlotId,clip?.slotId,clip?.competitionSlotId,clip?.id].filter(v=>v!=null&&String(v)!=='').map(String);
    if(!ids.length)return null;
    return selected.find(item=>ids.includes(String(item?.slotId??'')))||null;
  }
  function resolveSectionType(project,clip){
    const direct=clip?.sectionType??clip?.cheerSectionType??clip?.voiceoverSectionType;
    if(direct!=null&&String(direct).trim())return canonicalSectionType(direct);
    return canonicalSectionType(selectedVoiceoverForClip(project,clip)?.sectionType);
  }
  function resolveRole(project,clip){
    const direct=clip?.voiceoverRole??clip?.competitionVoiceoverRole??clip?.role;
    if(direct!=null&&String(direct).trim())return canonicalRole(direct);
    return canonicalRole(selectedVoiceoverForClip(project,clip)?.role);
  }
  function applyRoleAdjustment(profile,role){
    const adjustment=ROLE_ADJUSTMENTS[canonicalRole(role)];
    if(!adjustment)return {...profile};
    const adjusted={...profile};
    for(const [key,delta] of Object.entries(adjustment))adjusted[key]=finite(adjusted[key],finite(DEFAULT_PROFILE[key],0))+delta;
    return adjusted;
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
    const sectionType=resolveSectionType(project,clip);
    const role=resolveRole(project,clip);
    const sectionProfile=SECTION_PROFILES[sectionType]||null;
    const roleAdjustment=ROLE_ADJUSTMENTS[role]||null;
    const baseProfile={...DEFAULT_PROFILE,...sectionProfile};
    const roleAdjusted=applyRoleAdjustment(baseProfile,role);
    const profile=normalizeProfile({...roleAdjusted,...(project?.mixSettings?.competitionVoiceProcessingProfile||{})});
    return {
      active:true,
      nonDestructive:true,
      timingSafe:true,
      sectionAware:true,
      roleAware:true,
      sectionType,
      role,
      sectionProfileId:sectionProfile?.id||DEFAULT_PROFILE.id,
      roleProfileId:roleAdjustment?`competition-voice-${role}-v1`:'competition-voice-role-neutral-v1',
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
  return {DEFAULT_PROFILE,SECTION_PROFILES,ROLE_ADJUSTMENTS,dbToGain,competitionVoiceoverActive,canonicalSectionType,canonicalRole,selectedVoiceoverForClip,resolveSectionType,resolveRole,applyRoleAdjustment,normalizeProfile,processingPlan,configureWebAudioNodes};
});