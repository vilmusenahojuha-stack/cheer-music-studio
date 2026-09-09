((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CheerCompetitionMasterSectionClarityCore=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';

  const PROFILE=Object.freeze({
    id:'fi-cheer-master-section-clarity-v2',
    minVoiceoverClarityScore:.72,
    minFxClarityScore:.68
  });

  const finite=(value,fallback=null)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
  const round=(value,digits=3)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;
  const array=value=>Array.isArray(value)?value:[];

  function normalizeSections(sections=[],durationSeconds=null){
    const duration=finite(durationSeconds,null);
    return array(sections).map((raw,index)=>{
      const start=Math.max(0,finite(raw?.start,finite(raw?.startSeconds,0)));
      const fallbackEnd=start+Math.max(0,finite(raw?.duration,finite(raw?.durationSeconds,0)));
      let end=Math.max(start,finite(raw?.end,finite(raw?.endSeconds,fallbackEnd)));
      if(duration!==null)end=Math.min(duration,end);
      return {
        id:String(raw?.id||raw?.sectionId||`section-${index+1}`),
        label:String(raw?.label||raw?.name||raw?.type||`Section ${index+1}`),
        type:String(raw?.type||raw?.energyType||raw?.role||'section'),
        start,
        end,
        energy:finite(raw?.energy,finite(raw?.energyScore,null))
      };
    }).filter(section=>section.end>section.start);
  }

  function overlapSeconds(item,section){
    const start=Math.max(finite(item?.start,0),section.start);
    const end=Math.min(finite(item?.end,finite(item?.start,0)),section.end);
    return Math.max(0,end-start);
  }

  function assignItems(items=[],sections=[]){
    const assignments=new Map(sections.map(section=>[section.id,[]]));
    for(const item of array(items)){
      let best=null,bestOverlap=0;
      for(const section of sections){
        const overlap=overlapSeconds(item,section);
        if(overlap>bestOverlap){best=section;bestOverlap=overlap;}
      }
      if(best&&bestOverlap>0)assignments.get(best.id).push({...item,sectionOverlapSeconds:round(bestOverlap,3)});
    }
    return assignments;
  }

  function normalizeWeakestItem(item){
    if(!item)return null;
    return {
      id:item.id??null,
      start:round(finite(item.start,null),3),
      end:round(finite(item.end,null),3),
      score:round(finite(item.score,null),3),
      sectionOverlapSeconds:round(finite(item.sectionOverlapSeconds,null),3)
    };
  }

  function summarizeKind(items=[],minScore){
    const measured=array(items).filter(item=>Number.isFinite(finite(item?.score,null)));
    if(!measured.length)return {score:null,minScore,ready:null,itemsMeasured:0,weakestItem:null};
    const score=measured.reduce((sum,item)=>sum+finite(item.score,0),0)/measured.length;
    const weakest=measured.slice().sort((a,b)=>finite(a.score,1)-finite(b.score,1))[0]||null;
    return {
      score:round(score,3),
      minScore,
      ready:score>=minScore,
      itemsMeasured:measured.length,
      weakestItem:normalizeWeakestItem(weakest)
    };
  }

  function buildSectionClarity(clarity={},sections=[],options={}){
    const duration=finite(options.durationSeconds,null);
    const normalized=normalizeSections(sections,duration);
    const voiceAssignments=assignItems(clarity?.voiceover?.items||[],normalized);
    const fxAssignments=assignItems(clarity?.fx?.items||[],normalized);
    const minVoiceover=finite(options.minVoiceoverClarityScore,PROFILE.minVoiceoverClarityScore);
    const minFx=finite(options.minFxClarityScore,PROFILE.minFxClarityScore);

    const results=normalized.map(section=>{
      const voiceover=summarizeKind(voiceAssignments.get(section.id),minVoiceover);
      const fx=summarizeKind(fxAssignments.get(section.id),minFx);
      const measured=voiceover.itemsMeasured+fx.itemsMeasured;
      const risks=[];
      if(voiceover.ready===false)risks.push('section-voiceover-clarity-failed');
      if(fx.ready===false)risks.push('section-fx-clarity-failed');
      return {
        ...section,
        voiceover,
        fx,
        measured,
        status:!measured?'unmeasured':risks.length?'review-required':'clear',
        riskFlags:risks
      };
    });

    const reviewed=results.filter(section=>section.status==='review-required');
    const measuredSections=results.filter(section=>section.measured>0);
    const weakest=measuredSections.slice().sort((a,b)=>{
      const aScores=[a.voiceover.score,a.fx.score].filter(Number.isFinite);
      const bScores=[b.voiceover.score,b.fx.score].filter(Number.isFinite);
      const av=aScores.length?Math.min(...aScores):1;
      const bv=bScores.length?Math.min(...bScores):1;
      return av-bv;
    })[0]||null;

    return {
      kind:'cheer-competition-master-section-clarity',
      version:2,
      profile:PROFILE.id,
      stage:'post-voiceover-mix',
      nonDestructive:true,
      sections:results,
      summary:{
        sectionsTotal:results.length,
        sectionsMeasured:measuredSections.length,
        sectionsReviewRequired:reviewed.length,
        weakestSectionId:weakest?.id||null,
        weakestSectionLabel:weakest?.label||null,
        status:reviewed.length?'review-required':measuredSections.length?'clear':'unmeasured'
      }
    };
  }

  return {PROFILE,normalizeSections,overlapSeconds,assignItems,summarizeKind,buildSectionClarity};
});
