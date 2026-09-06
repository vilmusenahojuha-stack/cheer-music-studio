(()=>{
  'use strict';

  const PROFILE=Object.freeze({
    id:'fi-cheer-preview-v1',
    advisoryOnly:true,
    maxTruePeakDbtp:-1,
    minHeadroomDb:1,
    minLoudnessRangeLu:3,
    maxLoudnessRangeLu:10,
    maxPeakSectionSpreadDb:4.5
  });

  function finite(value,fallback=null){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function array(value){return Array.isArray(value)?value:[];}
  function risk(set,value,when=true){if(when)set.add(value);}

  function buildCompetitionMasterReadiness(input={}){
    input=input||{};
    const base={
      version:1,
      kind:'cheer-competition-master-readiness',
      profile:PROFILE.id,
      advisoryOnly:true,
      status:'blocked',
      reason:'master-analysis-required',
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      riskFlags:[],
      checks:{},
      recommendations:[]
    };

    const metrics=input.metrics||input.masterMetrics||null;
    if(!metrics)return {...base,reason:'master-metrics-required'};

    const truePeak=finite(metrics.truePeakDbtp);
    const lra=finite(metrics.loudnessRangeLu);
    const sectionPeaks=array(metrics.sectionPeaksDb).map(finite).filter(Number.isFinite);
    if(truePeak===null)return {...base,reason:'true-peak-required'};
    if(lra===null)return {...base,reason:'loudness-range-required'};

    const voiceover=input.voiceoverPackage||null;
    if(!voiceover||voiceover.kind!=='cheer-voiceover-competition-package')return {...base,reason:'voiceover-package-required'};
    if(voiceover.status==='blocked')return {...base,reason:'voiceover-package-blocked'};

    const risks=new Set(array(input.riskFlags));
    const recommendations=[];
    const headroomDb=Math.max(0,-truePeak);
    const truePeakReady=truePeak<=PROFILE.maxTruePeakDbtp;
    risk(risks,'insufficient-true-peak-headroom',!truePeakReady);
    if(!truePeakReady)recommendations.push('create-peak-headroom');

    const lraReady=lra>=PROFILE.minLoudnessRangeLu&&lra<=PROFILE.maxLoudnessRangeLu;
    risk(risks,'master-overcompressed',lra<PROFILE.minLoudnessRangeLu);
    risk(risks,'master-dynamics-too-wide',lra>PROFILE.maxLoudnessRangeLu);
    if(lra<PROFILE.minLoudnessRangeLu)recommendations.push('restore-macro-dynamics');
    if(lra>PROFILE.maxLoudnessRangeLu)recommendations.push('control-macro-dynamics');

    let spreadDb=null;
    if(sectionPeaks.length>=2){
      spreadDb=Math.max(...sectionPeaks)-Math.min(...sectionPeaks);
      if(spreadDb>PROFILE.maxPeakSectionSpreadDb){
        risks.add('section-peak-balance-wide');
        recommendations.push('rebalance-section-peaks');
      }
    }else{
      risks.add('section-peak-data-incomplete');
    }

    const voReview=voiceover.status==='review-required'||array(voiceover.selected).some(item=>item?.status==='review-required');
    risk(risks,'voiceover-master-review-required',voReview);
    if(voReview)recommendations.push('resolve-voiceover-review-before-master');

    const ready=!risks.has('insufficient-true-peak-headroom')
      &&!risks.has('master-overcompressed')
      &&!risks.has('master-dynamics-too-wide')
      &&!risks.has('section-peak-balance-wide')
      &&!risks.has('voiceover-master-review-required');

    return {
      version:1,
      kind:'cheer-competition-master-readiness',
      profile:PROFILE.id,
      advisoryOnly:true,
      status:ready?'preview-ready':'review-required',
      reason:null,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      checks:{
        truePeak:{valueDbtp:truePeak,headroomDb,limitDbtp:PROFILE.maxTruePeakDbtp,ready:truePeakReady},
        loudnessRange:{valueLu:lra,minLu:PROFILE.minLoudnessRangeLu,maxLu:PROFILE.maxLoudnessRangeLu,ready:lraReady},
        sectionPeakBalance:{spreadDb,maxSpreadDb:PROFILE.maxPeakSectionSpreadDb,ready:spreadDb===null?null:spreadDb<=PROFILE.maxPeakSectionSpreadDb},
        voiceover:{status:voiceover.status,ready:!voReview}
      },
      riskFlags:[...risks],
      recommendations:[...new Set(recommendations)],
      preview:{
        rule:'advisory Finnish cheer competition master readiness only; never render, normalize, limit or overwrite audio automatically',
        nextStep:ready?'master-preview-can-be-planned':'resolve-readiness-risks-first'
      }
    };
  }

  const api={PROFILE,buildCompetitionMasterReadiness};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerCompetitionMasterReadinessCore=api;
})();
