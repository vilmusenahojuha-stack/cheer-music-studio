(()=>{
  'use strict';

  const finite=(value,fallback=0)=>{
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  };
  const clamp01=value=>Math.max(0,Math.min(1,finite(value)));
  const percent=value=>Math.round(clamp01(value)*100);

  const transitionReasonLabels=Object.freeze({
    'energy-jump-mismatch':'Energiahyppy ei vastaa seuraavan osuuden tavoitetta',
    'weak-boundary':'Fraasi- tai leikkausraja on liian heikko',
    'weak-transition-entry':'Break/drop-sisääntulo ei tue siirtymää riittävästi',
    'source-switch-unverified':'Lähdekappale vaihtuu ilman riittävää siirtymäevidenssiä',
    'source-switch-weak-handoff':'Kappaleenvaihdon handoff on liian heikko'
  });

  function signedPercent(value){
    const n=finite(value);
    const rounded=Math.round(n*100);
    return `${rounded>0?'+':''}${rounded}%`;
  }

  function buildTransitionReview(target){
    if(target?.kind!=='transition'||target?.reason!=='weak-section-transition'){
      return {available:false,rows:[],issues:[],nonDestructive:true};
    }

    const evidence=target.evidence&&typeof target.evidence==='object'?target.evidence:{};
    const rows=[];
    const energy=evidence.energyDelta;
    if(energy&&typeof energy==='object'){
      rows.push({
        code:'energyDelta',
        label:'Energiahyppy',
        value:`toteutunut ${signedPercent(energy.actualDelta)} · tavoite ${signedPercent(energy.targetDelta)}`,
        score:Number.isFinite(Number(energy.score))?clamp01(energy.score):null,
        scorePercent:Number.isFinite(Number(energy.score))?percent(energy.score):null
      });
    }
    if(Number.isFinite(Number(evidence.boundarySupport))){
      rows.push({
        code:'boundarySupport',
        label:'Fraasi-/leikkausrajan tuki',
        value:`${percent(evidence.boundarySupport)}%`,
        score:clamp01(evidence.boundarySupport),
        scorePercent:percent(evidence.boundarySupport)
      });
    }
    if(Number.isFinite(Number(evidence.transitionSupport))){
      rows.push({
        code:'transitionSupport',
        label:'Break/drop-sisääntulon tuki',
        value:`${percent(evidence.transitionSupport)}%`,
        score:clamp01(evidence.transitionSupport),
        scorePercent:percent(evidence.transitionSupport)
      });
    }
    if(evidence.sourceSwitch===true){
      const from=evidence.fromSource||'edellinen lähde';
      const to=evidence.toSource||'seuraava lähde';
      rows.push({
        code:'sourceSwitch',
        label:'Lähdekappaleen vaihto',
        value:`${from} → ${to}`,
        score:null,
        scorePercent:null
      });
    }

    const issues=(Array.isArray(evidence.reasons)?evidence.reasons:[])
      .filter(Boolean)
      .map(code=>({code:String(code),label:transitionReasonLabels[code]||String(code)}));

    return {
      available:rows.length>0||issues.length>0,
      title:`Siirtymä ${target.fromSectionId||'?'} → ${target.toSectionId||'?'} · miksi tarkistettava`,
      fromSectionId:target.fromSectionId||null,
      toSectionId:target.toSectionId||null,
      score:Number.isFinite(Number(evidence.score))?clamp01(evidence.score):null,
      scorePercent:Number.isFinite(Number(evidence.score))?percent(evidence.score):null,
      rows,
      issues,
      nonDestructive:true
    };
  }

  function currentProject(){
    try{return typeof state!=='undefined'?state:null;}catch(_){return null;}
  }

  function findTransitionTarget(project,row){
    const preview=globalThis.CheerSmartMixQualityPreviewUI;
    if(!preview?.wholeMixPackage||!preview?.buildReviewTargets)return null;
    const proposalPackage=preview.wholeMixPackage(project);
    const quality=proposalPackage?.smartMixWholeMixQuality;
    const targets=preview.buildReviewTargets(quality);
    return targets.find(target=>
      target.kind==='transition'&&
      target.reason==='weak-section-transition'&&
      String(target.fromSectionId||'')===String(row?.dataset?.fromSectionId||'')&&
      String(target.toSectionId||'')===String(row?.dataset?.toSectionId||'')
    )||null;
  }

  function renderTransitionReview(host,target){
    if(!host||typeof document==='undefined')return false;
    const view=buildTransitionReview(target);
    if(!view.available)return false;

    host.replaceChildren();
    host.hidden=false;
    const box=document.createElement('div');
    box.className='im-card smart-mix-transition-review-inspector';

    const title=document.createElement('strong');
    title.textContent=view.title;
    box.appendChild(title);

    if(view.scorePercent!=null){
      const score=document.createElement('div');
      score.className='im-candidates';
      score.textContent=`Siirtymän laatu ${view.scorePercent}%`;
      box.appendChild(score);
    }

    for(const row of view.rows){
      const line=document.createElement('div');
      line.className='im-reason';
      line.textContent=`${row.label}: ${row.value}`;
      box.appendChild(line);
    }

    if(view.issues.length){
      const issueTitle=document.createElement('strong');
      issueTitle.textContent='Miksi tämä kohta vaatii tarkistuksen';
      box.appendChild(issueTitle);
      for(const issue of view.issues){
        const line=document.createElement('div');
        line.className='im-reason';
        line.textContent=issue.label;
        box.appendChild(line);
      }
    }

    host.appendChild(box);
    return true;
  }

  function enhanceRow(row){
    if(!row?.matches?.('.smart-mix-review-target[data-review-reason="weak-section-transition"]'))return false;
    const card=row.closest?.('.smart-mix-whole-quality-card');
    const host=card?.querySelector?.('.smart-mix-review-inspector-host');
    if(!host)return false;
    const target=findTransitionTarget(currentProject(),row);
    return target?renderTransitionReview(host,target):false;
  }

  function bind(){
    if(typeof document==='undefined')return false;
    document.addEventListener('click',event=>{
      const row=event.target?.closest?.('.smart-mix-review-target[data-review-reason="weak-section-transition"]');
      if(row)enhanceRow(row);
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const row=event.target?.closest?.('.smart-mix-review-target[data-review-reason="weak-section-transition"]');
      if(row)enhanceRow(row);
    });
    return true;
  }

  const api={
    transitionReasonLabels,
    buildTransitionReview,
    findTransitionTarget,
    renderTransitionReview,
    enhanceRow,
    bind
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerSmartMixTransitionReviewUI=api;
  if(typeof document!=='undefined')bind();
})();
