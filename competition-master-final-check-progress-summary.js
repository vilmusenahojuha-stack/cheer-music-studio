(()=>{
  'use strict';

  const EPSILON=1e-9;

  function array(value){return Array.isArray(value)?value:[];}

  function classifyRemaining(items){
    let improved=0,worsened=0,unchanged=0,unmeasured=0;
    for(const item of array(items)){
      const delta=Number(item?.progress?.deltaDistance);
      if(!Number.isFinite(delta)){unmeasured++;continue;}
      if(delta>EPSILON)improved++;
      else if(delta<-EPSILON)worsened++;
      else unchanged++;
    }
    return {improved,worsened,unchanged,unmeasured};
  }

  function summarizeComparison(comparison){
    if(!comparison||comparison.advisoryOnly!==true||comparison.nonDestructive!==true)return null;
    const remaining=classifyRemaining(comparison.remaining);
    const removed=array(comparison.removed).length;
    const added=array(comparison.added).length;
    const totalCompared=remaining.improved+remaining.worsened+remaining.unchanged;
    return {
      kind:'cheer-competition-master-final-check-progress-summary',
      advisoryOnly:true,
      nonDestructive:true,
      improved:remaining.improved,
      worsened:remaining.worsened,
      unchanged:remaining.unchanged,
      unmeasured:remaining.unmeasured,
      removed,
      added,
      totalCompared,
      text:`Kehitys: ${remaining.improved} parani · ${remaining.worsened} heikkeni · ${removed} poistui · ${added} uusi${added===1?'':'a'}${remaining.unchanged?` · ${remaining.unchanged} ennallaan`:''}${remaining.unmeasured?` · ${remaining.unmeasured} ilman vertailumittausta`:''}.`
    };
  }

  function ensureNode(){
    const history=document.querySelector('#competitionMasterFinalCheckHistory');
    if(!history)return null;
    let node=document.querySelector('#competitionMasterFinalCheckProgressSummary');
    if(node)return node;
    node=document.createElement('div');
    node.id='competitionMasterFinalCheckProgressSummary';
    node.className='competition-master-final-check-progress-summary';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    history.insertAdjacentElement('afterbegin',node);
    return node;
  }

  function render(summary){
    const node=ensureNode();
    if(!node)return false;
    if(!summary){node.hidden=true;node.textContent='';return false;}
    node.hidden=false;
    node.textContent=summary.text;
    node.dataset.improved=String(summary.improved);
    node.dataset.worsened=String(summary.worsened);
    node.dataset.removed=String(summary.removed);
    node.dataset.added=String(summary.added);
    return true;
  }

  function refresh(){
    const comparison=window.cheerCompetitionMasterFinalCheckHistory?.getLastComparison?.();
    const summary=summarizeComparison(comparison);
    render(summary);
    return summary;
  }

  function init(){
    window.addEventListener('cheer-competition-master-final-check-refreshed',()=>queueMicrotask(refresh));
    window.cheerCompetitionMasterFinalCheckProgressSummary={classifyRemaining,summarizeComparison,refresh,render};
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={classifyRemaining,summarizeComparison};
  if(typeof window!=='undefined'&&typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();