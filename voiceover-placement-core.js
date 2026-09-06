(()=>{
  'use strict';

  const SECTION_PROFILE=Object.freeze({
    intro:{priority:90,preferredCounts:[1,5],maxSlots:2},
    stunt:{priority:70,preferredCounts:[1,5],maxSlots:1},
    tumbling:{priority:55,preferredCounts:[1],maxSlots:1},
    pyramid:{priority:65,preferredCounts:[1,5],maxSlots:1},
    dance:{priority:80,preferredCounts:[1,5],maxSlots:2},
    ending:{priority:95,preferredCounts:[1],maxSlots:1},
    other:{priority:50,preferredCounts:[1],maxSlots:1}
  });

  function finite(value,fallback=null){if(value==null||value==='')return fallback;const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function profileFor(sectionType){return SECTION_PROFILE[String(sectionType||'other')]||SECTION_PROFILE.other;}
  function normalizeFxSections(fxPackage){
    const out=new Map();
    const recs=Array.isArray(fxPackage?.recommendations)?fxPackage.recommendations:[];
    for(const rec of recs){
      const key=String(rec?.section||'other');
      const current=out.get(key)||{review:false,strong:false};
      current.review=current.review||Boolean(rec?.requiresReview);
      current.strong=current.strong||['strengthen-final-peak','trim-pyramid-peak','reduce-section-fx'].includes(String(rec?.directive||''));
      out.set(key,current);
    }
    return out;
  }
  function candidateFor(step,index,count,fxInfo){
    const sectionType=String(step?.sectionType||step?.sectionId||'other');
    const startEight=finite(step?.startEight);
    const endEight=finite(step?.endEight);
    const p=profileFor(sectionType);
    const risks=[];
    if(startEight==null||endEight==null||endEight<startEight)risks.push('voiceover-eight-range-missing');
    if(fxInfo?.review)risks.push('voiceover-fx-review-overlap');
    if(fxInfo?.strong&&sectionType!=='intro'&&sectionType!=='dance')risks.push('voiceover-heavy-fx-section');
    return {
      id:`vo-${sectionType}-${index+1}-${count}`,
      sectionId:step?.sectionId||null,
      sectionType,
      eight:startEight,
      count,
      priority:p.priority-(fxInfo?.strong?15:0)-(fxInfo?.review?10:0),
      placement:'section-entry',
      maxDurationCounts:count===5?3:4,
      risks,
      requiresReview:risks.length>0
    };
  }
  function buildVoiceoverPlacementPlan(input={},options={}){
    const blocked={version:1,kind:'cheer-voiceover-placement-plan',status:'blocked',reason:'smart-mix-package-required',nonDestructive:true,executable:false,safePreviewOnly:true,slots:[],riskFlags:[],summary:{sections:0,slots:0,reviewSlots:0,readyForPreview:false}};
    input=input||{};
    const smartMix=input.smartMixPackage||input.smartMix||input;
    if(!smartMix||smartMix.kind!=='smart-mix-2-proposal-package')return blocked;
    if(smartMix.status==='blocked')return {...blocked,reason:'smart-mix-package-blocked'};
    const sequence=Array.isArray(smartMix.sequence)?smartMix.sequence:[];
    if(!sequence.length)return {...blocked,reason:'smart-mix-sequence-required'};

    const fxPackage=input.fxPackage||null;
    const fxSections=normalizeFxSections(fxPackage);
    const slots=[];
    for(let i=0;i<sequence.length;i++){
      const step=sequence[i];
      const sectionType=String(step?.sectionType||step?.sectionId||'other');
      const p=profileFor(sectionType);
      const fxInfo=fxSections.get(sectionType)||null;
      for(const count of p.preferredCounts.slice(0,p.maxSlots))slots.push(candidateFor(step,i,count,fxInfo));
    }

    const riskFlags=new Set(Array.isArray(smartMix?.risks)?smartMix.risks:[]);
    if(fxPackage?.status==='review-required')riskFlags.add('voiceover-fx-package-review-required');
    if(fxPackage?.status==='blocked')riskFlags.add('voiceover-fx-package-blocked');
    for(const slot of slots)for(const risk of slot.risks)riskFlags.add(risk);
    const reviewSlots=slots.filter(slot=>slot.requiresReview);
    let status='preview-ready';
    let reason=null;
    if(fxPackage?.status==='blocked'){status='review-required';reason='fx-package-blocked-review-placement';}
    else if(smartMix.status!=='preview-ready'||reviewSlots.length||riskFlags.size)status='review-required';

    slots.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
    return {
      version:1,kind:'cheer-voiceover-placement-plan',status,reason,bpm:finite(smartMix.bpm),
      nonDestructive:true,executable:false,safePreviewOnly:true,
      slots,
      riskFlags:[...riskFlags],
      preview:{topSlot:slots[0]||null,orderedSections:[...new Set(sequence.map(s=>String(s?.sectionType||s?.sectionId||'other')))]},
      summary:{sections:sequence.length,slots:slots.length,reviewSlots:reviewSlots.length,readyForPreview:status==='preview-ready'}
    };
  }

  const api={SECTION_PROFILE,profileFor,normalizeFxSections,candidateFor,buildVoiceoverPlacementPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerVoiceoverPlacementCore=api;
})();
