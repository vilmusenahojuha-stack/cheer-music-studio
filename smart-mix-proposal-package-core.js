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

  function mergeReviewedTransitions(sequence=[],reviewTransitions=[]){
    const reviewed=Array.isArray(reviewTransitions)?reviewTransitions:[];
    return (Array.isArray(sequence)?sequence:[]).map((step,index)=>{
      if(index===0)return {...step,transition:null};
      const existing=step?.transition||{};
      const byIndex=reviewed.find(t=>finite(t?.index,-1)===index);
      const bySections=reviewed.find(t=>(t?.fromSectionId||null)===(sequence[index-1]?.sectionId||null)&&(t?.toSectionId||null)===(step?.sectionId||null));
      const quality=byIndex||bySections||null;
      if(!quality)return {...step,transition:existing};
      return {...step,transition:{
        ...existing,
        qualityScore:quality.score==null?existing.qualityScore:clamp01(quality.score),
        qualityRating:quality.rating||existing.qualityRating||'unavailable',
        qualityReasons:Array.isArray(quality.reasons)?quality.reasons:(existing.qualityReasons||[]),
        qualityComponents:quality.components||existing.qualityComponents||null,
        combinedScore:quality.combinedScore==null?existing.combinedScore:clamp01(quality.combinedScore)
      }};
    });
  }

  function transitionDecision(step={}){
    const sectionType=String(step?.sectionType||'other');
    const transition=step?.transition||{};
    const rating=String(transition.qualityRating||'unavailable');
    const components=transition.qualityComponents||{};
    const reasons=new Set(Array.isArray(transition.qualityReasons)?transition.qualityReasons:[]);
    const highImpact=['stunt','basket','pyramid','ending'].includes(sectionType);
    const flow=['dance','tumbling','transition'].includes(sectionType);
    const structure=clamp01(components.structure);
    const energy=clamp01(components.energy);
    const cut=clamp01(components.cut);

    if(rating==='risky'||rating==='weak'||reasons.has('weak-cut-point')||reasons.has('weak-break-drop-structure')){
      return {type:'guarded-cut',countLength:0,reason:'quality-protection',rating,highImpact,flow};
    }
    if(highImpact&&(structure>=.62||cut>=.62||['strong','good'].includes(rating))){
      return {type:'impact-cut',countLength:0,reason:'high-impact-entry',rating,highImpact,flow};
    }
    if(flow&&energy>=.58&&['strong','good'].includes(rating)){
      return {type:'flow-blend',countLength:0,reason:'flow-continuity',rating,highImpact,flow};
    }
    return {type:'clean-cut',countLength:0,reason:'neutral-boundary',rating,highImpact,flow};
  }

  function transitionFadeSeconds(step={},bpm){
    const tempo=finite(bpm);
    if(!(tempo>0))return 0;
    const countSeconds=60/tempo;
    const decision=transitionDecision(step);
    let seconds=.014;
    if(decision.type==='impact-cut')seconds=.008;
    else if(decision.type==='flow-blend')seconds=String(step?.sectionType)==='transition'?.024:.020;
    else if(decision.type==='guarded-cut')seconds=.032;
    return Math.min(countSeconds*.10,seconds);
  }

  function applyCountSafeMicrofades(clips=[],sequence=[],bpm){
    const transitions=[];
    for(let i=1;i<clips.length;i++){
      const previous=clips[i-1],current=clips[i],step=sequence[i]||{};
      const fade=transitionFadeSeconds(step,bpm);
      if(!(fade>0))continue;
      const decision=transitionDecision(step);
      previous.fadeOut=Math.max(finite(previous.fadeOut),fade);
      current.fadeIn=Math.max(finite(current.fadeIn),fade);
      const applied={
        fromSectionId:previous?.smartMix?.sectionId||null,
        toSectionId:current?.smartMix?.sectionId||null,
        type:decision.type,
        renderMode:'count-safe-microfade',
        decisionReason:decision.reason,
        countLength:decision.countLength,
        fadeSeconds:fade,
        qualityScore:step?.transition?.qualityScore==null?null:clamp01(step.transition.qualityScore),
        qualityRating:decision.rating,
        qualityReasons:Array.isArray(step?.transition?.qualityReasons)?step.transition.qualityReasons:[],
        qualityComponents:step?.transition?.qualityComponents||null,
        preservesTimelineStart:true,
        preservesTimelineDuration:true,
        preservesSourceOffset:true
      };
      transitions.push(applied);
      previous.smartMix={...(previous.smartMix||{}),transitionOut:applied};
      current.smartMix={...(current.smartMix||{}),transitionIn:applied};
    }
    return transitions;
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
    const appliedTransitions=applyCountSafeMicrofades(clips,sequence,tempo);
    return {
      status:risks.length?'review-required':'preview-ready',
      reason:risks.length?'incomplete-source-timeline-data':null,
      clips,
      transitions:appliedTransitions,
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

    const normalized=normalizeSequence(optimized?.sequence);
    const sequence=mergeReviewedTransitions(normalized,review?.transitions);
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
        renderedTransitions:audioTimelinePlan.transitions.length,
        transitionTypes:audioTimelinePlan.transitions.reduce((out,t)=>{out[t.type]=(out[t.type]||0)+1;return out;},{}),
        editActions:Array.isArray(editPlan?.actions)?editPlan.actions.length:0,
        timelineClips:audioTimelinePlan.clips.length,
        timelineDuration:audioTimelinePlan.duration,
        conflicts:Array.isArray(editPlan?.conflicts)?editPlan.conflicts.length:0,
        riskCount:risks.length,
        readyForPreview:status==='preview-ready'
      }
    };
  }

  const api={normalizeSequence,mergeReviewedTransitions,transitionDecision,transitionFadeSeconds,applyCountSafeMicrofades,buildAudioTimelinePlan,collectRisks,packageStatus,createProposalPackage};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixProposalPackageCore=api;
})();
