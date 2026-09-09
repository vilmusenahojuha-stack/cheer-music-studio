(()=>{
  'use strict';

  let running=false,lastResult=null;
  const resolutions=new Map();
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

  function focusKey(value={}){
    const sectionId=String(value?.sectionId||'').trim();
    const kind=value?.focusKind==='fx'||value?.kind==='fx'?'fx':value?.focusKind==='voiceover'||value?.kind==='voiceover'?'voiceover':null;
    const startSeconds=finite(value?.focusStartSeconds??value?.startSeconds);
    const endSeconds=finite(value?.focusEndSeconds??value?.endSeconds);
    if(!sectionId||!kind||startSeconds===null||endSeconds===null||endSeconds<=startSeconds)return null;
    return `${sectionId}|${kind}|${startSeconds.toFixed(4)}|${endSeconds.toFixed(4)}`;
  }

  function applyResolution(issue={},result={}){
    const issueKey=focusKey(issue);
    const resultKey=focusKey({
      sectionId:result?.sectionId||issue?.sectionId,
      focusKind:result?.focusKind||result?.kind||issue?.focusKind,
      focusStartSeconds:result?.startSeconds,
      focusEndSeconds:result?.endSeconds
    });
    if(!issueKey||resultKey!==issueKey)return null;

    const currentScore=finite(result?.currentScore);
    const minScore=finite(result?.minScore);
    const issueMinScore=finite(issue?.focusMinScore);
    const sameThreshold=issueMinScore===null||minScore===null?false:Math.abs(issueMinScore-minScore)<1e-9;
    const passed=result?.verdict==='passed'&&currentScore!==null&&minScore!==null&&currentScore>=minScore&&sameThreshold;

    if(!passed){
      resolutions.delete(issueKey);
      return {
        key:issueKey,
        status:'open',
        resolved:false,
        reason:sameThreshold?'recheck-not-passed':'acceptance-threshold-changed'
      };
    }

    const resolution={
      key:issueKey,
      status:'resolved',
      resolved:true,
      sectionId:issue.sectionId,
      sectionLabel:issue?.label||issue?.type||null,
      focusKind:issue.focusKind,
      startSeconds:finite(issue.focusStartSeconds),
      endSeconds:finite(issue.focusEndSeconds),
      previousScore:finite(result?.previousScore),
      currentScore,
      minScore,
      improvement:finite(result?.improvement),
      checkedAt:result?.checkedAt||new Date().toISOString()
    };
    resolutions.set(issueKey,resolution);
    return resolution;
  }

  function getResolution(issue={}){
    const key=focusKey(issue);
    return key?resolutions.get(key)||null:null;
  }

  function isResolved(issue={}){
    return getResolution(issue)?.resolved===true;
  }

  function clearResolutions(){
    resolutions.clear();
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
      lastResult.resolution=applyResolution(issue,lastResult);
      window.dispatchEvent?.(new CustomEvent('cheer-competition-master-clarity-recheck',{detail:lastResult}));
      return lastResult;
    }finally{
      running=false;
    }
  }

  function getLastResult(){return lastResult;}
  function isRunning(){return running;}

  window.cheerCompetitionMasterClarityRecheck={
    recheck,
    getLastResult,
    isRunning,
    normalizeFocus,
    focusKey,
    applyResolution,
    getResolution,
    isResolved,
    clearResolutions
  };
})();
