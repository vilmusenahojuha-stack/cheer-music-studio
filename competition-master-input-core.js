(()=>{
  'use strict';

  const PROFILE=Object.freeze({
    id:'fi-cheer-master-input-v1',
    requiredStage:'post-voiceover-mix',
    minHeadroomDb:1,
    maxTruePeakDbtp:-1,
    nonDestructive:true
  });

  function finite(value,fallback=null){
    if(value===null||value===undefined||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function array(value){return Array.isArray(value)?value:[];}
  function unique(values){return [...new Set(values)];}

  function buildCompetitionMasterInput(input={}){
    input=input||{};
    const base={
      version:1,
      kind:'cheer-competition-master-input',
      profile:PROFILE.id,
      status:'blocked',
      reason:'post-voiceover-metrics-required',
      stage:PROFILE.requiredStage,
      nonDestructive:true,
      executable:false,
      metrics:null,
      voiceoverPackage:null,
      riskFlags:[]
    };

    const metrics=input.metrics||input.mixMetrics||input.postVoiceoverMetrics||null;
    if(!metrics)return base;

    const measuredStage=input.stage||metrics.stage||null;
    if(measuredStage&&measuredStage!==PROFILE.requiredStage){
      return {...base,reason:'post-voiceover-stage-required'};
    }

    const truePeakDbtp=finite(metrics.truePeakDbtp);
    const loudnessRangeLu=finite(metrics.loudnessRangeLu);
    if(truePeakDbtp===null)return {...base,reason:'true-peak-required'};
    if(loudnessRangeLu===null)return {...base,reason:'loudness-range-required'};

    const voiceover=input.voiceoverPackage||null;
    if(!voiceover||voiceover.kind!=='cheer-voiceover-competition-package'){
      return {...base,reason:'voiceover-package-required'};
    }
    if(voiceover.status==='blocked')return {...base,reason:'voiceover-package-blocked'};

    const risks=new Set(array(input.riskFlags));
    const headroomDb=Math.max(0,-truePeakDbtp);
    if(truePeakDbtp>PROFILE.maxTruePeakDbtp)risks.add('insufficient-post-voiceover-headroom');
    if(voiceover.status==='review-required'||array(voiceover.selected).some(item=>item?.status==='review-required')){
      risks.add('voiceover-review-required-before-master');
    }

    const sectionPeaksDb=array(metrics.sectionPeaksDb).map(v=>finite(v)).filter(Number.isFinite);
    const ready=!risks.has('insufficient-post-voiceover-headroom')&&!risks.has('voiceover-review-required-before-master');

    return {
      version:1,
      kind:'cheer-competition-master-input',
      profile:PROFILE.id,
      status:ready?'ready':'review-required',
      reason:null,
      stage:PROFILE.requiredStage,
      nonDestructive:true,
      executable:false,
      metrics:{
        truePeakDbtp,
        headroomDb:Number(headroomDb.toFixed(3)),
        loudnessRangeLu,
        sectionPeaksDb,
        integratedLufs:finite(metrics.integratedLufs)
      },
      voiceoverPackage:voiceover,
      riskFlags:unique([...risks]),
      nextStep:ready?'competition-master-readiness':'resolve-post-voiceover-risks',
      contract:{
        rule:'measure the complete mix after competition voiceover processing; never create headroom by mutating audio in this bridge',
        requiredTruePeakDbtp:PROFILE.maxTruePeakDbtp,
        requiredHeadroomDb:PROFILE.minHeadroomDb
      }
    };
  }

  function toCompetitionMasterReadinessInput(masterInput){
    if(!masterInput||masterInput.kind!=='cheer-competition-master-input'||masterInput.status==='blocked')return null;
    return {
      metrics:{
        truePeakDbtp:masterInput.metrics.truePeakDbtp,
        loudnessRangeLu:masterInput.metrics.loudnessRangeLu,
        sectionPeaksDb:array(masterInput.metrics.sectionPeaksDb)
      },
      voiceoverPackage:masterInput.voiceoverPackage,
      riskFlags:array(masterInput.riskFlags)
    };
  }

  const api={PROFILE,buildCompetitionMasterInput,toCompetitionMasterReadinessInput};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerCompetitionMasterInputCore=api;
})();
