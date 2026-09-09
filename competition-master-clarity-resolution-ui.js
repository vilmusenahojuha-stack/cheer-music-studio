(()=>{
  'use strict';

  const ITEM_SELECTOR='#competitionMasterSectionIssueList li[data-section-id]';
  const FINAL_BLOCKING_RISKS=Object.freeze([
    'final-true-peak-headroom-failed',
    'final-dynamics-check-failed',
    'final-section-balance-failed',
    'final-section-peak-data-incomplete',
    'final-voiceover-clarity-unmeasured',
    'final-voiceover-clarity-failed',
    'final-fx-clarity-unmeasured',
    'final-fx-clarity-failed',
    'final-section-clarity-failed',
    'final-preview-hold-active',
    'final-upstream-review-required'
  ]);
  const RECHECK_CLEARABLE_CLARITY_RISKS=Object.freeze([
    'final-voiceover-clarity-failed',
    'final-fx-clarity-failed',
    'final-section-clarity-failed'
  ]);
  const UNMEASURED_CLARITY_RISKS=Object.freeze([
    'final-voiceover-clarity-unmeasured',
    'final-fx-clarity-unmeasured'
  ]);
  const finite=value=>Number.isFinite(Number(value))?Number(value):null;
  const formatScore=value=>{
    const n=finite(value);
    return n===null?'—':n.toFixed(2);
  };

  function issueFromItem(item){
    if(!item)return null;
    const sectionId=String(item.dataset.sectionId||'').trim();
    const focusKind=item.dataset.focusKind==='voiceover'||item.dataset.focusKind==='fx'?item.dataset.focusKind:null;
    const focusStartSeconds=finite(item.dataset.focusSeconds);
    const focusEndSeconds=finite(item.dataset.focusEndSeconds);
    const focusMinScore=finite(item.dataset.focusMinScore);
    if(!sectionId||!focusKind||focusStartSeconds===null||focusEndSeconds===null||focusEndSeconds<=focusStartSeconds)return null;
    return{sectionId,focusKind,focusStartSeconds,focusEndSeconds,focusMinScore};
  }

  function resolvedSegment(kind,score){
    const label=kind==='voiceover'?'voiceover clarity':'FX clarity';
    return `${label} ${formatScore(score)} — tarkistettu, hyväksytty`;
  }

  function updateFindingLabel(item,resolution){
    const button=item?.querySelector?.('.competition-master-section-jump');
    if(!button)return;
    if(!button.dataset.originalLabel)button.dataset.originalLabel=button.textContent||'';
    const original=button.dataset.originalLabel;
    if(!resolution?.resolved){
      button.textContent=original;
      return;
    }
    const kind=resolution.focusKind;
    const prefix=kind==='voiceover'?'voiceover clarity':'FX clarity';
    const parts=original.split(' · ');
    const replacement=resolvedSegment(kind,resolution.currentScore);
    button.textContent=parts.map(part=>part.includes(prefix)?replacement:part).join(' · ');
  }

  function riskCountForItem(item){
    if(!item)return 0;
    const button=item.querySelector?.('.competition-master-section-jump');
    const label=String(button?.dataset?.originalLabel||button?.textContent||item.textContent||'');
    let count=0;
    if(label.includes('voiceover clarity'))count++;
    if(label.includes('FX clarity'))count++;
    if(!count&&label.includes('clarity tarkistettava'))count=1;
    return count;
  }

  function resolutionCounts(){
    const items=[...document.querySelectorAll(ITEM_SELECTOR)];
    let total=0,resolved=0;
    items.forEach(item=>{
      const risks=riskCountForItem(item);
      total+=risks;
      if(risks>0&&item.dataset.resolution==='resolved')resolved+=1;
    });
    return{total,resolved,open:Math.max(0,total-resolved)};
  }

  function currentFinalCheck(){
    return window.cheerMixExport?.getLastCompetitionMasterFinalCheck?.()||null;
  }

  function clarityGateState(finalCheck=currentFinalCheck(),counts=resolutionCounts()){
    const riskFlags=Array.isArray(finalCheck?.riskFlags)?finalCheck.riskFlags:[];
    const finalBlockingRisks=FINAL_BLOCKING_RISKS.filter(risk=>riskFlags.includes(risk));
    const unmeasuredClarityRisks=UNMEASURED_CLARITY_RISKS.filter(risk=>finalBlockingRisks.includes(risk));
    const allMeasuredSectionRisksResolved=counts.total>0&&counts.open===0;
    const clarityReady=allMeasuredSectionRisksResolved&&unmeasuredClarityRisks.length===0;
    const effectiveBlockingRisks=finalBlockingRisks.filter(risk=>!(clarityReady&&RECHECK_CLEARABLE_CLARITY_RISKS.includes(risk)));
    const otherBlockingRisks=effectiveBlockingRisks.filter(risk=>!RECHECK_CLEARABLE_CLARITY_RISKS.includes(risk)&&!UNMEASURED_CLARITY_RISKS.includes(risk));
    return{
      clarityReady,
      allMeasuredSectionRisksResolved,
      unmeasuredClarityRisks,
      otherBlockingRisks,
      effectiveBlockingRisks,
      finalReadyAfterClarityRecheck:clarityReady&&effectiveBlockingRisks.length===0
    };
  }

  function ensureSummary(){
    const box=document.querySelector('#competitionMasterSectionIssues');
    const list=document.querySelector('#competitionMasterSectionIssueList');
    if(!box||!list)return null;
    let summary=document.querySelector('#competitionMasterClarityResolutionSummary');
    if(summary)return summary;
    summary=document.createElement('div');
    summary.id='competitionMasterClarityResolutionSummary';
    summary.className='competition-master-clarity-resolution-summary';
    summary.setAttribute('role','status');
    summary.setAttribute('aria-live','polite');
    list.insertAdjacentElement('beforebegin',summary);
    return summary;
  }

  function ensureFinalCheckState(){
    const list=document.querySelector('#competitionMasterSectionIssueList');
    if(!list)return null;
    let state=document.querySelector('#competitionMasterClarityFinalCheckState');
    if(state)return state;
    state=document.createElement('div');
    state.id='competitionMasterClarityFinalCheckState';
    state.className='competition-master-clarity-final-check-state';
    state.setAttribute('role','status');
    state.setAttribute('aria-live','polite');
    list.insertAdjacentElement('beforebegin',state);
    return state;
  }

  function updateFinalCheckState(counts=resolutionCounts()){
    const node=ensureFinalCheckState();
    if(!node)return null;
    const gate=clarityGateState(currentFinalCheck(),counts);
    node.hidden=counts.total===0;
    node.dataset.clarityReady=String(gate.clarityReady);
    node.dataset.finalReadyAfterClarityRecheck=String(gate.finalReadyAfterClarityRecheck);
    node.dataset.otherBlockers=String(gate.otherBlockingRisks.length);
    if(counts.total===0){node.textContent='';return gate;}
    if(counts.open>0){
      node.textContent=`Clarity-final-check odottaa ${counts.open} avoimen riskin hyväksyttyä uudelleenmittausta.`;
    }else if(gate.unmeasuredClarityRisks.length){
      node.textContent='Tarkat clarity-riskit on hyväksytty, mutta puuttuva clarity-mittaus estää final-checkin.';
    }else if(gate.otherBlockingRisks.length){
      node.textContent=`Clarity tarkistettu – ${gate.otherBlockingRisks.length} muuta final-check-estettä jäljellä.`;
    }else{
      node.textContent='Clarity tarkistettu – clarity-osuus on puhdas ja final-check voidaan arvioida uudelleen.';
    }
    node.setAttribute('aria-label',`${node.textContent} Tämä johdettu tila ei muuta finalCheck.status-arvoa eikä käynnistä kilpailumasteria.`);
    return gate;
  }

  function updateSummary(){
    const summary=ensureSummary();
    if(!summary)return null;
    const counts=resolutionCounts();
    summary.hidden=counts.total===0;
    summary.textContent=counts.total?`${counts.open} avoinna · ${counts.resolved} tarkistettu`:'';
    summary.dataset.open=String(counts.open);
    summary.dataset.resolved=String(counts.resolved);
    summary.dataset.total=String(counts.total);
    summary.setAttribute('aria-label',`Clarity-riskit: ${counts.open} avoinna, ${counts.resolved} tarkistettu. Laskuri ei muuta kilpailumasterin final-check-hyväksyntää.`);
    updateFinalCheckState(counts);
    return counts;
  }

  function applyResolutionToItem(item,resolution){
    if(!item)return false;
    const resolved=resolution?.resolved===true;
    item.dataset.resolution=resolved?'resolved':'open';
    item.classList.toggle('competition-master-section-resolved',resolved);
    updateFindingLabel(item,resolution);

    let badge=item.querySelector('.competition-master-resolution-badge');
    if(resolved){
      if(!badge){
        badge=document.createElement('span');
        badge.className='competition-master-resolution-badge';
        badge.setAttribute('role','status');
        item.appendChild(badge);
      }
      badge.textContent='Tarkistettu – hyväksytty';
      const kind=resolution.focusKind==='voiceover'?'voiceover':'FX';
      badge.setAttribute('aria-label',`${kind}-clarity on mitattu uudelleen samasta ikkunasta ja hyväksytty`);
    }else{
      badge?.remove();
    }
    return resolved;
  }

  function refreshItem(item){
    const api=window.cheerCompetitionMasterClarityRecheck;
    const issue=issueFromItem(item);
    if(!api?.getResolution||!issue)return false;
    const resolution=api.getResolution(issue);
    if(resolution?.resolved)return applyResolutionToItem(item,resolution);
    if(item.dataset.resolution==='resolved')applyResolutionToItem(item,{resolved:false});
    return false;
  }

  function refreshAll(){
    document.querySelectorAll(ITEM_SELECTOR).forEach(refreshItem);
    updateSummary();
  }

  function onRecheck(event){
    const resolution=event?.detail?.resolution;
    if(!resolution)return;
    document.querySelectorAll(ITEM_SELECTOR).forEach(item=>{
      const issue=issueFromItem(item);
      const api=window.cheerCompetitionMasterClarityRecheck;
      if(!issue||!api?.focusKey)return;
      if(api.focusKey(issue)!==resolution.key)return;
      applyResolutionToItem(item,resolution);
    });
    updateSummary();
  }

  function addStyle(){
    if(document.querySelector('#competitionMasterClarityResolutionStyle'))return;
    const style=document.createElement('style');
    style.id='competitionMasterClarityResolutionStyle';
    style.textContent='.competition-master-section-resolved{opacity:.88}.competition-master-resolution-badge{display:inline-block;margin:5px 0 0 5px;padding:3px 7px;border-radius:999px;background:rgba(34,197,94,.14);font-size:.78rem;font-weight:650}.competition-master-section-resolved .competition-master-section-guidance{display:none}.competition-master-clarity-resolution-summary{display:inline-block;margin:8px 0 2px;padding:4px 8px;border-radius:999px;background:rgba(148,163,184,.12);font-size:.8rem;font-weight:650}.competition-master-clarity-resolution-summary[data-open="0"]{background:rgba(34,197,94,.14)}.competition-master-clarity-final-check-state{margin:6px 0 2px;font-size:.8rem;opacity:.82}.competition-master-clarity-final-check-state[data-clarity-ready="true"]{font-weight:650}';
    document.head.appendChild(style);
  }

  function init(){
    addStyle();
    refreshAll();
    window.addEventListener('cheer-competition-master-clarity-recheck',onRecheck);
    const list=document.querySelector('#competitionMasterSectionIssueList');
    if(list)new MutationObserver(refreshAll).observe(list,{childList:true,subtree:true});
    window.cheerCompetitionMasterClarityResolutionUI={refreshAll,refreshItem,issueFromItem,applyResolutionToItem,riskCountForItem,resolutionCounts,clarityGateState,updateSummary,updateFinalCheckState,updateFindingLabel};
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
