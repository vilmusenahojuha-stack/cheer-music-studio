(()=>{
  'use strict';

  const q=s=>typeof document!=='undefined'?document.querySelector(s):null;
  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

  function secondsPerBeat(project){return 60/Math.max(1,finite(project?.targetBpm,147));}
  function clipEnd(clip){return finite(clip?.start)+Math.max(0,finite(clip?.duration));}
  function findTrack(project,clip){return (project?.tracks||[]).find(t=>t?.name===clip?.sourceName)||null;}
  function rateFor(project,clip){
    const analysis=project?.trackAnalysis?.[clip?.sourceName]||{};
    const sourceBpm=finite(analysis.bpm||analysis.autoBpm,0);
    const target=finite(project?.targetBpm,147);
    return sourceBpm>0&&target>0?target/sourceBpm:1;
  }
  function sourceRemaining(project,clip){
    const track=findTrack(project,clip),rate=rateFor(project,clip);
    if(!(finite(track?.duration,0)>0))return Infinity;
    const used=finite(clip?.sourceOffset)+Math.max(0,finite(clip?.duration))*rate;
    return Math.max(0,(finite(track.duration)-used)/Math.max(.0001,rate));
  }

  function applySuggestedTransition(project,a,b,plan,style){
    const beat=secondsPerBeat(project);
    const transition=finite(plan?.transition,finite(b?.start));
    const gap=finite(plan?.gap,transition-clipEnd(a));
    const available=Math.max(0,sourceRemaining(project,a)-Math.max(0,gap));
    const boundedAvailable=Number.isFinite(available)?available:Infinity;
    let usedOverlap=0;

    if(style==='beat-cut'){
      a.fadeOut=clamp(beat*.035,.015,.06);
      b.fadeIn=clamp(beat*.025,.01,.05);
      a.duration=Math.max(.03,transition-finite(a.start));
    }else if(style==='impact-cut'){
      a.fadeOut=clamp(beat*.018,.007,.032);
      b.fadeIn=clamp(beat*.010,.004,.022);
      a.duration=Math.max(.03,transition-finite(a.start));
    }else if(style==='smart-overlap'){
      const wanted=clamp(finite(plan?.overlap,beat*.30),.07,.44);
      const extra=boundedAvailable===Infinity?wanted:Math.min(wanted,boundedAvailable);
      usedOverlap=extra;
      a.duration=Math.max(.03,transition-finite(a.start)+extra);
      a.fadeOut=clamp(extra*.82,.05,.36);
      b.fadeIn=clamp(extra*.52,.03,.22);
    }else{
      const wanted=clamp(finite(plan?.overlap,beat*.55),.09,.36);
      const extra=boundedAvailable===Infinity?wanted:Math.min(wanted,boundedAvailable);
      usedOverlap=extra;
      a.duration=Math.max(.03,transition-finite(a.start)+extra);
      a.fadeOut=clamp(extra||wanted,.07,.36);
      b.fadeIn=clamp((extra||wanted)*.72,.05,.28);
    }
    return usedOverlap;
  }

  function buildSuggestedTimelinePlan(project,plans=[],styles={}){
    const music=(project?.audioTimeline?.clips||[]).filter(c=>c?.type==='music').map(clone).sort((a,b)=>finite(a.start)-finite(b.start));
    if(music.length<2||!Array.isArray(plans)||!plans.length){
      return {status:'review-required',clips:[],reason:'smart-mix-analysis-missing',nonDestructive:true,executable:false,safePreviewOnly:true};
    }
    const byId=new Map(music.map(c=>[c.id,c]));
    let applied=0;
    for(let i=0;i<plans.length;i++){
      const p=plans[i]||{};
      const a=byId.get(p?.a?.id),b=byId.get(p?.b?.id);
      if(!a||!b)continue;
      const style=styles[i]||p.style||'beat-cut';
      applySuggestedTransition(project,a,b,p,style);
      applied++;
    }
    if(!applied)return {status:'review-required',clips:[],reason:'smart-mix-plan-mismatch',nonDestructive:true,executable:false,safePreviewOnly:true};
    return {
      status:'preview-ready',
      kind:'smart-mix-audible-preview-plan',
      clips:music,
      transitionsApplied:applied,
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true
    };
  }

  function buildWholeMixTimelinePlan(project,proposalPackage){
    const source=proposalPackage?.audioTimelinePlan||proposalPackage;
    if(!source||source.status!=='preview-ready'||!Array.isArray(source.clips)||!source.clips.length){
      return {status:'review-required',clips:[],reason:'whole-mix-proposal-not-preview-ready',nonDestructive:true,executable:false,safePreviewOnly:true};
    }
    const tracks=new Map((project?.tracks||[]).map(t=>[t?.name,t]));
    const clips=[];
    const risks=[];
    for(const raw of source.clips){
      const c=clone(raw);
      const track=tracks.get(c?.sourceName);
      if(!track){
        risks.push({clipId:c?.id||null,sourceName:c?.sourceName||null,reason:'source-track-missing'});
        continue;
      }
      const start=finite(c?.start,-1),duration=finite(c?.duration,-1),sourceOffset=finite(c?.sourceOffset,-1);
      if(start<0||duration<=0||sourceOffset<0){
        risks.push({clipId:c?.id||null,sourceName:c?.sourceName||null,reason:'invalid-timeline-clip'});
        continue;
      }
      if(finite(track?.duration,0)>0&&sourceOffset>=finite(track.duration)){
        risks.push({clipId:c?.id||null,sourceName:c?.sourceName||null,reason:'source-offset-out-of-range'});
        continue;
      }
      c.type='music';
      c.volume=finite(c.volume,1);
      c.fadeIn=Math.max(0,finite(c.fadeIn,0));
      c.fadeOut=Math.max(0,finite(c.fadeOut,0));
      clips.push(c);
    }
    if(risks.length||clips.length!==source.clips.length){
      return {status:'review-required',clips:[],risks,reason:'whole-mix-source-validation-failed',nonDestructive:true,executable:false,safePreviewOnly:true};
    }
    clips.sort((a,b)=>finite(a.start)-finite(b.start));
    return {
      status:'preview-ready',
      kind:'smart-mix-whole-sequence-audible-preview-plan',
      clips,
      duration:finite(source.duration,clips.reduce((m,c)=>Math.max(m,clipEnd(c)),0)),
      transitionsApplied:Math.max(0,clips.length-1),
      sourceKind:proposalPackage?.kind||source?.kind||'smart-mix-2-proposal-package',
      nonDestructive:true,
      executable:false,
      safePreviewOnly:true
    };
  }

  function wholeMixPackage(project){
    return project?.smartMixProposalPackage||project?.smartMixProposal?.package||project?.intelligentMix?.proposalPackage||null;
  }

  let controller=null;
  function stopPreview(){
    try{controller?.stop?.();}catch(_){}
    controller=null;
    const btn=q('#btnPreviewSmartMix');
    if(btn){btn.disabled=false;btn.textContent='▶ Kuuntele Smart Mix';}
  }
  function selectedStyles(plans=[]){
    const out={};
    plans.forEach((_,i)=>{const sel=q(`#intelligentMixResults [data-style="${i}"]`);if(sel?.value)out[i]=sel.value;});
    return out;
  }
  async function previewSuggestedMix(){
    const project=typeof state!=='undefined'?state:null;
    const plans=project?.intelligentMix?._plans||[];
    const renderer=typeof window!=='undefined'?window.CheerOfflineRenderer:null;
    const btn=q('#btnPreviewSmartMix');
    if(!renderer?.previewTimelinePlan){alert('Smart Mix -preview-rendereri ei ole valmis. Päivitä sivu.');return;}
    const packaged=wholeMixPackage(project);
    const plan=packaged?buildWholeMixTimelinePlan(project,packaged):buildSuggestedTimelinePlan(project,plans,selectedStyles(plans));
    if(plan.status!=='preview-ready'){
      alert(packaged?'Kokonainen Smart Mix -ehdotus vaatii vielä tarkistuksen.':'Analysoi siirtymät ensin.');
      return;
    }
    stopPreview();
    try{window.cheerAudioEditor?.stopTransport?.(false);}catch(_){}
    if(btn){btn.disabled=true;btn.textContent=packaged?'⏳ Rakennetaan koko mix…':'⏳ Renderöidään…';}
    try{
      controller=await renderer.previewTimelinePlan(project,plan,progress=>{
        if(!btn)return;
        if(progress?.phase==='render')btn.textContent='⏳ Viimeistellään preview…';
        else if(progress?.phase==='stretch')btn.textContent='⏳ Sovitetaan tempoa…';
        else btn.textContent='⏳ Valmistellaan…';
      },{onEnded:()=>stopPreview()});
      if(btn){btn.disabled=false;btn.textContent='■ Pysäytä Smart Mix';}
    }catch(error){
      console.error(error);stopPreview();alert(`Smart Mix -kuuntelu epäonnistui: ${error?.message||error}`);
    }
  }

  function mountButton(){
    const host=q('#intelligentMixPanel .im-main-actions');
    if(!host||q('#btnPreviewSmartMix'))return false;
    const btn=document.createElement('button');
    btn.id='btnPreviewSmartMix';
    btn.className='mini-btn';
    btn.textContent='▶ Kuuntele Smart Mix';
    btn.addEventListener('click',()=>controller?stopPreview():previewSuggestedMix());
    host.appendChild(btn);
    return true;
  }
  function init(){
    if(mountButton())return;
    const observer=new MutationObserver(()=>{if(mountButton())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  const api={buildSuggestedTimelinePlan,buildWholeMixTimelinePlan,applySuggestedTransition,previewSuggestedMix,stopPreview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerSmartMixPreviewUI=api;
  if(typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
