(()=>{
  'use strict';

  const PROFILE=Object.freeze({
    id:'fi-cheer-master-final-check-v1',
    advisoryOnly:true,
    maxTruePeakDbtp:-1,
    minLoudnessRangeLu:3,
    maxLoudnessRangeLu:10,
    maxSectionPeakSpreadDb:4.5,
    minVoiceoverClarityScore:0.72,
    minFxClarityScore:0.68
  });

  function finite(value,fallback=null){
    if(value===null||value===undefined||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function array(value){return Array.isArray(value)?value:[];}
  function addRisk(set,value,when=true){if(when)set.add(value);}

  function weakestFailedFocus(section){
    const candidates=[];
    if(section?.voiceover?.ready===false&&section.voiceover?.weakestItem){
      const item=section.voiceover.weakestItem;
      candidates.push({kind:'voiceover',startSeconds:finite(item.start),endSeconds:finite(item.end),score:finite(item.score),minScore:finite(section.voiceover.minScore,PROFILE.minVoiceoverClarityScore)});
    }
    if(section?.fx?.ready===false&&section.fx?.weakestItem){
      const item=section.fx.weakestItem;
      candidates.push({kind:'fx',startSeconds:finite(item.start),endSeconds:finite(item.end),score:finite(item.score),minScore:finite(section.fx.minScore,PROFILE.minFxClarityScore)});
    }
    return candidates.filter(item=>item.startSeconds!==null).sort((a,b)=>(a.score-a.minScore)-(b.score-b.minScore))[0]||null;
  }

  function sectionClarityIssues(sectionClarity){
    if(!sectionClarity||sectionClarity.kind!=='cheer-competition-master-section-clarity')return [];
    return array(sectionClarity.sections)
      .filter(section=>section?.status==='review-required')
      .map(section=>{
        const focus=weakestFailedFocus(section);
        return {
          sectionId:section.id||null,
          label:section.label||section.type||section.id||'Section',
          type:section.type||'section',
          startSeconds:finite(section.start),
          endSeconds:finite(section.end),
          focusKind:focus?.kind||null,
          focusStartSeconds:focus?.startSeconds??finite(section.start),
          focusEndSeconds:focus?.endSeconds??finite(section.end),
          voiceoverFailed:section.voiceover?.ready===false,
          fxFailed:section.fx?.ready===false,
          voiceoverScore:finite(section.voiceover?.score),
          fxScore:finite(section.fx?.score),
          voiceoverWeakestItem:section.voiceover?.weakestItem||null,
          fxWeakestItem:section.fx?.weakestItem||null,
          riskFlags:array(section.riskFlags)
        };
      });
  }

  function buildCompetitionMasterFinalCheck(input={}){
    input=input||{};
    const base={
      version:1,
      kind:'cheer-competition-master-final-check',
      profile:PROFILE.id,
      advisoryOnly:true,
      status:'blocked',
      reason:'master-preview-required',
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      renderAllowed:false,
      checks:{},
      riskFlags:[],
      recommendations:[],
      sectionIssues:[]
    };

    const preview=input.preview||input.masterPreview||null;
    if(!preview||preview.kind!=='cheer-competition-master-preview')return base;
    if(preview.status==='blocked')return {...base,reason:'master-preview-blocked'};

    const readiness=input.readiness||input.masterReadiness||null;
    if(!readiness||readiness.kind!=='cheer-competition-master-readiness')return {...base,reason:'master-readiness-required'};
    if(readiness.status==='blocked')return {...base,reason:'master-readiness-blocked'};

    const metrics=input.metrics||input.masterMetrics||null;
    if(!metrics)return {...base,reason:'master-metrics-required'};

    const truePeak=finite(metrics.truePeakDbtp);
    const lra=finite(metrics.loudnessRangeLu);
    if(truePeak===null)return {...base,reason:'true-peak-required'};
    if(lra===null)return {...base,reason:'loudness-range-required'};

    const risks=new Set([...array(readiness.riskFlags),...array(preview.riskFlags),...array(input.riskFlags)]);
    const recommendations=[];

    const truePeakReady=truePeak<=PROFILE.maxTruePeakDbtp;
    addRisk(risks,'final-true-peak-headroom-failed',!truePeakReady);
    if(!truePeakReady)recommendations.push('resolve-true-peak-before-final-master');

    const lraReady=lra>=PROFILE.minLoudnessRangeLu&&lra<=PROFILE.maxLoudnessRangeLu;
    addRisk(risks,'final-dynamics-check-failed',!lraReady);
    if(!lraReady)recommendations.push('resolve-macro-dynamics-before-final-master');

    const sectionPeaks=array(metrics.sectionPeaksDb).map(v=>finite(v)).filter(Number.isFinite);
    let sectionSpreadDb=null;
    let sectionReady=null;
    if(sectionPeaks.length>=2){
      sectionSpreadDb=Math.max(...sectionPeaks)-Math.min(...sectionPeaks);
      sectionReady=sectionSpreadDb<=PROFILE.maxSectionPeakSpreadDb;
      addRisk(risks,'final-section-balance-failed',!sectionReady);
      if(!sectionReady)recommendations.push('rebalance-sections-before-final-master');
    }else{
      risks.add('final-section-peak-data-incomplete');
      recommendations.push('measure-section-peaks-before-final-master');
    }

    const voiceoverClarity=finite(metrics.voiceoverClarityScore);
    const voiceoverReady=voiceoverClarity===null?null:voiceoverClarity>=PROFILE.minVoiceoverClarityScore;
    if(voiceoverClarity===null){
      risks.add('final-voiceover-clarity-unmeasured');
      recommendations.push('measure-voiceover-clarity');
    }else if(!voiceoverReady){
      risks.add('final-voiceover-clarity-failed');
      recommendations.push('improve-voiceover-separation');
    }

    const fxClarity=finite(metrics.fxClarityScore);
    const fxReady=fxClarity===null?null:fxClarity>=PROFILE.minFxClarityScore;
    if(fxClarity===null){
      risks.add('final-fx-clarity-unmeasured');
      recommendations.push('measure-fx-clarity');
    }else if(!fxReady){
      risks.add('final-fx-clarity-failed');
      recommendations.push('reduce-fx-masking');
    }

    const sectionClarity=metrics.sectionClarity||input.sectionClarity||null;
    const sectionIssues=sectionClarityIssues(sectionClarity);
    const sectionClarityReady=sectionClarity?.summary?.status==='clear'?true:sectionIssues.length?false:null;
    addRisk(risks,'final-section-clarity-failed',sectionIssues.length>0);
    if(sectionIssues.length)recommendations.push('resolve-section-clarity-before-final-master');

    const hasHold=array(preview.actions).some(a=>a&&a.type==='pre-master-hold');
    addRisk(risks,'final-preview-hold-active',hasHold);
    if(hasHold)recommendations.push('resolve-master-preview-hold');

    const upstreamReview=readiness.status==='review-required'||preview.status==='review-required';
    addRisk(risks,'final-upstream-review-required',upstreamReview);

    const blockingRisks=[
      'final-true-peak-headroom-failed',
      'final-dynamics-check-failed',
      'final-section-balance-failed',
      'final-section-peak-data-incomplete',
      'final-voiceover-clarity-unmeasured',
      'final-voiceover-clarity-failed',
      'final-fx-clarity-unmeasured',
      'final-fx-clarity-failed',
      'final-section-clarity-failed',
      'final-preview-hold-active',
      'final-upstream-review-required'
    ];
    const finalReady=!blockingRisks.some(r=>risks.has(r));

    return {
      version:4,
      kind:'cheer-competition-master-final-check',
      profile:PROFILE.id,
      advisoryOnly:true,
      status:finalReady?'preview-approved':'review-required',
      reason:null,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      renderAllowed:false,
      checks:{
        truePeak:{valueDbtp:truePeak,limitDbtp:PROFILE.maxTruePeakDbtp,ready:truePeakReady},
        loudnessRange:{valueLu:lra,minLu:PROFILE.minLoudnessRangeLu,maxLu:PROFILE.maxLoudnessRangeLu,ready:lraReady},
        sectionBalance:{spreadDb:sectionSpreadDb,maxSpreadDb:PROFILE.maxSectionPeakSpreadDb,ready:sectionReady},
        voiceoverClarity:{score:voiceoverClarity,minScore:PROFILE.minVoiceoverClarityScore,ready:voiceoverReady},
        fxClarity:{score:fxClarity,minScore:PROFILE.minFxClarityScore,ready:fxReady},
        sectionClarity:{
          status:sectionClarity?.summary?.status||'unavailable',
          sectionsMeasured:finite(sectionClarity?.summary?.sectionsMeasured,0),
          sectionsReviewRequired:sectionIssues.length,
          weakestSectionId:sectionClarity?.summary?.weakestSectionId||null,
          weakestSectionLabel:sectionClarity?.summary?.weakestSectionLabel||null,
          ready:sectionClarityReady
        },
        previewHold:{active:hasHold,ready:!hasHold},
        upstream:{readinessStatus:readiness.status,previewStatus:preview.status,ready:!upstreamReview}
      },
      sectionIssues,
      riskFlags:[...risks],
      recommendations:[...new Set(recommendations)],
      summary:{
        finalReady,
        nextStep:finalReady?'final-master-render-may-be-considered-manually':'resolve-final-check-risks',
        note:'advisory QA only; this result never authorizes automatic rendering or overwriting'
      }
    };
  }

  const api={PROFILE,weakestFailedFocus,sectionClarityIssues,buildCompetitionMasterFinalCheck};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerCompetitionMasterFinalCheckCore=api;
})();