(()=>{
  'use strict';

  const HIGH_IMPACT_TYPES=new Set(['stunt','pyramid','ending']);
  const FLOW_TYPES=new Set(['dance','tumbling']);

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}
  function average(values=[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}

  function candidateOf(step){if(!step)return null;return Object.prototype.hasOwnProperty.call(step,'candidate')?step.candidate:step;}
  function featuresOf(step){return candidateOf(step)?.features||{};}
  function markerConfidence(candidate,name){
    const direct=candidate?.[`${name}Confidence`];
    const nested=candidate?.boundary?.[`${name}Confidence`]??candidate?.boundary?.[name];
    return clamp01(direct??nested??0);
  }

  function energyFlowScore(previous,current){
    const prev=featuresOf(previous),next=featuresOf(current);
    const prevEnergy=clamp01(prev.averageEnergy);
    const nextEnergy=clamp01(next.averageEnergy);
    const delta=nextEnergy-prevEnergy;
    const nextType=String(current?.sectionType||'other');

    if(HIGH_IMPACT_TYPES.has(nextType)){
      const rise=clamp01((delta+.05)/.35);
      const entry=clamp01(next.entryTransitionStrength);
      return clamp01(rise*.55+entry*.45);
    }
    if(FLOW_TYPES.has(nextType)){
      const smooth=clamp01(1-Math.abs(delta)/.45);
      const continuity=clamp01(next.continuity??.5);
      return clamp01(smooth*.7+continuity*.3);
    }
    const smooth=clamp01(1-Math.abs(delta)/.55);
    return clamp01(smooth*.8+.2);
  }

  function structureScore(previous,current){
    const prevCandidate=candidateOf(previous),nextCandidate=candidateOf(current);
    const nextFeatures=featuresOf(current);
    const nextType=String(current?.sectionType||'other');
    const drop=Math.max(markerConfidence(nextCandidate,'drop'),clamp01(nextFeatures.entryTransitionStrength));
    const cut=Math.max(markerConfidence(prevCandidate,'cut'),markerConfidence(nextCandidate,'cut'));
    const brk=Math.max(markerConfidence(prevCandidate,'break'),markerConfidence(nextCandidate,'break'));

    if(HIGH_IMPACT_TYPES.has(nextType))return clamp01(drop*.7+Math.max(cut,brk)*.3);
    if(nextType==='transition')return clamp01(Math.max(cut,brk)*.75+drop*.25);
    return clamp01(Math.max(cut,brk,drop)*.55+.45);
  }

  function cutQualityScore(previous,current){
    const prevCandidate=candidateOf(previous),nextCandidate=candidateOf(current);
    const explicit=Math.max(markerConfidence(prevCandidate,'cut'),markerConfidence(nextCandidate,'cut'));
    const gap=Math.max(0,Math.floor(finite(current?.transition?.gapEights)));
    const timing=clamp01(current?.transition?.score??(gap===0?1:1-gap/8));
    const edge=Math.max(
      clamp01(featuresOf(current).entryTransitionStrength),
      markerConfidence(prevCandidate,'break'),
      markerConfidence(nextCandidate,'drop')
    );
    return clamp01(timing*.5+Math.max(explicit,edge)*.5);
  }

  function scoreTransition(previous,current,{timingWeight=.24,energyWeight=.30,structureWeight=.28,cutWeight=.18}={}){
    if(!previous||!current||!candidateOf(previous)||!candidateOf(current)){
      return {score:0,rating:'unavailable',components:null,reasons:['missing-candidate'],nonDestructive:true};
    }
    const timing=clamp01(current?.transition?.score??1);
    const energy=energyFlowScore(previous,current);
    const structure=structureScore(previous,current);
    const cut=cutQualityScore(previous,current);
    const weightSum=Math.max(.0001,timingWeight+energyWeight+structureWeight+cutWeight);
    const score=clamp01((timing*timingWeight+energy*energyWeight+structure*structureWeight+cut*cutWeight)/weightSum);
    const rating=score>=.82?'strong':score>=.68?'good':score>=.5?'weak':'risky';
    const reasons=[];
    if(timing<.6)reasons.push('timing-gap');
    if(energy<.55)reasons.push('energy-mismatch');
    if(structure<.55)reasons.push('weak-break-drop-structure');
    if(cut<.55)reasons.push('weak-cut-point');
    return {score,rating,components:{timing,energy,structure,cut},reasons,nonDestructive:true};
  }

  function evaluateSequence(sequence=[],options={}){
    const transitions=[];
    for(let i=1;i<sequence.length;i++){
      const quality=scoreTransition(sequence[i-1],sequence[i],options);
      transitions.push({
        fromSectionId:sequence[i-1]?.sectionId||null,
        toSectionId:sequence[i]?.sectionId||null,
        fromSectionType:sequence[i-1]?.sectionType||'other',
        toSectionType:sequence[i]?.sectionType||'other',
        fromEight:candidateOf(sequence[i-1])?.endEight??null,
        toEight:candidateOf(sequence[i])?.startEight??null,
        ...quality
      });
    }
    const scored=transitions.filter(t=>t.rating!=='unavailable');
    const averageScore=scored.length?average(scored.map(t=>t.score)):1;
    const weakest=scored.length?[...scored].sort((a,b)=>a.score-b.score)[0]:null;
    return {
      transitions,
      averageScore,
      weakestTransition:weakest,
      strongTransitions:scored.filter(t=>t.rating==='strong').length,
      riskyTransitions:scored.filter(t=>t.rating==='risky').length,
      nonDestructive:true
    };
  }

  const api={HIGH_IMPACT_TYPES,FLOW_TYPES,energyFlowScore,structureScore,cutQualityScore,scoreTransition,evaluateSequence};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixTransitionQualityCore=api;
})();
