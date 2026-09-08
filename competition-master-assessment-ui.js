(()=>{
  'use strict';

  const q=s=>document.querySelector(s);
  const fmt=(value,digits=1)=>Number.isFinite(Number(value))?Number(value).toFixed(digits):'—';
  const statusLabel=status=>({
    'preview-ready':'Valmis esikatseluun',
    'review-required':'Tarkista ennen kilpailumasteria',
    'blocked':'Ei vielä valmis'
  }[status]||'Ei vielä arvioitu');
  const actionLabel=action=>{
    if(!action)return 'Ei toimenpidesuositusta.';
    const labels={
      'preserve-balanced-mix':'Säilytä nykyinen tasapaino.',
      'peak-headroom':'Lisää turvallista true-peak-headroomia.',
      'restore-dynamics':'Palauta hieman makrodynamiikkaa.',
      'control-dynamics':'Hallitse makrodynamiikkaa kevyesti.',
      'section-balance':'Tasapainota kilpailuosien huipputasoja.',
      'voiceover-hold':'Ratkaise voiceoverin tarkistus ennen masteria.'
    };
    const base=labels[action.id]||action.reason||'Tarkista kilpailumasterin suositus.';
    return Number.isFinite(Number(action.suggestedDb))?`${base} Suositus ${Number(action.suggestedDb).toFixed(1)} dB.`:base;
  };

  function snapshot(){
    const api=window.cheerMixExport;
    if(!api)return null;
    return{
      metrics:api.getLastCompetitionMasterMetrics?.()||null,
      readiness:api.getLastCompetitionMasterReadiness?.()||null,
      preview:api.getLastCompetitionMasterPreview?.()||null
    };
  }

  function ensurePanel(){
    let panel=q('#competitionMasterAssessment');
    if(panel)return panel;
    const exportPanel=q('#mixExport');
    if(!exportPanel)return null;
    panel=document.createElement('section');
    panel.id='competitionMasterAssessment';
    panel.className='competition-master-assessment';
    panel.setAttribute('aria-live','polite');
    panel.innerHTML=`<div class="competition-master-assessment-head"><div><h3>Kilpailumasterin arvio</h3><p>Suomen kilpailukäyttöön tarkoitettu ei-tuhoava tarkistus. Arvio ei normalisoi, kompressoi tai limitöi audiota automaattisesti.</p></div><span id="competitionMasterAssessmentBadge" class="competition-master-assessment-badge">Ei vielä arvioitu</span></div><div class="competition-master-assessment-grid"><div><small>True peak</small><strong id="competitionMasterAssessmentTp">—</strong></div><div><small>Integrated loudness</small><strong id="competitionMasterAssessmentLufs">—</strong></div><div><small>LRA</small><strong id="competitionMasterAssessmentLra">—</strong></div></div><div id="competitionMasterAssessmentAdvice" class="competition-master-assessment-advice">Arvio muodostuu 24-bit WAV -viennin yhteydessä valmiista post-voiceover-miksistä.</div>`;
    exportPanel.insertAdjacentElement('afterend',panel);
    return panel;
  }

  function render(){
    if(!ensurePanel())return;
    const data=snapshot();
    const metrics=data?.metrics,readiness=data?.readiness,preview=data?.preview;
    const status=preview?.status||readiness?.status||'blocked';
    const badge=q('#competitionMasterAssessmentBadge');
    if(badge){badge.textContent=statusLabel(status);badge.dataset.status=status;}
    const tp=q('#competitionMasterAssessmentTp'),lufs=q('#competitionMasterAssessmentLufs'),lra=q('#competitionMasterAssessmentLra');
    if(tp)tp.textContent=metrics?`${fmt(metrics.truePeakDbtp)} dBTP`:'—';
    if(lufs)lufs.textContent=metrics?`${fmt(metrics.integratedLufs)} LUFS`:'—';
    if(lra)lra.textContent=metrics?`${fmt(metrics.loudnessRangeLu)} LU`:'—';
    const advice=q('#competitionMasterAssessmentAdvice');
    if(advice){
      if(!metrics)advice.textContent='Arvio muodostuu 24-bit WAV -viennin yhteydessä valmiista post-voiceover-miksistä.';
      else if(preview?.status==='blocked')advice.textContent=`Kilpailumasterin arvio on estetty: ${preview.reason||readiness?.reason||'puuttuva valmiustieto'}.`;
      else advice.textContent=actionLabel(preview?.topPriority||preview?.actions?.[0]);
    }
  }

  function observeExport(){
    const status=q('#mixExportStatus');
    if(!status)return;
    new MutationObserver(()=>render()).observe(status,{childList:true,subtree:true,characterData:true});
    q('#btnExportWav')?.addEventListener('click',()=>setTimeout(render,0));
  }

  function addStyle(){
    if(q('#competitionMasterAssessmentStyle'))return;
    const style=document.createElement('style');
    style.id='competitionMasterAssessmentStyle';
    style.textContent=`.competition-master-assessment{margin-top:10px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.32)}.competition-master-assessment-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.competition-master-assessment h3{margin:0 0 4px}.competition-master-assessment p{margin:0;opacity:.72;max-width:780px}.competition-master-assessment-badge{white-space:nowrap;padding:5px 9px;border-radius:999px;background:rgba(148,163,184,.12);font-size:.82rem}.competition-master-assessment-badge[data-status="preview-ready"]{background:rgba(34,197,94,.14)}.competition-master-assessment-badge[data-status="review-required"]{background:rgba(245,158,11,.16)}.competition-master-assessment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.competition-master-assessment-grid>div{padding:10px;border-radius:9px;background:rgba(148,163,184,.07)}.competition-master-assessment-grid small{display:block;opacity:.64;margin-bottom:3px}.competition-master-assessment-grid strong{font-size:1.05rem}.competition-master-assessment-advice{margin-top:10px;font-size:.92rem;line-height:1.45}@media(max-width:700px){.competition-master-assessment-head{flex-direction:column}.competition-master-assessment-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function init(){addStyle();ensurePanel();observeExport();render();window.cheerCompetitionMasterAssessment={render,snapshot};}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();