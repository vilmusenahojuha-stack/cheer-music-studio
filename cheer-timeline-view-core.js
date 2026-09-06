(()=>{
  'use strict';

  const ENERGY_SCORE=Object.freeze({low:.15,medium:.42,high:.70,peak:.93});
  const EVENT_GROUP=Object.freeze({
    'gain-ramp':'mix','space':'mix','prepare-drop':'mix','restore-energy':'mix','build-window':'mix','cut-window':'mix',
    'impact-anchor':'fx','riser-anchor':'fx'
  });

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }
  function clamp01(value){return Math.max(0,Math.min(1,finiteNumber(value)));}
  function overlaps(event,start,end){
    const from=finiteNumber(event?.from,event?.at);
    const to=finiteNumber(event?.to,from);
    if(Math.abs(to-from)<1e-9)return from>=start-1e-9&&from<end-1e-9;
    return to>start+1e-9&&from<end-1e-9;
  }
  function countGrid(row,bpm){
    const start=finiteNumber(row.start);
    const end=Math.max(start,finiteNumber(row.end,start));
    const duration=end-start;
    const beat=finiteNumber(bpm)>0?60/finiteNumber(bpm):duration/8;
    const step=beat>0&&beat*8<=duration+.02?beat:duration/8;
    return Array.from({length:8},(_,i)=>({count:i+1,time:start+i*step}));
  }
  function eventBadge(event){
    return {
      kind:event.kind,
      group:EVENT_GROUP[event.kind]||'other',
      actionType:event.actionType||null,
      confidence:clamp01(event.confidence),
      severity:clamp01(event.severity),
      from:finiteNumber(event.from,event.at),
      to:finiteNumber(event.to,event.from),
      target:event.target||null
    };
  }
  function buildTimelinePresentation(cheerPlan,preview={events:[],nonDestructive:true,executable:false}){
    if(!cheerPlan||!Array.isArray(cheerPlan.timeline))throw new Error('Cheer plan timeline is required.');
    if(preview?.nonDestructive!==true||preview?.executable!==false)throw new Error('Only non-destructive Smart Mix preview data is allowed.');
    const events=Array.isArray(preview.events)?preview.events:[];
    const bpm=finiteNumber(cheerPlan.bpm);
    const rows=cheerPlan.timeline.map(row=>{
      const start=Math.max(0,finiteNumber(row.start));
      const end=Math.max(start,finiteNumber(row.end,start));
      const related=events.filter(event=>overlaps(event,start,end)).map(eventBadge);
      const plannedEnergy=ENERGY_SCORE[row.energy]??null;
      const actualEnergy=row.audioEnergy?clamp01(row.audioEnergy.score):null;
      return {
        eight:row.eight,
        label:`8-count ${row.eight}`,
        start,end,duration:end-start,
        counts:countGrid({start,end},bpm),
        section:{id:row.sectionId||null,type:row.sectionType||null,label:row.sectionLabel||'',countInSection:row.countInSection??null},
        phrase:{number:row.phrase??null,startEight:row.phraseStartEight??null,endEight:row.phraseEndEight??null,trend:row.phraseEnergyTrend||'steady'},
        energy:{planned:row.energy||null,plannedScore:plannedEnergy,actual:row.audioEnergy?.energy||null,actualScore:actualEnergy,alignment:row.energyAlignment?.status||null,alignmentScore:row.energyAlignment?.score??null},
        transition:row.transition||null,
        previewEvents:related,
        hasSmartMix:related.length>0,
        warnings:[
          ...(row.energyAlignment&&row.energyAlignment.status!=='match'?[`energy-${row.energyAlignment.status}`]:[]),
          ...(related.some(event=>event.severity>=.8)?['strong-smart-mix-edit']:[])
        ]
      };
    });
    const markers=events
      .filter(event=>Math.abs(finiteNumber(event.to,event.from)-finiteNumber(event.from,event.at))<1e-9)
      .map(event=>({time:finiteNumber(event.from,event.at),kind:event.kind,group:EVENT_GROUP[event.kind]||'other',eight:event.eight??null,confidence:clamp01(event.confidence)}))
      .sort((a,b)=>a.time-b.time);
    const sectionBands=[];
    for(const row of rows){
      const last=sectionBands.at(-1);
      if(last&&last.id===row.section.id){last.end=row.end;last.endEight=row.eight;continue;}
      sectionBands.push({id:row.section.id,type:row.section.type,label:row.section.label,start:row.start,end:row.end,startEight:row.eight,endEight:row.eight});
    }
    return {
      version:1,
      bpm,
      nonDestructive:true,
      executable:false,
      duration:rows.length?rows.at(-1).end-rows[0].start:0,
      rows,
      sectionBands,
      markers,
      summary:{
        totalEights:rows.length,
        sections:sectionBands.length,
        smartMixEights:rows.filter(row=>row.hasSmartMix).length,
        mismatchEights:rows.filter(row=>row.energy.alignment&&row.energy.alignment!=='match').length,
        markers:markers.length
      }
    };
  }

  const api={ENERGY_SCORE,EVENT_GROUP,overlaps,countGrid,eventBadge,buildTimelinePresentation};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerTimelineViewCore=api;
})();
