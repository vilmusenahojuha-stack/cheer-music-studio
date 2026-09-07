(()=>{
  'use strict';

  const HIGH_IMPACT=new Set(['stunt','basket','pyramid','ending']);
  const SECTION_PRIORITY=Object.freeze({stunt:.90,basket:.98,pyramid:.96,ending:1});
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

  function structuralPriority(sectionType,kind){
    const section=String(sectionType||'').toLowerCase();
    const base=SECTION_PRIORITY[section]??.8;
    return clamp(kind==='riser'?base*.60:base,0,1);
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
      const baseScore=clamp(finite(anchor.intensityScore,finite(anchor.priority,.5)),0,1);
      let scale=anchor.kind==='impact'?finite(profile.impactScale,1):finite(profile.transitionScale,1);
      if(context.energy!=null)scale*=.8+clamp(finite(context.energy),0,1)*.4;
      if(anchor.kind==='impact'&&slot===phraseLength&&(context.phase==='peak'||context.phase==='resolve'))scale*=1.08;
      if(anchor.kind==='impact'&&slot===1&&context.phase==='peak'&&anchor.sectionType!=='ending')scale*=.92;
      let shapedScore=clamp(baseScore*scale,0,1);
      const heroEligible=Boolean(profile.heroAllowed)&&(slot===phraseLength||anchor.sectionType==='ending');
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
        phraseHeroEligible:anchor.kind==='impact'?heroEligible:false,
        prePhraseIntensityScore:baseScore,
        intensityScore:shapedScore,
        intensity
      };
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
      const impactAt=Math.max(0,finite(target.start));
      const confidence=(transition.qualityScore==null)?.72:clamp(finite(transition.qualityScore),0,1);
      const baseId=`smartmix-fx-${transition.toSectionId||anchors.length+1}`;

      if(countSeconds>0&&impactAt>=countSeconds){
        anchors.push({
          id:`${baseId}-riser`,
          kind:'riser',
          role:'section-entry-anticipation',
          at:impactAt-countSeconds,
          endAt:impactAt,
          duration:countSeconds,
          countLength:1,
          sectionId:transition.toSectionId||null,
          sectionType,
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
        sourceTransitionType:'impact-cut',
        confidence,
        renderMode:'synth-impact-v1',
        nonDestructive:true,
        executable:true,
        preservesTimelineTiming:true
      });
    }
    const intensity=applyStructuralIntensity(anchors,options);
    return applyPhraseEnergyShaping(intensity,proposalPackage,options).sort((a,b)=>a.at-b.at||(a.kind==='riser'?-1:1));
  }

  function attachStructuralCheerFx(proposalPackage={},options={}){
    if(!proposalPackage||proposalPackage.kind!=='smart-mix-2-proposal-package')return proposalPackage;
    const anchors=buildStructuralFxAnchors(proposalPackage,options);
    const impacts=anchors.filter(a=>a.kind==='impact').length;
    const risers=anchors.filter(a=>a.kind==='riser').length;
    const hero=anchors.filter(a=>a.intensity==='hero').length;
    const strong=anchors.filter(a=>a.intensity==='strong').length;
    const phraseHeroEligible=anchors.filter(a=>a.kind==='impact'&&a.phraseHeroEligible).length;
    const audioTimelinePlan={...(proposalPackage.audioTimelinePlan||{}),cheerFxAnchors:anchors};
    return {
      ...proposalPackage,
      audioTimelinePlan,
      cheerFx:{
        version:5,
        status:anchors.length?'preview-executable':'no-structural-impact-anchors',
        mode:'structural-riser-impact-phrase-energy-synth-v1',
        nonDestructive:true,
        executable:anchors.length>0,
        safePreviewOnly:true,
        anchors,
        summary:{anchors:anchors.length,impacts,risers,hero,strong,phraseHeroEligible}
      },
      summary:{...(proposalPackage.summary||{}),cheerFxAnchors:anchors.length,cheerFxImpacts:impacts,cheerFxRisers:risers,cheerFxHero:hero,cheerFxStrong:strong,cheerFxPhraseHeroEligible:phraseHeroEligible}
    };
  }

  const api={HIGH_IMPACT,SECTION_PRIORITY,countSecondsFor,eightSecondsFor,routineEightAt,structuralPriority,applyStructuralIntensity,applyPhraseEnergyShaping,buildStructuralFxAnchors,attachStructuralCheerFx};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixCheerFxIntegrationCore=api;
})();
