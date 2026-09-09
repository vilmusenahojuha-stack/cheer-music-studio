const assert=require('node:assert/strict');
const fs=require('node:fs');
const {collectRisks,compareFinalChecks}=require('../competition-master-final-check-history.js');

const before={
  riskFlags:['final-true-peak-headroom-failed','final-section-clarity-failed'],
  sectionIssues:[
    {sectionId:'dance',label:'Dance',focusKind:'voiceover',focusStartSeconds:12,focusEndSeconds:14},
    {sectionId:'ending',label:'Ending',focusKind:'fx',focusStartSeconds:70,focusEndSeconds:71.5}
  ]
};
const after={
  riskFlags:['final-true-peak-headroom-failed','final-dynamics-check-failed'],
  sectionIssues:[
    {sectionId:'ending',label:'Ending',focusKind:'fx',focusStartSeconds:70,focusEndSeconds:71.5}
  ]
};

const collected=collectRisks(before);
assert.equal(collected.length,4,'global and section-specific risks must both be tracked');
assert.ok(collected.some(item=>item.key==='section:dance:voiceover:12.000:14.000'),'section risk identity must include section, kind and exact window');

const comparison=compareFinalChecks(before,after);
assert.equal(comparison.beforeCount,4);
assert.equal(comparison.afterCount,3);
assert.equal(comparison.removed.length,2,'resolved global/section risks must be reported as removed');
assert.ok(comparison.removed.some(item=>item.key==='flag:final-section-clarity-failed'));
assert.ok(comparison.removed.some(item=>item.key.startsWith('section:dance:voiceover')));
assert.equal(comparison.remaining.length,2,'unchanged risks must remain visible');
assert.ok(comparison.remaining.some(item=>item.key==='flag:final-true-peak-headroom-failed'));
assert.ok(comparison.remaining.some(item=>item.key.startsWith('section:ending:fx')));
assert.equal(comparison.added.length,1,'newly introduced risks must be separated from remaining risks');
assert.equal(comparison.added[0].key,'flag:final-dynamics-check-failed');
assert.equal(comparison.improved,true,'more removed than added risks should be marked as improved');
assert.equal(comparison.unchanged,false);
assert.equal(compareFinalChecks(null,after),null,'comparison must not invent history without a previous final-check');

const refreshSource=fs.readFileSync('competition-master-final-check-refresh.js','utf8');
const historySource=fs.readFileSync('competition-master-final-check-history.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');
assert.ok(/previousFinalCheck=mix\.getLastCompetitionMasterFinalCheck/.test(refreshSource),'refresh must snapshot the previous final-check before new measurements are evaluated');
assert.ok(/previousFinalCheck,/.test(refreshSource),'refresh event must carry the previous final-check snapshot');
assert.ok(/status!=='refreshed'/.test(historySource)&&/current-project-offline-render/.test(historySource)&&/nonDestructive!==true/.test(historySource),'history must accept only completed non-destructive current-project refreshes');
assert.ok(!/renderProject|measureCompetitionMaster|measureCompetitionClarity|evaluateCompetitionMasterReadiness/.test(historySource),'history must not render or measure audio');
assert.ok(!/normalize|DynamicsCompressor|createGain|applyMasterHeadroom|encodeWav/i.test(historySource),'history must not perform mastering or export processing');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(historySource),'history must not mutate final-check decisions');
assert.ok(/competition-master-final-check-history\.js\?v=5\.0p3l/.test(workflow),'simple workflow must load the history module with an explicit cache version');
const syncIndex=workflow.indexOf('loadCompetitionMasterFinalCheckRefreshUISync();');
const historyIndex=workflow.indexOf('loadCompetitionMasterFinalCheckHistory();');
assert.ok(syncIndex>=0&&historyIndex>syncIndex,'history must load after refreshed final-check assessment sync');

console.log('competition-master-final-check-history: before/after risk comparison is diagnostic and non-destructive');
