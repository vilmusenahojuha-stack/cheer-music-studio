(()=>{
  'use strict';

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp01(value){return Math.max(0,Math.min(1,finite(value)));}
  function average(values=[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}

  function transitionCompatibility(previous,current,{idealGapEights=0,maxGapEights=8}={}){
    if(!previous||!current)return {score:1,gapEights:0,ordered:true,overlap:false};
    const gap=current.startEight-previous.endEight-1;
    const overlap=gap<0;
    if(overlap)return {score:0,gapEights:gap,ordered:false,overlap:true};
    const ideal=Math.max(0,Math.floor(finite(idealGapEights)));
    const maxGap=Math.max(ideal+1,Math.floor(finite(maxGapEights,8)));
    const distance=Math.abs(gap-ideal);
    const score=distance===0?1:clamp01(1-distance/maxGap);
    return {score,gapEights:gap,ordered:true,overlap:false};
  }

  function normalizeCandidates(match,index){
    const candidates=Array.isArray(match?.candidates)?match.candidates:[];
    return candidates
      .filter(c=>Number.isFinite(Number(c?.startEight))&&Number.isFinite(Number(c?.endEight)))
      .map((candidate,candidateIndex)=>({
        ...candidate,
        score:clamp01(candidate.score),
        startEight:Math.max(1,Math.floor(finite(candidate.startEight))),
        endEight:Math.max(1,Math.floor(finite(candidate.endEight))),
        sectionIndex:index,
        candidateIndex
      }))
      .filter(c=>c.endEight>=c.startEight)
      .sort((a,b)=>b.score-a.score||a.startEight-b.startEight);
  }

  function optimizeSequence(matches=[],{
    matchWeight=.72,
    transitionWeight=.28,
    idealGapEights=0,
    maxGapEights=8,
    allowUnmatched=false,
    unmatchedPenalty=.2
  }={}){
    const sections=matches.map((match,index)=>({match,index,candidates:normalizeCandidates(match,index)}));
    if(!sections.length)return {sequence:[],score:1,coverage:1,matchedSections:0,totalSections:0,transitionScore:1,nonDestructive:true};

    let states=[{sequence:[],rawScore:0,matchScores:[],transitionScores:[],matched:0,last:null}];
    for(const section of sections){
      const next=[];
      for(const state of states){
        for(const candidate of section.candidates){
          const compatibility=transitionCompatibility(state.last,candidate,{idealGapEights,maxGapEights});
          if(!compatibility.ordered)continue;
          const local=candidate.score*matchWeight+compatibility.score*transitionWeight;
          next.push({
            sequence:[...state.sequence,{sectionId:section.match?.sectionId||null,sectionType:section.match?.sectionType||'other',candidate,transition:compatibility}],
            rawScore:state.rawScore+local,
            matchScores:[...state.matchScores,candidate.score],
            transitionScores:[...state.transitionScores,compatibility.score],
            matched:state.matched+1,
            last:candidate
          });
        }
        if(allowUnmatched){
          next.push({
            sequence:[...state.sequence,{sectionId:section.match?.sectionId||null,sectionType:section.match?.sectionType||'other',candidate:null,transition:null}],
            rawScore:state.rawScore-Math.abs(finite(unmatchedPenalty,.2)),
            matchScores:[...state.matchScores],transitionScores:[...state.transitionScores],matched:state.matched,last:state.last
          });
        }
      }
      if(!next.length){
        return {sequence:[],score:0,coverage:0,matchedSections:0,totalSections:sections.length,transitionScore:0,nonDestructive:true,reason:'no-valid-ordered-sequence'};
      }
      next.sort((a,b)=>b.rawScore-a.rawScore||b.matched-a.matched);
      states=next.slice(0,256);
    }

    const best=states[0];
    const coverage=best.matched/sections.length;
    const matchScore=best.matchScores.length?average(best.matchScores):0;
    const transitionScore=best.transitionScores.length?average(best.transitionScores):1;
    const score=clamp01(matchScore*matchWeight+transitionScore*transitionWeight);
    return {
      sequence:best.sequence,
      score,
      matchScore,
      transitionScore,
      coverage,
      matchedSections:best.matched,
      totalSections:sections.length,
      nonDestructive:true
    };
  }

  function optimizeMatchedPlan(matchPlan,options={}){
    const result=optimizeSequence(matchPlan?.matches||[],options);
    return {...result,sourceCoverage:finite(matchPlan?.coverage,result.coverage),sourceAverageScore:matchPlan?.averageScore??null};
  }

  const api={transitionCompatibility,normalizeCandidates,optimizeSequence,optimizeMatchedPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixSequenceCore=api;
})();
