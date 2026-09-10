(()=>{
  'use strict';

  function pct(value){
    const n=Number(value);
    return Number.isFinite(n)?`${Math.round(Math.max(0,Math.min(1,n))*100)} %`:'–';
  }

  function supportText(value){
    const n=Number(value);
    if(!Number.isFinite(n)||n<=0)return 'ei varmoja ankkureita';
    return `${Math.round(n)} ${Math.round(n)===1?'ankkuri':'ankkuria'}`;
  }

  function rowDetail(track){
    const base=`${pct(track?.confidence)} · ${supportText(track?.support)}`;
    if(track?.level==='strong')return `${base} · automaattinen kohdistus käytettävissä`;
    if(track?.level==='review')return `${base} · tarkista 1-lasku ennen Smart Mixiä`;
    return `${base} · manuaalinen 1-lasku säilyy`;
  }

  function buildViewModel(profiles=[],summaryCore){
    if(typeof summaryCore?.summarizeProfiles!=='function')return null;
    const summary=summaryCore.summarizeProfiles(profiles);
    return {summary,status:summaryCore.statusText(summary),rows:summary.tracks.map(track=>({...track,title:summaryCore.trackStatusText(track),detail:rowDetail(track)}))};
  }

  function ensurePanel(){
    if(typeof document==='undefined')return null;
    const smartMixPanel=document.querySelector('#intelligentMixPanel');
    if(!smartMixPanel)return null;
    let panel=document.querySelector('#smartMixEightAlignmentPanel');
    if(panel)return panel;
    panel=document.createElement('section');panel.id='smartMixEightAlignmentPanel';panel.className='im-card';panel.setAttribute('aria-live','polite');
    const heading=document.createElement('div');heading.className='im-card-head';
    const title=document.createElement('strong');title.textContent='8-count-kohdistus';
    const button=document.createElement('button');button.id='btnCheckSmartMixEightAlignment';button.type='button';button.className='mini-btn';button.textContent='Tarkista 8-countit';
    heading.append(title,button);
    const status=document.createElement('div');status.id='smartMixEightAlignmentStatus';status.className='im-empty';status.textContent='Tarkista kappaleiden 1-laskun luotettavuus ennen Smart Mix -ehdotusta.';
    const list=document.createElement('div');list.id='smartMixEightAlignmentList';list.className='im-list';
    panel.append(heading,status,list);
    const anchor=document.querySelector('#smartMix2Status')||document.querySelector('#intelligentMixResults');
    if(anchor)anchor.insertAdjacentElement('afterend',panel);else smartMixPanel.appendChild(panel);
    button.addEventListener('click',runCheck);
    return panel;
  }

  function renderView(view){
    ensurePanel();
    const status=document.querySelector('#smartMixEightAlignmentStatus');
    const list=document.querySelector('#smartMixEightAlignmentList');
    if(!status||!list)return false;
    list.replaceChildren();
    if(!view){status.textContent='8-count-kohdistuksen yhteenvetoydin ei ole käytettävissä.';return false;}
    status.textContent=view.status;
    for(const row of view.rows){
      const item=document.createElement('div');item.className=`im-row smart-mix-alignment-${row.level}`;item.dataset.alignmentLevel=row.level;
      const title=document.createElement('strong');title.textContent=row.title;
      const detail=document.createElement('span');detail.textContent=row.detail;
      item.append(title,detail);list.appendChild(item);
    }
    return true;
  }

  function renderReadinessIssues(){
    ensurePanel();
    const status=document.querySelector('#smartMixEightAlignmentStatus');
    const list=document.querySelector('#smartMixEightAlignmentList');
    if(!status||!list)return false;
    list.replaceChildren();
    status.textContent='8-count-kohdistusta ei voitu tarkistaa: lisää jokaiselle kappaleelle BPM ja 1-lasku.';
    return false;
  }

  async function runCheck(){
    const button=document.querySelector('#btnCheckSmartMixEightAlignment');
    const workflow=window.CheerSmartMixWorkflow;
    const summaryCore=window.SmartMixAlignmentSummaryCore;
    const project=typeof state!=='undefined'?state:null;
    if(!project||!workflow?.validateTrackReadiness||!workflow?.analyzeReadyTracks){renderView(null);return null;}
    const readiness=workflow.validateTrackReadiness(project);
    if(!readiness.ok){renderReadinessIssues();return null;}
    if(button){button.disabled=true;button.textContent='Analysoidaan…';}
    try{
      const profiles=await workflow.analyzeReadyTracks(project,readiness.ready,progress=>{if(button&&progress?.phase==='profile')button.textContent=`Analysoidaan ${progress.done}/${progress.total}`;});
      const view=buildViewModel(profiles,summaryCore);renderView(view);return view;
    }catch(error){
      console.error(error);
      const status=document.querySelector('#smartMixEightAlignmentStatus');
      if(status)status.textContent=`8-count-kohdistuksen tarkistus epäonnistui: ${error?.message||error}`;
      return null;
    }finally{if(button){button.disabled=false;button.textContent='Tarkista 8-countit';}}
  }

  function init(){
    if(ensurePanel())return;
    const observer=new MutationObserver(()=>{if(ensurePanel())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  const api={pct,supportText,rowDetail,buildViewModel,renderView,runCheck};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixAlignmentUi=api;
  if(typeof document!=='undefined')(document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init());
})();