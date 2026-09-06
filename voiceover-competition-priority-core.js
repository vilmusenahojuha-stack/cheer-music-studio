(()=>{
  'use strict';

  const SECTION_WEIGHT=Object.freeze({intro:12,stunt:2,tumbling:-10,pyramid:4,dance:8,ending:24,other:0});

  function finite(value,fallback=null){if(value==null||value==='')return fallback;const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function sectionWeight(type){return SECTION_WEIGHT[String(type||'other')]??SECTION_WEIGHT.other;}
  function conflictIndex(plan){
    const map=new Map();
    const conflicts=Array.isArray(plan?.conflicts)?plan.conflicts:[];
    for(const conflict of conflicts){
      const key=String(conflict?.slotId||'');if(!key)continue;
      const current=map.get(key)||{count:0,strong:false};
      current.count++;
      current.strong=current.strong||['move-fx-preview','trim-or-move-fx-preview'].includes(String(conflict?.resolution?.action||''));
      map.set(key,current);
    }
    return map;
  }
  function rankSlot(slot,conflicts){
    const type=String(slot?.sectionType||'other');
    const conflict=conflicts.get(String(slot?.id||''));
    const risks=Array.isArray(slot?.risks)?slot.risks:[];
    let score=finite(slot?.priority,50)+sectionWeight(type);
    if(slot?.requiresReview)score-=12;
    score-=Math.min(18,risks.length*4);
    if(conflict){score-=conflict.strong?28:16;score-=Math.max(0,conflict.count-1)*4;}
    if(type==='ending'&&!conflict?.strong)score+=8;
    return {score,conflictCount:conflict?.count||0,strongConflict:Boolean(conflict?.strong)};
  }
  function buildVoiceoverCompetitionPriorityPlan(input={},options={}){
    input=input||{};
    const blocked={version:1,kind:'cheer-voiceover-competition-priority-plan',status:'blocked',reason:'voiceover-placement-plan-required',nonDestructive:true,executable:false,safePreviewOnly:true,selections:[],deferred:[],riskFlags:[],summary:{candidates:0,selected:0,deferred:0,maxVoiceovers:0}};
    const placement=input.placementPlan||input.voiceoverPlacementPlan;
    if(!placement||placement.kind!=='cheer-voiceover-placement-plan')return blocked;
    if(placement.status==='blocked')return {...blocked,reason:'voiceover-placement-plan-blocked'};
    const slots=Array.isArray(placement.slots)?placement.slots:[];
    if(!slots.length)return {...blocked,reason:'voiceover-slots-required'};

    const conflictPlan=input.conflictPlan||input.voiceoverFxConflictPlan||null;
    const conflicts=conflictIndex(conflictPlan);
    const maxVoiceovers=Math.max(1,Math.min(8,Math.floor(finite(options.maxVoiceovers,5))));
    const maxPerSection=Math.max(1,Math.min(2,Math.floor(finite(options.maxPerSection,1))));
    const minEightGap=Math.max(0,finite(options.minEightGap,1));
    const ranked=slots.map(slot=>({slot,...rankSlot(slot,conflicts)})).sort((a,b)=>b.score-a.score||finite(a.slot?.eight,999)-finite(b.slot?.eight,999)||String(a.slot?.id||'').localeCompare(String(b.slot?.id||'')));

    const selections=[],deferred=[],sectionCounts=new Map(),selectedEights=[];
    for(const item of ranked){
      const slot=item.slot;
      const type=String(slot?.sectionType||'other');
      const eight=finite(slot?.eight);
      let reason=null;
      if(item.strongConflict)reason='strong-fx-conflict';
      else if((sectionCounts.get(type)||0)>=maxPerSection)reason='section-voiceover-limit';
      else if(selections.length>=maxVoiceovers)reason='competition-voiceover-limit';
      else if(eight!=null&&selectedEights.some(value=>Math.abs(value-eight)<minEightGap))reason='voiceover-density-gap';
      else if(item.score<50)reason='low-competition-priority';

      const record={slotId:slot?.id||null,sectionId:slot?.sectionId||null,sectionType:type,eight,count:finite(slot?.count),score:item.score,conflictCount:item.conflictCount,requiresReview:Boolean(slot?.requiresReview)||item.conflictCount>0};
      if(reason)deferred.push({...record,decision:'defer',reason});
      else{
        const role=type==='ending'?'final-callout':type==='intro'?'identity-callout':type==='dance'?'energy-callout':'support-callout';
        selections.push({...record,decision:'keep',role});
        sectionCounts.set(type,(sectionCounts.get(type)||0)+1);
        if(eight!=null)selectedEights.push(eight);
      }
    }

    const riskFlags=new Set(Array.isArray(placement.riskFlags)?placement.riskFlags:[]);
    if(conflictPlan?.status==='review-required')riskFlags.add('voiceover-fx-conflicts-require-review');
    if(conflictPlan?.status==='blocked')riskFlags.add('voiceover-fx-conflict-plan-blocked');
    if(!selections.some(x=>x.sectionType==='ending')&&slots.some(x=>String(x?.sectionType)==='ending'))riskFlags.add('ending-voiceover-not-selected');
    if(deferred.some(x=>x.reason==='competition-voiceover-limit'||x.reason==='voiceover-density-gap'))riskFlags.add('voiceover-density-reduced');
    const status=placement.status==='review-required'||conflictPlan?.status==='review-required'||riskFlags.size?'review-required':'preview-ready';
    return {version:1,kind:'cheer-voiceover-competition-priority-plan',status,reason:null,nonDestructive:true,executable:false,safePreviewOnly:true,selections,deferred,riskFlags:[...riskFlags],preview:{rule:'keep only high-value competition callouts; protect ending and avoid dense or FX-conflicted voiceover',topSelection:selections[0]||null},summary:{candidates:slots.length,selected:selections.length,deferred:deferred.length,maxVoiceovers}};
  }

  const api={SECTION_WEIGHT,sectionWeight,conflictIndex,rankSlot,buildVoiceoverCompetitionPriorityPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverCompetitionPriorityCore=api;
})();
