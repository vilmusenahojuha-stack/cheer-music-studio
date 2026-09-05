(()=>{
  'use strict';

  const SECTION_TYPES=Object.freeze(['intro','stunt','tumbling','pyramid','dance','transition','ending','other']);
  const ENERGY_LEVELS=Object.freeze(['low','medium','high','peak']);

  function finiteNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function beatSeconds(bpm){
    bpm=finiteNumber(bpm);
    if(bpm<=0)throw new Error('BPM must be greater than zero.');
    return 60/bpm;
  }

  function eightCountSeconds(bpm){return beatSeconds(bpm)*8;}

  function normalizeSection(section,index=0){
    const startEight=Math.max(1,Math.round(finiteNumber(section?.startEight,index+1)));
    const endEight=Math.max(startEight,Math.round(finiteNumber(section?.endEight,startEight)));
    const type=SECTION_TYPES.includes(section?.type)?section.type:'other';
    const energy=ENERGY_LEVELS.includes(section?.energy)?section.energy:'medium';
    return {
      id:String(section?.id||`section-${index+1}`),
      startEight,
      endEight,
      type,
      energy,
      label:String(section?.label||''),
      notes:String(section?.notes||'')
    };
  }

  function buildEightCountMap({bpm,oneOffset=0,totalEights=0,sections=[]}={}){
    const duration=eightCountSeconds(bpm);
    const offset=Math.max(0,finiteNumber(oneOffset));
    const count=Math.max(0,Math.floor(finiteNumber(totalEights)));
    const normalized=sections.map(normalizeSection);
    const result=[];
    for(let i=0;i<count;i++){
      const eight=i+1;
      const section=normalized.find(s=>eight>=s.startEight&&eight<=s.endEight)||null;
      result.push({
        eight,
        start:offset+i*duration,
        end:offset+(i+1)*duration,
        sectionId:section?.id||null,
        sectionType:section?.type||null,
        energy:section?.energy||null
      });
    }
    return result;
  }

  function snapToCount(time,{bpm,oneOffset=0,mode='beat'}={}){
    const unit=mode==='eight'?eightCountSeconds(bpm):beatSeconds(bpm);
    const offset=Math.max(0,finiteNumber(oneOffset));
    const relative=finiteNumber(time)-offset;
    return Math.max(offset,offset+Math.round(relative/unit)*unit);
  }

  function validateSections(sections=[]){
    const normalized=sections.map(normalizeSection).sort((a,b)=>a.startEight-b.startEight);
    const issues=[];
    for(let i=1;i<normalized.length;i++){
      if(normalized[i].startEight<=normalized[i-1].endEight){
        issues.push({type:'overlap',left:normalized[i-1].id,right:normalized[i].id});
      }
    }
    return {ok:issues.length===0,sections:normalized,issues};
  }

  const api={SECTION_TYPES,ENERGY_LEVELS,beatSeconds,eightCountSeconds,normalizeSection,buildEightCountMap,snapToCount,validateSections};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.CheerStructureCore=api;
})();
