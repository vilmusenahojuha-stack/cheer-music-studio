(()=>{
  'use strict';

  let lastApplied=null;

  function isUsableRefresh(detail){
    return !!(
      detail&&
      detail.status==='refreshed'&&
      detail.source==='current-project-offline-render'&&
      detail.nonDestructive===true&&
      detail.finalCheck
    );
  }

  function syncAssessment(detail){
    if(!isUsableRefresh(detail))return false;
    const assessment=window.cheerCompetitionMasterAssessment;
    if(!assessment?.render)return false;

    assessment.render();
    window.cheerCompetitionMasterClarityResolutionUI?.refreshAll?.();
    window.cheerCompetitionMasterFinalCheckRefresh?.refreshButtonState?.();

    lastApplied={
      refreshedAt:detail.refreshedAt||null,
      finalCheckStatus:detail.finalCheck?.status||null,
      source:detail.source,
      nonDestructive:true
    };
    return true;
  }

  function onRefreshed(event){
    syncAssessment(event?.detail||null);
  }

  function init(){
    window.addEventListener('cheer-competition-master-final-check-refreshed',onRefreshed);
    window.cheerCompetitionMasterFinalCheckRefreshUISync={
      isUsableRefresh,
      syncAssessment,
      getLastApplied:()=>lastApplied
    };
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
