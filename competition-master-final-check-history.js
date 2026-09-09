(()=>{
  'use strict';

  let lastComparison=null;
  const q=s=>document.querySelector(s);
  const array=value=>Array.isArray(value)?value:[];
  const FLAG_LABELS=Object.freeze({
    'final-true-peak-headroom-failed':'True peak / headroom',
    'final-dynamics-check-failed':'Dynamiikka',
    'final-section-balance-failed':'Osioiden tasapaino',
    'final-section-peak-data-incomplete':'Osioiden peak-mittaus puuttuu',
    'final-voiceover-clarity-unmeasured':'Voiceover clarity mittaamatta',
    'final-voiceover-clarity-failed':'Voiceover clarity',
    'final-fx-clarity-unmeasured':'FX clarity mittaamatta',
    'final-fx-clarity-failed':'FX clarity',
    'final-section-clarity-failed':'Osioiden clarity',
    'final-preview-hold-active':'Master-preview hold',
    'final-upstream-review-required':'Aiempi tarkistus vaatii huomiota'
  });

  function formatFlagLabel(flag){
    if(FLAG_LABELS[flag])return FLAG_LABELS[flag];
    return String(flag||'Tuntematon riski')
      .replace(/^final-/,'')
      .replace(/-/g,' ')
      .replace(/^./,c=>c.toUpperCase());
  }

  function formatSectionLabel(issue){
    const section=issue?.label||issue?.sectionId||'Section';
    const kind=issue?.focusKind==='voiceover'?'voiceover':issue?.focusKind==='fx'?'FX':issue?.focusKind||'clarity';
    return `${section} · ${kind}`;
  }

  function sectionRiskKey(issue){
    if(!issue)return null;
    const section=issue.sectionId||issue.label||'section';
    const kind=issue.focusKind||[issue.voiceoverFailed?'voiceover':null,issue.fxFailed?'fx':null].filter(Boolean).join('+')||'clarity';
    const start=Number.isFinite(Number(issue.focusStartSeconds))?Number(issue.focusStartSeconds).toFixed(3):'';
    const end=Number.isFinite(Number(issue.focusEndSeconds))?Number(issue.focusEndSeconds).toFixed(3):'';
    return `section:${section}:${kind}:${start}:${end}`;
  }

  function collectRisks(finalCheck){
    const risks=[];
    for(const flag of array(finalCheck?.riskFlags)){
      if(flag)risks.push({key:`flag:${flag}`,type:'flag',label:formatFlagLabel(flag),rawLabel:String(flag)});
    }
    for(const issue of array(finalCheck?.sectionIssues)){
      const key=sectionRiskKey(issue);
      if(!key)continue;
      const kind=issue.focusKind||'clarity';
      risks.push({key,type:'section',label:formatSectionLabel(issue),sectionId:issue.sectionId||null,kind});
    }
    return risks;
  }

  function compareFinalChecks(previousFinalCheck,nextFinalCheck){
    if(!previousFinalCheck||!nextFinalCheck)return null;
    const before=collectRisks(previousFinalCheck);
    const after=collectRisks(nextFinalCheck);
    const beforeMap=new Map(before.map(item=>[item.key,item]));
    const afterMap=new Map(after.map(item=>[item.key,item]));
    const removed=before.filter(item=>!afterMap.has(item.key));
    const remaining=after.filter(item=>beforeMap.has(item.key));
    const added=after.filter(item=>!beforeMap.has(item.key));
    return {
      kind:'cheer-competition-master-final-check-comparison',
      advisoryOnly:true,
      nonDestructive:true,
      beforeCount:before.length,
      afterCount:after.length,
      removed,
      remaining,
      added,
      improved:removed.length>added.length,
      unchanged:removed.length===0&&added.length===0
    };
  }

  function ensureNode(){
    const host=q('#competitionMasterFinalCheckRefreshStatus')||q('#competitionMasterClarityFinalCheckState')||q('#competitionMasterSectionIssues');
    if(!host)return null;
    let node=q('#competitionMasterFinalCheckHistory');
    if(node)return node;
    node=document.createElement('div');
    node.id='competitionMasterFinalCheckHistory';
    node.className='competition-master-final-check-history';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    host.insertAdjacentElement('afterend',node);
    return node;
  }

  function appendRiskGroup(node,title,items,state){
    if(!items.length)return;
    const group=document.createElement('div');
    group.className='competition-master-final-check-history-group';
    group.dataset.state=state;
    const heading=document.createElement('strong');
    heading.textContent=title;
    group.appendChild(heading);
    const list=document.createElement('ul');
    for(const item of items){
      const li=document.createElement('li');
      li.textContent=item.label;
      list.appendChild(li);
    }
    group.appendChild(list);
    node.appendChild(group);
  }

  function renderComparison(comparison){
    const node=ensureNode();
    if(!node)return false;
    node.replaceChildren();
    if(!comparison){node.hidden=true;return false;}
    node.hidden=false;
    const removed=comparison.removed.length;
    const remaining=comparison.remaining.length;
    const added=comparison.added.length;
    const summary=document.createElement('div');
    summary.className='competition-master-final-check-history-summary';
    summary.textContent=`Final-check vertailu: ${removed} poistui · ${remaining} jäi · ${added} uusi${added===1?'':'a'}.`;
    node.appendChild(summary);
    appendRiskGroup(node,'Poistuneet riskit',comparison.removed,'removed');
    appendRiskGroup(node,'Jäljellä olevat riskit',comparison.remaining,'remaining');
    appendRiskGroup(node,'Uudet riskit',comparison.added,'added');
    node.dataset.improved=comparison.improved?'true':'false';
    node.dataset.unchanged=comparison.unchanged?'true':'false';
    return true;
  }

  function consumeRefresh(detail){
    if(!detail||detail.status!=='refreshed'||detail.source!=='current-project-offline-render'||detail.nonDestructive!==true)return null;
    const comparison=compareFinalChecks(detail.previousFinalCheck,detail.finalCheck);
    if(!comparison)return null;
    lastComparison={...comparison,refreshedAt:detail.refreshedAt||null};
    renderComparison(lastComparison);
    return lastComparison;
  }

  function addStyle(){
    if(q('#competitionMasterFinalCheckHistoryStyle'))return;
    const style=document.createElement('style');
    style.id='competitionMasterFinalCheckHistoryStyle';
    style.textContent='.competition-master-final-check-history{margin:5px 0 2px;font-size:.8rem;opacity:.9}.competition-master-final-check-history[data-improved="true"] .competition-master-final-check-history-summary{font-weight:600}.competition-master-final-check-history-group{margin-top:4px}.competition-master-final-check-history-group strong{font-size:.78rem}.competition-master-final-check-history-group ul{margin:2px 0 0 18px;padding:0}.competition-master-final-check-history-group[data-state="removed"]{opacity:.78}.competition-master-final-check-history-group[data-state="added"]{font-weight:600}';
    document.head.appendChild(style);
  }

  function init(){
    addStyle();
    ensureNode();
    window.addEventListener('cheer-competition-master-final-check-refreshed',event=>consumeRefresh(event?.detail||null));
    window.cheerCompetitionMasterFinalCheckHistory={collectRisks,compareFinalChecks,consumeRefresh,renderComparison,getLastComparison:()=>lastComparison};
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={FLAG_LABELS,formatFlagLabel,formatSectionLabel,collectRisks,compareFinalChecks};
  if(typeof window!=='undefined'&&typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
