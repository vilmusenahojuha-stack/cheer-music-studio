(()=>{
  'use strict';

  let running=false,lastResult=null;
  const q=s=>document.querySelector(s);

  function currentGate(){
    const ui=window.cheerCompetitionMasterClarityResolutionUI;
    if(!ui?.clarityGateState||!ui?.resolutionCounts)return null;
    return ui.clarityGateState(window.cheerMixExport?.getLastCompetitionMasterFinalCheck?.()||null,ui.resolutionCounts());
  }

  function ensureStatus(){
    const host=q('#competitionMasterClarityFinalCheckState')||q('#competitionMasterSectionIssues');
    if(!host)return null;
    let node=q('#competitionMasterFinalCheckRefreshStatus');
    if(node)return node;
    node=document.createElement('div');
    node.id='competitionMasterFinalCheckRefreshStatus';
    node.className='competition-master-final-check-refresh-status';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    host.insertAdjacentElement('afterend',node);
    return node;
  }

  function ensureButton(){
    const host=q('#competitionMasterClarityFinalCheckState')||q('#competitionMasterSectionIssues');
    if(!host)return null;
    let button=q('#competitionMasterFinalCheckRefresh');
    if(button)return button;
    button=document.createElement('button');
    button.id='competitionMasterFinalCheckRefresh';
    button.type='button';
    button.className='btn competition-master-final-check-refresh';
    button.textContent='Arvioi final-check uudelleen';
    button.hidden=true;
    host.insertAdjacentElement('afterend',button);
    button.addEventListener('click',()=>refresh().catch(err=>{
      const status=ensureStatus();
      if(status)status.textContent=`Final-checkin uudelleenarviointi epäonnistui: ${err?.message||err}`;
    }));
    return button;
  }

  function refreshButtonState(){
    const button=ensureButton();
    if(!button)return null;
    const gate=currentGate();
    button.hidden=!gate?.clarityReady;
    button.disabled=running||!gate?.clarityReady;
    button.setAttribute('aria-label',gate?.clarityReady?'Renderöi nykyinen projekti ei-tuhoavasti ja rakenna kilpailumasterin final-check uudelleen tuoreista mittauksista.':'Final-check voidaan arvioida uudelleen vasta, kun kaikki mitatut clarity-riskit on hyväksytysti tarkistettu.');
    return gate;
  }

  async function refresh(){
    if(running)throw new Error('Final-checkin uudelleenarviointi on jo käynnissä.');
    const gate=currentGate();
    if(!gate?.clarityReady)throw new Error('Clarity-portti ei ole vielä puhdas.');
    if(!window.state)throw new Error('Projektin tila ei ole käytettävissä.');
    const renderer=window.CheerOfflineRenderer;
    const mix=window.cheerMixExport;
    if(!renderer?.renderProject)throw new Error('Offline-renderöinti ei ole käytettävissä.');
    if(!mix?.measureCompetitionMaster||!mix?.measureCompetitionClarity||!mix?.evaluateCompetitionMasterReadiness)throw new Error('Kilpailumasterin mittausketju ei ole käytettävissä.');

    const previousFinalCheck=mix.getLastCompetitionMasterFinalCheck?.()||null;
    running=true;
    refreshButtonState();
    const status=ensureStatus();
    if(status)status.textContent='Renderöidään nykyinen projekti ja arvioidaan final-check uudelleen…';
    try{
      const rendered=await renderer.renderProject(window.state,()=>{});
      const competition=mix.measureCompetitionMaster(rendered);
      if(!competition?.metrics)throw new Error('Kilpailumasterin tuoreita metriikoita ei voitu muodostaa.');
      competition.metrics=mix.measureCompetitionClarity(rendered,competition.metrics);
      const readiness=mix.evaluateCompetitionMasterReadiness(competition.metrics);
      const finalCheck=readiness?.finalCheck||mix.getLastCompetitionMasterFinalCheck?.()||null;
      if(!finalCheck)throw new Error('Final-checkiä ei voitu muodostaa tuoreista mittauksista.');

      lastResult={
        status:'refreshed',
        source:'current-project-offline-render',
        nonDestructive:true,
        refreshedAt:new Date().toISOString(),
        previousFinalCheck,
        metrics:competition.metrics,
        clarity:mix.getLastCompetitionMasterClarity?.()||null,
        readiness:readiness?.readiness||null,
        preview:readiness?.preview||null,
        finalCheck
      };
      if(status)status.textContent=`Final-check arvioitu uudelleen tuoreesta renderistä: ${finalCheck.status||'valmis'}.`;
      window.dispatchEvent?.(new CustomEvent('cheer-competition-master-final-check-refreshed',{detail:lastResult}));
      return lastResult;
    }finally{
      running=false;
      refreshButtonState();
    }
  }

  function addStyle(){
    if(q('#competitionMasterFinalCheckRefreshStyle'))return;
    const style=document.createElement('style');
    style.id='competitionMasterFinalCheckRefreshStyle';
    style.textContent='.competition-master-final-check-refresh{margin:8px 0 2px}.competition-master-final-check-refresh-status{margin:5px 0 2px;font-size:.8rem;opacity:.82}';
    document.head.appendChild(style);
  }

  function init(){
    addStyle();
    ensureButton();
    ensureStatus();
    refreshButtonState();
    window.addEventListener('cheer-competition-master-clarity-recheck',refreshButtonState);
    const list=q('#competitionMasterSectionIssueList');
    if(list)new MutationObserver(refreshButtonState).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['data-resolution']});
    window.cheerCompetitionMasterFinalCheckRefresh={refresh,currentGate,refreshButtonState,getLastResult:()=>lastResult,isRunning:()=>running};
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
