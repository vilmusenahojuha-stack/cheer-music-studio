(()=>{
  'use strict';

  function voiceoverPackageFromState(state={}){
    const candidates=[
      state.competitionVoiceoverPackage,
      state.voiceoverCompetitionPackage,
      state.mixSettings?.competitionVoiceoverPackage,
      state.mixSettings?.voiceoverCompetitionPackage
    ];
    return candidates.find(pkg=>pkg&&pkg.kind==='cheer-voiceover-competition-package')||null;
  }

  function buildExportReadiness(input={}){
    const metrics=input.metrics||null;
    const state=input.state||{};
    const inputCore=input.masterInputCore||null;
    const readinessCore=input.readinessCore||null;
    if(!metrics)return{masterInput:null,readiness:null,reason:'master-metrics-required'};
    if(!inputCore?.buildCompetitionMasterInput||!inputCore?.toCompetitionMasterReadinessInput){
      return{masterInput:null,readiness:null,reason:'master-input-core-required'};
    }
    if(!readinessCore?.buildCompetitionMasterReadiness){
      return{masterInput:null,readiness:null,reason:'master-readiness-core-required'};
    }

    const voiceoverPackage=input.voiceoverPackage||voiceoverPackageFromState(state);
    const masterInput=inputCore.buildCompetitionMasterInput({
      metrics,
      stage:metrics.stage||'post-voiceover-mix',
      voiceoverPackage,
      riskFlags:Array.isArray(input.riskFlags)?input.riskFlags:[]
    });
    const readinessInput=inputCore.toCompetitionMasterReadinessInput(masterInput);
    const readiness=readinessInput?readinessCore.buildCompetitionMasterReadiness(readinessInput):null;
    return{
      masterInput,
      readiness,
      reason:readiness?null:(masterInput?.reason||'master-readiness-input-blocked')
    };
  }

  const api={voiceoverPackageFromState,buildExportReadiness};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerCompetitionMasterExportReadinessCore=api;
})();
