(()=>{
  'use strict';

  const DIRECTIVE_PRIORITY=Object.freeze({
    'strengthen-final-peak':100,
    'trim-pyramid-peak':95,
    'reduce-section-fx':85,
    'reserve-and-build-peak':75,
    'hold':20
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function priorityFor(section){
    const directive=String(section?.balanceDirective||'hold');
    const base=DIRECTIVE_PRIORITY[directive]??50;
    const riskBoost=Math.min(25,(Array.isArray(section?.risks)?section.risks.length:0)*5);
    const endingBoost=section?.section==='ending'?10:0;
    return base+riskBoost+endingBoost;
  }
  function recommendation(section,index){
    const directive=String(section?.balanceDirective||'hold');
    return {
      id:`fx-${section?.section||'section'}-${index+1}`,
      section:section?.section||'other',
      directive,
      priority:priorityFor(section),
      competitionIntensity:finite(section?.competitionIntensity),
      targetCeiling:finite(section?.targetCeiling),
      action:directive==='hold'?'preserve-current-fx-plan':directive,
      requiresReview:directive!=='hold'
    };
  }

  function buildCompetitionFxPackage(balancePlan){
    const blocked={version:1,kind:'cheer-fx-competition-package',status:'blocked',reason:'competition-balance-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,recommendations:[],riskFlags:[],summary:{recommendations:0,reviewItems:0,readyForPreview:false}};
    if(!balancePlan||balancePlan.kind!=='cheer-fx-competition-balance-plan')return blocked;
    if(balancePlan.status==='blocked')return {...blocked,reason:'competition-balance-plan-blocked'};

    const sections=Array.isArray(balancePlan.sections)?balancePlan.sections:[];
    const recommendations=sections.map(recommendation).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
    const reviewItems=recommendations.filter(item=>item.requiresReview);
    const riskFlags=[...(Array.isArray(balancePlan.riskFlags)?balancePlan.riskFlags:[])];
    if(reviewItems.length)riskFlags.push('fx-package-review-items');
    if(!sections.length)riskFlags.push('fx-package-empty');

    let status='preview-ready';
    let reason=null;
    if(!sections.length){status='blocked';reason='competition-sections-required';}
    else if(balancePlan.status!=='preview-ready'||reviewItems.length)status='review-required';

    return {
      version:1,kind:'cheer-fx-competition-package',status,reason,bpm:balancePlan.bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      recommendations,
      balanceRisks:Array.isArray(balancePlan.balanceRisks)?balancePlan.balanceRisks:[],
      riskFlags:[...new Set(riskFlags)],
      preview:{
        orderedSections:recommendations.map(item=>item.section),
        topPriority:recommendations[0]||null,
        finalPeak:recommendations.find(item=>item.section==='ending')||null
      },
      summary:{recommendations:recommendations.length,reviewItems:reviewItems.length,readyForPreview:status==='preview-ready'}
    };
  }

  const api={DIRECTIVE_PRIORITY,priorityFor,recommendation,buildCompetitionFxPackage};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxCompetitionPackageCore=api;
})();
