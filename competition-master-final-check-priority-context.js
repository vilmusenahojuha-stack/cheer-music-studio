(()=>{
  'use strict';

  function array(value){return Array.isArray(value)?value:[];}

  function finite(value){
    if(value===null||value===undefined||value==='')return null;
    const number=Number(value);
    return Number.isFinite(number)?number:null;
  }

  function formatTime(seconds){
    const value=finite(seconds);
    if(value===null)return null;
    const minutes=Math.floor(value/60);
    const rest=value-minutes*60;
    return `${minutes}:${rest.toFixed(3).padStart(6,'0')}`;
  }

  function parseSectionWindow(key){
    const raw=String(key||'');
    if(!raw.startsWith('section:'))return null;
    const parts=raw.split(':');
    if(parts.length<5)return null;
    const start=finite(parts[parts.length-2]);
    const end=finite(parts[parts.length-1]);
    if(start===null||end===null||end<start)return null;
    return {startSeconds:start,endSeconds:end,text:`${formatTime(start)}–${formatTime(end)}`};
  }

  function findRiskByKey(comparison,key){
    if(!key)return null;
    return [...array(comparison?.added),...array(comparison?.remaining)].find(item=>item?.key===key)||null;
  }

  function buildPriorityContext(comparison,summary){
    if(!comparison||comparison.advisoryOnly!==true||comparison.nonDestructive!==true)return null;
    if(!summary||summary.advisoryOnly!==true||summary.nonDestructive!==true)return null;
    const target=summary.priorityRepairTarget;
    if(!target?.key)return null;
    const risk=findRiskByKey(comparison,target.key);
    if(!risk)return null;
    const measurement=typeof risk.measurement==='string'&&risk.measurement.trim()?risk.measurement.trim():null;
    const window=parseSectionWindow(risk.key);
    const sectionId=risk.sectionId||null;
    const parts=[];
    if(measurement)parts.push(`mitattu ${measurement}`);
    if(sectionId)parts.push(`osio ${sectionId}`);
    if(window)parts.push(`aikaväli ${window.text}`);
    if(!parts.length)return null;
    return {
      kind:'cheer-competition-master-final-check-priority-context',
      advisoryOnly:true,
      nonDestructive:true,
      key:risk.key,
      label:risk.label||target.label||'Korjauskohde',
      measurement,
      sectionId,
      window,
      text:`Korjauskohteen tiedot: ${risk.label||target.label||'Korjauskohde'} · ${parts.join(' · ')}.`
    };
  }

  function ensureNode(){
    const summaryNode=document.querySelector('#competitionMasterFinalCheckProgressSummary');
    if(!summaryNode)return null;
    let node=document.querySelector('#competitionMasterFinalCheckPriorityContext');
    if(node)return node;
    node=document.createElement('div');
    node.id='competitionMasterFinalCheckPriorityContext';
    node.className='competition-master-final-check-priority-context';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    summaryNode.insertAdjacentElement('afterend',node);
    return node;
  }

  function render(context){
    const node=ensureNode();
    if(!node)return false;
    if(!context){
      node.hidden=true;
      node.textContent='';
      delete node.dataset.priorityRepairKey;
      return false;
    }
    node.hidden=false;
    node.textContent=context.text;
    node.dataset.priorityRepairKey=context.key;
    return true;
  }

  function refresh(){
    const comparison=window.cheerCompetitionMasterFinalCheckHistory?.getLastComparison?.();
    const summarize=window.cheerCompetitionMasterFinalCheckProgressSummary?.summarizeComparison;
    const summary=typeof summarize==='function'?summarize(comparison):null;
    const context=buildPriorityContext(comparison,summary);
    render(context);
    return context;
  }

  function init(){
    window.addEventListener('cheer-competition-master-final-check-refreshed',()=>queueMicrotask(refresh));
    window.cheerCompetitionMasterFinalCheckPriorityContext={parseSectionWindow,findRiskByKey,buildPriorityContext,refresh,render};
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={parseSectionWindow,findRiskByKey,buildPriorityContext};
  if(typeof window!=='undefined'&&typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();