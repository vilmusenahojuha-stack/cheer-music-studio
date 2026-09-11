(()=>{
  'use strict';

  const q=s=>typeof document!=='undefined'?document.querySelector(s):null;
  const finite=(value,fallback=0)=>{
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  };
  const clamp01=value=>Math.max(0,Math.min(1,finite(value)));

  const ratingLabels=Object.freeze({
    strong:'Vahva',
    good:'Hyvä',
    review:'Tarkista',
    weak:'Heikko'
  });

  const riskLabels=Object.freeze({
    'energy-coverage-low':'Energia-analyysi ei kata riittävästi koko mixiä',
    'flat-energy-arc':'Energiakaari on liian tasainen cheer-kokonaisuuteen',
    'source-overuse':'Samaa lähdekappaletta käytetään liian pitkään peräkkäin',
    'ending-not-last':'Lopetusosuus ei ole mixin viimeinen osuus',
    'weak-ending-energy':'Lopetuksen energia jää liian matalaksi',
    'match-coherence-low':'Segmenttien kokonaisosuvuus vaatii tarkistuksen'
  });

  const reviewReasonLabels=Object.freeze({
    'energy-mismatch':'Energia ei vastaa tämän osuuden tavoitetta',
    'weak-match':'Valitun musiikkijakson osuvuus on heikko',
    'weak-ending-energy':'Lopetuksen energia jää liian matalaksi',
    'ending-not-last':'Lopetusosuus ei ole mixin viimeinen osuus',
    'source-overuse':'Samaa lähdekappaletta jatkuu liian pitkään',
    'flat-energy-arc':'Tämä kohta ylläpitää liian tasaista energiakaarta'
  });

  const sectionTypeLabels=Object.freeze({
    intro:'Intro',
    stunt:'Stuntti',
    basket:'Heitot',
    pyramid:'Pyramidi',
    transition:'Siirtymä',
    dance:'Dance',
    jumps:'Hypyt',
    tumbling:'Voltit',
    ending:'Lopetus',
    other:'Osuus'
  });

  const inspectorLabels=Object.freeze({
    purpose:'Osuuden tarkoitus',
    energy:'Energia',
    transition:'Break/drop-sisääntulo',
    boundary:'Leikkausraja',
    phrase:'Fraasiraja'
  });

  function wholeMixPackage(project){
    return project?.smartMixProposalPackage||
      project?.smartMixProposal?.package||
      project?.intelligentMix?.proposalPackage||
      null;
  }

  function percent(value){
    return Math.round(clamp01(value)*100);
  }

  function sectionLabel(type,id){
    const base=sectionTypeLabels[String(type||'other')]||sectionTypeLabels.other;
    return id?`${base} (${id})`:base;
  }

  function buildReviewTargets(source){
    return (Array.isArray(source?.reviewTargets)?source.reviewTargets:[])
      .filter(Boolean)
      .map((target,index)=>{
        const severity=clamp01(target.severity);
        const kind=target.kind==='transition'?'transition':'section';
        const label=kind==='transition'
          ?`Siirtymä ${target.fromSectionId||'?'} → ${target.toSectionId||'?'}`
          :sectionLabel(target.sectionType,target.sectionId);
        return {
          index,
          kind,
          sectionId:target.sectionId||null,
          fromSectionId:target.fromSectionId||null,
          toSectionId:target.toSectionId||null,
          reason:String(target.reason||'review'),
          reasonLabel:reviewReasonLabels[target.reason]||String(target.reason||'Tarkista kohta'),
          severity,
          severityPercent:percent(severity),
          label,
          evidence:target.evidence||null
        };
      })
      .sort((a,b)=>b.severity-a.severity || a.index-b.index);
  }

  function buildWholeMixQualityView(proposalPackage){
    const source=proposalPackage?.smartMixWholeMixQuality;
    if(!source){
      return {
        available:false,
        score:0,
        rating:'review',
        ratingLabel:ratingLabels.review,
        readyForFxReview:false,
        components:[],
        risks:[],
        reviewTargets:[],
        nonDestructive:true
      };
    }

    const components=source.components||{};
    const rows=[
      ['energyArc','Energiakaari',components.energyArc?.score],
      ['sourceVariety','Kappalevaihtelu',components.sourceVariety?.score],
      ['structure','Cheer-rakenne',components.structure?.score],
      ['matchCoherence','Segmenttien osuvuus',components.matchCoherence?.score]
    ].map(([code,label,score])=>({
      code,
      label,
      score:clamp01(score),
      percent:percent(score)
    }));

    const rating=ratingLabels[source.rating]?source.rating:'review';
    const risks=(Array.isArray(source.risks)?source.risks:[])
      .filter(Boolean)
      .map(code=>({
        code:String(code),
        label:riskLabels[code]||String(code)
      }));

    return {
      available:true,
      score:clamp01(source.score),
      scorePercent:percent(source.score),
      rating,
      ratingLabel:ratingLabels[rating],
      readyForFxReview:source.readyForFxReview===true,
      components:rows,
      risks,
      reviewTargets:buildReviewTargets(source),
      nonDestructive:true
    };
  }

  function reviewNavigationSectionId(target){
    if(!target)return null;
    if(target.kind==='transition'){
      return target.toSectionId||target.fromSectionId||null;
    }
    return target.sectionId||null;
  }

  function reviewNavigationIndex(proposalPackage,target){
    const sectionId=reviewNavigationSectionId(target);
    if(!sectionId)return -1;
    const matches=Array.isArray(proposalPackage?.smartMixSelectionExplanation?.matches)
      ?proposalPackage.smartMixSelectionExplanation.matches
      :[];
    return matches.findIndex(row=>String(row?.sectionId||'')===String(sectionId));
  }

  function reviewExplanationMatch(proposalPackage,target){
    const index=reviewNavigationIndex(proposalPackage,target);
    if(index<0)return null;
    return proposalPackage.smartMixSelectionExplanation.matches[index]||null;
  }

  function yesNo(value){
    return value?'kyllä':'ei';
  }

  function inspectorValue(code,detail={}){
    if(code==='purpose'){
      const compatibility=Number.isFinite(Number(detail.compatibility))
        ?` · yhteensopivuus ${percent(detail.compatibility)}%`
        :'';
      return `${detail.purpose||'ei tunnistettu'}${compatibility}`;
    }
    if(code==='energy'){
      const actual=Number.isFinite(Number(detail.averageEnergy))
        ?`${percent(detail.averageEnergy)}%`
        :'ei mitattu';
      return `${actual} · tavoite ${detail.target||'ei määritetty'}`;
    }
    if(code==='transition'){
      return `${detail.actual||'none'} → tavoite ${detail.wanted||'neutral'} · osuma ${yesNo(detail.matched)}`;
    }
    if(code==='boundary'){
      return `${detail.kind||'havaittu raja'} · alku ${yesNo(detail.startAligned)} · loppu ${yesNo(detail.endAligned)}`;
    }
    if(code==='phrase'){
      const size=detail.phraseEights?`${detail.phraseEights} × 8`:'fraasi';
      return `${size} · alku ${yesNo(detail.startAligned)} · loppu ${yesNo(detail.endAligned)}`;
    }
    return '';
  }

  function buildSectionReviewInspector(proposalPackage,target){
    const match=reviewExplanationMatch(proposalPackage,target);
    if(!match?.explanation){
      return {
        available:false,
        sectionId:reviewNavigationSectionId(target),
        sectionType:match?.sectionType||'other',
        title:'Tarkistustiedot eivät ole saatavilla',
        rows:[],
        nonDestructive:true
      };
    }

    const explanation=match.explanation;
    const evidence=Array.isArray(explanation.evidence)&&explanation.evidence.length
      ?explanation.evidence
      :(Array.isArray(explanation.reasons)?explanation.reasons:[]);
    const byCode=new Map(evidence.map(row=>[row?.code,row]));
    const rows=['purpose','energy','transition','boundary','phrase']
      .map(code=>{
        const row=byCode.get(code);
        if(!row)return null;
        return {
          code,
          label:inspectorLabels[code],
          value:inspectorValue(code,row.detail||{}),
          score:Number.isFinite(Number(row.score))?clamp01(row.score):null,
          scorePercent:Number.isFinite(Number(row.score))?percent(row.score):null
        };
      })
      .filter(Boolean);

    return {
      available:rows.length>0,
      sectionId:match.sectionId||reviewNavigationSectionId(target),
      sectionType:match.sectionType||'other',
      title:`${sectionLabel(match.sectionType,match.sectionId)} · tarkistustiedot`,
      sourceName:explanation.sourceName||null,
      startEight:explanation.startEight??null,
      endEight:explanation.endEight??null,
      confidence:Number.isFinite(Number(explanation.confidence))
        ?clamp01(explanation.confidence)
        :null,
      confidencePercent:Number.isFinite(Number(explanation.confidence))
        ?percent(explanation.confidence)
        :null,
      rows,
      nonDestructive:true
    };
  }

  function navigateToReviewTarget(project,target){
    if(typeof document==='undefined')return false;
    const proposalPackage=wholeMixPackage(project);
    const index=reviewNavigationIndex(proposalPackage,target);
    if(index<0)return false;

    const cards=[...document.querySelectorAll(
      '#smartMixSelectionExplanation .smart-mix-selection-explanation-card'
    )];
    const card=cards[index];
    if(!card)return false;

    card.scrollIntoView?.({behavior:'smooth',block:'center'});
    if(!card.hasAttribute?.('tabindex'))card.tabIndex=-1;
    try{card.focus?.({preventScroll:true});}catch(_){card.focus?.();}

    if(card.style){
      const oldOutline=card.style.outline;
      const oldOffset=card.style.outlineOffset;
      card.style.outline='2px solid currentColor';
      card.style.outlineOffset='3px';
      if(typeof setTimeout==='function'){
        setTimeout(()=>{
          if(!card?.style)return;
          card.style.outline=oldOutline;
          card.style.outlineOffset=oldOffset;
        },1600);
      }
    }
    return true;
  }

  function scoreClass(score){
    const value=clamp01(score);
    if(value>=.80)return 'good';
    if(value>=.65)return 'mid';
    return 'bad';
  }

  function renderSectionReviewInspector(host,proposalPackage,target){
    if(!host||typeof document==='undefined')return false;
    const inspector=buildSectionReviewInspector(proposalPackage,target);
    host.replaceChildren();
    host.hidden=!inspector.available;
    if(!inspector.available)return false;

    const box=document.createElement('div');
    box.className='im-card smart-mix-section-review-inspector';

    const title=document.createElement('strong');
    title.textContent=inspector.title;
    box.appendChild(title);

    const meta=[];
    if(inspector.sourceName)meta.push(inspector.sourceName);
    if(inspector.startEight!=null&&inspector.endEight!=null){
      meta.push(`8-count ${inspector.startEight}–${inspector.endEight}`);
    }
    if(inspector.confidencePercent!=null)meta.push(`varmuus ${inspector.confidencePercent}%`);
    if(meta.length){
      const metaLine=document.createElement('div');
      metaLine.className='im-candidates';
      metaLine.textContent=meta.join(' · ');
      box.appendChild(metaLine);
    }

    for(const row of inspector.rows){
      const line=document.createElement('div');
      line.className='im-reason';
      const score=row.scorePercent==null?'':` · ${row.scorePercent}%`;
      line.textContent=`${row.label}: ${row.value}${score}`;
      box.appendChild(line);
    }

    host.appendChild(box);
    return true;
  }

  function renderReviewTargets(card,view,project,proposalPackage){
    if(!view.reviewTargets.length)return;

    const title=document.createElement('strong');
    title.className='im-review-title';
    title.textContent='Tarkista ensin nämä kohdat';
    card.appendChild(title);

    const list=document.createElement('div');
    list.className='im-review-targets';

    const detailHost=document.createElement('div');
    detailHost.className='smart-mix-review-inspector-host';
    detailHost.hidden=true;

    for(const target of view.reviewTargets.slice(0,5)){
      const row=document.createElement('div');
      row.className='im-reason smart-mix-review-target';
      row.dataset.reviewKind=target.kind;
      row.dataset.reviewReason=target.reason;
      if(target.sectionId)row.dataset.sectionId=target.sectionId;
      if(target.fromSectionId)row.dataset.fromSectionId=target.fromSectionId;
      if(target.toSectionId)row.dataset.toSectionId=target.toSectionId;
      row.setAttribute('role','button');
      row.setAttribute('tabindex','0');
      row.setAttribute('aria-label',`Näytä tarkistettava kohta: ${target.label}. ${target.reasonLabel}`);

      const openTarget=()=>{
        renderSectionReviewInspector(detailHost,proposalPackage,target);
        return navigateToReviewTarget(project,target);
      };
      row.addEventListener('click',openTarget);
      row.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();
        openTarget();
      });

      const label=document.createElement('strong');
      label.textContent=`${target.label} · ${target.severityPercent}%`;

      const reason=document.createElement('span');
      reason.textContent=`${target.reasonLabel} · Avaa kohta`;

      row.append(label,reason);
      list.appendChild(row);
    }

    card.append(list,detailHost);
  }

  function renderWholeMixQuality(project){
    if(typeof document==='undefined')return false;
    const host=q('#smartMixWholeMixQuality');
    if(!host)return false;

    const proposalPackage=wholeMixPackage(project);
    const view=buildWholeMixQualityView(proposalPackage);
    host.replaceChildren();
    host.hidden=!view.available;
    if(!view.available)return false;

    const card=document.createElement('div');
    card.className='im-card smart-mix-whole-quality-card';

    const head=document.createElement('div');
    head.className='im-head';
    const left=document.createElement('div');
    const strong=document.createElement('strong');
    strong.textContent='Smart Mix -kokonaislaatu';
    const state=document.createElement('span');
    state.textContent=view.readyForFxReview
      ?'Valmis cheer-FX-tarkistukseen'
      :'Tarkista kokonaisuus ennen cheer-FX-vaihetta';
    left.append(strong,state);

    const score=document.createElement('div');
    score.className=`im-score ${scoreClass(view.score)}`;
    score.textContent=`${view.scorePercent}% · ${view.ratingLabel}`;
    head.append(left,score);
    card.appendChild(head);

    const componentLine=document.createElement('div');
    componentLine.className='im-candidates';
    componentLine.textContent=view.components
      .map(row=>`${row.label} ${row.percent}%`)
      .join(' · ');
    card.appendChild(componentLine);

    if(view.risks.length){
      const riskBox=document.createElement('div');
      riskBox.className='im-reason';
      riskBox.textContent=`Tarkista: ${view.risks.map(row=>row.label).join(' · ')}`;
      card.appendChild(riskBox);
    }else{
      const ok=document.createElement('div');
      ok.className='im-reason';
      ok.textContent='Energiakaari, kappalevaihtelu ja cheer-rakenne ovat tasapainossa.';
      card.appendChild(ok);
    }

    renderReviewTargets(card,view,project,proposalPackage);
    host.appendChild(card);
    return true;
  }

  let observer=null;
  function mount(){
    if(typeof document==='undefined')return false;
    const panel=q('#intelligentMixPanel');
    if(!panel)return false;

    let host=q('#smartMixWholeMixQuality');
    if(!host){
      host=document.createElement('div');
      host.id='smartMixWholeMixQuality';
      host.className='smart-mix-whole-quality';
      host.hidden=true;

      const explanation=q('#smartMixSelectionExplanation');
      const results=q('#intelligentMixResults');
      if(explanation?.parentNode===panel){
        panel.insertBefore(host,explanation);
      }else if(results?.parentNode===panel){
        panel.insertBefore(host,results);
      }else{
        panel.appendChild(host);
      }
    }

    const project=typeof state!=='undefined'?state:null;
    renderWholeMixQuality(project);

    const status=q('#smartMix2Status');
    if(status&&!observer&&typeof MutationObserver!=='undefined'){
      observer=new MutationObserver(()=>{
        const current=typeof state!=='undefined'?state:null;
        renderWholeMixQuality(current);
      });
      observer.observe(status,{childList:true,characterData:true,subtree:true});
    }
    return true;
  }

  function init(){
    if(mount())return;
    if(typeof MutationObserver==='undefined'||typeof document==='undefined')return;
    const mountObserver=new MutationObserver(()=>{
      if(mount())mountObserver.disconnect();
    });
    mountObserver.observe(document.body,{childList:true,subtree:true});
  }

  const api={
    ratingLabels,
    riskLabels,
    reviewReasonLabels,
    sectionTypeLabels,
    inspectorLabels,
    wholeMixPackage,
    buildReviewTargets,
    buildWholeMixQualityView,
    reviewNavigationSectionId,
    reviewNavigationIndex,
    reviewExplanationMatch,
    buildSectionReviewInspector,
    navigateToReviewTarget,
    renderSectionReviewInspector,
    renderWholeMixQuality,
    mount
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerSmartMixQualityPreviewUI=api;
  if(typeof document!=='undefined'){
    document.readyState==='loading'
      ?document.addEventListener('DOMContentLoaded',init)
      :init();
  }
})();