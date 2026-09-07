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

  function countSecondsFor(proposalPackage={}){
    const bpm=finite(proposalPackage?.bpm||proposalPackage?.audioTimelinePlan?.bpm,0);
    return bpm>0?60/bpm:0;
  }

  function structuralPriority(sectionType,kind){
    const section=String(sectionType||'').toLowerCase();
    const base=SECTION_PRIORITY[section]??.8;
    return clamp(kind==='riser'?base*.82:base,0,1);
  }

  function applyStructuralIntensity(anchors=[],options={}){
    const core=options.intensityCore||defaultIntensityCore();
    const prioritized=(Array.isArray(anchors)?anchors:[]).map(anchor=>({
      ...anchor,
      priority:structuralPriority(anchor.sectionType,anchor.kind)
    }));
    return core?.applyIntensity?core.applyIntensity(prioritized):prioritized;
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
    return applyStructuralIntensity(anchors,options).sort((a,b)=>a.at-b.at||(a.kind==='riser'?-1:1));
  }

  function attachStructuralCheerFx(proposalPackage={},options={}){
    if(!proposalPackage||proposalPackage.kind!=='smart-mix-2-proposal-package')return proposalPackage;
    const anchors=buildStructuralFxAnchors(proposalPackage,options);
    const impacts=anchors.filter(a=>a.kind==='impact').length;
    const risers=anchors.filter(a=>a.kind==='riser').length;
    const hero=anchors.filter(a=>a.intensity==='hero').length;
    const strong=anchors.filter(a=>a.intensity==='strong').length;
    const audioTimelinePlan={...(proposalPackage.audioTimelinePlan||{}),cheerFxAnchors:anchors};
    return {
      ...proposalPackage,
      audioTimelinePlan,
      cheerFx:{
        version:4,
        status:anchors.length?'preview-executable':'no-structural-impact-anchors',
        mode:'structural-riser-impact-intensity-synth-v1',
        nonDestructive:true,
        executable:anchors.length>0,
        safePreviewOnly:true,
        anchors,
        summary:{anchors:anchors.length,impacts,risers,hero,strong}
      },
      summary:{...(proposalPackage.summary||{}),cheerFxAnchors:anchors.length,cheerFxImpacts:impacts,cheerFxRisers:risers,cheerFxHero:hero,cheerFxStrong:strong}
    };
  }

  const api={HIGH_IMPACT,SECTION_PRIORITY,countSecondsFor,structuralPriority,applyStructuralIntensity,buildStructuralFxAnchors,attachStructuralCheerFx};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixCheerFxIntegrationCore=api;
})();
