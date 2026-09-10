(()=>{
  'use strict';

  const EPSILON=1e-9;

  function array(value){return Array.isArray(value)?value:[];}
  function clamp(value,min,max){return Math.min(max,Math.max(min,value));}
  function formatImpact(value){
    const number=Number(value);
    if(!Number.isFinite(number))return '0.00';
    const rounded=Math.abs(number)<0.005?0:number;
    return `${rounded>0?'+':''}${rounded.toFixed(2)}`;
  }

  function normalizedProgressImpact(progress){
    const delta=Number(progress?.deltaDistance);
    const before=Number(progress?.beforeDistance);
    const after=Number(progress?.afterDistance);
    if(!Number.isFinite(delta)||!Number.isFinite(before)||!Number.isFinite(after))return null;
    const scale=Math.max(Math.abs(before),Math.abs(after),EPSILON);
    return clamp(delta/scale,-1,1);
  }

  function classifyRemaining(items){
    let improved=0,worsened=0,unchanged=0,unmeasured=0;
    let measuredImpact=0,absoluteMeasuredImpact=0,impactMeasured=0;
    for(const item of array(items)){
      const delta=Number(item?.progress?.deltaDistance);
      if(!Number.isFinite(delta)){unmeasured++;continue;}
      if(delta>EPSILON)improved++;
      else if(delta<-EPSILON)worsened++;
      else unchanged++;
      const impact=normalizedProgressImpact(item?.progress);
      if(impact===null)continue;
      measuredImpact+=impact;
      absoluteMeasuredImpact+=Math.abs(impact);
      impactMeasured++;
    }
    return {improved,worsened,unchanged,unmeasured,measuredImpact,absoluteMeasuredImpact,impactMeasured};
  }

  function classifyOverallDirection(counts){
    const improved=Number(counts?.improved)||0;
    const worsened=Number(counts?.worsened)||0;
    const removed=Number(counts?.removed)||0;
    const added=Number(counts?.added)||0;
    const positive=improved+removed;
    const negative=worsened+added;
    const balance=positive-negative;
    const decisive=positive+negative;
    const dominance=decisive?Math.abs(balance)/decisive:0;
    const hasMeasuredImpact=Number.isFinite(Number(counts?.measuredImpact))&&Number.isFinite(Number(counts?.absoluteMeasuredImpact));
    const measuredImpact=hasMeasuredImpact?Number(counts.measuredImpact):improved-worsened;
    const absoluteMeasuredImpact=hasMeasuredImpact?Math.max(0,Number(counts.absoluteMeasuredImpact)):improved+worsened;
    const impactBalance=removed-added+measuredImpact;
    const impactMagnitude=removed+added+absoluteMeasuredImpact;
    const impactDominance=impactMagnitude>EPSILON?Math.abs(impactBalance)/impactMagnitude:0;
    if(Math.abs(impactBalance)<=EPSILON)return {direction:'stable',detail:'stable',strength:'stable',label:'Kokonaisuus ennallaan',positive,negative,balance,dominance,impactBalance,impactMagnitude,impactDominance};
    const strong=Math.abs(impactBalance)>=1.5&&impactDominance>=0.5;
    if(impactBalance>0)return {
      direction:'improving',
      detail:strong?'strongly-improving':'slightly-improving',
      strength:strong?'strong':'slight',
      label:strong?'Kokonaisuus selvästi paranee':'Kokonaisuus hieman paranee',
      positive,negative,balance,dominance,impactBalance,impactMagnitude,impactDominance
    };
    return {
      direction:'worsening',
      detail:strong?'strongly-worsening':'slightly-worsening',
      strength:strong?'strong':'slight',
      label:strong?'Kokonaisuus selvästi heikkenee':'Kokonaisuus hieman heikkenee',
      positive,negative,balance,dominance,impactBalance,impactMagnitude,impactDominance
    };
  }

  function buildDirectionReason(counts,overall){
    const parts=[];
    const removed=Number(counts?.removed)||0;
    const added=Number(counts?.added)||0;
    const impactMeasured=Number(counts?.impactMeasured)||0;
    const measuredImpact=Number(counts?.measuredImpact)||0;
    if(removed)parts.push(`${removed} riski${removed===1?'':'ä'} poistui`);
    if(added)parts.push(`${added} uusi${added===1?' riski':'a riskiä'} tuli`);
    if(impactMeasured){
      if(measuredImpact>EPSILON)parts.push(`mitatut jatkuvat riskit liikkuivat nettomääräisesti kohti tavoitetta (${formatImpact(measuredImpact)})`);
      else if(measuredImpact<-EPSILON)parts.push(`mitatut jatkuvat riskit liikkuivat nettomääräisesti poispäin tavoitteesta (${formatImpact(measuredImpact)})`);
      else parts.push('mitattujen jatkuvien riskien nettomuutos oli tasapainossa');
    }else if((Number(counts?.improved)||0)||(Number(counts?.worsened)||0)){
      parts.push(`${Number(counts?.improved)||0} parani ja ${Number(counts?.worsened)||0} heikkeni ilman vertailukelpoista vaikutuspainoa`);
    }
    if(!parts.length)return 'Ei ratkaisevaa muutosta vertailukelpoisissa riskeissä.';
    const prefix=overall?.direction==='improving'?'Paranemista tukee':overall?.direction==='worsening'?'Heikkenemistä selittää':'Tasapainon muodostaa';
    return `${prefix}: ${parts.join('; ')}.`;
  }

  function contributorLabel(item){
    return String(item?.label||item?.rawLabel||item?.key||'Tuntematon riski');
  }

  function buildImpactCandidates(comparison){
    const candidates=[];
    for(const item of array(comparison?.removed))candidates.push({label:contributorLabel(item),impact:1,kind:'removed',text:`${contributorLabel(item)} poistui (${formatImpact(1)})`});
    for(const item of array(comparison?.added))candidates.push({label:contributorLabel(item),impact:-1,kind:'added',text:`${contributorLabel(item)} tuli uutena riskinä (${formatImpact(-1)})`});
    for(const item of array(comparison?.remaining)){
      const impact=normalizedProgressImpact(item?.progress);
      if(impact===null||Math.abs(impact)<=EPSILON)continue;
      const direction=impact>0?'parani':'heikkeni';
      candidates.push({label:contributorLabel(item),impact,kind:'measured',text:`${contributorLabel(item)} ${direction} (${formatImpact(impact)})`});
    }
    return candidates;
  }

  function findDominantContributor(comparison,overall){
    const candidates=buildImpactCandidates(comparison);
    if(!candidates.length)return null;
    let eligible=candidates;
    if(overall?.direction==='improving')eligible=candidates.filter(item=>item.impact>EPSILON);
    else if(overall?.direction==='worsening')eligible=candidates.filter(item=>item.impact<-EPSILON);
    if(!eligible.length)eligible=candidates;
    return eligible.slice().sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)||a.label.localeCompare(b.label,'fi'))[0]||null;
  }

  function summarizeComparison(comparison){
    if(!comparison||comparison.advisoryOnly!==true||comparison.nonDestructive!==true)return null;
    const remaining=classifyRemaining(comparison.remaining);
    const removed=array(comparison.removed).length;
    const added=array(comparison.added).length;
    const totalCompared=remaining.improved+remaining.worsened+remaining.unchanged;
    const counts={
      improved:remaining.improved,
      worsened:remaining.worsened,
      removed,
      added,
      impactMeasured:remaining.impactMeasured,
      measuredImpact:remaining.measuredImpact,
      absoluteMeasuredImpact:remaining.absoluteMeasuredImpact
    };
    const overall=classifyOverallDirection(counts);
    const reason=buildDirectionReason(counts,overall);
    const dominant=findDominantContributor(comparison,overall);
    const dominantText=dominant?`Suurin yksittäinen vaikutus: ${dominant.text}.`:null;
    return {
      kind:'cheer-competition-master-final-check-progress-summary',
      advisoryOnly:true,
      nonDestructive:true,
      improved:remaining.improved,
      worsened:remaining.worsened,
      unchanged:remaining.unchanged,
      unmeasured:remaining.unmeasured,
      removed,
      added,
      totalCompared,
      impactMeasured:remaining.impactMeasured,
      measuredImpact:remaining.measuredImpact,
      absoluteMeasuredImpact:remaining.absoluteMeasuredImpact,
      overallDirection:overall.direction,
      overallDirectionDetail:overall.detail,
      overallStrength:overall.strength,
      overallLabel:overall.label,
      overallReason:reason,
      dominantContributor:dominant,
      dominantContributorText:dominantText,
      positiveSignals:overall.positive,
      negativeSignals:overall.negative,
      signalBalance:overall.balance,
      signalDominance:overall.dominance,
      impactBalance:overall.impactBalance,
      impactMagnitude:overall.impactMagnitude,
      impactDominance:overall.impactDominance,
      text:`${overall.label}. Kehitys: ${remaining.improved} parani · ${remaining.worsened} heikkeni · ${removed} poistui · ${added} uusi${added===1?'':'a'}${remaining.unchanged?` · ${remaining.unchanged} ennallaan`:''}${remaining.unmeasured?` · ${remaining.unmeasured} ilman vertailumittausta`:''}. ${reason}${dominantText?` ${dominantText}`:''}`
    };
  }

  function ensureNode(){
    const history=document.querySelector('#competitionMasterFinalCheckHistory');
    if(!history)return null;
    let node=document.querySelector('#competitionMasterFinalCheckProgressSummary');
    if(node)return node;
    node=document.createElement('div');
    node.id='competitionMasterFinalCheckProgressSummary';
    node.className='competition-master-final-check-progress-summary';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    history.insertAdjacentElement('afterbegin',node);
    return node;
  }

  function render(summary){
    const node=ensureNode();
    if(!node)return false;
    if(!summary){node.hidden=true;node.textContent='';return false;}
    node.hidden=false;
    node.textContent=summary.text;
    node.dataset.direction=summary.overallDirection;
    node.dataset.directionDetail=summary.overallDirectionDetail;
    node.dataset.strength=summary.overallStrength;
    node.dataset.improved=String(summary.improved);
    node.dataset.worsened=String(summary.worsened);
    node.dataset.removed=String(summary.removed);
    node.dataset.added=String(summary.added);
    node.dataset.impactBalance=String(summary.impactBalance);
    if(summary.dominantContributor){
      node.dataset.dominantKind=summary.dominantContributor.kind;
      node.dataset.dominantImpact=String(summary.dominantContributor.impact);
    }else{
      delete node.dataset.dominantKind;
      delete node.dataset.dominantImpact;
    }
    return true;
  }

  function refresh(){
    const comparison=window.cheerCompetitionMasterFinalCheckHistory?.getLastComparison?.();
    const summary=summarizeComparison(comparison);
    render(summary);
    return summary;
  }

  function init(){
    window.addEventListener('cheer-competition-master-final-check-refreshed',()=>queueMicrotask(refresh));
    window.cheerCompetitionMasterFinalCheckProgressSummary={normalizedProgressImpact,classifyRemaining,classifyOverallDirection,buildDirectionReason,buildImpactCandidates,findDominantContributor,summarizeComparison,refresh,render};
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={normalizedProgressImpact,classifyRemaining,classifyOverallDirection,buildDirectionReason,buildImpactCandidates,findDominantContributor,summarizeComparison};
  if(typeof window!=='undefined'&&typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();