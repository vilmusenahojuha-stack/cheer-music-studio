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
      sourceName:step?.candidate?.sourceName||null,
      trackId:step?.candidate?.trackId||null,
      sourceStart:step?.candidate?.start==null?null:finite(step.candidate.start),
      sourceEnd:step?.candidate?.end==null?null:finite(step.candidate.end),
      startEight:finite(step?.candidate?.startEight,null),
      endEight:finite(step?.candidate?.endEight,null),
      matchScore:step?.candidate?.score==null?null:clamp01(step.candidate.score),
      transition:step?.transition||null
    }));
  }

  function buildAudioTimelinePlan(sequence=[],bpm,{startAt=0}={}){
    const tempo=finite(bpm);
    if(!(tempo>0))return {status:'blocked',reason:'bpm-required',clips:[],duration:0,compatibleWith:'audioTimeline.clips',nonDestructive:true,executable:false};
    const eightSeconds=480/tempo;
    let cursor=Math.max(0,finite(startAt));
    const clips=[];
    const risks=[];
    for(const step of Array.isArray(sequence)?sequence:[]){
      const firstEight=finite(step?.startEight,null),lastEight=finite(step?.endEight,null);
      const count=firstEight==null||lastEight==null?0:Math.max(0,lastEight-firstEight+1);
      const sourceOffset=finite(step?.sourceStart,-1);
      const sourceEnd=finite(step?.sourceEnd,-1);
      if(!step?.sourceName||count<1||sourceOffset<0){
        risks.push({sectionId:step?.sectionId||null,reason:'missing-source-timeline-data'});
        continue;
      }
      const duration=count*eightSeconds;
      if(sourceEnd>=0&&sourceEnd-sourceOffset<=0){
        risks.push({sectionId:step?.sectionId||null,reason:'invalid-source-range'});
        continue;
      }
      clips.push({
        id:`smartmix-${step.order}-${String(step.sectionId||step.sectionType||'section').replace(/[^a-z0-9_-]+/gi,'-')}`,
        type:'music',
        sourceName:step.sourceName,
        sourceTrackId:step.trackId||null,
        name:step.sourceName,
        start:cursor,
        sourceOffset,
        duration,
        volume:1,
        fadeIn:0,
        fadeOut:0,
        smartMix:{sectionId:step.sectionId||null,sectionType:step.sectionType||'other',sourceStartEight:firstEight,sourceEndEight:lastEight,matchScore:step.matchScore}
      });
      cursor+=duration;
    }
    return {
      status:risks.length?'review-required':'preview-ready',
      reason:risks.length?'incomplete-source-timeline-data':null,
      clips,
      duration:Math.max(0,cursor-Math.max(0,finite(startAt))),
      startAt:Math.max(0,finite(startAt)),
      bpm:tempo,
      eightSeconds,
      risks,
      compatibleWith:'audioTimeline.clips',
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true
    };
  }

  function collectRisks(review={},editPlan=null,iterative=null,audioTimelinePlan=null){
    const risks=new Set(Array.isArray(review?.riskFlags)?review.riskFlags:[]);
    if(editPlan?.conflicts?.length)risks.add('edit-action-conflict');
    if(editPlan&&!editPlan?.summary?.readyForPreview)risks.add('edit-plan-not-preview-ready');
    if(iterative?.reason==='cycle-detected')risks.add('optimization-cycle-detected');
    if(iterative?.reason==='max-iterations-reached')risks.add('optimization-limit-reached');
    if(iterative?.nonDestructive===false)risks.add('unsafe-optimization-result');
    if(audioTimelinePlan?.status==='review-required')risks.add('audio-timeline-plan-incomplete');
    return [...risks];
  }

  function packageStatus({review,editPlan,risks,audioTimelinePlan}){
    if(!review)return 'blocked';
    if(risks.includes('edit-action-conflict')||risks.includes('unsafe-optimization-result'))return 'blocked';
    if(audioTimelinePlan?.status==='blocked')return 'blocked';
    if(review.readyForPreview&&(!editPlan||editPlan.summary?.readyForPreview)&&audioTimelinePlan?.status==='preview-ready')return 'preview-ready';
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
    const bpm=finite(input?.smartMixProposal?.bpm,input?.bpm||0);
    const audioTimelinePlan=buildAudioTimelinePlan(sequence,bpm,{startAt:options.timelineStartAt||0});
    const risks=collectRisks(review,editPlan,iterative,audioTimelinePlan);
    const status=packageStatus({review,editPlan,risks,audioTimelinePlan});

    return {
      version:1,
      kind:'smart-mix-2-proposal-package',
      status,
      bpm:bpm>0?bpm:null,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true,
      sequence,
      audioTimelinePlan,
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
        timelineClips:audioTimelinePlan.clips.length,
        timelineDuration:audioTimelinePlan.duration,
        conflicts:Array.isArray(editPlan?.conflicts)?editPlan.conflicts.length:0,
        riskCount:risks.length,
        readyForPreview:status==='preview-ready'
      }
    };
  }

  const api={normalizeSequence,buildAudioTimelinePlan,collectRisks,packageStatus,createProposalPackage};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixProposalPackageCore=api;
})();
