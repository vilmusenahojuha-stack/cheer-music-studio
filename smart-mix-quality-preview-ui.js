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

  function wholeMixPackage(project){
    return project?.smartMixProposalPackage||
      project?.smartMixProposal?.package||
      project?.intelligentMix?.proposalPackage||
      null;
  }

  function percent(value){
    return Math.round(clamp01(value)*100);
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
      nonDestructive:true
    };
  }

  function scoreClass(score){
    const value=clamp01(score);
    if(value>=.80)return 'good';
    if(value>=.65)return 'mid';
    return 'bad';
  }

  function renderWholeMixQuality(project){
    if(typeof document==='undefined')return false;
    const host=q('#smartMixWholeMixQuality');
    if(!host)return false;

    const view=buildWholeMixQualityView(wholeMixPackage(project));
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
    wholeMixPackage,
    buildWholeMixQualityView,
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