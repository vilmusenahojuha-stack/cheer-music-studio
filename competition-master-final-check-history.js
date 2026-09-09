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
  const FLAG_GUIDANCE=Object.freeze({
    'final-true-peak-headroom-failed':'Tarkista headroom ja kovimmat transientit ennen uutta final-checkiä.',
    'final-dynamics-check-failed':'Tarkista dynamiikka: vältä liian puristunutta tai epätasaista kokonaisuutta.',
    'final-section-balance-failed':'Tarkista osioiden keskinäiset voimakkuudet ja energiasiirtymät.',
    'final-section-peak-data-incomplete':'Mittaa kaikkien kilpailumixin osioiden peak-arvot uudelleen.',
    'final-voiceover-clarity-unmeasured':'Mittaa voiceover-clarity ennen kilpailumasterin hyväksyntää.',
    'final-voiceover-clarity-failed':'Selkeytä voiceoveria suhteessa musiikkiin ja mittaa sama kohta uudelleen.',
    'final-fx-clarity-unmeasured':'Mittaa FX-clarity ennen kilpailumasterin hyväksyntää.',
    'final-fx-clarity-failed':'Selkeytä cheer-FX:ää suhteessa musiikkiin ja mittaa sama kohta uudelleen.',
    'final-section-clarity-failed':'Tarkista osion voiceover- ja FX-erottuvuus ennen uutta final-checkiä.',
    'final-preview-hold-active':'Kuuntele master-preview ja ratkaise siinä merkitty hold ennen hyväksyntää.',
    'final-upstream-review-required':'Palaa aiempaan tarkistukseen ja ratkaise siellä oleva esto ensin.'
  });
  const RISK_STATE_SUFFIX=Object.freeze({
    removed:'korjattu',
    remaining:'edelleen estää kilpailumasterin',
    added:'uusi riski — tarkista'
  });

  function finite(value){
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }

  function formatNumber(value,digits=2){
    const n=finite(value);
    return n===null?null:n.toFixed(digits);
  }

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

  function getSectionGuidance(issue){
    if(issue?.focusKind==='voiceover')return 'Säädä tämän osion voiceoverin ja musiikin suhdetta, sitten mittaa sama aikajakso uudelleen.';
    if(issue?.focusKind==='fx')return 'Säädä tämän osion cheer-FX:n ja musiikin suhdetta, sitten mittaa sama aikajakso uudelleen.';
    return 'Tarkista tämän osion clarity ja mittaa täsmälleen sama aikajakso uudelleen.';
  }

  function getFlagMeasurement(flag,finalCheck){
    const checks=finalCheck?.checks||{};
    if(flag==='final-true-peak-headroom-failed'){
      const value=formatNumber(checks.truePeak?.valueDbtp,2),limit=formatNumber(checks.truePeak?.limitDbtp,2);
      return value!==null&&limit!==null?`${value} dBTP · raja ≤ ${limit} dBTP`:null;
    }
    if(flag==='final-dynamics-check-failed'){
      const value=formatNumber(checks.loudnessRange?.valueLu,1),min=formatNumber(checks.loudnessRange?.minLu,1),max=formatNumber(checks.loudnessRange?.maxLu,1);
      return value!==null&&min!==null&&max!==null?`${value} LU · tavoite ${min}–${max} LU`:null;
    }
    if(flag==='final-section-balance-failed'){
      const value=formatNumber(checks.sectionBalance?.spreadDb,1),limit=formatNumber(checks.sectionBalance?.maxSpreadDb,1);
      return value!==null&&limit!==null?`${value} dB · raja ≤ ${limit} dB`:null;
    }
    if(flag==='final-voiceover-clarity-failed'){
      const value=formatNumber(checks.voiceoverClarity?.score,2),limit=formatNumber(checks.voiceoverClarity?.minScore,2);
      return value!==null&&limit!==null?`${value} · raja ≥ ${limit}`:null;
    }
    if(flag==='final-fx-clarity-failed'){
      const value=formatNumber(checks.fxClarity?.score,2),limit=formatNumber(checks.fxClarity?.minScore,2);
      return value!==null&&limit!==null?`${value} · raja ≥ ${limit}`:null;
    }
    return null;
  }

  function getSectionMeasurement(issue){
    const score=formatNumber(issue?.focusScore,2),minScore=formatNumber(issue?.focusMinScore,2);
    if(score===null||minScore===null)return null;
    return `${score} · raja ≥ ${minScore}`;
  }

  function formatRiskStatus(item,state){
    const label=item?.label||'Tuntematon riski';
    const suffix=RISK_STATE_SUFFIX[state]||'tila muuttui';
    const active=state==='remaining'||state==='added';
    const measurement=active&&item?.measurement?` · mitattu ${item.measurement}`:'';
    const guidance=active?item?.guidance:null;
    return `${label} — ${suffix}${measurement}${guidance?` → ${guidance}`:''}`;
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
      if(flag)risks.push({key:`flag:${flag}`,type:'flag',label:formatFlagLabel(flag),guidance:FLAG_GUIDANCE[flag]||'Tarkista tämä final-check-riski ennen kilpailumasterin hyväksyntää.',measurement:getFlagMeasurement(flag,finalCheck),rawLabel:String(flag)});
    }
    for(const issue of array(finalCheck?.sectionIssues)){
      const key=sectionRiskKey(issue);
      if(!key)continue;
      const kind=issue.focusKind||'clarity';
      risks.push({key,type:'section',label:formatSectionLabel(issue),guidance:getSectionGuidance(issue),measurement:getSectionMeasurement(issue),sectionId:issue.sectionId||null,kind});
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
      li.textContent=formatRiskStatus(item,state);
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
    style.textContent='.competition-master-final-check-history{margin:5px 0 2px;font-size:.8rem;opacity:.9}.competition-master-final-check-history[data-improved="true"] .competition-master-final-check-history-summary{font-weight:600}.competition-master-final-check-history-group{margin-top:4px}.competition-master-final-check-history-group strong{font-size:.78rem}.competition-master-final-check-history-group ul{margin:2px 0 0 18px;padding:0}.competition-master-final-check-history-group[data-state="removed"]{opacity:.78}.competition-master-final-check-history-group[data-state="remaining"]{font-weight:600}.competition-master-final-check-history-group[data-state="added"]{font-weight:600}';
    document.head.appendChild(style);
  }

  function init(){
    addStyle();
    ensureNode();
    window.addEventListener('cheer-competition-master-final-check-refreshed',event=>consumeRefresh(event?.detail||null));
    window.cheerCompetitionMasterFinalCheckHistory={collectRisks,compareFinalChecks,formatRiskStatus,consumeRefresh,renderComparison,getLastComparison:()=>lastComparison};
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={FLAG_LABELS,FLAG_GUIDANCE,RISK_STATE_SUFFIX,formatFlagLabel,formatSectionLabel,getSectionGuidance,getFlagMeasurement,getSectionMeasurement,formatRiskStatus,collectRisks,compareFinalChecks};
  if(typeof window!=='undefined'&&typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
