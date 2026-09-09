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
  const correctionGuidanceLabel=guidance=>{
    if(!guidance?.advisoryOnly)return '';
    if(guidance.kind==='voiceover')return 'Korjausehdotus: kevennä musiikkia paikallisesti voiceoverin alta. Tarkista sen jälkeen puheen taso ja keskialueen erottelu.';
    if(guidance.kind==='fx')return 'Korjausehdotus: kevennä tai lyhennä peittävää FX:ää. Siirrä sitä tarvittaessa kauemmas kriittisestä huudosta, iskusta tai musiikin pääaksentista.';
    return '';
  };
  const recheckResultLabel=result=>{
    if(!result)return '';
    const before=fmt(result.previousScore,2),after=fmt(result.currentScore,2),limit=fmt(result.minScore,2);
    const delta=Number(result.improvement);
    const change=Number.isFinite(delta)?` (${delta>=0?'+':''}${delta.toFixed(2)})`:'';
    if(result.verdict==='passed')return `${before} → ${after}${change} — hyväksytty, raja ${limit}`;
    if(result.verdict==='improved')return `${before} → ${after}${change} — parani, mutta on vielä alle rajan ${limit}`;
    if(result.verdict==='regressed')return `${before} → ${after}${change} — clarity heikkeni, raja ${limit}`;
    if(result.verdict==='still-below-target')return `${before} → ${after}${change} — edelleen alle rajan ${limit}`;
    if(result.currentScore!==null&&result.currentScore!==undefined)return `${before} → ${after}${change} — mitattu uudelleen`;
    return 'Uudelleenmittaus ei tuottanut käyttökelpoista clarity-arvoa.';
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
    panel.innerHTML=`<div class="competition-master-assessment-head"><div><h3>Kilpailumasterin arvio</h3><p>Suomen kilpailukäyttöön tarkoitettu ei-tuhoava tarkistus. Arvio ei normalisoi, kompressoi tai limitöi audiota automaattisesti.</p></div><span id="competitionMasterAssessmentBadge" class="competition-master-assessment-badge">Ei vielä arvioitu</span></div><div class="competition-master-assessment-grid"><div><small>True peak</small><strong id="competitionMasterAssessmentTp">—</strong></div><div><small>Integrated loudness</small><strong id="competitionMasterAssessmentLufs">—</strong></div><div><small>LRA</small><strong id="competitionMasterAssessmentLra">—</strong></div></div><div id="competitionMasterAssessmentAdvice" class="competition-master-assessment-advice">Arvio muodostuu 24-bit WAV -viennin yhteydessä valmiista post-voiceover-miksistä.</div><div id="competitionMasterSectionIssues" class="competition-master-section-issues" hidden><strong>Osakohtaiset clarity-havainnot</strong><p class="competition-master-section-hint">Avaa havainto siirtyäksesi suoraan heikoimpaan mitattuun voiceover- tai FX-kohtaan aikajanalla. Mittausikkuna korostetaan hetkellisesti ja sen yhteydessä näytetään clarity-score sekä hyväksymisraja. Tee korjaus itse ja valitse sitten Mittaa uudelleen: sovellus renderöi nykyisen projektin tarkistusta varten ja mittaa täsmälleen saman ikkunan uudelleen ilman WAV-vientiä tai automaattista korjausta.</p><ul id="competitionMasterSectionIssueList"></ul></div>`;
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

  async function recheckSectionIssue(issue,button,output){
    const api=window.cheerCompetitionMasterClarityRecheck;
    if(!api?.recheck){
      if(output){output.textContent='Uudelleenmittaus ei ole käytettävissä.';output.dataset.verdict='unavailable';}
      return null;
    }
    if(button){button.disabled=true;button.textContent='Mitataan…';}
    if(output){output.textContent='Renderöidään nykyinen projekti ja mitataan sama clarity-ikkuna uudelleen…';output.dataset.verdict='running';}
    try{
      const result=await api.recheck(issue);
      if(output){output.textContent=recheckResultLabel(result);output.dataset.verdict=result?.verdict||'measured';}
      const start=Number(result?.startSeconds),end=Number(result?.endSeconds);
      if(Number.isFinite(start)&&Number.isFinite(end)&&end>start){
        window.cheerAudioEditor?.highlightRange?.(start,end,{
          kind:result?.focusKind||issue?.focusKind||'clarity',
          score:result?.currentScore,
          minScore:result?.minScore,
          durationMs:6000
        });
      }
      return result;
    }catch(error){
      if(output){output.textContent=`Uudelleenmittaus epäonnistui: ${error?.message||'tuntematon virhe'}`;output.dataset.verdict='error';}
      return null;
    }finally{
      if(button){button.disabled=false;button.textContent='Mittaa uudelleen';}
    }
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
      const hasPreciseFocus=Number.isFinite(focusStart)&&Number.isFinite(focusEnd)&&focusEnd>focusStart&&(issue?.focusKind==='voiceover'||issue?.focusKind==='fx');
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
      const guidanceText=correctionGuidanceLabel(issue?.correctionGuidance);
      if(guidanceText){
        const guidance=document.createElement('div');
        guidance.className='competition-master-section-guidance';
        guidance.textContent=guidanceText;
        guidance.setAttribute('role','note');
        item.appendChild(guidance);
      }
      if(hasPreciseFocus){
        const actions=document.createElement('div');
        actions.className='competition-master-section-recheck';
        const recheckButton=document.createElement('button');
        recheckButton.type='button';
        recheckButton.className='competition-master-recheck-button';
        recheckButton.textContent='Mittaa uudelleen';
        recheckButton.setAttribute('aria-label',`${issue?.label||issue?.type||'Osio'}: mittaa sama ${issue.focusKind==='voiceover'?'voiceover':'FX'} clarity -ikkuna uudelleen nykyisestä miksistä`);
        const output=document.createElement('span');
        output.className='competition-master-recheck-result';
        output.setAttribute('role','status');
        output.setAttribute('aria-live','polite');
        recheckButton.addEventListener('click',()=>recheckSectionIssue(issue,recheckButton,output));
        actions.append(recheckButton,output);
        item.appendChild(actions);
      }
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
      else if(finalCheck?.sectionIssues?.length)advice.textContent='Final-check löysi osakohtaisia clarity-kohtia. Avaa havainto, kuuntele korostettu mittausikkuna, tee paikallinen korjaus ja mittaa sama kohta uudelleen ennen lopullista kilpailumasteria.';
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
    style.textContent=`.competition-master-assessment{margin-top:10px;padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(15,23,42,.32)}.competition-master-assessment-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.competition-master-assessment h3{margin:0 0 4px}.competition-master-assessment p{margin:0;opacity:.72;max-width:780px}.competition-master-assessment-badge{white-space:nowrap;padding:5px 9px;border-radius:999px;background:rgba(148,163,184,.12);font-size:.82rem}.competition-master-assessment-badge[data-status="preview-ready"],.competition-master-assessment-badge[data-status="preview-approved"]{background:rgba(34,197,94,.14)}.competition-master-assessment-badge[data-status="review-required"]{background:rgba(245,158,11,.16)}.competition-master-assessment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.competition-master-assessment-grid>div{padding:10px;border-radius:9px;background:rgba(148,163,184,.07)}.competition-master-assessment-grid small{display:block;opacity:.64;margin-bottom:3px}.competition-master-assessment-grid strong{font-size:1.05rem}.competition-master-assessment-advice{margin-top:10px;font-size:.92rem;line-height:1.45}.competition-master-section-issues{margin-top:12px;padding-top:10px;border-top:1px solid rgba(148,163,184,.14)}.competition-master-section-issues .competition-master-section-hint{margin-top:4px;font-size:.82rem}.competition-master-section-issues ul{margin:7px 0 0;padding-left:20px}.competition-master-section-issues li{margin:7px 0;line-height:1.4}.competition-master-section-jump{appearance:none;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:3px 5px;margin:-3px -5px;border-radius:6px;cursor:pointer}.competition-master-section-jump:hover,.competition-master-section-jump:focus-visible{background:rgba(148,163,184,.12);outline:1px solid rgba(148,163,184,.24)}.competition-master-section-guidance{margin:3px 0 0 5px;font-size:.82rem;line-height:1.4;opacity:.78;max-width:820px}.competition-master-section-recheck{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 0 5px}.competition-master-recheck-button{appearance:none;border:1px solid rgba(148,163,184,.28);background:rgba(148,163,184,.09);color:inherit;border-radius:7px;padding:5px 9px;font:inherit;font-size:.82rem;cursor:pointer}.competition-master-recheck-button:hover,.competition-master-recheck-button:focus-visible{background:rgba(148,163,184,.16);outline:1px solid rgba(148,163,184,.28)}.competition-master-recheck-button:disabled{cursor:progress;opacity:.62}.competition-master-recheck-result{font-size:.82rem;line-height:1.4;opacity:.84}.competition-master-recheck-result[data-verdict="passed"]{font-weight:650}@media(max-width:700px){.competition-master-assessment-head{flex-direction:column}.competition-master-assessment-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function init(){addStyle();ensurePanel();observeExport();render();window.cheerCompetitionMasterAssessment={render,snapshot,sectionIssueLabel,correctionGuidanceLabel,recheckResultLabel,focusSectionIssue,recheckSectionIssue};}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();