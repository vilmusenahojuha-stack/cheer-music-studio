(()=>{
  'use strict';

  const PHASE_RANK=Object.freeze({break:0,release:1,build:2,drive:3,resolve:4,peak:5});
  const TARGET_ARCS=Object.freeze({
    intro:['build','drive'],
    stunt:['build','peak'],
    tumbling:['drive','peak'],
    pyramid:['build','peak'],
    dance:['drive','release'],
    ending:['build','resolve'],
    other:['drive']
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function phaseRank(phase){return PHASE_RANK[String(phase||'drive').toLowerCase()]??PHASE_RANK.drive;}
  function sectionKey(value){const key=String(value||'other').toLowerCase();return TARGET_ARCS[key]?key:'other';}
  function groupSection(group){return sectionKey(group?.pattern?.sectionType||group?.events?.[0]?.sectionType||'other');}

  function summarizeSection(groups){
    if(!groups.length)return null;
    const section=groupSection(groups[0]);
    const phases=groups.map(group=>String(group?.phraseEnergy?.phase||'drive').toLowerCase());
    const ranks=phases.map(phaseRank);
    const active=groups.flatMap(group=>(group.events||[]).filter(event=>event.phraseEnergyDecision!=='defer'));
    const impacts=active.filter(event=>event.kind==='impact');
    const hero=active.filter(event=>event.phraseEnergyRole==='hero-candidate');
    return {
      section,startEight:groups[0].eight,endEight:groups[groups.length-1].eight,
      phases,phaseRanks:ranks,activeCount:active.length,impactCount:impacts.length,heroCount:hero.length,
      averageScore:active.length?active.reduce((sum,event)=>sum+finite(event.phraseEnergyScore,0),0)/active.length:0
    };
  }

  function detectArcRisk(summary){
    const risks=[];
    if(!summary)return risks;
    const target=TARGET_ARCS[summary.section]||TARGET_ARCS.other;
    const first=summary.phases[0];
    const last=summary.phases[summary.phases.length-1];
    if(target.length>1&&phaseRank(last)<phaseRank(first))risks.push('energy-arc-reverses');
    if((summary.section==='stunt'||summary.section==='pyramid')&&summary.impactCount===0)risks.push('section-missing-impact');
    if(summary.section==='ending'&&summary.heroCount===0)risks.push('ending-missing-hero-candidate');
    if(summary.section==='intro'&&summary.heroCount>1)risks.push('intro-too-hero-heavy');
    return risks;
  }

  function shapeSection(summary){
    const risks=detectArcRisk(summary);
    const target=TARGET_ARCS[summary.section]||TARGET_ARCS.other;
    let directive='hold';
    if(risks.includes('energy-arc-reverses'))directive='rebuild-energy-rise';
    else if(risks.includes('section-missing-impact'))directive='add-peak-impact';
    else if(risks.includes('ending-missing-hero-candidate'))directive='promote-ending-hero';
    else if(summary.section==='dance'&&summary.activeCount>6)directive='thin-dance-fx';
    return {...summary,targetArc:target,risks,directive};
  }

  function createCheerFxArcPlan(phraseEnergyPlan){
    if(!phraseEnergyPlan||phraseEnergyPlan.kind!=='cheer-fx-phrase-energy-plan')return {version:1,kind:'cheer-fx-arc-plan',status:'blocked',reason:'cheer-fx-phrase-energy-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,sections:[],riskFlags:[]};
    if(phraseEnergyPlan.status==='blocked')return {version:1,kind:'cheer-fx-arc-plan',status:'blocked',reason:'cheer-fx-phrase-energy-plan-blocked',nonDestructive:true,executable:false,safePreviewOnly:true,sections:[],riskFlags:[]};
    const groups=[...(Array.isArray(phraseEnergyPlan.groups)?phraseEnergyPlan.groups:[])].sort((a,b)=>finite(a?.eight)-finite(b?.eight));
    const buckets=[];
    let current=[];
    for(const group of groups){
      if(!current.length||groupSection(current[0])===groupSection(group))current.push(group);
      else{buckets.push(current);current=[group];}
    }
    if(current.length)buckets.push(current);
    const sections=buckets.map(bucket=>shapeSection(summarizeSection(bucket)));
    const arcRisks=sections.flatMap(section=>section.risks.map(type=>({type,section:section.section,startEight:section.startEight,endEight:section.endEight})));
    const riskFlags=[...(Array.isArray(phraseEnergyPlan.riskFlags)?phraseEnergyPlan.riskFlags:[])];
    if(arcRisks.length)riskFlags.push('fx-section-arc-risk');
    const status=arcRisks.length||phraseEnergyPlan.status!=='preview-ready'?'review-required':'preview-ready';
    return {version:1,kind:'cheer-fx-arc-plan',status,bpm:phraseEnergyPlan.bpm,nonDestructive:true,executable:false,safePreviewOnly:true,sections,arcRisks,riskFlags:[...new Set(riskFlags)],summary:{sections:sections.length,risks:arcRisks.length,readyForPreview:status==='preview-ready'}};
  }

  const api={PHASE_RANK,TARGET_ARCS,phaseRank,summarizeSection,detectArcRisk,shapeSection,createCheerFxArcPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxArcCore=api;
})();
