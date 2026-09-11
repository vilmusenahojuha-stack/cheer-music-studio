(()=>{
  'use strict';

  const finite=(value,fallback=0)=>{
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  };
  const clamp01=value=>Math.max(0,Math.min(1,finite(value)));
  const percent=value=>Math.round(clamp01(value)*100);

  const CRITERION_LABELS=Object.freeze({
    purpose:'Osuuden tarkoitus',
    energy:'Energia',
    boundary:'Rakenneraja',
    transition:'Break/drop-sisääntulo',
    phrase:'8-count-fraasiraja',
    continuity:'Jatkuvuus'
  });

  const CRITERION_ORDER=Object.freeze([
    'purpose','energy','boundary','transition','phrase','continuity'
  ]);

  function rangeText(candidate={}){
    const start=Number.isFinite(Number(candidate.startEight))
      ?Math.max(1,Math.round(Number(candidate.startEight)))
      :null;
    const end=Number.isFinite(Number(candidate.endEight))
      ?Math.max(start||1,Math.round(Number(candidate.endEight)))
      :null;
    if(start==null)return null;
    return end!=null&&end!==start
      ?`8-countit ${start}–${end}`
      :`8-count ${start}`;
  }

  function reasonText(candidate={}){
    return candidate?.primaryReason?.label||
      candidate?.reasons?.find(Boolean)?.label||
      null;
  }

  function candidateView(candidate=null,label='Vaihtoehto'){
    if(!candidate)return null;
    const score=Number.isFinite(Number(candidate.score))
      ?clamp01(candidate.score)
      :null;
    return {
      label,
      sourceName:candidate.sourceName||null,
      trackId:candidate.trackId||null,
      startEight:Number.isFinite(Number(candidate.startEight))
        ?Math.max(1,Math.round(Number(candidate.startEight)))
        :null,
      endEight:Number.isFinite(Number(candidate.endEight))
        ?Math.max(1,Math.round(Number(candidate.endEight)))
        :null,
      rangeText:rangeText(candidate),
      score,
      scorePercent:score==null?null:percent(score),
      primaryReason:reasonText(candidate),
      nonDestructive:true
    };
  }

  function reasonMap(candidate={}){
    const map=new Map();
    const rows=Array.isArray(candidate?.reasons)?candidate.reasons:[];
    for(const reason of rows){
      if(!reason?.code||map.has(reason.code))continue;
      const score=Number.isFinite(Number(reason.score))
        ?clamp01(reason.score)
        :null;
      if(score==null)continue;
      map.set(String(reason.code),{
        code:String(reason.code),
        label:reason.label||CRITERION_LABELS[reason.code]||String(reason.code),
        score,
        scorePercent:percent(score)
      });
    }
    return map;
  }

  function buildCriterionRows(selected={},runnerUp={}){
    const selectedMap=reasonMap(selected);
    const runnerMap=reasonMap(runnerUp);
    const codes=[
      ...CRITERION_ORDER,
      ...[...selectedMap.keys(),...runnerMap.keys()]
        .filter(code=>!CRITERION_ORDER.includes(code))
        .sort()
    ].filter((code,index,all)=>all.indexOf(code)===index);

    return codes
      .map(code=>{
        const a=selectedMap.get(code)||null;
        const b=runnerMap.get(code)||null;
        if(!a&&!b)return null;
        const selectedPercent=a?.scorePercent??null;
        const runnerUpPercent=b?.scorePercent??null;
        const delta=selectedPercent!=null&&runnerUpPercent!=null
          ?selectedPercent-runnerUpPercent
          :null;
        return {
          code,
          label:CRITERION_LABELS[code]||a?.label||b?.label||code,
          selectedPercent,
          runnerUpPercent,
          deltaPercent:delta,
          advantage:delta==null?'unknown':delta>0?'selected':delta<0?'runnerUp':'tie',
          nonDestructive:true
        };
      })
      .filter(Boolean);
  }

  function advantageText(comparison={}){
    const margin=Number.isFinite(Number(comparison.scoreMargin))
      ?clamp01(comparison.scoreMargin)
      :null;
    if(margin==null)return null;
    const points=Math.round(margin*100);
    if(points===0)return 'Piste-ero on alle 1 prosenttiyksikkö – valinta on hyvin tasainen.';
    if(points<=3)return `Valittu vaihtoehto johtaa vain ${points} prosenttiyksikköä – tarkista korvakuulolta.`;
    if(points<=8)return `Valittu vaihtoehto johtaa ${points} prosenttiyksikköä.`;
    return `Valittu vaihtoehto johtaa selvästi, ${points} prosenttiyksikköä.`;
  }

  function buildRunnerUpComparisonView(explanation={}){
    const comparison=explanation?.comparison;
    if(!comparison?.selected||!comparison?.runnerUp){
      return {
        available:false,
        selected:null,
        runnerUp:null,
        scoreMargin:null,
        scoreMarginPercent:null,
        sameSource:false,
        sourceRelation:null,
        criterionRows:[],
        advantageText:null,
        reviewRecommended:false,
        nonDestructive:true
      };
    }

    const selected=candidateView(comparison.selected,'Valittu');
    const runnerUp=candidateView(comparison.runnerUp,'2. paras');
    const margin=Number.isFinite(Number(comparison.scoreMargin))
      ?clamp01(comparison.scoreMargin)
      :null;
    const sameSource=comparison.sameSource===true;

    return {
      available:true,
      selected,
      runnerUp,
      scoreMargin:margin,
      scoreMarginPercent:margin==null?null:percent(margin),
      sameSource,
      sourceRelation:sameSource?'Sama lähdekappale':'Eri lähdekappaleet',
      criterionRows:buildCriterionRows(comparison.selected,comparison.runnerUp),
      advantageText:advantageText(comparison),
      reviewRecommended:margin!=null&&margin<=.03,
      nonDestructive:true
    };
  }

  const api={
    CRITERION_LABELS,
    CRITERION_ORDER,
    rangeText,
    reasonText,
    candidateView,
    reasonMap,
    buildCriterionRows,
    advantageText,
    buildRunnerUpComparisonView
  };

  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.SmartMixRunnerUpComparisonView=api;
})();