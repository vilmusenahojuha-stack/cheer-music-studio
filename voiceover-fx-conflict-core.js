(()=>{
  'use strict';

  function finite(value,fallback=null){if(value==null||value==='')return fallback;const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&bStart<aEnd;}
  function eventWindow(event){
    const count=finite(event?.count,finite(event?.recommendedCount));
    if(!(count>0))return null;
    const width=Math.max(0.1,finite(event?.durationCounts,0.25));
    return {start:count-width/2,end:count+width/2,count};
  }
  function severityFor(event){
    const intensity=String(event?.intensity||event?.level||'medium');
    if(intensity==='hero')return 4;
    if(intensity==='strong')return 3;
    if(intensity==='medium')return 2;
    return 1;
  }
  function resolutionFor(event,reservation){
    const severity=severityFor(event);
    const type=String(event?.type||event?.fxType||'fx');
    const speech=reservation?.speechWindow||{};
    const count=finite(event?.count,finite(event?.recommendedCount));
    if(type==='impact'||type==='hit'){
      if(severity>=3)return {action:'move-fx-preview',targetCount:count<=finite(speech.startCount,1)?Math.max(1,count-1):Math.min(8,count+1),reason:'protect-voice-from-strong-impact'};
      return {action:'reduce-fx-preview',amountDb:-3,reason:'soften-impact-under-voice'};
    }
    if(type==='riser'||type==='whoosh')return {action:'trim-or-move-fx-preview',reason:'transition-fx-overlaps-voice-space'};
    return {action:'reduce-fx-preview',amountDb:-2,reason:'fx-overlaps-voice-space'};
  }
  function normalizeFxEvents(input){
    const candidates=[input?.fxEvents,input?.events,input?.countPlan?.events,input?.patternPlan?.events];
    for(const list of candidates)if(Array.isArray(list))return list;
    return [];
  }
  function buildVoiceoverFxConflictPlan(input={}){
    input=input||{};
    const blocked={version:1,kind:'cheer-voiceover-fx-conflict-plan',status:'blocked',reason:'voiceover-ducking-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,conflicts:[],riskFlags:[],summary:{reservations:0,fxEvents:0,conflicts:0,unresolved:0}};
    const duck=input.duckingPlan||input.voiceoverDuckingPlan;
    if(!duck||duck.kind!=='cheer-voiceover-ducking-plan')return blocked;
    if(duck.status==='blocked')return {...blocked,reason:'voiceover-ducking-plan-blocked'};
    const reservations=Array.isArray(duck.reservations)?duck.reservations:[];
    if(!reservations.length)return {...blocked,reason:'voiceover-reservations-required'};
    const fxEvents=normalizeFxEvents(input);
    if(!fxEvents.length)return {...blocked,reason:'fx-events-required',summary:{reservations:reservations.length,fxEvents:0,conflicts:0,unresolved:0}};

    const conflicts=[];
    for(const reservation of reservations){
      const avoid=reservation?.fxAvoidWindow||reservation?.speechWindow;
      const aStart=finite(avoid?.startCount),aEnd=finite(avoid?.endCount);
      if(!(aStart!=null&&aEnd!=null&&aEnd>aStart))continue;
      for(let i=0;i<fxEvents.length;i++){
        const event=fxEvents[i];
        if(reservation.eight!=null&&event?.eight!=null&&Number(reservation.eight)!==Number(event.eight))continue;
        const win=eventWindow(event);if(!win)continue;
        if(!overlaps(aStart,aEnd,win.start,win.end))continue;
        const resolution=resolutionFor(event,reservation);
        conflicts.push({
          id:`vofx-${reservation.slotId||reservation.sectionId||'slot'}-${i+1}`,
          slotId:reservation.slotId||null,sectionId:reservation.sectionId||null,sectionType:reservation.sectionType||'other',eight:finite(reservation.eight),
          fxIndex:i,fxType:event?.type||event?.fxType||'fx',fxCount:win.count,intensity:event?.intensity||event?.level||'medium',
          avoidWindow:{startCount:aStart,endCount:aEnd},resolution,requiresReview:true
        });
      }
    }
    const riskFlags=new Set(Array.isArray(duck.riskFlags)?duck.riskFlags:[]);
    if(conflicts.length)riskFlags.add('voiceover-fx-overlap');
    const status=duck.status==='review-required'||conflicts.length||riskFlags.size?'review-required':'preview-ready';
    return {
      version:1,kind:'cheer-voiceover-fx-conflict-plan',status,reason:null,
      nonDestructive:true,executable:false,safePreviewOnly:true,
      conflicts,riskFlags:[...riskFlags],
      preview:{rule:'protect voice first; move strong impacts, soften lighter FX, and keep all changes preview-only',topConflict:conflicts[0]||null},
      summary:{reservations:reservations.length,fxEvents:fxEvents.length,conflicts:conflicts.length,unresolved:conflicts.length}
    };
  }

  const api={overlaps,eventWindow,severityFor,resolutionFor,normalizeFxEvents,buildVoiceoverFxConflictPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverFxConflictCore=api;
})();
