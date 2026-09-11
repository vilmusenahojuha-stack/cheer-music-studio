(()=>{
  'use strict';

  function qualityUi(){
    if(typeof window!=='undefined'&&window.CheerSmartMixQualityPreviewUI){
      return window.CheerSmartMixQualityPreviewUI;
    }
    return null;
  }

  function comparisonView(){
    if(typeof window!=='undefined'&&window.SmartMixRunnerUpComparisonView){
      return window.SmartMixRunnerUpComparisonView;
    }
    if(typeof require==='function'){
      try{return require('./smart-mix-runner-up-comparison-view.js');}catch(_){return null;}
    }
    return null;
  }

  function navigationSectionId(target={}){
    if(target.kind==='transition')return target.toSectionId||target.fromSectionId||null;
    return target.sectionId||null;
  }

  function proposalPackage(project){
    const ui=qualityUi();
    if(ui?.wholeMixPackage)return ui.wholeMixPackage(project);
    return project?.smartMixProposalPackage||
      project?.smartMixProposal?.package||
      project?.intelligentMix?.proposalPackage||
      null;
  }

  function explanationForTarget(project,target={}){
    const packageData=proposalPackage(project);
    const ui=qualityUi();
    if(ui?.reviewExplanationMatch){
      return ui.reviewExplanationMatch(packageData,target)?.explanation||null;
    }
    const sectionId=navigationSectionId(target);
    if(!sectionId)return null;
    const matches=Array.isArray(packageData?.smartMixSelectionExplanation?.matches)
      ?packageData.smartMixSelectionExplanation.matches
      :[];
    return matches.find(row=>String(row?.sectionId||'')===String(sectionId))?.explanation||null;
  }

  function buildComparisonPanelModel(project,target={}){
    const explanation=explanationForTarget(project,target);
    const viewApi=comparisonView();
    const comparison=viewApi?.buildRunnerUpComparisonView
      ?viewApi.buildRunnerUpComparisonView(explanation||{})
      :null;

    if(!comparison?.available){
      return {
        available:false,
        sectionId:navigationSectionId(target),
        title:'Valittu vs. 2. paras',
        selected:null,
        runnerUp:null,
        scoreMarginPercent:null,
        sourceRelation:null,
        advantageText:null,
        reviewRecommended:false,
        nonDestructive:true
      };
    }

    return {
      available:true,
      sectionId:navigationSectionId(target),
      title:'Valittu vs. 2. paras',
      selected:comparison.selected,
      runnerUp:comparison.runnerUp,
      scoreMarginPercent:comparison.scoreMarginPercent,
      sourceRelation:comparison.sourceRelation,
      advantageText:comparison.advantageText,
      reviewRecommended:comparison.reviewRecommended===true,
      nonDestructive:true
    };
  }

  function candidateLine(candidate={}){
    const parts=[candidate.label||'Vaihtoehto'];
    if(candidate.sourceName)parts.push(candidate.sourceName);
    if(candidate.rangeText)parts.push(candidate.rangeText);
    if(candidate.scorePercent!=null)parts.push(`${candidate.scorePercent}%`);
    return parts.join(' · ');
  }

  function renderComparison(host,project,target={}){
    if(!host||typeof document==='undefined')return false;
    host.querySelector?.('.smart-mix-runner-up-comparison')?.remove?.();

    const model=buildComparisonPanelModel(project,target);
    if(!model.available)return false;

    const box=document.createElement('div');
    box.className='im-card smart-mix-runner-up-comparison';
    box.dataset.sectionId=model.sectionId||'';

    const title=document.createElement('strong');
    title.textContent=model.title;
    box.appendChild(title);

    for(const candidate of [model.selected,model.runnerUp]){
      const line=document.createElement('div');
      line.className='im-reason smart-mix-runner-up-candidate';

      const main=document.createElement('strong');
      main.textContent=candidateLine(candidate);
      line.appendChild(main);

      if(candidate.primaryReason){
        const reason=document.createElement('span');
        reason.textContent=candidate.primaryReason;
        line.appendChild(reason);
      }
      box.appendChild(line);
    }

    const summary=document.createElement('div');
    summary.className='im-candidates';
    const margin=model.scoreMarginPercent==null
      ?'piste-ero ei saatavilla'
      :`piste-ero ${model.scoreMarginPercent} prosenttiyks.`;
    summary.textContent=[model.sourceRelation,margin].filter(Boolean).join(' · ');
    box.appendChild(summary);

    if(model.advantageText){
      const advantage=document.createElement('div');
      advantage.className='im-reason';
      advantage.textContent=model.advantageText;
      box.appendChild(advantage);
    }

    if(model.reviewRecommended){
      const warning=document.createElement('div');
      warning.className='im-reason smart-mix-runner-up-review-warning';
      warning.textContent='Valinta on hyvin tasainen: kuuntele molemmat vaihtoehdot ennen hyväksyntää.';
      box.appendChild(warning);
    }

    host.appendChild(box);
    return true;
  }

  function targetFromElement(element){
    if(!element?.dataset)return null;
    return {
      kind:element.dataset.reviewKind==='transition'?'transition':'section',
      sectionId:element.dataset.sectionId||null,
      fromSectionId:element.dataset.fromSectionId||null,
      toSectionId:element.dataset.toSectionId||null
    };
  }

  function renderForReviewElement(element){
    if(typeof document==='undefined')return false;
    const host=element?.closest?.('.smart-mix-whole-quality-card')
      ?.querySelector?.('.smart-mix-review-inspector-host');
    if(!host)return false;
    const project=typeof state!=='undefined'?state:null;
    return renderComparison(host,project,targetFromElement(element));
  }

  let mounted=false;
  function mount(){
    if(mounted||typeof document==='undefined')return false;
    mounted=true;

    document.addEventListener('click',event=>{
      const row=event.target?.closest?.('.smart-mix-review-target');
      if(row)renderForReviewElement(row);
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const row=event.target?.closest?.('.smart-mix-review-target');
      if(row)renderForReviewElement(row);
    });
    return true;
  }

  const api={
    navigationSectionId,
    proposalPackage,
    explanationForTarget,
    buildComparisonPanelModel,
    candidateLine,
    renderComparison,
    targetFromElement,
    mount
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixRunnerUpComparisonUI=api;
  if(typeof document!=='undefined'){
    document.readyState==='loading'
      ?document.addEventListener('DOMContentLoaded',mount)
      :mount();
  }
})();
