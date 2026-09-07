(()=>{
  'use strict';

  const ALLOWED_SECTIONS=new Set(['stunt','basket','pyramid','ending']);
  const HIT_ROLE_FACTOR=Object.freeze({principal:1,support:.82,omit:0});
  const ARC_PRIORITY=Object.freeze({peak:4,drive:3,build:2,release:1});
  const SECTION_SUPPORT_POLICY=Object.freeze({
    stunt:Object.freeze({id:'stunt-clean-support',supportFactor:.82,supportBuildFactor:.78,allowBuildSupport:false,allowReleaseSupport:false,omitSecondary:false}),
    basket:Object.freeze({id:'basket-snap-support',supportFactor:.72,supportBuildFactor:.66,allowBuildSupport:false,allowReleaseSupport:false,omitSecondary:false}),
    pyramid:Object.freeze({id:'pyramid-build-support',supportFactor:.84,supportBuildFactor:.88,allowBuildSupport:true,allowReleaseSupport:false,omitSecondary:false}),
    ending:Object.freeze({id:'ending-final-focus',supportFactor:.56,supportBuildFactor:.52,allowBuildSupport:false,allowReleaseSupport:false,omitSecondary:true})
  });
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};

  function intensityFactor(anchor={},fallback=1){
    const raw=Number(anchor?.intensityScore);
    if(!Number.isFinite(raw))return fallback;
    return clamp(.68+.32*clamp(raw,0,1),.68,1);
  }

  function phraseGroupFor(anchor={}){
    const eight=Math.max(1,Math.round(finite(anchor.routineEight,1)));
    return Math.floor((eight-1)/4)+1;
  }

  function principalHitScore(anchor={}){
    const arc=ARC_PRIORITY[String(anchor.sectionArcStage||'drive').toLowerCase()]||ARC_PRIORITY.drive;
    const ending=String(anchor.sectionType||'').toLowerCase()==='ending'?.35:0;
    const hero=anchor.phraseHeroEligible===true?.25:0;
    const intensity=clamp(finite(anchor.intensityScore,finite(anchor.priority,.5)),0,1);
    const confidence=clamp(finite(anchor.confidence,.72),0,1);
    return arc+ending+hero+intensity*.7+confidence*.3;
  }

  function supportPolicyFor(sectionType){
    return SECTION_SUPPORT_POLICY[String(sectionType||'').toLowerCase()]||Object.freeze({id:'structural-support',supportFactor:.8,supportBuildFactor:.76,allowBuildSupport:false,allowReleaseSupport:false,omitSecondary:false});
  }

  function resolveSecondaryRole(anchor={}){
    const sectionType=String(anchor.sectionType||'').toLowerCase();
    const arc=String(anchor.sectionArcStage||'drive').toLowerCase();
    const policy=supportPolicyFor(sectionType);
    if(policy.omitSecondary)return 'omit';
    if(arc==='release'&&!policy.allowReleaseSupport)return 'omit';
    if(arc==='build'&&!policy.allowBuildSupport)return 'omit';
    return 'support';
  }

  function selectPatternHits(anchors=[]){
    const source=Array.isArray(anchors)?anchors:[];
    const impacts=source.filter(a=>a?.kind==='impact'&&a.executable!==false&&ALLOWED_SECTIONS.has(String(a.sectionType||'').toLowerCase()));
    const winners=new Map();
    for(const impact of impacts){
      const group=phraseGroupFor(impact);
      const current=winners.get(group);
      if(!current||principalHitScore(impact)>principalHitScore(current)+1e-9)winners.set(group,impact);
    }
    const impactRoleBySection=new Map();
    const selected=source.map(anchor=>{
      if(anchor?.kind!=='impact'||anchor.executable===false)return {...anchor};
      const sectionType=String(anchor.sectionType||'').toLowerCase();
      if(!ALLOWED_SECTIONS.has(sectionType))return {...anchor};
      const winner=winners.get(phraseGroupFor(anchor));
      const hitRole=winner&&winner.id===anchor.id?'principal':resolveSecondaryRole(anchor);
      const supportPolicy=supportPolicyFor(sectionType);
      if(anchor.sectionId)impactRoleBySection.set(anchor.sectionId,hitRole);
      return {
        ...anchor,
        hitRole,
        supportPolicy:supportPolicy.id,
        principalHitScore:principalHitScore(anchor),
        executable:hitRole==='omit'?false:anchor.executable
      };
    });
    return selected.map(anchor=>{
      if(anchor?.kind!=='riser'||!anchor.sectionId)return anchor;
      const pairedRole=impactRoleBySection.get(anchor.sectionId);
      if(!pairedRole)return anchor;
      const supportPolicy=supportPolicyFor(anchor.sectionType);
      return {
        ...anchor,
        hitRole:pairedRole==='principal'?'principal-build':pairedRole==='support'?'support-build':'omit',
        supportPolicy:supportPolicy.id,
        executable:pairedRole==='omit'?false:anchor.executable
      };
    });
  }

  function hitRoleFactor(anchor={}){
    const role=String(anchor.hitRole||'principal');
    const policy=supportPolicyFor(anchor.sectionType);
    if(role==='principal-build')return .94;
    if(role==='support-build')return policy.supportBuildFactor;
    if(role==='support')return policy.supportFactor;
    return HIT_ROLE_FACTOR[role]??1;
  }

  function impactRenderSpec(anchor={}){
    const sectionType=String(anchor.sectionType||'').toLowerCase();
    if(anchor.executable===false||anchor.kind!=='impact'||!ALLOWED_SECTIONS.has(sectionType))return null;
    const at=finite(anchor.at,NaN);
    if(!Number.isFinite(at)||at<0)return null;
    const confidence=clamp(finite(anchor.confidence,.72),0,1);
    const sectionWeight=sectionType==='basket'?1:sectionType==='ending'?.96:sectionType==='stunt'?.92:.88;
    const baseStrength=clamp((.62+.38*confidence)*sectionWeight,.45,1);
    const intensity=intensityFactor(anchor,1);
    const roleFactor=hitRoleFactor(anchor);
    const strength=clamp(baseStrength*intensity*roleFactor,.35,1);
    return{
      id:String(anchor.id||`cheer-impact-${Math.round(at*1000)}`),
      kind:'impact',fxKind:'impact',at,duration:.16,
      sectionId:anchor.sectionId||null,sectionType,confidence,
      intensityScore:Number.isFinite(Number(anchor.intensityScore))?clamp(Number(anchor.intensityScore),0,1):null,
      intensity:anchor.intensity||null,hitRole:anchor.hitRole||null,supportPolicy:anchor.supportPolicy||null,strength,
      low:{wave:'sine',startHz:72,endHz:46,duration:.16,gain:.085*strength},
      transient:{wave:'triangle',startHz:920,endHz:210,duration:.042,gain:.038*strength},
      preservesTimelineTiming:true,nonDestructive:true
    };
  }

  function riserRenderSpec(anchor={}){
    const sectionType=String(anchor.sectionType||'').toLowerCase();
    if(anchor.executable===false||anchor.kind!=='riser'||!ALLOWED_SECTIONS.has(sectionType))return null;
    const at=finite(anchor.at,NaN),duration=finite(anchor.duration,0),endAt=finite(anchor.endAt,at+duration);
    if(!Number.isFinite(at)||at<0||!(duration>0)||!Number.isFinite(endAt)||endAt<=at)return null;
    const safeDuration=Math.min(duration,endAt-at);
    const confidence=clamp(finite(anchor.confidence,.72),0,1);
    const baseStrength=clamp(.45+.35*confidence,.35,.8);
    const intensity=intensityFactor(anchor,1);
    const roleFactor=hitRoleFactor(anchor);
    const strength=clamp(baseStrength*intensity*roleFactor,.28,.8);
    return{
      id:String(anchor.id||`cheer-riser-${Math.round(at*1000)}`),
      kind:'impact',fxKind:'riser',at,endAt,duration:safeDuration,
      sectionId:anchor.sectionId||null,sectionType,confidence,
      intensityScore:Number.isFinite(Number(anchor.intensityScore))?clamp(Number(anchor.intensityScore),0,1):null,
      intensity:anchor.intensity||null,hitRole:anchor.hitRole||null,supportPolicy:anchor.supportPolicy||null,strength,
      low:{wave:'sawtooth',startHz:210,endHz:1180,duration:safeDuration,gain:.012*strength},
      transient:{wave:'triangle',startHz:430,endHz:1680,duration:safeDuration,gain:.007*strength},
      preservesTimelineTiming:true,nonDestructive:true
    };
  }

  function renderSpec(anchor={}){return anchor?.kind==='riser'?riserRenderSpec(anchor):impactRenderSpec(anchor);}

  function buildRenderEvents(anchors=[],duration=Infinity){
    const limit=Number.isFinite(Number(duration))?Math.max(0,Number(duration)):Infinity;
    return selectPatternHits(anchors)
      .map(renderSpec).filter(Boolean)
      .filter(event=>event.at<=limit&&event.at+event.duration<=limit+1e-9)
      .sort((a,b)=>a.at-b.at||(a.fxKind==='riser'?-1:1));
  }

  const api={ALLOWED_SECTIONS,HIT_ROLE_FACTOR,ARC_PRIORITY,SECTION_SUPPORT_POLICY,intensityFactor,phraseGroupFor,principalHitScore,supportPolicyFor,resolveSecondaryRole,selectPatternHits,hitRoleFactor,impactRenderSpec,riserRenderSpec,renderSpec,buildRenderEvents};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerFxRenderCore=api;
})();
