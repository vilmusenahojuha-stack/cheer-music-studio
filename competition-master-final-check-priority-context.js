(()=>{
  'use strict';

  function array(value){return Array.isArray(value)?value:[];}

  function finite(value){
    if(value===null||value===undefined||value==='')return null;
    const number=Number(value);
    return Number.isFinite(number)?number:null;
  }

  function formatTime(seconds){
    const value=finite(seconds);
    if(value===null)return null;
    const minutes=Math.floor(value/60);
    const rest=value-minutes*60;
    return `${minutes}:${rest.toFixed(3).padStart(6,'0')}`;
  }

  function parseSectionWindow(key){
    const raw=String(key||'');
    if(!raw.startsWith('section:'))return null;
    const parts=raw.split(':');
    if(parts.length<5)return null;
    const start=finite(parts[parts.length-2]);
    const end=finite(parts[parts.length-1]);
    if(start===null||end===null||end<start)return null;
    return {startSeconds:start,endSeconds:end,text:`${formatTime(start)}–${formatTime(end)}`};
  }

  function locateTimeInCounts(time,{bpm,oneOffset=0,endExclusive=false}={}){
    const seconds=finite(time);
    const tempo=finite(bpm);
    const offset=Math.max(0,finite(oneOffset)||0);
    if(seconds===null||tempo===null||tempo<=0||seconds<offset)return null;
    const beatDuration=60/tempo;
    const epsilon=endExclusive?Math.min(1e-6,beatDuration/1000):0;
    const relative=Math.max(0,seconds-offset-epsilon);
    const beatIndex=Math.floor(relative/beatDuration+1e-9);
    return {
      eight:Math.floor(beatIndex/8)+1,
      count:(beatIndex%8)+1,
      beatIndex,
      beatStart:offset+beatIndex*beatDuration
    };
  }

  function locateWindowInCounts(windowRange,{bpm,oneOffset=0}={}){
    if(!windowRange)return null;
    const start=locateTimeInCounts(windowRange.startSeconds,{bpm,oneOffset});
    const end=locateTimeInCounts(windowRange.endSeconds,{bpm,oneOffset,endExclusive:true});
    if(!start||!end)return null;
    const text=start.eight===end.eight
      ?`kasi ${start.eight}, laskut ${start.count}–${end.count}`
      :`kasi ${start.eight}, lasku ${start.count} – kasi ${end.eight}, lasku ${end.count}`;
    return {start,end,text};
  }

  function energyText(value){
    return ({low:'matala',medium:'keskitaso',high:'korkea',peak:'huippu'})[value]||String(value||'');
  }

  function trendText(value){
    return ({rising:'nouseva',falling:'laskeva',steady:'tasainen'})[value]||String(value||'');
  }

  function transitionText(value){
    return ({break:'break',drop:'drop',cut:'leikkaus'})[value]||String(value||'');
  }

  function findNearestTransition(plan,targetEight,{maxDistanceEights=2}={}){
    const target=finite(targetEight);
    const maxDistance=Math.max(0,finite(maxDistanceEights)??2);
    if(target===null)return null;
    const typePriority={break:3,drop:2,cut:1};
    const candidates=array(plan?.transitionCandidates)
      .map(candidate=>{
        const atEight=finite(candidate?.atEight);
        if(atEight===null||!['break','drop','cut'].includes(candidate?.type))return null;
        const distance=Math.abs(atEight-target);
        if(distance>maxDistance)return null;
        return {
          type:candidate.type,
          atEight,
          distanceEights:distance,
          confidence:Math.max(0,Math.min(1,finite(candidate?.confidence)||0)),
          reason:candidate?.reason||null,
          source:candidate?.source||'structure',
          time:finite(candidate?.time)
        };
      })
      .filter(Boolean)
      .sort((a,b)=>a.distanceEights-b.distanceEights||b.confidence-a.confidence||(typePriority[b.type]||0)-(typePriority[a.type]||0)||a.atEight-b.atEight);
    const best=candidates[0];
    if(!best)return null;
    return {...best,text:`lähin ${transitionText(best.type)}: kasi ${best.atEight}${best.distanceEights?` (${best.distanceEights} kasin päässä)`:''}`};
  }

  function buildStructuralLocation(project,countLocation,cores={}){
    if(!project||!countLocation?.start)return null;
    const planCore=cores.plan||(typeof window!=='undefined'?window.CheerPlanCore:null);
    const workflow=cores.workflow||(typeof window!=='undefined'?window.CheerSmartMixWorkflow:null);
    if(typeof planCore?.buildCheerPlan!=='function'||typeof workflow?.buildSectionsFromEights!=='function')return null;
    const eights=array(project.eights);
    const bpm=finite(project.targetBpm);
    if(!eights.length||bpm===null||bpm<=0)return null;
    let plan;
    try{
      const sections=workflow.buildSectionsFromEights(eights);
      plan=planCore.buildCheerPlan({bpm,totalEights:eights.length,sections});
    }catch{return null;}
    const targetEight=Number(countLocation.start.eight);
    const row=array(plan?.timeline).find(item=>Number(item?.eight)===targetEight);
    if(!row)return null;
    const phrase=array(plan?.phrases).find(item=>Number(item?.phrase)===Number(row.phrase))||null;
    const timeline=array(plan.timeline);
    const targetIndex=timeline.findIndex(item=>Number(item?.eight)===targetEight);
    let energyStart=targetIndex,energyEnd=targetIndex;
    while(energyStart>0&&timeline[energyStart-1]?.energy===row.energy)energyStart--;
    while(energyEnd<timeline.length-1&&timeline[energyEnd+1]?.energy===row.energy)energyEnd++;
    const energyRange=row.energy?{
      level:row.energy,
      startEight:Number(timeline[energyStart]?.eight),
      endEight:Number(timeline[energyEnd]?.eight)
    }:null;
    const transition=findNearestTransition(plan,targetEight,{maxDistanceEights:2});
    const sectionLabel=row.sectionLabel||row.sectionType||null;
    const parts=[];
    if(phrase?.phrase){
      parts.push(`fraasi ${phrase.phrase} (kasit ${phrase.startEight}–${phrase.endEight})`);
    }
    if(energyRange){
      parts.push(`energiajakso ${energyText(energyRange.level)} (kasit ${energyRange.startEight}–${energyRange.endEight})`);
    }
    if(row.phraseEnergyTrend&&row.phraseEnergyTrend!=='steady'){
      parts.push(`fraasin energia ${trendText(row.phraseEnergyTrend)}`);
    }
    if(transition)parts.push(transition.text);
    if(!parts.length)return null;
    return {
      phrase:phrase?{
        number:Number(phrase.phrase),
        startEight:Number(phrase.startEight),
        endEight:Number(phrase.endEight),
        energyTrend:phrase.energyTrend||'steady'
      }:null,
      energyRange,
      transition,
      sectionType:row.sectionType||null,
      sectionLabel,
      text:parts.join(' · ')
    };
  }

  function findRiskByKey(comparison,key){
    if(!key)return null;
    return [...array(comparison?.added),...array(comparison?.remaining)].find(item=>item?.key===key)||null;
  }

  function buildPriorityContext(comparison,summary,timing={}){
    if(!comparison||comparison.advisoryOnly!==true||comparison.nonDestructive!==true)return null;
    if(!summary||summary.advisoryOnly!==true||summary.nonDestructive!==true)return null;
    const target=summary.priorityRepairTarget;
    if(!target?.key)return null;
    const risk=findRiskByKey(comparison,target.key);
    if(!risk)return null;
    const measurement=typeof risk.measurement==='string'&&risk.measurement.trim()?risk.measurement.trim():null;
    const windowRange=parseSectionWindow(risk.key);
    const countLocation=windowRange?locateWindowInCounts(windowRange,timing):null;
    const structuralLocation=countLocation?buildStructuralLocation(timing.project,countLocation,timing.cores||{}):null;
    const sectionId=risk.sectionId||null;
    const parts=[];
    if(measurement)parts.push(`mitattu ${measurement}`);
    if(sectionId)parts.push(`osio ${sectionId}`);
    if(windowRange)parts.push(`aikaväli ${windowRange.text}`);
    if(countLocation)parts.push(countLocation.text);
    if(structuralLocation)parts.push(structuralLocation.text);
    if(!parts.length)return null;
    return {
      kind:'cheer-competition-master-final-check-priority-context',
      advisoryOnly:true,
      nonDestructive:true,
      key:risk.key,
      label:risk.label||target.label||'Korjauskohde',
      riskKind:risk.kind||null,
      measurement,
      sectionId,
      window:windowRange,
      countLocation,
      structuralLocation,
      text:`Korjauskohteen tiedot: ${risk.label||target.label||'Korjauskohde'} · ${parts.join(' · ')}.`
    };
  }

  function focusPriorityContext(context,editor){
    if(!context||context.advisoryOnly!==true||context.nonDestructive!==true||!context.window)return false;
    const audioEditor=editor||(typeof window!=='undefined'?window.cheerAudioEditor:null);
    if(!audioEditor)return false;
    const start=context.window.startSeconds,end=context.window.endSeconds;
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return false;
    const highlighted=typeof audioEditor.highlightRange==='function'
      ?audioEditor.highlightRange(start,end,{kind:context.riskKind||'clarity',durationMs:8000})
      :false;
    if(typeof audioEditor.setPlayhead==='function')audioEditor.setPlayhead(start,true);
    return highlighted===true||typeof audioEditor.setPlayhead==='function';
  }

  function ensureNode(){
    const summaryNode=document.querySelector('#competitionMasterFinalCheckProgressSummary');
    if(!summaryNode)return null;
    let node=document.querySelector('#competitionMasterFinalCheckPriorityContext');
    if(node)return node;
    node=document.createElement('div');
    node.id='competitionMasterFinalCheckPriorityContext';
    node.className='competition-master-final-check-priority-context';
    node.setAttribute('role','status');
    node.setAttribute('aria-live','polite');
    summaryNode.insertAdjacentElement('afterend',node);
    return node;
  }

  function render(context){
    const node=ensureNode();
    if(!node)return false;
    node.replaceChildren();
    if(!context){
      node.hidden=true;
      delete node.dataset.priorityRepairKey;
      delete node.dataset.priorityRepairEight;
      delete node.dataset.priorityRepairCount;
      delete node.dataset.priorityRepairPhrase;
      delete node.dataset.priorityRepairEnergy;
      delete node.dataset.priorityRepairTransition;
      return false;
    }
    node.hidden=false;
    node.dataset.priorityRepairKey=context.key;
    if(context.countLocation){
      node.dataset.priorityRepairEight=String(context.countLocation.start.eight);
      node.dataset.priorityRepairCount=String(context.countLocation.start.count);
    }else{
      delete node.dataset.priorityRepairEight;
      delete node.dataset.priorityRepairCount;
    }
    if(context.structuralLocation?.phrase?.number)node.dataset.priorityRepairPhrase=String(context.structuralLocation.phrase.number);
    else delete node.dataset.priorityRepairPhrase;
    if(context.structuralLocation?.energyRange?.level)node.dataset.priorityRepairEnergy=context.structuralLocation.energyRange.level;
    else delete node.dataset.priorityRepairEnergy;
    if(context.structuralLocation?.transition?.type)node.dataset.priorityRepairTransition=context.structuralLocation.transition.type;
    else delete node.dataset.priorityRepairTransition;
    const text=document.createElement('span');
    text.textContent=context.text;
    node.appendChild(text);
    if(context.window){
      const button=document.createElement('button');
      button.type='button';
      button.className='btn secondary competition-master-priority-focus';
      button.textContent='Näytä kohta aikajanalla';
      button.addEventListener('click',()=>focusPriorityContext(context));
      node.appendChild(document.createTextNode(' '));
      node.appendChild(button);
    }
    return true;
  }

  function refresh(){
    const comparison=window.cheerCompetitionMasterFinalCheckHistory?.getLastComparison?.();
    const summarize=window.cheerCompetitionMasterFinalCheckProgressSummary?.summarizeComparison;
    const summary=typeof summarize==='function'?summarize(comparison):null;
    const bpm=finite(window.state?.targetBpm);
    const context=buildPriorityContext(comparison,summary,{
      bpm,
      oneOffset:0,
      project:window.state,
      cores:{plan:window.CheerPlanCore,workflow:window.CheerSmartMixWorkflow}
    });
    render(context);
    return context;
  }

  function init(){
    window.addEventListener('cheer-competition-master-final-check-refreshed',()=>queueMicrotask(refresh));
    window.cheerCompetitionMasterFinalCheckPriorityContext={parseSectionWindow,locateTimeInCounts,locateWindowInCounts,findNearestTransition,buildStructuralLocation,findRiskByKey,buildPriorityContext,focusPriorityContext,refresh,render};
  }

  if(typeof module!=='undefined'&&module.exports)module.exports={parseSectionWindow,locateTimeInCounts,locateWindowInCounts,findNearestTransition,buildStructuralLocation,findRiskByKey,buildPriorityContext,focusPriorityContext};
  if(typeof window!=='undefined'&&typeof document!=='undefined')document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();