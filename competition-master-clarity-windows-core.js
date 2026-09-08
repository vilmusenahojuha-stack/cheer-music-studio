((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerCompetitionMasterClarityWindowsCore=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';

  const finite=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
  const clipEnd=clip=>finite(clip?.start,0)+Math.max(0,finite(clip?.duration,0));

  function projectDuration(project={}){
    const declared=Math.max(0,finite(project?.duration,0));
    const clipDuration=(project?.audioTimeline?.clips||[]).reduce((max,clip)=>Math.max(max,clipEnd(clip)),0);
    return Math.max(1,declared,clipDuration);
  }

  function voiceoverWindows(project={}){
    return (project?.audioTimeline?.clips||[])
      .filter(clip=>clip?.type==='voice'&&finite(clip?.start,-1)>=0&&finite(clip?.duration,0)>0)
      .map((clip,index)=>({
        id:String(clip?.voiceoverSlotId||clip?.id||`voice-${index+1}`),
        start:finite(clip.start,0),
        end:clipEnd(clip),
        source:'timeline-voice'
      }));
  }

  function fxWindows(project={},fxCore=null){
    const anchors=project?.audioTimeline?.cheerFxAnchors||[];
    if(!Array.isArray(anchors)||!anchors.length||!fxCore?.buildRenderEvents)return[];
    const duration=projectDuration(project);
    const events=fxCore.buildRenderEvents(anchors,duration)||[];
    return events
      .filter(event=>event?.kind==='impact'&&finite(event?.at,-1)>=0&&finite(event?.at,0)<=duration)
      .map((event,index)=>{
        const lowDuration=Math.max(0,finite(event?.low?.duration,0));
        const transientDuration=Math.max(0,finite(event?.transient?.duration,0));
        const eventDuration=Math.max(.08,lowDuration,transientDuration);
        const start=finite(event.at,0);
        return {
          id:String(event?.id||event?.anchorId||`fx-${index+1}`),
          start,
          end:Math.min(duration,start+eventDuration),
          source:'rendered-cheer-fx'
        };
      })
      .filter(window=>window.end>window.start);
  }

  function buildCompetitionClarityWindows(project={},fxCore=null){
    const voiceover=voiceoverWindows(project);
    const fx=fxWindows(project,fxCore);
    return {
      kind:'cheer-competition-master-clarity-windows',
      version:1,
      stage:'post-voiceover-mix',
      nonDestructive:true,
      voiceoverWindows:voiceover,
      fxWindows:fx,
      counts:{voiceover:voiceover.length,fx:fx.length}
    };
  }

  return {projectDuration,voiceoverWindows,fxWindows,buildCompetitionClarityWindows};
});
