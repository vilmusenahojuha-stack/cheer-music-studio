(()=>{
  'use strict';

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}

  function defaultIterativeCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-iterative-reoptimizer-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixIterativeReoptimizerCore||null;
    return null;
  }
  function defaultReviewCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-sequence-review-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixSequenceReviewCore||null;
    return null;
  }
  function defaultActionsCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./smart-mix-actions-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.SmartMixActionsCore||null;
    return null;
  }

  function normalizeSequence(sequence=[]){
    return (Array.isArray(sequence)?sequence:[]).map((step,index)=>({
      order:index+1,
      sectionId:step?.sectionId||null,
      sectionType:step?.sectionType||step?.sectionId||'other',
      startEight:finite(step?.candidate?.startEight,null),
      endEight:finite(step?.candidate?.endEight,null),
      matchScore:step?.candidate?.score==null?null:clamp01(step.candidate.score),
      transition:step?.transition||null
    }));
  }

  function collectRisks(review={},editPlan=null,iterative=null){
    const risks=new Set(Array.isArray(review?.riskFlags)?review.riskFlags:[]);
    if(editPlan?.conflicts?.length)risks.add('edit-action-conflict');
    if(editPlan&&!editPlan?.summary?.readyForPreview)risks.add('edit-plan-not-preview-ready');
    if(iterative?.reason==='cycle-detected')risks.add('optimization-cycle-detected');
    if(iterative?.reason==='max-iterations-reached')risks.add('optimization-limit-reached');
    if(iterative?.nonDestructive===false)risks.add('unsafe-optimization-result');
    return [...risks];
  }

  function packageStatus({review,editPlan,risks}){
    if(!review)return 'blocked';
    if(risks.includes('edit-action-conflict')||risks.includes('unsafe-optimization-result'))return 'blocked';
    if(review.readyForPreview&&(!editPlan||editPlan.summary?.readyForPreview))return 'preview-ready';
    return 'review-required';
  }

  function createProposalPackage(input={},options={}){
    const iterativeCore=options.iterativeCore||defaultIterativeCore();
    const reviewCore=options.reviewCore||defaultReviewCore();
    const actionsCore=options.actionsCore||defaultActionsCore();
    if(!reviewCore?.reviewSequence){
      return {version:1,status:'blocked',reason:'review-core-unavailable',nonDestructive:true,executable:false};
    }

    const initial=input.optimized||input.sequenceResult||{};
    let iterative=null;
    let optimized=initial;
    if(options.reoptimize!==false&&iterativeCore?.improveIteratively&&input.matchPlan){
      iterative=iterativeCore.improveIteratively(input.matchPlan,initial,options.iterativeOptions||{});
      optimized=iterative?.optimized||initial;
    }

    const review=iterative?.finalReview||reviewCore.reviewSequence(optimized,options.reviewOptions||{});
    let editPlan=null;
    if(actionsCore?.createEditPlan&&input.smartMixProposal){
      try{editPlan=actionsCore.createEditPlan(input.smartMixProposal,options.actionOptions||{});}catch(error){
        editPlan={error:String(error?.message||error),actions:[],conflicts:[],summary:{actions:0,conflicts:0,readyForPreview:false},safePreviewOnly:true,executable:false};
      }
    }

    const sequence=normalizeSequence(optimized?.sequence);
    const risks=collectRisks(review,editPlan,iterative);
    const status=packageStatus({review,editPlan,risks});
    const bpm=finite(input?.smartMixProposal?.bpm,input?.bpm||0);

    return {
      version:1,
      kind:'smart-mix-2-proposal-package',
      status,
      bpm:bpm>0?bpm:null,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      sequence,
      transitions:Array.isArray(review?.transitions)?review.transitions:[],
      editPlan,
      quality:{
        globalScore:clamp01(review?.globalScore),
        quality:review?.quality||null,
        matchScore:clamp01(review?.matchScore),
        transitionAverage:clamp01(review?.transitionAverage),
        weakestScore:clamp01(review?.weakestScore),
        coverage:clamp01(review?.coverage)
      },
      weakestTransition:review?.weakestTransition||null,
      recommendation:review?.recommendation||null,
      risks,
      optimization:iterative?{
        improved:Boolean(iterative.improved),
        converged:Boolean(iterative.converged),
        iterations:finite(iterative.iterations),
        totalImprovement:finite(iterative.totalImprovement),
        reason:iterative.reason||null,
        history:Array.isArray(iterative.history)?iterative.history:[]
      }:null,
      summary:{
        sections:sequence.length,
        transitions:Array.isArray(review?.transitions)?review.transitions.length:0,
        editActions:Array.isArray(editPlan?.actions)?editPlan.actions.length:0,
        conflicts:Array.isArray(editPlan?.conflicts)?editPlan.conflicts.length:0,
        riskCount:risks.length,
        readyForPreview:status==='preview-ready'
      }
    };
  }

  const api={normalizeSequence,collectRisks,packageStatus,createProposalPackage};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixProposalPackageCore=api;
})();
