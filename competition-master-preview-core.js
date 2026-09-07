(()=>{
  'use strict';

  const DEFAULTS=Object.freeze({
    id:'fi-cheer-master-preview-v1',
    advisoryOnly:true,
    targetTruePeakDbtp:-1,
    maxSuggestedGainDb:3,
    maxSuggestedTrimDb:3,
    sectionTargetSpreadDb:2.5
  });

  function finite(value,fallback=null){
    if(value===null||value===undefined||value==='')return fallback;
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function array(value){return Array.isArray(value)?value:[];}
  function unique(values){return [...new Set(values)];}

  function buildCompetitionMasterPreview(input={}){
    input=input||{};
    const base={
      version:1,
      kind:'cheer-competition-master-preview',
      profile:DEFAULTS.id,
      advisoryOnly:true,
      status:'blocked',
      reason:'master-readiness-required',
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      actions:[],
      riskFlags:[],
      summary:null
    };

    const readiness=input.readiness||input.masterReadiness||null;
    if(!readiness||readiness.kind!=='cheer-competition-master-readiness')return base;
    if(readiness.status==='blocked')return {...base,reason:'master-readiness-blocked'};

    const metrics=input.metrics||input.masterMetrics||null;
    if(!metrics)return {...base,reason:'master-metrics-required'};
    const truePeak=finite(metrics.truePeakDbtp);
    const lra=finite(metrics.loudnessRangeLu);
    if(truePeak===null)return {...base,reason:'true-peak-required'};
    if(lra===null)return {...base,reason:'loudness-range-required'};

    const actions=[];
    const risks=new Set(array(readiness.riskFlags));
    const recs=new Set(array(readiness.recommendations));

    if(recs.has('create-peak-headroom')||truePeak>DEFAULTS.targetTruePeakDbtp){
      const trimDb=Math.min(DEFAULTS.maxSuggestedTrimDb,Math.max(0,truePeak-DEFAULTS.targetTruePeakDbtp));
      actions.push({
        id:'peak-headroom',
        type:'gain-trim-preview',
        priority:100,
        target:'master-bus',
        suggestedDb:-Number(trimDb.toFixed(2)),
        reason:'protect-true-peak-headroom'
      });
    }

    if(recs.has('restore-macro-dynamics')){
      actions.push({
        id:'restore-dynamics',
        type:'dynamics-relief-preview',
        priority:90,
        target:'master-dynamics',
        suggestedAmount:'light',
        reason:'avoid-overcompressed-cheer-master'
      });
    }

    if(recs.has('control-macro-dynamics')){
      actions.push({
        id:'control-dynamics',
        type:'dynamics-control-preview',
        priority:85,
        target:'master-dynamics',
        suggestedAmount:'light',
        reason:'control-excessive-macro-dynamics'
      });
    }

    const sectionPeaks=array(metrics.sectionPeaksDb).map(finite).filter(Number.isFinite);
    if(recs.has('rebalance-section-peaks')&&sectionPeaks.length>=2){
      const max=Math.max(...sectionPeaks);
      const min=Math.min(...sectionPeaks);
      const midpoint=(max+min)/2;
      actions.push({
        id:'section-balance',
        type:'section-gain-balance-preview',
        priority:80,
        target:'competition-sections',
        targetSpreadDb:DEFAULTS.sectionTargetSpreadDb,
        referenceDb:Number(midpoint.toFixed(2)),
        reason:'reduce-section-peak-spread'
      });
    }

    if(recs.has('resolve-voiceover-review-before-master')){
      actions.push({
        id:'voiceover-hold',
        type:'pre-master-hold',
        priority:110,
        target:'voiceover-package',
        reason:'resolve-voiceover-before-final-master-preview'
      });
    }

    if(!actions.length){
      actions.push({
        id:'preserve-balanced-mix',
        type:'preserve-preview',
        priority:10,
        target:'master-bus',
        reason:'readiness-checks-already-balanced'
      });
    }

    const needsReview=readiness.status==='review-required'||actions.some(a=>a.type==='pre-master-hold');
    const sorted=actions.sort((a,b)=>b.priority-a.priority);

    return {
      version:1,
      kind:'cheer-competition-master-preview',
      profile:DEFAULTS.id,
      advisoryOnly:true,
      status:needsReview?'review-required':'preview-ready',
      reason:null,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      actions:sorted,
      topPriority:sorted[0]||null,
      riskFlags:unique([...risks]),
      summary:{
        truePeakDbtp:truePeak,
        loudnessRangeLu:lra,
        plannedActionCount:sorted.length,
        nextStep:needsReview?'review-master-preview':'competition-master-preview-ready'
      },
      preview:{
        rule:'advisory preview only; never apply gain, compression, limiting, normalization or rendering automatically',
        renderAllowed:false
      }
    };
  }

  const api={DEFAULTS,buildCompetitionMasterPreview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerCompetitionMasterPreviewCore=api;
})();
