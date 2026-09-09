(()=>{
  'use strict';

  const ITEM_SELECTOR='#competitionMasterSectionIssueList li[data-section-id]';
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
  }

  function addStyle(){
    if(document.querySelector('#competitionMasterClarityResolutionStyle'))return;
    const style=document.createElement('style');
    style.id='competitionMasterClarityResolutionStyle';
    style.textContent='.competition-master-section-resolved{opacity:.88}.competition-master-resolution-badge{display:inline-block;margin:5px 0 0 5px;padding:3px 7px;border-radius:999px;background:rgba(34,197,94,.14);font-size:.78rem;font-weight:650}.competition-master-section-resolved .competition-master-section-guidance{display:none}';
    document.head.appendChild(style);
  }

  function init(){
    addStyle();
    refreshAll();
    window.addEventListener('cheer-competition-master-clarity-recheck',onRecheck);
    const list=document.querySelector('#competitionMasterSectionIssueList');
    if(list)new MutationObserver(refreshAll).observe(list,{childList:true,subtree:true});
    window.cheerCompetitionMasterClarityResolutionUI={refreshAll,refreshItem,issueFromItem,applyResolutionToItem,updateFindingLabel};
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
