const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  parseSectionWindow,
  locateTimeInCounts,
  locateWindowInCounts,
  buildStructuralLocation,
  findRiskByKey,
  buildPriorityContext,
  focusPriorityContext
}=require('../competition-master-final-check-priority-context.js');

const comparison={
  advisoryOnly:true,
  nonDestructive:true,
  added:[],
  remaining:[
    {
      key:'flag:final-true-peak-headroom-failed',
      label:'True peak / headroom',
      measurement:'-0.68 dBTP · raja ≤ -1.00 dBTP'
    },
    {
      key:'section:ending:fx:72.000:78.500',
      label:'Ending · FX',
      sectionId:'ending',
      kind:'fx',
      measurement:'0.64 · raja ≥ 0.68'
    }
  ]
};

const windowRange=parseSectionWindow('section:ending:fx:72.000:78.500');
assert.deepEqual(windowRange,{startSeconds:72,endSeconds:78.5,text:'1:12.000–1:18.500'});
assert.equal(parseSectionWindow('flag:final-true-peak-headroom-failed'),null);
assert.equal(parseSectionWindow('section:ending:fx:78.500:72.000'),null);

assert.deepEqual(locateTimeInCounts(72,{bpm:120}),{eight:19,count:1,beatIndex:144,beatStart:72});
assert.deepEqual(
  locateWindowInCounts(windowRange,{bpm:120}),
  {
    start:{eight:19,count:1,beatIndex:144,beatStart:72},
    end:{eight:20,count:5,beatIndex:156,beatStart:78},
    text:'kasi 19, lasku 1 – kasi 20, lasku 5'
  }
);
assert.equal(locateWindowInCounts(windowRange,{bpm:0}),null);
assert.equal(locateTimeInCounts(1,{bpm:120,oneOffset:2}),null);

const oneEight=parseSectionWindow('section:dance:fx:0.000:2.000');
assert.equal(locateWindowInCounts(oneEight,{bpm:240}).text,'kasi 1, laskut 1–8');

const project={
  targetBpm:120,
  eights:Array.from({length:24},(_,index)=>({part:index<16?'Transition':'Ending'}))
};
const workflow={
  buildSectionsFromEights(eights){return [{id:'section-1',type:'transition',label:'Transition',startEight:1,endEight:16,energy:'medium'},{id:'section-2',type:'ending',label:'Ending',startEight:17,endEight:eights.length,energy:'peak'}];}
};
const plan={
  buildCheerPlan(){
    const timeline=Array.from({length:24},(_,index)=>{
      const eight=index+1;
      const ending=eight>=17;
      return {
        eight,
        sectionId:ending?'section-2':'section-1',
        sectionType:ending?'ending':'transition',
        sectionLabel:ending?'Ending':'Transition',
        energy:ending?'peak':'medium',
        phrase:Math.floor(index/4)+1,
        phraseEnergyTrend:'steady'
      };
    });
    const phrases=Array.from({length:6},(_,index)=>({phrase:index+1,startEight:index*4+1,endEight:index*4+4,energyTrend:'steady'}));
    return {timeline,phrases};
  }
};
const structural=buildStructuralLocation(project,{start:{eight:19,count:1}},{plan,workflow});
assert.deepEqual(structural.phrase,{number:5,startEight:17,endEight:20,energyTrend:'steady'});
assert.deepEqual(structural.energyRange,{level:'peak',startEight:17,endEight:24});
assert.equal(structural.sectionType,'ending');
assert.match(structural.text,/fraasi 5 \(kasit 17–20\)/);
assert.match(structural.text,/energiajakso huippu \(kasit 17–24\)/);
assert.doesNotMatch(structural.text,/fraasin energia/);
assert.equal(buildStructuralLocation({...project,targetBpm:0},{start:{eight:19,count:1}},{plan,workflow}),null);
assert.equal(buildStructuralLocation(project,{start:{eight:30,count:1}},{plan,workflow}),null);

assert.equal(findRiskByKey(comparison,'section:ending:fx:72.000:78.500').label,'Ending · FX');
assert.equal(findRiskByKey(comparison,'missing'),null);

const sectionSummary={
  advisoryOnly:true,
  nonDestructive:true,
  priorityRepairTarget:{key:'section:ending:fx:72.000:78.500',label:'Ending · FX'}
};
const sectionContext=buildPriorityContext(comparison,sectionSummary,{bpm:120,project,cores:{plan,workflow}});
assert.equal(sectionContext.label,'Ending · FX');
assert.equal(sectionContext.riskKind,'fx');
assert.equal(sectionContext.measurement,'0.64 · raja ≥ 0.68');
assert.equal(sectionContext.sectionId,'ending');
assert.deepEqual(sectionContext.window,{startSeconds:72,endSeconds:78.5,text:'1:12.000–1:18.500'});
assert.equal(sectionContext.countLocation.text,'kasi 19, lasku 1 – kasi 20, lasku 5');
assert.equal(sectionContext.structuralLocation.phrase.number,5);
assert.equal(sectionContext.structuralLocation.energyRange.level,'peak');
assert.match(sectionContext.text,/mitattu 0\.64 · raja ≥ 0\.68/);
assert.match(sectionContext.text,/aikaväli 1:12\.000–1:18\.500/);
assert.match(sectionContext.text,/kasi 19, lasku 1 – kasi 20, lasku 5/);
assert.match(sectionContext.text,/fraasi 5 \(kasit 17–20\)/);
assert.match(sectionContext.text,/energiajakso huippu \(kasit 17–24\)/);

const calls=[];
const editor={
  highlightRange(start,end,options){calls.push(['highlight',start,end,options]);return true;},
  setPlayhead(seconds,scroll){calls.push(['playhead',seconds,scroll]);}
};
assert.equal(focusPriorityContext(sectionContext,editor),true);
assert.deepEqual(calls,[
  ['highlight',72,78.5,{kind:'fx',durationMs:8000}],
  ['playhead',72,true]
]);

assert.equal(focusPriorityContext({...sectionContext,advisoryOnly:false},editor),false);
assert.equal(focusPriorityContext({...sectionContext,window:null},editor),false);

const flagSummary={
  advisoryOnly:true,
  nonDestructive:true,
  priorityRepairTarget:{key:'flag:final-true-peak-headroom-failed',label:'True peak / headroom'}
};
const flagContext=buildPriorityContext(comparison,flagSummary,{bpm:120,project,cores:{plan,workflow}});
assert.equal(flagContext.window,null);
assert.equal(flagContext.countLocation,null);
assert.equal(flagContext.structuralLocation,null);
assert.match(flagContext.text,/mitattu -0\.68 dBTP · raja ≤ -1\.00 dBTP/);
assert.doesNotMatch(flagContext.text,/kasi|lasku|aikaväli|fraasi|energiajakso/);
assert.equal(focusPriorityContext(flagContext,editor),false);

const noTempo=buildPriorityContext(comparison,sectionSummary,{project:{...project,targetBpm:0},cores:{plan,workflow}});
assert.equal(noTempo.countLocation,null);
assert.equal(noTempo.structuralLocation,null);
assert.match(noTempo.text,/aikaväli 1:12\.000–1:18\.500/);
assert.doesNotMatch(noTempo.text,/kasi 19|fraasi|energiajakso/);

assert.equal(buildPriorityContext(comparison,{...flagSummary,advisoryOnly:false},{bpm:120}),null);
assert.equal(buildPriorityContext({...comparison,nonDestructive:false},flagSummary,{bpm:120}),null);
assert.equal(buildPriorityContext(comparison,{advisoryOnly:true,nonDestructive:true,priorityRepairTarget:null},{bpm:120}),null);

const source=fs.readFileSync('competition-master-final-check-priority-context.js','utf8');
assert.ok(/text\.textContent=context\.text/.test(source),'context must render diagnostic text safely');
assert.ok(/button\.textContent='Näytä kohta aikajanalla'/.test(source),'section context must expose an explicit timeline focus action');
assert.ok(/window\.state\?\.targetBpm/.test(source),'count location must use the existing project target BPM');
assert.ok(/CheerPlanCore/.test(source)&&/CheerSmartMixWorkflow/.test(source),'structural location must reuse the existing cheer plan rather than inventing a second model');
assert.ok(!/innerHTML/.test(source),'context must not inject HTML');
assert.ok(!/\.seek\(|startTransport|stopTransport|renderProject|measureCompetitionMaster|evaluateCompetitionMasterReadiness|DynamicsCompressor|createGain|encodeWav/i.test(source),'phrase-aware timeline focus must not control playback or audio processing');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(source),'context must not mutate final-check decisions');

console.log('competition-master-final-check-priority-context: priority repair maps to phrase and energy period without audio mutation');