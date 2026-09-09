(()=>{
  'use strict';

  const q=s=>document.querySelector(s);
  let clearTimer=0;

  function timelinePixelsPerSecond(){
    const bpm=Number(window.state?.targetBpm)||147;
    const zoom=Number(window.state?.audioTimeline?.zoom)||1;
    const secondsPerEight=(60/bpm)*8;
    return 82*zoom/secondsPerEight;
  }

  function clearHighlight(){
    if(clearTimer){clearTimeout(clearTimer);clearTimer=0;}
    q('#competitionMasterTimelineHighlight')?.remove();
  }

  function diagnosticLabel(options={}){
    const kind=options.kind==='voiceover'?'Voiceover':options.kind==='fx'?'FX':'Clarity';
    const score=Number(options.score),minScore=Number(options.minScore);
    if(Number.isFinite(score)&&Number.isFinite(minScore))return `${kind}: ${score.toFixed(2)} / raja ${minScore.toFixed(2)}`;
    if(Number.isFinite(score))return `${kind}: ${score.toFixed(2)}`;
    return kind;
  }

  function highlightRange(startSeconds,endSeconds,options={}){
    const start=Number(startSeconds),end=Number(endSeconds);
    const content=q('#timelineContent');
    if(!content||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return false;
    clearHighlight();
    const pps=timelinePixelsPerSecond();
    const marker=document.createElement('div');
    marker.id='competitionMasterTimelineHighlight';
    marker.className='competition-master-timeline-highlight';
    marker.dataset.kind=options.kind||'clarity';
    marker.dataset.startSeconds=String(start);
    marker.dataset.endSeconds=String(end);
    if(Number.isFinite(Number(options.score)))marker.dataset.score=String(Number(options.score));
    if(Number.isFinite(Number(options.minScore)))marker.dataset.minScore=String(Number(options.minScore));
    marker.setAttribute('aria-hidden','true');
    marker.style.left=`${Math.max(0,start)*pps}px`;
    marker.style.width=`${Math.max(8,(end-start)*pps)}px`;
    const badge=document.createElement('span');
    badge.className='competition-master-timeline-highlight-label';
    badge.textContent=diagnosticLabel(options);
    marker.appendChild(badge);
    content.appendChild(marker);
    const duration=Math.max(1000,Math.min(10000,Number(options.durationMs)||6000));
    clearTimer=setTimeout(clearHighlight,duration);
    return true;
  }

  function addStyle(){
    if(q('#competitionMasterTimelineHighlightStyle'))return;
    const style=document.createElement('style');
    style.id='competitionMasterTimelineHighlightStyle';
    style.textContent='.competition-master-timeline-highlight{position:absolute;top:0;bottom:0;z-index:7;pointer-events:none;border:2px solid rgba(250,204,21,.9);border-radius:7px;background:rgba(250,204,21,.14);box-shadow:0 0 0 1px rgba(15,23,42,.45) inset,0 0 16px rgba(250,204,21,.18)}.competition-master-timeline-highlight[data-kind="voiceover"]{border-style:solid}.competition-master-timeline-highlight[data-kind="fx"]{border-style:dashed}.competition-master-timeline-highlight-label{position:absolute;top:4px;left:4px;max-width:220px;padding:3px 6px;border-radius:5px;background:rgba(15,23,42,.92);color:#fff;font-size:11px;line-height:1.25;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.3)}';
    document.head.appendChild(style);
  }

  function install(){
    const editor=window.cheerAudioEditor;
    if(!editor)return false;
    if(!editor.highlightRange)editor.highlightRange=highlightRange;
    if(!editor.clearHighlight)editor.clearHighlight=clearHighlight;
    return true;
  }

  function init(){
    addStyle();
    if(install())return;
    let attempts=0;
    const timer=setInterval(()=>{attempts+=1;if(install()||attempts>=30)clearInterval(timer);},100);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();