const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
  parseSectionWindow,
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

assert.equal(findRiskByKey(comparison,'section:ending:fx:72.000:78.500').label,'Ending · FX');
assert.equal(findRiskByKey(comparison,'missing'),null);

const sectionSummary={
  advisoryOnly:true,
  nonDestructive:true,
  priorityRepairTarget:{key:'section:ending:fx:72.000:78.500',label:'Ending · FX'}
};
const sectionContext=buildPriorityContext(comparison,sectionSummary);
assert.equal(sectionContext.label,'Ending · FX');
assert.equal(sectionContext.riskKind,'fx');
assert.equal(sectionContext.measurement,'0.64 · raja ≥ 0.68');
assert.equal(sectionContext.sectionId,'ending');
assert.deepEqual(sectionContext.window,{startSeconds:72,endSeconds:78.5,text:'1:12.000–1:18.500'});
assert.match(sectionContext.text,/mitattu 0\.64 · raja ≥ 0\.68/);
assert.match(sectionContext.text,/osio ending/);
assert.match(sectionContext.text,/aikaväli 1:12\.000–1:18\.500/);

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
const flagContext=buildPriorityContext(comparison,flagSummary);
assert.equal(flagContext.window,null);
assert.match(flagContext.text,/mitattu -0\.68 dBTP · raja ≤ -1\.00 dBTP/);
assert.doesNotMatch(flagContext.text,/aikaväli/);
assert.equal(focusPriorityContext(flagContext,editor),false);

assert.equal(buildPriorityContext(comparison,{...flagSummary,advisoryOnly:false}),null);
assert.equal(buildPriorityContext({...comparison,nonDestructive:false},flagSummary),null);
assert.equal(buildPriorityContext(comparison,{advisoryOnly:true,nonDestructive:true,priorityRepairTarget:null}),null);

const source=fs.readFileSync('competition-master-final-check-priority-context.js','utf8');
assert.ok(/text\.textContent=context\.text/.test(source),'context must render diagnostic text safely');
assert.ok(/button\.textContent='Näytä kohta aikajanalla'/.test(source),'section context must expose an explicit timeline focus action');
assert.ok(!/innerHTML/.test(source),'context must not inject HTML');
assert.ok(!/\.seek\(|startTransport|stopTransport|renderProject|measureCompetitionMaster|evaluateCompetitionMasterReadiness|DynamicsCompressor|createGain|encodeWav/i.test(source),'timeline focus must not control playback or audio processing');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(source),'context must not mutate final-check decisions');

console.log('competition-master-final-check-priority-context: priority section can be focused on timeline without playback or audio mutation');
