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

  function collectDetectedStructure(profiles=[]){
    const phrases=[];
    const sections=[];
    const seenPhrases=new Set();
    const seenSections=new Set();
    const addRows=(target,seen,rows,kind,source)=>{
      for(const row of Array.isArray(rows)?rows:[]){
        if(!row)continue;
        const normalized={...row,sourceName:row.sourceName??source.sourceName,trackId:row.trackId??source.trackId};
        const startEight=Math.max(1,Math.round(finite(normalized.startEight,normalized.eight)));
        const endEight=Math.max(startEight,Math.round(finite(normalized.endEight,startEight)));
        const key=`${kind}|${normalized.trackId||''}|${normalized.sourceName||''}|${startEight}|${endEight}|${normalized.id||normalized.phrase||''}`;
        if(seen.has(key))continue;
        seen.add(key);
        target.push({...normalized,startEight,endEight});
      }
    };
    for(const profile of Array.isArray(profiles)?profiles:[]){
      if(!Array.isArray(profile))continue;
      const first=profile.find(Boolean)||{};
      const source={sourceName:first.sourceName??null,trackId:first.trackId??null};
      const structure=profile.structuralAnalysis||profile.structure||{};
      addRows(phrases,seenPhrases,profile.phrases,'phrase',source);
      addRows(phrases,seenPhrases,structure.phrases,'phrase',source);
      addRows(sections,seenSections,profile.sections,'section',source);
      addRows(sections,seenSections,structure.sections,'section',source);
    }
    return {phrases,sections,nonDestructive:true};
  }

  function resolveCores(overrides={}){
    const w=typeof window!=='undefined'?window:{};
    return {
      profile:overrides.profile||w.CheerAudioProfileCore,
      alignment:overrides.alignment||w.CheerEightAlignmentCore,
      structure:overrides.structure||w.CheerStructureCore,
      sourceStructure:overrides.sourceStructure||w.SmartMixSourceStructureCore,
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
    const profileGroups=Array.isArray(profiles)?profiles:[];
    const combined=profileGroups.flat().filter(Boolean);
    if(!combined.length)return {status:'blocked',reason:'audio-profiles-missing',nonDestructive:true,executable:false};
    const detectedStructure=collectDetectedStructure(profileGroups);

    const plan=cores.plan.buildCheerPlan({bpm,totalEights:project.eights.length,sections});
    const matchPlan=cores.matcher.matchPlanSections(plan.sections,combined,{
      limitPerSection:4,minScore:finite(options.minMatchScore,.42),avoidReuse:true,
      phrases:detectedStructure.phrases,detectedSections:detectedStructure.sections,
      minBoundaryConfidence:finite(options.minBoundaryConfidence,.72)
    });
    if(matchPlan.coverage<1)return {status:'review-required',reason:'not-all-sections-matched',coverage:matchPlan.coverage,matchPlan,detectedStructure,nonDestructive:true,executable:false,safePreviewOnly:true};
    const optimized=cores.sequence.optimizeMatchedPlan(matchPlan,{allowUnmatched:false});
    if(!optimized?.sequence?.length||optimized.coverage<1)return {status:'review-required',reason:optimized?.reason||'sequence-incomplete',matchPlan,optimized,detectedStructure,nonDestructive:true,executable:false,safePreviewOnly:true};
    const proposal=cores.package.createProposalPackage({optimized,matchPlan,bpm},{reoptimize:false});
    const withFx=cores.fxIntegration?.attachStructuralCheerFx?cores.fxIntegration.attachStructuralCheerFx(proposal):proposal;
    return {...withFx,cheerPlan:plan,matchPlan,detectedStructure,sourceProfiles:combined.length,generatedAt:Date.now()};
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

  function analyzeProfile(core,pcm,item,oneOffset){
    const eightSeconds=480/item.bpm;
    const available=Math.max(0,finite(pcm.duration)-finite(oneOffset));
    const totalEights=Math.max(0,Math.floor(available/eightSeconds));
    return core.analyzeEightCountEnergy(pcm.samples,{sampleRate:pcm.sampleRate,bpm:item.bpm,oneOffset:finite(oneOffset),totalEights,sourceName:item.track.name,trackId:item.track.id||item.track.name});
  }

  function refineProfileAlignment(profile,project,item,options,cores){
    if(!cores.alignment?.alignProfileEightCounts||!cores.structure?.buildIntelligentEightCountMap)return {accepted:false,reason:'alignment-core-unavailable',oneOffset:finite(item.meta.oneOffset),profile};
    const alignment=cores.alignment.alignProfileEightCounts(profile,{
      bpm:item.bpm,oneOffset:finite(item.meta.oneOffset),sections:buildSectionsFromEights(project?.eights||[]),
      minAlignmentConfidence:options.minAlignmentConfidence,minAlignmentSupport:options.minAlignmentSupport,maxResidualBeats:options.maxResidualBeats,
      strongConfidence:options.strongAlignmentConfidence,strongSupport:options.strongAlignmentSupport,
      reviewConfidence:options.reviewAlignmentConfidence,reviewSupport:options.reviewAlignmentSupport
    },{structureCore:cores.structure,profileCore:cores.profile});
    return {...alignment,profile};
  }

  function resolveAlignmentUse(alignment={}){
    const reliability=alignment?.reliability||null;
    const level=reliability?.level||'manual';
    return {level,canAutoUse:reliability?.canAutoUse===true&&level==='strong'&&alignment?.accepted===true,needsReview:level==='review'||reliability?.needsReview===true,useManualCountOne:level==='manual'||reliability?.useManualCountOne===true,reason:reliability?.reason||alignment?.reason||'use-manual-count-one'};
  }

  function attachSourceStructure(profile,options,cores){
    if(!Array.isArray(profile))return profile;
    let structuralAnalysis={phrases:[],sections:[],events:[],source:'fallback',confidence:0,nonDestructive:true};
    if(cores.sourceStructure?.inferSourceStructure){
      structuralAnalysis=cores.sourceStructure.inferSourceStructure(profile,{
        minEventConfidence:finite(options.minSourceEventConfidence,.72),
        phraseEights:finite(options.sourcePhraseEights,4)
      },{profileCore:cores.profile});
    }
    Object.defineProperty(profile,'structuralAnalysis',{value:{...structuralAnalysis,nonDestructive:true},enumerable:false,configurable:true});
    return profile;
  }

  async function analyzeReadyTracks(project,ready,onProgress=()=>{},options={}){
    const cores=resolveCores(options.cores||{});
    const core=cores.profile;
    if(!core?.analyzeEightCountEnergy)throw new Error('Cheer audio profile -ydin ei ole latautunut.');
    const profiles=[];
    for(let i=0;i<ready.length;i++){
      const item=ready[i];onProgress({phase:'profile',done:i,total:ready.length,name:item.track.name});
      const pcm=await (options.decodeMono||decodeMono)(item.track);
      const originalOffset=finite(item.meta.oneOffset);
      let profile=analyzeProfile(core,pcm,item,originalOffset);
      const alignment=refineProfileAlignment(profile,project,item,options,cores);
      const alignmentUse=resolveAlignmentUse(alignment);
      const alignedOffset=finite(alignment.oneOffset,originalOffset);
      const shouldReanalyze=alignmentUse.canAutoUse&&Math.abs(alignedOffset-originalOffset)>1e-6;
      if(shouldReanalyze)profile=analyzeProfile(core,pcm,item,alignedOffset);
      if(Array.isArray(profile)){
        Object.defineProperty(profile,'eightAlignment',{value:{accepted:alignment.accepted===true,reason:alignment.reason||null,source:alignment.source||null,originalOneOffset:originalOffset,oneOffset:shouldReanalyze?alignedOffset:originalOffset,confidence:finite(alignment.alignment?.confidence,0),support:finite(alignment.alignment?.support,0),reliabilityLevel:alignmentUse.level,canAutoUse:alignmentUse.canAutoUse,needsReview:alignmentUse.needsReview,useManualCountOne:alignmentUse.useManualCountOne,reanalyzed:shouldReanalyze,nonDestructive:true},enumerable:false,configurable:true});
        attachSourceStructure(profile,options,cores);
      }
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
    }catch(error){console.error(error);if(status)status.textContent=`Smart Mix epäonnistui: ${error?.message||error}`;if(btn)btn.textContent='✨ Tee Smart Mix 2.0';}
    finally{if(btn)btn.disabled=false;}
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

  function ensureEightAlignmentCore(){
    if(typeof document==='undefined'||(typeof window!=='undefined'&&window.CheerEightAlignmentCore)||document.querySelector('script[data-cheer-eight-alignment-core]'))return false;
    const script=document.createElement('script');script.src='cheer-eight-alignment-core.js?v=5.0p2m';script.dataset.cheerEightAlignmentCore='1';script.async=false;
    script.onerror=()=>console.warn('Älykästä 8-count-kohdistusydintä ei voitu ladata; Smart Mix käyttää nykyistä 1-laskua.');document.head.appendChild(script);return true;
  }

  function ensureSourceStructureCore(){
    if(typeof document==='undefined'||(typeof window!=='undefined'&&window.SmartMixSourceStructureCore)||document.querySelector('script[data-smart-mix-source-structure-core]'))return false;
    const script=document.createElement('script');script.src='smart-mix-source-structure-core.js?v=5.0p2n';script.dataset.smartMixSourceStructureCore='1';script.async=false;
    script.onerror=()=>console.warn('Source-rakenneydintä ei voitu ladata; Smart Mix käyttää nykyistä 4×8-fallback-rakennetta.');document.head.appendChild(script);return true;
  }

  function init(){
    ensureEightAlignmentCore();
    ensureSourceStructureCore();
    if(mountUi())return;
    const o=new MutationObserver(()=>{if(mountUi())o.disconnect();});
    o.observe(document.body,{childList:true,subtree:true});
  }

  const api={sectionType,buildSectionsFromEights,collectDetectedStructure,validateTrackReadiness,createProposalFromProfiles,analyzeProfile,refineProfileAlignment,resolveAlignmentUse,attachSourceStructure,analyzeReadyTracks,buildWholeMixProposal,statusText,runFromUi,ensureEightAlignmentCore,ensureSourceStructureCore};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerSmartMixWorkflow=api;
  if(typeof document!=='undefined')(document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init());
})();
