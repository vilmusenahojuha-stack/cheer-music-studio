(()=>{
  'use strict';

  const DEFAULTS=Object.freeze({minCounts:2,maxCounts:4,charsPerSecond:12.5,punctuationPauseSeconds:0.12});
  function finite(value,fallback=null){if(value==null||value==='')return fallback;const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function normalizeText(value){return String(value||'').trim().replace(/\s+/g,' ');}
  function estimateSpeech(text,options={}){
    text=normalizeText(text);
    const cps=finite(options.charsPerSecond,DEFAULTS.charsPerSecond);
    const pause=finite(options.punctuationPauseSeconds,DEFAULTS.punctuationPauseSeconds);
    const spokenChars=text.replace(/\s/g,'').length;
    const punctuation=(text.match(/[,.!?;:]/g)||[]).length;
    const seconds=text?spokenChars/Math.max(1,cps)+punctuation*Math.max(0,pause):0;
    return {text,spokenChars,punctuation,estimatedSeconds:Number(seconds.toFixed(3))};
  }
  function rhythmFor(counts){
    if(counts<=2)return {shape:'hit',attackCount:1,releaseCount:2,accentCounts:[1]};
    if(counts===3)return {shape:'callout',attackCount:1,releaseCount:3,accentCounts:[1,3]};
    return {shape:'phrase',attackCount:1,releaseCount:4,accentCounts:[1,3]};
  }
  function fitTextToSlot(slot,text,bpm,options={}){
    const speech=estimateSpeech(text,options);
    const beatSeconds=60/bpm;
    const globalMax=Math.max(DEFAULTS.minCounts,Math.min(DEFAULTS.maxCounts,Math.floor(finite(options.maxCounts,DEFAULTS.maxCounts))));
    const slotMax=Math.max(DEFAULTS.minCounts,Math.min(globalMax,Math.floor(finite(slot?.maxDurationCounts,globalMax))));
    const rawCounts=speech.estimatedSeconds>0?Math.ceil(speech.estimatedSeconds/beatSeconds):DEFAULTS.minCounts;
    const requiredCounts=Math.max(DEFAULTS.minCounts,rawCounts);
    const assignedCounts=Math.min(requiredCounts,slotMax);
    const overByCounts=Math.max(0,requiredCounts-slotMax);
    const availableSeconds=Number((assignedCounts*beatSeconds).toFixed(3));
    const risks=[];
    if(!speech.text)risks.push('voiceover-text-required');
    if(overByCounts>0)risks.push('voiceover-text-too-long');
    if(slot?.requiresReview)risks.push('voiceover-placement-review-required');
    return {
      slotId:slot?.id||null,sectionId:slot?.sectionId||null,sectionType:slot?.sectionType||'other',eight:finite(slot?.eight),startCount:finite(slot?.count,1),
      text:speech.text,estimatedSeconds:speech.estimatedSeconds,beatSeconds:Number(beatSeconds.toFixed(3)),requiredCounts,assignedCounts,maxCounts:slotMax,availableSeconds,overByCounts,
      rhythm:rhythmFor(assignedCounts),risks,requiresReview:risks.length>0,
      recommendation:overByCounts>0?'shorten-text':'fit-ready'
    };
  }
  function buildVoiceoverRhythmPlan(input={},options={}){
    const blocked={version:1,kind:'cheer-voiceover-rhythm-plan',status:'blocked',reason:'voiceover-placement-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,items:[],riskFlags:[],summary:{items:0,ready:0,review:0}};
    input=input||{};
    const placement=input.placementPlan||input.voiceoverPlacementPlan||input;
    if(!placement||placement.kind!=='cheer-voiceover-placement-plan')return blocked;
    if(placement.status==='blocked')return {...blocked,reason:'voiceover-placement-plan-blocked'};
    const bpm=finite(input.bpm,finite(placement.bpm));
    if(!(bpm>0))return {...blocked,reason:'voiceover-bpm-required'};
    const slots=Array.isArray(placement.slots)?placement.slots:[];
    if(!slots.length)return {...blocked,reason:'voiceover-slots-required'};

    const textBySlot=new Map();
    const entries=Array.isArray(input.entries)?input.entries:[];
    for(const entry of entries){if(entry?.slotId)textBySlot.set(String(entry.slotId),normalizeText(entry.text));}
    const defaults=input.textBySection&&typeof input.textBySection==='object'?input.textBySection:{};
    const items=slots.map(slot=>fitTextToSlot(slot,textBySlot.get(String(slot.id))??defaults[slot.sectionType]??'',bpm,options));
    const riskFlags=new Set(Array.isArray(placement.riskFlags)?placement.riskFlags:[]);
    for(const item of items)for(const risk of item.risks)riskFlags.add(risk);
    const review=items.filter(item=>item.requiresReview);
    const ready=items.length-review.length;
    const status=placement.status==='review-required'||review.length||riskFlags.size?'review-required':'preview-ready';
    return {version:1,kind:'cheer-voiceover-rhythm-plan',status,reason:null,bpm,nonDestructive:true,executable:false,safePreviewOnly:true,items,riskFlags:[...riskFlags],summary:{items:items.length,ready,review:review.length}};
  }

  const api={DEFAULTS,normalizeText,estimateSpeech,rhythmFor,fitTextToSlot,buildVoiceoverRhythmPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverRhythmCore=api;
})();
