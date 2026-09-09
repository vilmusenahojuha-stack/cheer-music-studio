(()=>{
  'use strict';

  const q=s=>document.querySelector(s);
  const fmt=(value,digits=1)=>Number.isFinite(Number(value))?Number(value).toFixed(digits):'—';
  const statusLabel=status=>({
    'preview-ready':'Valmis esikatseluun',
    'preview-approved':'Final-check hyväksytty',
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
  const sectionIssueLabel=issue=>{
    const label=issue?.label||issue?.type||issue?.sectionId||'Osio';
    const details=[];
    if(issue?.voiceoverFailed)details.push(`voiceover clarity ${fmt(issue.voiceoverScore,2)} — tarkistettava`);
    if(issue?.fxFailed)details.push(`FX clarity ${fmt(issue.fxScore,2)} — tarkistettava`);
    if(!details.length)details.push('clarity tarkistettava');
    return `${label} – ${details.join(' · ')}`;
  };

  function snapshot(){
    const api=window.cheerMixExport;
    if(!api)return null;
    return{
      metrics:api.getLastCompetitionMasterMetrics?.()||null,
      readiness:api.getLastCompetitionMasterReadiness?.()||null,
      preview:api.getLastCompetitionMasterPreview?.()||null,
      finalCheck:api.getLastCompetitionMasterFinalCheck?.()||null
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
    panel.innerHTML=`<div class="competition-master-assessment-head"><div><h3>Kilpailumasterin arvio</h3><p>Suomen kilpailukäyttöön tarkoitettu ei-tuhoava tarkistus. Arvio ei normalisoi, kompressoi tai limitöi audiota automaattisesti.</p></div><span id="competitionMasterAssessmentBadge" class="competition-master-assessment-badge">Ei vielä arvioitu</span></div><div class="competition-master-assessment-grid"><div><small>True peak</small><strong id="competitionMasterAssessmentTp">—</strong></div><div><small>Integrated loudness</small><strong id="competitionMasterAssessmentLufs">—</strong></div><div><small>LRA</small><strong id="competitionMasterAssessmentLra">—</strong></div></div><div id="competitionMasterAssessmentAdvice" class="competition-master-assessment-advice">Arvio muodostuu 24-bit WAV -viennin yhteydessä valmiista post-voiceover-miksistä.</div><div id="competitionMasterSectionIssues" class="competition-master-section-issues" hidden><strong>Osakohtaiset clarity-havainnot</strong><p class="competition-master-section-hint">Avaa havainto siirtyäksesi suoraan heikoimpaan mitattuun voiceover- tai FX-kohtaan aikajanalla. Mittausikkuna korostetaan hetkellisesti ja sen yhteydessä näytetään clarity-score sekä hyväksymisraja.</p><ul id="competitionMasterSectionIssueList"></ul></div>`;
    exportPanel.insertAdjacentElement('afterend',panel);
    return panel;
  }

  function focusSectionIssue(issue){
    const focusSeconds=Number.isFinite(Number(issue?.focusStartSeconds))?Number(issue.focusStartSeconds):Number(issue?.startSeconds);
    if(!Number.isFinite(focusSeconds))return false;
    const editor=window.cheerAudioEditor;
    if(!editor?.seek&&!editor?.setPlayhead)return false;
    q('#audioWorkspace')?.scrollIntoView?.({behavior:'smooth',block:'start'});
    if(editor.seek)editor.seek(focusSeconds,true);
    else editor.setPlayhead(focusSeconds,true);
    const focusEnd=Number(issue?.focusEndSeconds);
    if(Number.isFinite(focusEnd)&&focusEnd>focusSeconds){
      editor.highlightRange?.(focusSeconds,focusEnd,{
        kind:issue?.focusKind||'clarity',
        score:issue?.focusScore,
        minScore:issue?.focusMinScore,
        durationMs:6000
      });
    }
    return true;
  }

  function renderSectionIssues(finalCheck){
    const box=q('#competitionMasterSectionIssues'),list=q('#competitionMasterSectionIssueList');
    if(!box||!list)return;
    const issues=Array.isArray(finalCheck?.sectionIssues)?finalCheck.sectionIssues:[];
    list.replaceChildren();
    if(!issues.length){box.hidden=true;return;}
    issues.forEach(issue=>{
      const item=document.createElement('li');
      if(issue?.sectionId)item.dataset.sectionId=issue.sectionId;
      const sectionStart=Number(issue?.startSeconds);
      const focusStart=Number.isFinite(Number(issue?.focusStartSeconds))?Number(issue.focusStartSeconds):sectionStart;
      const focusEnd=Number(issue?.focusEndSeconds);
      if(Number.isFinite(sectionStart))item.dataset.startSeconds=String(sectionStart);
      if(Number.isFinite(focusStart)){
        item.dataset.focusSeconds=String(focusStart);
        if(Number.isFinite(focusEnd)&&focusEnd>focusStart)item.dataset.focusEndSeconds=String(focusEnd);
        if(issue?.focusKind)item.dataset.focusKind=issue.focusKind;
        if(Number.isFinite(Number(issue?.focusScore)))item.dataset.focusScore=String(Number(issue.focusScore));
        if(Number.isFinite(Number(issue?.focusMinScore)))item.dataset.focusMinScore=String(Number(issue.focusMinScore));
        const button=document.createElement('button');
        button.type='button';
        button.className='competition-master-section-jump';
        button.textContent=sectionIssueLabel(issue);
        const focusKind=issue?.focusKind==='voiceover'?'voiceover-kohtaan':issue?.focusKind==='fx'?'FX-kohtaan':'clarity-kohtaan';
        button.setAttribute('aria-label',`${sectionIssueLabel(issue)}. Siirry heikoimpaan ${focusKind} aikajanalla ja näytä mittausikkunan clarity-score sekä hyväksymisraja.`);
        button.addEventListener('click',()=>focusSectionIssue(issue));
        item.appendChild(button);
      }else item.textContent=sectionIssueLabel(issue);
      list.appendChild(item);
    });
    box.hidden=false;
  }

  function render(){
    if(!ensurePanel())return;
    const data=snapshot();
    const metrics=data?.metrics,readiness=data?.readiness,preview=data?.preview,finalCheck=data?.finalCheck;
    const status=finalCheck?.status||preview?.status||readiness?.status||'blocked';
    const badge=q('#competitionMasterAssessmentBadge');
    if(badge){badge.textContent=statusLabel(status);badge.dataset.status=status;}
    const tp=q('#competitionMasterAssessmentTp'),lufs=q('#competitionMasterAssessmentLufs'),lra=q('#competitionMasterAssessmentLra');
    if(tp)tp.textContent=metrics?`${fmt(metrics.truePeakDbtp)} dBTP`:'—';
    if(lufs)lufs.textContent=metrics?`${fmt(metrics.integratedLufs)} LUFS`:'—';
    if(lra)lra.textContent=metrics?`${fmt(metrics.loudnessRangeLu)} LU`:'—';
    const advice=q('#competitionMasterAssessmentAdvice');
    if(advice){
      if(!metrics)advice.textContent='Arvio muodostuu 24-bit WAV -viennin yhteydessä valmiista post-voiceover-miksistä.';
      else if(finalCheck?.status==='preview-approved')advice.textContent='Final-check ei löytänyt kilpailumasteria estäviä riskejä. Arvio on edelleen ei-tuhoava eikä käynnistä masterointia automaattisesti.';
      else if(finalCheck?.sectionIssues?.length)advice.textContent='Final-check löysi osakohtaisia clarity-kohtia, jotka kannattaa korjata ennen lopullista kilpailumasteria.';
      else if(preview?.status==='blocked')advice.textContent=`Kilpailumasterin arvio on estetty: ${preview.reason||readiness?.reason||'puuttuva valmiustieto'}.`;
      else advice.textContent=actionLabel(preview?.topPriority||preview?.actions?.[0]);
    }
    renderSectionIssues(finalCheck);
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
    style.textContent=`.competition-master-assessment{margin-top:10px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.32)}.competition-master-assessment-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.competition-master-assessment h3{margin:0 0 4px}.competition-master-assessment p{margin:0;opacity:.72;max-width:780px}.competition-master-assessment-badge{white-space:nowrap;padding:5px 9px;border-radius:999px;background:rgba(148,163,184,.12);font-size:.82rem}.competition-master-assessment-badge[data-status="preview-ready"],.competition-master-assessment-badge[data-status="preview-approved"]{background:rgba(34,197,94,.14)}.competition-master-assessment-badge[data-status="review-required"]{background:rgba(245,158,11,.16)}.competition-master-assessment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.competition-master-assessment-grid>div{padding:10px;border-radius:9px;background:rgba(148,163,184,.07)}.competition-master-assessment-grid small{display:block;opacity:.64;margin-bottom:3px}.competition-master-assessment-grid strong{font-size:1.05rem}.competition-master-assessment-advice{margin-top:10px;font-size:.92rem;line-height:1.45}.competition-master-section-issues{margin-top:12px;padding-top:10px;border-top:1px solid rgba(148,163,184,.14)}.competition-master-section-issues .competition-master-section-hint{margin-top:4px;font-size:.82rem}.competition-master-section-issues ul{margin:7px 0 0;padding-left:20px}.competition-master-section-issues li{margin:4px 0;line-height:1.4}.competition-master-section-jump{appearance:none;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:3px 5px;margin:-3px -5px;border-radius:6px;cursor:pointer}.competition-master-section-jump:hover,.competition-master-section-jump:focus-visible{background:rgba(148,163,184,.12);outline:1px solid rgba(148,163,184,.24)}@media(max-width:700px){.competition-master-assessment-head{flex-direction:column}.competition-master-assessment-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function init(){addStyle();ensurePanel();observeExport();render();window.cheerCompetitionMasterAssessment={render,snapshot,sectionIssueLabel,focusSectionIssue};}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();