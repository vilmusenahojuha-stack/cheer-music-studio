const assert=require('node:assert/strict');
const fs=require('node:fs');
const {FLAG_GUIDANCE,formatFlagLabel,formatSectionLabel,getSectionGuidance,formatRiskStatus,collectRisks,compareFinalChecks}=require('../competition-master-final-check-history.js');

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

assert.equal(formatFlagLabel('final-true-peak-headroom-failed'),'True peak / headroom');
assert.equal(formatFlagLabel('final-dynamics-check-failed'),'Dynamiikka');
assert.equal(formatFlagLabel('final-voiceover-clarity-unmeasured'),'Voiceover clarity mittaamatta');
assert.equal(formatFlagLabel('final-custom-risk'),'Custom risk','unknown final-check flags must still get a readable fallback label');
assert.match(FLAG_GUIDANCE['final-true-peak-headroom-failed'],/headroom/i,'true-peak failure must point the user toward headroom/transients');
assert.match(FLAG_GUIDANCE['final-section-balance-failed'],/osioiden/i,'section balance failure must point toward section-level balance');
assert.equal(formatSectionLabel({label:'Dance',focusKind:'voiceover'}),'Dance · voiceover');
assert.equal(formatSectionLabel({label:'Ending',focusKind:'fx'}),'Ending · FX');
assert.match(getSectionGuidance({focusKind:'voiceover'}),/voiceover/i);
assert.match(getSectionGuidance({focusKind:'fx'}),/cheer-FX/i);
assert.match(getSectionGuidance({focusKind:'clarity'}),/sama aikajakso/i);
assert.equal(formatRiskStatus({label:'Dance · voiceover',guidance:'ei pitäisi näkyä'},'removed'),'Dance · voiceover — korjattu','resolved risks must not keep corrective guidance');
assert.equal(formatRiskStatus({label:'True peak / headroom',guidance:'Tarkista headroom.'},'remaining'),'True peak / headroom — edelleen estää kilpailumasterin → Tarkista headroom.');
assert.equal(formatRiskStatus({label:'Dynamiikka',guidance:'Tarkista dynamiikka.'},'added'),'Dynamiikka — uusi riski — tarkista → Tarkista dynamiikka.');
assert.equal(formatRiskStatus({label:'Tunnettu',guidance:'ei käytetä'},'future-state'),'Tunnettu — tila muuttui','unknown future states must degrade safely without accidental actions');

const collected=collectRisks(before);
assert.equal(collected.length,4,'global and section-specific risks must both be tracked');
assert.ok(collected.some(item=>item.key==='section:dance:voiceover:12.000:14.000'),'section risk identity must include section, kind and exact window');
assert.ok(collected.some(item=>item.key==='flag:final-true-peak-headroom-failed'&&item.label==='True peak / headroom'&&/headroom/i.test(item.guidance)),'global flags must carry both a user-readable label and corrective guidance');
assert.ok(collected.some(item=>item.key.startsWith('section:dance:voiceover')&&item.label==='Dance · voiceover'&&/sama aikajakso/i.test(item.guidance)),'section risks must carry section-specific same-window guidance');
const unknown=collectRisks({riskFlags:['final-custom-risk']})[0];
assert.match(unknown.guidance,/Tarkista tämä final-check-riski/,'unknown future risks must get generic safe guidance');

const comparison=compareFinalChecks(before,after);
assert.equal(comparison.beforeCount,4);
assert.equal(comparison.afterCount,3);
assert.equal(comparison.removed.length,2,'resolved global/section risks must be reported as removed');
assert.ok(comparison.removed.some(item=>item.key==='flag:final-section-clarity-failed'));
assert.ok(comparison.removed.some(item=>item.key.startsWith('section:dance:voiceover')));
assert.equal(comparison.remaining.length,2,'unchanged risks must remain visible');
assert.ok(comparison.remaining.some(item=>item.key==='flag:final-true-peak-headroom-failed'));
assert.ok(comparison.remaining.some(item=>item.key.startsWith('section:ending:fx')));
assert.match(comparison.remaining.find(item=>item.key.startsWith('section:ending:fx')).guidance,/cheer-FX/i,'remaining section FX risk must explain the next corrective focus');
assert.equal(comparison.added.length,1,'newly introduced risks must be separated from remaining risks');
assert.equal(comparison.added[0].key,'flag:final-dynamics-check-failed');
assert.equal(comparison.added[0].label,'Dynamiikka','new risks must be understandable without exposing internal flag names');
assert.match(comparison.added[0].guidance,/dynamiikka/i,'new risks must include a safe corrective direction');
assert.equal(comparison.improved,true,'more removed than added risks should be marked as improved');
assert.equal(comparison.unchanged,false);
assert.equal(compareFinalChecks(null,after),null,'comparison must not invent history without a previous final-check');

const refreshSource=fs.readFileSync('competition-master-final-check-refresh.js','utf8');
const historySource=fs.readFileSync('competition-master-final-check-history.js','utf8');
const workflow=fs.readFileSync('simple-workflow.js','utf8');
assert.ok(/previousFinalCheck=mix\.getLastCompetitionMasterFinalCheck/.test(refreshSource),'refresh must snapshot the previous final-check before new measurements are evaluated');
assert.ok(/previousFinalCheck,/.test(refreshSource),'refresh event must carry the previous final-check snapshot');
assert.ok(/status!=='refreshed'/.test(historySource)&&/current-project-offline-render/.test(historySource)&&/nonDestructive!==true/.test(historySource),'history must accept only completed non-destructive current-project refreshes');
assert.ok(/Poistuneet riskit/.test(historySource)&&/Jäljellä olevat riskit/.test(historySource)&&/Uudet riskit/.test(historySource),'history UI must name each before/after risk group');
assert.ok(/removed:'korjattu'/.test(historySource)&&/remaining:'edelleen estää kilpailumasterin'/.test(historySource)&&/added:'uusi riski — tarkista'/.test(historySource),'history must explain what each risk state means to the user');
assert.ok(/FLAG_GUIDANCE/.test(historySource)&&/getSectionGuidance/.test(historySource),'history must provide corrective guidance for global and section risks');
assert.ok(/state==='remaining'\|\|state==='added'/.test(historySource),'corrective guidance must only appear for active or newly introduced risks');
assert.ok(/li\.textContent=formatRiskStatus\(item,state\)/.test(historySource),'risk impact details must be rendered as text, not injected HTML');
assert.ok(!/innerHTML\s*=/.test(historySource),'history must not render risk labels through innerHTML');
assert.ok(!/renderProject|measureCompetitionMaster|measureCompetitionClarity|evaluateCompetitionMasterReadiness/.test(historySource),'history must not render or measure audio');
assert.ok(!/normalize|DynamicsCompressor|createGain|applyMasterHeadroom|encodeWav/i.test(historySource),'history must not perform mastering or export processing');
assert.ok(!/finalCheck\.status\s*=|riskFlags\s*=|sectionIssues\s*=/.test(historySource),'history must not mutate final-check decisions');
assert.ok(/competition-master-final-check-history\.js\?v=5\.0p3o/.test(workflow),'simple workflow must load the corrective-guidance history module with an explicit refreshed cache version');
const syncIndex=workflow.indexOf('loadCompetitionMasterFinalCheckRefreshUISync();');
const historyIndex=workflow.indexOf('loadCompetitionMasterFinalCheckHistory();');
assert.ok(syncIndex>=0&&historyIndex>syncIndex,'history must load after refreshed final-check assessment sync');

console.log('competition-master-final-check-history: active risks include safe corrective guidance and remain non-destructive');
