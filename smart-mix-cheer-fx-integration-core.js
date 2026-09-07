(()=>{
  'use strict';

  const HIGH_IMPACT=new Set(['stunt','basket','pyramid','ending']);
  const SECTION_PRIORITY=Object.freeze({stunt:.90,basket:.98,pyramid:.96,ending:1});
  const SECTION_PATTERNS=Object.freeze({
    stunt:Object.freeze({id:'stunt-build-hit',anticipationCounts:1,riserScale:1,impactScale:1}),
    basket:Object.freeze({id:'basket-snap-hit',anticipationCounts:.5,riserScale:.88,impactScale:1.08}),
    pyramid:Object.freeze({id:'pyramid-rise-hit',anticipationCounts:1.5,riserScale:1.08,impactScale:1.03}),
    ending:Object.freeze({id:'ending-final-hit',anticipationCounts:1,riserScale:.92,impactScale:1.12})
  });
  const ARC_SCALE=Object.freeze({
    build:Object.freeze({riser:1.05,impact:.90}),
    drive:Object.freeze({riser:1,impact:1}),
    peak:Object.freeze({riser:.95,impact:1.08}),
    release:Object.freeze({riser:.82,impact:.78})
  });
  const DEFAULT_DENSITY_POLICY=Object.freeze({maxPerEight:1,maxHeroPerFourEights:1,minSpacingSeconds:.12});
  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function defaultIntensityCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./cheer-fx-intensity-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.CheerFxIntensityCore||null;
    return null;
  }

  function defaultPhraseEnergyCore(){
    if(typeof module!=='undefined'&&module.exports){try{return require('./cheer-fx-phrase-energy-core.js');}catch(_){return null;}}
    if(typeof window!=='undefined')return window.CheerFxPhraseEnergyCore||null;
    return null;
  }

  function countSecondsFor(proposalPackage={}){
    const bpm=finite(proposalPackage?.bpm||proposalPackage?.audioTimelinePlan?.bpm,0);
    return bpm>0?60/bpm:0;
  }

  function eightSecondsFor(proposalPackage={}){
    const explicit=finite(proposalPackage?.audioTimelinePlan?.eightSeconds,0);
    if(explicit>0)return explicit;
    const bpm=finite(proposalPackage?.bpm||proposalPackage?.audioTimelinePlan?.bpm,0);
    return bpm>0?480/bpm:0;
  }

  function routineEightAt(seconds,proposalPackage={}){
    const eightSeconds=eightSecondsFor(proposalPackage);
    if(!(eightSeconds>0))return 1;
    const startAt=Math.max(0,finite(proposalPackage?.audioTimelinePlan?.startAt,0));
    const relative=Math.max(0,finite(seconds)-startAt);
    return Math.max(1,Math.floor((relative+1e-9)/eightSeconds)+1);
  }

  function sectionPatternFor(sectionType){
    return SECTION_PATTERNS[String(sectionType||'').toLowerCase()]||Object.freeze({id:'structural-hit',anticipationCounts:1,riserScale:1,impactScale:1});
  }

  function structuralPriority(sectionType,kind){
    const section=String(sectionType||'').toLowerCase();
    const base=SECTION_PRIORITY[section]??.8;
    return clamp(kind==='riser'?base*.60:base,0,1);
  }

  function sectionArcFor(kind,phase,slot,phraseLength,sectionType){
    if(kind==='riser')return phase==='release'||phase==='break'?'release':'build';
    if(phase==='release'||phase==='break')return 'release';
    if(phase==='peak'&&(slot===phraseLength||sectionType==='ending'))return 'peak';
    if(phase==='resolve'&&sectionType==='ending')return 'peak';
    if(phase==='build')return 'build';
    return 'drive';
  }

  function sectionArcScale(stage,kind){
    const profile=ARC_SCALE[stage]||ARC_SCALE.drive;
    return finite(profile?.[kind],1);
  }

  function applyStructuralIntensity(anchors=[],options={}){
    const core=options.intensityCore||defaultIntensityCore();
    const prioritized=(Array.isArray(anchors)?anchors:[]).map(anchor=>({
      ...anchor,
      priority:structuralPriority(anchor.sectionType,anchor.kind)
    }));
    return core?.applyIntensity?core.applyIntensity(prioritized):prioritized;
  }

  function applyPhraseEnergyShaping(anchors=[],proposalPackage={},options={}){
    const phraseCore=options.phraseEnergyCore||defaultPhraseEnergyCore();
    const intensityCore=options.intensityCore||defaultIntensityCore();
    if(!phraseCore?.resolveEnergyWindow||!phraseCore?.phraseSlot||!phraseCore?.PHASE_PROFILES)return anchors;
    const phraseLength=Math.max(1,Math.round(finite(options.phraseLength,4)));
    const phraseStartEight=Math.max(1,Math.round(finite(options.phraseStartEight,1)));
    const energyWindows=Array.isArray(options.energyWindows)?options.energyWindows:[];
    return (Array.isArray(anchors)?anchors:[]).map(anchor=>{
      const referenceAt=anchor.kind==='riser'&&Number.isFinite(Number(anchor.endAt))?finite(anchor.endAt):finite(anchor.at);
      const eight=routineEightAt(referenceAt,proposalPackage);
      const context=phraseCore.resolveEnergyWindow(eight,anchor.sectionType,energyWindows);
      const slot=phraseCore.phraseSlot(eight,phraseStartEight,phraseLength);
      const profile=phraseCore.PHASE_PROFILES[context.phase]||phraseCore.PHASE_PROFILES.drive;
      const pattern=sectionPatternFor(anchor.sectionType);
      const baseScore=clamp(finite(anchor.intensityScore,finite(anchor.priority,.5)),0,1);
      let scale=anchor.kind==='impact'?finite(profile.impactScale,1):finite(profile.transitionScale,1);
      scale*=anchor.kind==='impact'?finite(pattern.impactScale,1):finite(pattern.riserScale,1);
      if(context.energy!=null)scale*=.8+clamp(finite(context.energy),0,1)*.4;
      if(anchor.kind==='impact'&&slot===phraseLength&&(context.phase==='peak'||context.phase==='resolve'))scale*=1.08;
      if(anchor.kind==='impact'&&slot===1&&context.phase==='peak'&&anchor.sectionType!=='ending')scale*=.92;
      const arcStage=sectionArcFor(anchor.kind,context.phase,slot,phraseLength,anchor.sectionType);
      const arcScale=sectionArcScale(arcStage,anchor.kind);
      scale*=arcScale;
      let shapedScore=clamp(baseScore*scale,0,1);
      const heroEligible=Boolean(profile.heroAllowed)&&(slot===phraseLength||anchor.sectionType==='ending')&&arcStage==='peak';
      if(anchor.kind==='impact'&&!heroEligible)shapedScore=Math.min(shapedScore,.85);
      const intensity=intensityCore?.classifyIntensity?intensityCore.classifyIntensity(shapedScore):anchor.intensity;
      return {
        ...anchor,
        routineEight:eight,
        phraseSlot:slot,
        phraseLength,
        energyPhase:context.phase,
        energyValue:context.energy,
        energySource:context.source,
        sectionFxPattern:pattern.id,
        sectionPatternScale:anchor.kind==='impact'?pattern.impactScale:pattern.riserScale,
        sectionArcStage:arcStage,
        sectionArcScale:arcScale,
        phraseHeroEligible:anchor.kind==='impact'?heroEligible:false,
        prePhraseIntensityScore:baseScore,
        intensityScore:shapedScore,
        intensity
      };
    });
  }

  function applyDensityPolicy(anchors=[],options={}){
    const core=options.intensityCore||defaultIntensityCore();
    if(!core?.enforceDensity)return anchors;
    const policy={...DEFAULT_DENSITY_POLICY,...(options.densityPolicy||{})};
    const impacts=(Array.isArray(anchors)?anchors:[]).filter(anchor=>anchor.kind==='impact').map(anchor=>({...anchor,eight:anchor.routineEight}));
    if(!impacts.length)return anchors;
    const density=core.enforceDensity(impacts,policy);
    const keptIds=new Set(density.kept.map(anchor=>anchor.id));
    const droppedById=new Map(density.dropped.map(anchor=>[anchor.id,anchor]));
    const droppedSections=new Set(density.dropped.map(anchor=>anchor.sectionId).filter(Boolean));
    return (Array.isArray(anchors)?anchors:[]).map(anchor=>{
      if(anchor.kind==='impact'){
        const dropped=droppedById.get(anchor.id);
        if(dropped)return {...anchor,densityDecision:'drop',densityReason:dropped.densityReason||'fx-density-limit',executable:false};
        if(keptIds.has(anchor.id))return {...anchor,densityDecision:'keep',densityReason:null};
      }
      if(anchor.kind==='riser'&&anchor.sectionId&&droppedSections.has(anchor.sectionId)){
        return {...anchor,densityDecision:'drop',densityReason:'paired-impact-dropped',executable:false};
      }
      return {...anchor,densityDecision:anchor.densityDecision||'keep',densityReason:anchor.densityReason||null};
    });
  }

  function buildStructuralFxAnchors(proposalPackage={},options={}){
    const plan=proposalPackage?.audioTimelinePlan||{};
    const clips=Array.isArray(plan.clips)?plan.clips:[];
    const transitions=Array.isArray(plan.transitions)?plan.transitions:[];
    if(proposalPackage?.kind!=='smart-mix-2-proposal-package'||plan.status==='blocked')return [];
    const anchors=[];
    const countSeconds=countSecondsFor(proposalPackage);
    for(const transition of transitions){
      if(transition?.type!=='impact-cut')continue;
      const target=clips.find(c=>(c?.smartMix?.sectionId||null)===(transition?.toSectionId||null));
      const sectionType=String(target?.smartMix?.sectionType||'other').toLowerCase();
      if(!target||!HIGH_IMPACT.has(sectionType))continue;
      const pattern=sectionPatternFor(sectionType);
      const impactAt=Math.max(0,finite(target.start));
      const confidence=(transition.qualityScore==null)?.72:clamp(finite(transition.qualityScore),0,1);
      const baseId=`smartmix-fx-${transition.toSectionId||anchors.length+1}`;
      const anticipationSeconds=countSeconds*Math.max(0,finite(pattern.anticipationCounts,1));

      if(anticipationSeconds>0&&impactAt>=anticipationSeconds){
        anchors.push({
          id:`${baseId}-riser`,
          kind:'riser',
          role:'section-entry-anticipation',
          at:impactAt-anticipationSeconds,
          endAt:impactAt,
          duration:anticipationSeconds,
          countLength:pattern.anticipationCounts,
          sectionId:transition.toSectionId||null,
          sectionType,
          sectionFxPattern:pattern.id,
          sourceTransitionType:'impact-cut',
          confidence,
          renderMode:'synth-riser-v1',
          nonDestructive:true,
          executable:true,
          preservesTimelineTiming:true
        });
      }

      anchors.push({
        id:`${baseId}-impact`,
        kind:'impact',
        role:'section-entry-accent',
        at:impactAt,
        sectionId:transition.toSectionId||null,
        sectionType,
        sectionFxPattern:pattern.id,
        sourceTransitionType:'impact-cut',
        confidence,
        renderMode:'synth-impact-v1',
        nonDestructive:true,
        executable:true,
        preservesTimelineTiming:true
      });
    }
    const intensity=applyStructuralIntensity(anchors,options);
    const phraseShaped=applyPhraseEnergyShaping(intensity,proposalPackage,options);
    return applyDensityPolicy(phraseShaped,options).sort((a,b)=>a.at-b.at||(a.kind==='riser'?-1:1));
  }

  function attachStructuralCheerFx(proposalPackage={},options={}){
    if(!proposalPackage||proposalPackage.kind!=='smart-mix-2-proposal-package')return proposalPackage;
    const anchors=buildStructuralFxAnchors(proposalPackage,options);
    const impacts=anchors.filter(a=>a.kind==='impact').length;
    const risers=anchors.filter(a=>a.kind==='riser').length;
    const executableAnchors=anchors.filter(a=>a.executable!==false).length;
    const densityDropped=anchors.filter(a=>a.densityDecision==='drop').length;
    const densityDroppedImpacts=anchors.filter(a=>a.kind==='impact'&&a.densityDecision==='drop').length;
    const hero=anchors.filter(a=>a.intensity==='hero'&&a.executable!==false).length;
    const strong=anchors.filter(a=>a.intensity==='strong'&&a.executable!==false).length;
    const phraseHeroEligible=anchors.filter(a=>a.kind==='impact'&&a.phraseHeroEligible).length;
    const arcBuild=anchors.filter(a=>a.sectionArcStage==='build').length;
    const arcPeak=anchors.filter(a=>a.sectionArcStage==='peak').length;
    const arcRelease=anchors.filter(a=>a.sectionArcStage==='release').length;
    const patterns=[...new Set(anchors.map(a=>a.sectionFxPattern).filter(Boolean))];
    const audioTimelinePlan={...(proposalPackage.audioTimelinePlan||{}),cheerFxAnchors:anchors};
    return {
      ...proposalPackage,
      audioTimelinePlan,
      cheerFx:{
        version:8,
        status:executableAnchors?'preview-executable':'no-structural-impact-anchors',
        mode:'section-pattern-riser-impact-energy-arc-density-synth-v1',
        nonDestructive:true,
        executable:executableAnchors>0,
        safePreviewOnly:true,
        densityPolicy:{...DEFAULT_DENSITY_POLICY,...(options.densityPolicy||{})},
        sectionPatterns:patterns,
        anchors,
        summary:{anchors:anchors.length,executableAnchors,densityDropped,densityDroppedImpacts,impacts,risers,hero,strong,phraseHeroEligible,arcBuild,arcPeak,arcRelease,sectionPatterns:patterns.length}
      },
      summary:{...(proposalPackage.summary||{}),cheerFxAnchors:anchors.length,cheerFxExecutableAnchors:executableAnchors,cheerFxDensityDropped:densityDropped,cheerFxDensityDroppedImpacts:densityDroppedImpacts,cheerFxImpacts:impacts,cheerFxRisers:risers,cheerFxHero:hero,cheerFxStrong:strong,cheerFxPhraseHeroEligible:phraseHeroEligible,cheerFxArcBuild:arcBuild,cheerFxArcPeak:arcPeak,cheerFxArcRelease:arcRelease,cheerFxSectionPatterns:patterns.length}
    };
  }

  const api={HIGH_IMPACT,SECTION_PRIORITY,SECTION_PATTERNS,ARC_SCALE,DEFAULT_DENSITY_POLICY,countSecondsFor,eightSecondsFor,routineEightAt,sectionPatternFor,structuralPriority,sectionArcFor,sectionArcScale,applyStructuralIntensity,applyPhraseEnergyShaping,applyDensityPolicy,buildStructuralFxAnchors,attachStructuralCheerFx};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixCheerFxIntegrationCore=api;
})();
