(()=>{
  'use strict';

  const SECTION_PROFILE=Object.freeze({
    intro:{duckDb:-5.5,attackCounts:0.5,releaseCounts:0.75,fxClearanceCounts:0.5},
    stunt:{duckDb:-6.5,attackCounts:0.5,releaseCounts:1,fxClearanceCounts:1},
    tumbling:{duckDb:-6,attackCounts:0.5,releaseCounts:0.75,fxClearanceCounts:0.75},
    pyramid:{duckDb:-6.5,attackCounts:0.5,releaseCounts:1,fxClearanceCounts:1},
    dance:{duckDb:-5,attackCounts:0.5,releaseCounts:0.75,fxClearanceCounts:0.5},
    ending:{duckDb:-7,attackCounts:0.5,releaseCounts:1.25,fxClearanceCounts:1},
    other:{duckDb:-5.5,attackCounts:0.5,releaseCounts:0.75,fxClearanceCounts:0.5}
  });

  function finite(value,fallback=null){if(value==null||value==='')return fallback;const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function profileFor(sectionType){return SECTION_PROFILE[String(sectionType||'other')]||SECTION_PROFILE.other;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function buildReservation(item,bpm,options={}){
    const profile=profileFor(item?.sectionType);
    const assignedCounts=Math.max(0,finite(item?.assignedCounts,0));
    const startCount=finite(item?.startCount,1);
    const beatSeconds=60/bpm;
    const attackCounts=clamp(finite(options.attackCounts,profile.attackCounts),0,2);
    const releaseCounts=clamp(finite(options.releaseCounts,profile.releaseCounts),0,2);
    const fxClearanceCounts=clamp(finite(options.fxClearanceCounts,profile.fxClearanceCounts),0,2);
    const requestedDuck=finite(options.duckDb,profile.duckDb);
    const duckDb=Number(clamp(requestedDuck,-9,-3).toFixed(1));
    const speechStartCount=startCount;
    const speechEndCount=Number((startCount+assignedCounts).toFixed(3));
    const reserveStartCount=Number(Math.max(0.5,speechStartCount-attackCounts).toFixed(3));
    const reserveEndCount=Number((speechEndCount+releaseCounts).toFixed(3));
    const fxAvoidStartCount=Number(Math.max(0.5,speechStartCount-fxClearanceCounts).toFixed(3));
    const fxAvoidEndCount=Number((speechEndCount+fxClearanceCounts).toFixed(3));
    const risks=[];
    if(item?.requiresReview)risks.push('voiceover-source-review-required');
    if(!item?.text)risks.push('voiceover-text-required');
    if(assignedCounts<=0)risks.push('voiceover-duration-required');
    if(reserveEndCount>9)risks.push('voiceover-reservation-crosses-eight-boundary');
    if(duckDb<=-8)risks.push('voiceover-ducking-aggressive');
    return {
      slotId:item?.slotId||null,sectionId:item?.sectionId||null,sectionType:item?.sectionType||'other',eight:finite(item?.eight),
      text:item?.text||'',bpm,beatSeconds:Number(beatSeconds.toFixed(3)),duckDb,attackCounts,releaseCounts,fxClearanceCounts,
      speechWindow:{startCount:speechStartCount,endCount:speechEndCount,durationCounts:assignedCounts,durationSeconds:Number((assignedCounts*beatSeconds).toFixed(3))},
      duckWindow:{startCount:reserveStartCount,endCount:reserveEndCount,durationCounts:Number((reserveEndCount-reserveStartCount).toFixed(3))},
      fxAvoidWindow:{startCount:fxAvoidStartCount,endCount:fxAvoidEndCount},
      musicAction:'duck-preview',fxAction:'reserve-space-preview',risks,requiresReview:risks.length>0
    };
  }
  function buildVoiceoverDuckingPlan(input={},options={}){
    const blocked={version:1,kind:'cheer-voiceover-ducking-plan',status:'blocked',reason:'voiceover-rhythm-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,reservations:[],riskFlags:[],summary:{items:0,ready:0,review:0}};
    input=input||{};
    const rhythm=input.rhythmPlan||input.voiceoverRhythmPlan||input;
    if(!rhythm||rhythm.kind!=='cheer-voiceover-rhythm-plan')return blocked;
    if(rhythm.status==='blocked')return {...blocked,reason:'voiceover-rhythm-plan-blocked'};
    const bpm=finite(input.bpm,finite(rhythm.bpm));
    if(!(bpm>0))return {...blocked,reason:'voiceover-bpm-required'};
    const items=Array.isArray(rhythm.items)?rhythm.items:[];
    if(!items.length)return {...blocked,reason:'voiceover-rhythm-items-required'};

    const reservations=items.map(item=>buildReservation(item,bpm,options));
    const riskFlags=new Set(Array.isArray(rhythm.riskFlags)?rhythm.riskFlags:[]);
    for(const item of reservations)for(const risk of item.risks)riskFlags.add(risk);
    const review=reservations.filter(item=>item.requiresReview);
    const ready=reservations.length-review.length;
    const status=rhythm.status==='review-required'||review.length||riskFlags.size?'review-required':'preview-ready';
    return {
      version:1,kind:'cheer-voiceover-ducking-plan',status,reason:null,bpm,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      reservations,riskFlags:[...riskFlags],
      preview:{topReservation:reservations[0]||null,rule:'music ducks only inside reserved preview windows; FX should avoid the protected voice window'},
      summary:{items:reservations.length,ready,review:review.length}
    };
  }

  const api={SECTION_PROFILE,profileFor,buildReservation,buildVoiceoverDuckingPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverDuckingCore=api;
})();
