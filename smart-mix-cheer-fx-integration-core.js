(()=>{
  'use strict';

  const HIGH_IMPACT=new Set(['stunt','basket','pyramid','ending']);
  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};

  function buildStructuralFxAnchors(proposalPackage={}){
    const plan=proposalPackage?.audioTimelinePlan||{};
    const clips=Array.isArray(plan.clips)?plan.clips:[];
    const transitions=Array.isArray(plan.transitions)?plan.transitions:[];
    if(proposalPackage?.kind!=='smart-mix-2-proposal-package'||plan.status==='blocked')return [];
    const anchors=[];
    for(const transition of transitions){
      if(transition?.type!=='impact-cut')continue;
      const target=clips.find(c=>(c?.smartMix?.sectionId||null)===(transition?.toSectionId||null));
      const sectionType=String(target?.smartMix?.sectionType||'other').toLowerCase();
      if(!target||!HIGH_IMPACT.has(sectionType))continue;
      anchors.push({
        id:`smartmix-fx-${transition.toSectionId||anchors.length+1}`,
        kind:'impact',
        role:'section-entry-accent',
        at:Math.max(0,finite(target.start)),
        sectionId:transition.toSectionId||null,
        sectionType,
        sourceTransitionType:'impact-cut',
        confidence:transition.qualityScore==null?.72:Math.max(0,Math.min(1,finite(transition.qualityScore))),
        nonDestructive:true,
        executable:false,
        preservesTimelineTiming:true
      });
    }
    return anchors.sort((a,b)=>a.at-b.at);
  }

  function attachStructuralCheerFx(proposalPackage={}){
    if(!proposalPackage||proposalPackage.kind!=='smart-mix-2-proposal-package')return proposalPackage;
    const anchors=buildStructuralFxAnchors(proposalPackage);
    const audioTimelinePlan={...(proposalPackage.audioTimelinePlan||{}),cheerFxAnchors:anchors};
    return {
      ...proposalPackage,
      audioTimelinePlan,
      cheerFx:{
        version:1,
        status:anchors.length?'preview-planned':'no-structural-impact-anchors',
        mode:'structural-impact-anchors',
        nonDestructive:true,
        executable:false,
        safePreviewOnly:true,
        anchors,
        summary:{anchors:anchors.length,impacts:anchors.length}
      },
      summary:{...(proposalPackage.summary||{}),cheerFxAnchors:anchors.length}
    };
  }

  const api={HIGH_IMPACT,buildStructuralFxAnchors,attachStructuralCheerFx};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixCheerFxIntegrationCore=api;
})();
