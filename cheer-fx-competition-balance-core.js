(()=>{
  'use strict';

  const SECTION_WEIGHT=Object.freeze({
    intro:0.72,stunt:0.9,tumbling:0.86,pyramid:0.96,dance:0.82,ending:1,other:0.8
  });

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,finite(value)));}
  function sectionKey(value){const key=String(value||'other').toLowerCase();return SECTION_WEIGHT[key]!==undefined?key:'other';}

  function sectionIntensity(section){
    const key=sectionKey(section?.section);
    const avg=clamp(section?.averageScore);
    const impactBoost=Math.min(0.16,finite(section?.impactCount)*0.045);
    const heroBoost=Math.min(0.12,finite(section?.heroCount)*0.08);
    const activityBoost=Math.min(0.08,finite(section?.activeCount)*0.008);
    const raw=clamp(avg*0.64+impactBoost+heroBoost+activityBoost);
    return clamp(raw*(0.85+0.15*SECTION_WEIGHT[key]));
  }

  function targetCeiling(section,index,total){
    const key=sectionKey(section?.section);
    if(key==='ending')return 1;
    if(key==='pyramid')return 0.94;
    if(key==='stunt')return 0.88;
    if(key==='tumbling')return 0.86;
    if(key==='dance')return 0.8;
    if(key==='intro')return 0.72;
    return index===total-1?0.9:0.82;
  }

  function balanceCompetitionArc(arcPlan){
    const blocked={version:1,kind:'cheer-fx-competition-balance-plan',status:'blocked',reason:'cheer-fx-arc-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,sections:[],balanceRisks:[],riskFlags:[]};
    if(!arcPlan||arcPlan.kind!=='cheer-fx-arc-plan')return blocked;
    if(arcPlan.status==='blocked')return {...blocked,reason:'cheer-fx-arc-plan-blocked'};

    const source=Array.isArray(arcPlan.sections)?arcPlan.sections:[];
    const sections=source.map((section,index)=>{
      const intensity=sectionIntensity(section);
      const ceiling=targetCeiling(section,index,source.length);
      let directive='hold';
      if(intensity>ceiling+0.06)directive='reduce-section-fx';
      else if((section.section==='pyramid'||section.section==='ending')&&intensity<ceiling-0.22)directive='reserve-and-build-peak';
      return {...section,competitionIntensity:intensity,targetCeiling:ceiling,balanceDirective:directive};
    });

    const balanceRisks=[];
    for(let i=0;i<sections.length;i++){
      const current=sections[i];
      if(current.competitionIntensity>current.targetCeiling+0.06){
        balanceRisks.push({type:'section-over-ceiling',section:current.section,index:i});
      }
      if(i>0){
        const prev=sections[i-1];
        if(prev.competitionIntensity>0.84&&current.competitionIntensity>0.84){
          balanceRisks.push({type:'consecutive-major-peaks',sections:[prev.section,current.section],index:i});
        }
      }
    }

    const endingIndex=sections.findIndex(section=>section.section==='ending');
    const pyramidIndex=sections.findIndex(section=>section.section==='pyramid');
    if(endingIndex>=0){
      const ending=sections[endingIndex];
      const earlierPeak=Math.max(0,...sections.slice(0,endingIndex).map(section=>section.competitionIntensity));
      if(earlierPeak>ending.competitionIntensity+0.08){
        balanceRisks.push({type:'ending-lacks-final-headroom',section:'ending',earlierPeak,endingIntensity:ending.competitionIntensity});
        ending.balanceDirective='strengthen-final-peak';
      }
    }
    if(pyramidIndex>=0&&endingIndex>pyramidIndex){
      const pyramid=sections[pyramidIndex];
      const ending=sections[endingIndex];
      if(pyramid.competitionIntensity>=ending.competitionIntensity-0.02&&pyramid.competitionIntensity>0.9){
        balanceRisks.push({type:'pyramid-consumes-ending-headroom',sections:['pyramid','ending']});
        pyramid.balanceDirective='trim-pyramid-peak';
      }
    }

    const riskFlags=[...(Array.isArray(arcPlan.riskFlags)?arcPlan.riskFlags:[])];
    if(balanceRisks.length)riskFlags.push('fx-competition-balance-risk');
    const status=balanceRisks.length||arcPlan.status!=='preview-ready'?'review-required':'preview-ready';

    return {
      version:1,kind:'cheer-fx-competition-balance-plan',status,bpm:arcPlan.bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      sections,balanceRisks,riskFlags:[...new Set(riskFlags)],
      summary:{
        sections:sections.length,
        risks:balanceRisks.length,
        maxIntensity:sections.length?Math.max(...sections.map(section=>section.competitionIntensity)):0,
        readyForPreview:status==='preview-ready'
      }
    };
  }

  const api={SECTION_WEIGHT,sectionIntensity,targetCeiling,balanceCompetitionArc};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxCompetitionBalanceCore=api;
})();
