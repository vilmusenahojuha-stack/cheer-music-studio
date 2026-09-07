(()=>{
  'use strict';

  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};
  const clamp01=v=>Math.max(0,Math.min(1,finite(v)));
  const energyByType=Object.freeze({intro:'medium',jumps:'high',tumbling:'high',stunt:'peak',basket:'peak',pyramid:'peak',dance:'high',transition:'medium',ending:'peak',other:'medium'});
  const trendByType=Object.freeze({intro:'rising',jumps:'steady',tumbling:'rising',stunt:'steady',basket:'rising',pyramid:'rising',dance:'steady',transition:'steady',ending:'rising',other:'steady'});

  function sectionType(value='other'){
    const key=String(value||'other').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(energyByType,key)?key:'other';
  }

  function buildSectionsFromEights(eights=[]){
    const rows=Array.isArray(eights)?eights:[];
    if(!rows.length)return [];
    const sections=[];
    let current=null;
    for(let i=0;i<rows.length;i++){
      const type=sectionType(rows[i]?.part);
      if(!current||current.type!==type){
        current={id:`section-${sections.length+1}`,type,label:String(rows[i]?.part||type),startEight:i+1,endEight:i+1,energy:energyByType[type],energyTrend:trendByType[type]};
        sections.push(current);
      }else current.endEight=i+1;
    }
    return sections;
  }

  function resolveCores(overrides={}){
    const w=typeof window!=='undefined'?window:{};
    return {
      profile:overrides.profile||w.CheerAudioProfileCore,
      plan:overrides.plan||w.CheerPlanCore,
      matcher:overrides.matcher||w.SmartMixSegmentMatcherCore,
      sequence:overrides.sequence||w.SmartMixSequenceCore,
      package:overrides.package||w.SmartMixProposalPackageCore,
      fxIntegration:overrides.fxIntegration||w.SmartMixCheerFxIntegrationCore
    };
  }

  function validateTrackReadiness(project={}){
    const tracks=Array.isArray(project.tracks)?project.tracks:[];
    const analysis=project.trackAnalysis||{};
    const ready=[],issues=[];
    for(const track of tracks){
      if(!track?.url){issues.push({sourceName:track?.name||null,reason:'source-audio-missing'});continue;}
      const meta=analysis[track.name]||{};
      const bpm=finite(meta.bpm||meta.autoBpm,0);
      if(!(bpm>0)){issues.push({sourceName:track.name,reason:'bpm-missing'});continue;}
      if(meta.method==='auto'&&finite(meta.confidence,0)<.35){issues.push({sourceName:track.name,reason:'bpm-confidence-low'});continue;}
      if(meta.oneOffset==null){issues.push({sourceName:track.name,reason:'count-one-missing'});continue;}
      ready.push({track,meta,bpm});
    }
    return {ready,issues,ok:ready.length>0&&!issues.length};
  }

  function createProposalFromProfiles(project={},profiles=[],options={}){
    const cores=resolveCores(options.cores||{});
    if(!cores.plan?.buildCheerPlan||!cores.matcher?.matchPlanSections||!cores.sequence?.optimizeMatchedPlan||!cores.package?.createProposalPackage){
      return {status:'blocked',reason:'smart-mix-cores-unavailable',nonDestructive:true,executable:false};
    }
    const sections=buildSectionsFromEights(project.eights||[]);
    if(!sections.length)return {status:'blocked',reason:'cheer-sections-missing',nonDestructive:true,executable:false};
    const bpm=finite(project.targetBpm,147);
    const combined=(Array.isArray(profiles)?profiles:[]).flat().filter(Boolean);
    if(!combined.length)return {status:'blocked',reason:'audio-profiles-missing',nonDestructive:true,executable:false};

    const plan=cores.plan.buildCheerPlan({bpm,totalEights:project.eights.length,sections});
    const matchPlan=cores.matcher.matchPlanSections(plan.sections,combined,{limitPerSection:4,minScore:finite(options.minMatchScore,.42),avoidReuse:true});
    if(matchPlan.coverage<1){
      return {status:'review-required',reason:'not-all-sections-matched',coverage:matchPlan.coverage,matchPlan,nonDestructive:true,executable:false,safePreviewOnly:true};
    }
    const optimized=cores.sequence.optimizeMatchedPlan(matchPlan,{allowUnmatched:false});
    if(!optimized?.sequence?.length||optimized.coverage<1){
      return {status:'review-required',reason:optimized?.reason||'sequence-incomplete',matchPlan,optimized,nonDestructive:true,executable:false,safePreviewOnly:true};
    }
    const proposal=cores.package.createProposalPackage({optimized,matchPlan,bpm},{reoptimize:false});
    const withFx=cores.fxIntegration?.attachStructuralCheerFx?cores.fxIntegration.attachStructuralCheerFx(proposal):proposal;
    return {...withFx,cheerPlan:plan,matchPlan,sourceProfiles:combined.length,generatedAt:Date.now()};
  }

  async function decodeMono(track){
    const C=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
    if(!C)throw new Error('Web Audio API ei ole käytettävissä.');
    const bytes=await fetch(track.url).then(r=>{if(!r.ok)throw new Error(`Audiota ei voitu lukea: ${track.name}`);return r.arrayBuffer();});
    const ctx=new C();
    try{
      const buffer=await ctx.decodeAudioData(bytes.slice(0));
      const out=new Float32Array(buffer.length),channels=Math.min(2,buffer.numberOfChannels);
      for(let c=0;c<channels;c++){const data=buffer.getChannelData(c);for(let i=0;i<out.length;i++)out[i]+=data[i]/channels;}
      return {samples:out,sampleRate:buffer.sampleRate,duration:buffer.duration};
    }finally{ctx.close().catch(()=>{});}
  }

  async function analyzeReadyTracks(project,ready,onProgress=()=>{},options={}){
    const core=resolveCores(options.cores||{}).profile;
    if(!core?.analyzeEightCountEnergy)throw new Error('Cheer audio profile -ydin ei ole latautunut.');
    const profiles=[];
    for(let i=0;i<ready.length;i++){
      const item=ready[i];onProgress({phase:'profile',done:i,total:ready.length,name:item.track.name});
      const pcm=await (options.decodeMono||decodeMono)(item.track);
      const eightSeconds=480/item.bpm;
      const available=Math.max(0,finite(pcm.duration)-finite(item.meta.oneOffset));
      const totalEights=Math.max(0,Math.floor(available/eightSeconds));
      const profile=core.analyzeEightCountEnergy(pcm.samples,{sampleRate:pcm.sampleRate,bpm:item.bpm,oneOffset:finite(item.meta.oneOffset),totalEights,sourceName:item.track.name,trackId:item.track.id||item.track.name});
      profiles.push(profile);onProgress({phase:'profile',done:i+1,total:ready.length,name:item.track.name});
    }
    return profiles;
  }

  async function buildWholeMixProposal(project,onProgress=()=>{},options={}){
    const readiness=validateTrackReadiness(project);
    if(!readiness.ok)return {status:'review-required',reason:'track-readiness-failed',issues:readiness.issues,nonDestructive:true,executable:false,safePreviewOnly:true};
    const profiles=await analyzeReadyTracks(project,readiness.ready,onProgress,options);
    return createProposalFromProfiles(project,profiles,options);
  }

  function statusText(result){
    if(result?.status==='preview-ready')return `Smart Mix 2.0 valmis: ${result.summary?.sections||0} osiota · ${result.summary?.timelineClips||0} musiikkileikettä.`;
    if(result?.reason==='track-readiness-failed')return 'Smart Mix tarvitsee jokaiselle kappaleelle BPM:n ja asetetun 1-laskun.';
    if(result?.reason==='not-all-sections-matched')return `Smart Mix tarvitsee tarkistuksen: ${Math.round(clamp01(result.coverage)*100)} % osioista löytyi.`;
    return `Smart Mix tarvitsee tarkistuksen${result?.reason?`: ${result.reason}`:''}.`;
  }

  async function runFromUi(){
    const project=typeof state!=='undefined'?state:null;
    const btn=typeof document!=='undefined'?document.querySelector('#btnBuildSmartMix2'):null;
    const status=typeof document!=='undefined'?document.querySelector('#smartMix2Status'):null;
    if(!project)return;
    if(btn){btn.disabled=true;btn.textContent='⏳ Rakennetaan Smart Mix…';}
    try{
      const result=await buildWholeMixProposal(project,p=>{if(btn&&p.phase==='profile')btn.textContent=`⏳ Analysoidaan ${p.done}/${p.total}`;});
      project.smartMixProposalPackage=result;
      if(typeof scheduleSave==='function')scheduleSave();
      if(status)status.textContent=statusText(result);
      if(btn)btn.textContent=result.status==='preview-ready'?'✓ Smart Mix 2.0 valmis':'✨ Tee Smart Mix 2.0';
    }catch(error){
      console.error(error);
      if(status)status.textContent=`Smart Mix epäonnistui: ${error?.message||error}`;
      if(btn)btn.textContent='✨ Tee Smart Mix 2.0';
    }finally{if(btn)btn.disabled=false;}
  }

  function mountUi(){
    if(typeof document==='undefined')return false;
    const host=document.querySelector('#intelligentMixPanel .im-main-actions');
    if(!host||document.querySelector('#btnBuildSmartMix2'))return false;
    const btn=document.createElement('button');btn.id='btnBuildSmartMix2';btn.className='btn primary';btn.textContent='✨ Tee Smart Mix 2.0';btn.addEventListener('click',runFromUi);host.prepend(btn);
    const status=document.createElement('div');status.id='smartMix2Status';status.className='im-empty';status.textContent='Smart Mix 2.0 rakentaa koko mix-ehdotuksen 8-count-suunnitelmasta ja analysoiduista kappaleista.';
    const panel=document.querySelector('#intelligentMixPanel');panel?.insertBefore(status,document.querySelector('#intelligentMixResults'));
    return true;
  }

  function init(){if(mountUi())return;const o=new MutationObserver(()=>{if(mountUi())o.disconnect();});o.observe(document.body,{childList:true,subtree:true});}

  const api={sectionType,buildSectionsFromEights,validateTrackReadiness,createProposalFromProfiles,analyzeReadyTracks,buildWholeMixProposal,statusText,runFromUi};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerSmartMixWorkflow=api;
  if(typeof document!=='undefined')(document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init());
})();
