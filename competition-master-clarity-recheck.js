(()=>{
  'use strict';

  let running=false,lastResult=null;
  const finite=value=>Number.isFinite(Number(value))?Number(value):null;

  function normalizeFocus(issue={}){
    const kind=issue?.focusKind==='fx'?'fx':issue?.focusKind==='voiceover'?'voiceover':null;
    const startSeconds=finite(issue?.focusStartSeconds);
    const endSeconds=finite(issue?.focusEndSeconds);
    const score=finite(issue?.focusScore);
    const minScore=finite(issue?.focusMinScore);
    if(!kind||startSeconds===null||endSeconds===null||endSeconds<=startSeconds)return null;
    return{kind,startSeconds,endSeconds,score,minScore};
  }

  async function recheck(issue={}){
    if(running)throw new Error('Clarity-uudelleentarkistus on jo käynnissä.');
    const focus=normalizeFocus(issue);
    if(!focus)throw new Error('Tarkkaa clarity-mittausikkunaa ei ole saatavilla.');
    const renderer=window.CheerOfflineRenderer;
    const core=window.CheerCompetitionMasterClarityMetricsCore;
    if(!renderer?.renderProject)throw new Error('Offline-renderöinti ei ole käytettävissä.');
    if(!core?.recheckFocusedClarity)throw new Error('Clarity-uudelleentarkistuksen mittausydin ei ole käytettävissä.');
    if(!window.state)throw new Error('Projektin tila ei ole käytettävissä.');

    running=true;
    try{
      const rendered=await renderer.renderProject(window.state,()=>{});
      const result=core.recheckFocusedClarity(rendered,focus);
      lastResult={
        ...result,
        sectionId:issue?.sectionId||null,
        sectionLabel:issue?.label||issue?.type||null,
        checkedAt:new Date().toISOString()
      };
      window.dispatchEvent?.(new CustomEvent('cheer-competition-master-clarity-recheck',{detail:lastResult}));
      return lastResult;
    }finally{
      running=false;
    }
  }

  function getLastResult(){return lastResult;}
  function isRunning(){return running;}

  window.cheerCompetitionMasterClarityRecheck={recheck,getLastResult,isRunning,normalizeFocus};
})();
